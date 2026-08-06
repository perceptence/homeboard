"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { MotionConfig } from "framer-motion";
import { DeviceFrame } from "@/components/DeviceFrame";
import { Splash } from "@/components/Splash";
import { Toast } from "@/components/ui";
import { useHousehold } from "@/lib/store";
import { FEATURED, journeyById, type Journey } from "@/lib/journeys";
import { Sheets } from "@/surfaces/Sheets";
import { IpadShell } from "@/surfaces/ipad/IpadShell";
import { PhoneShell } from "@/surfaces/phone/PhoneShell";
import { Label } from "./kit";
import { useInView } from "./useInView";

/** The screen the section opens on. A real, populated screen — see below. */
export const DEFAULT_JOURNEY = "today";

/**
 * How the journey list is organised: by the SURFACE each screen lives on.
 *
 * Of the groupings available, this is the one that carries an argument. The
 * demo panel's own groups (Setup / Phone / Owner admin / Live trip / iPad) are
 * a driver's index — useful when you're hunting a screen, meaningless as a
 * reading order, and lopsided here (two of them would hold a single item). By
 * surface, the list says the thing the product is actually about: one
 * household, seen through two lenses, with the same data underneath.
 */
export const SURFACE_GROUPS = [
  {
    surface: "phone" as const,
    title: "On a phone",
    note: "One person's lens — only what's theirs, and what they owe the house.",
  },
  {
    surface: "ipad" as const,
    title: "On the family iPad",
    note: "The shared board. Everyone's day at once, on the wall in the kitchen.",
  },
];

/**
 * THE PRODUCT, RUNNING — inline, not an iframe, not a screenshot.
 *
 * The shells below are the very components the app boots into, mounted in this
 * page's own React tree and reading the same Zustand store. Tapping something in
 * here mutates real state; switching journeys calls the real navigation actions.
 *
 * INLINE over an iframe, deliberately. An iframe would have been the easy way to
 * stop the app fighting a scrolling page — but it costs the thing that makes
 * this section worth building: one tree, one store, one bundle, and a device
 * that can be driven straight from the page's own URL. The app only needed one
 * change to earn its place here, and it was a change worth making anyway —
 * `useFit` can now measure a CONTAINER (ResizeObserver) instead of the window,
 * so the frame fits the box this section gives it rather than the browser.
 *
 * DETERMINISM. Each journey pins its persona before it runs and the shell is
 * keyed by journey id, so every screen mounts from a known state rather than
 * inheriting whatever the last one left behind. The URL carries it too:
 * ?screen=<id> deep-links any journey, which means this page also handed the
 * product a permanent linkable address for each of its screens.
 */
export function Embed() {
  const s = useHousehold();
  /* Opens on Today, not on FEATURED[0] — that's the onboarding flow, and a
     section titled "the product, running" should not land a cold visitor in a
     setup wizard with an empty household. */
  const [id, setId] = useState<string>(DEFAULT_JOURNEY);
  /**
   * The app mounts AFTER hydration, deliberately.
   *
   * Everything the shells render is a function of the local clock and a store
   * that rehydrates from localStorage — a greeting that reads "Good evening"
   * here and "Good afternoon" on a server in another timezone, dates relative
   * to today, a household that may have been edited yesterday. Server-rendering
   * that guarantees a text mismatch; React then throws away the server tree and
   * logs a hydration error. (The app's own entry route has this today — see the
   * note in lib/dates.ts about the local clock. This page doesn't inherit it.)
   *
   * The splash covers the gap, which is what it was built for.
   */
  const [mounted, setMounted] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  /* once:false — this shell UNMOUNTS when you scroll well away from it, and the
     journey re-runs deterministically when you come back. That is what keeps
     the page from holding three live applications at the same time, which is
     enough to stop the browser painting. */
  const near = useInView(root, { once: false, rootMargin: "800px" });
  useEffect(() => { setMounted(near); }, [near]);
  const host = useRef<HTMLDivElement>(null);
  const journey: Journey = journeyById(id) ?? journeyById(DEFAULT_JOURNEY) ?? FEATURED[0];

  /* Boot the store the same way the app's own entry does: rehydrate after React
     has hydrated (rehydrating on module load races SSR), then run the reminder
     clock so live-trip journeys actually tick. */
  useEffect(() => {
    useHousehold.persist.rehydrate();
    const t = setInterval(() => useHousehold.getState().tick(), 1000);
    return () => clearInterval(t);
  }, []);

  /* Deep link in: ?screen=<id> on a cold load. */
  useEffect(() => {
    const want = new URLSearchParams(window.location.search).get("screen");
    if (want && journeyById(want)) setId(want);
  }, []);

  /* Drive the app through its OWN state machine, then mirror it into the URL so
     the address bar always names what you're looking at. replaceState, not push:
     flipping between screens shouldn't fill the back button with history. */
  useEffect(() => {
    const j = journeyById(id);
    if (!j) return;
    useHousehold.getState().setPersona(j.persona);
    j.run();
    const url = new URL(window.location.href);
    url.searchParams.set("screen", j.id);
    window.history.replaceState(null, "", url);
  }, [id]);

  const clearToast = useCallback(() => useHousehold.getState().notify(null), []);
  const isPhone = journey.surface === "phone";

  return (
    <div ref={root}>
      {/* THE CHOOSER, ABOVE THE STAGE.
          It used to be a column beside the device, which put a tall list of
          text next to a tall picture and left both fighting for the same
          vertical rhythm — nothing aligned to anything. Chips across the top
          have one baseline, one row per surface, and they leave the device the
          full width underneath. */}
      {SURFACE_GROUPS.map((g) => {
        const items = FEATURED.filter((j) => j.surface === g.surface);
        if (!items.length) return null;
        return (
          <div key={g.surface} className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-baseline sm:gap-4">
            <div className="shrink-0 sm:w-[164px]">
              <Label className="!text-white/60">{g.title}</Label>
            </div>
            <ul className="flex min-w-0 flex-wrap gap-1.5">
              {items.map((j) => {
                const on = j.id === journey.id;
                return (
                  <li key={j.id}>
                    <button
                      onClick={() => setId(j.id)}
                      aria-current={on ? "true" : undefined}
                      className={clsx(
                        "rounded-pill px-3.5 py-2 text-bodysm font-medium transition-colors",
                        on
                          ? "bg-lemon text-ink"
                          : "bg-white/[.07] text-white/70 hover:bg-white/[.14] hover:text-white",
                      )}
                    >
                      {j.label}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}

      {/* THE STAGE.
          A LIGHT surface under the device, and specifically the product's own
          `bg-room` gradient. A near-black phone on a near-black page over a
          near-black app background was three blacks in a stack: the hardware
          had no silhouette and the whole section read as a smudge. The device
          now sits on the same backdrop the app sits on in its own preview,
          which is both the fix and the honest choice of surface. */}
      <div className="overflow-hidden rounded-card bg-room ring-1 ring-inset ring-ink/10">
        <div className="flex items-center justify-between gap-3 px-inner pt-inner">
          <span className="flex items-center gap-2 rounded-pill bg-ink px-3 py-1.5 font-mono text-micro font-bold uppercase tracking-[0.12em] text-lemon">
            <span className="h-1.5 w-1.5 rounded-pill bg-lemon" />
            Live — the real app
          </span>
          <span className="truncate text-micro text-sub">
            {journey.surface === "phone" ? "iPhone 17 Pro · 402 × 874" : "iPad Pro 11\" · 1194 × 834"}
          </span>
        </div>

        <div ref={host} className="flex h-[360px] w-full items-center justify-center px-inner py-tile sm:h-[460px]">
          <MotionConfig reducedMotion="user">
            <DeviceFrame
              kind={isPhone ? "phone" : "tablet"}
              host={host}
              orientation={isPhone ? undefined : "landscape"}
            >
              {/* Outside the keyed subtree: the splash is the app opening, and it
                  should do that once on arrival — not again every time you pick a
                  different screen. */}
              <Splash />
              {mounted && (
                <div key={journey.id} className="absolute inset-0">
                  {isPhone ? <PhoneShell /> : <IpadShell />}
                  <Sheets variant={isPhone ? "phone" : "ipad"} />
                </div>
              )}
              <Toast
                message={s.toast}
                who={s.toastWho ? s.members[s.toastWho] : undefined}
                onDone={clearToast}
                onUndo={s.toastUndo ?? undefined}
              />
            </DeviceFrame>
          </MotionConfig>
        </div>
      </div>

      {/* The active journey's one line, under the stage — so the caption sits
          with the thing it captions instead of in a list somewhere else. */}
      <p className="mt-3 text-bodysm text-white/60">
        <span className="font-medium text-white">{journey.label}</span> — {journey.blurb}
      </p>
    </div>
  );
}
