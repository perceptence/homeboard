"use client";

import clsx from "clsx";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Icon, type IconName } from "@/components/Icons";
import { TaskCard } from "@/components/TaskCard";
import { Avatar, AvatarStack, Button, Card, Check, Em, Eyebrow, IconTile, List, Pill, Row, Sentence, TitleBlock, type TileTone } from "@/components/ui";
import { addDays, iso, isToday, relative, startOfWeek, timeOfDay, today as todayLabel } from "@/lib/dates";
import { listItem, listStagger, smooth } from "@/lib/motion";
import { billTasks, doers, holder, pendingFor, shoppingList, useHousehold } from "@/lib/store";
import type { Member, Role } from "@/lib/types";
import { ROLE_HINT, ROLE_LABEL } from "@/lib/types";

/** Focus ring for raw buttons on a LIGHT surface (inside a Card) — the app's
 *  usual ink ring. */
const FOCUS = "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";
/** Its dark twin — for raw buttons on a wash or the ink backdrop. */
const FOCUS_DARK = "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lemon";


export function IpadHome() {
  const s = useHousehold();
  const today = s.tasks.filter((t) => isToday(t.due) && !t.done);
  const doneCount = s.tasks.filter((t) => t.done).length;
  const low = s.inventory.filter((i) => i.status === "low");
  // The nearest unpaid bill-TASK — bills live on the one timeline now.
  const billDue = billTasks(s).filter((t) => !t.done).sort((a, b) => a.due.localeCompare(b.due))[0];
  const people = doers(s).map((m) => m.id);
  const maxLoad = Math.max(1, ...people.map((p) => pendingFor(s, p)));

  const attention: { key: string; icon: IconName; tone: TileTone; title: string; meta: string; action: React.ReactNode }[] = [];
  if (billDue) {
    attention.push({
      key: String(billDue.id), icon: billDue.source?.startsWith("Email") ? "mail" : "bill", tone: "neutral",
      title: `${billDue.title} — $${billDue.amount}`,
      // The email automation's work announces itself; a hand-entered bill
      // keeps a plain line.
      meta: billDue.source?.startsWith("Email")
        ? `${billDue.source} · ${relative(billDue.due).toLowerCase()}`
        : `${relative(billDue.due)} · not on autopay`,
      action: (
        <Button
          size="touch"
          onClick={() => {
            // Hand off to the provider's page (new tab); record it settled here.
            if (billDue.payUrl) window.open(billDue.payUrl, "_blank", "noopener");
            s.settleBill(billDue.id);
          }}
        >
          Pay{billDue.payUrl && <Icon name="out" size={13} />}
        </Button>
      ),
    });
  }
  s.maint.filter((m) => m.status === "over").forEach((m) =>
    attention.push({
      key: m.id, icon: "wrench", tone: "neutral", title: m.title, meta: relative(m.due),
      action: <Button size="touch" tone="outline" onClick={() => s.scheduleMaint(m.id)}>Schedule</Button>,
    }),
  );
  if (low.length) {
    attention.push({
      key: "low", icon: "box", tone: "neutral",
      title: `${low.length} items running low`,
      meta: low.map((i) => i.title).join(", "),
      action: <Button size="touch" tone="outline" onClick={() => s.goIpad("shopping")}>Shopping</Button>,
    });
  }
  const unowned = s.tasks.find((t) => !t.owner && !t.done);
  if (unowned?.suggest) {
    attention.push({
      key: "unowned", icon: "user", tone: "neutral",
      title: `${unowned.title} needs an owner`,
      meta: `Suggested: ${s.members[unowned.suggest].name}`,
      action: <Button size="touch" tone="lemon" onClick={() => s.acceptSuggestion(unowned.id)}>Assign</Button>,
    });
  }

  return (
    <motion.div
      variants={listStagger}
      initial="hidden"
      animate="show"
      className="grid auto-rows-[minmax(0,auto)] grid-cols-4 gap-card-pad pb-2"
    >
      {/* HERO — the day, said out loud, in the HOUSE's voice — never "you":
          the count is everyone's, and the iPad is never a personal lens. */}
      <motion.div variants={listItem} className="col-span-2">
        <Card tone="lemon" className="flex h-full min-h-[240px] flex-col">
          <div className="flex items-start">
            <Eyebrow><span suppressHydrationWarning>{todayLabel()}</span></Eyebrow>
            <span className="ml-auto flex -space-x-2">
              {people.slice(0, 4).map((id) => (
                <span key={id} className="ring-2 ring-lemon">
                  <Avatar member={s.members[id]} size={30} />
                </span>
              ))}
            </span>
          </div>
          <div className="mt-auto">
            <Sentence className="max-w-[20ch]">
              <span suppressHydrationWarning>{timeOfDay()}</span>. <Em>{s.householdName}</Em> has{" "}
              <Em>{today.length}</Em> {today.length === 1 ? "thing" : "things"} on today.
            </Sentence>
            <div className="mt-5 flex items-center gap-2">
              <Pill tone="tag">{doneCount} already done</Pill>
              <Button size="touch" className="ml-auto" onClick={() => s.goIpad("tasks")}>
                See the day
              </Button>
            </div>
          </div>
        </Card>
      </motion.div>

      {/* Two quiet doors in the DARK idiom — the hero above is the screen's
          one shout; these are ambient facts, so they wear the wash and let
          the backdrop through instead of stacking more opaque slabs. */}
      <motion.div variants={listItem}>
        <Card tone="wash" className="flex h-full min-h-[240px] flex-col" onClick={() => s.goIpad("bills")}>
          <IconTile name="bill" tone="onDark" />
          <div className="mt-auto">
            <div className="text-display tabular-nums">${billDue?.amount ?? 0}</div>
            <div className="mt-1 text-h2 text-white/70">
              {billDue ? <span suppressHydrationWarning>{billDue.title}, {relative(billDue.due).toLowerCase()}</span> : "Everything's paid"}
            </div>
          </div>
        </Card>
      </motion.div>

      <motion.div variants={listItem}>
        <Card tone="wash" className="flex h-full min-h-[240px] flex-col" onClick={() => s.goIpad("shopping")}>
          <IconTile name="box" tone="onDark" />
          <div className="mt-auto">
            <div className="text-display tabular-nums">{low.length}</div>
            <div className="mt-1 text-h2 text-white/70">
              {low.length ? "things running low" : "Cupboards are full"}
            </div>
          </div>
        </Card>
      </motion.div>

      {/* WORTH A LOOK — wide, calm, two columns */}
      {attention.length > 0 && (
        <motion.div variants={listItem} className="col-span-2 row-span-2">
          <Card pad="none" className="flex h-full flex-col">
            <TitleBlock size="card" className="px-card-pad pt-card-pad" title="Worth a look" />
            <List className="pb-2">
              {attention.map((a) => (
                <Row
                  key={a.key}
                  lead={<IconTile name={a.icon} tone={a.tone} />}
                  title={a.title}
                  meta={a.meta}
                  actions={a.action}
                />
              ))}
            </List>
          </Card>
        </motion.div>
      )}

      {/* WHO'S CARRYING — the balance display lives in the dark voice, like
          the phone's House board: member colours pop against the wash, and
          the one lavender strip stays the AI's accent. */}
      <motion.div variants={listItem} className="col-span-2 row-span-2">
        <Card tone="wash" className="flex h-full flex-col">
          <TitleBlock size="card" tone="onDark" title="Who’s carrying today" />
          <div className="mt-stack flex-1">
            {people.map((id) => {
              const m = s.members[id];
              const load = pendingFor(s, id);
              return (
                <div key={id} className="mb-3.5 flex items-center gap-4 last:mb-0">
                  <div className="flex w-24 items-center gap-2">
                    <Avatar member={m} size={26} />
                    <b className="text-bodysm font-medium">{m.name}</b>
                  </div>
                  <div className="h-2.5 flex-1 overflow-hidden rounded-pill bg-white/10">
                    <motion.div
                      className="h-full rounded-pill"
                      style={{ background: m.color }}
                      initial={{ width: 0 }}
                      animate={{ width: `${(load / maxLoad) * 100}%` }}
                      transition={{ duration: 0.7, ease: [0.2, 0.7, 0.2, 1] }}
                    />
                  </div>
                  {/* caption, not micro — a load count is meta text (it explains
                      the bar beside it); micro is reserved for whisper cues. */}
                  <span className="w-14 text-right text-caption font-medium tabular-nums text-white/55">
                    {load}
                  </span>
                </div>
              );
            })}
          </div>
          <Card tone="lavender" pad="md" className="mt-stack">
            <div className="flex items-center gap-4">
              <Icon name="spark" size={18} />
              <div className="flex-1 text-bodysm font-medium leading-snug">
                Someone&rsquo;s doing more than their share.
              </div>
              <Button size="touch" onClick={s.rebalance}>Even it out</Button>
            </div>
          </Card>
        </Card>
      </motion.div>

      {/* UPKEEP — small, quiet: text-h2, the same weight class the bill/
          shopping cards above use for their caption, not a full hero. */}
      <motion.div variants={listItem} className="col-span-2">
        <Card tone="wash" className="flex min-h-[160px] flex-col" onClick={() => s.goIpad("maint")}>
          <IconTile name="wrench" tone="onDark" />
          <div className="mt-auto text-h2">
            <Em>{s.maint.filter((m) => m.status === "over" || m.status === "due").length}</Em> bits of
            upkeep this week.
          </div>
        </Card>
      </motion.div>

      {/* COMING UP — wide list */}
      <motion.div variants={listItem} className="col-span-2">
        <Card pad="none">
          <div className="flex items-center px-card-pad pt-card-pad">
            <TitleBlock size="card" title="Coming up" />
            <Button size="touch" tone="ghost" className="ml-auto" onClick={() => s.goIpad("calendar")}>
              Calendar <Icon name="fwd" size={14} />
            </Button>
          </div>
          <List className="pb-1">
            {s.events.slice(0, 4).map((e) => (
              <Row
                key={e.id}
                lead={<Avatar member={s.members[e.who]} size={32} />}
                title={e.title}
                // e.time on the near-term demo events is seeded relative to
                // NOW (see tAt in lib/seed.ts), computed fresh at module
                // import — server and client import it moments apart, so
                // the two initial renders can genuinely disagree by a few
                // minutes. Same carve-out as todayLabel()/timeOfDay() above.
                meta={<span suppressHydrationWarning>{relative(e.due)} · {e.time}</span>}
              />
            ))}
          </List>
        </Card>
      </motion.div>
    </motion.div>
  );
}

export function IpadTasks() {
  const s = useHousehold();
  const today = s.tasks.filter((t) => isToday(t.due) && !t.done);
  const week = s.tasks.filter((t) => !isToday(t.due) && !t.done && t.due <= iso(addDays(new Date(), 7)));
  const done = s.tasks.filter((t) => t.done);
  const people = doers(s);

  return (
    <motion.div
      variants={listStagger}
      initial="hidden"
      animate="show"
      className="grid grid-cols-4 gap-card-pad pb-2"
    >
      {/* THE PULSE — the day said straight on the ink, page voice. The white
          task cards below are the screen's light; the hero doesn't need to be
          another slab (heavy contrast was the iPad's whole problem). */}
      <motion.div variants={listItem} className="col-span-2 flex min-h-[200px] flex-col px-1.5 py-1">
        <Eyebrow tone="onDark">Tasks</Eyebrow>
        <div className="mt-auto">
          <Sentence className="max-w-[18ch] text-white">
            <Em>{today.length}</Em> {today.length === 1 ? "thing" : "things"} on today,{" "}
            <Em>{done.length}</Em> already done.
          </Sentence>
          <Button
            size="touch"
            tone="light"
            className="mt-5"
            onClick={() =>
              s.openSheet({
                type: "newTask",
                draft: { title: "", owner: people[0]?.id ?? null, when: "Today", priority: "med" },
              })
            }
          >
            <Icon name="plus" size={16} /> New task
          </Button>
        </div>
      </motion.div>

      {/* Who has what — a glance, not a chart. Ambient fact → wash. */}
      <motion.div variants={listItem} className="col-span-2">
        <Card tone="wash" className="flex h-full min-h-[200px] flex-col">
          <Eyebrow tone="onDark">Spread across the house</Eyebrow>
          <div className="mt-auto grid grid-cols-4 gap-3">
            {people.map((m) => (
              <div key={m.id} className="flex flex-col items-start gap-2">
                <Avatar member={m} size={36} />
                <div>
                  <div className="text-[22px] font-medium leading-none tabular-nums">
                    {pendingFor(s, m.id)}
                  </div>
                  {/* caption, not micro — a name is meta text, not a whisper cue. */}
                  <div className="mt-1 text-caption font-medium text-white/55">{m.name}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </motion.div>

      {today.length > 0 && (
        <motion.div variants={listItem} className="col-span-2 flex flex-col gap-tile">
          <Eyebrow tone="onDark">Today</Eyebrow>
          {today.map((t) => <TaskCard key={t.id} task={t} showOwner />)}
        </motion.div>
      )}

      {week.length > 0 && (
        <motion.div variants={listItem} className="col-span-2 flex flex-col gap-tile">
          <Eyebrow tone="onDark">This week</Eyebrow>
          {week.map((t) => <TaskCard key={t.id} task={t} showOwner />)}
        </motion.div>
      )}

      {done.length > 0 && (
        <motion.div variants={listItem} className="col-span-4 flex flex-col gap-tile">
          <Eyebrow tone="onDark">Done</Eyebrow>
          {done.map((t) => <TaskCard key={t.id} task={t} showOwner />)}
        </motion.div>
      )}

      {s.tasks.length === 0 && (
        <motion.div variants={listItem} className="col-span-4">
          <Card tone="wash" pad="lg" className="min-h-[200px] text-center">
            <Sentence className="mt-10 text-white">The house is caught up. <Em>Nothing to do.</Em></Sentence>
          </Card>
        </motion.div>
      )}
    </motion.div>
  );
}

export function IpadShopping() {
  const s = useHousehold();
  const list = shoppingList(s);
  const low = list.filter((i) => i.low && !i.done);
  const left = list.filter((i) => !i.done);
  const cats = Array.from(new Set(list.map((i) => i.category)));

  return (
    <motion.div variants={listStagger} initial="hidden" animate="show" className="grid grid-cols-4 gap-card-pad pb-2">
      {/* Pulse on the ink — the list below carries the white. */}
      <motion.div variants={listItem} className="col-span-2 flex min-h-[200px] flex-col px-1.5 py-1">
        <Eyebrow tone="onDark">Shopping</Eyebrow>
        <Sentence className="mt-auto max-w-[18ch] text-white">
          <Em>{left.length}</Em> {left.length === 1 ? "thing" : "things"} to pick up.
        </Sentence>
      </motion.div>

      {/* Lavender ONLY when the AI actually did something — the accent is
          earned by the act, not standing furniture. Quiet state = wash. */}
      <motion.div variants={listItem} className="col-span-2">
        <Card tone={low.length ? "lavender" : "wash"} className="flex h-full min-h-[200px] flex-col">
          <IconTile name="spark" tone={low.length ? "neutral" : "onDark"} />
          <div className={clsx("mt-auto text-h2", !low.length && "text-white/70")}>
            {low.length
              ? <>I added <Em>{low.length}</Em> things that were running low: {low.map((i) => i.title).join(", ")}.</>
              : <>Nothing&rsquo;s running low. <Em>Cupboards are full.</Em></>}
          </div>
        </Card>
      </motion.div>

      {cats.map((cat) => (
        <motion.div key={cat} variants={listItem} className="col-span-2">
          <Card pad="none">
            <div className="flex items-center px-card-pad pt-card-pad">
              <TitleBlock size="card" title={cat} />
              <span className="ml-auto text-caption font-medium text-sub">
                {list.filter((x) => x.category === cat && !x.done).length}
              </span>
            </div>
            <List className="pb-2">
              {list.filter((x) => x.category === cat).map((i2) => (
                <Row
                  key={i2.id}
                  lead={<Check done={i2.done} onClick={() => s.toggleShopItem(i2.id)} />}
                  title={<span className={i2.done ? "text-sub line-through" : ""}>{i2.title}</span>}
                  meta={i2.note}
                  actions={i2.low && !i2.done ? <Pill tone="lavender">Low</Pill> : undefined}
                />
              ))}
            </List>
          </Card>
        </motion.div>
      ))}
    </motion.div>
  );
}

/** The real Mon–Sun of the week you're in — not a hardcoded row of numbers. */
const weekDays = () =>
  Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(new Date()), i));

export function IpadCalendar() {
  const s = useHousehold();

  return (
    <motion.div variants={listStagger} initial="hidden" animate="show" className="grid grid-cols-4 gap-card-pad pb-2">
      {/* Pulse on the ink. */}
      <motion.div variants={listItem} className="col-span-2 flex min-h-[200px] flex-col px-1.5 py-1">
        <Eyebrow tone="onDark">Calendar</Eyebrow>
        <Sentence className="mt-auto max-w-[18ch] text-white">
          <Em>{s.events.length}</Em> things on the calendar this week.
        </Sentence>
      </motion.div>

      <motion.div variants={listItem} className="col-span-2">
        <Card pad="none" className="h-full">
          <TitleBlock size="card" className="px-card-pad pt-card-pad" title="Today" />
          <List className="pb-2">
            {s.events.filter((e) => isToday(e.due)).map((e) => (
              <Row key={e.id} lead={<Avatar member={s.members[e.who]} size={32} />} title={e.title}
                meta={`${e.time} · ${s.members[e.who]?.name}`} />
            ))}
          </List>
        </Card>
      </motion.div>

      {/* The week, in the dark idiom — same as the phone's own calendar cells
          (washes, lemon = today). Seven opaque columns was a wall of white;
          the member-coloured event chips read BETTER against the wash. */}
      <motion.div variants={listItem} className="col-span-4 grid grid-cols-7 gap-3">
        {weekDays().map((day) => {
          const isTodayCell = isToday(iso(day));
          return (
            <Card
              key={iso(day)}
              // The lemon card is TODAY — which is a date test, not "the first column".
              tone={isTodayCell ? "lemon" : "wash"}
              pad="md"
              className="min-h-[200px]"
            >
              <div className="flex items-baseline justify-between">
                <span className={clsx("text-caption font-medium uppercase", isTodayCell ? "opacity-50" : "text-white/45")}>
                  {day.toLocaleDateString("en-GB", { weekday: "short" })}
                </span>
                <span className="text-h2 tabular-nums">{day.getDate()}</span>
              </div>
              {s.events.filter((e) => e.due === iso(day)).map((e) => (
                <div
                  key={e.id}
                  style={{ background: s.members[e.who].color }}
                  className="mt-2 rounded-sm px-2 py-1.5 text-micro font-medium leading-tight text-white"
                >
                  <div className="opacity-75">{e.time}</div>
                  {e.title}
                </div>
              ))}
            </Card>
          );
        })}
      </motion.div>
    </motion.div>
  );
}

const ROOMS = ["Kitchen", "Living room", "Primary bath", "Kids room", "Yard", "Garage"];
const ASSETS: [string, string, string][] = [
  ["HVAC system", "Warranty to 2027", "Filter in 4 days"],
  ["Dishwasher", "Warranty to 2026", "Descale next mo"],
  ["Washer + dryer", "Warranty to 2028", "—"],
  ["Lawn mower", "Warranty ends Oct", "Service due"],
];

/**
 * A person, as the household actually knows them: who they are, what they may
 * do, and what they look after — the three kept visibly separate, because
 * that's the whole point of the model.
 *
 * The role is a CONTROL, not a label. It's assigned, so it must be changeable;
 * a role you can only read is one the app is secretly deriving. The picker
 * expands IN PLACE — white cards on a recessed panel, an ink ring on the
 * chosen one — the same selector language as the phone's Manage-household
 * role picker, not a floating dropdown (which risks clipping inside a grid
 * cell, and was the exact "feels misplaced" pattern the phone moved away
 * from).
 */
function PersonCard({ member: m }: { member: Member }) {
  const s = useHousehold();
  const [open, setOpen] = useState(false);
  const jobs = [...(m.responsibility?.domains ?? []), ...(m.responsibility?.spaces ?? [])];

  return (
    <Card tone="wash" className="flex min-h-[200px] flex-col">
      <div className="flex items-start">
        <Avatar member={m} size={44} />
        {m.role === "guided" && m.kind === "person" && (
          <span className="ml-auto flex items-center gap-1 text-bodysm font-medium text-star">
            <Icon name="star" size={14} /> {m.stars ?? 0}
          </span>
        )}
      </div>

      <div className="mt-auto">
        <b className="text-body">{m.name}</b>

        {/* Access — a decision, not a label. Pets can't hold work, so they
            don't get a role picker; a dog with permissions is a joke the
            model shouldn't be able to tell. */}
        {m.kind === "pet" ? (
          <div className="text-bodysm font-medium text-white/50">Pet</div>
        ) : (
          <div className="mt-0.5">
            <button
              onClick={() => setOpen(!open)}
              aria-expanded={open}
              className={clsx("flex items-center gap-1 rounded-sm text-bodysm font-medium text-white/50 transition-colors hover:text-white", FOCUS_DARK)}
            >
              {ROLE_LABEL[m.role]}
              <motion.span animate={{ rotate: open ? 180 : 0 }} transition={smooth} className="flex">
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
                  {/* The dark twin of the in-place picker: recessed ink panel,
                      wash options, lemon ring on the chosen one — the phone's
                      own dark-selector idiom (Ahead's scope picker). */}
                  <div className="mt-2 flex flex-col gap-1.5 rounded-md bg-black/25 p-1.5">
                    {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
                      <button
                        key={r}
                        // The last owner can't demote themselves out of the house.
                        disabled={m.role === "owner" && r !== "owner" && !Object.values(s.members).some((x) => x.id !== m.id && x.role === "owner")}
                        onClick={() => { s.setRole(m.id, r); setOpen(false); }}
                        aria-pressed={r === m.role}
                        className={clsx(
                          "flex flex-col items-start gap-0.5 rounded-sm px-3 py-2 text-left transition-colors duration-300",
                          "disabled:cursor-not-allowed disabled:opacity-40",
                          FOCUS_DARK,
                          r === m.role
                            ? "bg-white/[.12] ring-2 ring-inset ring-lemon"
                            : "bg-white/[.06] hover:bg-white/[.10]",
                        )}
                      >
                        <span className="text-bodysm font-medium text-white">{ROLE_LABEL[r]}</span>
                        <span className="text-caption text-white/50">{ROLE_HINT[r]}</span>
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Responsibility — what they look after. Separate from access on
            purpose: running the meals doesn't require holding the bank card. */}
        {jobs.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {jobs.slice(0, 3).map((j) => (
              <Pill key={j} tone="dark">{j}</Pill>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}

export function IpadHousehold() {
  const s = useHousehold();
  const everyone = Object.values(s.members);
  // People and pets — the only split identity actually makes. How many "adults"
  // vs "kids" live here was never a fact the app knew; it was a guess it made
  // from a permission flag, and it got the au pair and the grandparent wrong.
  const people = everyone.filter((m) => m.kind === "person").length;
  const pets = everyone.filter((m) => m.kind === "pet").length;

  return (
    <motion.div variants={listStagger} initial="hidden" animate="show" className="grid grid-cols-4 gap-card-pad pb-2">
      {/* Pulse on the ink — who lives here, said in the page voice, with the
          faces beside it instead of wrapped in another slab. */}
      <motion.div variants={listItem} className="col-span-2 flex min-h-[200px] flex-col px-1.5 py-1">
        <span className="flex -space-x-2">
          {everyone.slice(0, 5).map((m) => (
            <span key={m.id} className="ring-2 ring-ink">
              <Avatar member={m} size={30} />
            </span>
          ))}
        </span>
        <Sentence className="mt-auto max-w-[20ch] text-white">
          <Em>{people}</Em> {people === 1 ? "person" : "people"}
          {pets ? <> and <Em>{pets}</Em> {pets === 1 ? "pet" : "pets"}</> : null} live here.
        </Sentence>
      </motion.div>

      {/* Rooms are ambient structure, not work — wash, with the room chips in
          the same translucent idiom. */}
      <motion.div variants={listItem} className="col-span-2">
        <Card tone="wash" className="flex h-full min-h-[200px] flex-col">
          <TitleBlock size="card" tone="onDark" title="Rooms" />
          <div className="mt-auto flex flex-wrap gap-2">
            {ROOMS.map((r) => (
              <span key={r} className="flex h-touch items-center gap-2 rounded-pill bg-white/[.08] px-3.5 text-bodysm font-medium text-white/85">
                <Icon name="house" size={14} className="text-white/45" />
                {r}
              </span>
            ))}
          </div>
        </Card>
      </motion.div>

      {everyone.map((m) => (
        <motion.div key={m.id} variants={listItem}>
          <PersonCard member={m} />
        </motion.div>
      ))}

      <motion.div variants={listItem} className="col-span-4">
        <Card pad="none">
          <TitleBlock size="card" className="px-card-pad pt-card-pad" title="Appliances & warranties" />
          <List className="pb-2">
            {ASSETS.map(([name, warranty, next]) => (
              <Row key={name} lead={<IconTile name="box" />} title={name} meta={warranty}
                actions={<Pill tone={next === "—" ? "tag" : "lavender"}>{next}</Pill>} />
            ))}
          </List>
        </Card>
      </motion.div>
    </motion.div>
  );
}

export function IpadInsights() {
  const s = useHousehold();
  const done = s.tasks.filter((t) => t.done).length;
  const pct = Math.round((done / Math.max(1, s.tasks.length)) * 100);
  const loads = doers(s).map((m) => ({ m, load: s.tasks.filter((t) => holder(t) === m.id).length }));
  const total = Math.max(1, loads.reduce((sum, l) => sum + l.load, 0));

  return (
    <motion.div variants={listStagger} initial="hidden" animate="show" className="grid grid-cols-4 gap-card-pad pb-2">
      <motion.div variants={listItem} className="col-span-2">
        <Card tone="lemon" className="flex h-full min-h-[200px] flex-col">
          <Eyebrow>Last 30 days</Eyebrow>
          <div className="mt-auto flex items-end gap-4">
            {/* Household voice — never "you're"; this is everyone's number. */}
            <Sentence className="flex-1 max-w-[16ch]">
              The house is finishing <Em>most</Em>{" "}of what it&rsquo;s asked.
            </Sentence>
            <span className="text-[46px] font-medium leading-none tabular-nums tracking-tighter">{pct}%</span>
          </div>
        </Card>
      </motion.div>

      {/* Two ambient stats in the wash — the lemon card above is the screen's
          one shout; these are quiet numbers, not slabs. */}
      <motion.div variants={listItem}>
        <Card tone="wash" className="flex h-full min-h-[200px] flex-col">
          <IconTile name="spark" tone="onDark" />
          <div className="mt-auto">
            <div className="text-display tabular-nums">~5 hrs</div>
            <div className="mt-1 text-bodysm font-medium text-white/55">coordinating saved</div>
          </div>
        </Card>
      </motion.div>

      <motion.div variants={listItem}>
        <Card tone="wash" className="flex h-full min-h-[200px] flex-col">
          <IconTile name="chart" tone="onDark" />
          <div className="mt-auto">
            <div className="text-display">Fair</div>
            <div className="mt-1 text-bodysm font-medium text-white/55">household balance</div>
          </div>
        </Card>
      </motion.div>

      {/* The balance display, dark like Home's — member colours carry it. */}
      <motion.div variants={listItem} className="col-span-2">
        <Card tone="wash" className="h-full">
          <TitleBlock size="card" tone="onDark" title="Share of the work" />
          <div className="mt-stack">
            {loads.map(({ m, load }) => {
              const share = Math.round((load / total) * 100);
              return (
                <div key={m.id} className="mb-3.5 flex items-center gap-4 last:mb-0">
                  <div className="flex w-24 items-center gap-2">
                    <Avatar member={m} size={24} />
                    <b className="text-bodysm">{m.name}</b>
                  </div>
                  <div className="h-2.5 flex-1 overflow-hidden rounded-pill bg-white/10">
                    <motion.div
                      className="h-full rounded-pill"
                      style={{ background: m.color }}
                      initial={{ width: 0 }}
                      animate={{ width: `${share}%` }}
                      transition={{ duration: 0.7, ease: [0.2, 0.7, 0.2, 1] }}
                    />
                  </div>
                  <span className="w-11 text-right text-caption font-medium tabular-nums text-white/55">{share}%</span>
                </div>
              );
            })}
          </div>
        </Card>
      </motion.div>

      <motion.div variants={listItem} className="col-span-2">
        <Card pad="none" className="h-full">
          <TitleBlock size="card" className="px-card-pad pt-card-pad" title="What’s coming for the house" />
          <List className="pb-2">
            {s.maint.slice(0, 4).map((m) => (
              <Row key={m.id} lead={<IconTile name="wrench" />}
                title={m.title} meta={`${m.asset} · ${m.cadence}`}
                actions={<Pill tone={m.status === "over" ? "light" : "tag"}>{relative(m.due)}</Pill>} />
            ))}
          </List>
        </Card>
      </motion.div>
    </motion.div>
  );
}
