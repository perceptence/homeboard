"use client";

import type { ReactNode } from "react";
import clsx from "clsx";
import { Face } from "@/components/Face";
import { Icon } from "@/components/Icons";
import { colors, radius } from "@/lib/tokens";
import { Label } from "./kit";

/**
 * WHERE IT NEARLY CAME APART.
 *
 * Five problems that changed a rule. Each one renders its own before and after
 * from real tokens — the broken state is reconstructed, not described, because
 * a paragraph about a misaligned ring is much less convincing than the ring.
 */

function Frame({ tone, caption, children }: { tone: "before" | "after"; caption: string; children: ReactNode }) {
  const before = tone === "before";
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-2">
        <span
          className={clsx(
            "rounded-pill px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.12em]",
            // Solid fill, not a tint: danger on a danger-tint measured 3.46:1.
            before ? "bg-danger text-white" : "bg-lemon text-ink",
          )}
        >
          {before ? "Before" : "After"}
        </span>
        <span className="min-w-0 truncate text-micro text-white/60">{caption}</span>
      </div>
      <div className="mt-2 rounded-card bg-card p-card-pad">{children}</div>
    </div>
  );
}

function Story({
  n, title, rule, children, reading, mattered,
}: {
  n: number; title: string; rule: string;
  children: ReactNode; reading: ReactNode; mattered: string;
}) {
  return (
    <article className="border-t border-white/12 py-10 first:border-0 first:pt-0">
      <div className="flex items-baseline gap-3">
        <span className="font-mono text-micro font-bold text-lemon">{String(n).padStart(2, "0")}</span>
        <h3 className="font-tight text-h1 leading-tight text-white">{title}</h3>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">{children}</div>

      <div className="mt-5 grid gap-5 md:grid-cols-2">
        <div>
          <Label className="!text-white/60">What happened</Label>
          <div className="mt-2 space-y-2 text-bodysm leading-relaxed text-white/65">{reading}</div>
        </div>
        <div>
          <Label className="!text-white/60">Why it mattered</Label>
          <p className="mt-2 text-bodysm leading-relaxed text-white/65">{mattered}</p>
          <p className="mt-3 rounded-md bg-lemon/10 px-3 py-2 text-bodysm font-medium text-lemon">
            Rule it changed — {rule}
          </p>
        </div>
      </div>
    </article>
  );
}

/* ── 1. the ring that wasn't round ─────────────────────────────────────── */

function RingRow({ broken }: { broken: boolean }) {
  const ids = ["maya", "sam", "leo", "ada"];
  return (
    <span className="flex -space-x-2">
      {ids.map((id) => (
        <span
          key={id}
          // The whole bug, preserved: without `inline-flex` this span is an
          // inline box, so it inherits a line-box strut and stands ~6px taller
          // than it is wide. rounded-pill on a non-square box is a stadium.
          className={clsx("rounded-pill ring-2 ring-card", !broken && "inline-flex")}
          style={{ boxShadow: `0 0 0 2px ${colors.card}` }}
        >
          <Face id={id} size={30} />
        </span>
      ))}
    </span>
  );
}

/* ── 2. the balancer's pick ────────────────────────────────────────────── */

function AssignRow({ task, who, colour, reason }: { task: string; who: string; colour: string; reason: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-pill bg-ink text-white">
        <Icon name="tasks" size={18} />
      </span>
      <span className="min-w-0 flex-1">
        <b className="block truncate text-bodysm text-ink">{task}</b>
        <span className="text-micro text-sub">{reason}</span>
      </span>
      <span className="flex shrink-0 items-center gap-1.5 rounded-pill bg-surface py-1 pl-1 pr-2.5">
        <span className="h-6 w-6 rounded-pill" style={{ background: colour }} />
        <span className="text-micro font-medium text-ink">{who}</span>
      </span>
    </div>
  );
}

/* ── 3. a figure with the wrong window ─────────────────────────────────── */

function Stat({ pct, label, sub }: { pct: number; label: string; sub: string }) {
  return (
    <div className="flex items-end gap-4">
      <div className="min-w-0 flex-1">
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-sub">{label}</p>
        <p className="mt-1 text-bodysm text-ink">The house is finishing most of what it&rsquo;s asked.</p>
        <p className="mt-1 text-micro text-sub">{sub}</p>
      </div>
      <span className="shrink-0 font-tight text-[44px] leading-none tracking-tight text-ink">{pct}%</span>
    </div>
  );
}

export function Stories() {
  return (
    <div>
      <Story
        n={1}
        title="A ring that was never round"
        rule="a wrapper that hugs artwork is inline-flex, never a bare span."
        reading={
          <>
            <p>
              The four faces in Settings wore rings that looked subtly wrong and nobody could say why.
              Measuring the wrapper gave it away: <b className="text-white">29.3 × 35.6px</b>. Not square.
            </p>
            <p>
              A bare <code className="font-mono text-[11px]">span</code> is an inline box, so it inherits a
              line-box strut — roughly six pixels of invisible text leading. The avatar inside was a perfect
              circle; the box around it was a stadium, and so was the ring.
            </p>
          </>
        }
        mattered="It read as sloppiness on the one screen that shows the family. And it was invisible to screenshots — the ring is 2px, the error 6px, and both sit under a rounded corner. Only measurement found it."
      >
        <Frame tone="before" caption="wrapper: 29.3 × 35.6 — a stadium">
          <RingRow broken />
        </Frame>
        <Frame tone="after" caption="wrapper: 29.3 × 29.3 — concentric">
          <RingRow broken={false} />
        </Frame>
      </Story>

      <Story
        n={2}
        title="The load balancer kept picking the ten-year-old"
        rule="unassessed work is only ever offered to someone who can hold anything."
        reading={
          <>
            <p>
              The suggestion engine ranked whoever had the lightest day. In a family, the lightest day
              always belongs to a child — so <em>every</em> task with no explicit requirement landed on Leo,
              aged ten. Including picking up his siblings.
            </p>
            <p>
              The fix wasn&rsquo;t an age check. Age is a capability, not a permission. A task with no
              stated requirement simply hasn&rsquo;t been assessed yet, so it&rsquo;s only offered to roles
              that can hold anything. Once work <em>is</em> assessed, a ten-year-old is a candidate like
              anyone else — which is what keeps children in the rota rather than exempt from it.
            </p>
          </>
        }
        mattered="A recommendation engine that quietly routes real responsibility to whoever is least able to refuse isn't a scheduling bug — it's the product making a claim about who a household is for."
      >
        <Frame tone="before" caption="ranked purely by who was least busy">
          <div className="space-y-3">
            <AssignRow task="Pick up the kids" who="Leo (10)" colour={colors.member.leo} reason="Lightest load — 2 tasks" />
            <AssignRow task="Renew home insurance" who="Leo (10)" colour={colors.member.leo} reason="Lightest load — 2 tasks" />
          </div>
        </Frame>
        <Frame tone="after" caption="unvetted work goes to roles that can hold anything">
          <div className="space-y-3">
            <AssignRow task="Pick up the kids" who="Sam" colour={colors.member.sam} reason="Lightest load — 10 tasks" />
            <AssignRow task="Renew home insurance" who="Maya" colour={colors.member.maya} reason="Runs the bills" />
          </div>
        </Frame>
      </Story>

      <Story
        n={3}
        title="A headline figure that only lied once there was history"
        rule="a number with a time word in its label must be windowed by that word."
        reading={
          <>
            <p>
              The family board showed a finish rate under the label &ldquo;Last 30 days.&rdquo; It was
              computed as done ÷ all tasks, ever — no date filter anywhere in it.
            </p>
            <p>
              For months this looked perfectly reasonable, because the seeded household only had a
              few days of history and the two numbers happened to agree. It only became a lie when the
              trend chart arrived and backfilled months of completed work: the figure drifted toward 100%
              and stayed there, because finished history accumulates and open work doesn&rsquo;t.
            </p>
          </>
        }
        mattered="The bug was written long before it was wrong. Nothing about the code changed on the day it started lying — the data grew into it. That's the kind of fault a test written against a small fixture will never catch."
      >
        <Frame tone="before" caption="done ÷ every task ever recorded">
          <Stat pct={92} label="Last 30 days" sub="No date filter. Rises forever as history accrues." />
        </Frame>
        <Frame tone="after" caption="completed in-window ÷ (completed + still open) in-window">
          <Stat pct={72} label="This month" sub="Windowed — and the label now names the window it uses." />
        </Frame>
      </Story>

      <Story
        n={4}
        title="A comment that manufactured the bug it warned about"
        rule="document a class-name collision by describing it, never by spelling it."
        reading={
          <>
            <p>
              Moving the design tokens into their own module was meant to be a pure refactor. The generated
              CSS was byte-compared before and after to prove it — and it came back{" "}
              <b className="text-white">73 bytes heavier</b>.
            </p>
            <p>
              The extra bytes were a real utility class, built from a <em>comment</em>. Tailwind&rsquo;s
              content scanner reads raw file text, so the moment a note explaining that an elevation named{" "}
              <em>card</em> would collide with the colour of the same name moved into a scanned file, the
              scanner treated the spelled-out example as a class someone wanted and emitted it.
            </p>
          </>
        }
        mattered="It's the smallest defect here and the one most worth keeping. Nobody would have noticed 73 bytes; it was only caught because the refactor was verified by comparing output rather than by reading the diff and feeling confident."
      >
        <Frame tone="before" caption="the warning, spelled out in a scanned file">
          <pre tabIndex={0} className="no-scrollbar overflow-x-auto whitespace-pre-wrap break-words text-[11px] leading-[17px] text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink">
{`/* names must not collide, or Tailwind
   reads \`shadow-card\` as a COLOUR */`}
          </pre>
          {/* The tint carries the "this is the bad one" signal; the text stays
              ink. Danger-on-danger-tint measured 4.32:1 — under AA for 11px. */}
          <p className="mt-3 rounded-md bg-danger/10 px-3 py-2 font-mono text-[11px] text-ink">
            + .shadow-card&#123;--tw-shadow-color:#fff&#125;
            <span className="mt-1 block text-sub">39,574 bytes — 73 more than before</span>
          </p>
        </Frame>
        <Frame tone="after" caption="the same warning, describing rather than quoting">
          <pre tabIndex={0} className="no-scrollbar overflow-x-auto whitespace-pre-wrap break-words text-[11px] leading-[17px] text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink">
{`/* an elevation named \`card\` would make
   Tailwind build a white shadow instead */`}
          </pre>
          <p className="mt-3 rounded-md bg-lemon/25 px-3 py-2 font-mono text-[11px] text-ink">
            no extra rules
            <span className="mt-1 block text-sub">39,501 bytes — byte-identical to before</span>
          </p>
        </Frame>
      </Story>

      <Story
        n={5}
        title="Two true sentences that couldn't both be true"
        rule="&ldquo;caught up&rdquo; means the day is clear, not that one list is empty."
        reading={
          <>
            <p>
              Finish your last task while two events still overlap, and the phone said{" "}
              <em>You&rsquo;re all caught up</em> directly above a warning that you were double-booked.
              Both lines were correct in isolation. Together they were nonsense.
            </p>
            <p>
              The greeting was reading one list — open tasks — and calling it the day. The clash detector
              was reading the calendar. Nothing was broken; the two had simply never been asked to agree
              on what &ldquo;clear&rdquo; meant.
            </p>
          </>
        }
        mattered="A product that contradicts itself in the same glance stops being trusted for the things it gets right. This one only appeared after finishing every task — the state a demo rarely reaches and a real Tuesday evening reaches constantly."
      >
        <Frame tone="before" caption="two lines, one screen">
          <div className="rounded-md bg-lemon p-4">
            <p className="font-tight text-[26px] leading-tight text-ink">
              You&rsquo;re all <span className="font-medium">caught up</span>
            </p>
            <p className="mt-3 flex items-center gap-1.5 text-bodysm font-medium text-danger">
              You&rsquo;re double-booked <Icon name="high" size={14} />
            </p>
          </div>
        </Frame>
        <Frame tone="after" caption="the headline defers to the calendar">
          <div className="rounded-md bg-lemon p-4">
            <p className="font-tight text-[26px] leading-tight text-ink">
              Nothing to <span className="font-medium">tick off</span>
              <span className="block">for today</span>
            </p>
            <p className="mt-3 flex items-center gap-1.5 text-bodysm font-medium text-danger">
              You&rsquo;re double-booked <Icon name="high" size={14} />
            </p>
          </div>
        </Frame>
      </Story>
    </div>
  );
}
