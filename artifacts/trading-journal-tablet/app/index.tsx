import { StatusBar } from "expo-status-bar";
import React, { useCallback, useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import WebView, { WebViewMessageEvent } from "react-native-webview";

// Guard against Metro injecting the literal string "undefined" when the env
// var was not set at bundle time, and against an empty string.
const _raw = process.env.EXPO_PUBLIC_DOMAIN;
const DOMAIN = (_raw && _raw !== "undefined") ? _raw : "";
const WEB_URL = DOMAIN ? `https://${DOMAIN}/` : "";

const TABLET_UA =
  "Mozilla/5.0 (Linux; Android 13; Lenovo TB-J716F Build/TP1A.220624.014) " +
  "AppleWebKit/537.36 (KHTML, like Gecko) " +
  "Chrome/120.0.6099.230 Safari/537.36";

// ── Rubber-band injected script ────────────────────────────────────────────
//
// Two separate mechanisms cover the two cases the user noticed:
//
//  1. TOUCH DRAG at boundary  — touchmove fires when the user drags past the
//     end of a scroll container.  We calculate the drag delta and send it so
//     RN can apply a proportional (dampened) translateY in real time.
//
//  2. MOMENTUM hits boundary  — scroll events keep firing after the finger
//     lifts during a fling.  We track velocity and, when a scroll container
//     reaches its top/bottom edge with meaningful velocity, send a one-shot
//     event so RN can play a spring-out/spring-back animation.
//
// We skip the native WebView bounces (`bounces={false}`) intentionally so
// there is no double-bounce (both native UIScrollView rubber-band AND our
// Animated translateY running at the same time).
const RUBBER_BAND_JS = `
(function() {
  if (window._rbInit) return;
  window._rbInit = true;

  function post(obj) {
    try { window.ReactNativeWebView.postMessage(JSON.stringify(obj)); } catch(e) {}
  }

  // ── Nearest scrollable ancestor ────────────────────────────────────────
  function getScrollParent(el) {
    while (el && el !== document.body) {
      var s = window.getComputedStyle(el);
      if (/auto|scroll/.test(s.overflowY) && el.scrollHeight > el.clientHeight) return el;
      el = el.parentElement;
    }
    return null;
  }

  // ── 1. Touch-drag rubber band ──────────────────────────────────────────
  var touchStartY = 0;
  var activeEl    = null;
  var isPulling   = false;

  document.addEventListener('touchstart', function(e) {
    touchStartY = e.touches[0].clientY;
    activeEl    = getScrollParent(e.target);
    isPulling   = false;
  }, { passive: true });

  document.addEventListener('touchmove', function(e) {
    if (!activeEl) return;
    var dy       = e.touches[0].clientY - touchStartY;
    var atTop    = activeEl.scrollTop <= 0;
    var atBottom = activeEl.scrollTop + activeEl.clientHeight >= activeEl.scrollHeight - 1;

    if ((atTop && dy > 0) || (atBottom && dy < 0)) {
      isPulling = true;
      post({ type: 'rb_pull', delta: dy });
    } else if (isPulling) {
      isPulling = false;
      post({ type: 'rb_release' });
    }
  }, { passive: true });

  function onTouchEnd() {
    if (isPulling) {
      isPulling = false;
      post({ type: 'rb_release' });
    }
  }
  document.addEventListener('touchend',    onTouchEnd, { passive: true });
  document.addEventListener('touchcancel', onTouchEnd, { passive: true });

  // ── 2. Momentum rubber band ────────────────────────────────────────────
  var attached = new WeakSet ? new WeakSet() : { has: function(){ return false; }, add: function(){} };

  function attachScrollVelocity(el) {
    if (!el || attached.has(el)) return;
    var s = window.getComputedStyle(el);
    if (!/auto|scroll/.test(s.overflowY)) return;
    if (el.scrollHeight <= el.clientHeight) return;
    attached.add(el);

    var prevTop  = el.scrollTop;
    var prevTime = Date.now();
    var velocity = 0;
    var fired    = false; // only fire once per momentum run

    el.addEventListener('scroll', function() {
      var now = Date.now();
      var dt  = Math.max(now - prevTime, 1);
      velocity  = (el.scrollTop - prevTop) / dt;
      prevTop   = el.scrollTop;
      prevTime  = now;

      // Reset fired flag when scroll is mid-list (not at boundary)
      var atTop    = el.scrollTop <= 0;
      var atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 1;
      if (!atTop && !atBottom) { fired = false; return; }

      // Only fire during momentum (no active touch) and with real velocity
      if (!isPulling && !fired && Math.abs(velocity) > 0.3) {
        fired = true;
        post({ type: 'rb_momentum', velocity: velocity, atTop: atTop, atBottom: atBottom });
      }
    }, { passive: true });
  }

  function scanScrollables(root) {
    try {
      var all = (root || document).querySelectorAll('*');
      for (var i = 0; i < all.length; i++) attachScrollVelocity(all[i]);
    } catch(e) {}
  }

  scanScrollables(document);

  // Pick up dynamically added scroll containers (SPA route changes, etc.)
  new MutationObserver(function(mutations) {
    mutations.forEach(function(m) {
      m.addedNodes.forEach(function(n) {
        if (n.nodeType === 1) { attachScrollVelocity(n); scanScrollables(n); }
      });
    });
  }).observe(document.body, { childList: true, subtree: true });

  true;
})();
`;

function buildOrientationScript(isLandscape: boolean): string {
  const vpWidth = isLandscape ? 1340 : 430;
  return `
(function() {
  var meta = document.querySelector('meta[name="viewport"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = 'viewport';
    document.head.appendChild(meta);
  }
  meta.content = 'width=${vpWidth}, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover';
  requestAnimationFrame(function() {
    setTimeout(function() {
      window.dispatchEvent(new Event('orientationchange'));
      window.dispatchEvent(new Event('resize'));
    }, 32);
  });
})();
true;
`;
}

// ── Max rubber-band displacement (px) and damping curve ───────────────────
// Uses a logarithmic resistance so the first few pixels feel springy and
// large drags level off — identical feel to iOS native rubber band.
const MAX_RB_PX = 80;
function rubberBandDelta(raw: number): number {
  const sign = raw > 0 ? 1 : -1;
  const abs  = Math.abs(raw);
  // log curve: responsive near 0, levels off toward MAX_RB_PX
  return sign * Math.min(MAX_RB_PX * (1 - Math.exp(-abs / 80)), MAX_RB_PX);
}

function LoadingView() {
  return (
    <View style={styles.loading}>
      <ActivityIndicator size="large" color="#22c55e" />
    </View>
  );
}

function MissingDomainScreen() {
  return (
    <View style={styles.loading}>
      <Text style={{ color: "#ef4444", fontSize: 14, fontWeight: "bold", marginBottom: 8 }}>
        Configuration error
      </Text>
      <Text style={{ color: "#9ca3af", fontSize: 12, textAlign: "center", paddingHorizontal: 32 }}>
        EXPO_PUBLIC_DOMAIN is not set.{"\n"}
        Restart the Expo workflow so the Replit dev domain is baked into the bundle.
      </Text>
    </View>
  );
}

export default function TabletScreen() {
  const { width, height } = useWindowDimensions();
  const isLandscape = width >= height;
  const webViewRef   = useRef<WebView>(null);
  const prevLandscape = useRef<boolean | null>(null);
  const insets = useSafeAreaInsets();

  // Rubber-band animation state
  const translateY  = useRef(new Animated.Value(0)).current;
  const springAnim  = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (prevLandscape.current === isLandscape) return;
    prevLandscape.current = isLandscape;
    webViewRef.current?.injectJavaScript(buildOrientationScript(isLandscape));
  }, [isLandscape]);

  // Cancel any running spring and snap immediately (used when a new gesture starts)
  const cancelSpring = useCallback(() => {
    springAnim.current?.stop();
    springAnim.current = null;
  }, []);

  // Spring the container back to rest
  const springBack = useCallback(() => {
    cancelSpring();
    springAnim.current = Animated.spring(translateY, {
      toValue:         0,
      useNativeDriver: true,
      tension:         140,
      friction:        14,
    });
    springAnim.current.start(() => { springAnim.current = null; });
  }, [cancelSpring, translateY]);

  const handleMessage = useCallback((event: WebViewMessageEvent) => {
    let msg: { type: string; delta?: number; velocity?: number; atTop?: boolean; atBottom?: boolean };
    try { msg = JSON.parse(event.nativeEvent.data); } catch { return; }

    switch (msg.type) {
      // ── Touch drag at boundary ──────────────────────────────────────────
      case 'rb_pull': {
        cancelSpring();
        // Apply rubber-band resistance curve directly (no animation, instant)
        const offset = rubberBandDelta(msg.delta ?? 0);
        translateY.setValue(offset);
        break;
      }
      case 'rb_release': {
        springBack();
        break;
      }

      // ── Momentum scroll hits boundary ───────────────────────────────────
      case 'rb_momentum': {
        cancelSpring();
        const v         = msg.velocity ?? 0;
        const direction = (msg.atTop) ? 1 : -1;
        // Clamp bounce distance proportional to velocity (px per ms → px swing)
        const swing = Math.min(Math.abs(v) * 18, MAX_RB_PX);

        springAnim.current = Animated.sequence([
          // Bounce out: fast ease-out proportional to velocity
          Animated.timing(translateY, {
            toValue:         direction * swing,
            duration:        Math.min(swing * 1.8, 130),
            useNativeDriver: true,
            easing:          Easing.out(Easing.quad),
          }),
          // Spring back to rest
          Animated.spring(translateY, {
            toValue:         0,
            useNativeDriver: true,
            tension:         140,
            friction:        14,
          }),
        ]);
        springAnim.current.start(() => { springAnim.current = null; });
        break;
      }
    }
  }, [cancelSpring, springBack, translateY]);

  // Show an explicit error instead of a broken WebView when the domain is missing.
  if (!WEB_URL) return <MissingDomainScreen />;

  if (Platform.OS === "web") {
    return (
      <View style={styles.container}>
        <iframe
          src={WEB_URL}
          style={iframeStyle}
          title="Trading Journal"
          allow="clipboard-read; clipboard-write"
        />
      </View>
    );
  }

  // Edge-to-edge on Android (Expo SDK 54+) is mandatory and cannot be opted
  // out of — the app always draws behind the status bar and navigation bar.
  // Fighting that with a translucent={false} StatusBar or a SafeAreaView
  // that consumes ALL edges around the WebView is what caused the status
  // bar to intermittently vanish and a stray bottom gap to appear: the
  // native side was reserving inset space *and* the web page's own CSS
  // (env(safe-area-inset-*)) was racing it, so depending on which insets
  // arrived first the two would over- or under-compensate.
  //
  // Correct approach: let the WebView itself be truly edge-to-edge (no
  // SafeAreaView wrapping it) so `viewport-fit=cover` + `env()` inside the
  // web app can size its own header/bottom-nav against the real device
  // insets. The only inset consumed natively here is `insets.top`, applied
  // as a simple spacer above the WebView so the page's sticky header never
  // renders underneath the status bar. No inset is subtracted from the
  // screen height anywhere — the WebView is `flex: 1` and fills whatever
  // space remains.
  //
  // Rubber band: we keep bounces={false} / overScrollMode="never" so the
  // native WebView scroll-view never double-bounces alongside our Animated
  // translateY.  All rubber-band logic lives in RUBBER_BAND_JS + handleMessage.
  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <View style={{ height: insets.top, backgroundColor: "#0d1117" }} />
      <Animated.View style={[styles.webview, { transform: [{ translateY }] }]}>
        <WebView
          ref={webViewRef}
          source={{ uri: WEB_URL }}
          style={styles.webview}
          userAgent={TABLET_UA}
          injectedJavaScript={buildOrientationScript(isLandscape) + "\n" + RUBBER_BAND_JS}
          injectedJavaScriptForMainFrameOnly
          javaScriptEnabled
          domStorageEnabled
          allowFileAccess
          allowUniversalAccessFromFileURLs
          mixedContentMode="always"
          scalesPageToFit={false}
          bounces={false}
          overScrollMode="never"
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
          startInLoadingState
          renderLoading={() => <LoadingView />}
          onMessage={handleMessage}
          onError={(e) =>
            console.warn("[WebView] error", e.nativeEvent.description)
          }
          onHttpError={(e) =>
            console.warn("[WebView] HTTP", e.nativeEvent.statusCode, WEB_URL)
          }
          onContentProcessDidTerminate={() => {
            webViewRef.current?.reload();
          }}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0d1117",
  },
  webview: {
    flex: 1,
    backgroundColor: "#0d1117",
  },
  loading: {
    flex: 1,
    backgroundColor: "#0d1117",
    alignItems: "center",
    justifyContent: "center",
  },
});

const iframeStyle: React.CSSProperties = {
  width: "100%",
  height: "100%",
  border: "none",
  backgroundColor: "#0d1117",
};
