import { memo, useState, useCallback, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "motion/react";
import {
  ArrowLeft, ChevronRight, Target, Layers, GitBranch,
  Plus, Trash2, Pause, Play, Bell, TrendingUp, TrendingDown, Minus, Zap, Activity,
} from "lucide-react";
import { useBrokerWatchlistStore, deriveMeta } from "@/store/brokerWatchlistStore";
import { useAlertStore } from "@/store/alertStore";
import { useTickStore } from "@/store/tickStore";
import { tweenStandard, TAP_TRANSITION } from "@/animations/motion";
import type { AnyAlert, AlertStatus, AlertType } from "@/data/alertsData";

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatPrice(price: number): string {
  if (!price || price === 0) return "—";
  if (price < 0.01) return price.toFixed(6);
  if (price < 1)    return price.toFixed(4);
  if (price < 100)  return price.toFixed(3);
  if (price < 1000) return price.toFixed(2);
  return price.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function AlertTypeBadge({ type }: { type: AlertType }) {
  const cfg = {
    price:     { label: "Price",     Icon: Target,    cls: "bg-blue-500/15 text-blue-400" },
    zone:      { label: "Zone",      Icon: Layers,    cls: "bg-orange-500/15 text-orange-400" },
    trendline: { label: "Trendline", Icon: GitBranch, cls: "bg-emerald-500/15 text-emerald-400" },
  }[type];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold ${cfg.cls}`}>
      <cfg.Icon className="w-2.5 h-2.5" />
      {cfg.label}
    </span>
  );
}

function StatusDot({ status }: { status: AlertStatus }) {
  const colors: Record<AlertStatus, string> = {
    active:    "bg-blue-400",
    triggered: "bg-emerald-400",
    paused:    "bg-yellow-400",
    expired:   "bg-white/30",
  };
  return (
    <span className={`inline-block w-1.5 h-1.5 rounded-full flex-shrink-0 ${colors[status]}`} />
  );
}

function ConditionLabel({ alert }: { alert: AnyAlert }) {
  if (alert.type === "price") {
    const icons = {
      above: <TrendingUp className="w-3 h-3 text-emerald-400" />,
      below: <TrendingDown className="w-3 h-3 text-red-400" />,
      touch: <Minus className="w-3 h-3 text-white/40" />,
    };
    return (
      <span className="flex items-center gap-1 text-[11px] text-white/50">
        {icons[alert.condition as keyof typeof icons]}
        {alert.condition} {formatPrice(alert.targetPrice)}
      </span>
    );
  }
  if (alert.type === "zone") {
    return (
      <span className="text-[11px] text-white/50 capitalize">
        {alert.zoneType} zone · {alert.condition}
      </span>
    );
  }
  if (alert.type === "trendline") {
    return (
      <span className="flex items-center gap-1 text-[11px] text-white/50">
        <Zap className="w-3 h-3 text-yellow-400" />
        {alert.condition} trendline
      </span>
    );
  }
  return null;
}

// ── Symbol row ────────────────────────────────────────────────────────────────

const SymbolRow = memo(function SymbolRow({
  symbol,
  onTap,
}: {
  symbol: string;
  onTap: (symbol: string) => void;
}) {
  const meta         = deriveMeta(symbol);
  const tick         = useTickStore(s => s.ticks[symbol] ?? null);
  const alerts       = useAlertStore(s => s.alerts);
  const activeCount  = alerts.filter(a => a.symbol === symbol && a.status === "active").length;
  const totalCount   = alerts.filter(a => a.symbol === symbol).length;

  const price = tick?.price ?? 0;
  const dir   = tick?.flashDir ?? null;

  return (
    <motion.button
      whileTap={{ scale: 0.98 }}
      transition={TAP_TRANSITION}
      onClick={() => onTap(symbol)}
      className="w-full flex items-center gap-3 px-4 py-3.5 text-left"
      style={{ WebkitTapHighlightColor: "transparent" }}
    >
      {/* Badge */}
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-[11px] font-bold"
        style={{ background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.7)" }}
      >
        {meta.badge.slice(0, 4)}
      </div>

      {/* Symbol + market */}
      <div className="flex-1 min-w-0">
        <p className="text-[15px] font-semibold text-white leading-tight truncate">{meta.label}</p>
        <p className="text-[11px] text-white/40 leading-tight mt-0.5">{meta.market}</p>
      </div>

      {/* Price */}
      <div className="text-right mr-1">
        <p
          className="text-[14px] font-mono font-semibold leading-tight tabular-nums"
          style={{
            color: dir === "up" ? "#34d399" : dir === "down" ? "#f87171" : "rgba(255,255,255,0.85)",
          }}
        >
          {formatPrice(price)}
        </p>
        {totalCount > 0 && (
          <p className="text-[11px] text-white/40 leading-tight mt-0.5">
            {activeCount > 0
              ? <span className="text-blue-400 font-semibold">{activeCount} active</span>
              : <span>{totalCount} alert{totalCount !== 1 ? "s" : ""}</span>
            }
          </p>
        )}
        {totalCount === 0 && (
          <p className="text-[11px] text-white/25 leading-tight mt-0.5">no alerts</p>
        )}
      </div>

      {/* Alert count badge */}
      {totalCount > 0 && (
        <div
          className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-[11px] font-bold"
          style={
            activeCount > 0
              ? { background: "rgba(59,130,246,0.2)", color: "#60a5fa" }
              : { background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.35)" }
          }
        >
          {totalCount}
        </div>
      )}

      <ChevronRight className="w-4 h-4 text-white/25 flex-shrink-0" />
    </motion.button>
  );
});

// ── Symbol detail panel ───────────────────────────────────────────────────────

const SymbolAlertsDetail = memo(function SymbolAlertsDetail({
  symbol,
  onBack,
}: {
  symbol: string;
  onBack: () => void;
}) {
  const meta        = deriveMeta(symbol);
  const tick        = useTickStore(s => s.ticks[symbol] ?? null);
  const alerts      = useAlertStore(s => s.alerts.filter(a => a.symbol === symbol));
  const deleteAlert = useAlertStore(s => s.deleteAlert);
  const updateAlert = useAlertStore(s => s.updateAlert);

  const price = tick?.price ?? 0;

  const grouped = {
    active:    alerts.filter(a => a.status === "active"),
    triggered: alerts.filter(a => a.status === "triggered"),
    paused:    alerts.filter(a => a.status === "paused"),
    expired:   alerts.filter(a => a.status === "expired"),
  };

  const togglePause = useCallback((alert: AnyAlert) => {
    updateAlert(alert.id, { status: alert.status === "paused" ? "active" : "paused" });
  }, [updateAlert]);

  return (
    <div className="absolute inset-0 flex flex-col" style={{ background: "#000000", zIndex: 10 }}>
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 flex-shrink-0"
        style={{
          height: 56,
          borderBottom: "1px solid rgba(255,255,255,0.07)",
          paddingTop: "env(safe-area-inset-top)",
        }}
      >
        <button
          onClick={onBack}
          className="w-8 h-8 rounded-full flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-colors flex-shrink-0"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-bold text-white leading-tight truncate">{meta.label}</p>
          {price > 0 && (
            <p className="text-[11px] font-mono text-white/40 leading-tight">{formatPrice(price)}</p>
          )}
        </div>
        <span
          className="px-2.5 py-1 rounded-full text-[10px] font-semibold flex-shrink-0"
          style={{ background: "rgba(59,130,246,0.15)", color: "#93c5fd", border: "1px solid rgba(59,130,246,0.2)" }}
        >
          {alerts.length} alert{alerts.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto" style={{ overscrollBehavior: "contain" }}>
        {alerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 px-8">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center"
              style={{ background: "rgba(255,255,255,0.05)" }}
            >
              <Bell className="w-7 h-7 text-white/20" />
            </div>
            <div className="text-center">
              <p className="text-[15px] font-semibold text-white/60 mb-1">No alerts for {meta.label}</p>
              <p className="text-[12px] text-white/30">
                Go to the Alerts tab to create price, zone, or trendline alerts.
              </p>
            </div>
          </div>
        ) : (
          <div className="pb-8">
            {(["active", "paused", "triggered", "expired"] as AlertStatus[]).map(status => {
              const group = grouped[status];
              if (group.length === 0) return null;
              const statusLabels: Record<AlertStatus, string> = {
                active:    "Active",
                triggered: "Triggered",
                paused:    "Paused",
                expired:   "Expired",
              };
              return (
                <div key={status} className="mt-4">
                  <p
                    className="px-4 pb-2 text-[11px] font-semibold uppercase tracking-widest"
                    style={{ color: "rgba(255,255,255,0.3)" }}
                  >
                    {statusLabels[status]}
                  </p>
                  <div
                    className="mx-4 rounded-2xl overflow-hidden"
                    style={{ border: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.03)" }}
                  >
                    {group.map((alert, idx) => {
                      const isLast = idx === group.length - 1;
                      return (
                        <div
                          key={alert.id}
                          className="px-4 py-3"
                          style={{
                            borderBottom: isLast ? "none" : "1px solid rgba(255,255,255,0.06)",
                          }}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <StatusDot status={alert.status} />
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <AlertTypeBadge type={alert.type} />
                                </div>
                                <div className="mt-1">
                                  <ConditionLabel alert={alert} />
                                </div>
                                {alert.notes && (
                                  <p className="text-[11px] text-white/35 mt-1 truncate">{alert.notes}</p>
                                )}
                              </div>
                            </div>
                            {/* Actions */}
                            <div className="flex items-center gap-1 flex-shrink-0 mt-0.5">
                              {(alert.status === "active" || alert.status === "paused") && (
                                <button
                                  onClick={() => togglePause(alert)}
                                  className="w-7 h-7 rounded-lg flex items-center justify-center text-white/40 hover:text-white/70 hover:bg-white/10 transition-colors"
                                >
                                  {alert.status === "paused"
                                    ? <Play className="w-3.5 h-3.5" />
                                    : <Pause className="w-3.5 h-3.5" />
                                  }
                                </button>
                              )}
                              <button
                                onClick={() => deleteAlert(alert.id)}
                                className="w-7 h-7 rounded-lg flex items-center justify-center text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                          <div className="flex items-center justify-between mt-2">
                            <p className="text-[10px] text-white/25">
                              Created {new Date(alert.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                            </p>
                            {alert.triggeredAt && (
                              <p className="text-[10px] text-emerald-400/60">
                                Triggered {new Date(alert.triggeredAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
});

// ── Main page ─────────────────────────────────────────────────────────────────

const DashboardAlerts = memo(function DashboardAlerts() {
  const [, navigate]      = useLocation();
  const [visible, setVisible] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  const items   = useBrokerWatchlistStore(s => s.items);
  const refresh = useBrokerWatchlistStore(s => s.refresh);

  // Entrance animation — same pattern as PositionDetailWrapper in App.tsx
  useEffect(() => {
    let rafId: number;
    const timerId = setTimeout(() => {
      rafId = requestAnimationFrame(() => setVisible(true));
    }, 0);
    return () => { clearTimeout(timerId); cancelAnimationFrame(rafId); };
  }, []);

  // Ensure watchlist is populated
  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleBack = useCallback(() => {
    navigate("/");
  }, [navigate]);

  const handleSymbolTap = useCallback((symbol: string) => {
    setSelected(symbol);
  }, []);

  const handleDetailBack = useCallback(() => {
    setSelected(null);
  }, []);

  const totalActiveAlerts = useAlertStore(s =>
    s.alerts.filter(a => a.status === "active").length
  );

  return (
    <>
      {/* Solid backdrop */}
      <div style={{ position: "fixed", inset: 0, zIndex: 49, background: "#000000" }} />

      {/* Animated panel */}
      <div
        style={{
          position:   "fixed",
          inset:      0,
          zIndex:     50,
          background: "#000000",
          opacity:    visible ? 1 : 0,
          transform:  visible
            ? "translate3d(0,0,0) scale(1)"
            : "translate3d(0,40px,0) scale(0.98)",
          transition: visible
            ? "opacity 280ms cubic-bezier(0.22,1,0.36,1), transform 320ms cubic-bezier(0.22,1,0.36,1)"
            : "none",
          willChange:               "transform, opacity",
          backfaceVisibility:       "hidden",
          WebkitBackfaceVisibility: "hidden",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* ── Header ── */}
        <div
          className="flex items-center gap-3 px-4 flex-shrink-0"
          style={{
            height: 56,
            paddingTop: "env(safe-area-inset-top)",
            borderBottom: "1px solid rgba(255,255,255,0.07)",
            background: "#000000",
          }}
        >
          <button
            onClick={handleBack}
            className="w-8 h-8 rounded-full flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-colors flex-shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <h1 className="flex-1 text-[17px] font-bold text-white">Price Alerts</h1>

          {totalActiveAlerts > 0 && (
            <span
              className="px-2.5 py-1 rounded-full text-[11px] font-bold flex-shrink-0"
              style={{ background: "rgba(59,130,246,0.2)", color: "#60a5fa" }}
            >
              {totalActiveAlerts} active
            </span>
          )}
        </div>

        {/* ── Watchlist ── */}
        <div
          className="flex-1 overflow-y-auto"
          style={{ overscrollBehavior: "contain", paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 px-8">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center"
                style={{ background: "rgba(255,255,255,0.05)" }}
              >
                <Bell className="w-7 h-7 text-white/20" />
              </div>
              <div className="text-center">
                <p className="text-[15px] font-semibold text-white/50 mb-1">No symbols in watchlist</p>
                <p className="text-[12px] text-white/30">Add symbols in the Markets tab to see alerts here.</p>
              </div>
            </div>
          ) : (
            <div>
              <p
                className="px-4 pt-4 pb-2 text-[11px] font-semibold uppercase tracking-widest"
                style={{ color: "rgba(255,255,255,0.3)" }}
              >
                Watchlist · {items.length} symbol{items.length !== 1 ? "s" : ""}
              </p>
              <div
                className="mx-4 rounded-2xl overflow-hidden"
                style={{ border: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.02)" }}
              >
                {items.map((item, idx) => {
                  const isLast = idx === items.length - 1;
                  return (
                    <div
                      key={item.id}
                      style={{
                        borderBottom: isLast ? "none" : "1px solid rgba(255,255,255,0.055)",
                      }}
                    >
                      <SymbolRow symbol={item.symbol} onTap={handleSymbolTap} />
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* ── Symbol detail — slides in from right ── */}
        <AnimatePresence>
          {selected && (
            <motion.div
              key={selected}
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={tweenStandard}
              style={{
                position: "absolute",
                inset: 0,
                background: "#000000",
                zIndex: 10,
              }}
            >
              <SymbolAlertsDetail symbol={selected} onBack={handleDetailBack} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
});

export default DashboardAlerts;
