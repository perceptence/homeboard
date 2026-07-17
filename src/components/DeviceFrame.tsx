"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Avatar } from "@/components/ui";
import { Icon } from "@/components/Icons";
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
  /** iPhone 17 Pro */
  phone: { w: 402, h: 874, bezel: 9, radius: 55, screenRadius: 46 },
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
) {
  const [box, setBox] = useState({ s: 1, gw: outerW, gh: outerH, tick: 0 });
  const [nudge, setNudge] = useState({ dx: 0, dy: 0 });
  const raf = useRef(0);

  useEffect(() => {
    const apply = () => {
      const dpr = window.devicePixelRatio || 1;
      const availW = window.innerWidth - 48;
      const availH = window.innerHeight - chromeGap;
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
    window.addEventListener("resize", fit);
    return () => {
      window.removeEventListener("resize", fit);
      cancelAnimationFrame(raf.current);
    };
  }, [ref, outerW, outerH, chromeGap]);

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

export function DeviceFrame({
  kind, children, chromeGap = 150,
}: { kind: DeviceKind; children: ReactNode; chromeGap?: number }) {
  return kind === "phone" ? (
    // Centred in the leftover space — a phone floats; the tablet sits.
    <div className="flex min-h-0 w-full flex-1 items-center justify-center">
      <PhoneChrome chromeGap={chromeGap}>{children}</PhoneChrome>
    </div>
  ) : (
    <TabletFrame chromeGap={chromeGap}>{children}</TabletFrame>
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

function PhoneChrome({ children, chromeGap }: { children: ReactNode; chromeGap: number }) {
  const d = DEVICES.phone;
  const outerW = d.w + d.bezel * 2;
  const outerH = d.h + d.bezel * 2;
  const frame = useRef<HTMLDivElement>(null);
  const { s, gw, gh, dx, dy } = useFit(frame, outerW, outerH, chromeGap);

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

        <div
          style={{ width: d.w, height: d.h, borderRadius: d.screenRadius }}
          className="relative overflow-hidden bg-ink"
        >
          {children}
          <PhoneStatus />
          <DynamicIsland />
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
 * centre, and NOTHING may render inside it. Both island states flank it —
 * leading content to its left, trailing to its right, the band itself left to
 * the hardware (two faint dots stand in for the sensors).
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
  const members = useHousehold((s) => s.members);
  const dismiss = useHousehold((s) => s.dismissIsland);
  const setMode = useHousehold((s) => s.setIslandMode);
  const snooze = useHousehold((s) => s.snoozeIsland);
  /** Whose phone we're looking at. The island is phone-only, so the persona is
   *  always a member id here. */
  const viewingId = useHousehold((s) => s.persona);

  /**
   * A reminder belongs to a PERSON. Sam's reminder is Sam's business — it must
   * not appear on Maya's phone just because the clock fired while we were looking
   * at it. The store still holds the island (fired reminders persist until
   * dismissed), so switching back to Sam brings it right back; it's only HIDDEN
   * here, not lost. House-level notes (no `who`) show on whoever's phone.
   */
  const island = rawIsland && (!rawIsland.who || rawIsland.who === viewingId) ? rawIsland : null;

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
  useLayoutEffect(() => {
    if (island?.targetAt) setNow(Date.now());
  }, [island?.targetAt]);
  useEffect(() => {
    if (!island?.targetAt) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [island?.targetAt]);

  const arrived = !!island?.targetAt && now >= island.targetAt;

  // The moment arrives while collapsed → the island re-opens itself. That's the
  // one time it may interrupt again: the thing it was counting to is HERE.
  useEffect(() => {
    if (island?.mode === "collapsed" && arrived) setMode("expanded");
  }, [arrived, island?.mode, setMode]);

  const who = island?.who ? members[island.who] : undefined;
  const expanded = island?.mode === "expanded";
  /** Only a live, unarrived countdown has anywhere to retreat TO — collapsed
   *  is "still counting, out of your way," not "done, out of your way." */
  const canTuck = expanded && !!island?.targetAt && !arrived;

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

  const onPointerDown = (e: React.PointerEvent) => {
    if (!canTuck) return;
    dragFrom.current = e.clientY;
    // Capture can legitimately throw (a pointer that's already gone by the time
    // this runs — a fast tap-and-release, some synthetic/testing dispatches) and
    // it must never take the gesture down with it; the up/cancel handlers don't
    // depend on capture succeeding.
    try { (e.target as HTMLElement).setPointerCapture(e.pointerId); } catch { /* not fatal */ }
  };
  const onPointerMove = (e: React.PointerEvent) => {
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
  const onPointerUp = () => endDrag(pullNow.current < -22);
  const onPointerCancel = () => endDrag(false);

  /** A true tap (no meaningful pointer travel) still does its old jobs:
   *  bring a tucked pill back, or dismiss a finished one. Swiping up is the
   *  ONLY way to tuck a live one now — there's nothing left for a tap to do
   *  while it's still counting. */
  const onTap = () => {
    if (suppressClick.current) { suppressClick.current = false; return; }
    if (!island || canTuck) return;
    if (!expanded) return setMode("expanded");
    dismiss();
  };

  return (
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
        "absolute inset-x-0 top-[14px] z-[95] mx-auto overflow-hidden text-left touch-none " +
        (island ? "cursor-default" : "pointer-events-none")
      }
      style={{
        // TRUE BLACK now, not charcoal — a real Dynamic Island is the black of the
        // display switched off, seamless with the camera hardware. Lime glow ONLY
        // when expanded: a full notification earns the bloom; a status-bar pill
        // shouldn't blast colour across the header.
        background: island ? "#040405" : "#0b0c09",
        boxShadow: !island
          ? undefined
          : expanded
            ? "0 0 0 1px rgba(244,255,122,0.14), 0 0 28px rgba(244,255,122,0.22), 0 22px 55px rgba(0,0,0,0.75)"
            : "0 10px 30px rgba(0,0,0,0.6)",
        // Four silhouettes. Expanded 384×118 seats two rows around the camera.
        // Collapsed is now 158, not 196: with the 62px dead zone in the middle
        // and only an avatar + countdown flanking it, a wider pill just floated
        // the content with empty edges. 158 hugs the camera the way a real
        // compact Live Activity does.
        width: !island ? 120 : expanded ? 384 : 158,
        height: !island ? 34 : expanded ? 118 : 34,
        borderRadius: !island || !expanded ? 20 : 42,
      }}
    >
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
            className="flex h-full flex-col justify-center gap-2.5 px-5 py-3.5"
          >
            {/* TOP ROW — flanks the camera. A 3-column grid keeps the centre
                column dead-centre on the ISLAND, which is centred on screen, which
                is exactly where the TrueDepth camera sits. Content wraps around it
                (leading | camera | trailing), the way a real Live Activity does —
                the middle is hardware, so nothing lives there.
                `pr-1` on the trailing side: the 42px corner curve bites into the
                top-right exactly where the timer sits, so it's inset a little
                further than the leading side to keep it off the curve. */}
            <div className="grid grid-cols-[1fr_auto_1fr] items-center">
              {/* gap-2 + a 32px avatar (not 36): with the dead zone claiming the
                  centre, the leading column is capped at the trailing column's
                  width by the symmetric grid, and "Trash night" was landing right
                  on that cap — the DOM read it as fitting (92==92) but the loaded
                  font rendered a hair wider and clipped. Trimming the avatar and
                  gap buys the title ~12px of clear headroom. */}
              <div className="flex min-w-0 items-center gap-2 pr-2">
                {who ? (
                  <Avatar member={who} size={32} />
                ) : (
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-pill bg-white/10 text-white">
                    <Icon name="bell" size={16} />
                  </span>
                )}
                <span className="min-w-0">
                  <span className="block truncate text-[16px] font-semibold leading-tight text-white">{island.title}</span>
                  <span className="block truncate text-[12px] leading-tight text-white/55">
                    {island.held ? "Held during quiet hours"
                      : island.timeLabel ? `at ${clockLabel(island.timeLabel)}`
                      : "Reminder"}
                  </span>
                </span>
              </div>

              {/* THE DEAD ZONE — the camera lives here. A fixed-width band so
                  content genuinely clears the sensor, not a shrug-width gap; two
                  faint dots stand in for the FaceID pill + camera circle. */}
              <span aria-hidden className="flex shrink-0 items-center justify-center gap-1.5" style={{ width: DEAD_ZONE }}>
                <span className="h-2 w-2 rounded-pill bg-white/[.08]" />
                <span className="h-[7px] w-[7px] rounded-pill bg-white/[.05]" />
              </span>

              {countdown && (
                <span className="flex flex-col items-end pl-2 pr-1">
                  <span className="text-[18px] font-bold leading-none tabular-nums text-lemon">{countdown}</span>
                  {!arrived && <span className="mt-0.5 text-[10px] uppercase tracking-[0.1em] text-white/40">to go</span>}
                </span>
              )}
            </div>

            {/* BOTTOM ROW — the actions. `stopPropagation` so a button press
                never reads as a body tap or the start of a tuck swipe. */}
            <div className="flex gap-2">
              <IslandButton onClick={(e) => { e.stopPropagation(); dismiss(); }} tone="solid">
                <Icon name="check" size={15} /> Done
              </IslandButton>
              <IslandButton onClick={(e) => { e.stopPropagation(); snooze(2); }}>
                <Icon name="clock" size={15} /> +2 min
              </IslandButton>
            </div>
          </motion.div>
        )}
        {island && !expanded && (
          <motion.span
            key="tucked"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: 0.22, delay: 0.05 } }}
            exit={{ opacity: 0, transition: { duration: 0.16 } }}
            // FLANKS THE CAMERA. This was one flex row — avatar, a long title,
            // then the countdown — running straight across the sensor cutout,
            // which is exactly what you caught: the title sat on dead pixels.
            // Now a 3-column grid with the dead zone fixed in the centre; the
            // avatar hugs its left edge, the countdown its right, and the title
            // is GONE from this state (there's no room beside a 62px hole, and a
            // real compact Live Activity shows a glyph + a value, never a
            // sentence — the words come back on expand).
            className="grid h-full grid-cols-[1fr_auto_1fr] items-center px-2"
          >
            <span className="flex justify-end pr-1.5">
              {who && <Avatar member={who} size={26} />}
            </span>
            <span aria-hidden className="flex items-center justify-center gap-1.5" style={{ width: DEAD_ZONE }}>
              <span className="h-2 w-2 rounded-pill bg-white/[.08]" />
              <span className="h-[7px] w-[7px] rounded-pill bg-white/[.05]" />
            </span>
            <span className="flex justify-start pl-1.5">
              {countdown && (
                <span className="text-[13px] font-semibold tabular-nums text-lemon">{countdown}</span>
              )}
            </span>
          </motion.span>
        )}
      </AnimatePresence>
    </motion.div>
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
        "flex h-9 flex-1 items-center justify-center gap-1.5 rounded-pill text-[13px] font-semibold transition-colors " +
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
      style={{ top: -BLEED, height: SAFE_TOP + BLEED, paddingTop: BLEED + 14 }}
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

function TabletFrame({ children, chromeGap }: { children: ReactNode; chromeGap: number }) {
  const d = DEVICES.tablet;
  const outerW = d.w + d.bezel * 2;
  const outerH = d.h + d.bezel * 2;
  const frame = useRef<HTMLDivElement>(null);
  const { s, gw, gh, dx, dy } = useFit(frame, outerW, outerH, chromeGap);

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
          className="relative overflow-hidden bg-ink"
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
