import type { Transition, Variants } from "framer-motion";

/** Smooth 300ms ease-out — the master prompt's transition. */
export const ease = [0.16, 1, 0.3, 1] as const;
export const smooth: Transition = { duration: 0.3, ease };

/** Button press: scale 0.95. */
export const press = { scale: 0.95 } as const;

/** Used where a spring reads better than a tween (sheets, toggles, ticks). */
export const spring: Transition = { type: "spring", stiffness: 420, damping: 34, mass: 0.9 };

/**
 * Entrance motion fires on NAVIGATION only (see `navTick` in the store) —
 * never on a data mutation, or the whole screen flashes on every tap.
 */
export const listStagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.04 } },
};

export const listItem: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: smooth },
};
