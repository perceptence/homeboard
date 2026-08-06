"use client";

import type { ReactNode } from "react";
import { Head, Panel, Sample, Section, Wrap } from "@/case-study/kit";
import { Hero } from "@/case-study/Hero";
import { Embed } from "@/case-study/Embed";
import { Stories } from "@/case-study/Stories";
import { Scope } from "@/case-study/Scope";
import {
  ColourSpecimen, ComponentSpecimen, ElevationSpecimen, MotionSpecimen, SpaceSpecimen, TypeSpecimen,
} from "@/case-study/Specimens";
import { REPO } from "@/case-study/facts.generated";
import { AUDIT } from "@/case-study/audit";

/**
 * The case study. A real route in the real app — same build, same origin, same
 * design tokens, and the product itself mounted live in the middle of it.
 */

/**
 * A research finding and the decision it produced.
 *
 * The link used to sit directly under the quote as a long underlined citrus
 * sentence, which ran straight into the "Decision it drove" block below it —
 * two different kinds of text touching, with the loudest colour on the page
 * marking the least important one. Now the card has four clearly separated
 * registers: number, quote, who said it, what we did — and the link is a short
 * footer control at the very bottom, after a rule, sized like a control rather
 * than like prose.
 */
function Finding({
  n, source, href, quote, attribution, decision,
}: {
  n: number; source: string; href: string;
  quote: ReactNode; attribution: string; decision: ReactNode;
}) {
  return (
    /* SUBGRID, so the three cards agree row by row. Each card spans the four
       rows the parent defines and adopts its lines, which puts every quote,
       every decision box and every source link on the same baseline across all
       three — instead of each card packing its own contents and the boxes
       landing wherever that card's quote happened to end. */
    <Panel
      tone="wash"
      className={
        "flex h-full flex-col md:row-span-4 md:grid md:grid-rows-subgrid md:gap-0 " +
        /* The single column is NOT optional. Turning the card into a grid with
           only rows declared leaves its column implicit, and an implicit track
           sizes to max-content — so every child laid itself out at its natural
           width and the three cards spilled 96px past the page. minmax(0,1fr)
           is the column that is allowed to shrink. */
        "md:grid-cols-[minmax(0,1fr)]"
      }
    >
      <p className="font-mono text-micro font-bold uppercase tracking-[0.16em] text-white/60">
        Finding {String(n).padStart(2, "0")}
      </p>

      <div className="min-w-0">
        <blockquote className="mt-3 border-l-2 border-lemon pl-4 text-body leading-relaxed text-white/90">
          {quote}
        </blockquote>
        <p className="mt-3 pl-4 text-caption leading-[20px] text-white/60">{attribution}</p>
      </div>

      {/* mb-6 is the floor that stopped this box merging into the source rule
          below it. It used to rely on `mt-auto` on the link, and when a quote
          ran long there was no slack left for `auto` to distribute — which is
          exactly what happened to the third card, whose quote was the longest.
          The subgrid now separates the rows too, but the floor stays: it is
          what holds the two apart on a single-column phone layout, where there
          is no subgrid to do it. */}
      <div className="mb-6 mt-6 self-start rounded-md bg-lemon/[.10] p-3">
        <p className="font-mono text-micro font-bold uppercase tracking-[0.14em] text-lemon">
          The decision it drove
        </p>
        <p className="mt-2 text-bodysm leading-relaxed text-white">{decision}</p>
      </div>

      <a
        href={href}
        target="_blank"
        rel="noreferrer noopener"
        className="mt-auto flex items-center gap-1.5 border-t border-white/12 pt-4 text-caption font-medium text-white/60 transition-colors hover:text-lemon"
      >
        <span className="min-w-0 truncate">{source}</span>
        <span className="shrink-0 text-lemon">↗</span>
      </a>
    </Panel>
  );
}

export default function CaseStudy() {
  return (
    <main className="bg-ink">
      <Hero />

      {/* ── PRODUCT AT A GLANCE ─────────────────────────────────────────
          This was a row of repository statistics — commits, lines of
          TypeScript, test files. Every one of them true, and every one of them
          answering a question nobody asked: they measure the effort of building
          a thing rather than describing the thing. What replaced them is the
          same discipline pointed at the product. See src/case-study/Scope.tsx;
          the figures are still derived, never asserted. */}
      <Section id="glance">
        <Head
          label="Product at a glance"
          title="The scope of the experience"
          standfirst={
            <>
              What was designed, in six figures — the reach of the product, the ground it covers,
              and how much of the work was mine. Each one is counted from the thing it describes
              rather than written down, so none of them can quietly stop being true.
            </>
          }
        />
        <Scope />
      </Section>

      {/* ── THE PRODUCT, RUNNING ──────────────────────────────────────────
          The one section that isn't wrapped whole. Its heading keeps the page's
          single content width; the stage below deliberately runs edge to edge,
          because the margin that opens either side of the centred devices is
          where their controls stand. See the note in Embed. */}
      <section id="product" data-section className="py-16 sm:py-24">
        <Wrap>
          <Head
          label="The product, running"
          title="Not a screenshot &mdash; and not one device"
          standfirst={
            <>
              Both devices below are the real application, mounted in this page&rsquo;s React tree
              and reading one store. They are not two sizes of one screen — the board answers
              &ldquo;how is the house doing&rdquo;, the phone answers &ldquo;what do I owe it
              today&rdquo;. Steer each with its own controls; the address bar follows both.
              </>
            }
          />
        </Wrap>
        <div className="mt-10">
          <Embed />
        </div>
      </section>

      {/* ── TWO SURFACES — PARKED ────────────────────────────────────────
          A directed "scene" used to live here: both shells side by side with a
          camera that zoomed the board's count, pressed a real button on the
          phone, and followed the change back. The idea is right and the section
          isn't — the choreography never read as clearly as it needed to, so it
          is out of the page rather than half-working in it.

          `src/case-study/Duet.tsx` is intact and still passes its tests; drop
          <Duet /> back into a <Section id="surfaces"> to bring it back. What it
          was arguing for now lives above instead: the embed shows BOTH devices
          at once, each with its own controls, which makes the same point
          without needing a camera to make it. */}


      {/* ── WHY THIS EXISTS ─────────────────────────────────────────────── */}
      <Section id="why">
        <Head
          label="Why this exists"
          title="The category&rsquo;s own critics wrote the brief"
          standfirst={
            <>
              Secondary research — published reporting and academic work, not original studies. Three
              findings shaped what this product refuses to do.
            </>
          }
        />
        <div className="mt-10 grid gap-tile md:grid-cols-3 md:grid-rows-[auto_auto_1fr_auto]">
          <Finding
            n={1}
            source="MIT Technology Review — “Chore apps were meant to make mothers’ lives easier”"
            href="https://www.technologyreview.com/2022/05/10/1051954/chore-apps/"
            attribution="Jaclyn Wong, sociologist, University of South Carolina"
            quote={<>The work in managing the app is still going to be seen as women&rsquo;s work.</>}
            decision={
              <>
                The app assigns; the person doesn&rsquo;t delegate. Adding a task names an owner and
                says why — a precedent, a lighter load, whose domain it is — so the default path
                costs nobody an act of distribution.
              </>
            }
          />
          <Finding
            n={2}
            source="MIT Technology Review, on Allison Daminger’s four-step cycle of invisible labour"
            href="https://www.technologyreview.com/2022/05/10/1051954/chore-apps/"
            attribution="Allison Daminger, sociologist — anticipate, identify options, decide, monitor"
            quote={
              <>
                Apps focus on the visible, physical chores and overlook the cognitive work — the
                part that never stops.
              </>
            }
            decision={
              <>
                The product does the anticipating. It detects a double-booking, or work stranded on
                someone who&rsquo;s away, <em>before</em> anyone notices — and what it surfaces is
                the resolution, already worked out, rather than a notification.
              </>
            }
          />
          <Finding
            n={3}
            source="Ecovillages AU — “Why do we design for the nuclear family?”"
            href="https://www.ecovillages.au/post/why-do-we-design-for-the-nuclear-family"
            attribution="On the “cereal packet” family that most products still assume"
            quote={
              <>
                The mum-dad-two-kids picture is a particular arrangement from a particular time and
                place.
              </>
            }
            decision={
              <>
                Relationships never determine permissions. Household type, identity, role and
                responsibility are four independent fields, so a fifteen-year-old may hold full
                access and a forty-year-old may be guided.
              </>
            }
          />
        </div>
      </Section>

      {/* ── THE SYSTEM ──────────────────────────────────────────────────── */}
      <Section id="system">
        <Head
          label="The system"
          title="Read from the source, at render time"
          standfirst={
            <>
              Every specimen here imports the same token module <code className="font-mono text-bodysm text-white/80">tailwind.config.ts</code>{" "}
              builds the app&rsquo;s utilities from. Change a value and this page changes with it —
              there is no second copy to fall out of date.
            </>
          }
        />
        <div className="mt-10 grid gap-tile lg:grid-cols-2">
          <ColourSpecimen />
          <TypeSpecimen />
          <SpaceSpecimen />
          <div className="grid min-w-0 gap-tile">
            <ElevationSpecimen />
            <MotionSpecimen />
          </div>
        </div>
        {/* Full width, and last: the scales above are ingredients, this is what
            the system actually hands you. */}
        <div className="mt-tile">
          <ComponentSpecimen />
        </div>
      </Section>

      {/* ── WHERE IT NEARLY CAME APART ──────────────────────────────────── */}
      <Section id="trouble">
        <Head
          label="Where it nearly came apart"
          title="Five problems that changed a rule"
          standfirst={
            <>
              Not a bug list — these are the ones that moved a standing decision. Each shows the
              broken state rebuilt from real tokens, beside what replaced it.
            </>
          }
        />
        <div className="mt-10">
          <Stories />
        </div>
      </Section>

      {/* ── TESTS ───────────────────────────────────────────────────────── */}
      <Section id="tests">
        <Head
          label="Tests"
          title="What the suite is actually for"
          standfirst={
            <>
              {REPO.testFiles} files, and none of them chase coverage. Each pins a rule that a real
              bug already broke once — including the numbers printed on this page.
            </>
          }
        />

        <ul className="mt-8 grid gap-tile sm:grid-cols-2 lg:grid-cols-3">
          {[
            ["Contrast", "Every text colour is checked against every surface it actually sits on, at AA."],
            ["Token scales", "Spacing stays on the 2px grid; every type size and line-height stays even."],
            ["Journeys", "The deep-link list and the demo panel can't drift apart, and no journey points at a route that doesn't exist."],
            ["The page", "It renders, it isn't stuck, and it mounts the product inline rather than in an iframe."],
            ["One width", "Every content wrapper resolves to a single shared width."],
            ["Honesty", "Every figure printed on this page is recomputed from the repo and compared."],
          ].map(([t, d]) => (
            <li key={t}>
              <Panel tone="wash" className="h-full">
                <p className="text-bodysm font-medium text-white">{t}</p>
                <p className="mt-1.5 text-bodysm leading-relaxed text-white/55">{d}</p>
              </Panel>
            </li>
          ))}
        </ul>

        <div className="mt-10">
          <Sample
            lang="facts.test.ts"
            code={`const fresh = computeFacts();

expect(REPO.lines).toBe(fresh.lines);
expect(REPO.components).toBe(fresh.components);
expect(REPO.commits).toBeLessThanOrEqual(fresh.commits);`}
            claim="This test makes the page unable to lie about itself."
            reading={
              <>
                <p>
                  <b className="text-white/80">What it claims:</b>{" "}
                  the figures in &ldquo;At a
                  glance&rdquo; match the repository as it stands right now.
                </p>
                <p>
                  <b className="text-white/80">How:</b> it recounts the lines, the components and the
                  commits straight from the working tree, then compares them to the numbers this page
                  prints. Commits are checked as a floor, because that figure only ever rises.
                </p>
                <p>
                  <b className="text-white/80">Why it matters:</b>{" "}
                  stats on a portfolio page rot
                  silently — the code moves, the numbers don&rsquo;t, and nobody notices. Here the
                  suite fails and names the figure that drifted.
                </p>
              </>
            }
          />
        </div>
      </Section>

      {/* ── ACCESSIBILITY ───────────────────────────────────────────────── */}
      <Section id="a11y">
        <Head
          label="Accessibility"
          title="The audited result, and what it doesn&rsquo;t mean"
          standfirst={
            <>
              {AUDIT.tool}, {AUDIT.ruleset}, run in a real browser at{" "}
              {AUDIT.viewports.join(" and ")} with both devices mounted — reported as two numbers,
              because one would let the article hide behind the product.
            </>
          }
        />
        <div className="mt-10 grid gap-tile md:grid-cols-[auto_minmax(0,1fr)] md:items-start">
          <div className="grid gap-tile md:w-[280px]">
            <Panel tone="lemon">
              <p className="font-tight text-[56px] leading-none tracking-tight text-ink tabular-nums">
                {AUDIT.page.violations}
              </p>
              <p className="mt-2 text-bodysm font-medium text-ink">
                violations in this page&rsquo;s own chrome
              </p>
            </Panel>
            <Panel tone="wash">
              <p className="font-tight text-[56px] leading-none tracking-tight text-white tabular-nums">
                {AUDIT.product.nodes}
              </p>
              <p className="mt-2 text-bodysm font-medium text-white">
                elements failing inside the embedded product
              </p>
              {/* Both viewports, in one line — and derived, not written, so it
                  keeps telling the truth if they ever diverge again. They did
                  once: the wide run used to find more elements and the narrow
                  run a worse ratio. */}
              <p className="mt-1 text-caption text-white/60">
                all colour contrast ·{" "}
                {new Set(AUDIT.product.byViewport.map((v) => v.nodes)).size === 1
                  ? `${AUDIT.product.nodes} at both viewports`
                  : AUDIT.product.byViewport
                      .map((v) => `${v.nodes} at ${v.viewport.split(" ")[0]}`)
                      .join(", ")}{" "}
                · worst {AUDIT.product.worst}:1
              </p>
            </Panel>
          </div>
          <Panel tone="wash">
            <p className="text-bodysm font-medium text-white">What the product is failing on</p>
            <ul className="mt-3 space-y-2 border-b border-white/12 pb-4">
              {AUDIT.product.findings.map((f) => (
                <li key={f.what} className="text-bodysm leading-relaxed text-white/60">
                  <span className="font-medium text-white">{f.what}</span>{" "}
                  <span className="whitespace-nowrap font-mono text-micro text-lemon">{f.ratio}</span>
                  <span className="mt-0.5 block">{f.why}</span>
                </li>
              ))}
            </ul>

            {/* Three caveats, not five. The two that went were true but not
                load-bearing — a note on how contrast is measured, and a count
                of h1s that axe never objected to. Both are pinned by tests;
                neither changed what a reader should take from this number. */}
            <ul className="mt-4 space-y-2.5 text-bodysm leading-relaxed text-white/60">
              <li>
                <b className="text-white/80">Two more were found here and shipped.</b>{" "}
                Writing this
                page&rsquo;s contrast tests turned them on the product:{" "}
                <code className="font-mono text-micro text-white/75">sub</code> at 3.28:1 and{" "}
                <code className="font-mono text-micro text-white/75">danger</code> at 3.91:1. Both
                swatches were darkened rather than the text lightened.
              </li>
              <li>
                <b className="text-white/80">It isn&rsquo;t &ldquo;accessible.&rdquo;</b> Automated
                rules catch a minority of WCAG criteria. No screen-reader pass, no
                assistive-technology user has reviewed this.
              </li>
              <li>
                <b className="text-white/80">Reduced motion is honoured</b>{" "}
                app-wide, with one known
                gap: the avatars blink using SVG SMIL, which the CSS override doesn&rsquo;t reach.
              </li>
            </ul>
          </Panel>
        </div>
      </Section>

      {/* ── NEXT ────────────────────────────────────────────────────────── */}
      <Section id="next">
        <Head
          label="Where this goes next"
          /* The break is deliberate, not a wrap: the line divides where the
             sentence does, after the comma, so "on purpose" lands as its own
             beat rather than as whatever the measure happened to leave over. */
          title={
            <>
              Built as a prototype,
              <br />
              on purpose
            </>
          }
          standfirst={
            <>
              Two surfaces share one in-memory store, seeded with seven months of plausible
              household history. That was the right shape for proving the interaction model, and
              it&rsquo;s the starting condition for everything below.
            </>
          }
        />
        <div className="mt-10 grid gap-tile md:grid-cols-3">
          {[
            {
              k: "Next",
              items: [
                "Real sync — one household across actual devices, not one store behind two lenses.",
                "A delivery layer, so quiet hours gate something real.",
                "Recurrence as a rule with exceptions, so “this one” and “all of them” can differ.",
              ],
            },
            {
              k: "Later",
              items: [
                "A scheduler that proposes when, not just who.",
                "Calendar and billing sources behind the connect flows that already exist.",
                "The full VoiceOver and Dynamic Type pass.",
              ],
            },
            {
              k: "Exploring",
              items: [
                "An ambient mode for the iPad that never really turns off.",
                "Whether the household should be able to explain a decision back — “why me?”",
                "Trends that notice a change instead of drawing one.",
              ],
            },
          ].map((col) => (
            <Panel key={col.k} tone="wash" className="h-full">
              <p className="font-mono text-micro font-bold uppercase tracking-[0.14em] text-lemon">{col.k}</p>
              <ul className="mt-4 space-y-3">
                {col.items.map((i) => (
                  <li key={i} className="text-bodysm leading-relaxed text-white/70">{i}</li>
                ))}
              </ul>
            </Panel>
          ))}
        </div>
      </Section>

      <footer className="border-t border-white/10 py-12">
        <Wrap>
          <p className="text-bodysm text-white/60">
            Homeboard — a working prototype. This page is a route inside it:{" "}
            <code className="font-mono text-micro text-white/70">/case-study</code>, same build,
            same tokens, same store as the product embedded above.
          </p>
        </Wrap>
      </footer>
    </main>
  );
}
