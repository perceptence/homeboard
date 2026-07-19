"use client";

import clsx from "clsx";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Icon, type IconName } from "@/components/Icons";
import { SAFE_TOP } from "@/components/DeviceFrame";
import { Button, Card, Eyebrow, IconTile, Pill, TitleBlock } from "@/components/ui";
import { smooth, spring } from "@/lib/motion";
import { PALETTE, PRESETS, useHousehold } from "@/lib/store";
import type { HouseholdPreset, Role } from "@/lib/types";
import { ROLE_HINT, ROLE_LABEL } from "@/lib/types";

const STEPS = ["Welcome", "Your home", "Who lives here", "What to run", "Invite", "Ready"];

/** Presets are SHORTCUTS — each one just sets the axes and suggests a cast (see
 *  store PRESETS). Nothing downstream knows which was picked, so this list can
 *  grow or shrink without touching a line of app logic. */
const PRESET_ICON: Record<HouseholdPreset, IconName> = {
  family: "people", couple: "heart", roommates: "house", solo: "user",
};

const DOMAINS: { id: string; icon: IconName }[] = [
  { id: "Chores", icon: "tasks" }, { id: "Shopping", icon: "cart" }, { id: "Bills", icon: "bill" },
  { id: "Maintenance", icon: "wrench" }, { id: "Kids", icon: "kid" }, { id: "Pets", icon: "pet" },
  { id: "Calendar", icon: "cal" }, { id: "Inventory", icon: "box" },
];

/** Kills the browser's default rectangular outline (the "blue box") on raw
 *  buttons; an ink ring on keyboard focus instead, matching the pill/rounded
 *  shape it's drawn around. */
const FOCUS = "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";

/** Pill, translated for the near-black backdrop — `tag`'s ink-on-ink wash
 *  disappears out here, and `text-sub` is a light-surface gray. */
function DarkPill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex h-7 items-center gap-1 whitespace-nowrap rounded-pill bg-white/10 px-2.5 text-caption font-medium text-white/70">
      {children}
    </span>
  );
}

export function Onboarding() {
  const s = useHousehold();
  const d = s.onboarding;
  const step = d.step;
  // The device frame is scaled, so CSS breakpoints can't see its width — read
  // the surface from the persona and adapt the few tablet-only layouts by hand.
  const phone = s.persona !== "ipad";
  // Which drafts have had their invite "sent" — the button flips to confirmed.
  const [sent, setSent] = useState<Set<string>>(() => new Set());

  const named = d.people.filter((p) => p.name.trim());
  const people = named.filter((p) => p.kind !== "pet").length || 1;
  const canContinue =
    step === 1 ? d.householdName.trim().length > 0 :
    step === 2 ? named.length > 0 :
    step === 3 ? d.domains.length > 0 :
    true;

  const next = () => (step === STEPS.length - 1 ? s.completeOnboarding() : s.setStep(step + 1));

  return (
    <div className="absolute inset-0 flex flex-col bg-ink text-white">
      {/* progress */}
      <div className="flex items-center gap-3 px-7" style={{ paddingTop: phone ? SAFE_TOP + 12 : 24 }}>
        {/* Fixed-width slot, always in the flow — even on step 0, where the
            button is merely invisible. The track beside it must never resize
            when Back mounts, or every segment visibly jumps on step 1→2. */}
        <button
          onClick={() => s.setStep(step - 1)}
          aria-label="Back"
          tabIndex={step > 0 ? 0 : -1}
          className={clsx(
            "grid h-touch w-touch shrink-0 place-items-center rounded-pill bg-white/10 text-white transition-colors hover:bg-white/[.16]",
            step > 0 ? "opacity-100" : "pointer-events-none opacity-0",
          )}
        >
          <Icon name="back" size={16} />
        </button>
        <div className="flex flex-1 gap-1.5">
          {STEPS.map((_, i) => (
            <div key={i} className="h-1.5 flex-1 overflow-hidden rounded-pill bg-white/[.12]">
              <motion.div
                className="h-full rounded-pill bg-lemon"
                initial={false}
                animate={{ width: i <= step ? "100%" : "0%" }}
                transition={{ duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }}
              />
            </div>
          ))}
        </div>
        <span className="shrink-0 text-caption uppercase tracking-[0.08em] text-white/45">
          {step + 1}/{STEPS.length}
        </span>
      </div>

      <div className="no-scrollbar flex-1 overflow-y-auto overscroll-contain px-7 py-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={spring}
          >
            {step === 0 && (
              <div className="pt-6">
                <motion.span
                  className="inline-block"
                  initial={{ rotate: -12, scale: 0.6, opacity: 0 }}
                  animate={{ rotate: 0, scale: 1, opacity: 1 }}
                  transition={spring}
                >
                  <Icon name="house" size={44} />
                </motion.span>
                <h1 className="mt-5 max-w-[16ch] text-balance font-tight text-display">
                  Let&rsquo;s take running your home <span className="bg-lemon px-1 text-ink">off your plate.</span>
                </h1>
                <p className="mt-4 max-w-[38ch] text-body text-white/55">
                  Two minutes now, and the house starts carrying itself. No spreadsheets,
                  no chore chart, no nagging — it just runs.
                </p>
                <div className="mt-6 flex gap-2">
                  <DarkPill><Icon name="bolt" size={12} /> Takes ~2 min</DarkPill>
                  <DarkPill><Icon name="lock" size={12} /> Private by default</DarkPill>
                </div>
              </div>
            )}

            {step === 1 && (
              <div>
                <TitleBlock
                  size="page" tone="onDark" wrap
                  eyebrow="The basics"
                  title="What do we call this place?"
                />
                <input
                  autoFocus
                  value={d.householdName}
                  onChange={(e) => s.setHouseholdName(e.target.value)}
                  placeholder="The Rivera Home, Basecamp, The Nest…"
                  className="mt-5 w-full rounded-md border border-black/[.08] bg-card px-4 py-4 text-h2 text-ink outline-none placeholder:text-sub/60 focus:border-ink"
                />
                <Eyebrow tone="onDark" className="mt-8">Who shares it?</Eyebrow>
                <div className={clsx("mt-3 grid gap-3", phone ? "grid-cols-2" : "grid-cols-4")}>
                  {(Object.keys(PRESETS) as HouseholdPreset[]).map((id) => (
                    <button key={id} onClick={() => s.setPreset(id)} className="text-left">
                      <Card tone={d.preset === id ? "lemon" : "white"} pad="md">
                        <Icon name={PRESET_ICON[id]} size={24} />
                        <div className="mt-2 text-body font-medium">{PRESETS[id].label}</div>
                        <div className="text-caption text-sub">{PRESETS[id].blurb}</div>
                      </Card>
                    </button>
                  ))}
                </div>

                {/* The axes, in the open. A preset is a starting point, not a
                    category you get filed under — so the two things it actually
                    sets are editable right here, and a home that matches no
                    preset is a first-class household rather than a wrong answer. */}
                <Eyebrow tone="onDark" className="mt-8">How it runs</Eyebrow>
                <div className="mt-3 flex flex-col gap-2">
                  <AxisRow
                    label="Money"
                    hint={d.axes.money === "pooled" ? "One pot — a bill is just a bill" : "Separate — expenses get split into shares"}
                    options={[["pooled", "Shared"], ["split", "Split"]]}
                    value={d.axes.money}
                    onPick={(v) => s.setAxis({ money: v as "pooled" | "split" })}
                  />
                  <AxisRow
                    label="Anyone looked after?"
                    hint={d.axes.dependents ? "Guided access and stars are available" : "Everyone here manages themselves"}
                    options={[["yes", "Yes"], ["no", "No"]]}
                    value={d.axes.dependents ? "yes" : "no"}
                    onPick={(v) => s.setAxis({ dependents: v === "yes" })}
                  />
                </div>
              </div>
            )}

            {step === 2 && (
              <div>
                <TitleBlock
                  size="page" tone="onDark" wrap
                  eyebrow="The cast"
                  title="Who's home?"
                  subtext="Everyone in — the work gets split fairly. Pets welcome; they mostly supervise."
                />

                <div className="mt-5 flex flex-col gap-2.5">
                  {d.people.map((p, i) => (
                    <motion.div key={p.id} layout>
                      <Card pad="md">
                        {/* Row 1 — WHO. The name owns the whole line: with the
                            access pill sharing it, a name longer than ~5
                            letters was clipping against a truncated pill and
                            neither survived. */}
                        <div className="flex items-center gap-3">
                          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-pill text-body font-medium text-white"
                            style={{ background: PALETTE[i % PALETTE.length] }}>
                            {p.name.trim() ? p.name.trim()[0].toUpperCase() : "?"}
                          </span>
                          <input
                            value={p.name}
                            onChange={(e) => s.updatePerson(p.id, { name: e.target.value })}
                            placeholder={p.kind === "pet" ? "Pet's name" : "Name"}
                            className="min-w-0 flex-1 bg-transparent text-h2 outline-none placeholder:text-sub/60"
                          />
                          {/* Age is a CAPABILITY datum — it gates tasks with a
                              minimum age (sharp, hot, heavy), nothing else. It
                              never sets the role, and it's optional. Offered on
                              the reduced-access roles because that's where a
                              minAge is likely to bite, not because those roles
                              mean "child". */}
                          {p.kind === "person" && (p.role === "guided" || p.role === "limited") && (
                            <input
                              type="number"
                              value={p.age ?? ""}
                              onChange={(e) => s.updatePerson(p.id, { age: e.target.value ? Number(e.target.value) : undefined })}
                              placeholder="Age"
                              className="w-16 shrink-0 rounded-sm bg-surface px-2 py-1.5 text-center text-bodysm font-medium outline-none placeholder:text-sub/60"
                              aria-label={`Age (optional) — used only to check task suitability`}
                            />
                          )}
                          {d.people.length > 1 && (
                            <button
                              onClick={() => s.removePerson(p.id)}
                              aria-label={`Remove ${p.name || "person"}`}
                              className="grid h-7 w-7 shrink-0 place-items-center rounded-pill text-sub hover:bg-surface hover:text-ink"
                            >
                              <Icon name="x" size={14} />
                            </button>
                          )}
                        </div>
                        {/* Row 2 — WHAT THEY MAY DO, spelled out with its hint
                            instead of squeezed into a pill. */}
                        {p.kind === "pet" ? (
                          <div className="mt-3 flex items-center justify-between border-t border-ink/[.06] pt-3">
                            <span className="text-caption text-sub">Supervises, mostly</span>
                            <Pill tone="tag">Pet</Pill>
                          </div>
                        ) : (
                          <AccessRow value={p.role} onPick={(role) => s.updatePerson(p.id, { role })} />
                        )}
                      </Card>
                    </motion.div>
                  ))}
                </div>

                {/* "+ Adult" / "+ Child" is the old model in a button: it made
                    you declare a life stage in order to get a permission level.
                    You add a PERSON and then say what they may do — and the
                    guided option only exists if this home said someone here is
                    looked after. */}
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button tone="light" onClick={() => s.addPerson("person", "full")}>+ Person</Button>
                  {/* "+ Guided" named the permission tier on a button whose job is
                      to add a PERSON — and it was the last bit of console
                      vocabulary left in onboarding. Say what they'll get. */}
                  {d.axes.dependents && (
                    <Button tone="light" onClick={() => s.addPerson("person", "guided")}>+ Simpler view</Button>
                  )}
                  <Button tone="light" onClick={() => s.addPerson("pet", "guided")}>+ Pet</Button>
                </div>
              </div>
            )}

            {step === 3 && (
              <div>
                <TitleBlock
                  size="page" tone="onDark" wrap
                  eyebrow="The workload"
                  title="What can we carry for you?"
                  subtext="Tap everything you never want to think about again. Change it whenever."
                />
                <div className="mt-5 flex flex-wrap gap-2.5">
                  {DOMAINS.map((dom) => {
                    const on = d.domains.includes(dom.id);
                    return (
                      <button
                        key={dom.id}
                        onClick={() => s.toggleDomain(dom.id)}
                        aria-pressed={on}
                        className={clsx(
                          "flex h-touch items-center gap-2 rounded-pill border px-4 text-bodysm font-medium transition-colors duration-300 ease-out",
                          on
                            ? "border-lemon bg-lemon text-ink"
                            : "border-white/[.14] bg-transparent text-white/70 hover:border-white/30 hover:text-white",
                        )}
                      >
                        <Icon name={dom.icon} size={18} />
                        {dom.id}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {step === 4 && (
              <div>
                <TitleBlock
                  size="page" tone="onDark" wrap
                  eyebrow="The invites"
                  title="Bring everyone in."
                  subtext="Each person gets their own app, with just their slice of home."
                />
                <div className="mt-5 flex flex-col gap-2.5">
                  {named
                    .filter((p) => p.kind !== "pet")
                    .map((p, i) => (
                      <Card key={p.id} pad="md">
                        <div className="flex items-center gap-3">
                          <span className="grid h-10 w-10 place-items-center rounded-pill text-body font-medium text-white"
                            style={{ background: PALETTE[i % PALETTE.length] }}>
                            {p.name.trim()[0].toUpperCase()}
                          </span>
                          <div className="flex-1">
                            <div className="text-body font-medium">{p.name}</div>
                            {/* Reads back the role they were GIVEN. It used to
                                say "Child · limited access" off the back of a
                                life stage — the app inventing a permission from
                                a relationship, in writing. */}
                            <div className="text-caption text-sub">
                              {p.role === "owner" ? "That's you — you run the place" : ROLE_HINT[p.role]}
                            </div>
                          </div>
                          {p.role === "owner" ? (
                            <Pill tone="tag">You</Pill>
                          ) : sent.has(p.id) ? (
                            <Pill tone="tag"><Icon name="check" size={12} /> Sent</Pill>
                          ) : (
                            <Button
                              tone="outline"
                              onClick={() => {
                                setSent((prev) => new Set(prev).add(p.id));
                                s.notify(`Invite sent to ${p.name.trim()}`);
                              }}
                            >
                              Send invite
                            </Button>
                          )}
                        </div>
                      </Card>
                    ))}
                </div>
                {named.some((p) => p.role === "guided") && (
                  <Card tone="lavender" className="mt-4">
                    <div className="flex gap-3">
                      <Icon name="lock" size={20} className="mt-0.5 shrink-0" />
                      <div className="text-caption font-medium">
                        Guided access is a simpler app — just their own things and their stars,
                        nothing about money or documents. You can change anyone&rsquo;s access later.
                      </div>
                    </div>
                  </Card>
                )}
              </div>
            )}

            {step === 5 && (
              <div>
                <motion.span
                  className="inline-block"
                  initial={{ rotate: -20, scale: 0.5, opacity: 0 }}
                  animate={{ rotate: 0, scale: 1, opacity: 1 }}
                  transition={spring}
                >
                  <Icon name="spark" size={36} />
                </motion.span>
                <h1 className="mt-4 max-w-[20ch] text-balance font-tight text-h1">
                  <span className="bg-lemon px-1 text-ink">{d.householdName.trim() || "Your home"}</span>{" "}
                  is up and running.
                </h1>
                <p className="mt-2 text-body text-white/55">
                  I&rsquo;ve set these up and shared them out. Nothing to configure — just live here.
                </p>
                {/* The DARK card idiom (the You tab's standing card), not a
                    white slab — the one light rectangle on an ink page pulled
                    every eye to the furniture instead of the headline. This
                    page is a quiet readout; the lemon highlight above is the
                    celebration. */}
                <div className="mt-5 rounded-card border border-white/10 bg-white/[.06] p-card-pad">
                  <Eyebrow tone="onDark">Starter routines</Eyebrow>
                  <div className="mt-2 flex flex-col">
                    {d.domains.map((dom, i) => (
                      <motion.div
                        key={dom}
                        initial={{ opacity: 0, x: -12 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ ...spring, delay: 0.15 + i * 0.06 }}
                        className="flex min-h-touch items-center gap-3 border-t border-white/[.06] py-1.5 first:border-t-0"
                      >
                        <IconTile size="sm" tone="onDark" name={DOMAINS.find((x) => x.id === dom)?.icon ?? "tasks"} />
                        <span className="text-bodysm font-medium text-white/85">{dom}</span>
                        <span className="ml-auto text-caption text-white/45">
                          {people > 1 ? `split between ${people}` : "all yours"}
                        </span>
                      </motion.div>
                    ))}
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <DarkPill><Icon name="repeat" size={12} /> Recurring work set up</DarkPill>
                  <DarkPill><Icon name="scale" size={12} /> Balanced automatically</DarkPill>
                  <DarkPill><Icon name="bell" size={12} /> Quiet by default</DarkPill>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* footer CTA — one full-width action, nothing else competing for the row */}
      <div className="border-t border-white/[.06] bg-ink px-7 py-4">
        <Button
          tone="lemon"
          size="lg"
          disabled={!canContinue}
          onClick={next}
          className="w-full"
        >
          {step === 0 ? "Let's go" : step === STEPS.length - 1 ? "Step inside" : "Continue"}
        </Button>
      </div>
    </div>
  );
}

/**
 * One axis of how this home works, with the consequence spelled out.
 *
 * These are the household's REAL settings — the preset above only sets them.
 * Showing them means a home that matches no preset (split money AND dependents:
 * co-parents; pooled money AND no dependents: siblings) is a first-class
 * household rather than a wrong answer to a multiple-choice question.
 */
function AxisRow({
  label, hint, options, value, onPick,
}: {
  label: string;
  hint: string;
  options: [string, string][];
  value: string;
  onPick: (v: string) => void;
}) {
  return (
    <Card pad="md">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <b className="text-bodysm font-medium">{label}</b>
          <div className="text-caption text-sub">{hint}</div>
        </div>
        <div className="flex shrink-0 gap-1 rounded-pill bg-surface p-1">
          {options.map(([v, l]) => (
            <button
              key={v}
              onClick={() => onPick(v)}
              aria-pressed={value === v}
              className={clsx(
                "rounded-pill px-3 py-1.5 text-caption font-medium transition-colors",
                value === v ? "bg-ink text-white" : "text-sub hover:text-ink",
              )}
            >
              {l}
            </button>
          ))}
        </div>
      </div>
    </Card>
  );
}

/**
 * What someone MAY DO — chosen, never inferred.
 *
 * This control existing at all is the architecture: the old flow had you press
 * "+ Child", and access fell out of that. Here you add a person and then say
 * what they can do, so the 15-year-old who runs the budget and the grandparent
 * who wants a simpler screen are both one tap away instead of impossible.
 *
 * It's a ROW, not a pill: squeezed beside the name, the label truncated
 * ("Shares the ru…") and the selection was invisible. Here the current choice
 * reads in full with its hint, and the picker expands IN PLACE — the same
 * selection language as Manage household's role picker (white cards on a
 * recessed panel, the chosen one wearing an ink ring), instead of a dropdown
 * floating over the card.
 */
function AccessRow({ value, onPick }: { value: Role; onPick: (r: Role) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-3 border-t border-ink/[.06] pt-1">
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-label={`Access: ${ROLE_LABEL[value]}`}
        className={clsx("flex w-full items-center gap-3 rounded-sm py-2 text-left", FOCUS)}
      >
        <div className="min-w-0 flex-1">
          <span className="text-bodysm font-medium">{ROLE_LABEL[value]}</span>
          <div className="truncate text-caption text-sub">{ROLE_HINT[value]}</div>
        </div>
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={smooth} className="flex shrink-0 text-sub">
          <Icon name="chevDown" size={14} />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={smooth}
            className="overflow-hidden"
          >
            <div className="mb-1 flex flex-col gap-1.5 rounded-md bg-surface p-1">
              {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
                <button
                  key={r}
                  onClick={() => { onPick(r); setOpen(false); }}
                  aria-pressed={r === value}
                  className={clsx(
                    "flex flex-col items-start gap-0.5 rounded-sm bg-card px-3 py-2.5 text-left transition-shadow duration-300",
                    FOCUS,
                    r === value ? "shadow-e2 ring-2 ring-inset ring-ink" : "shadow-e1 hover:shadow-e2",
                  )}
                >
                  <span className="text-bodysm font-medium">{ROLE_LABEL[r]}</span>
                  <span className="text-caption text-sub">{ROLE_HINT[r]}</span>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
