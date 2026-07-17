"use client";

import clsx from "clsx";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Icon, type IconName } from "@/components/Icons";
import { Button, Card, Pill } from "@/components/ui";
import { spring } from "@/lib/motion";
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

export function Onboarding() {
  const s = useHousehold();
  const d = s.onboarding;
  const step = d.step;

  const named = d.people.filter((p) => p.name.trim());
  const canContinue =
    step === 1 ? d.householdName.trim().length > 0 :
    step === 2 ? named.length > 0 :
    step === 3 ? d.domains.length > 0 :
    true;

  const next = () => (step === STEPS.length - 1 ? s.completeOnboarding() : s.setStep(step + 1));

  return (
    <div className="absolute inset-0 flex flex-col bg-ink text-white">
      {/* progress */}
      <div className="flex items-center gap-3 px-7 pt-6">
        {step > 0 && (
          <button
            onClick={() => s.setStep(step - 1)}
            aria-label="Back"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-card shadow-e2"
          >
            <Icon name="x" size={16} />
          </button>
        )}
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
        <span className="shrink-0 text-caption font-medium uppercase tracking-widest text-sub">
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
                <Icon name="house" size={44} />
                <h1 className="mt-5 max-w-[16ch] text-4xl font-medium leading-[1.05]">
                  Let&rsquo;s take running your home <span className="bg-lemon px-1">off your plate.</span>
                </h1>
                <p className="mt-4 max-w-[38ch] text-lg font-medium text-sub">
                  Two minutes now, and the house starts carrying itself. No spreadsheets, no chore chart —
                  it just runs.
                </p>
                <div className="mt-6 flex gap-2">
                  <Pill tone="tag"><Icon name="bolt" size={12} /> Takes ~2 min</Pill>
                  <Pill tone="tag"><Icon name="lock" size={12} /> Private by default</Pill>
                </div>
              </div>
            )}

            {step === 1 && (
              <div>
                <h1 className="font-tight text-h1">What should we call your home?</h1>
                <input
                  autoFocus
                  value={d.householdName}
                  onChange={(e) => s.setHouseholdName(e.target.value)}
                  placeholder="e.g. The Rivera Home"
                  className="mt-5 w-full rounded-2xl border border-black/[.08] bg-card px-4 py-4 text-xl font-medium outline-none focus:border-ink"
                />
                <h2 className="mt-8 text-lg font-medium">Who shares it?</h2>
                <div className="mt-3 grid grid-cols-4 gap-3">
                  {(Object.keys(PRESETS) as HouseholdPreset[]).map((id) => (
                    <button key={id} onClick={() => s.setPreset(id)} className="text-left">
                      <Card tone={d.preset === id ? "lemon" : "white"} pad="md">
                        <Icon name={PRESET_ICON[id]} size={24} />
                        <b className="mt-2 block">{PRESETS[id].label}</b>
                        <div className="text-xs opacity-70">{PRESETS[id].blurb}</div>
                      </Card>
                    </button>
                  ))}
                </div>

                {/* The axes, in the open. A preset is a starting point, not a
                    category you get filed under — so the two things it actually
                    sets are editable right here, and a home that matches no
                    preset is a first-class household rather than a wrong answer. */}
                <div className="mt-5 flex flex-col gap-2">
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
                <h1 className="font-tight text-h1">Who lives here?</h1>
                <p className="mt-2 font-medium text-sub">
                  Add everyone — the work gets shared fairly between them.
                </p>

                <div className="mt-5 flex flex-col gap-2.5">
                  {d.people.map((p, i) => (
                    <motion.div key={p.id} layout>
                      <Card pad="md">
                        <div className="flex items-center gap-3">
                          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-lg font-medium text-white"
                            style={{ background: PALETTE[i % PALETTE.length] }}>
                            {p.name.trim() ? p.name.trim()[0].toUpperCase() : "?"}
                          </span>
                          <input
                            value={p.name}
                            onChange={(e) => s.updatePerson(p.id, { name: e.target.value })}
                            placeholder={p.kind === "pet" ? "Pet's name" : "Name"}
                            className="min-w-0 flex-1 bg-transparent text-lg font-medium outline-none placeholder:text-sub"
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
                              className="w-16 rounded-md bg-surface px-2 py-1.5 text-center font-medium outline-none placeholder:text-sub/60"
                              aria-label={`Age (optional) — used only to check task suitability`}
                            />
                          )}
                          {p.kind === "pet" ? (
                            <Pill tone="tag">Pet</Pill>
                          ) : (
                            <RolePicker value={p.role} onPick={(role) => s.updatePerson(p.id, { role })} />
                          )}
                          {d.people.length > 1 && (
                            <button
                              onClick={() => s.removePerson(p.id)}
                              aria-label={`Remove ${p.name || "person"}`}
                              className="grid h-7 w-7 place-items-center rounded-full text-sub hover:bg-surface hover:text-ink"
                            >
                              <Icon name="x" size={14} />
                            </button>
                          )}
                        </div>
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
                <h1 className="font-tight text-h1">What should it run for you?</h1>
                <p className="mt-2 font-medium text-sub">Pick what matters. You can change this any time.</p>
                <div className="mt-5 flex flex-wrap gap-2.5">
                  {DOMAINS.map((dom) => {
                    const on = d.domains.includes(dom.id);
                    return (
                      <button
                        key={dom.id}
                        onClick={() => s.toggleDomain(dom.id)}
                        aria-pressed={on}
                        className={clsx(
                          "flex items-center gap-2 rounded-pill border px-4 py-3 text-base font-medium transition-colors",
                          on ? "border-ink bg-lemon text-ink" : "border-black/[.08] bg-card text-sub",
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
                <h1 className="font-tight text-h1">Invite the household</h1>
                <p className="mt-2 font-medium text-sub">
                  Everyone gets their own app — they only see what&rsquo;s theirs.
                </p>
                <div className="mt-5 flex flex-col gap-2.5">
                  {named
                    .filter((p) => p.kind !== "pet")
                    .map((p, i) => (
                      <Card key={p.id} pad="md">
                        <div className="flex items-center gap-3">
                          <span className="grid h-10 w-10 place-items-center rounded-full font-medium text-white"
                            style={{ background: PALETTE[i % PALETTE.length] }}>
                            {p.name.trim()[0].toUpperCase()}
                          </span>
                          <div className="flex-1">
                            <b>{p.name}</b>
                            {/* Reads back the role they were GIVEN. It used to
                                say "Child · limited access" off the back of a
                                life stage — the app inventing a permission from
                                a relationship, in writing. */}
                            <div className="text-sm text-sub">
                              {p.role === "owner" ? "That's you — runs the home" : ROLE_HINT[p.role]}
                            </div>
                          </div>
                          {p.role === "owner" ? <Pill tone="tag">You</Pill> : <Button tone="outline">Send invite</Button>}
                        </div>
                      </Card>
                    ))}
                </div>
                {named.some((p) => p.role === "guided") && (
                  <Card tone="lavender" className="mt-4">
                    <div className="flex gap-3">
                      <Icon name="lock" size={20} className="mt-0.5 shrink-0" />
                      <div className="text-sm font-medium">
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
                <Icon name="spark" size={36} />
                <h1 className="mt-4 font-tight text-h1">Here&rsquo;s what I&rsquo;ll start running</h1>
                <p className="mt-2 font-medium text-sub">
                  Based on your home, I&rsquo;ve set these up and shared them out. Nothing to configure.
                </p>
                <Card tone="lemon" className="mt-5">
                  <div className="text-caption font-medium uppercase tracking-wide opacity-60">Starter routines</div>
                  <div className="mt-2.5 flex flex-col gap-2">
                    {d.domains.slice(0, 5).map((dom) => (
                      <div key={dom} className="flex items-center gap-2 font-medium">
                        <Icon name={DOMAINS.find((x) => x.id === dom)?.icon ?? "tasks"} size={16} />
                        {dom} — shared between {named.filter((p) => p.kind !== "pet").length || 1} people
                      </div>
                    ))}
                  </div>
                </Card>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Pill tone="tag"><Icon name="repeat" size={12} /> Recurring work set up</Pill>
                  <Pill tone="tag"><Icon name="scale" size={12} /> Balanced automatically</Pill>
                  <Pill tone="tag"><Icon name="bell" size={12} /> Quiet by default</Pill>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* footer CTA */}
      <div className="flex items-center gap-3 border-t border-white/[.06] bg-ink px-7 py-4">
        {step === 0 && (
          <button onClick={s.completeOnboarding} className="font-medium text-sub hover:text-ink">
            Skip — use the demo home
          </button>
        )}
        <Button
          tone={canContinue ? "lemon" : "light"}
          onClick={() => canContinue && next()}
          className={clsx("ml-auto !px-7 !py-3.5 text-base", !canContinue && "opacity-50")}
        >
          {step === 0 ? "Get started" : step === STEPS.length - 1 ? "Enter my home" : "Continue"}
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
          <b className="text-bodysm">{label}</b>
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
 */
function RolePicker({ value, onPick }: { value: Role; onPick: (r: Role) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative shrink-0">
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-label={`Access: ${ROLE_LABEL[value]}`}
        className="flex items-center gap-1"
      >
        <Pill tone={value === "owner" ? "lavender" : "tag"}>
          {ROLE_LABEL[value]}
          <Icon name="chevDown" size={12} />
        </Pill>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-50 mt-1 w-max overflow-hidden rounded-[18px]
                          border border-black/[.06] bg-card p-1 shadow-e3">
            {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
              <button
                key={r}
                onClick={() => { onPick(r); setOpen(false); }}
                className={clsx(
                  "flex w-full max-w-[280px] flex-col items-start gap-0.5 rounded-[14px] px-3 py-2 text-left transition-colors",
                  r === value ? "bg-ink text-white" : "hover:bg-surface",
                )}
              >
                <span className="text-bodysm font-medium">{ROLE_LABEL[r]}</span>
                <span className={clsx("text-caption", r === value ? "text-white/60" : "text-sub")}>
                  {ROLE_HINT[r]}
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </span>
  );
}
