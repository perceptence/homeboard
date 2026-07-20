"use client";

import clsx from "clsx";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Icon, type IconName } from "@/components/Icons";
import { EventCard, TaskCard } from "@/components/TaskCard";
import { Avatar, Button, Card, Check, Em, Eyebrow, IconTile, List, Pill, Row, Sentence, TabToggle, TitleBlock, type TileTone } from "@/components/ui";
import { addDays, clockLabel, iso, isToday, parse, periodLabel, relative, startOfWeek, timeMinutes, timeOfDay, today as todayLabel, todayIso } from "@/lib/dates";
import { listItem, listStagger, smooth } from "@/lib/motion";
import { billTasks, doers, holder, pendingFor, shoppingList, useHousehold } from "@/lib/store";
import type { Member, Role } from "@/lib/types";
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
     events alike, in the order they happen.

     The time sort waits for mount: demo events are seeded relative to NOW at
     module import, and the server and client import moments apart — so the
     minutes can differ across the hydration boundary and FLIP the merge order
     (suppressHydrationWarning can absolve drifting text, but not a reordered
     tree). First paint uses the stable key order both sides agree on; the
     true time order lands with the first effect, invisible under the
     entrance fade. */
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const happening = [
    ...today.map((t) => ({ key: `t${t.id}`, at: timeMinutes(t.when), el: <TaskCard task={t} showOwner /> })),
    ...s.events
      .filter((e) => isToday(e.due) && !e.done)
      .map((e) => ({ key: `e${e.id}`, at: timeMinutes(e.time), el: <EventCard event={e} showOwner /> })),
  ].sort((a, b) => (mounted ? a.at - b.at : 0) || a.key.localeCompare(b.key));

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
   CALENDAR — the week on the wall: today's list beside the pulse, then the
   real Mon–Sun in the dark idiom, member-coloured chips, lemon = today.
   ════════════════════════════════════════════════════════════════════════════ */

const CAL_VIEWS = ["Week", "Month"] as const;
type CalView = (typeof CAL_VIEWS)[number];
const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** The real Mon–Sun of the week you're in — not a hardcoded row of numbers. */
const weekDays = () =>
  Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(new Date()), i));

/**
 * The whole current month as a rectangle of weeks: from the Monday on/before
 * the 1st to the Sunday on/after the last, so every row is a full week. Days
 * from the neighbouring months come along (dimmed) — that's what makes it a
 * calendar and not a ragged list.
 */
const monthDays = () => {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const gridStart = startOfWeek(first);
  const gridEnd = addDays(startOfWeek(last), 7); // exclusive: end of the last week
  const count = Math.round((+gridEnd - +gridStart) / 86_400_000);
  return {
    month: now.getMonth(),
    days: Array.from({ length: count }, (_, i) => addDays(gridStart, i)),
  };
};

export function IpadCalendar() {
  const s = useHousehold();
  const [view, setView] = useState<CalView>("Week");
  // The right pane is driven by a selected DAY (its event list) and optionally a
  // selected EVENT (its details). Day defaults to today — the pane absorbs the
  // old standalone "Today" card, but interactive.
  const [selDay, setSelDay] = useState<string>(() => todayIso());
  const [selEvent, setSelEvent] = useState<string | null>(null);

  const pickDay = (di: string) => { setSelDay(di); setSelEvent(null); };
  // Picking an event also moves the day under it, so "back" returns to the
  // right list.
  const pickEvent = (e: { id: string; due: string }) => { setSelDay(e.due); setSelEvent(e.id); };

  const { month, days } = monthDays();

  /** One event chip inside a grid cell — clickable straight through to its
   *  details, stopping the cell's own day-select. */
  const Chip = ({ id, who, title, time, dim }: { id: string; who: string; title: string; time?: string; dim?: boolean }) => (
    <button
      onClick={(ev) => { ev.stopPropagation(); pickEvent({ id, due: selDayForChip(id) }); }}
      style={{ background: s.members[who]?.color }}
      className={clsx("block w-full truncate rounded-sm px-2 py-1 text-left text-micro font-medium leading-tight text-white", dim && "opacity-40", FOCUS)}
    >
      {time && <span suppressHydrationWarning className="block opacity-75">{time}</span>}
      {title}
    </button>
  );
  // A chip knows its own event's day (so pickEvent lands the pane on it).
  const selDayForChip = (id: string) => s.events.find((e) => e.id === id)?.due ?? selDay;

  const dayCell = (day: Date, opts: { compact?: boolean; dim?: boolean }) => {
    const di = iso(day);
    const isTodayCell = isToday(di);
    const isSel = di === selDay;
    const evs = s.events.filter((e) => e.due === di);
    return (
      <div
        key={di}
        role="button"
        tabIndex={0}
        onClick={() => pickDay(di)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pickDay(di); } }}
        className={clsx(
          "flex cursor-pointer flex-col rounded-card p-3 text-left transition-colors",
          opts.compact ? "min-h-[104px] gap-1 rounded-md p-2" : "min-h-[220px]",
          FOCUS_DARK,
          isTodayCell
            ? "bg-lemon text-ink"
            : opts.dim
              ? "border border-white/[.04] bg-white/[.02] text-white/35"
              : "border border-white/10 bg-white/[.06] text-white hover:bg-white/[.09]",
          // The ring marks the day the pane is READING — kept distinct from the
          // lemon "today" fill, same two-state language as the phone's ruler.
          isSel && !isTodayCell && "ring-2 ring-inset ring-lemon",
          isSel && isTodayCell && "ring-2 ring-inset ring-ink/40",
        )}
      >
        <div className="flex items-baseline justify-between">
          {!opts.compact && (
            <span className={clsx("text-caption font-medium uppercase", isTodayCell ? "opacity-50" : "text-white/45")}>
              {day.toLocaleDateString("en-GB", { weekday: "short" })}
            </span>
          )}
          <span className={clsx("tabular-nums", opts.compact ? "ml-auto text-bodysm font-medium" : "text-h2")}>{day.getDate()}</span>
        </div>
        <div className={clsx("flex flex-col", opts.compact ? "mt-1 gap-1" : "mt-2 gap-1.5")}>
          {(opts.compact ? evs.slice(0, 2) : evs).map((e) => (
            <Chip key={e.id} id={e.id} who={e.who} title={e.title} time={opts.compact ? undefined : e.time} dim={opts.dim} />
          ))}
          {opts.compact && evs.length > 2 && (
            <span className="text-micro font-medium text-white/40">+{evs.length - 2} more</span>
          )}
        </div>
      </div>
    );
  };

  return (
    <motion.div variants={listStagger} initial="hidden" animate="show" className="flex items-start gap-card-pad">
      {/* LEFT — the calendar, Week or Month. */}
      <div className="flex min-w-0 flex-1 flex-col gap-card-pad">
        <motion.div variants={listItem} className="flex items-end gap-3 px-1.5">
          <div className="min-w-0">
            <Eyebrow tone="onDark">Calendar</Eyebrow>
            <div className="mt-1 font-tight text-h1 text-white">{periodLabel(view, new Date())}</div>
          </div>
          <span className="ml-auto">
            <TabToggle options={CAL_VIEWS} value={view} onChange={(v) => { setView(v); setSelEvent(null); }} layoutId="ipadCalView" />
          </span>
        </motion.div>

        {view === "Week" ? (
          <motion.div variants={listItem} className="grid grid-cols-7 gap-2">
            {weekDays().map((day) => dayCell(day, {}))}
          </motion.div>
        ) : (
          <motion.div variants={listItem}>
            <div className="mb-2 grid grid-cols-7 gap-2 px-1">
              {WEEKDAY_LABELS.map((w) => (
                <div key={w} className="text-caption font-medium uppercase text-white/40">{w}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-2">
              {days.map((day) => dayCell(day, { compact: true, dim: day.getMonth() !== month }))}
            </div>
          </motion.div>
        )}
      </div>

      {/* RIGHT — the pane: a day's events, or one event's details. White, the
          screen's one worklist surface, against the ambient dark grid. */}
      <motion.div variants={listItem} className="w-[320px] shrink-0">
        <CalendarPane day={selDay} eventId={selEvent} onPickEvent={setSelEvent} onBack={() => setSelEvent(null)} />
      </motion.div>
    </motion.div>
  );
}

/** The Calendar's right pane. Two states on one surface: the selected day's
 *  event list, and — once you tap one — that event's details with a way back. */
function CalendarPane({
  day, eventId, onPickEvent, onBack,
}: {
  day: string; eventId: string | null; onPickEvent: (id: string) => void; onBack: () => void;
}) {
  const s = useHousehold();
  // Seeded demo event times drift across the hydration boundary (see IpadToday);
  // the list sort waits for mount so the two renders can't disagree on order.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const event = eventId ? s.events.find((e) => e.id === eventId) : null;

  if (event) {
    const who = s.members[event.who];
    return (
      <Card className="flex flex-col">
        <button
          onClick={onBack}
          className={clsx("-ml-1 mb-4 flex w-max items-center gap-1 rounded-sm py-0.5 pr-2 text-caption font-medium text-sub transition-colors hover:text-ink", FOCUS)}
        >
          <Icon name="back" size={16} /> Back to the day
        </button>

        <div className="flex items-center gap-3">
          <IconTile name={event.icon ?? "cal"} tone="lemon" />
          <h2 className="min-w-0 font-tight text-h2">{event.title}</h2>
        </div>

        <div className="mt-5 space-y-3 text-bodysm">
          <div className="flex items-center gap-3">
            <span className="w-14 shrink-0 text-caption text-sub">Who</span>
            <span className="flex min-w-0 items-center gap-2 font-medium">
              <Avatar member={who} size={22} /> <span className="truncate">{who?.name ?? "—"}</span>
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="w-14 shrink-0 text-caption text-sub">Time</span>
            <span suppressHydrationWarning className="font-medium">{clockLabel(event.time)}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="w-14 shrink-0 text-caption text-sub">{event.journey ? "Heading" : "Day"}</span>
            <span className="min-w-0 truncate font-medium">{event.journey && event.where ? event.where : relative(event.due)}</span>
          </div>
        </div>

        {event.recurring && (
          <p className="mt-4 flex items-center gap-1.5 text-caption text-sub">
            <Icon name="repeat" size={14} /> Repeats {event.recurring.toLowerCase()}
          </p>
        )}

        {event.done ? (
          <p className="mt-5 flex items-center justify-center gap-1.5 rounded-2xl bg-ink/[.05] py-3 text-bodysm font-medium text-sub">
            <Icon name="check" size={16} /> Handled
          </p>
        ) : (
          <div className="mt-5 flex flex-col gap-2">
            {/* Same actions the event sheet offers — "On my way" only with
                someone in `waiting` at the far end. */}
            {!!event.waiting?.length && (
              <Button tone="dark" size="lg" onClick={() => s.onWay(event.id)}>
                <Icon name="car" size={16} /> On my way
              </Button>
            )}
            <Button tone={event.waiting?.length ? "outline" : "dark"} size="lg" onClick={() => s.completeEvent(event.id)}>
              <Icon name="check" size={16} /> Done
            </Button>
            <Button tone="outline" size="lg" onClick={() => s.remindForEvent(event.id)}>
              <Icon name="bell" size={16} /> Remind me
            </Button>
          </div>
        )}
      </Card>
    );
  }

  const evs = s.events
    .filter((e) => e.due === day)
    .sort((a, b) => (mounted ? timeMinutes(a.time) - timeMinutes(b.time) : 0) || a.id.localeCompare(b.id));
  const d = parse(day);

  return (
    <Card className="flex flex-col">
      <TitleBlock
        size="card"
        eyebrow={isToday(day) ? "Today" : d.toLocaleDateString("en-GB", { weekday: "long" })}
        title={d.toLocaleDateString("en-GB", { day: "numeric", month: "long" })}
      />
      <div className="mt-stack flex flex-col">
        {evs.map((e) => {
          const who = s.members[e.who];
          return (
            <button
              key={e.id}
              onClick={() => onPickEvent(e.id)}
              className={clsx("-mx-2 flex items-center gap-3 rounded-sm px-2 py-2.5 text-left transition-colors hover:bg-surface", FOCUS)}
            >
              <Avatar member={who} size={32} />
              <span className="min-w-0 flex-1">
                <span className={clsx("block truncate text-bodysm font-medium", e.done && "text-sub line-through")}>{e.title}</span>
                <span className="block truncate text-caption text-sub">{who?.name ?? "—"}</span>
              </span>
              <span suppressHydrationWarning className="shrink-0 text-caption text-sub">{e.time}</span>
            </button>
          );
        })}
        {evs.length === 0 && (
          <p className="py-8 text-center text-bodysm text-sub">Nothing on this day.</p>
        )}
      </div>
    </Card>
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
