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

  /**
   * null = the device is simply sitting on its home screen.
   *
   * These controls are DOINGS, not a segmented control over tabs — each device
   * draws its own nav, a tap away on the screen itself, and duplicating that
   * outside the glass was the mistake this replaced. So nothing is "selected"
   * at rest, and choosing the same doing twice puts the device back down.
   */
  const [phoneId, setPhoneId] = useState<string | null>(null);
  const [boardId, setBoardId] = useState<string | null>(null);
  /** Which device the sheet layer and toast belong to right now. */
  const [active, setActive] = useState<"phone" | "ipad">("phone");
  const activeRef = useRef<"phone" | "ipad">("phone");
  const own = useCallback((side: "phone" | "ipad") => {
    activeRef.current = side;
    setActive(side);
  }, []);

  const phoneHost = useRef<HTMLDivElement>(null);
  const padHost = useRef<HTMLDivElement>(null);

  /** What each device is actually showing — a chosen doing, or its home screen. */
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
    if (phoneId) url.searchParams.set("screen", phoneId);
    else url.searchParams.delete("screen");
    window.history.replaceState(null, "", url);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phoneId, mounted]);

  useEffect(() => {
    if (!mounted) return;
    applyBoard(boardJourney);
    const url = new URL(window.location.href);
    if (boardId) url.searchParams.set("board", boardId);
    else url.searchParams.delete("board");
    window.history.replaceState(null, "", url);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardId, mounted]);

  const clearToast = useCallback(() => useHousehold.getState().notify(null), []);

  /**
   * A device's two blocks — its heading-and-controls, and its hardware.
   *
   * They're returned SEPARATELY, and placed into explicit grid rows below,
   * because the two columns' headings are different heights: let them share a
   * flow and one device starts lower than the other. With headings pinned to
   * row 1 and hardware to row 2, row 1 takes the taller heading and both
   * devices begin on the same line — and since both hosts are given the same
   * height, they end on one too.
   *
   * Not components: called as `{head("ipad")}`, so React sees plain elements
   * and never remounts a live app shell because a sibling's state moved.
   */
  const head = (side: "phone" | "ipad") => {
    const group = SURFACE_GROUPS.find((g) => g.surface === side)!;
    const items = FEATURED.filter((j) => j.surface === side);
    const chosen = side === "phone" ? phoneId : boardId;
    const set = side === "phone" ? setPhoneId : setBoardId;

    return (
      <div
        className={clsx(
          "flex min-w-0 flex-col",
          side === "ipad" ? "lg:col-start-1" : "lg:col-start-2",
          "lg:row-start-1",
        )}
      >
        <p className="font-mono text-micro font-bold uppercase tracking-[0.14em] text-ink">
          {group.title}
        </p>
        <p className="mt-1 text-micro leading-[16px] text-sub">{group.note}</p>

        {/* THINGS TO DO — not a copy of the nav. Each device already draws its
            own tabs; these are the moments worth jumping straight to, and each
            one either opens something or goes somewhere the tabs can't. */}
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {items.map((j) => {
            const on = j.id === chosen;
            return (
              <li key={j.id}>
                <button
                  onClick={() => set(on ? null : j.id)}
                  aria-pressed={on}
                  title={j.blurb}
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

        {/* One line about whatever was chosen — or a reminder that the device's
            own navigation is live, which is the point of not duplicating it. */}
        <p className="mt-2.5 min-h-[32px] text-micro leading-[16px] text-sub">
          {chosen
            ? (side === "phone" ? phoneJourney : boardJourney).blurb
            : "Resting on its home screen — its tabs are live, so you can wander it yourself."}
        </p>
      </div>
    );
  };

  const device = (side: "phone" | "ipad") => {
    const host = side === "phone" ? phoneHost : padHost;
    const current = side === "phone" ? phoneJourney : boardJourney;

    return (
      <div
        ref={host}
        onPointerDownCapture={() => own(side)}
        className={clsx(
          // One height for both, so the two devices share a bottom edge as well
          // as a top one. The columns are sized 3:1 — the ratio of the two
          // frames' widths at equal height — so each is bound by height and
          // fills it, rather than one floating small inside a roomy column.
          "flex h-[380px] w-full items-center justify-center sm:h-[480px] lg:h-[560px]",
          side === "ipad" ? "lg:col-start-1" : "lg:col-start-2",
          "lg:row-start-2",
        )}
      >
        <DeviceFrame
          kind={side === "phone" ? "phone" : "tablet"}
          host={host}
          orientation={side === "phone" ? undefined : "landscape"}
        >
          {/* The splash sits outside the keyed subtree: it's the app opening,
              and it should do that once — not again on every doing. */}
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
          <div className="grid gap-x-inner gap-y-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,1fr)] lg:grid-rows-[auto_auto]">
            {head("ipad")}
            {head("phone")}
            {device("ipad")}
            {device("phone")}
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
