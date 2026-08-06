"use client";

import type { ReactNode } from "react";
import clsx from "clsx";
import { Icon } from "@/components/Icons";
import { colors, radius } from "@/lib/tokens";

/**
 * THE DECISIONS THAT CHANGED DIRECTION.
 *
 * Not a bug list. Each of these moved a load-bearing rule and left the product
 * a different shape than the one it started as — the permission model, who the
 * app is allowed to volunteer, a question we stopped asking, what the second
 * device even is, and how the whole responsive layer measures itself.
 *
 * Every before/after is rebuilt from real tokens rather than described, because
 * the interesting part of "we removed a choice" is seeing the choice.
 */

/* ── shared furniture ──────────────────────────────────────────────────── */

function Frame({ tone, caption, children }: { tone: "before" | "after"; caption: string; children: ReactNode }) {
  const before = tone === "before";
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-2">
        <span
          className={clsx(
            "shrink-0 rounded-pill px-2 py-0.5 font-mono text-micro font-bold uppercase tracking-[0.12em]",
            before ? "bg-danger text-white" : "bg-lemon text-ink",
          )}
        >
          {before ? "Before" : "After"}
        </span>
        <span className="min-w-0 truncate text-caption text-white/60">{caption}</span>
      </div>
      <div className="mt-2 rounded-card bg-card p-card-pad">{children}</div>
    </div>
  );
}

function Story({
  n, title, belief, broke, rule, children,
}: {
  n: number; title: string;
  belief: string; broke: ReactNode; rule: string;
  children: ReactNode;
}) {
  return (
    <article className="border-t border-white/12 py-12 first:border-0 first:pt-0">
      {/* The number is set at the heading's own size. At micro it read as a
          footnote marker beside the thing it was numbering — these are five
          numbered decisions, so the count is part of the heading, not an
          annotation on it. Baseline-aligned, tabular, so the column of numbers
          down the section stays straight. */}
      <div className="flex items-baseline gap-3">
        <span className="font-tight text-h1 font-bold leading-tight text-lemon tabular-nums">
          {String(n).padStart(2, "0")}
        </span>
        <h3 className="font-tight text-h1 leading-tight text-white">{title}</h3>
      </div>

      {/* What we believed, stated plainly, before anything is shown. */}
      <p className="mt-4 max-w-[68ch] border-l-2 border-white/20 pl-4 text-body leading-relaxed text-white/60">
        <span className="font-mono text-micro font-bold uppercase tracking-[0.14em] text-white/60">
          We believed —{" "}
        </span>
        {belief}
      </p>

      <div className="mt-6 grid gap-4 md:grid-cols-2">{children}</div>

      <div className="mt-6 grid gap-5 md:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <div className="min-w-0">
          <p className="font-mono text-micro font-bold uppercase tracking-[0.14em] text-white/60">
            What that got wrong
          </p>
          <div className="mt-2 space-y-2 text-bodysm leading-relaxed text-white/65">{broke}</div>
        </div>
        <div className="min-w-0 self-start rounded-md bg-lemon/[.10] p-4">
          <p className="font-mono text-micro font-bold uppercase tracking-[0.14em] text-lemon">
            The rule now
          </p>
          <p className="mt-2 text-bodysm font-medium leading-relaxed text-white">{rule}</p>
        </div>
      </div>
    </article>
  );
}

/* ── small renderers ───────────────────────────────────────────────────── */

function Field({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div>
      <p className="font-mono text-micro font-bold uppercase tracking-[0.14em] text-sub">{label}</p>
      <div className="mt-1.5 flex items-center justify-between rounded-md bg-surface px-3 py-2">
        <span className="text-bodysm font-medium text-ink">{value}</span>
        <Icon name="chevDown" size={14} className="text-sub" />
      </div>
      {note && <p className="mt-1.5 text-micro text-sub">{note}</p>}
    </div>
  );
}

function Gate({ icon, label, detail }: { icon: "lock" | "kid"; label: string; detail: string }) {
  return (
    <div className="flex items-start gap-2.5 rounded-md bg-surface px-3 py-2.5">
      <span className="mt-0.5 shrink-0 text-ink"><Icon name={icon} size={14} /></span>
      <span className="min-w-0">
        <b className="block text-micro font-semibold text-ink">{label}</b>
        <span className="block text-micro text-sub">{detail}</span>
      </span>
    </div>
  );
}

function AssignRow({ task, who, colour, reason }: { task: string; who: string; colour: string; reason: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-pill bg-ink text-white">
        <Icon name="tasks" size={16} />
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

/** A crude wireframe block, for the IA comparisons. */
function Bar({ w = "100%", h = 10, tone = "ink" }: { w?: string; h?: number; tone?: "ink" | "mute" | "lemon" }) {
  const bg = tone === "lemon" ? colors.lemon : tone === "mute" ? "#E4E3EA" : colors.ink;
  return <span className="block" style={{ width: w, height: h, background: bg, borderRadius: 3 }} />;
}

/* ── the stories ───────────────────────────────────────────────────────── */

export function Stories() {
  return (
    <div>
      {/* 01 ─────────────────────────────────────────────────────────────── */}
      <Story
        n={1}
        title="&ldquo;Mum, Dad, Kid&rdquo; is not a permission model"
        belief="a household is a set of family roles, and what somebody may do follows from which one they are. Adults get everything; children get a simplified view; one flag on a task marks it adults-only."
        broke={
          <>
            <p>
              It fails on real homes immediately. The fifteen-year-old who runs the family budget. The
              grandparent who lives here and shouldn&rsquo;t be locked out of the heating. The au pair
              who needs the school run but not the bank card. The adult child who moved back in.
            </p>
            <p>
              And the single <code className="font-mono text-micro">adultOnly</code> flag was quietly
              doing two unrelated jobs: <em>may this person be held accountable for it</em> (money,
              contracts) and <em>can this person safely do it</em> (a hot oven, a chainsaw). One
              boolean, two questions — so it locked the sixteen-year-old out of the shopping card and
              let any visiting adult near the bleach.
            </p>
          </>
        }
        rule="Household type, identity, role and responsibility are four independent fields. Role is assigned, never derived — no code may write age &lt; 18 ? &ldquo;limited&rdquo; : &ldquo;full&rdquo;. A task carries two separate gates: requires (authority) and minAge (capability)."
      >
        <Frame tone="before" caption="one identity field, doing three jobs">
          <div className="space-y-3">
            <Field label="Member" value="Leo · Child" note="Relationship, life stage and access, all in one word." />
            <label className="flex items-center gap-2.5 rounded-md bg-surface px-3 py-2.5">
              <span className="grid h-4 w-4 shrink-0 place-items-center rounded-[4px] bg-ink text-white">
                <Icon name="check" size={11} />
              </span>
              <span className="text-micro text-ink">Adults only</span>
            </label>
            <p className="text-micro text-sub">
              The same checkbox guards the mortgage and the oven.
            </p>
          </div>
        </Frame>
        <Frame tone="after" caption="four fields, and two gates that ask different things">
          <div className="space-y-3">
            <Field label="Identity" value="Leo · person, 10" note="What someone is. Never a permission." />
            <Field label="Role" value="Tasks and chores" note="What someone may do. Assigned by an owner." />
            <div className="grid gap-2 sm:grid-cols-2">
              <Gate icon="lock" label="Requires" detail="Money, contracts or safety" />
              <Gate icon="kid" label="Ages 8+" detail="Can they physically do it" />
            </div>
          </div>
        </Frame>
      </Story>

      {/* 02 ─────────────────────────────────────────────────────────────── */}
      <Story
        n={2}
        title="The fairest algorithm we had kept picking the ten-year-old"
        belief="the kindest way to assign work is to give it to whoever is least busy. It is neutral, it is measurable, and nobody can argue with it."
        broke={
          <>
            <p>
              In a family, the person with the lightest day is always a child. So every task that
              hadn&rsquo;t been explicitly assessed — which is most of them, because they arrive as
              half-typed sentences — landed on Leo, aged ten. Including collecting his siblings.
            </p>
            <p>
              The fix that suggests itself is an age check, and it&rsquo;s the wrong one: it drags
              age back into permissions, which is the trap story 01 exists to close. The real
              insight was that an unassessed task isn&rsquo;t &ldquo;safe by default&rdquo; — it is{" "}
              <em>unknown</em>, and unknown work should only ever be volunteered to someone who could
              hold anything it turns out to be.
            </p>
          </>
        }
        rule="A task with no stated requirement has not been assessed, so it is only ever OFFERED to roles that can hold anything. Once work is assessed, a ten-year-old is a candidate like anyone else — which keeps children in the rota rather than exempt from it."
      >
        <Frame tone="before" caption="ranked purely by who had the lightest day">
          <div className="space-y-3">
            <AssignRow task="Collect the kids from school" who="Leo (10)" colour={colors.member.leo} reason="Lightest load — 2 tasks" />
            <AssignRow task="Renew the home insurance" who="Leo (10)" colour={colors.member.leo} reason="Lightest load — 2 tasks" />
          </div>
        </Frame>
        <Frame tone="after" caption="unassessed work goes to whoever can hold anything">
          <div className="space-y-3">
            <AssignRow task="Collect the kids from school" who="Sam" colour={colors.member.sam} reason="Lightest load — 10 tasks" />
            <AssignRow task="Renew the home insurance" who="Maya" colour={colors.member.maya} reason="Runs the bills" />
          </div>
        </Frame>
      </Story>

      {/* 03 ─────────────────────────────────────────────────────────────── */}
      <Story
        n={3}
        title="We stopped asking whether it was a task or an event"
        belief="tasks and events are genuinely different things, so the person adding one should tell us which they mean. It is one tap, and it keeps the data clean."
        broke={
          <>
            <p>
              The distinction is real — a task is work the household can redistribute, an event is a
              booked slot with a body in it — but it is <em>our</em> distinction, and asking made it
              the user&rsquo;s problem. Nobody adding &ldquo;dentist, Thursday&rdquo; is thinking
              about whether it is redistributable. They are thinking about the dentist.
            </p>
            <p>
              So the app classifies instead. Vocabulary, a named plan, a social arrangement, an
              amount of money — enough signal to decide, then say the decision out loud in the
              readback where it can be corrected in one tap. The choice didn&rsquo;t move; it
              stopped being asked.
            </p>
          </>
        }
        rule="Never make somebody understand our internal split to use the product. Infer it, state the inference in plain words, and make the correction cheap. The user types one sentence — the app decides what kind of thing it just heard."
      >
        <Frame tone="before" caption="the user resolves our data model first">
          <div className="space-y-3">
            <div className="flex gap-1.5">
              <span className="flex-1 rounded-pill bg-ink px-3 py-2 text-center text-micro font-semibold text-white">Task</span>
              <span className="flex-1 rounded-pill bg-surface px-3 py-2 text-center text-micro font-medium text-sub">Event</span>
            </div>
            <div className="rounded-md bg-surface px-3 py-2.5 text-bodysm text-sub">What needs doing?</div>
            <p className="text-micro text-sub">Two forms behind two different words for &ldquo;a thing on Thursday&rdquo;.</p>
          </div>
        </Frame>
        <Frame tone="after" caption="one field; the app says what it heard">
          <div className="space-y-3">
            <div className="rounded-md bg-surface px-3 py-2.5 text-bodysm font-medium text-ink">
              Leo&rsquo;s dentist Thursday at 4
            </div>
            <div className="rounded-md bg-card p-3 shadow-e1">
              <b className="block text-bodysm text-ink">Leo&rsquo;s dentist</b>
              <p className="mt-1 flex flex-wrap items-center gap-1 text-micro text-sub">
                <Icon name="spark" size={11} className="text-ink" />
                <span className="text-ink">Thursday</span>·<span className="text-ink">4:00 PM</span>·
                <span className="text-ink">Leo</span>
              </p>
              <p className="mt-1.5 flex items-center gap-1 text-micro text-sub">
                <Icon name="pin" size={11} /> Just Leo — this one can&rsquo;t be handed off.
              </p>
            </div>
          </div>
        </Frame>
      </Story>

      {/* 04 ─────────────────────────────────────────────────────────────── */}
      <Story
        n={4}
        title="The iPad stopped being a bigger phone"
        belief="one responsive application, two breakpoints. The tablet is the phone with more room — the same screens, laid out wider."
        broke={
          <>
            <p>
              The two devices are not two sizes of one reader. A phone is in a pocket and belongs to
              a person: it should answer <em>what do I owe the house today</em>. The iPad is on a
              wall in a kitchen and belongs to the room: nobody is logged into it, and the question
              it answers is <em>how is this household doing</em>.
            </p>
            <p>
              Once that was said out loud the layouts stopped being versions of each other. The
              board grew a screen the phone doesn&rsquo;t have (the whole household, by person, with
              the load between them) and lost the one the phone is built around (a personal tab —
              the iPad is never a person). The phone kept the day; the iPad got the week on the wall.
            </p>
          </>
        }
        rule="They are two applications over one truth, not one application at two widths. A screen exists on a surface because that surface's question needs it — the shared tab list is a coincidence, not a requirement."
      >
        <Frame tone="before" caption="the same personal list, stretched">
          <div className="flex gap-3">
            <div className="w-[86px] shrink-0 space-y-1.5 rounded-md bg-surface p-2">
              <Bar w="60%" h={7} tone="mute" />
              <Bar w="100%" h={16} tone="lemon" />
              <Bar w="100%" h={10} tone="mute" />
              <Bar w="100%" h={10} tone="mute" />
            </div>
            <div className="min-w-0 flex-1 space-y-1.5 rounded-md bg-surface p-2">
              <Bar w="40%" h={7} tone="mute" />
              <Bar w="100%" h={16} tone="lemon" />
              <Bar w="100%" h={10} tone="mute" />
              <Bar w="100%" h={10} tone="mute" />
              <Bar w="70%" h={10} tone="mute" />
            </div>
          </div>
          <p className="mt-2.5 text-caption text-sub">
            More width, identical information. The room learns nothing the pocket didn&rsquo;t know.
          </p>
        </Frame>
        <Frame tone="after" caption="a different screen, for a different question">
          <div className="space-y-2">
            <div className="flex gap-1.5">
              {["Morning", "Afternoon", "Evening"].map((t) => (
                <div key={t} className="min-w-0 flex-1 space-y-1.5 rounded-md bg-surface p-2">
                  <p className="truncate text-micro font-bold uppercase tracking-wide text-sub">{t}</p>
                  <Bar w="100%" h={9} tone="mute" />
                  <Bar w="80%" h={9} tone="mute" />
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2 rounded-md bg-surface p-2">
              {Object.values(colors.member).slice(0, 4).map((c) => (
                <span key={c} className="h-5 w-5 shrink-0 rounded-pill" style={{ background: c }} />
              ))}
              <span className="ml-1 min-w-0 flex-1"><Bar w="100%" h={8} tone="mute" /></span>
            </div>
          </div>
          <p className="mt-2.5 text-micro text-sub">
            The day by time-of-day, and the people carrying it — neither exists on the phone.
          </p>
        </Frame>
      </Story>

      {/* 05 ─────────────────────────────────────────────────────────────── */}
      <Story
        n={5}
        title="The viewport was never the device"
        belief="a media query knows how wide the iPad is, so `lg:` and `vh` are the natural way to lay it out — the same tools that work everywhere else on the web."
        broke={
          <>
            <p>
              The iPad renders at true logical size, 1194 × 834, inside a{" "}
              <code className="font-mono text-micro">transform: scale()</code> that fits it to
              whatever window is open. Transforms do not affect layout — so a media query reports
              the <em>browser window</em>, and never once reports the device it is supposedly
              describing.
            </p>
            <p>
              Which meant the layout was correct only when the window happened to match the iPad.
              Worse, the failure was silent and analogue: it always rendered something, just the
              wrong something, so it read as a spacing bug rather than a measurement bug. It came
              back three separate times before the cause was named — a nav overlapping a card
              because a <code className="font-mono text-micro">vh</code> unit had measured the
              browser and not the screen the nav floats over.
            </p>
          </>
        }
        rule="Anything that must know how big the DEVICE is asks a container, not the viewport. Container queries (@[1024px]:) and fixed px only — no lg:, no vh, no vw inside the frame."
      >
        <Frame tone="before" caption="a vh-sized element, measured against the browser">
          <div className="relative h-[104px] overflow-hidden rounded-md bg-surface p-2">
            <div className="space-y-1.5">
              <Bar w="55%" h={8} tone="mute" />
              <Bar w="100%" h={30} tone="lemon" />
              <Bar w="86%" h={10} tone="mute" />
            </div>
            {/* the nav, landing on top of the content it was meant to clear */}
            <div className="absolute inset-x-6 bottom-3 flex h-8 items-center justify-center rounded-pill bg-ink shadow-e2">
              <span className="text-micro font-bold uppercase tracking-wide text-white">nav</span>
            </div>
            <span className="absolute bottom-1 right-2 font-mono text-micro text-danger">overlap</span>
          </div>
        </Frame>
        <Frame tone="after" caption="the container answers, so the clearance is real">
          <div className="relative h-[104px] overflow-hidden rounded-md bg-surface p-2">
            <div className="space-y-1.5">
              <Bar w="55%" h={8} tone="mute" />
              <Bar w="100%" h={24} tone="lemon" />
              <Bar w="86%" h={8} tone="mute" />
            </div>
            <div className="absolute inset-x-6 bottom-3 flex h-8 items-center justify-center rounded-pill bg-ink shadow-e2">
              <span className="text-micro font-bold uppercase tracking-wide text-white">nav</span>
            </div>
          </div>
        </Frame>
      </Story>
    </div>
  );
}
