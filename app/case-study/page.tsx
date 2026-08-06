"use client";

import type { ReactNode } from "react";
import { Head, Panel, Sample, Section, Wrap } from "@/case-study/kit";
import { Hero } from "@/case-study/Hero";
import { Embed } from "@/case-study/Embed";
import { Stories } from "@/case-study/Stories";
import {
  ColourSpecimen, ElevationSpecimen, MotionSpecimen, SpaceSpecimen, TypeSpecimen,
} from "@/case-study/Specimens";
import { REPO } from "@/case-study/facts.generated";
import { AUDIT } from "@/case-study/audit";
import { tokenCounts } from "@/lib/tokens";
import { FEATURED, JOURNEYS } from "@/lib/journeys";

/**
 * The case study. A real route in the real app — same build, same origin, same
 * design tokens, and the product itself mounted live in the middle of it.
 */

function Figure({ n, label }: { n: string; label: string }) {
  return (
    <div className="min-w-0">
      <p className="font-tight text-[clamp(30px,4vw,46px)] leading-none tracking-tight text-white tabular-nums">{n}</p>
      <p className="mt-2 text-bodysm leading-snug text-white/60">{label}</p>
    </div>
  );
}

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
    <Panel tone="wash" className="flex h-full flex-col">
      <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-white/60">
        Finding {String(n).padStart(2, "0")}
      </p>

      <blockquote className="mt-3 border-l-2 border-lemon pl-4 text-body leading-relaxed text-white/90">
        {quote}
      </blockquote>
      <p className="mt-3 pl-4 text-micro leading-[16px] text-white/60">{attribution}</p>

      <div className="mt-6 rounded-md bg-lemon/[.10] p-3">
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-lemon">
          The decision it drove
        </p>
        <p className="mt-2 text-bodysm leading-relaxed text-white">{decision}</p>
      </div>

      <a
        href={href}
        target="_blank"
        rel="noreferrer noopener"
        className="mt-auto flex items-center gap-1.5 border-t border-white/12 pt-4 text-micro font-medium text-white/60 transition-colors hover:text-lemon"
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

      {/* ── AT A GLANCE ─────────────────────────────────────────────────── */}
      <Section id="glance">
        <Head
          label="At a glance"
          title="What&rsquo;s actually here"
          standfirst={
            <>
              Every figure below is measured from this repository at build time, not written by
              hand — a script computes them and the test suite recomputes them on every run, so a
              number on this page cannot quietly go stale.
            </>
          }
        />
        <div className="mt-10 grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3 lg:grid-cols-6">
          <Figure n={`${REPO.commits}`} label="commits, and counting" />
          <Figure n={REPO.lines.toLocaleString()} label="lines of TypeScript across two surfaces" />
          <Figure n={`${REPO.components}`} label="React components" />
          <Figure n={`${tokenCounts.colorValues}`} label="colour values in the palette" />
          <Figure n={`${JOURNEYS.length}`} label={`deep-linkable journeys, ${FEATURED.length} featured here`} />
          <Figure n={`${REPO.testFiles}`} label="test files guarding the rules below" />
        </div>
      </Section>

      {/* ── THE PRODUCT, RUNNING ────────────────────────────────────────── */}
      <Section id="product">
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
        <div className="mt-10">
          <Embed />
        </div>
      </Section>

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
        <div className="mt-10 grid gap-tile md:grid-cols-3">
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
                The product does the anticipating: it detects a double-booking or work stranded on
                someone who&rsquo;s away <em>before</em> anyone notices, and offers the resolution
                rather than a notification.
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
                place — yet it&rsquo;s still the shape most products are built around.
              </>
            }
            decision={
              <>
                Relationships never determine permissions. Household type, identity, role and
                responsibility are four independent fields; a fifteen-year-old may hold full access
                and a forty-year-old may be guided. No code derives a role from an age.
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
                  <b className="text-white/80">What it claims:</b> the figures in &ldquo;At a
                  glance&rdquo; match the repository as it stands right now.
                </p>
                <p>
                  <b className="text-white/80">How:</b> it recounts the lines, the components and the
                  commits straight from the working tree, then compares them to the numbers this page
                  prints. Commits are checked as a floor, because that figure only ever rises.
                </p>
                <p>
                  <b className="text-white/80">Why it matters:</b> stats on a portfolio page rot
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
              {AUDIT.tool} against the {AUDIT.ruleset} ruleset, run on this page in a real browser at{" "}
              {AUDIT.viewports.join(" and ")}, {AUDIT.date} — with {AUDIT.measuredWith}. Neither
              viewport is uniformly worse, so both are published and the headline numbers take the
              unflattering half of each:{" "}
              {AUDIT.product.byViewport.map((v) => `${v.viewport} → ${v.nodes} nodes, worst ${v.worst}:1`).join("; ")}.
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
              <p className="mt-1 text-micro text-ink/75">type, cards, specimens, hero, controls</p>
            </Panel>
            {/* The second number is the point. Rounding these into the first
                would let the article hide behind the product. */}
            <Panel tone="wash">
              <p className="font-tight text-[56px] leading-none tracking-tight text-white tabular-nums">
                {AUDIT.product.nodes}
              </p>
              <p className="mt-2 text-bodysm font-medium text-white">
                elements failing inside the embedded product
              </p>
              <p className="mt-1 text-micro text-white/60">
                all one rule — colour contrast — worst {AUDIT.product.worst}:1
              </p>
            </Panel>
          </div>
          <Panel tone="wash">
            <p className="text-bodysm font-medium text-white">
              What the embedded product is failing on — and what neither number means
            </p>

            {/* Named, not summarised. A count with no list is a number you can't
                act on, and the whole reason to split the figures was to stop
                the failures disappearing into an average. */}
            <ul className="mt-3 space-y-2.5 border-b border-white/12 pb-4">
              {AUDIT.product.findings.map((f) => (
                <li key={f.what} className="text-bodysm leading-relaxed text-white/60">
                  <span className="font-medium text-white">{f.what}</span>{" "}
                  <span className="whitespace-nowrap font-mono text-[11px] text-lemon">{f.ratio}</span>
                  <span className="mt-0.5 block">{f.why}</span>
                </li>
              ))}
            </ul>

            <ul className="mt-4 space-y-2.5 text-bodysm leading-relaxed text-white/60">
              <li>
                <b className="text-white/80">Two of those were fixed in the palette, and shipped.</b>{" "}
                Writing the contrast tests for this page turned them on the product and found{" "}
                <code className="font-mono text-[12px] text-white/75">sub</code> at 3.28:1 on a
                lavender card and <code className="font-mono text-[12px] text-white/75">danger</code>{" "}
                at 3.91:1 on white. Both swatches were darkened rather than the text lightened. The
                misses listed above are the ones that remain — opacity applied to good tokens, and
                one genuine bug — and they belong to the a11y pass still on the backlog.
              </li>
              <li>
                <b className="text-white/80">It isn&rsquo;t &ldquo;accessible.&rdquo;</b> Automated
                rules catch a minority of WCAG criteria. Nobody has tested this page with a screen
                reader end to end, and no assistive-technology user has reviewed it.
              </li>
              <li>
                <b className="text-white/80">The mounted boards add heading-ones of their own.</b>{" "}
                Each iPad shell greets the room, and that greeting is its page title — so with the
                embed and the two-surface section this document can carry three: the headline you
                started at, plus up to two boards. Multiple h1s are valid HTML5 and axe reports
                nothing, but the count is pinned by a test rather than suppressed, because the
                honest thing is to know the number.
              </li>
              <li>
                <b className="text-white/80">Contrast is checked at the worst case,</b> not the
                average: colour pairs are compared against the lightest surface each sits on, and the
                hero&rsquo;s type is measured against its veil rather than the artwork behind it.
              </li>
              <li>
                <b className="text-white/80">Reduced motion is honoured</b> app-wide via{" "}
                <code className="font-mono text-[12px] text-white/75">MotionConfig reducedMotion=&quot;user&quot;</code>,
                with one known gap: the avatars blink using SVG SMIL, which the CSS reduced-motion
                override doesn&rsquo;t reach.
              </li>
            </ul>
          </Panel>
        </div>
      </Section>

      {/* ── NEXT ────────────────────────────────────────────────────────── */}
      <Section id="next">
        <Head
          label="Where this goes next"
          title="Built as a prototype, on purpose"
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
            <code className="font-mono text-[12px] text-white/70">/case-study</code>, same build,
            same tokens, same store as the product embedded above.
          </p>
        </Wrap>
      </footer>
    </main>
  );
}
