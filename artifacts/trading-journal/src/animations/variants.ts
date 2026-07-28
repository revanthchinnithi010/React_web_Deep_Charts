import type { Variants } from "motion/react";

// ─── Timing ──────────────────────────────────────────────────────────────────
// All durations in seconds for Framer Motion
const FAST     = 0.15; // 150ms — quick interactions, exits
const STANDARD = 0.22; // 220ms — standard transitions
const LARGE    = 0.25; // 250ms — large surfaces, page-level

// ─── Easing ──────────────────────────────────────────────────────────────────
// Single easing curve used across every variant — smooth ease-out
export const EASE_PREMIUM = [0.22, 1, 0.36, 1] as const;

// ─── Shared transition builders ───────────────────────────────────────────────
const tweenFast     = { type: "tween", duration: FAST,     ease: EASE_PREMIUM } as const;
const tweenStandard = { type: "tween", duration: STANDARD, ease: EASE_PREMIUM } as const;
const tweenLarge    = { type: "tween", duration: LARGE,    ease: EASE_PREMIUM } as const;

// ─── Backward-compatible spring exports ───────────────────────────────────────
// Kept so existing imports don't break; prefer tween variants below for new use.
export const SPRING_SMOOTH = { type: "spring", stiffness: 180, damping: 24, mass: 0.9 } as const;
export const SPRING_SNAPPY = { type: "spring", stiffness: 220, damping: 18            } as const;
export const SPRING_PANEL  = { type: "spring", stiffness: 140, damping: 22            } as const;
export const SPRING_MODAL  = { type: "spring", stiffness: 160, damping: 20            } as const;

// ─── Variants ─────────────────────────────────────────────────────────────────

/** Bottom navigation bar — slides in from below, no scale or blur. */
export const bottomBarVariants: Variants = {
  hidden: {
    opacity: 0,
    y: 20,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      ...tweenLarge,
      staggerChildren: 0.04,
    },
  },
};

/** Individual items inside the bottom bar — card-style: fade + 6px upward. */
export const barItemVariants: Variants = {
  hidden:  { opacity: 0, y: 6  },
  visible: { opacity: 1, y: 0, transition: tweenStandard },
};

/** Left panel / sidebar drawer — horizontal slide only. */
export const leftPanelVariants: Variants = {
  hidden:  { x: -80, opacity: 0 },
  visible: {
    x: 0,
    opacity: 1,
    transition: tweenLarge,
  },
  exit: {
    x: -80,
    opacity: 0,
    transition: tweenFast,
  },
};

/** Floating mini toolbar — modal-style: fade + slight scale. */
export const miniToolbarVariants: Variants = {
  hidden:  { scale: 0.98, opacity: 0 },
  visible: { scale: 1,    opacity: 1, transition: tweenFast },
  exit:    { scale: 0.98, opacity: 0, transition: tweenFast },
};

/** Stagger list items — card-style: fade + 6px upward. */
export const staggerItemVariants: Variants = {
  hidden:  { opacity: 0, y: 6 },
  visible: { opacity: 1, y: 0, transition: tweenStandard },
};

/** Modal / dialog — fade + scale 0.98 → 1 on enter, reverse on exit. */
export const modalVariants: Variants = {
  hidden:  { opacity: 0, scale: 0.98 },
  visible: { opacity: 1, scale: 1,    transition: tweenStandard },
  exit:    { opacity: 0, scale: 0.98, transition: tweenFast     },
};

/** Backdrop / overlay — fade only. */
export const overlayVariants: Variants = {
  hidden:  { opacity: 0 },
  visible: { opacity: 1, transition: tweenStandard },
  exit:    { opacity: 0, transition: tweenFast     },
};

/** Page / card float-up — fade + 8px vertical slide. */
export const floatUpVariants: Variants = {
  hidden:  { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: tweenStandard },
  exit:    { opacity: 0, y: 8, transition: tweenFast     },
};
