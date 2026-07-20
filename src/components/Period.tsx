"use client";

import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import { Icon } from "@/components/Icons";
import { periodLabel, type Period } from "@/lib/dates";
import { press, smooth } from "@/lib/motion";

/**
 * The period lens's controls, shared by both surfaces — the phone's Ahead and
 * the iPad's Ahead hold the same four scopes and step the same way; two copies
 * of this chrome would drift (that's how every hand-rolled trio has gone).
 */

export const SCOPE = ["Week", "Month", "Quarter", "Year"] as const;
export type Scope = Period;

/**
 * The period label, doubling as the scope control.
 *
 * Each option carries its OWN period ("Month · July 2026"), which the old tab
 * row couldn't show — you had to switch to find out what you'd be looking at.
 */
export function ScopePicker({
  scope, anchor, open, setOpen, onPick,
}: {
  scope: Scope; anchor: Date; open: boolean; setOpen: (v: boolean) => void;
  onPick: (s: Scope) => void;
}) {
  return (
    <span className="relative">
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-label="Change period"
        className="flex items-center gap-1 rounded-pill px-1.5 py-1 text-white/45 transition-colors hover:text-white"
      >
        <span className="tabular-nums">{periodLabel(scope, anchor)}</span>
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={smooth} className="flex">
          {/* Same size as the ‹ › steppers — they're all period controls. */}
          <Icon name="chevDown" size={16} />
        </motion.span>
      </button>

      <AnimatePresence>
        {open && (
          <>
            {/* Tap-away. Only mounted while open, so it never eats a stray tap. */}
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.96 }}
              transition={smooth}
              className="absolute left-0 top-full z-50 mt-1 w-max origin-top-left overflow-hidden
                         rounded-[18px] border border-white/15 bg-ink/95 p-1 shadow-e3 backdrop-blur-xl"
            >
              {SCOPE.map((sc) => (
                <button
                  key={sc}
                  onClick={() => { onPick(sc); setOpen(false); }}
                  className={clsx(
                    "flex w-full items-center gap-3 rounded-[14px] px-3 py-2 text-left normal-case tracking-normal transition-colors",
                    sc === scope ? "bg-white text-ink" : "text-white/70 hover:bg-white/10 hover:text-white",
                  )}
                >
                  <span className="text-bodysm font-medium">{sc}</span>
                  <span className={clsx("ml-auto text-caption tabular-nums", sc === scope ? "text-ink/50" : "text-white/35")}>
                    {periodLabel(sc, new Date())}
                  </span>
                </button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </span>
  );
}

/** A period stepper — 44px tap target, hairline chevron. */
export function Step({ dir, onClick }: { dir: -1 | 1; onClick: () => void }) {
  return (
    <motion.button
      whileTap={press}
      onClick={onClick}
      aria-label={dir < 0 ? "Previous" : "Next"}
      className="grid h-touch w-6 shrink-0 place-items-center text-white/40 transition-colors hover:text-white"
    >
      <Icon name={dir < 0 ? "back" : "fwd"} size={16} />
    </motion.button>
  );
}
