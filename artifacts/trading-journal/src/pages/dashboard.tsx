import { memo, useMemo, useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  useListTrades,
  useGetCalendarHeatmap,
} from "@workspace/api-client-react";
import { useCurrencyFormatter, useCurrencyAxisFormatter } from "@/store/currencyStore";
import { Activity, ChevronRight, ChevronLeft, X, ArrowLeft, TrendingUp, ExternalLink, ImageIcon, Tag, AlertTriangle, FileText } from "lucide-react";
import AccountValueWidget from "@/components/AccountValueWidget";
import DashboardSegmentedControl from "@/components/DashboardSegmentedControl";
import { useCombinedPortfolio } from "@/store/combinedPortfolioStore";
import { useBrokerStore } from "@/store/brokerStore";
import { Link } from "wouter";
import { BROKER_MAP, BROKER_INFO, TV_LINKS } from "@/data/sampleData";
import { motion, AnimatePresence } from "framer-motion";
import { useTickStore } from "@/store/tickStore";
import { useChartStore } from "@/store/chartStore";
import {
  PageTransition,
} from "@/components/animations";

const DASHBOARD_TIMEOUT_MS = 2_000;


const tooltipStyle = {
  backgroundColor: "hsl(var(--card))",
  borderColor: "rgba(57, 91, 67, 0.3)",
  borderRadius: "12px",
  boxShadow: "0 8px 28px rgba(7, 17, 13, 0.65)",
  fontSize: "12px",
  padding: "8px 12px",
};


// ── Calendar Heatmap ──────────────────────────────────────────────────────────
// ── Day Detail Sheet ──────────────────────────────────────────────────────────
const EASE_OPEN  = "cubic-bezier(0.22,1,0.36,1)";
const EASE_CLOSE = "cubic-bezier(0.4,0,0.6,1)";
const DUR_OPEN   = 320;
const DUR_CLOSE  = 240;

type DashTrade = {
  id: number; symbol: string; side: string; pnl?: number | null;
  entryPrice?: number | null; exitPrice?: number | null; quantity: number;
  riskRewardRatio?: number | null; stopLoss?: number | null; takeProfit?: number | null;
  entryDate: string; tvLink?: string | null; screenshot?: string | null;
  setupTags?: string | null; mistakeTags?: string | null; notes?: string | null;
};

const DayDetailSheet = memo(function DayDetailSheet({
  date, open, onClose,
}: {
  date: string;
  open: boolean;
  onClose: () => void;
}) {
  const fc  = useCurrencyFormatter();
  const { data, isLoading } = useListTrades(
    { date, limit: 100 },
    { query: { enabled: open && !!date } },
  );
  const dayTrades = (data?.trades ?? []) as DashTrade[];
  const wins      = dayTrades.filter((t: DashTrade) => (t.pnl ?? 0) > 0).length;
  const losses    = dayTrades.filter((t: DashTrade) => (t.pnl ?? 0) < 0).length;
  const dailyPnl  = dayTrades.reduce((sum: number, t: DashTrade) => sum + (t.pnl ?? 0), 0);

  const [selectedTradeId, setSelectedTradeId] = useState<number | null>(null);
  const selectedTrade = selectedTradeId != null
    ? (dayTrades.find(t => t.id === selectedTradeId) ?? null)
    : null;

  /* hasOpenedRef prevents a null/empty render before the first open */
  const hasOpenedRef = useRef(false);
  if (open) hasOpenedRef.current = true;

  /* visible drives the CSS transition — double-rAF guarantees the browser
     paints the closed position (translateY 100%) before the slide starts */
  const [visible, setVisible] = useState(false);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  useEffect(() => {
    if (open) {
      let raf: number;
      const t = setTimeout(() => { raf = requestAnimationFrame(() => setVisible(true)); }, 0);
      return () => { clearTimeout(t); cancelAnimationFrame(raf); };
    }
    setVisible(false);
    setSelectedTradeId(null);
    return undefined;
  }, [open]);

  /* Body scroll-lock */
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  /* ESC key */
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onCloseRef.current(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open]);

  const label = useMemo(() => {
    if (!date) return "";
    return new Date(date + "T00:00:00").toLocaleDateString("en-US", {
      weekday: "long", month: "long", day: "numeric", year: "numeric",
    });
  }, [date]);

  const stopProp = useCallback((e: React.SyntheticEvent) => e.stopPropagation(), []);

  if (!hasOpenedRef.current) return null;

  return createPortal(
    <div
      aria-hidden={!open}
      style={{ position: "fixed", inset: 0, zIndex: 75, pointerEvents: open ? "auto" : "none" }}
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "absolute", inset: 0,
          background: "rgba(0,0,0,0.65)",
          backdropFilter: "blur(6px)",
          WebkitBackdropFilter: "blur(6px)",
          opacity: visible ? 1 : 0,
          transition: `opacity ${visible ? DUR_OPEN : DUR_CLOSE}ms ${visible ? EASE_OPEN : EASE_CLOSE}`,
        }}
      />

      {/* Sheet — slides up from bottom */}
      <div
        onClick={stopProp}
        style={{
          position: "absolute", left: 0, right: 0, bottom: 0,
          height: "85dvh",
          display: "flex", flexDirection: "column",
          background: "linear-gradient(180deg, #0a0a0a 0%, #000000 40%, #050508 100%)",
          borderRadius: "20px 20px 0 0",
          borderTop: "1px solid rgba(255,255,255,0.08)",
          transform: visible ? "translateY(0)" : "translateY(100%)",
          transition: `transform ${visible ? DUR_OPEN : DUR_CLOSE}ms ${visible ? EASE_OPEN : EASE_CLOSE}`,
          willChange: "transform",
          overflow: "hidden",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
        className="transform-gpu"
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div style={{ width: 36, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.15)" }} />
        </div>

        {/* Header */}
        <div className="flex items-start justify-between px-5 mt-1 mb-4 flex-shrink-0">
          <div>
            <p className="text-[11px] text-white/40 uppercase tracking-widest mb-0.5">Daily Summary</p>
            <p className="text-[15px] font-semibold text-white">{label}</p>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-full bg-white/10 text-white/50 hover:text-white transition-colors mt-0.5"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Summary row */}
        <div className="flex gap-2 px-5 mb-4 flex-shrink-0">
          <div className="dash-account-card dash-account-card-dim flex-1 p-3">
            <p className="text-[10px] text-white/40 mb-1">Net P&amp;L</p>
            <p className={`text-[16px] font-bold ${dailyPnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
              {dailyPnl >= 0 ? "+" : ""}{fc(dailyPnl)}
            </p>
            {dailyPnl > 0 && <p className="text-[10px] text-white/40 mt-1">Congrats, your day is profitable!</p>}
            {dailyPnl < 0 && <p className="text-[10px] text-white/40 mt-1">Stay disciplined. Better trades ahead.</p>}
          </div>
          <div className="flex-1 p-3 pt-5">
            <div className="flex items-center gap-1.5 mb-2">
              <span className="text-[13px] text-white/50 font-semibold">Total Trades:</span>
              <span className="inline-flex items-center justify-center h-[18px] px-3.5 rounded-full bg-blue-900 text-white text-[11px] font-bold leading-none">{dayTrades.length}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5">
                <span className="text-[13px] text-white/50 font-semibold">Win:</span>
                <span className="inline-flex items-center justify-center h-[22px] px-3 rounded-lg text-[12px] font-bold leading-none" style={{ background: "rgba(16,185,129,0.15)", color: "#34d399", border: "1px solid rgba(52,211,153,0.2)" }}>{wins}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[13px] text-white/50 font-semibold">Loss:</span>
                <span className="inline-flex items-center justify-center h-[22px] px-3 rounded-lg text-[12px] font-bold leading-none" style={{ background: "rgba(239,68,68,0.15)", color: "#f87171", border: "1px solid rgba(248,113,113,0.2)" }}>{losses}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Trade list header */}
        <div className="flex items-center justify-between px-5 pb-2 flex-shrink-0">
          <p className="text-[11px] font-semibold text-white/40 uppercase tracking-widest">Trades</p>
          {!isLoading && dayTrades.length > 0 && (
            <span className="text-[11px] font-semibold text-white/40">{dayTrades.length}</span>
          )}
        </div>

        {/* Trade list */}
        <div className="overflow-y-auto flex-1 pb-8 px-5" style={{ overscrollBehavior: "contain" }}>
          <div className="dash-account-card dash-account-card-dim overflow-hidden">
            {isLoading && (
              <div>
                {[0, 1, 2].map(i => (
                  <div key={i} style={{ padding: "12px 20px", borderBottom: i < 2 ? "1px solid rgba(255,255,255,0.055)" : "none" }}>
                    <div className="flex items-center justify-between">
                      <div className="h-4 w-28 rounded-lg shimmer-loading" />
                      <div className="h-4 w-16 rounded-lg shimmer-loading" />
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <div className="h-3 w-20 rounded shimmer-loading" />
                      <div className="h-3 w-14 rounded shimmer-loading" />
                    </div>
                  </div>
                ))}
              </div>
            )}
            {!isLoading && dayTrades.length === 0 && (
              <div className="text-center py-10">
                <p className="text-white/40 text-sm">No trades for this day.</p>
              </div>
            )}
            {!isLoading && dayTrades.map((trade, idx) => {
              const isLast  = idx === dayTrades.length - 1;
              const pnl     = trade.pnl ?? 0;
              const isWin   = pnl >= 0;
              const fPrice  = (v: number) => v < 1 ? v.toFixed(4) : v.toLocaleString(undefined, { maximumFractionDigits: 1 });
              const dateStr = trade.entryDate
                ? new Date(trade.entryDate).toLocaleDateString(undefined, { month: "short", day: "numeric" })
                : "";
              return (
                <div
                  key={trade.id}
                  onClick={() => setSelectedTradeId(trade.id)}
                  style={{
                    padding: "12px 20px",
                    borderBottom: isLast ? "none" : "1px solid rgba(255,255,255,0.12)",
                    WebkitTapHighlightColor: "transparent",
                    transition: "background 0.15s",
                    cursor: "pointer",
                  }}
                  onPointerDown={e => (e.currentTarget.style.background = "rgba(255,255,255,0.05)")}
                  onPointerUp={e => (e.currentTarget.style.background = "transparent")}
                  onPointerLeave={e => (e.currentTarget.style.background = "transparent")}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold leading-none" style={{ fontSize: 15, color: "#F0F0F0" }}>{trade.symbol}</span>
                      <span className="font-semibold leading-none" style={{ fontSize: 10, color: trade.side === "long" ? "#35C37A" : "#E0524F", letterSpacing: "0.06em" }}>
                        {trade.side === "long" ? "LONG" : "SHORT"}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold leading-none tabular-nums" style={{ fontSize: 14, color: isWin ? "#35C37A" : "#E0524F" }}>
                        {isWin ? "+" : ""}{fc(pnl)}
                      </span>
                      <ChevronRight className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "rgba(255,255,255,0.2)" }} />
                    </div>
                  </div>
                  <div className="flex items-center justify-between" style={{ marginTop: 6 }}>
                    <div className="flex items-center gap-0.5">
                      <span className="font-medium tabular-nums" style={{ fontSize: 12, color: "#6B6B6B" }}>{fPrice(trade.entryPrice ?? 0)}</span>
                      <span style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", margin: "0 2px" }}>→</span>
                      <span className="font-medium tabular-nums" style={{ fontSize: 12, color: "#6B6B6B" }}>
                        {trade.exitPrice != null ? fPrice(trade.exitPrice) : "—"}
                      </span>
                    </div>
                    <span className="font-medium tabular-nums" style={{ fontSize: 12, color: "#6B6B6B" }}>{dateStr}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Trade detail overlay — slides in from the right */}
        <AnimatePresence>
          {selectedTrade && (
            <motion.div
              key="trade-detail"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 32, stiffness: 320 }}
              style={{
                position: "absolute", inset: 0,
                background: "#000000",
                zIndex: 10,
                display: "flex", flexDirection: "column",
                overflowY: "auto",
                borderRadius: "inherit",
              }}
            >
              {/* Nav header — symbol + side badge folded in */}
              <div className="flex items-center gap-3 px-4 h-14 flex-shrink-0" style={{ background: "#000000", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                <button
                  onClick={() => setSelectedTradeId(null)}
                  className="flex items-center justify-center w-8 h-8 rounded-full text-white/70 hover:text-white hover:bg-white/10 transition-colors flex-shrink-0"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] font-bold text-white leading-tight truncate">{selectedTrade.symbol}</p>
                  <p className="text-[10px] font-semibold leading-tight" style={{ color: selectedTrade.side === "long" ? "#35C37A" : "#E0524F" }}>
                    {selectedTrade.side === "long" ? "LONG" : "SHORT"}
                  </p>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold flex-shrink-0 ${selectedTrade.side === "long" ? "bg-blue-500/15 text-blue-400 border border-blue-500/20" : "bg-orange-500/15 text-orange-400 border border-orange-500/20"}`}>
                  Trade Details
                </span>
              </div>

              {/* Metrics + rest — no gap, content starts immediately */}
              <div className="px-4 pt-3 pb-4 space-y-5">
                <div className="grid grid-cols-2 gap-2.5">
                  {[
                    { label: "Date",          value: new Date(selectedTrade.entryDate).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" }) },
                    { label: (selectedTrade.pnl ?? 0) >= 0 ? "Profit" : "Loss", value: ((selectedTrade.pnl ?? 0) >= 0 ? "+" : "") + fc(selectedTrade.pnl ?? 0), color: (selectedTrade.pnl ?? 0) >= 0 ? "#34d399" : "#f87171" },
                    { label: "Entry",         value: fc(selectedTrade.entryPrice ?? 0) },
                    { label: "Exit",          value: selectedTrade.exitPrice == null ? "—" : fc(selectedTrade.exitPrice) },
                    { label: "Risk / Reward", value: selectedTrade.riskRewardRatio ? `${selectedTrade.riskRewardRatio.toFixed(2)}R` : "—" },
                    { label: "Quantity",      value: String(selectedTrade.quantity) },
                    { label: "Stop Loss",     value: selectedTrade.stopLoss ? fc(selectedTrade.stopLoss) : "—" },
                    { label: "Take Profit",   value: selectedTrade.takeProfit ? fc(selectedTrade.takeProfit) : "—" },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="p-3 rounded-xl border" style={{ background: "#111111", borderColor: "rgba(255,255,255,0.09)" }}>
                      <p className="text-[10px] font-semibold text-white/40 uppercase tracking-wider mb-1">{label}</p>
                      <p className="text-[14px] font-bold font-mono leading-tight" style={{ color: color ?? "#ffffff" }}>{value}</p>
                    </div>
                  ))}
                </div>
                <div className="space-y-2.5">
                  <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Analysis</p>
                  {(selectedTrade.tvLink || TV_LINKS[selectedTrade.symbol as keyof typeof TV_LINKS]) ? (
                    <button className="tv-chart-btn w-full flex items-center justify-between px-4 py-2.5 rounded-xl text-[13px] font-semibold"
                      onClick={() => window.open(selectedTrade.tvLink || TV_LINKS[selectedTrade.symbol as keyof typeof TV_LINKS], "_blank")}>
                      <div className="flex items-center gap-2"><TrendingUp className="w-4 h-4" />Open TradingView Chart</div>
                      <ExternalLink className="w-3.5 h-3.5 opacity-70" />
                    </button>
                  ) : (
                    <div className="px-4 py-2.5 rounded-xl border border-dashed border-white/[0.08] text-[12px] text-white/40 italic">No chart linked</div>
                  )}
                  {selectedTrade.screenshot ? (
                    <div className="rounded-xl overflow-hidden border border-white/[0.08] cursor-pointer group relative" onClick={() => window.open(selectedTrade.screenshot!, "_blank")}>
                      <img src={selectedTrade.screenshot} alt="Trade Screenshot" className="w-full max-h-44 object-cover group-hover:opacity-90 transition-opacity" />
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30"><ExternalLink className="w-5 h-5 text-white" /></div>
                    </div>
                  ) : (
                    <div className="h-20 rounded-xl border border-dashed border-white/[0.07] flex items-center justify-center gap-2 text-[12px] text-white/40 italic">
                      <ImageIcon className="w-4 h-4 opacity-50" /> No screenshot attached
                    </div>
                  )}
                </div>
                <div className="space-y-3">
                  <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Tags</p>
                  {selectedTrade.setupTags && (
                    <div>
                      <p className="text-[11px] text-white/50 mb-1.5 flex items-center gap-1"><Tag className="w-3 h-3" /> Setup</p>
                      <div className="flex flex-wrap gap-1.5">
                        {selectedTrade.setupTags.split(",").filter(Boolean).map(tag => (
                          <span key={tag} className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-primary/12 text-primary border border-primary/20">{tag}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {selectedTrade.mistakeTags && (
                    <div>
                      <p className="text-[11px] text-white/50 mb-1.5 flex items-center gap-1"><AlertTriangle className="w-3 h-3 text-red-400/70" /> Mistakes</p>
                      <div className="flex flex-wrap gap-1.5">
                        {selectedTrade.mistakeTags.split(",").filter(Boolean).map(tag => (
                          <span key={tag} className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-red-500/10 text-red-400 border border-red-500/20">{tag}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {!selectedTrade.setupTags && !selectedTrade.mistakeTags && (
                    <p className="text-[12px] text-white/40 italic">No tags recorded</p>
                  )}
                </div>
                <div className="space-y-2 pb-8">
                  <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest flex items-center gap-1"><FileText className="w-3 h-3" /> Journal Notes</p>
                  {selectedTrade.notes ? (
                    <div className="p-4 rounded-xl text-[13px] leading-relaxed text-white/70" style={{ background: "#111111", border: "1px solid rgba(255,255,255,0.09)" }}>{selectedTrade.notes}</div>
                  ) : (
                    <p className="text-[12px] text-white/40 italic">No notes recorded for this trade.</p>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>,
    document.body,
  );
});

// ── Calendar Heatmap ──────────────────────────────────────────────────────────
const CalendarHeatmap = memo(function CalendarHeatmap({
  data, year, month, onPrev, onNext, onDateClick,
}: { data: Array<{ date: string; pnl: number; trades: number }>; year: number; month: number; onPrev: () => void; onNext: () => void; onDateClick: (date: string) => void }) {
  const fc            = useCurrencyFormatter();
  const axisFormatter = useCurrencyAxisFormatter();
  const dayMap = useMemo(() => {
    const m: Record<string, { pnl: number; trades: number }> = {};
    data.forEach((d) => { m[d.date] = { pnl: d.pnl, trades: d.trades }; });
    return m;
  }, [data]);

  const maxAbs = useMemo(() => Math.max(...data.map((d) => Math.abs(d.pnl)), 1), [data]);
  const firstDay = useMemo(() => new Date(year, month - 1, 1).getDay(), [year, month]);
  const daysInMonth = useMemo(() => new Date(year, month, 0).getDate(), [year, month]);
  const monthName = useMemo(
    () => new Date(year, month - 1).toLocaleDateString("en-US", { month: "long", year: "numeric" }),
    [year, month]
  );

  const [statsTooltip, setStatsTooltip] = useState(false);

  useEffect(() => {
    if (!statsTooltip) return;
    const close = () => setStatsTooltip(false);
    window.addEventListener("scroll", close, { passive: true, capture: true });
    window.addEventListener("touchmove", close, { passive: true, capture: true });
    return () => {
      window.removeEventListener("scroll", close, { capture: true });
      window.removeEventListener("touchmove", close, { capture: true });
    };
  }, [statsTooltip]);

  const monthlyPnl = useMemo(() => data.reduce((sum, d) => sum + d.pnl, 0), [data]);

  const remainingDays = useMemo(() => {
    const today = new Date();
    const isCurrentMonth = today.getFullYear() === year && today.getMonth() + 1 === month;
    if (!isCurrentMonth) return 0;
    return daysInMonth - today.getDate();
  }, [year, month, daysInMonth]);

  const cellStyles = useMemo(() => {
    const styles: Record<string, React.CSSProperties> = {};
    Object.entries(dayMap).forEach(([dateStr, d]) => {
      if (!d || d.trades === 0) return;
      const intensity = Math.min(Math.abs(d.pnl) / maxAbs, 1);
      if (d.pnl > 0) styles[dateStr] = { backgroundColor: `rgba(52,211,153,${0.12 + intensity * 0.55})`, borderColor: `rgba(52,211,153,${0.2 + intensity * 0.3})` };
      else if (d.pnl < 0) styles[dateStr] = { backgroundColor: `rgba(248,113,113,${0.12 + intensity * 0.55})`, borderColor: `rgba(248,113,113,${0.2 + intensity * 0.3})` };
      else styles[dateStr] = { backgroundColor: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.1)" };
    });
    return styles;
  }, [dayMap, maxAbs]);

  const days: React.ReactNode[] = [];
  for (let i = 0; i < firstDay; i++) {
    days.push(<div key={`empty-${i}`} />);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const entry = dayMap[dateStr];
    days.push(
      <div
        key={dateStr}
        onClick={() => entry && entry.trades > 0 && onDateClick(dateStr)}
        className={`relative rounded-lg aspect-square flex flex-col items-center justify-center border border-transparent transition-opacity active:opacity-60 ${
          entry && entry.trades > 0 ? "cursor-pointer" : "cursor-default"
        }`}
        style={cellStyles[dateStr]}
      >
        <span className="text-[10px] font-semibold leading-none text-foreground/90">{d}</span>
        {entry && entry.trades > 0 && (
          <span className={`text-[8px] font-bold leading-none mt-0.5 ${entry.pnl > 0 ? "text-emerald-400" : "text-red-400"}`}>
            {entry.pnl > 0 ? "+" : ""}{axisFormatter(Math.abs(entry.pnl))}
          </span>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="px-4 flex items-center justify-between mb-3">
        {/* left: month navigator */}
        <div className="flex items-center gap-1">
          <button
            onClick={onPrev}
            className="w-6 h-6 flex items-center justify-center rounded-md text-muted-foreground hover:text-white hover:bg-white/10 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs font-semibold text-muted-foreground px-1">{monthName}</span>
          <button
            onClick={onNext}
            className="w-6 h-6 flex items-center justify-center rounded-md text-muted-foreground hover:text-white hover:bg-white/10 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        {/* right: monthly stats */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <button
              onClick={() => setStatsTooltip((v) => !v)}
              className="text-[11px] font-medium text-muted-foreground border-b border-dashed border-muted-foreground/50 leading-none pb-px cursor-pointer select-none"
            >
              Monthly stats:
            </button>
            {statsTooltip && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setStatsTooltip(false)} />
                <div className="absolute right-0 top-full mt-2 z-40 w-52 rounded-xl border border-white/[0.08] bg-[#111111] shadow-2xl px-3 py-2.5">
                  <p className="text-[11px] font-semibold text-white mb-1">Monthly Stats</p>
                  <p className="text-[10px] text-muted-foreground leading-relaxed">
                    Total realised P&L for the selected month, calculated from all closed trades on trading days.
                  </p>
                  {remainingDays > 0 && (
                    <p className="text-[10px] text-blue-300 mt-1.5">
                      {remainingDays} trading days remaining this month.
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
          {data.length > 0 && (
            <span
              className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                monthlyPnl >= 0
                  ? "bg-emerald-500/20 text-emerald-400"
                  : "bg-red-500/20 text-red-400"
              }`}
            >
              {monthlyPnl >= 0 ? "+" : ""}{axisFormatter(monthlyPnl)}
            </span>
          )}
          {remainingDays > 0 && (
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-900/70 text-white">
              {remainingDays} days
            </span>
          )}
        </div>
      </div>
      <div className="px-3">
        <div className="grid grid-cols-7 gap-1 mb-1.5">
          {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
            <div key={d} className="text-center text-[10px] font-semibold text-muted-foreground py-0.5">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">{days}</div>
      </div>
    </div>
  );
});

const Dashboard = memo(function Dashboard() {
  const mountTimeRef  = useRef(performance.now());
  const [timedOut,          setTimedOut]          = useState(false);
  const ticks         = useTickStore(s => s.ticks);
  const fc            = useCurrencyFormatter();

  useEffect(() => {
    console.log("[Dashboard] mount");
    const t = setTimeout(() => {
      console.log("[Dashboard] loading timeout reached — rendering with available data");
      setTimedOut(true);
    }, DASHBOARD_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, []);

  const { isLoading: tradesLoading, isError: tradesError }
    = useListTrades({ limit: 1 });

  const combined = useCombinedPortfolio();
  const brokerOrdersCount = useBrokerStore(s =>
    Object.values(s.brokerOrders).reduce((sum, o) => sum + o.length, 0));

  useEffect(() => {
    if (!tradesLoading && !timedOut) {
      const elapsed = Math.round(performance.now() - mountTimeRef.current);
      console.log(`[Dashboard] loading complete in ${elapsed}ms — trades:${!tradesError}`);
      setTimedOut(true);
    }
  }, [tradesLoading, timedOut, tradesError]);

  const now = useMemo(() => new Date(), []);
  const [calYear,  setCalYear]  = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth() + 1);

  const handleCalPrev = useCallback(() => {
    setCalMonth((m) => { if (m === 1) { setCalYear((y) => y - 1); return 12; } return m - 1; });
  }, []);
  const handleCalNext = useCallback(() => {
    setCalMonth((m) => { if (m === 12) { setCalYear((y) => y + 1); return 1; } return m + 1; });
  }, []);

  const { data: calData } = useGetCalendarHeatmap({ year: calYear, month: calMonth });

  const setDashboardSheetOpen = useChartStore(s => s.setDashboardSheetOpen);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [sheetOpen,    setSheetOpen]    = useState(false);

  const openSheet = useCallback((v: boolean) => {
    setSheetOpen(v);
    setDashboardSheetOpen(v);
  }, [setDashboardSheetOpen]);

  const handleDateClick = useCallback((date: string) => {
    setSelectedDate(date);
    openSheet(true);
  }, [openSheet]);

  const isStillLoading = !timedOut && tradesLoading;

  const openPositionsCount = useBrokerStore(s =>
    Object.values(s.brokerPositions).reduce((sum, p) => sum + p.length, 0));

  if (isStillLoading) {
    // Structurally mirrors every section of the real content below, at the
    // same fixed heights (AccountValueWidget ≈176px, calendar card ≈302px,
    // recent trades table). Matching heights exactly means the eventual
    // swap to real content never shifts layout — this only ever runs once
    // now that Dashboard is kept mounted (see DASHBOARD_NODE in App.tsx),
    // not on every tab switch.
    return (
      <div className="min-h-full space-y-4 pb-12" style={{ background: "#000000" }}>
        <div className="dash-card shimmer-loading" style={{ height: 176 }} />
        <div className="dash-card shimmer-loading" style={{ height: 302 }} />
      </div>
    );
  }

  const apiOffline = tradesError;

  return (
    <PageTransition className="space-y-4 pb-12" style={{ minHeight: "100%", background: "#000000" }} fill={false}>

      {apiOffline && (
        <div className="dash-card px-5 py-3 flex items-center gap-3 border-amber-500/20 bg-amber-500/[0.04]">
          <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />
          <p className="text-[12px] text-amber-400 font-medium">
            API server offline — dashboard showing cached or empty data
          </p>
        </div>
      )}

      {/* ── Segmented control — Dashboard / Reports ──
          Selection is derived from the current route, not local state, so
          it self-corrects when the user navigates back from Reports. */}
      <DashboardSegmentedControl />

      {/* ── Account Value Widget — -mt-2 closes the gap with the segmented control ── */}
      <div className="-mt-2">
        <AccountValueWidget
          accountValueUSD={combined.usd.accountValue}
          accountValueDisplay={combined.display.accountValue}
          upnlUSD={combined.usd.unrealizedPnl}
          upnlDisplay={combined.display.unrealizedPnl}
          realizedPnlUSD={combined.usd.realizedPnl}
          realizedPnlDisplay={combined.display.realizedPnl}
          netPnlUSD={combined.usd.netPnl}
          netPnlDisplay={combined.display.netPnl}
          openPositions={openPositionsCount}
          openOrders={brokerOrdersCount}
        />
      </div>

      {/* ── Trading Calendar ── */}
      <div className="-mx-4">
        <p className="px-4 pb-2 text-[16px] font-semibold text-white">Trading Calendar</p>
        {calData ? (
          <CalendarHeatmap data={calData} year={calYear} month={calMonth} onPrev={handleCalPrev} onNext={handleCalNext} onDateClick={handleDateClick} />
        ) : (
          <CalendarHeatmap data={[]} year={calYear} month={calMonth} onPrev={handleCalPrev} onNext={handleCalNext} onDateClick={handleDateClick} />
        )}
      </div>

      {/* ── Day Detail Sheet ── */}
      <DayDetailSheet
        date={selectedDate}
        open={sheetOpen}
        onClose={() => openSheet(false)}
      />

    </PageTransition>
  );
});

export default Dashboard;
