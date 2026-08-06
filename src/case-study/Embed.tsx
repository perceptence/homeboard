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
  useEffect(() => setMounted(true), []);
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
    <div className="grid gap-tile lg:grid-cols-[minmax(0,1fr)_320px] lg:items-stretch">
      {/* THE DEVICE, unboxed. No fill, no ring, no rounded container — the
          hardware already has an edge of its own, and wrapping a drawn device in
          a second frame gives the eye two competing borders to read. It sits
          straight on the page with room around it.

          The host box is still what the frame MEASURES: it fills the grid row
          and the device scales down to fit. Nothing here measures the device to
          size the row, which is what keeps it from feeding back. */}
      <div className="relative min-h-[520px] overflow-hidden py-tile">
        <span className="absolute left-4 top-4 z-20 flex items-center gap-2 rounded-pill bg-lemon px-3 py-1.5 font-mono text-micro font-bold uppercase tracking-[0.12em] text-ink">
          <span className="h-1.5 w-1.5 rounded-pill bg-ink" />
          Live — the real app
        </span>

        <div ref={host} className="flex h-full w-full items-center justify-center">
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

      {/* THE JOURNEYS, grouped by SURFACE.
          A flat list of twelve screens made the device appear to change at
          random. Grouping by the surface each one belongs to is the product's
          own thesis made navigable — one household, two lenses — and it means
          the frame swapping from phone to tablet is something the reader
          chose rather than something that happened to them. Each group's
          per-journey `surface` tag is gone with it: the heading says it once. */}
      <div className="flex flex-col gap-5">
        {SURFACE_GROUPS.map((g) => {
          const items = FEATURED.filter((j) => j.surface === g.surface);
          if (!items.length) return null;
          return (
            <div key={g.surface} className="min-w-0">
              <Label className="!text-white/60">
                {g.title} · {items.length}
              </Label>
              <p className="mt-1 text-micro leading-[16px] text-white/60">{g.note}</p>
              <ul className="mt-2.5 flex flex-col gap-1">
                {items.map((j) => {
                  const on = j.id === journey.id;
                  return (
                    <li key={j.id}>
                      <button
                        onClick={() => setId(j.id)}
                        aria-current={on ? "true" : undefined}
                        className={clsx(
                          "w-full rounded-md px-3 py-2.5 text-left transition-colors",
                          on ? "bg-lemon text-ink" : "text-white/70 hover:bg-white/10 hover:text-white",
                        )}
                      >
                        <span className="block text-bodysm font-medium">{j.label}</span>
                        <span className={clsx("mt-0.5 block text-micro leading-[16px]", on ? "text-ink/75" : "text-white/60")}>
                          {j.blurb}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
