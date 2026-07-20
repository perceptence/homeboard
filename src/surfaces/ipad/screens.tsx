"use client";

import clsx from "clsx";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Icon, type IconName } from "@/components/Icons";
import { EventCard, MaintCard, TaskCard } from "@/components/TaskCard";
import { ScopePicker, Step, type Scope } from "@/components/Period";
import { Avatar, Button, Card, Check, Em, Eyebrow, IconTile, List, Pill, Row, Sentence, TitleBlock, type TileTone } from "@/components/ui";
import {
  groupIsPast, inRange, isCurrentPeriod, isToday, monthKey, monthLabel, parse,
  periodRange, relative, shiftPeriod, timeMinutes, timeOfDay, today as todayLabel, weekKey, weekLabel,
} from "@/lib/dates";
import { listItem, listStagger, smooth } from "@/lib/motion";
import { billTasks, doers, holder, pendingFor, shoppingList, useHousehold } from "@/lib/store";
import type { HouseEvent, MaintItem, Member, Role, Task } from "@/lib/types";
import { ROLE_HINT, ROLE_LABEL } from "@/lib/types";

/** Focus ring for raw buttons on a LIGHT surface (inside a Card) — the app's
 *  usual ink ring. */
const FOCUS = "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";
/** Its dark twin — for raw buttons on a wash or the ink backdrop. */
const FOCUS_DARK = "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lemon";

/* ════════════════════════════════════════════════════════════════════════════
   TODAY — what is happening today, and what needs immediate attention.
   The shared shopping list lives here too: it's today's errand, not a domain.
   ════════════════════════════════════════════════════════════════════════════ */

export function IpadToday() {
  const s = useHousehold();
  const today = s.tasks.filter((t) => isToday(t.due) && !t.done);
  const doneCount = s.tasks.filter((t) => t.done).length;
  const low = s.inventory.filter((i) => i.status === "low");
  // The nearest unpaid bill-TASK — bills live on the one timeline now.
  const billDue = billTasks(s).filter((t) => !t.done).sort((a, b) => a.due.localeCompare(b.due))[0];
  const people = doers(s).map((m) => m.id);

  /* WORTH A LOOK — the things that would go wrong quietly: money running
     late, upkeep gone overdue, supplies out, work nobody owns. */
  const attention: { key: string; icon: IconName; tone: TileTone; title: string; meta: string; action: React.ReactNode }[] = [];
  if (billDue) {
    attention.push({
      key: String(billDue.id), icon: billDue.source?.startsWith("Email") ? "mail" : "bill", tone: "neutral",
      title: `${billDue.title} — $${billDue.amount}`,
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
      // The list is a column away on this same screen now — no route to change.
      action: undefined,
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

  /* HAPPENING TODAY — the whole household's day on one timeline, tasks and
     events alike, in the order they happen. */
  const happening = [
    ...today.map((t) => ({ key: `t${t.id}`, at: timeMinutes(t.when), el: <TaskCard task={t} showOwner /> })),
    ...s.events
      .filter((e) => isToday(e.due) && !e.done)
      .map((e) => ({ key: `e${e.id}`, at: timeMinutes(e.time), el: <EventCard event={e} showOwner /> })),
  ].sort((a, b) => a.at - b.at);

  /* THE SHARED LIST — grouped the way you'd walk the shop. */
  const list = shoppingList(s);
  const autoAdded = list.filter((i) => i.low && !i.done);
  const cats = Array.from(new Set(list.map((i) => i.category)));

  return (
    <motion.div variants={listStagger} initial="hidden" animate="show" className="grid grid-cols-4 gap-card-pad pb-2">
      {/* HERO — the day, said out loud, in the HOUSE's voice. No "See the day"
          button any more: the day is right below. */}
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
            </div>
          </div>
        </Card>
      </motion.div>

      {/* WORTH A LOOK — immediate attention, top of the page. */}
      <motion.div variants={listItem} className="col-span-2">
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
            {attention.length === 0 && (
              <p className="py-6 text-center text-bodysm text-sub">Nothing needs a look. Rare — enjoy it.</p>
            )}
          </List>
        </Card>
      </motion.div>

      {/* HAPPENING TODAY — the day itself, whoever it belongs to. */}
      <motion.div variants={listItem} className="col-span-2 flex flex-col gap-tile">
        <Eyebrow tone="onDark">Happening today</Eyebrow>
        {happening.map((c) => (
          <div key={c.key}>{c.el}</div>
        ))}
        {happening.length === 0 && (
          <Card tone="wash" pad="lg" className="text-center">
            <Sentence className="py-6 text-white">The house is caught up. <Em>Nothing on.</Em></Sentence>
          </Card>
        )}
      </motion.div>

      {/* THE SHARED LIST — today's errand, on today's page. */}
      <motion.div variants={listItem} className="col-span-2 flex flex-col gap-tile">
        <Eyebrow tone="onDark">Shopping</Eyebrow>
        {/* Lavender ONLY when the AI actually did something — the accent is
            earned by the act, not standing furniture. */}
        {autoAdded.length > 0 && (
          <Card tone="lavender">
            <div className="flex items-center gap-4">
              <Icon name="spark" size={18} />
              <div className="flex-1 text-bodysm font-medium leading-snug">
                I added <Em>{autoAdded.length}</Em> things that were running low:{" "}
                {autoAdded.map((i) => i.title).join(", ")}.
              </div>
            </div>
          </Card>
        )}
        {cats.map((cat) => (
          <Card key={cat} pad="none">
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
        ))}
      </motion.div>
    </motion.div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   AHEAD — the phone's period lens, in the household voice: everyone's tasks,
   events and upkeep on one dated timeline, at Week / Month / Quarter / Year.
   ════════════════════════════════════════════════════════════════════════════ */

/** One row in the Ahead list — a task, an event or an upkeep item, all dated. */
type Item =
  | { kind: "task"; due: string; task: Task }
  | { kind: "event"; due: string; event: HouseEvent }
  | { kind: "maint"; due: string; item: MaintItem };

const isDone = (i: Item) => i.kind === "task" && i.task.done;

/**
 * The phone's `aheadFor`, minus the member filter — the iPad is the household,
 * so EVERYTHING dated is on its horizon (unowned tasks included: work nobody
 * owns is still the house's). No query branches either: the iPad's search is
 * the global overlay in the header.
 */
function aheadForHouse(
  s: ReturnType<typeof useHousehold.getState>,
  scope: Scope,
  anchor: Date,
) {
  const range = periodRange(scope, anchor);

  const items: Item[] = [
    ...s.tasks
      .filter((t) => inRange(t.due, range))
      .map((task): Item => ({ kind: "task", due: task.due, task })),
    ...s.events
      .filter((e) => inRange(e.due, range))
      .map((event): Item => ({ kind: "event", due: event.due, event })),
    // Upkeep only shows once you're looking past the current week — same rule
    // as the phone: a Week view is about the days, not the season.
    ...(scope === "Week"
      ? []
      : s.maint
          .filter((m) => inRange(m.due, range))
          .map((item): Item => ({ kind: "maint", due: item.due, item }))),
  ].sort((a, b) => a.due.localeCompare(b.due) || Number(isDone(a)) - Number(isDone(b)));

  /* Group at the rung BELOW the scope — grouping a month by month is one
     group, which is no grouping at all. */
  const by = scope === "Week" ? null : scope === "Month" ? "week" : "month";
  const keyOf = (due: string) => (by === "week" ? weekKey(due) : monthKey(due));

  const groups = !by
    ? [{ key: "", label: "", items, past: false }]
    : [...new Set(items.map((i) => keyOf(i.due)))].sort().map((key) => ({
        key,
        label: by === "week" ? weekLabel(key) : monthLabel(key),
        items: items.filter((i) => keyOf(i.due) === key),
        past: groupIsPast(key),
      }));

  return {
    groups,
    /** Zooming a group means "show me that period" — a week key needs Week scope. */
    zoomScope: (by === "week" ? "Week" : "Month") as Scope,
    count: items.filter((i) => !isDone(i)).length,
  };
}

export function IpadAhead() {
  const s = useHousehold();
  const [scope, setScope] = useState<Scope>("Week");
  const [anchor, setAnchor] = useState<Date>(() => new Date());
  const [scopeOpen, setScopeOpen] = useState(false);
  const ahead = aheadForHouse(s, scope, anchor);

  const setScopeAt = (next: Scope) => {
    // Changing scope always re-centres on today; you meant "this month", not
    // "the month around whatever you happened to be reading".
    setScope(next);
    setAnchor(new Date());
  };
  /** Zoom a group: same data, tighter lens. A week group needs Week scope. */
  const zoomTo = (key: string) => {
    setAnchor(parse(key.length === 7 ? `${key}-01` : key));
    setScope(ahead.zoomScope);
  };
  const step = (dir: -1 | 1) => setAnchor((a) => shiftPeriod(scope, a, dir));

  return (
    <motion.div variants={listStagger} initial="hidden" animate="show">
      {/* Page voice on the ink — the same control cluster the phone's Ahead
          header carries: ‹ period › with the label AS the scope picker. */}
      <motion.div variants={listItem} className="px-1.5">
        <TitleBlock
          size="page"
          tone="onDark"
          eyebrow={
            <span className="-ml-1 flex items-center gap-0.5">
              <Step dir={-1} onClick={() => step(-1)} />
              <ScopePicker
                scope={scope} anchor={anchor}
                open={scopeOpen} setOpen={setScopeOpen}
                onPick={setScopeAt}
              />
              <Step dir={1} onClick={() => step(1)} />
              {!isCurrentPeriod(scope, anchor) && (
                <button
                  onClick={() => setAnchor(new Date())}
                  className="ml-1 rounded-pill bg-white/10 px-2 py-0.5 text-caption normal-case tracking-normal text-white/70 transition-colors hover:bg-white/20 hover:text-white"
                >
                  Today
                </button>
              )}
            </span>
          }
          title="What’s ahead"
          subtext={`${ahead.count} ${ahead.count === 1 ? "thing" : "things"} this ${scope.toLowerCase()}`}
        />
      </motion.div>

      {/* Swipe/drag left or right to step a period — we only read the gesture's
          DIRECTION; dragSnapToOrigin puts the list back. */}
      <motion.div
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.12}
        dragSnapToOrigin
        onDragEnd={(_, info) => {
          if (Math.abs(info.offset.x) > 60) step(info.offset.x < 0 ? 1 : -1);
        }}
        className="mt-stack flex flex-col gap-tile"
      >
        {ahead.groups.map((g) => (
          <div key={g.key || "flat"} className="flex flex-col gap-tile">
            {/* A group heading is a DOOR: tap it to narrow the screen onto that
                period — and the affordance names where it lands. */}
            {g.key && (
              <motion.button
                variants={listItem}
                onClick={() => zoomTo(g.key)}
                className={clsx("group flex items-center gap-2 px-1.5 pb-1 pt-3 text-left", FOCUS_DARK)}
              >
                <Eyebrow tone="onDark" className={clsx(g.past && "text-white/25")}>{g.label}</Eyebrow>
                <span className="text-caption text-white/30">{g.items.length}</span>
                <span className="ml-auto flex items-center gap-0.5 whitespace-nowrap text-micro
                                 uppercase tracking-[.14em] text-white/30 transition-colors
                                 group-hover:text-white/70">
                  Open {ahead.zoomScope.toLowerCase()}
                  <Icon name="fwd" size={12} />
                </span>
              </motion.button>
            )}
            {/* Two columns — the cards are compact stadiums, and a 900px single
                column reads as a ribbon in a hallway. */}
            <div className="grid grid-cols-2 gap-tile">
              {g.items.map((i) => (
                <motion.div
                  key={`${i.kind}-${i.kind === "task" ? i.task.id : i.kind === "event" ? i.event.id : i.item.id}`}
                  variants={listItem}
                  // What's behind you is still there, just quieter.
                  className={clsx(g.past && "opacity-60")}
                >
                  {i.kind === "task" && <TaskCard task={i.task} showOwner />}
                  {i.kind === "event" && <EventCard event={i.event} showOwner />}
                  {i.kind === "maint" && <MaintCard item={i.item} />}
                </motion.div>
              ))}
            </div>
          </div>
        ))}

        {ahead.count === 0 && (
          <motion.div variants={listItem}>
            <Card tone="wash" pad="lg" className="text-center">
              <Sentence className="py-6 text-white">Nothing on this {scope.toLowerCase()} — <Em>enjoy!</Em></Sentence>
            </Card>
          </motion.div>
        )}
      </motion.div>
    </motion.div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   HOUSEHOLD — the people, how the work is sharing out, and the things around
   the house. Insights live here now: fairness belongs with the faces.
   ════════════════════════════════════════════════════════════════════════════ */

const ROOMS = ["Kitchen", "Living room", "Primary bath", "Kids room", "Yard", "Garage"];
const ASSETS: [string, string, string][] = [
  ["HVAC system", "Warranty to 2027", "Filter in 4 days"],
  ["Dishwasher", "Warranty to 2026", "Descale next mo"],
  ["Washer + dryer", "Warranty to 2028", "—"],
  ["Lawn mower", "Warranty ends Oct", "Service due"],
];

/** The doors to the house's own machinery — sub-screens, not tabs. */
const DOORS: { route: "inventory" | "maint" | "autos" | "settings"; icon: IconName; label: string; blurb: string }[] = [
  { route: "inventory", icon: "box", label: "Inventory", blurb: "Pantry, supplies, medicine" },
  { route: "maint", icon: "wrench", label: "Maintenance", blurb: "Upkeep & warranties" },
  { route: "autos", icon: "bolt", label: "Automations", blurb: "Rules & AI" },
  { route: "settings", icon: "gear", label: "Settings", blurb: "Members, privacy, AI" },
];

/**
 * A person, as the household actually knows them: who they are, what they may
 * do, and what they look after — the three kept visibly separate, because
 * that's the whole point of the model.
 *
 * The role is a CONTROL, not a label. It's assigned, so it must be changeable;
 * a role you can only read is one the app is secretly deriving. The picker
 * expands IN PLACE — the dark twin of the phone's selector language: recessed
 * ink panel, wash options, lemon ring on the chosen one.
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

  // The insights, baked in: how much gets finished, and how it shares out.
  const done = s.tasks.filter((t) => t.done).length;
  const pct = Math.round((done / Math.max(1, s.tasks.length)) * 100);
  const loads = doers(s).map((m) => ({ m, load: s.tasks.filter((t) => holder(t) === m.id).length }));
  const total = Math.max(1, loads.reduce((sum, l) => sum + l.load, 0));

  return (
    <motion.div variants={listStagger} initial="hidden" animate="show" className="grid grid-cols-4 gap-card-pad pb-2">
      {/* Pulse on the ink — who lives here, said in the page voice. */}
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

      {/* Rooms are ambient structure, not work — wash. */}
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

      {/* HOW IT'S GOING — the insights, where the people are. The lemon is the
          screen's one shout; the balance display stays in the dark voice.
          col-start-1 opens a fresh row: an odd person count would otherwise
          wedge this pair into the leftover columns and split it. */}
      <motion.div variants={listItem} className="col-span-2 col-start-1">
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

      <motion.div variants={listItem} className="col-span-2">
        <Card tone="wash" className="flex h-full flex-col">
          <TitleBlock size="card" tone="onDark" title="Share of the work" />
          <div className="mt-stack flex-1">
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

      {/* THE THINGS AROUND — doors to the house's own machinery, in the
          sidebar idiom: quiet washes, nothing shouting. */}
      {DOORS.map((d) => (
        <motion.div key={d.route} variants={listItem}>
          <Card tone="wash" onClick={() => s.goIpad(d.route)} className="flex min-h-[160px] flex-col">
            <IconTile name={d.icon} tone="onDark" />
            <div className="mt-auto">
              <b className="block text-h2">{d.label}</b>
              <div className="mt-0.5 text-bodysm font-medium text-white/50">{d.blurb}</div>
            </div>
          </Card>
        </motion.div>
      ))}
    </motion.div>
  );
}
