"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { MotionConfig } from "framer-motion";
import { DeviceFrame } from "@/components/DeviceFrame";
import { Splash } from "@/components/Splash";
import { Toast } from "@/components/ui";
import { useHousehold } from "@/lib/store";
import type { IpadRoute, MemberId, PhoneRoute } from "@/lib/types";
import { FEATURED, journeyById, type Journey } from "@/lib/journeys";
import { Sheets } from "@/surfaces/Sheets";
import { IpadShell } from "@/surfaces/ipad/IpadShell";
import { PhoneShell } from "@/surfaces/phone/PhoneShell";
import { useInView } from "./useInView";

/** The screens the section opens on — real, populated, one per surface. */
export const DEFAULT_JOURNEY = "today";
export const DEFAULT_BOARD = "ipad-today";

/**
 * The two surfaces, named. Each device carries its own controls, so a group's
 * heading sits directly above the journeys that steer it.
 */
export const SURFACE_GROUPS = [
  {
    surface: "ipad" as const,
    title: "The family iPad",
    note: "The shared board — everyone's day at once, on the kitchen wall.",
  },
  {
    surface: "phone" as const,
    title: "A phone",
    note: "One person's lens — what's theirs, and what they owe the house.",
  },
];

/**
 * THE PRODUCT, RUNNING — both surfaces, inline, side by side.
 *
 * These are the shells the app boots into, mounted in this page's React tree
 * and reading the same Zustand store. Tapping in one mutates real state and the
 * other answers, because there is only one of them underneath.
 *
 * WHY THIS CAN'T USE `journey.run()`. That helper jumps the WHOLE preview —
 * persona included — which is exactly right for the demo panel's one-device-at-
 * a-time view and exactly wrong here: an iPad journey sets the persona to
 * "ipad", and `PhoneShell` reads `currentMember`, so choosing a board screen
 * would have yanked the phone over to the household owner mid-sentence. So the
 * table declares its destination (`surface` / `route` / `sheet`) and this
 * component applies only the parts belonging to the device it is steering. The
 * board never touches the persona at all — `IpadShell` doesn't read one,
 * because the board belongs to the room rather than to a person.
 *
 * ONE SHEET, TWO DEVICES. The store holds a single open sheet, so a naive
 * render would paint the New-task composer inside BOTH frames at once. The
 * device that last acted — by journey or by your own tap — owns the sheet layer
 * and the toast; the other renders neither.
 */
export function Embed() {
  const s = useHousehold();

  const [phoneId, setPhoneId] = useState(DEFAULT_JOURNEY);
  const [boardId, setBoardId] = useState(DEFAULT_BOARD);
  /** Which device the sheet layer and toast belong to right now. */
  const [active, setActive] = useState<"phone" | "ipad">("phone");
  const activeRef = useRef<"phone" | "ipad">("phone");
  const own = useCallback((side: "phone" | "ipad") => {
    activeRef.current = side;
    setActive(side);
  }, []);

  const phoneHost = useRef<HTMLDivElement>(null);
  const padHost = useRef<HTMLDivElement>(null);

  const phoneJourney = journeyById(phoneId) ?? journeyById(DEFAULT_JOURNEY)!;
  const boardJourney = journeyById(boardId) ?? journeyById(DEFAULT_BOARD)!;

  /* Mounted only while near the viewport — several live app shells on one
     document is enough to stop the browser compositing (see useInView). */
  const root = useRef<HTMLDivElement>(null);
  const near = useInView(root, { once: false, rootMargin: "800px" });
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(near); }, [near]);

  /* Boot the store the way the app's own entry does: rehydrate after React has
     hydrated (on module load it races SSR), then run the reminder clock so the
     live-trip journey actually ticks. */
  useEffect(() => {
    useHousehold.persist.rehydrate();
    const t = setInterval(() => useHousehold.getState().tick(), 1000);
    return () => clearInterval(t);
  }, []);

  const applyPhone = useCallback((j: Journey) => {
    const g0 = useHousehold.getState();
    // Be in the seeded household before pointing the persona at maya/sam/leo.
    if (!g0.setupComplete || !g0.members.maya) g0.skipOnboarding();
    const g = useHousehold.getState();
    g.setPersona(j.persona === "ipad" ? "maya" : (j.persona as MemberId));
    g.goPhone(j.route as PhoneRoute);
    if (j.sheet) { own("phone"); g.openSheet({ type: j.sheet } as never); }
    // Only close what THIS device opened — otherwise picking a board screen
    // would slam shut a composer the phone had just been asked to show.
    else if (activeRef.current === "phone") g.closeSheet();
    j.extra?.();
    own("phone");
  }, [own]);

  const applyBoard = useCallback((j: Journey) => {
    const g = useHousehold.getState();
    g.goIpad(j.route as IpadRoute); // deliberately no setPersona — see above
    if (j.sheet) { own("ipad"); g.openSheet({ type: j.sheet } as never); }
    else if (activeRef.current === "ipad") g.closeSheet();
    own("ipad");
  }, [own]);

  /* Deep links in, on a cold load: ?screen= steers the phone, ?board= the iPad. */
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const wantPhone = q.get("screen");
    const wantBoard = q.get("board");
    if (wantPhone && journeyById(wantPhone)?.surface === "phone") setPhoneId(wantPhone);
    if (wantBoard && journeyById(wantBoard)?.surface === "ipad") setBoardId(wantBoard);
  }, []);

  /* Drive each device through the app's own actions, and mirror both into the
     URL so the address bar always names what's on screen. replaceState, not
     push: flipping screens shouldn't fill the back button. */
  useEffect(() => {
    if (!mounted) return;
    applyPhone(phoneJourney);
    const url = new URL(window.location.href);
    url.searchParams.set("screen", phoneJourney.id);
    window.history.replaceState(null, "", url);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phoneId, mounted]);

  useEffect(() => {
    if (!mounted) return;
    applyBoard(boardJourney);
    const url = new URL(window.location.href);
    url.searchParams.set("board", boardJourney.id);
    window.history.replaceState(null, "", url);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardId, mounted]);

  const clearToast = useCallback(() => useHousehold.getState().notify(null), []);

  /**
   * A device column: heading, its own journey chips, then the hardware.
   *
   * Declared OUTSIDE the render body would be tidier, but it needs a dozen
   * values from this scope; what matters is that it isn't a component — it's
   * called as `{column("ipad")}`, so React sees plain elements and never
   * remounts a live app shell just because a sibling's state changed.
   */
  const column = (side: "phone" | "ipad", height: string) => {
    const group = SURFACE_GROUPS.find((g) => g.surface === side)!;
    const items = FEATURED.filter((j) => j.surface === side);
    const current = side === "phone" ? phoneJourney : boardJourney;
    const choose = side === "phone" ? setPhoneId : setBoardId;
    const host = side === "phone" ? phoneHost : padHost;

    return (
      <div className="flex min-w-0 flex-col">
        <p className="font-mono text-micro font-bold uppercase tracking-[0.14em] text-ink">
          {group.title}
        </p>
        <p className="mt-1 text-micro leading-[16px] text-sub">{group.note}</p>

        {/* The controls sit with the device they steer — no guessing which list
            drives which screen. Chips styled for the LIGHT stage. */}
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {items.map((j) => {
            const on = j.id === current.id;
            return (
              <li key={j.id}>
                <button
                  onClick={() => choose(j.id)}
                  aria-current={on ? "true" : undefined}
                  className={clsx(
                    "rounded-pill px-3 py-1.5 text-bodysm font-medium transition-colors",
                    on ? "bg-ink text-white" : "bg-white/70 text-ink hover:bg-white",
                  )}
                >
                  {j.label}
                </button>
              </li>
            );
          })}
        </ul>

        {/* One line about whatever is on screen, held to a fixed height so the
            two columns' devices stay on the same baseline. */}
        <p className="mt-2.5 min-h-[32px] text-micro leading-[16px] text-sub">{current.blurb}</p>

        {/* Any tap in here makes this device the owner of the sheet layer. */}
        <div
          ref={host}
          onPointerDownCapture={() => own(side)}
          className={clsx("mt-1 flex w-full items-center justify-center", height)}
        >
          <DeviceFrame
            kind={side === "phone" ? "phone" : "tablet"}
            host={host}
            orientation={side === "phone" ? undefined : "landscape"}
          >
            {/* The splash sits outside the keyed subtree: it's the app opening,
                and it should do that once — not again on every journey. */}
            <Splash />
            {mounted && (
              <div key={current.id} className="absolute inset-0">
                {side === "phone" ? <PhoneShell /> : <IpadShell />}
                {active === side && <Sheets variant={side === "phone" ? "phone" : "ipad"} />}
                {active === side && (
                  <Toast
                    message={s.toast}
                    who={s.toastWho ? s.members[s.toastWho] : undefined}
                    onDone={clearToast}
                    onUndo={s.toastUndo ?? undefined}
                  />
                )}
              </div>
            )}
          </DeviceFrame>
        </div>
      </div>
    );
  };

  return (
    <div ref={root}>
      {/* THE STAGE — the product's own `bg-room` gradient. Near-black devices on
          the near-black page had no silhouette; on the backdrop the app itself
          sits on, the hardware reads as hardware. */}
      <div className="overflow-hidden rounded-card bg-room p-inner ring-1 ring-inset ring-ink/10">
        {/* One badge for the stage, not one per device: both are live, and two
            identical labels would read as decoration rather than a claim. */}
        <div className="mb-inner flex items-center justify-between gap-3">
          <span className="flex items-center gap-2 rounded-pill bg-ink px-3 py-1.5 font-mono text-micro font-bold uppercase tracking-[0.12em] text-lemon">
            <span className="h-1.5 w-1.5 rounded-pill bg-lemon" />
            Live — the real app
          </span>
          <span className="truncate font-mono text-[10px] uppercase tracking-[0.1em] text-sub">
            iPad Pro 11&Prime; · iPhone 17 Pro
          </span>
        </div>
        <MotionConfig reducedMotion="user">
          <div className="grid gap-inner lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] lg:items-start">
            {column("ipad", "h-[300px] sm:h-[380px]")}
            {column("phone", "h-[300px] sm:h-[380px]")}
          </div>
        </MotionConfig>
      </div>

      <p className="mt-3 text-bodysm leading-relaxed text-white/60">
        Both devices are live and read one store — finish something on the phone and the
        board&rsquo;s count moves with it.{" "}
        <span className="text-white/85">
          {s.tasks.filter((t) => !t.done).length} open tasks right now, on both.
        </span>{" "}
        Each screen has a permanent link: the address bar carries{" "}
        <code className="font-mono text-[12px] text-white/75">?screen=</code> for the phone and{" "}
        <code className="font-mono text-[12px] text-white/75">?board=</code> for the iPad.
      </p>
    </div>
  );
}
