"use client";

import { useEffect, useRef, useState } from "react";
import { animate, useReducedMotion } from "framer-motion";
import { easeOut } from "@/lib/tokens";
import { JOURNEYS } from "@/lib/journeys";
import { REPO } from "./facts.generated";
import { MODULES, PHASES, SCREEN_COUNT, SURFACES } from "./product-scope";
import { useInView } from "./useInView";

/**
 * PRODUCT AT A GLANCE.
 *
 * Six figures, and not one of them is about the codebase. This section used to
 * open with commits, lines of TypeScript and test files — all true, all
 * measured, and all answering a question nobody asked. Effort is not scope. A
 * reader deciding whether this is serious product work needs to know what the
 * product IS: how many complete paths run through it, how many domains it
 * covers, how much of it is one system rather than several, and how much of the
 * work was mine.
 *
 * The honesty stayed. Every number below is still derived from the thing it
 * describes — journeys from the journey table, screens from the route unions,
 * components from the filesystem, modules and phases from a declared list the
 * compiler type-checks against the app's own screens. None of them is typed in
 * by hand, so none of them can quietly stop being true.
 */

interface Stat {
  n: number;
  label: string;
  note: string;
  /** Shown under the grid when this stat is the one being read. */
  detail?: string;
}

const STATS: Stat[] = [
  {
    n: JOURNEYS.length,
    label: "End-to-end journeys",
    note: "Complete paths a household actually takes — not screens, but whole errands, each one addressable by URL and playable in the embed below.",
  },
  {
    n: SURFACES.length,
    label: "Surfaces, designed apart",
    note: "A shared tablet on the kitchen wall and a private phone. Two applications answering two different questions, not one layout at two widths.",
  },
  {
    n: MODULES.length,
    label: "Core product modules",
    note: "From the day's plan through access control, upkeep and automations — each with its own screens, states, empty cases and rules.",
    detail: MODULES.map((m) => m.name).join(" · "),
  },
  {
    n: REPO.uiComponents,
    label: "Reusable interface components",
    note: "One kit, built once, rendering on both surfaces — which is the thing that stops a two-platform product quietly becoming two products.",
  },
  {
    n: SCREEN_COUNT,
    label: "Screens, every one responsive",
    note: "Phone, tablet portrait and tablet landscape. The board recomposes rather than reflows, and holds its layout inside any frame.",
  },
  {
    n: PHASES.length,
    label: "Phases owned end to end",
    note: "The same person framed the problem, decided what it refuses to do, drew it, built the system and shipped the running thing above.",
    detail: PHASES.join(" → "),
  },
];

/**
 * Count up to the figure, once, when the section arrives.
 *
 * THE FIGURE IS THE DEFAULT; the animation only borrows the display while it
 * plays. Written the obvious way — state starting at 0, counting up on view —
 * it printed 0 in every case where the animation never ran: a tab opened in the
 * background (requestAnimationFrame is frozen there, so Framer never ticks),
 * an IntersectionObserver that hasn't fired yet, and the server-rendered HTML
 * itself. On a page whose entire argument is that its numbers are real, a
 * decorative effect silently replacing them all with zero is the worst
 * available failure. So `null` means "not animating", and null renders the
 * truth.
 *
 * Reduced motion never animates at all, for the same reason it exists: a number
 * ticking upward is decoration.
 */
function useCountUp(target: number, run: boolean) {
  const reduce = useReducedMotion();
  const [shown, setShown] = useState<number | null>(null);

  useEffect(() => {
    if (!run || reduce) return;
    /**
     * Note what is NOT here: `setShown(0)` before starting. The count-up takes
     * the display only from its own first frame, so an animation that never
     * ticks never gets to speak. That matters because `useInView` deliberately
     * returns true when there's no IntersectionObserver — right for mounting
     * content, but it means `run` can be true in an environment where the frame
     * loop is frozen or absent. Claiming the display up front and waiting for a
     * frame that never comes is precisely how all six figures rendered as zero.
     */
    const controls = animate(0, target, {
      duration: 1.1,
      // Spread: the token is `as const`, and Framer's bezier parameter is a
      // mutable 4-tuple. Copying keeps the token immutable where it lives.
      ease: [...easeOut],
      onUpdate: (v) => setShown(Math.round(v)),
      // Hand the number back to the truth rather than leaving the last
      // animated frame standing in for it.
      onComplete: () => setShown(null),
    });
    return () => {
      controls.stop();
      setShown(null);
    };
  }, [run, target, reduce]);

  return shown ?? target;
}

function Figure({ stat, run, i }: { stat: Stat; run: boolean; i: number }) {
  const n = useCountUp(stat.n, run);
  return (
    <div
      className="group relative min-w-0 pt-5"
      style={{ transitionDelay: `${i * 60}ms` }}
    >
      {/* The rule is the whole frame — no card, no box. It draws itself in from
          the left as the section arrives, and takes the accent on hover, which
          is the only thing that moves. */}
      <span
        aria-hidden
        className={[
          "absolute inset-x-0 top-0 h-px origin-left bg-white/20 transition-[transform,background-color] duration-700 ease-out",
          "group-hover:bg-lemon",
          run ? "scale-x-100" : "scale-x-0",
        ].join(" ")}
        style={{ transitionDelay: `${i * 70}ms` }}
      />

      <p className="font-tight text-[clamp(34px,4.6vw,52px)] leading-none tracking-tight text-white tabular-nums transition-transform duration-500 ease-out group-hover:-translate-y-0.5">
        {n}
      </p>
      <p className="mt-3 text-body font-medium leading-snug text-white">{stat.label}</p>
      <p className="mt-2 max-w-[42ch] text-caption leading-relaxed text-white/60 transition-colors duration-500 group-hover:text-white/75">
        {stat.note}
      </p>

      {stat.detail && (
        <p className="mt-3 font-mono text-micro leading-relaxed text-white/40 transition-colors duration-500 group-hover:text-lemon">
          {stat.detail}
        </p>
      )}
    </div>
  );
}

export function Scope() {
  const root = useRef<HTMLDivElement>(null);
  /* A generous margin on purpose: the count has to START below the fold. Fire
     it as the grid arrives and the true figures are already painted, so they
     visibly drop to zero before counting back up — which looks like a bug. */
  const run = useInView(root, { once: true, rootMargin: "160px" });

  return (
    <div ref={root} className="mt-12 grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
      {STATS.map((s, i) => (
        <Figure key={s.label} stat={s} run={run} i={i} />
      ))}
    </div>
  );
}
