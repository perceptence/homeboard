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

/** Enough to fill a wide screen; deterministic ids, so the wall is stable. */
const IDS = Array.from({ length: 132 }, (_, i) => `homeboard-${i}`);

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
          <span className="ml-auto hidden font-mono text-micro uppercase tracking-[0.14em] text-white/60 sm:block">
            Design case study
          </span>
        </div>
      </header>

      <section
        data-hero
        className="relative flex h-[100svh] w-full flex-col justify-end overflow-hidden bg-ink"
      >
        {/* THE WALL. aria-hidden: it's texture, and every face already renders
            its own aria-hidden SVG — announcing 132 portraits would bury the
            headline for a screen reader. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 flex flex-wrap content-center justify-center gap-2 p-4 opacity-80"
        >
          {faces.map((id) => (
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
                ["Role", "Design & build"],
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
