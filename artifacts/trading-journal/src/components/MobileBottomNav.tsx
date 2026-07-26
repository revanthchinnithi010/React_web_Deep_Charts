import { useRef, useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  Globe,
  ArrowLeftRight,
  BarChart2,
  Bell,
} from "lucide-react";
import { useNotifications } from "@/contexts/NotificationsContext";
import { useChartStore } from "@/store/chartStore";
import { useTheme } from "@/contexts/ThemeContext";

type NavTab =
  | { kind: "link"; href: string; label: string; Icon: React.ElementType }
  | { kind: "action"; label: string; Icon: React.ElementType; onTap: () => void };

const TABS: NavTab[] = [
  { kind: "link", href: "/",        label: "Home",    Icon: LayoutDashboard },
  { kind: "link", href: "/markets", label: "Markets", Icon: Globe           },
  { kind: "link", href: "/trades",  label: "Trade",   Icon: ArrowLeftRight  },
  { kind: "link", href: "/charts",  label: "Charts",  Icon: BarChart2       },
  { kind: "link", href: "/alerts",  label: "Alerts",  Icon: Bell            },
];

const N     = TABS.length;
const BAR_H = 62;

const CSS_ID = "tj-circle-nav-v2";
function ensureCSS() {
  if (typeof document === "undefined" || document.getElementById(CSS_ID)) return;
  const s = document.createElement("style");
  s.id = CSS_ID;
  s.textContent = `
    .tj-cnav-entrance {
      animation: tj-cnav-in 0.50s cubic-bezier(0.34,1.52,0.64,1) both;
    }
    @keyframes tj-cnav-in {
      from { transform: translateY(110%); opacity: 0; }
      to   { transform: translateY(0);    opacity: 1; }
    }
    .tj-cnav-tab:active { transform: scale(0.88) !important; }
  `;
  document.head.appendChild(s);
}

export function MobileBottomNav() {
  const [location] = useLocation();
  const { unreadCount } = useNotifications();
  const mobileChartFullscreen = useChartStore(s => s.mobileChartFullscreen);
  const { theme } = useTheme();
  const isLight = theme === "light";

  const pillRef    = useRef<HTMLDivElement>(null);
  const revertTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activeIdx = TABS.findIndex(t => t.kind === "link" && t.href === location);
  const [visualIdx, setVisualIdx] = useState(activeIdx >= 0 ? activeIdx : 0);

  useEffect(() => {
    ensureCSS();
    return () => {
      if (revertTimer.current) clearTimeout(revertTimer.current);
    };
  }, []);

  useEffect(() => {
    if (activeIdx >= 0 && !mobileChartFullscreen) {
      if (revertTimer.current) {
        clearTimeout(revertTimer.current);
        revertTimer.current = null;
      }
      setVisualIdx(activeIdx);
    }
  }, [activeIdx, mobileChartFullscreen]);

  /* ── Light-theme palette ── */
  const pillBg          = isLight ? "rgba(255,255,255,0.99)"      : "rgba(12,14,19,0.97)";
  const pillInsetShadow = isLight
    ? "inset 0 1px 0 rgba(0,0,0,0.04), inset 0 -1px 0 rgba(0,0,0,0.03)"
    : "inset 0 1px 0 rgba(255,255,255,0.09), inset 0 -1px 0 rgba(0,0,0,0.3)";
  const wrapperGradient = isLight
    ? "linear-gradient(135deg, rgba(0,0,0,0.10) 0%, rgba(0,0,0,0.04) 30%, rgba(0,0,0,0.02) 58%, rgba(0,0,0,0.09) 100%)"
    : "linear-gradient(135deg, rgba(255,255,255,0.42) 0%, rgba(255,255,255,0.14) 30%, rgba(255,255,255,0.06) 58%, rgba(255,255,255,0.28) 100%)";
  const wrapperShadow = isLight
    ? [
        "0 0 0 1px rgba(0,0,0,0.06)",
        "0 -1px 0 #E5E7EB",
        "0 8px 32px rgba(0,0,0,0.10)",
        "0 2px 10px rgba(0,0,0,0.06)",
      ].join(",")
    : [
        "0 0 0 1px rgba(255,255,255,0.06)",
        "0 12px 40px rgba(0,0,0,0.65)",
        "0 0 20px rgba(0,0,0,0.30)",
        "0 2px 10px rgba(0,0,0,0.40)",
      ].join(",");

  const activeIconColor   = isLight ? "#7C3AED"                  : "#ffffff";
  const inactiveIconColor = isLight ? "#9CA3AF"                  : "rgba(148,163,184,0.44)";
  const activeLabelColor   = isLight ? "#7C3AED"                  : "rgba(255,255,255,0.92)";
  const inactiveLabelColor = isLight ? "#9CA3AF"                  : "rgba(148,163,184,0.40)";
  const badgeBorder        = isLight ? "rgba(255,255,255,0.95)"   : "rgba(12,14,19,0.9)";

  return (
    <div
      className="tj-cnav-entrance"
      style={{
        flexShrink:    0,
        padding:       `2px 14px`,
        paddingBottom: `calc(10px + env(safe-area-inset-bottom, 0px))`,
        background:    "transparent",
        position:      "relative",
      }}
    >
      <div
        style={{
          borderRadius: 9999,
          padding:      "1px",
          background:   wrapperGradient,
          boxShadow:    wrapperShadow,
          position:     "relative",
        }}
      >
        <div
          ref={pillRef}
          style={{
            height:               BAR_H,
            borderRadius:         9999,
            background:           pillBg,
            backdropFilter:       isLight ? "none" : "blur(28px) saturate(190%)",
            WebkitBackdropFilter: isLight ? "none" : "blur(28px) saturate(190%)",
            boxShadow:            pillInsetShadow,
            position:             "relative",
            overflow:             "hidden",
            display:              "flex",
          }}
        >
          {TABS.map((tab, idx) => {
            const active   = idx === visualIdx;
            const isAlerts = tab.kind === "link" && tab.href === "/alerts";
            const badge    = isAlerts && unreadCount > 0 ? unreadCount : 0;

            return (
              <Link
                key={tab.kind === "link" ? tab.href : `action-${idx}`}
                href={tab.kind === "link" ? tab.href : "/"}
                style={{
                  flex:                    1,
                  display:                 "flex",
                  textDecoration:          "none",
                  WebkitTapHighlightColor: "transparent",
                  outline:                 "none",
                  position:                "relative",
                  zIndex:                  10,
                } as React.CSSProperties}
              >
                <motion.div
                  className="tj-cnav-tab"
                  whileTap={{ scale: 0.97 }}
                  transition={{ type: "tween", duration: 0.09, ease: "easeOut" }}
                  style={{
                    width:          "100%",
                    height:         "100%",
                    display:        "flex",
                    flexDirection:  "column",
                    alignItems:     "center",
                    justifyContent: "center",
                    gap:            4,
                    cursor:         "pointer",
                    userSelect:     "none",
                  }}
                >
                  <motion.div
                    animate={{ scale: active ? 1.16 : 1 }}
                    transition={{ type: "spring", stiffness: 550, damping: 28 }}
                    style={{ position: "relative" }}
                  >
                    <tab.Icon
                      style={{
                        width:      22,
                        height:     22,
                        flexShrink: 0,
                        color:      active ? activeIconColor : inactiveIconColor,
                        transition: "color 0.22s ease",
                        display:    "block",
                      }}
                    />
                    {badge > 0 && (
                      <span style={{
                        position:        "absolute",
                        top:             -5,
                        right:           -6,
                        minWidth:        14,
                        height:          14,
                        borderRadius:    9999,
                        background:      "#ef4444",
                        boxShadow:       "0 0 6px rgba(239,68,68,0.55)",
                        display:         "flex",
                        alignItems:      "center",
                        justifyContent:  "center",
                        fontSize:        8,
                        fontWeight:      700,
                        color:           "#fff",
                        lineHeight:      1,
                        padding:         "0 3px",
                        border:          `1.5px solid ${badgeBorder}`,
                        pointerEvents:   "none",
                      }}>
                        {badge > 99 ? "99+" : badge}
                      </span>
                    )}
                  </motion.div>
                  <span
                    style={{
                      fontSize:      10,
                      lineHeight:    1,
                      fontWeight:    active ? 600 : 400,
                      color:         active ? activeLabelColor : inactiveLabelColor,
                      letterSpacing: active ? "0.04em" : "0.01em",
                      transition:    "color 0.22s ease",
                      whiteSpace:    "nowrap",
                    }}
                  >
                    {tab.label}
                  </span>
                </motion.div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
