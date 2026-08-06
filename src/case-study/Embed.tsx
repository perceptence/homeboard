"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import { DeviceFrame } from "@/components/DeviceFrame";
import { Splash } from "@/components/Splash";
import { Avatar, Toast } from "@/components/ui";
import { doers, useHousehold } from "@/lib/store";
import type { IpadRoute, MemberId, PhoneRoute } from "@/lib/types";
import { ROLE_LABEL } from "@/lib/types";
import { FEATURED, journeyById, type Journey } from "@/lib/journeys";
import { Sheets } from "@/surfaces/Sheets";
import { IpadShell } from "@/surfaces/ipad/IpadShell";
import { PhoneShell } from "@/surfaces/phone/PhoneShell";
import { easeOut } from "@/lib/tokens";
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
    title: "A member's phone",
    note: "One lens on the same house — what's theirs, and what they owe it.",
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
    /* Whoever the reader picked stays picked. Only journeys that PIN a person
       override it — handing work over needs someone with too much on, the
       school run needs the parent doing it. Everything else is nicer to browse
       as whoever you're currently being. */
    const declared = j.persona === "ipad" ? "maya" : (j.persona as MemberId);
    const held = g.persona !== "ipad" && g.members[g.persona] ? (g.persona as MemberId) : null;
    g.setPersona(j.pinPersona || !held ? declared : held);
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
   * Each device contributes THREE blocks, placed into explicit grid rows:
   * a title, the hardware, and its controls.
   *
   * The controls sit BELOW the devices for a structural reason. When they were
   * above, the two columns' control blocks were different heights — five phone
   * doings wrap further than four board ones — so the shared row took the
   * taller of the two and left 130 measured pixels of nothing between the iPad's
   * caption and the iPad. Titles are short and near-identical in height, so
   * putting them in the top row costs nothing; the variable-height half now
   * hangs off the bottom, where being uneven is invisible.
   *
   * Not components: called as `{title("ipad")}`, so React sees plain elements
   * and never remounts a live app shell because a sibling's state moved.
   */
  const device = (side: "phone" | "ipad") => {
    const host = side === "phone" ? phoneHost : padHost;
    const current = side === "phone" ? phoneJourney : boardJourney;

    return (
      <div
        ref={host}
        onPointerDownCapture={() => own(side)}
        className={clsx(
          // ONE height for both, so they share a bottom edge as well as a top
          // one, and the columns are sized 3:1 — the ratio of the two frames'
          // widths at equal height — so each is bound by height and fills it.
          // Where the rails leave less room, DeviceFrame falls back to being
          // width-bound and both simply scale together.
          "flex h-[360px] w-full items-center justify-center sm:h-[480px] lg:h-[620px]",
          side === "ipad" ? "col-start-1" : "col-start-2",
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

  /** The person switcher — the phone's, and only the phone's. */
  const people = (align: "start" | "end" | "inline") => (
    <div
      className={clsx(
        "flex flex-wrap items-center gap-1.5",
        align === "end" && "justify-end",
      )}
    >
      {doers(s).map((m) => {
        const on = s.persona === m.id;
        return (
          <button
            key={m.id}
            onClick={() => { own("phone"); useHousehold.getState().setPersona(m.id); }}
            aria-pressed={on}
            title={`${m.name} — ${ROLE_LABEL[m.role]}`}
            className={clsx(
              "flex items-center gap-1.5 rounded-pill py-1 pl-1 pr-2.5 text-micro font-medium transition-colors",
              on ? "bg-ink text-white" : "bg-white/60 text-ink hover:bg-white",
            )}
          >
            <Avatar member={m} size={22} />
            {m.name}
          </button>
        );
      })}
    </div>
  );

  const doingButton = (j: Journey, side: "phone" | "ipad", full = false) => {
    const chosen = side === "phone" ? phoneId : boardId;
    const set = side === "phone" ? setPhoneId : setBoardId;
    const on = j.id === chosen;
    return (
      <button
        key={j.id}
        onClick={() => set(on ? null : j.id)}
        aria-pressed={on}
        title={j.blurb}
        className={clsx(
          /* micro, not bodysm. The scale's next step down is 14 → 12 with
             nothing between, and 12 is what makes the longest label — "Leave
             for the school run", 144px — sit on one line in a rail narrow
             enough to fit the margin. It also settles an inconsistency in the
             band below, where these sat at 14 directly beside the people pills
             at 12. nowrap so a subpixel measurement can never re-break them.

             h-30 is not a magic number: it is the height of a people pill,
             which gets it from a 22px avatar inside py-1. These two kinds of
             pill sit in the same column and the same inline row, so they have
             to agree, and the one carrying a portrait is the one that can't
             give. */
          "inline-flex h-[30px] items-center justify-center whitespace-nowrap rounded-pill px-2 text-micro font-medium transition-colors",
          /* In a rail every pill is stretched to the column, so the labels are
             centred rather than ragged against one edge — the pills themselves
             already form the straight edge the rail needs. */
          full && "w-full",
          on ? "bg-ink text-white" : "bg-white/70 text-ink hover:bg-white",
        )}
      >
        {j.label}
      </button>
    );
  };

  /**
   * A RAIL — a device's label, its doings, and its caption, standing in the
   * margin beside it.
   *
   * This is what the full-bleed backdrop is for. The devices stay centred on
   * the page's own content width; the lavender runs edge to edge past them, and
   * the space that opens either side is exactly where these belong — each group
   * touching the device it steers, and no grid row that has to be as tall as
   * the taller of two unequal stacks. The left rail is right-aligned and the
   * right rail left-aligned, so both hug their hardware.
   *
   * Below 1280 there isn't margin to stand in, and the band underneath takes
   * over instead.
   */
  const rail = (side: "phone" | "ipad") => {
    const group = SURFACE_GROUPS.find((g) => g.surface === side)!;
    const items = FEATURED.filter((j) => j.surface === side);
    const chosen = side === "phone" ? phoneId : boardId;
    const rightHand = side === "phone";

    return (
      <aside
        className={clsx(
          /* Absolutely placed in the bled margin, OUTSIDE the content column,
             so the devices can hold the full content width themselves and these
             still touch the hardware they steer.
             THE WIDTH AND THE BREAKPOINT ARE THE SAME NUMBER. 164 is the widest
             pill — a 144px label plus px-2 either side. The offset is negative
             because `right-full` anchors to this box's BORDER edge while the
             device starts one px-inner (24px) further in; -8 cancels most of
             that back to a 16px gap off the glass itself. The rail's outer edge
             then lands at (vw − 1194) / 2 + 8 − 164, so both rails clear the
             viewport from 1506px up. The gate is 32 above that, which is the
             same 16px of air outside the rail as there is inside it — at 1506
             exactly they'd sit flush against the window. Under the gate, the
             band beneath the stage takes over instead. */
          "absolute top-1/2 hidden w-[164px] -translate-y-1/2 flex-col gap-2 min-[1538px]:flex",
          rightHand ? "left-full -ml-2 items-start text-left" : "right-full -mr-2 items-end text-right",
        )}
      >
        <p className="font-mono text-micro font-bold uppercase tracking-[0.14em] text-ink">
          {group.title}
        </p>
        <p className="text-caption leading-[20px] text-sub">{group.note}</p>

        {side === "phone" && (
          <>
            <p className="mt-2 font-mono text-micro font-bold uppercase tracking-[0.14em] text-sub">
              Viewing as
            </p>
            {people("start")}
          </>
        )}

        <p className="mt-2 font-mono text-micro font-bold uppercase tracking-[0.14em] text-sub">
          Things to do
        </p>
        {/* Each blurb belongs to ONE pill, so it opens under that pill rather
            than at the foot of the stack. Five doings deep, a line at the bottom
            sits four rows from whatever you just pressed and reads as a caption
            for the whole group; here there is nothing left to correlate,
            because the text is already touching its own control. */}
        <div className="flex w-full flex-col gap-1.5">
          {items.map((j) => (
            <div key={j.id} className="w-full">
              {doingButton(j, side, true)}
              <AnimatePresence initial={false}>
                {j.id === chosen && (
                  <motion.div
                    key="blurb"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.24, ease: easeOut }}
                    className="overflow-hidden"
                  >
                    <p className="pt-1.5 text-caption leading-[20px] text-sub">{j.blurb}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>

        {/* Only the resting line stays at the foot: it describes the DEVICE,
            not any one doing, so it has no pill to sit beneath. */}
        <AnimatePresence initial={false}>
          {!chosen && (
            <motion.p
              key="resting"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.24, ease: easeOut }}
              className="overflow-hidden text-caption leading-[20px] text-sub"
            >
              Resting on its home screen — its own tabs are live.
            </motion.p>
          )}
        </AnimatePresence>
      </aside>
    );
  };

  /** The same controls, stacked under the devices, where there's no margin. */
  const controlBand = () => {
    const row = (side: "phone" | "ipad") => {
      const group = SURFACE_GROUPS.find((g) => g.surface === side)!;
      const items = FEATURED.filter((j) => j.surface === side);
      const chosen = side === "phone" ? phoneId : boardId;
      const current = side === "phone" ? phoneJourney : boardJourney;

      return (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-baseline sm:gap-4">
          <p className="shrink-0 pt-1 font-mono text-micro font-bold uppercase tracking-[0.14em] text-ink sm:w-[132px]">
            {group.title}
          </p>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              {side === "phone" && (
                <>
                  {people("inline")}
                  <span aria-hidden className="mx-1 h-5 w-px bg-ink/15" />
                </>
              )}
              {items.map((j) => doingButton(j, side))}
            </div>
            <p className="mt-2 text-caption leading-[20px] text-sub">
              {chosen ? current.blurb : "Resting on its home screen — its own tabs are live."}
            </p>
          </div>
        </div>
      );
    };

    return (
      <div className="mx-auto mt-6 flex w-full max-w-[1194px] flex-col gap-4 border-t border-ink/10 px-inner pt-4 min-[1538px]:hidden">
        {row("ipad")}
        {row("phone")}
      </div>
    );
  };

  return (
    /* reducedMotion="user" — the rail's blurbs open with a height animation, and
       someone who has asked their OS for less motion should get the text without
       the travel. The page claims this setting in its accessibility section;
       this is where the embed actually honours it. */
    <MotionConfig reducedMotion="user">
      <div ref={root}>
        {/* THE STAGE, EDGE TO EDGE.
            Every other section on this page holds one content width; this one
            deliberately breaks it, and the exception buys something specific.
            Running the product's own `bg-room` gradient past the text column
            opens a margin either side of the centred devices — and that margin is
            where each device's controls stand, touching the hardware they steer.
            Boxed to the text width there was nowhere for them to go but above or
            below, and either way one column ended up as tall as the other's
            taller stack. (The page's text is still governed by the single width:
            this stage simply isn't text.) */}
        <div className="bg-room py-inner ring-1 ring-inset ring-ink/10">
          {/* One badge for the stage, not one per device: both are live, and two
              identical labels would read as decoration rather than a claim. Held
              to the page's text width so it lines up with the heading above it,
              even though the lavender behind it doesn't. */}
          <div className="mx-auto mb-inner flex w-full max-w-[1194px] items-center justify-between gap-3 px-inner">
            <span className="flex items-center gap-2 rounded-pill bg-ink px-3 py-1.5 font-mono text-micro font-bold uppercase tracking-[0.12em] text-lemon">
              <span className="h-1.5 w-1.5 rounded-pill bg-lemon" />
              Live — the real app
            </span>
            <span className="truncate font-mono text-micro uppercase tracking-[0.1em] text-sub">
              iPad Pro 11&Prime; · iPhone 17 Pro
            </span>
          </div>

          {/* The devices hold the page's own content width — the iPad's left edge
              on the text column's left edge, the phone's right edge on its right.
              At that width the two frames are 842 and 280 across at a shared 595
              tall, which is the 3:1 column ratio below: each is bound by WIDTH and
              fills its column exactly, so the alignment is arithmetic rather than
              eyeballed. The rails hang off this box into the bled margin. */}
          <div className="relative mx-auto w-full max-w-[1194px] px-inner">
            {rail("ipad")}
            <div className="grid min-w-0 grid-cols-[minmax(0,3fr)_minmax(0,1fr)] gap-inner">
              {device("ipad")}
              {device("phone")}
            </div>
            {rail("phone")}
          </div>

          {controlBand()}
        </div>

        <div className="mx-auto mt-3 w-full max-w-[1194px] px-inner">
          <p className="text-bodysm leading-relaxed text-white/60">
            Both devices are live and read one store — finish something on the phone and the
            board&rsquo;s count moves with it.{" "}
            <span className="text-white/85">
              {s.tasks.filter((t) => !t.done).length} open tasks right now, on both.
            </span>{" "}
            Each screen has a permanent link: the address bar carries{" "}
            <code className="font-mono text-micro text-white/75">?screen=</code> for the phone and{" "}
            <code className="font-mono text-micro text-white/75">?board=</code> for the iPad.
          </p>
        </div>
      </div>
    </MotionConfig>
  );
}
