"use client";

import { useState } from "react";
import clsx from "clsx";
import type { ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
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
 * ONE arrangement, every section — eyebrow above, title under it, standfirst
 * under that. A variant that set the label beside the title briefly existed for
 * the closing section; it made that one heading read as a different kind of
 * heading, which is a high price for filling a gap beside a short title. A
 * title that wants two lines should say so in its own markup instead.
 */
export function Head({
  label, title, standfirst,
}: { label: string; title: ReactNode; standfirst?: ReactNode }) {
  return (
    <header className="max-w-[62ch]">
      <p className="font-mono text-micro font-bold uppercase tracking-[0.16em] text-lemon">{label}</p>
      <h2 className="mt-3 font-tight text-[clamp(28px,4vw,44px)] leading-[1.08] tracking-[-0.015em] text-white">
        {title}
      </h2>
      {standfirst && <p className="mt-4 text-body leading-relaxed text-white/60">{standfirst}</p>}
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
/**
 * A LABELLED DISCLOSURE — the mechanics behind a decision, one click away
 * rather than blocking the decision itself.
 *
 * Some of what earns a rule on this page is genuinely technical: a transform
 * that breaks a media query's own measurement, a grid track sizing to
 * max-content. True, worth keeping, and not what a reader needs to parse to
 * follow the argument — the belief, what it cost, and the rule that replaced
 * it carry that on their own. This is where the HOW goes, so it stops
 * gatekeeping the WHY for a reader who came for the decision, not the CSS.
 *
 * Reduced motion collapses the reveal to an instant show/hide — the same rule
 * `MotionConfig reducedMotion="user"` applies inside the embed, applied here
 * by hand because this component sits outside that provider's tree.
 */
export function Reveal({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const reduce = useReducedMotion();

  return (
    <div>
      {/* A LABEL, not a solid lemon chip, was the first cut — the same register
          as "WHAT THAT GOT WRONG" beside it, so a reader's eye filed it with
          the inert furniture text rather than reading it as a thing to press.
          This borrows the exact tag treatment the "Before/After" pills use two
          inches above it in the same story (solid lemon, ink text) instead of
          inventing a new control language — the page already has a way of
          saying "this is live," and the button just needed to speak it. */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 rounded-pill bg-lemon px-2.5 py-1 font-mono text-micro font-bold uppercase tracking-[0.14em] text-ink transition-opacity hover:opacity-80"
      >
        <span aria-hidden className={clsx("inline-block transition-transform duration-300", open && "rotate-90")}>
          &#9656;
        </span>
        {open ? `Hide ${label}` : `Show ${label}`}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="body"
            initial={reduce ? false : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={reduce ? undefined : { height: 0, opacity: 0 }}
            transition={{ duration: reduce ? 0 : 0.28 }}
            className="overflow-hidden"
          >
            <div className="pt-3">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

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
