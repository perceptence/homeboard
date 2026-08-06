"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import {
  boxShadow, colors, fontSize, radius, spacing, tokenCounts,
} from "@/lib/tokens";
import { ratio } from "@/lib/contrast";
import { ease, smooth, spring } from "@/lib/motion";
import { Label, Panel } from "./kit";

/**
 * THE SYSTEM — every specimen here is read from the token module at render time.
 *
 * Not transcribed, not screenshotted: `colors.lemon` is the same object
 * `tailwind.config.ts` builds `bg-lemon` from. If someone changes the palette
 * and forgets this page exists, this page changes with it. There is no version
 * of the documentation that can be wrong.
 *
 * ON THE SURFACE THESE SIT ON. These panels used to be the app's white card on
 * the ink canvas — which is exactly what the product does, and exactly wrong at
 * this size. A white card on a phone is a small bright object held at arm's
 * length; a white card the width of a case-study column is a page of glare. So
 * the panels use the product's OTHER surface for dark canvases, `wash`, and
 * true white is spent only where it's load-bearing: a shadow needs a light
 * surface to fall on, so the elevation chips keep it.
 */

const swatchOrder = ["ink", "lemon", "lavender", "mint", "accent", "progress", "surface", "card", "sub", "danger", "star"] as const;

/** A muted caption on the wash panels. */
const meta = "text-micro text-white/60";

export function ColourSpecimen() {
  return (
    <Panel tone="wash" className="flex h-full flex-col">
      <Label className="!text-lemon">Colour · {tokenCounts.colorValues} values</Label>
      <p className="mt-2 text-bodysm text-white/60">
        One accent does all the shouting. Everything else is a surface, a tint, or ink.
      </p>
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {swatchOrder.map((name) => {
          const hex = colors[name] as string;
          // The ratio is stated in legible ink BESIDE the swatch, never as text
          // ON it — a mid-tone chip can fail against both black and white, and
          // rendering that as real text just makes an unreadable sample.
          const onCard = ratio(hex, colors.card);
          return (
            <div key={name} className="min-w-0">
              <div
                className="h-14 w-full ring-1 ring-inset ring-white/15"
                style={{ background: hex, borderRadius: radius.sm }}
              />
              <p className="mt-1.5 truncate text-micro font-medium text-white/85">{name}</p>
              <p className="font-mono text-[10px] uppercase tracking-wide text-white/60">{hex}</p>
              <p className="font-mono text-[10px] text-white/60">{onCard.toFixed(1)}:1 on white</p>
            </div>
          );
        })}
      </div>
      <div className="mt-5 grid grid-cols-5 gap-2 border-t border-white/12 pt-4">
        {Object.entries(colors.member).map(([who, hex]) => (
          <div key={who} className="min-w-0">
            <div className="h-8 w-full" style={{ background: hex, borderRadius: radius.pill }} />
            <p className="mt-1 truncate text-[10px] capitalize text-white/60">{who}</p>
          </div>
        ))}
      </div>
      <p className={`mt-3 ${meta}`}>
        Identity colours, assigned per person — the same colour on every surface.
      </p>
    </Panel>
  );
}

export function TypeSpecimen() {
  return (
    <Panel tone="wash" className="flex h-full flex-col">
      <Label className="!text-lemon">Type · {tokenCounts.type} steps</Label>
      <p className="mt-2 text-bodysm text-white/60">
        Poppins throughout. Weight rises as size falls — the big sizes are Regular, because
        heavy display type reads as urgency and a home is unhurried.
      </p>
      <div className="mt-5 space-y-3">
        {(Object.keys(fontSize) as (keyof typeof fontSize)[]).map((k) => {
          const [size, m] = fontSize[k] as unknown as [string, Record<string, string>];
          return (
            <div key={k} className="flex items-baseline gap-3 border-t border-white/10 pt-3 first:border-0 first:pt-0">
              <span
                className="min-w-0 flex-1 truncate text-white"
                style={{
                  fontSize: size,
                  lineHeight: m.lineHeight,
                  letterSpacing: m.letterSpacing,
                  fontWeight: Number(m.fontWeight),
                }}
              >
                The washing needs moving
              </span>
              <span className="shrink-0 text-right font-mono text-[10px] leading-tight text-white/60">
                <span className="block text-white/70">{k}</span>
                {size} / {m.lineHeight}
                <span className="block">w{m.fontWeight}</span>
              </span>
            </div>
          );
        })}
      </div>
      <p className={`mt-auto pt-4 ${meta}`}>
        Every size and line-height is an even number. Line-heights are px, not ratios — a ratio
        silently produces fractional pixels, which is how half-pixels crept in.
      </p>
    </Panel>
  );
}

export function SpaceSpecimen() {
  return (
    <Panel tone="wash" className="flex h-full flex-col">
      <Label className="!text-lemon">Spacing · {tokenCounts.spacing} steps</Label>
      <p className="mt-2 text-bodysm text-white/60">Every step is a multiple of two.</p>
      <div className="mt-4 space-y-2">
        {Object.entries(spacing).map(([k, v]) => (
          <div key={k} className="flex items-center gap-3">
            <span className="w-20 shrink-0 font-mono text-[10px] text-white/60">{k}</span>
            <span className="h-3 bg-lemon" style={{ width: v, borderRadius: 2 }} />
            <span className="font-mono text-[10px] text-white/60">{v}</span>
          </div>
        ))}
      </div>

      <Label className="mt-6 !text-lemon">Radius · {tokenCounts.radius} steps</Label>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        {Object.entries(radius).map(([k, v]) => (
          <div key={k} className="text-center">
            <div
              className="h-14 w-14 bg-white/10 ring-1 ring-inset ring-white/20"
              // A number token used without a unit is invalid CSS and silently
              // ignored — these are strings with px already on them.
              style={{ borderRadius: v }}
            />
            <p className="mt-1 font-mono text-[10px] text-white/60">{k}</p>
            <p className="font-mono text-[10px] text-white/60">{v}</p>
          </div>
        ))}
      </div>
      <p className={`mt-auto pt-4 ${meta}`}>Rounded everywhere. Never sharp.</p>
    </Panel>
  );
}

export function ElevationSpecimen() {
  return (
    <Panel tone="wash" className="flex h-full flex-col">
      <Label className="!text-lemon">Elevation · {tokenCounts.elevation} steps</Label>
      <p className="mt-2 text-bodysm text-white/60">
        Soft and low. Named e1–e3, not by role — an elevation named <em>card</em> would collide
        with the colour of the same name and Tailwind would build a white shadow instead.
      </p>
      {/* The one place true white is still spent: these shadows are dark rgba,
          and a dark shadow is invisible on a dark surface. */}
      <div className="mt-5 grid grid-cols-3 gap-3 rounded-md bg-surface p-4">
        {Object.entries(boxShadow).map(([k, v]) => (
          <div key={k} className="text-center">
            <div
              className="mx-auto h-14 w-full bg-card"
              style={{ boxShadow: v, borderRadius: radius.md }}
            />
            <p className="mt-2 font-mono text-[10px] text-sub">{k}</p>
          </div>
        ))}
      </div>
      <p className={`mt-auto pt-4 ${meta}`}>
        Each is two shadows: a tight contact shadow and a wide soft one — which is what keeps a
        raised card from looking cut out and pasted on.
      </p>
    </Panel>
  );
}

export function MotionSpecimen() {
  const [on, setOn] = useState(false);
  return (
    <Panel tone="wash" className="flex h-full flex-col">
      <Label className="!text-lemon">Motion</Label>
      <p className="mt-2 text-bodysm text-white/60">
        One ease, one spring, one press — read from <code className="font-mono text-[12px] text-white/75">lib/motion</code>,
        the same transitions the app animates with.
      </p>

      <div className="mt-4 space-y-3">
        {[
          // framer's Transition is a union, so the shared fields aren't reachable
          // on the type — read them off the real objects, which is the point:
          // these captions are the values the app animates with, not copies.
          { name: "smooth", detail: `${(smooth as Record<string, number>).duration}s · cubic-bezier(${ease.join(", ")})`, t: smooth },
          {
            name: "spring",
            detail: `stiffness ${(spring as Record<string, number>).stiffness} · damping ${(spring as Record<string, number>).damping}`,
            t: spring,
          },
        ].map((m) => (
          <div key={m.name} className="rounded-md bg-white/[.06] p-3">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-bodysm font-medium text-white">{m.name}</span>
              <span className="truncate font-mono text-[10px] text-white/60">{m.detail}</span>
            </div>
            <div className="mt-2 h-8 rounded-pill bg-black/25 p-1">
              <motion.div
                className="h-6 w-6 rounded-pill bg-lemon"
                animate={{ x: on ? "calc(100% * 6)" : 0 }}
                transition={m.t}
              />
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={() => setOn((v) => !v)}
        className="mt-4 h-ctl rounded-pill bg-lemon px-5 text-bodysm font-medium text-ink transition-opacity hover:opacity-90"
      >
        {on ? "Send them back" : "Play both"}
      </button>
      <p className={`mt-auto pt-3 ${meta}`}>
        All of it runs inside <code className="font-mono text-[11px] text-white/60">MotionConfig reducedMotion=&quot;user&quot;</code>,
        so transform animations collapse to instant when the OS asks, while opacity fades stay.
      </p>
    </Panel>
  );
}
