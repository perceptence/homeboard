"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Icon, type IconName } from "@/components/Icons";
import { clockLabel } from "@/lib/dates";
import { useHousehold } from "@/lib/store";

/**
 * Real device geometry, in logical points.
 * The app is laid out at TRUE device size and the whole frame is then scaled to
 * fit the browser window — so the UI always sees the real viewport it will ship
 * into, rather than being squeezed by whatever window happens to be open.
 *
 * BOTH frames live in this file, on the SAME technique: logical-size box,
 * padding bezel, `transform: scale()` capped at 1, snapped to the device pixel
 * grid by useFit. There used to be a separate PhoneFrame component with its own
 * fitting strategy; it was removed after a long sub-pixel rendering saga (see
 * DESIGN.md, "the hairline"). One pattern, one place, no drift.
 */
export const DEVICES = {
  /** iPhone 17 Pro.
   *  `lip` grows the bezel INWARD: the outer footprint (w + bezel*2) must not
   *  move, so the extra 0.2 is taken from the screen opening on every side —
   *  the opening shrinks and clips the app's edge pixels under the bezel,
   *  exactly like real cover glass. The app still lays out at the true
   *  402×874; nothing about the viewport or the scale math changes. */
  phone: { w: 402, h: 874, bezel: 9, lip: 0.2, radius: 55, screenRadius: 46 },
  /** iPad Pro 11" (M5), landscape */
  tablet: { w: 1194, h: 834, bezel: 16, radius: 38, screenRadius: 22 },
} as const;

export type DeviceKind = keyof typeof DEVICES;

/** Height of the phone's status bar. The phone app pads its top by this. */
export const SAFE_TOP = 48;

/**
 * Fit an outer footprint into the window (capped at 1 — chrome is never blown up
 * past its logical size, only shrunk) AND land its painted edges on WHOLE DEVICE
 * PIXELS.
 *
 * THE HAIRLINE. A scaled box's edges land wherever the scale puts them. At, say,
 * y=172.664 the browser can't paint two thirds of a pixel, so it paints a blend
 * row — and where the frame's near-black meets the light page, that row reads as a
 * bright line along the straight top edge, stopping where the corners curve (a
 * curve spreads its antialiasing over many pixels; a straight edge concentrates it
 * into one hard row). The drop shadow is offset downward, which darkens the bottom
 * edge and hides the same effect there — so the top was the only edge exposed.
 *
 * Two things are needed, and BOTH: an integral size that starts on a fraction is
 * still fractional at the far end.
 *   1. `gw`/`gh` — CSS lengths chosen so `length x scale` is a whole number of
 *      device pixels. Width/height resolve at 1/64px, fine enough to hit any
 *      device pixel. (Do NOT try this with `border-width`: the browser quantises
 *      border widths in CSS space — 8.88px silently became 8.5px.)
 *   2. `dx`/`dy` — a sub-pixel nudge, since flex-centring lands the box on a half
 *      pixel about half the time. Measured, and ACCUMULATED onto the current
 *      nudge: the measurement already includes it. Converges in one pass and
 *      self-terminates (once snapped the correction is 0, the state object is
 *      returned unchanged, and React bails out of the re-render).
 *
 * The measurement MUST be a layout effect, not a rAF: a rAF nested in the sizing
 * rAF races React's commit and measures the PREVIOUS geometry, so the nudge lands
 * a correction for a size that no longer exists and the edge stays fractional.
 * Layout effects run post-commit, pre-paint, with layout settled.
 *
 * Only the OUTER edge needs this — it's the only place a near-black meets a bright
 * colour. The bezel's inner edge stays fractional and is invisible: near-black on
 * both sides.
 */
function useFit(
  ref: React.RefObject<HTMLDivElement | null>,
  outerW: number,
  outerH: number,
  chromeGap: number,
  /**
   * Where the available room comes from.
   *
   * The preview page owns the whole viewport, so it measures the WINDOW. The
   * case study embeds the same frame inside a scrolling article, where the
   * window is the wrong question entirely — the device has to fit the box it
   * was given, and that box changes size without the window ever resizing
   * (the article reflows, a section above it grows). Passing a host element
   * switches the measurement to that element and watches it with a
   * ResizeObserver instead of a window listener.
   *
   * Measured with clientWidth/clientHeight, not getBoundingClientRect: the
   * host contains a `transform: scale()` child, and rects report post-transform
   * geometry. Feeding a scaled number back into the scale is how you get a box
   * that shrinks a little more on every pass and never settles.
   */
  host?: React.RefObject<HTMLElement | null>,
) {
  const [box, setBox] = useState({ s: 1, gw: outerW, gh: outerH, tick: 0 });
  const [nudge, setNudge] = useState({ dx: 0, dy: 0 });
  const raf = useRef(0);

  useEffect(() => {
    const apply = () => {
      const dpr = window.devicePixelRatio || 1;
      const el = host?.current;
      const availW = el ? el.clientWidth : window.innerWidth - 48;
      const availH = el ? el.clientHeight : window.innerHeight - chromeGap;
      if (availW <= 0 || availH <= 0) return; // not laid out yet
      const s = Math.max(0.05, Math.min(1, availW / outerW, availH / outerH));
      /** The nearest CSS length that is a whole number of device pixels once scaled. */
      const grid = (v: number) => Math.round(v * s * dpr) / (s * dpr);
      // `tick` forces the layout effect below to re-measure even when the window
      // resizes without changing the scale — the box still MOVES when centred.
      setBox((b) => ({ s, gw: grid(outerW), gh: grid(outerH), tick: b.tick + 1 }));
    };
    const fit = () => {
      cancelAnimationFrame(raf.current);
      raf.current = requestAnimationFrame(apply);
    };
    fit();

    const el = host?.current;
    if (el) {
      const ro = new ResizeObserver(fit);
      ro.observe(el);
      return () => { ro.disconnect(); cancelAnimationFrame(raf.current); };
    }
    window.addEventListener("resize", fit);
    return () => {
      window.removeEventListener("resize", fit);
      cancelAnimationFrame(raf.current);
    };
  }, [ref, outerW, outerH, chromeGap, host]);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const dpr = window.devicePixelRatio || 1;
    const r = el.getBoundingClientRect();
    const cx = (Math.round(r.left * dpr) - r.left * dpr) / dpr;
    const cy = (Math.round(r.top * dpr) - r.top * dpr) / dpr;
    setNudge((n) =>
      Math.abs(cx) < 0.001 && Math.abs(cy) < 0.001 ? n : { dx: n.dx + cx, dy: n.dy + cy },
    );
  }, [ref, box]);

  return { ...box, ...nudge };
}

export type Orientation = "landscape" | "portrait";

export function DeviceFrame({
  kind, children, chromeGap = 150, orientation = "landscape", host,
}: {
  kind: DeviceKind;
  children: ReactNode;
  chromeGap?: number;
  orientation?: Orientation;
  /** Fit to this element instead of the window — see `useFit`. */
  host?: React.RefObject<HTMLElement | null>;
}) {
  /**
   * BOTH devices centre in the leftover space, on one wrapper.
   *
   * The phone used to get this treatment and the tablet didn't — "a phone
   * floats; the tablet sits" — which reads fine when only one is ever on
   * screen and wrong the moment you switch between them. The two fit to the
   * same height, so sitting one at the top of the column and centring the
   * other put the gap under the preview bar at 8px for the tablet and 37px
   * for the phone: the chrome appeared to jump every time the surface
   * changed. One wrapper, one rule, and the device stays put.
   */
  return (
    <div className="flex min-h-0 w-full flex-1 items-center justify-center">
      {kind === "phone" ? (
        <PhoneChrome chromeGap={chromeGap} host={host}>{children}</PhoneChrome>
      ) : (
        <TabletFrame chromeGap={chromeGap} orientation={orientation} host={host}>{children}</TabletFrame>
      )}
    </div>
  );
}

/* ─────────────────────────────── phone ─────────────────────────────── */

/** Hardware buttons: [side, top, height] in logical px on the frame box. */
const PHONE_BTNS: ["left" | "right", number, number][] = [
  ["left", 159, 34],   // Action button
  ["left", 213, 58],   // Volume up
  ["left", 283, 58],   // Volume down
  ["right", 219, 96],  // Side / power
  ["right", 347, 42],  // Camera Control
];

function PhoneChrome({ children, chromeGap, host }: { children: ReactNode; chromeGap: number; host?: React.RefObject<HTMLElement | null> }) {
  const d = DEVICES.phone;
  const outerW = d.w + d.bezel * 2;
  const outerH = d.h + d.bezel * 2;
  const frame = useRef<HTMLDivElement>(null);
  const { s, gw, gh, dx, dy } = useFit(frame, outerW, outerH, chromeGap, host);

  return (
    // Outer box reserves the *scaled* footprint so the page centres the visual size.
    <div style={{ width: gw * s, height: gh * s }}>
      <div
        ref={frame}
        style={{
          width: gw,
          height: gh,
          borderRadius: d.radius,
          padding: d.bezel,
          transform: `translate(${dx}px, ${dy}px) scale(${s})`,
          transformOrigin: "top left",
        }}
        className="relative select-none bg-[#0b0c09] shadow-[0_40px_80px_rgba(0,0,0,0.6)]"
      >
        {/* Hardware buttons — slivers just past the rail. */}
        {PHONE_BTNS.map(([side, top, h], i) => (
          <span
            key={i}
            aria-hidden="true"
            style={{
              top,
              height: h,
              [side]: -3,
              background: "linear-gradient(90deg, #050604, #16170f 55%, #050604)",
            }}
            className={
              "absolute z-[5] w-[4px] shadow-[0_1px_2px_rgba(0,0,0,0.4)] " +
              (side === "left" ? "rounded-l-[3px]" : "rounded-r-[3px]")
            }
          />
        ))}

        {/* THE OPENING — the screen hole in the bezel, shrunk by `lip` on every
            side so the bezel reads 0.2 thicker WITHOUT the outer footprint
            moving (the caps-lock requirement: the addition goes INSIDE). The
            app canvas below keeps its true 402×874 and is nudged -lip so it
            stays centred; the opening clips its outermost 0.2px under the
            bezel, the way real cover glass overhangs a panel. Radius shrinks
            by the same lip to stay concentric. */}
        <div
          style={{
            width: d.w - d.lip * 2,
            height: d.h - d.lip * 2,
            margin: d.lip,
            borderRadius: d.screenRadius - d.lip,
          }}
          className="relative overflow-hidden bg-ink"
        >
          <div style={{ width: d.w, height: d.h, marginLeft: -d.lip, marginTop: -d.lip }} className="relative">
            {children}
            <PhoneStatus />
            <DynamicIsland />
          </div>
        </div>
      </div>
    </div>
  );
}


/**
 * THE CAMERA DEAD ZONE — where no pixels can be drawn.
 *
 * The physical TrueDepth sensor cutout is a software-merged pill — a FaceID pill
 * on the left, a camera circle on the right. The design-community consensus
 * (Apple publishes no exact figure) is ~52pt wide on the Pro and ~62pt on the
 * Pro Max. Our frame is 402pt wide — that's the iPhone 16/17 **Pro**, not the
 * Max — so the dead zone is 52.
 *
 * This is the answer to "how many dead pixels": ~52 wide × ~37 tall, dead
 * centre, and NOTHING may render inside it. The collapsed state flanks it
 * (leading left, trailing right); the expanded state clears the whole top band
 * and drops its content below the sensor line. Either way the cutout itself is
 * left to the hardware — two faint dots stand in for the sensors.
 */
const DEAD_ZONE = 52;

/**
 * The Dynamic Island — no longer scenery.
 *
 * It was a static black pill drawn for realism. Now it's where reminders land:
 * the pill blooms open (framer layout animation on width/height), speaks, and
 * closes. The hardware IS the notification surface — no card sliding over the
 * app pretending to be iOS.
 *
 * One at a time, self-dismissing after 4.5s; tap dismisses early (it's the
 * expected iOS gesture, and a notification you can't silence is a smoke alarm).
 * The activity feed keeps the record — the island is a mouth, not an inbox.
 */
function DynamicIsland() {
  const rawIsland = useHousehold((s) => s.island);
  const setMode = useHousehold((s) => s.setIslandMode);
  const snooze = useHousehold((s) => s.snoozeIsland);
  const done = useHousehold((s) => s.islandDone);
  const onMyWay = useHousehold((s) => s.islandOnMyWay);
  const arrive = useHousehold((s) => s.arrive);
  const openTarget = useHousehold((s) => s.islandOpen);
  /** Whose phone we're looking at. The island is phone-only, so the persona is
   *  always a member id here. */
  const viewingId = useHousehold((s) => s.persona);

  /**
   * WHOSE PHONE SHOWS THIS.
   *
   * A reminder belongs to the PERSON it nudges — Sam's reminder must not appear
   * on Maya's phone just because the clock fired while we were looking at it.
   * House-level notes (no `who`) show on whoever's phone.
   *
   * A live JOURNEY inverts that: it renders for the AUDIENCE — the people in
   * `waiting`, the ones actually waiting at the far end. The kids watch Dad
   * come; Dad's phone is in Maps, driving. The store still holds the island
   * either way; it's only HIDDEN per-viewer here, not lost.
   */
  const island = rawIsland && (rawIsland.phase === "journey"
    ? !!rawIsland.waiting?.includes(viewingId as string)
    : (!rawIsland.who || rawIsland.who === viewingId))
    ? rawIsland : null;

  /** The live clock — LOCAL to this component, so the countdown ticks without
   *  the store (and therefore the app) re-rendering every second. */
  const [now, setNow] = useState(() => Date.now());
  /**
   * Reset the clock the INSTANT an island with a countdown appears — before
   * paint, via layout effect. `now` was frozen at component mount (app load),
   * minutes before the reminder fires, so the very first frame showed
   * `targetAt − staleNow` = a number several minutes too large (5:22, 6:03…),
   * which then snapped down to the truth (4:59) on the first interval tick. This
   * kills that flash: the stale frame never paints.
   */
  // A reminder counts to `targetAt`; a live journey counts to its `etaAt`. Either
  // one means the clock is live and the layout-effect pre-syncs it before paint.
  const clockTo = island?.targetAt ?? island?.etaAt;
  useLayoutEffect(() => {
    if (clockTo) setNow(Date.now());
  }, [clockTo]);
  useEffect(() => {
    if (!clockTo) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [clockTo]);

  const arrived = !!island?.targetAt && now >= island.targetAt;

  /* ── the live journey ("On my way") ─────────────────────────────────────── */
  const journey = island?.phase === "journey";
  /** "On my way" needs an AUDIENCE, not just a journey: someone in `waiting`
   *  to hear it. A parcel locker doesn't care that you're coming. */
  const offerOnWay = !!island?.journey && !!island?.waiting?.length;
  /** The glyph that stands for the thing — shown instead of the tasked person's
   *  own avatar, which tells them nothing (the notification is already theirs). */
  const glyph: IconName = island?.icon ?? "bell";
  /** Trip progress 0→1, and the ETA as whole minutes ("8 min", "1 min", "Now"). */
  const etaLeft = journey && island?.etaAt ? Math.max(0, island.etaAt - now) : 0;
  const etaMin = Math.ceil(etaLeft / 60_000);
  const etaLabel = journey ? (etaLeft <= 0 ? "Now" : `${etaMin} min`) : null;
  const tripProgress = journey && island?.startAt && island?.etaAt
    ? Math.min(1, Math.max(0, (now - island.startAt) / (island.etaAt - island.startAt)))
    : 0;
  const atDestination = journey && etaLeft <= 0;

  // The moment arrives while collapsed → the island re-opens itself. That's the
  // one time it may interrupt again: the thing it was counting to is HERE — a
  // reminder coming due, or a live trip reaching its destination.
  useEffect(() => {
    if (island?.mode === "collapsed" && (arrived || atDestination)) setMode("expanded");
  }, [arrived, atDestination, island?.mode, setMode]);

  /**
   * AUTO-ARRIVAL. On a real phone the trip ends because the phone ARRIVES —
   * location services, not a button. The ETA landing is our stand-in for that
   * signal: show "Arriving now" for a beat, then the trip completes itself
   * (marks the thing handled, tells the house). No "Arrived" button anywhere.
   */
  useEffect(() => {
    if (!atDestination) return;
    const t = setTimeout(arrive, 1600);
    return () => clearTimeout(t);
  }, [atDestination, arrive]);

  const expanded = island?.mode === "expanded";
  /** Something still live has somewhere to retreat TO — a counting reminder, or a
   *  trip still under way. Collapsed is "still going, out of your way." */
  const canTuck = expanded && (journey ? !atDestination : (!!island?.targetAt && !arrived));

  /** "4:32" → "0:58" → "0:00". Fixed mm:ss once inside the five minutes, so the
   *  numbers hold their width and don't jitter the layout every digit change. */
  const countdown = (() => {
    if (!island?.targetAt) return null;
    const left = Math.max(0, island.targetAt - now);
    const totalSec = Math.floor(left / 1000);
    return `${Math.floor(totalSec / 60)}:${String(totalSec % 60).padStart(2, "0")}`;
  })();

  /* ── drag-up-to-tuck ───────────────────────────────────────────────────
     RAW POINTER EVENTS, not framer's `drag` prop. `drag` writes to the same
     `transform` that `layout` uses to animate width/height/position — the two
     fighting over one CSS property is exactly what drifted this pill onto the
     battery the first time it shipped. Tracking the pointer by hand and only
     ever setting a small `pull` offset on an INNER span sidesteps the conflict
     entirely; the outer button's transform stays layout's alone. */
  const [pull, setPull] = useState(0);
  const dragFrom = useRef<number | null>(null);
  // The commit decision reads THIS, never the `pull` state. Down/move/up can
  // arrive as one rapid native burst — CDP automation proved it, but a fast
  // real thumb does the same — and React may not have re-rendered (so onPointerUp
  // is still the closure from BEFORE the move) by the time pointerup fires. A
  // ref has no closure to go stale; it's written and read as the same value
  // always. `pull` state stays for the animated visual offset alone.
  const pullNow = useRef(0);
  /**
   * THE REAL BUG (found by instrumenting every step, not guessing): completing
   * a swipe fired `setMode("collapsed")` correctly, and it stuck — then the
   * pill was expanded again a moment later. Not a logic error in the drag at
   * all: a `<button>` that receives pointerdown and pointerup on the SAME
   * element fires a native `click` afterward REGARDLESS of how far the pointer
   * moved between them — the browser doesn't know or care that a gesture
   * happened. That click reached `onTap`, which (now reading the freshly
   * re-rendered collapsed state) saw "a tap on a tucked pill" and dutifully
   * re-expanded it. The swipe was undoing itself, one click behind its own
   * gesture. This ref suppresses exactly that one trailing click — nothing else.
   */
  const suppressClick = useRef(false);

  /* ── press-and-hold to expand (collapsed) ──────────────────────────────────
     The real Dynamic Island expands on a LONG PRESS, not a tap — a tap on the
     glass opens the app. Relying on the click event alone was the flake the
     collapsed pill hit (a 120px target under the bezel, and the trailing click
     is the same one the tuck-swipe has to suppress). So the hold is driven off
     the pointer directly: press and wait, and it opens — no click required. */
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressAt = useRef<{ x: number; y: number } | null>(null);
  const clearHold = () => {
    if (holdTimer.current) { clearTimeout(holdTimer.current); holdTimer.current = null; }
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (canTuck) {
      dragFrom.current = e.clientY;
      // Capture can legitimately throw (a pointer that's already gone by the time
      // this runs — a fast tap-and-release, some synthetic/testing dispatches) and
      // it must never take the gesture down with it; the up/cancel handlers don't
      // depend on capture succeeding.
      try { (e.target as HTMLElement).setPointerCapture(e.pointerId); } catch { /* not fatal */ }
      return;
    }
    // Collapsed: arm the long-press. Held ~320ms without wandering → expand.
    if (island && !expanded) {
      pressAt.current = { x: e.clientX, y: e.clientY };
      try { (e.target as HTMLElement).setPointerCapture(e.pointerId); } catch { /* not fatal */ }
      clearHold();
      holdTimer.current = setTimeout(() => {
        // Swallow the click that release will fire, so it doesn't re-toggle.
        suppressClick.current = true;
        pressAt.current = null;
        setMode("expanded");
      }, 320);
    }
  };
  const onPointerMove = (e: React.PointerEvent) => {
    // A wandering finger is not a hold — cancel the long-press if it drifts.
    if (pressAt.current) {
      const dx = Math.abs(e.clientX - pressAt.current.x);
      const dy = Math.abs(e.clientY - pressAt.current.y);
      if (dx > 8 || dy > 8) { clearHold(); pressAt.current = null; }
    }
    if (dragFrom.current === null) return;
    // Elastic: the first 40px of pull follow the finger 1:1, past that it
    // drags through honey — a hint that the gesture has somewhere to land,
    // not a rubber band that snaps you back at the edge of the world.
    const raw = Math.min(0, e.clientY - dragFrom.current);
    const next = raw > -40 ? raw : -40 - (-raw - 40) * 0.25;
    pullNow.current = next;
    setPull(next);
    // Any real movement marks this gesture as a drag, so the click the browser
    // fires on release gets swallowed rather than read as a fresh tap — a
    // lower bar than the -22px COMMIT threshold on purpose: even a cancelled
    // drag (snapped back) was still a drag, not a tap, and must not also act
    // like one.
    if (next < -4) suppressClick.current = true;
  };
  const endDrag = (committed: boolean) => {
    if (dragFrom.current === null) return;
    dragFrom.current = null;
    pullNow.current = 0;
    setPull(0);
    if (committed) setMode("collapsed");
  };
  const onPointerUp = () => { clearHold(); pressAt.current = null; endDrag(pullNow.current < -22); };
  const onPointerCancel = () => { clearHold(); pressAt.current = null; endDrag(false); };

  /** Tap (a SHORT press) does different things by state:
   *   collapsed → open the thing in the app (the long-press is what expands).
   *   expanded body → OPEN the event in the app (the notification's whole point
   *     when the app was closed — take me to the thing). Buttons stopPropagation,
   *     so this only fires on the body. A swipe or a hold sets suppressClick. */
  const onTap = () => {
    if (suppressClick.current) { suppressClick.current = false; return; }
    if (!island) return;
    openTarget();
  };

  return (
    <>
    <motion.div
      layout
      // A DIV, not a button — the expanded state holds its own <button>s (Done,
      // +2 min), and a button inside a button is invalid HTML. The tap-to-expand
      // and swipe-to-tuck live here as handlers instead.
      role={island && !expanded ? "button" : undefined}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onClick={onTap}
      // A touch heavier and a touch less bouncy than a UI spring — Apple's own
      // island moves with real inertia, not a rubber-band snap. mass slows the
      // settle just enough to read as smooth rather than a pop.
      transition={{ type: "spring", stiffness: 340, damping: 34, mass: 1.1 }}
      // Centred by MARGINS (inset-x-0 mx-auto), never transform — framer's
      // `layout` owns transform and drifts the pill onto the battery.
      className={
        "absolute inset-x-0 top-[11px] z-[95] mx-auto overflow-hidden text-left touch-none " +
        (island ? "cursor-default" : "pointer-events-none")
      }
      style={{
        // TRUE BLACK — a real Dynamic Island is the black of the display switched
        // off, seamless with the camera hardware. Lime glow ONLY when expanded.
        background: island ? "#040405" : "#0b0c09",
        // ALWAYS a concrete value, never undefined: framer keeps animating the
        // last box-shadow it was given, so `undefined` after a dismissal left
        // the idle pill wearing the lime glow of the notification it no longer
        // had. "none" actually turns it off.
        boxShadow: !island
          ? "none"
          : expanded
            ? "0 0 0 1px rgba(244,255,122,0.14), 0 0 28px rgba(244,255,122,0.22), 0 22px 55px rgba(0,0,0,0.75)"
            : "0 10px 30px rgba(0,0,0,0.6)",
        // THE PILL'S SMALL FORM IS THE CAMERA HARDWARE — idle AND collapsed. It
        // stays ~120px with the sensors in it and NEVER grows to hold text; the
        // notification's content flanks it as separate elements (below). Only the
        // expanded form (384×118) is a surface the app draws on. This is the fix:
        // the collapsed pill used to swell to 158 and run content across the
        // sensors — pixels that don't exist on a real phone.
        width: !island ? 120 : expanded ? 384 : 120,
        // Taller than before (118 -> 150): the camera hardware keeps the top band
        // to itself now, so ALL content — the title row and the buttons — lives
        // BELOW the sensor line and needs the extra height to breathe. A live
        // journey is SHORTER (128): it carries the route line but no buttons —
        // the audience watches; the trip ends itself.
        height: !island ? 34 : expanded ? (journey ? 128 : 150) : 34,
        borderRadius: !island || !expanded ? 20 : 42,
      }}
    >
      {/* THE CAMERA — two sensor dots, shown whenever the pill is in its small
          hardware form (idle or collapsed). All the pill ever holds in those
          states; the notification draws OUTSIDE it. */}
      {!expanded && (
        <span aria-hidden className="absolute inset-0 flex items-center justify-center gap-1.5">
          <span className="h-2 w-2 rounded-pill bg-white/[.10]" />
          <span className="h-[7px] w-[7px] rounded-pill bg-white/[.06]" />
        </span>
      )}

      <AnimatePresence initial={false}>
        {island && expanded && (
          <motion.div
            key="open"
            // A crossfade, not a cut-then-fade: no `mode="wait"` above, so the
            // outgoing tucked content and this are briefly both in the DOM and
            // dissolve into one another WHILE the box resizes around them.
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, y: pull, transition: { opacity: { duration: 0.22 }, y: { type: "spring", stiffness: 500, damping: 40 } } }}
            exit={{ opacity: 0, transition: { duration: 0.16 } }}
            className="flex h-full flex-col px-5 pb-4"
          >
            {/* THE CAMERA BAND — the hardware owns the top strip and NOTHING else
                does. Content no longer flanks the sensor (leading | camera |
                trailing); it all lives below this line, so the camera cutout sits
                on genuinely empty pixels, the way it does on the glass. The dots
                stand in for the FaceID pill + camera; pt-[13px] lands them at the
                same height the collapsed pill's dots sat, so the expand animation
                doesn't jump them. */}
            <span aria-hidden className="mx-auto flex shrink-0 items-center justify-center gap-1.5 pb-3 pt-[13px]" style={{ width: DEAD_ZONE }}>
              <span className="h-2 w-2 rounded-pill bg-white/[.08]" />
              <span className="h-[7px] w-[7px] rounded-pill bg-white/[.05]" />
            </span>

            {/* CONTENT — everything the app draws, entirely below the sensor line
                and spanning the FULL width. Two shapes: a plain reminder, or a
                LIVE JOURNEY once "On my way" is tapped. */}
            {journey ? (
              /* ── LIVE TRIP — Uber/DoorDash style. Origin (home) → destination,
                    a marker crawling the route, an ETA ticking down. This is what
                    the household watches after Sam taps "On my way". */
              <div className="flex flex-1 flex-col justify-center gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-pill bg-lemon text-ink">
                    <Icon name="nav" size={16} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[16px] font-semibold leading-tight text-white">
                      {atDestination ? "Arriving now" : "On the way"}
                    </span>
                    <span className="block truncate text-[12px] leading-tight text-white/55">
                      {island.title}{island.where ? ` · to ${island.where}` : ""}
                    </span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end">
                    <span className="text-[18px] font-bold leading-none tabular-nums text-lemon">{etaLabel}</span>
                    {!atDestination && <span className="mt-0.5 text-[10px] uppercase tracking-[0.1em] text-white/40">away</span>}
                  </span>
                </div>

                {/* The route. A home dot, the lime path filled to progress, a
                    marker riding the head of it, a pin at the destination. */}
                <div className="flex items-center gap-2">
                  <Icon name="home" size={13} className="shrink-0 text-white/45" />
                  <div className="relative h-[3px] flex-1 rounded-pill bg-white/[.14]">
                    <div className="absolute inset-y-0 left-0 rounded-pill bg-lemon" style={{ width: `${tripProgress * 100}%` }} />
                    <span
                      className="absolute top-1/2 h-[11px] w-[11px] -translate-x-1/2 -translate-y-1/2 rounded-pill bg-lemon ring-2 ring-[#040405]"
                      style={{ left: `${tripProgress * 100}%` }}
                    />
                  </div>
                  <Icon name="pin" size={13} className="shrink-0 text-lemon" />
                </div>

                {/* NO buttons at all. Arrival is the trip's own event (the ETA
                    landing calls arrive() itself — location would, for real).
                    This island belongs to the AUDIENCE — the kids waiting — and
                    a live trip isn't theirs to end: cancelling is the TRAVELER's
                    call, from the task's own card/sheet. Even "Dismiss" earned
                    nothing a swipe-up doesn't already do — tuck it to the pill
                    and the countdown keeps to itself. */}
              </div>
            ) : (
              <div className="flex flex-1 flex-col justify-center gap-3">
                <div className="flex items-center gap-2.5">
                  {/* THE THING'S GLYPH, not the person's face. The notification is
                      already the tasked person's — showing their own avatar back
                      to them says nothing. Lime fill, ink glyph — the same tile
                      grammar as the sheets, at the island's compact 32/16 (the
                      same 1:2 glyph-to-well ratio as the app's 40/20 tiles). */}
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-pill bg-lemon text-ink">
                    <Icon name={glyph} size={16} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[16px] font-semibold leading-tight text-white">{island.title}</span>
                    <span className="block truncate text-[12px] leading-tight text-white/55">
                      {island.held ? "Held during quiet hours"
                        : island.timeLabel ? `at ${clockLabel(island.timeLabel)}`
                        : "Reminder"}
                    </span>
                  </span>

                  {countdown && (
                    <span className="flex shrink-0 flex-col items-end">
                      <span className="text-[18px] font-bold leading-none tabular-nums text-lemon">{countdown}</span>
                      {!arrived && <span className="mt-0.5 text-[10px] uppercase tracking-[0.1em] text-white/40">to go</span>}
                    </span>
                  )}
                </div>

                {/* THE ACTIONS, by category. `stopPropagation` so a button press
                    never reads as a body tap or the start of a tuck swipe.
                    "On my way" shows ONLY for a JOURNEY (pickup, appointment) —
                    it starts the live trip. A thing-at-home (trash, WFH) gets
                    just Done + snooze; offering "On my way" for the bins made no
                    sense. */}
                {/* Every button wears its icon — car (the trip), check (done),
                    bell (+2 min IS "remind me again"). One rule, no stragglers. */}
                <div className="flex gap-1.5">
                  {offerOnWay && (
                    <IslandButton onClick={(e) => { e.stopPropagation(); onMyWay(); }}>
                      <Icon name="car" size={14} /> On my way
                    </IslandButton>
                  )}
                  <IslandButton onClick={(e) => { e.stopPropagation(); done(); }} tone="solid">
                    <Icon name="check" size={14} /> Done
                  </IslandButton>
                  <IslandButton onClick={(e) => { e.stopPropagation(); snooze(2); }}>
                    <Icon name="bell" size={14} /> +2 min
                  </IslandButton>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>

    {/* COLLAPSED FLANKS — the camera pill above is HARDWARE; the app can only
        draw beside it. Leading (the thing's GLYPH — a heading arrow on a live
        trip, otherwise the task icon) sits to its left; trailing (the ETA on a
        trip, else the countdown) to its right, both with a clear gap from the
        sensor. The pill half-covers ±60px from centre, so ±66 lands 6px clear. */}
    <AnimatePresence>
      {island && !expanded && (
        <>
          <motion.div
            key="lead"
            initial={{ opacity: 0, x: 5 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 5 }}
            transition={{ duration: 0.2 }}
            className="pointer-events-none absolute top-[11px] z-[96] flex h-[34px] items-center text-lemon"
            style={{ right: "calc(50% + 66px)" }}
          >
            <Icon name={journey ? "nav" : glyph} size={17} />
          </motion.div>
          <motion.div
            key="trail"
            initial={{ opacity: 0, x: -5 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -5 }}
            transition={{ duration: 0.2 }}
            className="pointer-events-none absolute top-[11px] z-[96] flex h-[34px] items-center"
            style={{ left: "calc(50% + 66px)" }}
          >
            {journey
              ? <span className="text-[13px] font-semibold tabular-nums text-lemon">{etaLabel}</span>
              : countdown && <span className="text-[13px] font-semibold tabular-nums text-lemon">{countdown}</span>}
          </motion.div>
        </>
      )}
    </AnimatePresence>
    </>
  );
}

/** A pill button for the island's action row. Solid = the primary act (Done);
 *  the default subtle fill is the secondary (snooze). Both read on true black. */
function IslandButton({
  onClick, tone = "subtle", children,
}: { onClick: (e: React.MouseEvent) => void; tone?: "solid" | "subtle"; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={
        "flex h-9 flex-1 items-center justify-center gap-1 whitespace-nowrap rounded-pill px-1 text-[12.5px] font-semibold transition-colors " +
        (tone === "solid"
          ? "bg-white/[.16] text-white hover:bg-white/25"
          : "bg-white/[.06] text-white/75 hover:bg-white/[.12] hover:text-white")
      }
    >
      {children}
    </button>
  );
}

/** iOS status bar. 9:41 is Apple's mockup convention.
 *
 *  OPAQUE, and it starts ABOVE the screen's clip edge on purpose. It used to be a
 *  transparent overlay ("an overlay has no seam to leak through") — but that made the
 *  top 48px opaque only if the app's sticky header painted there perfectly, and any
 *  misalignment (scale rasterisation, sticky paint offset, scroll physics) let the
 *  white card scrolled under the header peek out as THE hairline. This band is the
 *  cover: cards cannot paint in the top band at all now.
 *
 *  The 12px upward bleed is load-bearing: it puts the band's top edge outside the
 *  clip, so its only real edge is the BOTTOM — which lands on the header's own ink
 *  (the app reserves SAFE_TOP + 16), ink on ink, invisible at any scale. Overlap,
 *  don't abut. paddingTop = 12 + 14 keeps the glyph row optically where it was
 *  (centred on the island's y=31). */
const BLEED = 12;

function PhoneStatus() {
  return (
    <div
      aria-hidden="true"
      // paddingTop is what CENTRES the row on the island's midline: box spans
      // -12..48, so content centre = 18 + pad/2. The island's centre is 28
      // (top 11 + 34/2) → pad = 20 = BLEED + 8. It shipped at BLEED + 14 and
      // the clock rode 3px below the pill's midline — measured, not eyeballed.
      style={{ top: -BLEED, height: SAFE_TOP + BLEED, paddingTop: BLEED + 8 }}
      className="absolute inset-x-0 z-[90] flex items-center justify-between
                 bg-ink px-8 text-white"
    >
      <span className="text-[14px] font-medium leading-none tracking-[-0.01em] tabular-nums">9:41</span>
      <span className="flex items-center gap-[5px]">
        <SignalBars />
        <WifiGlyph />
        <BatteryGlyph />
      </span>
    </div>
  );
}

/**
 * The glyphs, traced from a real device. Everything is FILLED — no outlines: the
 * battery is a dim slab with a bright charge in it, not a stroked box.
 *
 * They share a height (GLYPH_H); each width follows from its own viewBox, so the row
 * stays aligned by construction. WEIGHT is the bars' width AND the wifi's stroke —
 * Apple draws them at one weight, so one constant drives both.
 */
const GLYPH_H = 11;
const WEIGHT = 3;

/** Four ascending bars. viewBox 17×11. */
function SignalBars() {
  const gap = (17 - 4 * WEIGHT) / 3;
  return (
    <svg height={GLYPH_H} width={GLYPH_H * (17 / 11)} viewBox="0 0 17 11" fill="currentColor">
      {[4.2, 6.8, 8.9, 11].map((bh, i) => (
        <rect key={i} x={i * (WEIGHT + gap)} y={11 - bh} width={WEIGHT} height={bh} rx="1" />
      ))}
    </svg>
  );
}

/**
 * Three arcs — no separate dot. viewBox 17×11, centre (8.5, 11), stroke 3.
 *
 * BUTT caps, not round: a round cap bulges half a stroke PAST the endpoint in every
 * direction, which pushes the inner arc below the box and the outer arc's ends past
 * both sides. Butt caps end flat along the radius, so a 3-wide stroke fits exactly —
 * bands [0,3] · [3.9,6.9] · [7.8,10.8] → radii 1.5 / 5.4 / 9.3, top at 0.2.
 * The innermost band runs to radius 0, so it reads as the dot on its own.
 */
function WifiGlyph() {
  return (
    <svg height={GLYPH_H} width={GLYPH_H * (17 / 11)} viewBox="0 0 17 11">
      <g fill="none" stroke="currentColor" strokeWidth={WEIGHT} strokeLinecap="butt">
        <path d="M7.44 9.94a1.5 1.5 0 0 1 2.12 0" />
        <path d="M4.68 7.18a5.4 5.4 0 0 1 7.64 0" />
        <path d="M1.92 4.42a9.3 9.3 0 0 1 13.15 0" />
      </g>
    </svg>
  );
}

/**
 * viewBox 20×11 — wider than the others, because a battery IS wider than it is tall
 * and squaring it off reads as a box. Body 0→18, nub 18.6→20.
 *
 * The charge runs edge to edge — flush left, top and bottom — and is CLIPPED to the
 * body rather than inset from it, so its left corners round with the slab instead of
 * floating as a smaller pill inside a bigger one. Only the right remainder reads as
 * empty: the fill is the reading.
 */
function BatteryGlyph({ level = 0.68 }: { level?: number }) {
  const body = 18;
  const fill = Math.max(2.4, body * Math.min(1, Math.max(0, level)));
  return (
    <svg height={GLYPH_H} width={GLYPH_H * (20 / 11)} viewBox="0 0 20 11" fill="currentColor">
      <defs>
        <clipPath id="pfbat">
          <rect x="0" y="0" width={body} height="11" rx="3" />
        </clipPath>
      </defs>
      <rect x="0" y="0" width={body} height="11" rx="3" fillOpacity=".35" />
      <rect x="0" y="0" width={fill} height="11" clipPath="url(#pfbat)" />
      <rect x="18.6" y="3.6" width="1.4" height="3.8" rx="0.7" fillOpacity=".35" />
    </svg>
  );
}

/* ─────────────────────────────── tablet ─────────────────────────────── */

function TabletFrame({ children, chromeGap, orientation, host }: { children: ReactNode; chromeGap: number; orientation: Orientation; host?: React.RefObject<HTMLElement | null> }) {
  // Portrait is the SAME device, rotated — derived by swapping w/h off the one
  // landscape entry, not a second DEVICES key that could drift on bezel/radius.
  const base = DEVICES.tablet;
  const d = orientation === "portrait" ? { ...base, w: base.h, h: base.w } : base;
  const outerW = d.w + d.bezel * 2;
  const outerH = d.h + d.bezel * 2;
  const frame = useRef<HTMLDivElement>(null);
  const { s, gw, gh, dx, dy } = useFit(frame, outerW, outerH, chromeGap, host);

  return (
    // Outer box reserves the *scaled* footprint so the page never overflows.
    <div style={{ width: gw * s, height: gh * s }}>
      <div
        ref={frame}
        style={{
          width: gw,
          height: gh,
          borderRadius: d.radius,
          transform: `translate(${dx}px, ${dy}px) scale(${s})`,
          transformOrigin: "top left",
          padding: d.bezel,
        }}
        className="relative select-none bg-[#0b0b0d] shadow-[0_50px_100px_-30px_rgba(20,10,40,.55)]
                   ring-1 ring-inset ring-white/[.09]"
      >
        <div
          style={{ width: d.w, height: d.h, borderRadius: d.screenRadius }}
          // @container: the iPad's own portrait/landscape breakpoints (see
          // tailwind.config.ts) measure THIS box's true CSS width, unaffected
          // by the ancestor's visual scale transform.
          className="relative overflow-hidden bg-ink @container"
        >
          {children}

          {/* Pinhole camera. */}
          <div className="pointer-events-none absolute left-1/2 top-[8px] z-40 h-[4px] w-[4px]
                          -translate-x-1/2 rounded-pill bg-white/20" />

          {/* Home indicator. */}
          <div className="pointer-events-none absolute bottom-[8px] left-1/2 z-40 h-[4px] w-[300px]
                          -translate-x-1/2 rounded-pill bg-white/90 mix-blend-difference" />
        </div>
      </div>
    </div>
  );
}
