"use client";

import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { Face } from "@/components/Face";
import { AppMark } from "@/components/ui";
import { CONTENT_WIDTH } from "./kit";

/**
 * THE HERO — painted by the product's own code.
 *
 * Every portrait here comes from `Face`, the same function that draws the
 * avatar on a task card: an FNV-1a hash of a member id picks the backdrop,
 * skin, hair, clothing, hair silhouette and the beat of that person's blink.
 * Nothing is approximated in CSS and no image is fetched — this wall IS the
 * identity system, running. Give it a household of a hundred and it draws a
 * hundred faces that never repeat and never change between reloads.
 *
 * That's also the argument the wall is making. A household product has to draw
 * a family it has never met, on day one, before anyone has uploaded a photo.
 */

/**
 * Enough to fill a wide screen edge to edge; deterministic ids, so the wall is
 * stable between reloads.
 *
 * This was briefly cut to 84 while chasing a compositor stall, which thinned
 * the wall out and left ink showing through at the edges — the density IS the
 * effect. The stall turned out to be three live copies of the product mounted
 * at once, not the portraits; that's fixed where it belongs (see useInView),
 * and the wall is back to full. The `!scrolled` gate below is what makes the
 * full count affordable: it costs nothing once you've scrolled past it.
 */
const IDS = Array.from({ length: 132 }, (_, i) => `homeboard-${i}`);

/**
 * The header's jump-nav — five stops, in page order.
 *
 * Curated, not exhaustive: the page has eight sections, and a header nav that
 * lists all eight reads as a table of contents rather than a route through the
 * argument. These five are the ones a reader deciding "is this person a design
 * leader" is actually scanning for — see it running, know why it exists, see
 * the system it's built from, see a decision get made, see where it's going.
 *
 * Anchors, not a component that tracks scroll position: no state to get wrong,
 * and a test asserts every href here names a section id that actually exists.
 */
const NAV = [
  { label: "Product", href: "#product" },
  { label: "Why", href: "#why" },
  { label: "System", href: "#system" },
  { label: "Decisions", href: "#trouble" },
  { label: "Next", href: "#next" },
] as const;

export function Hero() {
  const faces = useMemo(() => IDS, []);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > window.innerHeight * 0.85);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      {/* The site header lives INSIDE the hero: transparent over the artwork,
          and only takes a surface once you've scrolled past it. */}
      <header
        className={clsx(
          "fixed inset-x-0 top-0 z-50 transition-colors duration-300",
          scrolled ? "bg-ink/85 backdrop-blur-xl" : "bg-transparent",
        )}
      >
        <div style={{ maxWidth: CONTENT_WIDTH }} className="mx-auto flex items-center gap-3 px-inner py-4">
          <AppMark size={28} className="shrink-0 rounded-sm" />
          <span className="font-tight text-h2 text-white">Homeboard</span>

          {/* Hidden below lg — where the header box is narrower than the row
              needs, this and the CTA would wrap or collide. A reader on a
              phone is scrolling, not skimming for a jump point, so nothing is
              lost by giving the space to the CTA instead below that width. */}
          <nav aria-label="Jump to section" className="ml-8 hidden items-center gap-6 lg:flex">
            {NAV.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="font-mono text-micro uppercase tracking-[0.12em] text-white/60 transition-colors hover:text-white"
              >
                {l.label}
              </a>
            ))}
          </nav>

          {/* THE ONE THING TO DO FROM HERE.
              This slot held the words "Design case study" — a label, on a page
              whose own headline already says what it is, in the one position a
              reader's eye returns to on every scroll. The product is running
              two sections down and deep-linked throughout; the header should
              hand it over rather than describe the document.

              h-touch, not something smaller: this page prints a control scale
              with 44px marked as the floor, and the header is the last place
              to be caught under it. New tab, because the case study is a long
              read and losing your place in it to try the app is a bad trade —
              said out loud for screen readers, since a new tab with no warning
              is disorienting when you can't see it happen. */}
          <a
            href="/"
            target="_blank"
            rel="noreferrer noopener"
            className="ml-auto inline-flex h-touch shrink-0 items-center gap-2 rounded-pill bg-lemon px-5 text-bodysm font-medium text-ink transition-opacity duration-300 hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lemon"
          >
            Open the live app
            <span aria-hidden>&#8599;</span>
            <span className="sr-only">(opens in a new tab)</span>
          </a>
        </div>
      </header>

      <section
        data-hero
        className="relative flex h-[100svh] w-full flex-col justify-end overflow-hidden bg-ink"
      >
        {/* THE WALL. aria-hidden: it's texture, and every face already renders
            its own aria-hidden SVG — announcing every portrait would bury the
            headline for a screen reader. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 flex flex-wrap content-center justify-center gap-2 p-4 opacity-80"
        >
          {/* Only while the hero is on screen. Each portrait blinks on its own
              SMIL timer, and eighty of those running for the entire length of
              the page — long after the artwork has scrolled away — is a cost
              paid for nothing. */}
          {!scrolled && faces.map((id) => (
            <Face key={id} id={id} size={76} />
          ))}
        </div>

        {/* The veil. Two layers: a broad ink wash to sink the wall, and a hard
            near-opaque pool behind the type. Contrast is measured against the
            pool, not the faces — see the a11y section. */}
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, rgba(14,14,16,.58) 0%, rgba(14,14,16,.42) 30%, rgba(14,14,16,.93) 72%, rgba(14,14,16,1) 100%)",
          }}
        />

        <div className="relative z-10 pb-[8vh]">
          <div style={{ maxWidth: CONTENT_WIDTH }} className="mx-auto w-full px-inner">
            <p className="font-mono text-micro font-bold uppercase tracking-[0.2em] text-lemon">
              Homeboard · design case study
            </p>
            <h1 className="mt-5 max-w-[19ch] font-tight text-[clamp(44px,8.5vw,104px)] font-normal leading-[0.95] tracking-[-0.03em] text-white">
              A home runs on
              <br />
              what nobody sees.
            </h1>
            <p className="mt-6 max-w-[54ch] text-[clamp(16px,1.6vw,21px)] leading-[1.5] text-white/70">
              A household coordinator for a family iPad and everyone&rsquo;s phone — built so the
              app does the anticipating, the deciding and the remembering, instead of handing
              someone a list to manage.
            </p>

            <dl className="mt-10 flex flex-wrap gap-x-10 gap-y-4 border-t border-white/15 pt-6 font-mono text-micro uppercase tracking-[0.12em]">
              {[
                ["Role", "Strategy & build"],
                ["Surfaces", "Tablet · Phones"],
                ["Stack", "Next.js · TypeScript"],
                ["Status", "Working prototype"],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="text-white/60">{k}</dt>
                  <dd className="mt-1 text-white/85">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>
    </>
  );
}
