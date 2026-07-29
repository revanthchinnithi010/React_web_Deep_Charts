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
  EASE,
  DUR_STANDARD,
} from "@/animations/motion";

// ── Animation durations (ms) ─────────────────────────────────────────────────
const DUR_OPEN  = 320;
const DUR_CLOSE = 240;

// ── Inject keyframes once ────────────────────────────────────────────────────
const KEYFRAMES = `
@keyframes sat-pulse-dot {
  0%, 100% { opacity: 1; transform: scale(1); }
  50%       { opacity: 0.45; transform: scale(0.65); }
}
@keyframes sat-ripple {
  0%   { transform: scale(0); opacity: 0.32; }
  100% { transform: scale(3); opacity: 0; }
}
@keyframes sat-price-flash {
  0%   { opacity: 1; }
  25%  { opacity: 0.5; }
  100% { opacity: 1; }
}
`;
if (typeof document !== "undefined") {
  const ID = "__sat_kf__";
  if (!document.getElementById(ID)) {
    const s = document.createElement("style");
    s.id = ID;
    s.textContent = KEYFRAMES;
    document.head.appendChild(s);
  }
}

// ── Price formatter ──────────────────────────────────────────────────────────
function formatPrice(price: number): string {
  if (!isFinite(price) || price <= 0) return "—";
  if (price >= 10_000) return price.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  if (price >= 100)    return price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (price >= 1)      return price.toFixed(4);
  if (price >= 0.001)  return price.toFixed(6);
  return price.toFixed(8);
}

function getInstrumentType(symbol: string): string {
  const s = symbol.toUpperCase();
  if (s.includes("PERP")) return "PERP";
  if (s.includes("SPOT")) return "SPOT";
  return "PERP";
}

function getCoinInitials(symbol: string): string {
  return symbol.replace(/(USDT?|PERP|SPOT)$/i, "").trim().slice(0, 2).toUpperCase();
}

// ── Premium Live Symbol Card ─────────────────────────────────────────────────
const PremiumSymbolCard = memo(function PremiumSymbolCard({ symbol }: { symbol: string }) {
  const tick   = useSymbolTick(symbol);
  const price  = tick?.price ?? 0;
  const change = tick?.changePct ?? 0;
  const isUp   = change >= 0;
  const green  = "#22c55e";

  // Flash the price span on each tick update
  const priceRef    = useRef<HTMLSpanElement>(null);
  const prevPriceRef = useRef(price);
  useEffect(() => {
    if (price !== prevPriceRef.current && priceRef.current) {
      priceRef.current.style.animation = "none";
      void priceRef.current.offsetHeight;
      priceRef.current.style.animation = "sat-price-flash 0.3s ease";
    }
    prevPriceRef.current = price;
  }, [price]);

  return (
    <div
      style={{
        margin: "20px 16px 0",
        minHeight: 96,
        padding: "16px 20px",
        borderRadius: 22,
        background: "linear-gradient(135deg, rgba(255,255,255,0.055) 0%, rgba(255,255,255,0.025) 100%)",
        border: "1px solid rgba(255,255,255,0.10)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        boxShadow: "0 8px 40px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.07)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        flexShrink: 0,
      }}
    >
      {/* LEFT */}
      <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
        {/* Circular coin logo */}
        <div
          style={{
            width: 50, height: 50, borderRadius: "50%", flexShrink: 0,
            background: "linear-gradient(145deg, rgba(183,255,90,0.18) 0%, rgba(34,197,94,0.10) 100%)",
            border: "1.5px solid rgba(183,255,90,0.28)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 0 16px rgba(183,255,90,0.12), 0 4px 12px rgba(0,0,0,0.3)",
          }}
        >
          <span
            style={{
              fontSize: 16, fontWeight: 900, color: "#B7FF5A",
              letterSpacing: "-0.03em", fontFamily: "monospace", lineHeight: 1,
            }}
          >
            {getCoinInitials(symbol)}
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          {/* Symbol + PERP badge */}
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <span
              style={{
                fontSize: 17, fontWeight: 800, color: "#fff",
                letterSpacing: "0.01em", lineHeight: 1,
                fontFamily: "'SF Pro Display','Inter',system-ui,monospace",
              }}
            >
              {symbol}
            </span>
            <div
              style={{
                padding: "2px 6px", borderRadius: 5,
                background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.12)",
                fontSize: 9, fontWeight: 700,
                color: "rgba(255,255,255,0.55)", letterSpacing: "0.07em", lineHeight: 1,
              }}
            >
              {getInstrumentType(symbol)}
            </div>
          </div>

          {/* DELTA badge */}
          <div
            style={{
              display: "inline-flex", alignItems: "center", gap: 4,
              padding: "3px 8px", borderRadius: 6, width: "fit-content",
              background: "rgba(96,165,250,0.10)",
              border: "1px solid rgba(96,165,250,0.20)",
            }}
          >
            <svg width="9" height="9" viewBox="0 0 10 10" fill="none">
              <path d="M5 0L9.5 5L5 10L0.5 5L5 0Z" fill="#60a5fa" opacity="0.9"/>
            </svg>
            <span style={{ fontSize: 9, fontWeight: 700, color: "#60a5fa", letterSpacing: "0.08em", lineHeight: 1 }}>
              DELTA
            </span>
          </div>
        </div>
      </div>

      {/* RIGHT */}
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <span
          ref={priceRef}
          style={{
            display: "block",
            fontSize: 28, fontWeight: 800, color: "#fff",
            fontFamily: "'SF Pro Display','Inter',monospace",
            letterSpacing: "-0.02em", lineHeight: 1,
          }}
        >
          {price > 0 ? formatPrice(price) : "—"}
        </span>

        <div style={{ marginTop: 4, display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 6 }}>
          <span
            style={{
              fontSize: 14, fontWeight: 700,
              color: isUp ? green : "#f87171",
              letterSpacing: "-0.01em",
            }}
          >
            {tick ? `${isUp ? "+" : ""}${change.toFixed(2)}%` : "—"}
          </span>
        </div>

        {/* Pulsing dot + LIVE badge */}
        <div style={{ marginTop: 7, display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 5 }}>
          <div
            style={{
              width: 6, height: 6, borderRadius: "50%",
              background: green, boxShadow: `0 0 6px ${green}`,
              animation: "sat-pulse-dot 1.6s ease-in-out infinite", flexShrink: 0,
            }}
          />
          <div
            style={{
              padding: "2px 7px", borderRadius: 5,
              background: "rgba(34,197,94,0.12)",
              border: "1px solid rgba(34,197,94,0.22)",
              fontSize: 9, fontWeight: 700, color: green,
              letterSpacing: "0.08em", lineHeight: 1,
            }}
          >
            LIVE
          </div>
        </div>
      </div>
    </div>
  );
});

// ── Ripple ───────────────────────────────────────────────────────────────────
interface RippleState { id: number; x: number; y: number; }

function useRipple() {
  const [ripples, setRipples] = useState<RippleState[]>([]);
  const counter = useRef(0);

  const trigger = useCallback((e: React.PointerEvent<HTMLElement>) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const id   = ++counter.current;
    setRipples(prev => [...prev, { id, x: e.clientX - rect.left, y: e.clientY - rect.top }]);
    setTimeout(() => setRipples(prev => prev.filter(r => r.id !== id)), 600);
  }, []);

  return { ripples, trigger };
}

// ── Alert type card ──────────────────────────────────────────────────────────
interface AlertTypeCardProps {
  icon: React.ReactNode;
  iconBg: string;
  iconBorder: string;
  iconGlow: string;
  accentColor: string;
  title: string;
  description: string;
  index: number;
  onPress: () => void;
}

function AlertTypeCard({ icon, iconBg, iconBorder, iconGlow, accentColor, title, description, index, onPress }: AlertTypeCardProps) {
  const [pressed, setPressed] = useState(false);
  const { ripples, trigger }  = useRipple();

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "tween", duration: DUR_STANDARD, ease: EASE, delay: index * 0.06 }}
      style={{ width: "100%" }}
    >
      <motion.button
        whileTap={{ scale: 0.97 }}
        transition={TAP_TRANSITION}
        onPointerDown={(e) => { setPressed(true); trigger(e); }}
        onPointerUp={() => setPressed(false)}
        onPointerLeave={() => setPressed(false)}
        onClick={onPress}
        style={{
          position: "relative",
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          gap: 16,
          width: "100%",
          height: 90,
          padding: "0 18px",
          borderRadius: 22,
          border: `1px solid ${pressed ? accentColor + "35" : "rgba(255,255,255,0.08)"}`,
          background: pressed
            ? "linear-gradient(135deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.03) 100%)"
            : "linear-gradient(135deg, rgba(255,255,255,0.045) 0%, rgba(255,255,255,0.02) 100%)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          boxShadow: pressed
            ? `0 0 0 1px ${accentColor}20, 0 0 24px ${accentColor}18, 0 12px 40px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.07)`
            : "0 4px 24px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)",
          cursor: "pointer",
          textAlign: "left",
          transition: "background 0.15s ease, border-color 0.15s ease, box-shadow 0.18s ease",
          WebkitTapHighlightColor: "transparent",
          willChange: "transform",
          flexShrink: 0,
        } as React.CSSProperties}
      >
        {/* Ripple */}
        {ripples.map(r => (
          <span
            key={r.id}
            style={{
              position: "absolute",
              left: r.x, top: r.y,
              width: 120, height: 120,
              marginLeft: -60, marginTop: -60,
              borderRadius: "50%",
              background: `${accentColor}22`,
              animation: "sat-ripple 0.55s cubic-bezier(0.22,1,0.36,1) forwards",
              pointerEvents: "none",
            }}
          />
        ))}

        {/* 60×60 icon container */}
        <div
          style={{
            width: 60, height: 60, borderRadius: 16, flexShrink: 0,
            background: iconBg,
            border: `1px solid ${iconBorder}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: `0 0 20px ${iconGlow}, 0 4px 16px rgba(0,0,0,0.25)`,
          }}
        >
          {icon}
        </div>

        {/* Text */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 20, fontWeight: 600, color: "#fff",
              lineHeight: 1, marginBottom: 7,
              letterSpacing: "-0.01em",
              fontFamily: "'SF Pro Display','Inter',system-ui,sans-serif",
            }}
          >
            {title}
          </div>
          <div
            style={{
              fontSize: 14, fontWeight: 500,
              color: "rgba(148,163,184,0.65)",
              lineHeight: 1.45,
            }}
          >
            {description}
          </div>
        </div>

        {/* Chevron */}
        <div
          style={{
            flexShrink: 0, width: 28, height: 28,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: "50%",
            color: "rgba(255,255,255,0.30)",
          }}
        >
          <svg width="7" height="12" viewBox="0 0 7 12" fill="none">
            <path d="M1 1l5 5-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      </motion.button>
    </motion.div>
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

  const hasOpenedRef = useRef(false);
  if (open) hasOpenedRef.current = true;

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

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onCloseRef.current(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open]);

  type ModalKind = "price" | "zone" | "trendline" | null;
  const [activeModal, setActiveModal] = useState<ModalKind>(null);

  const handlePriceAlertSave = useCallback((a: PriceAlert) => {
    addAlert(a); setActiveModal(null); onCloseRef.current();
  }, [addAlert]);

  const handleZoneAlertSave = useCallback((a: ZoneAlert) => {
    addAlert(a); setActiveModal(null); onCloseRef.current();
  }, [addAlert]);

  const handleTrendlineAlertSave = useCallback((a: TrendlineAlert) => {
    addAlert(a); setActiveModal(null); onCloseRef.current();
  }, [addAlert]);

  if (!hasOpenedRef.current) return null;

  return createPortal(
    <>
      {/* ── Full-screen slide-in panel ── */}
      <div
        aria-hidden={!open}
        className="transform-gpu"
        style={{
          position: "fixed", inset: 0, zIndex: 95,
          display: "flex", flexDirection: "column",
          background: "#08090c",
          transform: visible ? "translateX(0)" : "translateX(100%)",
          transition: `transform ${visible ? DUR_OPEN : DUR_CLOSE}ms ${visible ? COMPOSITOR_EASE : COMPOSITOR_EASE_CLOSE}`,
          willChange: "transform",
          overflow: "hidden",
          pointerEvents: open ? "auto" : "none",
        }}
      >
        {/* ── Header: safe-area spacer + 60px content row ── */}
        <div
          style={{
            flexShrink: 0,
            background: "rgba(8,9,12,0.95)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            borderBottom: "1px solid rgba(255,255,255,0.07)",
            /* Push content below the notch — no extra height, no centering math */
            paddingTop: "env(safe-area-inset-top)",
          }}
        >
          {/* Exactly 60px for back button + title */}
          <div
            style={{
              height: 60,
              display: "flex",
              alignItems: "center",
              gap: 14,
              paddingLeft: 16,
              paddingRight: 20,
            }}
          >
            <button
              onClick={onClose}
              style={{
                width: 44, height: 44, borderRadius: "50%",
                display: "flex", alignItems: "center", justifyContent: "center",
                background: "rgba(255,255,255,0.07)",
                border: "1px solid rgba(255,255,255,0.10)",
                cursor: "pointer",
                color: "rgba(255,255,255,0.80)",
                flexShrink: 0,
                WebkitTapHighlightColor: "transparent",
                transition: "background 0.12s",
              } as React.CSSProperties}
              onPointerDown={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.13)"; }}
              onPointerUp={(e)   => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.07)"; }}
              onPointerLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.07)"; }}
            >
              <ArrowLeft style={{ width: 19, height: 19 }} />
            </button>

            <h1
              style={{
                fontSize: 19, fontWeight: 700, color: "#fff",
                margin: 0, flex: 1,
                letterSpacing: "-0.02em",
                fontFamily: "'SF Pro Display','Inter',system-ui,sans-serif",
              }}
            >
              Select Alert Type
            </h1>
          </div>
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
          <PremiumSymbolCard symbol={symbol} />

          {/* Section label */}
          <div
            style={{
              padding: "28px 18px 16px",
              fontSize: 11, fontWeight: 700,
              color: "rgba(148,163,184,0.40)",
              textTransform: "uppercase",
              letterSpacing: "0.12em",
              fontFamily: "'SF Pro Text','Inter',system-ui,sans-serif",
            }}
          >
            Choose alert type
          </div>

          {/* Cards */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: "0 16px" }}>
            <AlertTypeCard
              index={0}
              icon={<GitBranch style={{ width: 28, height: 28, color: "#B7FF5A" }} />}
              iconBg="linear-gradient(145deg, rgba(183,255,90,0.16) 0%, rgba(183,255,90,0.08) 100%)"
              iconBorder="rgba(183,255,90,0.22)"
              iconGlow="rgba(183,255,90,0.18)"
              accentColor="#B7FF5A"
              title="Trendline Alerts"
              description="Trigger when price touches or crosses a trendline."
              onPress={() => setActiveModal("trendline")}
            />
            <AlertTypeCard
              index={1}
              icon={<Layers style={{ width: 28, height: 28, color: "#fb923c" }} />}
              iconBg="linear-gradient(145deg, rgba(251,146,60,0.16) 0%, rgba(251,146,60,0.08) 100%)"
              iconBorder="rgba(251,146,60,0.22)"
              iconGlow="rgba(251,146,60,0.18)"
              accentColor="#fb923c"
              title="Zone Alerts"
              description="Trigger when price enters or exits a defined zone."
              onPress={() => setActiveModal("zone")}
            />
            <AlertTypeCard
              index={2}
              icon={<Target style={{ width: 28, height: 28, color: "#60a5fa" }} />}
              iconBg="linear-gradient(145deg, rgba(96,165,250,0.16) 0%, rgba(96,165,250,0.08) 100%)"
              iconBorder="rgba(96,165,250,0.22)"
              iconGlow="rgba(96,165,250,0.18)"
              accentColor="#60a5fa"
              title="Price Alerts"
              description="Trigger when price reaches a specific price level."
              onPress={() => setActiveModal("price")}
            />
          </div>
        </div>
      </div>

      {/* ── Creation modals ── */}
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
