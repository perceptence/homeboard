"use client";

import clsx from "clsx";
import { motion } from "framer-motion";
import type { TrendWeek } from "@/lib/store";

/**
 * TREND — a hand-rolled bar chart, one bar per week, height ∝ that week's
 * finished count. No chart library: it's the app's own bar language (the same
 * flex-track-plus-animated-fill as the "Share of the work" rows, the same
 * easing), scaled down. A faint full-height track keeps a quiet week legible as
 * a bar rather than a gap; the last bar reads as "this week".
 *
 * Theming is by className so it sits on any surface: `barClass`/`trackClass`
 * default to ink-on-light (the lavender household card); pass overrides for a
 * person's colour or a dark card.
 */
export function Trend({
  weeks,
  height = 48,
  barClass = "bg-ink/80",
  trackClass = "bg-ink/[.07]",
  lastBarClass,
  className,
}: {
  weeks: TrendWeek[];
  height?: number;
  barClass?: string;
  trackClass?: string;
  /** Optional accent for the current (rightmost) week. */
  lastBarClass?: string;
  className?: string;
}) {
  const max = Math.max(1, ...weeks.map((w) => w.done));
  return (
    <div className={clsx("flex items-end gap-1.5", className)} style={{ height }} aria-hidden>
      {weeks.map((w, i) => {
        const isLast = i === weeks.length - 1;
        return (
          <div key={i} className={clsx("relative flex-1 overflow-hidden rounded-[3px]", trackClass)} style={{ height }}>
            <motion.div
              className={clsx("absolute inset-x-0 bottom-0 rounded-[3px]", isLast && lastBarClass ? lastBarClass : barClass)}
              initial={{ height: 0 }}
              animate={{ height: `${Math.round((w.done / max) * 100)}%` }}
              transition={{ duration: 0.6, ease: [0.2, 0.7, 0.2, 1], delay: i * 0.03 }}
            />
          </div>
        );
      })}
    </div>
  );
}
