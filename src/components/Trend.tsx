"use client";

import clsx from "clsx";
import { motion } from "framer-motion";
import type { TrendPoint } from "@/lib/store";

/**
 * TREND — a hand-rolled bar chart, one bar per period, height ∝ that period's
 * finished count. The app's own bar language (flex track + animated fill, same
 * easing as the "Share of the work" rows), scaled down.
 *
 * Two modes: a labelled timeline (`showLabels`) where each bar is named — weeks
 * by date, months by name — so the chart reads as a real axis and not decoration;
 * and a bare sparkline (the default) for the tight person cards. The current
 * period is always lit; in a labelled chart its name goes bold, and the first
 * bar can be flagged as where the household started.
 */
export function Trend({
  points,
  height = 48,
  unit = "Week",
  showLabels = false,
  markStart = false,
  className,
  barClass = "bg-ink/25",
  trackClass = "bg-ink/[.07]",
  currentClass = "bg-lemon",
}: {
  points: TrendPoint[];
  height?: number;
  /** How to name a bar when `showLabels` is on. */
  unit?: "Week" | "Month";
  showLabels?: boolean;
  /** Flag the first bar as the start ("Jan · start"). */
  markStart?: boolean;
  className?: string;
  barClass?: string;
  trackClass?: string;
  /** Fill for the current (rightmost) period — lime by default. */
  currentClass?: string;
}) {
  const max = Math.max(1, ...points.map((p) => p.done));
  const mon = (d: Date) => d.toLocaleDateString("en-GB", { month: "short" });

  const labelFor = (p: TrendPoint, i: number) => {
    if (unit === "Month") return mon(p.from);
    // A week is named by its Monday's date; the month is spelled out only when it
    // changes, so a run of weeks reads like a calendar axis, not a wall of months.
    const day = p.from.getDate();
    const newMonth = i === 0 || p.from.getMonth() !== points[i - 1].from.getMonth();
    return newMonth ? `${mon(p.from)} ${day}` : `${day}`;
  };

  return (
    <div className={clsx("flex items-end gap-1.5", className)} aria-hidden>
      {points.map((p, i) => {
        const isCurrent = i === points.length - 1;
        const isStart = markStart && i === 0;
        return (
          <div key={i} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
            <div className="relative w-full overflow-hidden rounded-[3px]" style={{ height }}>
              <div className={clsx("absolute inset-0 rounded-[3px]", trackClass)} />
              <motion.div
                className={clsx("absolute inset-x-0 bottom-0 rounded-[3px]", isCurrent ? currentClass : barClass)}
                initial={{ height: 0 }}
                animate={{ height: `${Math.round((p.done / max) * 100)}%` }}
                transition={{ duration: 0.6, ease: [0.2, 0.7, 0.2, 1], delay: i * 0.03 }}
              />
            </div>
            {showLabels && (
              <span
                className={clsx(
                  "max-w-full truncate text-[10px] leading-none tabular-nums",
                  isCurrent ? "font-semibold text-ink" : "text-sub",
                )}
              >
                {labelFor(p, i)}
                {isStart && <span className="ml-1 text-[8px] uppercase tracking-wide text-ink/45">start</span>}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
