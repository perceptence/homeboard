"use client";

import clsx from "clsx";
import { motion } from "framer-motion";
import { useState, type ReactNode } from "react";
import {
  boxShadow, colors, control, fontSize, radius, spacing, tokenCounts,
} from "@/lib/tokens";
import { ratio } from "@/lib/contrast";
import { ease, smooth, spring } from "@/lib/motion";
import { seedMembers } from "@/lib/seed";
import {
  Avatar, AvatarStack, Button, Check, DateBadge, IconTile, Pill, PriorityPill,
} from "@/components/ui";
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

/**
 * Every specimen's description line.
 *
 * caption, not micro. The token file next door says it in as many words —
 * caption is "all meta text", micro is "whisper cues ONLY" — and this page,
 * whose whole job is to document that scale, was setting its own explanatory
 * prose at the whisper size in a hundred places.
 */
const meta = "text-caption text-white/60";

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
              <p className="font-mono text-micro uppercase tracking-wide text-white/60">{hex}</p>
              <p className="font-mono text-micro text-white/60">{onCard.toFixed(1)}:1 on white</p>
            </div>
          );
        })}
      </div>
      <div className="mt-5 grid grid-cols-5 gap-2 border-t border-white/12 pt-4">
        {Object.entries(colors.member).map(([who, hex]) => (
          <div key={who} className="min-w-0">
            <div className="h-8 w-full" style={{ background: hex, borderRadius: radius.pill }} />
            <p className="mt-1 truncate text-micro capitalize text-white/60">{who}</p>
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
              <span className="shrink-0 text-right font-mono text-micro leading-tight text-white/60">
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
            <span className="w-20 shrink-0 font-mono text-micro text-white/60">{k}</span>
            <span className="h-3 bg-lemon" style={{ width: v, borderRadius: 2 }} />
            <span className="font-mono text-micro text-white/60">{v}</span>
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
            <p className="mt-1 font-mono text-micro text-white/60">{k}</p>
            <p className="font-mono text-micro text-white/60">{v}</p>
          </div>
        ))}
      </div>
      {/* The third scale in this card, and the one a touch product can least
          afford to leave undocumented: how tall a thing you tap is. It was
          missing here while the card sat half empty. */}
      <Label className="mt-6 !text-lemon">Control heights · {Object.keys(control).length} steps</Label>
      <div className="mt-3 space-y-2">
        {Object.entries(control).map(([k, v]) => (
          <div key={k} className="flex items-center gap-3">
            <div
              className="flex min-w-0 flex-1 items-center rounded-pill bg-white/[.08] px-4 ring-1 ring-inset ring-white/15"
              style={{ height: v }}
            >
              <span className="truncate text-bodysm font-medium text-white/85">
                {k === "touch" ? "Minimum tap target" : k === "ctl" ? "Buttons, pills, fields" : "Primary actions"}
              </span>
            </div>
            {/* w-28, not w-20: that column was measured against 10px type, and
                "ctl-lg · 52px" wraps to two lines the moment it is set at the
                scale's actual floor. */}
            <span className="w-28 shrink-0 whitespace-nowrap text-right font-mono text-micro text-white/60">
              {k} · {v}
            </span>
          </div>
        ))}
      </div>

      <p className={`mt-auto pt-4 ${meta}`}>
        Rounded everywhere, never sharp — and nothing tappable is under 44px, which is the floor
        rather than the norm: the things you press most are 48.
      </p>
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
            <p className="mt-2 font-mono text-micro text-sub">{k}</p>
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
        One ease, one spring, one press — read from <code className="font-mono text-micro text-white/75">lib/motion</code>,
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
              <span className="truncate font-mono text-micro text-white/60">{m.detail}</span>
            </div>
            {/* TRAVEL THE WHOLE TRACK. This animated `x` to a percentage,
                and a percentage on x resolves against the ELEMENT's own width
                — so the dot moved six of its own widths, stopped wherever
                that landed, and the two curves were being compared over a
                distance neither of them finished. Switching sides of a flex
                box and letting `layout` move the dot makes the distance the
                full track by construction, at any panel width, and it is
                still a transform, so reduced motion still collapses it. */}
            <div
              className={clsx(
                "mt-2 flex h-8 rounded-pill bg-black/25 p-1 ring-1 ring-inset ring-white/10",
                on ? "justify-end" : "justify-start",
              )}
            >
              <motion.div layout transition={m.t} className="h-6 w-6 rounded-pill bg-lemon" />
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
        All of it runs inside <code className="font-mono text-micro text-white/60">MotionConfig reducedMotion=&quot;user&quot;</code>,
        so transform animations collapse to instant when the OS asks, while opacity fades stay.
      </p>
    </Panel>
  );
}

/**
 * THE VOCABULARY — the components themselves, not the ingredients.
 *
 * Everything above this is a scale: colour values, type steps, spacing, radii,
 * control heights. Useful, and half the story. What a design system actually
 * hands you is the assembled pieces — and these are the real ones, imported
 * from the module the product renders. The checkbox toggles; the buttons press.
 *
 * ON A LIGHT CARD, for the same reason the elevation chips are: these are drawn
 * for the app's white card and several of them ENCODE that. `Pill tone="tag"`
 * is `bg-ink/5 text-sub` — ink on ink, invisible on this panel's wash — and the
 * set carries a separate `dark` tone precisely because the light one cannot
 * survive a dark surface. Showing them on wash would have been showing them
 * broken, so each bay puts its specimen on the surface it was built for.
 */
export function ComponentSpecimen() {
  const [done, setDone] = useState(false);
  const people = [seedMembers.maya, seedMembers.sam, seedMembers.leo, seedMembers.ada];

  const bay = (title: string, note: string, children: ReactNode) => (
    <div className="min-w-0">
      <p className="font-mono text-micro font-bold uppercase tracking-[0.14em] text-white/60">
        {title}
      </p>
      <div className="mt-2 flex min-h-[84px] flex-wrap items-center gap-2 rounded-md bg-card p-4">
        {children}
      </div>
      <p className={`mt-2 ${meta}`}>{note}</p>
    </div>
  );

  return (
    <Panel tone="wash">
      <Label className="!text-lemon">Components · the assembled pieces</Label>
      <p className="mt-2 max-w-[74ch] text-bodysm text-white/60">
        Imported from <code className="font-mono text-micro text-white/75">components/ui</code> —
        the same module the two devices above render from, so these are the components rather than
        drawings of them. The checkbox toggles and the buttons press.
      </p>

      <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {bay(
          "Identity",
          "A person is a face and a colour, and keeps that colour on every surface. Stacked when a job is shared.",
          <>
            {people.map((m) => <Avatar key={m.id} member={m} size={40} />)}
            <AvatarStack members={people} size={32} />
          </>,
        )}

        {bay(
          "Icon wells",
          "One stroke weight across the set, at two sizes holding the same 1:2 glyph-to-well ratio — a card size and a list-row size.",
          <>
            <IconTile name="cart" />
            <IconTile name="wrench" tone="lemon" />
            <IconTile name="bolt" tone="onTint" />
            <IconTile name="plant" size="sm" />
            <IconTile name="bill" size="sm" tone="lemon" />
          </>,
        )}

        {bay(
          "Status language",
          "Urgency is the odd one out on purpose: it is text, not a chip, because a pill carried its own 28px and pushed every card it touched taller than its neighbours.",
          <>
            <Pill>Kitchen</Pill>
            <Pill tone="lemon">Today</Pill>
            <Pill tone="lavender">Shared</Pill>
            <PriorityPill priority="high" />
          </>,
        )}

        {bay(
          "Completion",
          "The one control the whole product turns on. Tap it — this is the live component, animating the way it does in the app.",
          <div className="flex items-center gap-3">
            <Check done={done} onClick={() => setDone((v) => !v)} />
            <span className={clsx("text-bodysm", done ? "text-sub line-through" : "text-ink")}>
              Water the garden
            </span>
          </div>,
        )}

        {bay(
          "Actions",
          "One shape, several tones. Lemon is spent on the single primary action a screen exists for; everything else recedes.",
          <>
            <Button tone="lemon">Add</Button>
            <Button tone="outline">Reschedule</Button>
            <Button tone="ghost">Later</Button>
          </>,
        )}

        {bay(
          "When",
          "A vertical stadium, not a circle — it stretches to the height of the card it sits in, so a date never floats in its own row.",
          <>
            <DateBadge day={5} weekday="Wed" />
            <DateBadge day={11} weekday="Fri" />
            <DateBadge day="—" weekday="Any" />
          </>,
        )}
      </div>

      <p className={`mt-5 border-t border-white/12 pt-4 ${meta}`}>
        The tags above are the light-surface tone. The set carries a second one for dark canvases —{" "}
        <Pill tone="dark">Overdue</Pill> — because <code className="font-mono text-micro">tag</code>{" "}
        is ink on a 5% ink wash, and it disappears the moment the surface goes dark.
      </p>
    </Panel>
  );
}
