"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import { Icon } from "@/components/Icons";
import { GROUPS, JOURNEYS, type Journey } from "@/lib/journeys";

/**
 * THE JOURNEY PALETTE — preview chrome that doesn't stand on the product.
 *
 * This replaced a fixed panel pinned to the left edge: 168px wide, ~900px tall,
 * open by default, holding all 26 journeys as a scrolling list. Two things were
 * wrong with it, and only one of them was cosmetic.
 *
 * The overlap was structural. `position: fixed` takes the panel out of flow, so
 * DeviceFrame's fitter measured the whole window and centred the device in it —
 * the panel never reserved space, it just covered whatever landed underneath.
 * Measured: 4px of the iPad hidden at 1512, 14px at 1280, 75px at 1100. Narrow
 * the window and the frame grows leftward faster than the panel moves, so the
 * bug got worse exactly when room was tightest. Making the panel a flex column
 * would have fixed it by permanently taxing the device ~180px at every width,
 * which is the wrong trade: the device is the thing being demonstrated.
 *
 * The second problem was that a always-open slab of debug chrome is the first
 * thing seen on the page the case study's own "Open the live app" button points
 * at. A palette is chrome that appears when asked and leaves nothing behind.
 *
 * 26 journeys across 5 groups is also simply past the size where a flat list is
 * the right control — that many items want a search field, not a scrollbar.
 */

/** Flat, in GROUPS order, so keyboard travel matches what the eye reads. */
const ORDERED: Journey[] = GROUPS.flatMap((g) => JOURNEYS.filter((j) => j.group === g));

const matches = (j: Journey, q: string) => {
  if (!q) return true;
  const hay = `${j.label} ${j.group} ${j.blurb}`.toLowerCase();
  return hay.includes(q.toLowerCase());
};

/**
 * `floating` is the onboarding escape hatch, and it is not optional.
 *
 * Onboarding has no skip control of its own — the old left panel was the only
 * way back out of it, and it worked only because a fixed element rendered
 * outside the page's `!onboarding` guard. Move the trigger into the top bar,
 * which onboarding hides, and "+ New home" becomes a one-way door that strands
 * you until you clear localStorage. So the trigger still renders during setup,
 * as a compact pill where the bar would have been — top centre, never the left
 * edge, because the left edge is the thing this component exists to vacate.
 */
export function DemoPalette({ floating = false }: { floating?: boolean }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  /** Where focus came from, so closing puts it back rather than at the top. */
  const openerRef = useRef<HTMLElement | null>(null);

  const results = useMemo(() => ORDERED.filter((j) => matches(j, query)), [query]);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setActive(0);
    openerRef.current?.focus();
  }, []);

  const launch = useCallback((j: Journey) => {
    j.run();
    close();
  }, [close]);

  /* ⌘K / Ctrl+K from anywhere. Registered once, not per-render — and it
     deliberately does NOT fire while a text field has focus elsewhere in the
     app, so typing into the product's own search can't be hijacked. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        openerRef.current = document.activeElement as HTMLElement;
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  /* Keep the highlighted row in view when arrowing past the fold. `block:
     "nearest"` rather than "center": centring yanks the whole list on every
     keypress, which reads as the list moving instead of the selection. */
  useEffect(() => {
    if (!open) return;
    listRef.current
      ?.querySelector<HTMLElement>(`[data-idx="${active}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") { e.preventDefault(); close(); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => Math.min(i + 1, results.length - 1)); return; }
    if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); return; }
    if (e.key === "Enter" && results[active]) { e.preventDefault(); launch(results[active]); }
  };

  return (
    <>
      <button
        onClick={(e) => { openerRef.current = e.currentTarget; setOpen(true); }}
        className={clsx(
          "flex items-center gap-2 rounded-pill text-[13px] font-bold transition-colors",
          floating
            ? "fixed left-1/2 top-3 z-[100] -translate-x-1/2 bg-ink/90 px-3.5 py-2 text-white/70 shadow-e3 backdrop-blur hover:text-white"
            : "px-3.5 py-2 text-white/55 hover:text-white",
        )}
      >
        <Icon name="grid" size={16} strokeWidth={2.2} />
        Journeys
        {/* The shortcut, shown rather than left to be discovered. Hidden on
            touch-ish widths where there's no key to press. */}
        <kbd className="hidden rounded border border-white/20 px-1 font-mono text-[10px] font-normal text-white/40 sm:inline">
          ⌘K
        </kbd>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-[200] flex items-start justify-center px-4 pt-[12vh]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <div
              aria-hidden
              onClick={close}
              className="absolute inset-0 bg-ink/60 backdrop-blur-sm"
            />

            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Jump to a journey"
              onKeyDown={onKeyDown}
              initial={{ opacity: 0, y: -8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.98 }}
              transition={{ duration: 0.18 }}
              className="relative flex max-h-[68vh] w-full max-w-[520px] flex-col overflow-hidden rounded-card bg-ink text-white shadow-e3 ring-1 ring-inset ring-white/12"
            >
              <div className="flex shrink-0 items-center gap-3 border-b border-white/10 px-4">
                <Icon name="search" size={16} className="shrink-0 text-white/40" />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => { setQuery(e.target.value); setActive(0); }}
                  placeholder="Jump to a journey…"
                  aria-label="Search journeys"
                  className="min-w-0 flex-1 bg-transparent py-3.5 text-bodysm text-white placeholder:text-white/35 focus:outline-none"
                />
                <kbd className="shrink-0 rounded border border-white/20 px-1.5 py-0.5 font-mono text-[10px] text-white/40">
                  esc
                </kbd>
              </div>

              <div ref={listRef} className="no-scrollbar min-h-0 flex-1 overflow-y-auto p-2">
                {results.length === 0 && (
                  <p className="px-2 py-6 text-center text-bodysm text-white/45">
                    Nothing matches &ldquo;{query}&rdquo;.
                  </p>
                )}

                {GROUPS.map((g) => {
                  const inGroup = results.filter((j) => j.group === g);
                  if (!inGroup.length) return null;
                  return (
                    <div key={g} className="mb-1">
                      <p className="px-2 pb-1 pt-2 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-white/40">
                        {g}
                      </p>
                      {inGroup.map((j) => {
                        const i = results.indexOf(j);
                        const on = i === active;
                        return (
                          <button
                            key={j.id}
                            data-idx={i}
                            onClick={() => launch(j)}
                            onMouseMove={() => setActive(i)}
                            className={clsx(
                              "flex w-full items-baseline gap-3 rounded-md px-2 py-2 text-left transition-colors",
                              on ? "bg-lemon text-ink" : "text-white/80 hover:bg-white/[.07]",
                            )}
                          >
                            <span className="shrink-0 text-bodysm font-medium">{j.label}</span>
                            <span
                              className={clsx(
                                "min-w-0 flex-1 truncate text-micro",
                                on ? "text-ink/70" : "text-white/40",
                              )}
                            >
                              {j.blurb}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
              </div>

              <div className="flex shrink-0 items-center gap-4 border-t border-white/10 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.1em] text-white/40">
                <span>↑↓ move</span>
                <span>↵ open</span>
                <span className="ml-auto">{results.length} of {ORDERED.length}</span>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
