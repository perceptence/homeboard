"use client";

import clsx from "clsx";
import type { ReactNode } from "react";
import { DEVICES } from "@/components/DeviceFrame";

/**
 * ONE content width, for the whole page.
 *
 * The number isn't invented: it's `DEVICES.tablet.w` — the iPad Pro's logical
 * width, the widest surface this product is actually designed against. Every
 * section on this page is measured against the same figure the app is, and it's
 * read from the module rather than typed here, so it can't drift.
 *
 * Everything routes through this component, and a test asserts that the set of
 * measured content widths on the page has exactly one member. The hero is the
 * single deliberate exception — it's full-bleed by design.
 */
export const CONTENT_WIDTH = DEVICES.tablet.w;

export function Wrap({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      data-content-wrap
      style={{ maxWidth: CONTENT_WIDTH }}
      className={clsx("mx-auto w-full px-inner", className)}
    >
      {children}
    </div>
  );
}

/** A page section. `id` doubles as the in-page anchor. */
export function Section({
  id, children, className,
}: { id: string; children: ReactNode; className?: string }) {
  return (
    <section id={id} data-section className={clsx("py-16 sm:py-24", className)}>
      <Wrap>{children}</Wrap>
    </section>
  );
}

/**
 * Section heading: a small label, a big line, and one sentence of orientation.
 *
 * `inlineLabel` sets the label beside the title instead of above it, on the
 * same baseline. For a title short enough to leave most of a line empty next to
 * it, stacking the label wastes a whole row to hold four words — so the closing
 * section runs them together. It is opt-in per section rather than the default,
 * because a long title would wrap under an inline label and lose the straight
 * left edge every other heading on the page keeps.
 */
export function Head({
  label, title, standfirst, inlineLabel = false,
}: { label: string; title: ReactNode; standfirst?: ReactNode; inlineLabel?: boolean }) {
  const chip = (
    <p className="font-mono text-micro font-bold uppercase tracking-[0.16em] text-lemon">{label}</p>
  );
  return (
    /* The 62ch cap moves off the header and onto the prose when the label is
       inline. It has to: a 44px title already fills 62ch on its own, so the
       label had nowhere to sit and wrapped to a line of its own — which is the
       stacked layout again, with extra steps. The measure still governs the
       standfirst, which is the part that is actually read as text. */
    <header className={clsx(!inlineLabel && "max-w-[62ch]")}>
      {!inlineLabel && chip}
      <div className={clsx(inlineLabel && "flex flex-wrap items-baseline gap-x-4 gap-y-1")}>
        <h2
          className={clsx(
            "font-tight text-[clamp(28px,4vw,44px)] leading-[1.08] tracking-[-0.015em] text-white",
            !inlineLabel && "mt-3",
          )}
        >
          {title}
        </h2>
        {inlineLabel && chip}
      </div>
      {standfirst && (
        <p className={clsx("mt-4 text-body leading-relaxed text-white/60", inlineLabel && "max-w-[62ch]")}>
          {standfirst}
        </p>
      )}
    </header>
  );
}

/** The page's standard surface: a light card on the ink canvas, like the app's. */
export function Panel({
  children, className, tone = "card",
}: { children: ReactNode; className?: string; tone?: "card" | "wash" | "lemon" | "lavender" }) {
  const tones = {
    card: "bg-card text-ink",
    wash: "bg-white/[.06] text-white",
    lemon: "bg-lemon text-ink",
    lavender: "bg-lavender text-ink",
  };
  /**
   * `min-w-0` is load-bearing. A grid or flex item defaults to
   * `min-width: auto`, which refuses to shrink below its own min-content — so a
   * single wide row inside one panel silently widened the whole page by 200px
   * at phone width, and the overflow showed up on <html>, nowhere near the
   * cause.
   */
  return (
    <div className={clsx("min-w-0 rounded-card p-card-pad", tones[tone], className)}>{children}</div>
  );
}

/**
 * A small-caps label. Defaults to a muted WHITE, because this page's canvas is
 * ink — the previous default (`text-sub`) is a light-surface colour and sat at
 * 2.65:1 here, which is why every single call site was already overriding it.
 */
export function Label({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={clsx("font-mono text-micro font-bold uppercase tracking-[0.14em] text-white/60", className)}>
      {children}
    </p>
  );
}

/**
 * A code / artifact sample with a plain-language reading beside it.
 *
 * Never a code block on its own: the rule for this page is that anything
 * technical carries an explanation a non-coder can follow — what is being
 * claimed, and why it matters.
 *
 * The sample WRAPS rather than scrolls (`whitespace-pre-wrap`), so a narrow
 * screen never hides half a line off the right edge. `tabIndex={0}` stays
 * anyway: `overflow-x-auto` is still on the element, and any scrollable region
 * has to be reachable from the keyboard or axe fails the page on "scrollable
 * region must be keyboard accessible".
 */
export function Sample({
  code, lang = "ts", reading, claim,
}: { code: string; lang?: string; reading: ReactNode; claim: string }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="min-w-0">
        <Label className="!text-white/60">{lang}</Label>
        <pre
          tabIndex={0}
          className="no-scrollbar mt-2 overflow-x-auto whitespace-pre-wrap break-words rounded-md bg-black/40 p-card-pad text-bodysm leading-[20px] text-white/85 ring-1 ring-inset ring-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-lemon"
        >
          <code>{code}</code>
        </pre>
      </div>
      <div className="min-w-0">
        <Label className="!text-lemon">In plain language</Label>
        <p className="mt-2 text-bodysm font-medium text-white">{claim}</p>
        <div className="mt-2 space-y-2 text-bodysm leading-relaxed text-white/60">{reading}</div>
      </div>
    </div>
  );
}
