/**
 * SelectAlertTypeOverlay
 *
 * Full-screen overlay that appears when the user taps a coin from the
 * Watchlist inside the Dashboard → Alerts → Markets flow.
 *
 * Navigation:
 *   DashboardMarketsOverlay → (watchlist tap) → SelectAlertTypeOverlay
 *                             → (card tap)    → existing creation modal
 *
 * Animation: CSS compositor-thread push from right (translateX) so it feels
 * like a native navigation push and is immune to JS-thread pressure from
 * live tick updates.
 */

import { memo, useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion } from "motion/react";
import { ArrowLeft, GitBranch, Layers, Target } from "lucide-react";
import { useSymbolTick } from "@/store/tickStore";
import { useAlertStore } from "@/store/alertStore";
import {
  CreatePriceAlertModal,
  CreateZoneAlertModal,
  CreateTrendlineAlertModal,
} from "@/pages/alerts";
import type { PriceAlert, ZoneAlert, TrendlineAlert } from "@/data/alertsData";
import {
  COMPOSITOR_EASE,
  COMPOSITOR_EASE_CLOSE,
  TAP_TRANSITION,
} from "@/animations/motion";

// ── Animation durations (ms) ─────────────────────────────────────────────────
const DUR_OPEN  = 320;
const DUR_CLOSE = 240;

// ── Price formatter ──────────────────────────────────────────────────────────
function formatPrice(price: number): string {
  if (!isFinite(price) || price <= 0) return "—";
  if (price >= 10_000) return price.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  if (price >= 100)    return price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (price >= 1)      return price.toFixed(4);
  if (price >= 0.001)  return price.toFixed(6);
  return price.toFixed(8);
}

// ── Coin info strip at the top of the page ───────────────────────────────────
const CoinInfoStrip = memo(function CoinInfoStrip({ symbol }: { symbol: string }) {
  const tick = useSymbolTick(symbol);
  const price = tick?.price ?? 0;
  const change = tick?.changePct ?? 0;
  const isUp = change >= 0;

  return (
    <div
      style={{
        margin: "20px 16px 0",
        padding: "16px 18px",
        borderRadius: 18,
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.08)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      {/* Left: symbol + badge */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {/* Icon circle */}
        <div
          style={{
            width: 42, height: 42, borderRadius: "50%",
            background: "rgba(183,255,90,0.10)",
            border: "1px solid rgba(183,255,90,0.18)",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <span
            style={{
              fontSize: 13, fontWeight: 800,
              color: "#B7FF5A",
              letterSpacing: "-0.02em",
              fontFamily: "monospace",
            }}
          >
            {symbol.slice(0, 2)}
          </span>
        </div>

        <div>
          <div
            style={{
              fontSize: 16, fontWeight: 800, color: "#ffffff",
              letterSpacing: "0.02em", fontFamily: "monospace", lineHeight: 1,
            }}
          >
            {symbol}
          </div>
          {/* Exchange badge */}
          <div
            style={{
              marginTop: 5, display: "inline-flex", alignItems: "center", gap: 4,
              padding: "2px 7px", borderRadius: 5,
              background: "rgba(96,165,250,0.12)", border: "1px solid rgba(96,165,250,0.22)",
              fontSize: 9.5, fontWeight: 700, color: "#60a5fa",
              letterSpacing: "0.06em",
            }}
          >
            DELTA
          </div>
        </div>
      </div>

      {/* Right: price + change */}
      <div style={{ textAlign: "right" }}>
        <div
          style={{
            fontSize: 20, fontWeight: 800, color: "#ffffff",
            fontFamily: "monospace", lineHeight: 1, letterSpacing: "-0.01em",
          }}
        >
          {price > 0 ? formatPrice(price) : "—"}
        </div>
        {tick && (
          <div
            style={{
              marginTop: 4, fontSize: 12, fontWeight: 600,
              color: isUp ? "#34d399" : "#f87171",
            }}
          >
            {isUp ? "+" : ""}{change.toFixed(2)}%
          </div>
        )}
      </div>
    </div>
  );
});

// ── Alert type card ──────────────────────────────────────────────────────────
interface AlertTypeCardProps {
  icon: React.ReactNode;
  iconBg: string;
  iconBorder: string;
  accentColor: string;
  title: string;
  subtitle: string;
  index: number;
  onPress: () => void;
}

function AlertTypeCard({
  icon, iconBg, iconBorder, accentColor, title, subtitle, index, onPress,
}: AlertTypeCardProps) {
  const [pressed, setPressed] = useState(false);

  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      transition={TAP_TRANSITION}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      onClick={onPress}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 16,
        width: "100%",
        padding: "20px 20px",
        borderRadius: 20,
        border: `1px solid ${pressed ? accentColor + "40" : "rgba(255,255,255,0.07)"}`,
        background: pressed
          ? `rgba(255,255,255,0.06)`
          : "rgba(255,255,255,0.03)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        boxShadow: pressed
          ? `0 0 0 1px ${accentColor}22, 0 8px 32px rgba(0,0,0,0.4)`
          : "0 4px 24px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)",
        cursor: "pointer",
        textAlign: "left",
        transition: "background 0.15s, border-color 0.15s, box-shadow 0.15s",
        WebkitTapHighlightColor: "transparent",
        animationDelay: `${index * 60}ms`,
        willChange: "transform",
      } as React.CSSProperties}
    >
      {/* Icon */}
      <div
        style={{
          width: 52, height: 52, borderRadius: 14, flexShrink: 0,
          background: iconBg,
          border: `1px solid ${iconBorder}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: `0 4px 16px ${iconBg}`,
        }}
      >
        {icon}
      </div>

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 16, fontWeight: 700, color: "#ffffff",
            lineHeight: 1, marginBottom: 7,
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontSize: 12.5, fontWeight: 400,
            color: "rgba(148,163,184,0.7)",
            lineHeight: 1.5,
          }}
        >
          {subtitle}
        </div>
      </div>

      {/* Chevron */}
      <div
        style={{
          flexShrink: 0, width: 24, height: 24,
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "rgba(255,255,255,0.25)",
        }}
      >
        <svg width="8" height="13" viewBox="0 0 8 13" fill="none">
          <path d="M1 1l6 5.5L1 12" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
    </motion.button>
  );
}

// ── Main overlay ─────────────────────────────────────────────────────────────
export interface SelectAlertTypeOverlayProps {
  open: boolean;
  symbol: string;
  onClose: () => void;
}

export const SelectAlertTypeOverlay = memo(function SelectAlertTypeOverlay({
  open, symbol, onClose,
}: SelectAlertTypeOverlayProps) {
  const { addAlert } = useAlertStore();

  // Track whether this has ever been opened so we skip the initial null render
  const hasOpenedRef = useRef(false);
  if (open) hasOpenedRef.current = true;

  // CSS transition state: delayed one rAF after `open` flips so the browser
  // can paint the off-screen position (translateX 100%) before the enter starts
  const [visible, setVisible] = useState(false);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  useEffect(() => {
    if (open) {
      let rafId: number;
      const t = setTimeout(() => { rafId = requestAnimationFrame(() => setVisible(true)); }, 0);
      return () => { clearTimeout(t); cancelAnimationFrame(rafId); };
    }
    setVisible(false);
    return undefined;
  }, [open]);

  // Body scroll-lock while open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  // ESC key closes the overlay
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onCloseRef.current(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open]);

  // Which creation modal is open
  type ModalKind = "price" | "zone" | "trendline" | null;
  const [activeModal, setActiveModal] = useState<ModalKind>(null);

  const handlePriceAlertSave = useCallback((a: PriceAlert) => {
    addAlert(a);
    setActiveModal(null);
    onCloseRef.current();
  }, [addAlert]);

  const handleZoneAlertSave = useCallback((a: ZoneAlert) => {
    addAlert(a);
    setActiveModal(null);
    onCloseRef.current();
  }, [addAlert]);

  const handleTrendlineAlertSave = useCallback((a: TrendlineAlert) => {
    addAlert(a);
    setActiveModal(null);
    onCloseRef.current();
  }, [addAlert]);

  if (!hasOpenedRef.current) return null;

  return createPortal(
    <>
      {/* ── Full-screen push panel — slides in from the right ── */}
      <div
        aria-hidden={!open}
        className="transform-gpu"
        style={{
          position: "fixed", inset: 0, zIndex: 95,
          display: "flex", flexDirection: "column",
          background: "#000000",
          transform: visible ? "translateX(0)" : "translateX(100%)",
          transition: `transform ${visible ? DUR_OPEN : DUR_CLOSE}ms ${visible ? COMPOSITOR_EASE : COMPOSITOR_EASE_CLOSE}`,
          willChange: "transform",
          overflow: "hidden",
          pointerEvents: open ? "auto" : "none",
        }}
      >
        {/* ── Header ── */}
        <div
          style={{
            display: "flex", alignItems: "center", gap: 12,
            padding: "0 16px",
            paddingTop: "env(safe-area-inset-top)",
            height: "calc(56px + env(safe-area-inset-top))",
            borderBottom: "1px solid rgba(255,255,255,0.07)",
            background: "#000000",
            flexShrink: 0,
          }}
        >
          <button
            onClick={onClose}
            style={{
              width: 36, height: 36, borderRadius: "50%",
              display: "flex", alignItems: "center", justifyContent: "center",
              background: "rgba(255,255,255,0.07)",
              border: "1px solid rgba(255,255,255,0.08)",
              cursor: "pointer",
              color: "rgba(255,255,255,0.7)",
              flexShrink: 0,
              WebkitTapHighlightColor: "transparent",
            } as React.CSSProperties}
          >
            <ArrowLeft style={{ width: 18, height: 18 }} />
          </button>
          <h1
            style={{
              fontSize: 17, fontWeight: 700, color: "#ffffff",
              margin: 0, flex: 1,
            }}
          >
            Select Alert Type
          </h1>
        </div>

        {/* ── Scrollable content ── */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            WebkitOverflowScrolling: "touch",
            overscrollBehavior: "contain",
            paddingBottom: "calc(env(safe-area-inset-bottom) + 32px)",
          } as React.CSSProperties}
        >
          {/* Coin info strip */}
          <CoinInfoStrip symbol={symbol} />

          {/* Section label */}
          <div
            style={{
              padding: "24px 16px 12px",
              fontSize: 11, fontWeight: 700,
              color: "rgba(148,163,184,0.45)",
              textTransform: "uppercase",
              letterSpacing: "0.1em",
            }}
          >
            Choose alert type
          </div>

          {/* Alert type cards */}
          <div
            style={{
              display: "flex", flexDirection: "column", gap: 12,
              padding: "0 16px",
            }}
          >
            <AlertTypeCard
              index={0}
              icon={<GitBranch style={{ width: 24, height: 24, color: "#B7FF5A" }} />}
              iconBg="rgba(183,255,90,0.12)"
              iconBorder="rgba(183,255,90,0.22)"
              accentColor="#B7FF5A"
              title="Trendline Alerts"
              subtitle="Trigger when price touches or crosses a trendline."
              onPress={() => setActiveModal("trendline")}
            />

            <AlertTypeCard
              index={1}
              icon={<Layers style={{ width: 24, height: 24, color: "#fb923c" }} />}
              iconBg="rgba(251,146,60,0.12)"
              iconBorder="rgba(251,146,60,0.22)"
              accentColor="#fb923c"
              title="Zone Alerts"
              subtitle="Trigger when price enters, exits or touches a price zone."
              onPress={() => setActiveModal("zone")}
            />

            <AlertTypeCard
              index={2}
              icon={<Target style={{ width: 24, height: 24, color: "#60a5fa" }} />}
              iconBg="rgba(96,165,250,0.12)"
              iconBorder="rgba(96,165,250,0.22)"
              accentColor="#60a5fa"
              title="Price Alerts"
              subtitle="Trigger when price reaches a specific level."
              onPress={() => setActiveModal("price")}
            />
          </div>
        </div>
      </div>

      {/* ── Creation modals (portal on top, same z-index stacking) ── */}
      {activeModal === "trendline" && (
        <CreateTrendlineAlertModal
          initialSymbol={symbol}
          onClose={() => setActiveModal(null)}
          onSave={handleTrendlineAlertSave}
        />
      )}
      {activeModal === "zone" && (
        <CreateZoneAlertModal
          initialSymbol={symbol}
          onClose={() => setActiveModal(null)}
          onSave={handleZoneAlertSave}
        />
      )}
      {activeModal === "price" && (
        <CreatePriceAlertModal
          initialSymbol={symbol}
          onClose={() => setActiveModal(null)}
          onSave={handlePriceAlertSave}
        />
      )}
    </>,
    document.body,
  );
});
