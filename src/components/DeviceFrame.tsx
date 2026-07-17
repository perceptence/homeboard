"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Avatar } from "@/components/ui";
import { Icon } from "@/components/Icons";
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
  const island = useHousehold((s) => s.island);
  const members = useHousehold((s) => s.members);
  const dismiss = useHousehold((s) => s.dismissIsland);

  useEffect(() => {
    if (!island) return;
    const t = setTimeout(dismiss, 4500);
    return () => clearTimeout(t);
  }, [island, dismiss]);

  const who = island?.who ? members[island.who] : undefined;

  return (
    <motion.button
      layout
      aria-live="polite"
      onClick={island ? dismiss : undefined}
      transition={{ type: "spring", stiffness: 380, damping: 32 }}
      // Centred by MARGINS (left-0 right-0 mx-auto), never by transform:
      // framer's `layout` animates via transform and silently overwrites any
      // translate you put in className — the pill drifted half its width right
      // and sat on the battery. The screenshot caught it; the DOM probe didn't,
      // because the element's size was correct and only its x was wrong.
      className={
        "absolute inset-x-0 top-[14px] z-[95] mx-auto overflow-hidden bg-[#0b0c09] text-left " +
        (island ? "shadow-[0_12px_32px_rgba(0,0,0,0.45)]" : "pointer-events-none")
      }
      style={{
        width: island ? 340 : 120,
        height: island ? 64 : 34,
        borderRadius: island ? 32 : 20,
      }}
    >
      <AnimatePresence>
        {island && (
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { delay: 0.12 } }}
            exit={{ opacity: 0 }}
            className="flex h-full items-center gap-3 px-4"
          >
            {who ? (
              <Avatar member={who} size={36} />
            ) : (
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-pill bg-white/10 text-white">
                <Icon name="bell" size={18} />
              </span>
            )}
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-semibold leading-tight text-white">{island.title}</span>
              {island.body && (
                <span className="block truncate text-[12px] leading-tight text-white/60">{island.body}</span>
              )}
            </span>
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
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
