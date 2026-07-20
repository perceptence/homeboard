"use client";

import clsx from "clsx";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Icon, type IconName } from "@/components/Icons";
import { EventCard, TaskCard } from "@/components/TaskCard";
import { Avatar, Button, Card, Check, Em, Eyebrow, IconTile, List, Pill, Row, Sentence, TabToggle, TitleBlock, type TileTone } from "@/components/ui";
import { Step } from "@/components/Period";
import { addDays, clockLabel, greeting, isCurrentPeriod, iso, isToday, parse, periodLabel, relative, relativeInline, shiftPeriod, startOfWeek, timeMinutes, timeOfDay, today as todayLabel, todayIso } from "@/lib/dates";
import { listItem, listStagger, smooth } from "@/lib/motion";
import { billTasks, doers, holder, pendingFor, previewRebalance, shoppingList, useHousehold } from "@/lib/store";
import type { HouseEvent, Member, Role } from "@/lib/types";
import { ROLE_HINT, ROLE_LABEL } from "@/lib/types";

/** Focus ring for raw buttons on a LIGHT surface (inside a Card) — the app's
 *  usual ink ring. */
const FOCUS = "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";

const DAY_PARTS = ["Morning", "Afternoon", "Evening"] as const;

/** Which third of the day a thing sits in — a clock time by its hour (noon and
 *  5pm the seams), a word-label ("After school", "Evening") by its word, and
 *  anything timeless ("Any time", "all day") framing the morning. */
const partOfDay = (when: string): 0 | 1 | 2 => {
  const min = timeMinutes(when);
  if (min >= 0) return min < 720 ? 0 : min < 1020 ? 1 : 2;
  const w = when.toLowerCase();
  if (/even|night|dinner/.test(w)) return 2;
  if (/afternoon|school|lunch/.test(w)) return 1;
  return 0;
};

/** A shopping category's own glyph — food for Groceries, a box for Supplies. */
const catIcon = (cat: string): IconName => {
  const c = cat.toLowerCase();
  if (c.includes("groc")) return "veg";
  if (c.includes("pet")) return "pet";
  if (c.includes("suppl")) return "box";
  return "cart";
};
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
          tone="lemon"
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
      action: <Button size="touch" tone="outlineDark" onClick={() => s.scheduleMaint(m.id)}>Schedule</Button>,
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

  /* HAPPENING TODAY, SPLIT IN THREE — the whole household's day dealt into
     Morning / Afternoon / Evening columns so a full day spreads sideways
     instead of towering down one rail.

     Rendered only once mounted: demo events are seeded relative to NOW at
     module import, and server/client import moments apart, so a time can drift
     across the hydration boundary and land an item in a different column
     (suppressHydrationWarning absolves drifting text, not a moved subtree).
     Pre-mount both sides render nothing under the entrance fade; the columns
     fill on the first effect. */
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const dayItems = [
    ...today.map((t) => ({ key: `t${t.id}`, when: t.when, part: partOfDay(t.when), el: <TaskCard task={t} showOwner /> })),
    ...s.events
      .filter((e) => isToday(e.due) && !e.done)
      .map((e) => ({ key: `e${e.id}`, when: e.time, part: partOfDay(e.time), el: <EventCard event={e} showOwner /> })),
  ];
  const buckets = [0, 1, 2].map((p) =>
    dayItems.filter((it) => it.part === p).sort((a, b) => timeMinutes(a.when) - timeMinutes(b.when) || a.key.localeCompare(b.key)),
  );

  // A warm, honest line under the faces — wfh counts as "around" (they're
  // home); only out/away is elsewhere.
  const out = doers(s).filter((m) => { const p = m.availability?.presence ?? "here"; return p === "out" || p === "away"; });
  const familyLine = out.length === 0 ? "everyone’s around today" : `${out.map((m) => m.name).join(", ")} out today`;

  /* THE SHARED LIST — grouped the way you'd walk the shop. */
  const list = shoppingList(s);
  const autoAdded = list.filter((i) => i.low && !i.done);
  const cats = Array.from(new Set(list.map((i) => i.category)));

  return (
    <motion.div variants={listStagger} initial="hidden" animate="show" className="grid grid-cols-4 gap-x-3 gap-y-4 pb-2">
      {/* THE HERO BAND — the day, opened: the greeting on the left, the family
          on the right, walled by nothing but space. It carries the mood; the
          decisions live in "Worth a look" right below. */}
      <motion.div variants={listItem} className="col-span-4">
        <Card tone="lemon" className="flex min-h-[260px] flex-col gap-6 @[1024px]:flex-row @[1024px]:items-stretch @[1024px]:gap-8">
          {/* Left — the greeting. */}
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex items-center gap-3">
              <IconTile name="feed" tone="onTint" />
              <Eyebrow className="!text-ink/50"><span suppressHydrationWarning>{todayLabel()}</span></Eyebrow>
            </div>
            <div className="mt-auto pt-8">
              <h1 className="font-tight text-[56px] font-medium leading-[0.95] tracking-[-0.02em]">
                <span suppressHydrationWarning>{greeting()}</span>.
              </h1>
              <Sentence className="mt-3 max-w-[24ch]">
                <Em>{s.householdName}</Em> has <Em>{today.length}</Em>{" "}
                {today.length === 1 ? "thing" : "things"} on today
                {doneCount > 0 ? <>, <Em>{doneCount}</Em> already done</> : null}.
              </Sentence>
            </div>
          </div>

          {/* Right — the family, on a hairline-walled column of its own. */}
          <div className="flex shrink-0 flex-col justify-end border-white/15 @[1024px]:w-[300px] @[1024px]:border-l @[1024px]:pl-8">
            <Eyebrow className="!text-ink/50">The family</Eyebrow>
            <div className="mt-4 flex items-center gap-3">
              <span className="flex -space-x-2">
                {people.slice(0, 5).map((id) => (
                  <span key={id} className="ring-2 ring-lemon">
                    <Avatar member={s.members[id]} size={44} />
                  </span>
                ))}
              </span>
            </div>
            <span className="mt-3 text-caption font-medium text-ink/50">{familyLine}</span>
          </div>
        </Card>
      </motion.div>

      {/* WORTH A LOOK — what actually needs someone. Same grammar as Household's
          "Share of the work": a dark-grey wash card, its icon on top, a space,
          the eyebrow title, then the data — here, the attention items dealt
          across so the row reads sideways, not down. */}
      <motion.div variants={listItem} className="col-span-4">
        <Card tone="wash">
          <IconTile name="spark" tone="onDark" />
          <Eyebrow tone="onDark" className="mt-6">Worth a look</Eyebrow>
          {attention.length > 0 ? (
            // Three fill the row (two in portrait, where a third's own width
            // would get too cramped); a row that runs longer doesn't wrap to a
            // lonely second line — it rides off the right edge and scrolls.
            <div className="no-scrollbar mt-4 flex gap-3 overflow-x-auto">
              {attention.map((a) => (
                <div key={a.key} className="flex w-[calc((100%-.75rem)/2)] shrink-0 items-center gap-3 rounded-card border border-white/[.08] bg-white/[.04] p-4 @[1024px]:w-[calc((100%-1.5rem)/3)]">
                  <IconTile name={a.icon} tone="onDark" size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="text-bodysm font-medium leading-snug text-white">{a.title}</div>
                    <div className="mt-0.5 truncate text-caption text-white/45">{a.meta}</div>
                  </div>
                  {a.action && <span className="shrink-0">{a.action}</span>}
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-bodysm text-white/45">Nothing needs a look. Rare — enjoy it.</p>
          )}
        </Card>
      </motion.div>

      {/* THE DAY — dealt into three columns by when it happens, so a busy day
          reads across, not down. No "Happening today" heading: the column
          heads (Morning / Afternoon / Evening) already title the section. */}
      <motion.div variants={listItem} className="col-span-4 flex flex-col gap-tile">
        {dayItems.length === 0 ? (
          <Card tone="wash" pad="lg" className="text-center">
            <Sentence className="py-6 text-white">The house is caught up. <Em>Nothing on.</Em></Sentence>
          </Card>
        ) : mounted ? (
          <div className="grid grid-cols-1 items-start gap-3 @[1024px]:grid-cols-3">
            {DAY_PARTS.map((label, p) => (
              <div key={label} className="flex flex-col gap-tile">
                <div className="px-1 text-caption font-medium uppercase tracking-[0.08em] text-white/40">{label}</div>
                {buckets[p].map((c) => (
                  <div key={c.key}>{c.el}</div>
                ))}
                {buckets[p].length === 0 && (
                  <div className="rounded-card border border-white/[.06] px-3 py-4 text-caption text-white/30">Nothing scheduled</div>
                )}
              </div>
            ))}
          </div>
        ) : null}
      </motion.div>

      {/* THE SHARED LIST — today's errand, a wide shelf across the foot. */}
      <motion.div variants={listItem} className="col-span-4 flex flex-col gap-tile">
        <Eyebrow tone="onDark">Shopping</Eyebrow>
        {/* Lavender ONLY when the AI actually did something — the accent is
            earned by the act, not standing furniture. */}
        {autoAdded.length > 0 && (
          <Card tone="lavender">
            <div className="flex items-center gap-4">
              <IconTile name="spark" tone="lemon" />
              <div className="min-w-0">
                <Eyebrow>Auto-added</Eyebrow>
                <div className="mt-0.5 text-bodysm font-medium leading-snug">
                  <Em>{autoAdded.length}</Em> things that were running low, straight onto the list:{" "}
                  {autoAdded.map((i) => i.title).join(", ")}.
                </div>
              </div>
            </div>
          </Card>
        )}
        <div className="grid grid-cols-1 gap-3 @[1024px]:grid-cols-3">
          {cats.map((cat) => {
            const left = list.filter((x) => x.category === cat && !x.done).length;
            return (
            <Card key={cat} pad="none" className="self-start">
              {/* Same card grammar as Worth a look / Appliances — icon on top, a
                  space, the title (its count riding the subtext), then the data
                  — but kept white, because this is a worklist you act on. */}
              <div className="px-card-pad pt-card-pad">
                <IconTile name={catIcon(cat)} />
                <TitleBlock size="card" className="mt-6" title={cat} subtext={left ? `${left} to get` : "All bought"} />
              </div>
              <List className="pt-3 pb-2">
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
            );
          })}
        </div>
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

/** The real Mon–Sun of the week `anchor` sits in. */
const weekDays = (anchor: Date) =>
  Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(anchor), i));

/**
 * The whole of `anchor`'s month as a rectangle of weeks: from the Monday
 * on/before the 1st to the Sunday on/after the last, so every row is a full
 * week. Days from the neighbouring months come along (dimmed) — that's what
 * makes it a calendar and not a ragged list.
 */
const monthDays = (anchor: Date) => {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const last = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
  const gridStart = startOfWeek(first);
  const gridEnd = addDays(startOfWeek(last), 7); // exclusive: end of the last week
  const count = Math.round((+gridEnd - +gridStart) / 86_400_000);
  return {
    month: anchor.getMonth(),
    days: Array.from({ length: count }, (_, i) => addDays(gridStart, i)),
  };
};

export function IpadCalendar() {
  const s = useHousehold();
  const [view, setView] = useState<CalView>("Week");
  // `anchor` is which week/month is on screen — step it to browse others.
  const [anchor, setAnchor] = useState<Date>(() => new Date());
  // The right pane reads a selected DAY (its event list); one event in that
  // list can be EXPANDED (selEvent) to show its details in place.
  const [selDay, setSelDay] = useState<string>(() => todayIso());
  const [selEvent, setSelEvent] = useState<string | null>(null);

  const pickDay = (di: string) => { setSelDay(di); setSelEvent(null); };
  // A chip opens its event's day AND expands it, so a tap on the grid lands
  // straight on the details.
  const pickEvent = (id: string, due: string) => { setSelDay(due); setSelEvent(id); };
  const toggleEvent = (id: string) => setSelEvent((cur) => (cur === id ? null : id));
  // Step by the unit you're looking at — a week in Week, a month in Month.
  const step = (dir: -1 | 1) => setAnchor((a) => shiftPeriod(view, a, dir));

  const { month, days } = monthDays(anchor);

  const dayCell = (day: Date, mode: "week" | "month", dim?: boolean) => {
    const di = iso(day);
    const isTodayCell = isToday(di);
    const isSel = di === selDay;
    const evs = s.events.filter((e) => e.due === di);
    const week = mode === "week";
    return (
      <div
        key={di}
        role="button"
        tabIndex={0}
        onClick={() => pickDay(di)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pickDay(di); } }}
        className={clsx(
          "flex cursor-pointer flex-col text-left transition-colors",
          // Week cells fill the column's full height; month cells stay compact.
          week ? "h-full min-h-0 rounded-card p-3" : "min-h-[104px] gap-1 rounded-md p-2",
          FOCUS_DARK,
          isTodayCell
            ? "bg-lemon text-ink"
            : dim
              ? "border border-white/[.04] bg-white/[.02] text-white/35"
              : "border border-white/10 bg-white/[.06] text-white hover:bg-white/[.09]",
          // The ring marks the day the pane is READING — kept distinct from the
          // lemon "today" fill, same two-state language as the phone's ruler.
          isSel && !isTodayCell && "ring-2 ring-inset ring-lemon",
          isSel && isTodayCell && "ring-2 ring-inset ring-ink/40",
        )}
      >
        <div className="flex items-baseline justify-between">
          {week && (
            <span className={clsx("text-caption font-medium uppercase", isTodayCell ? "opacity-50" : "text-white/45")}>
              {day.toLocaleDateString("en-GB", { weekday: "short" })}
            </span>
          )}
          <span className={clsx("tabular-nums", week ? "text-h2" : "ml-auto text-bodysm font-medium")}>{day.getDate()}</span>
        </div>
        {/* Week: the events fill the tall cell and scroll if a day is packed.
            Month: two chips then a "+N more" so cells stay a tidy grid. */}
        <div className={clsx("flex min-h-0 flex-col", week ? "mt-2 flex-1 gap-1.5 overflow-y-auto no-scrollbar" : "mt-1 gap-1")}>
          {(week ? evs : evs.slice(0, 2)).map((e) => (
            <button
              key={e.id}
              onClick={(ev) => { ev.stopPropagation(); pickEvent(e.id, e.due); }}
              style={{ background: s.members[e.who]?.color }}
              className={clsx("block w-full shrink-0 truncate rounded-sm px-2 py-1 text-left text-micro font-medium leading-tight text-white", dim && "opacity-40", FOCUS)}
            >
              {week && <span suppressHydrationWarning className="block opacity-75">{e.time}</span>}
              {e.title}
            </button>
          ))}
          {!week && evs.length > 2 && (
            <span className="text-micro font-medium text-white/40">+{evs.length - 2} more</span>
          )}
        </div>
      </div>
    );
  };

  return (
    // Fixed height, not page scroll: Week fills the screen (tall day columns +
    // full-height pane); Month scrolls its own grid if it runs long.
    <motion.div variants={listStagger} initial="hidden" animate="show" className="flex h-full min-h-0 flex-col gap-card-pad">
      {/* HEADER — the period, with steppers to walk weeks/months, and the view
          toggle. */}
      <motion.div variants={listItem} className="flex shrink-0 items-end gap-3 px-1.5">
        <div className="min-w-0">
          <Eyebrow tone="onDark">Calendar</Eyebrow>
          <div className="mt-1 flex items-center gap-1">
            {/* ‹ flanks the value on the left, › on the right — the period reads
                as the thing you're stepping through, not a label with a pair of
                arrows tacked after it. */}
            <Step dir={-1} onClick={() => step(-1)} />
            <div className="font-tight text-h1 tabular-nums text-white">{periodLabel(view, anchor)}</div>
            <Step dir={1} onClick={() => step(1)} />
            {!isCurrentPeriod(view, anchor) && (
              <button
                onClick={() => setAnchor(new Date())}
                className="ml-1 rounded-pill bg-white/10 px-2.5 py-1 text-caption font-medium text-white/70 transition-colors hover:bg-white/20 hover:text-white"
              >
                Today
              </button>
            )}
          </div>
        </div>
        <span className="ml-auto self-center">
          <TabToggle options={CAL_VIEWS} value={view} onChange={setView} layoutId="ipadCalView" />
        </span>
      </motion.div>

      {/* BODY — the calendar and the pane, both filling the remaining height. */}
      <div className="flex min-h-0 flex-1 gap-card-pad">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {view === "Week" ? (
            <motion.div variants={listItem} className="grid min-h-0 flex-1 auto-rows-fr grid-cols-7 gap-2">
              {weekDays(anchor).map((day) => dayCell(day, "week"))}
            </motion.div>
          ) : (
            <motion.div variants={listItem} className="flex min-h-0 flex-1 flex-col">
              <div className="mb-2 grid shrink-0 grid-cols-7 gap-2 px-1">
                {WEEKDAY_LABELS.map((w) => (
                  <div key={w} className="text-caption font-medium uppercase text-white/40">{w}</div>
                ))}
              </div>
              <div className="no-scrollbar grid min-h-0 flex-1 auto-rows-min grid-cols-7 gap-2 overflow-y-auto">
                {days.map((day) => dayCell(day, "month", day.getMonth() !== month))}
              </div>
            </motion.div>
          )}
        </div>

        {/* THE PANE — the selected day's events, each expandable in place. Full
            height, white: the screen's one worklist surface against the grid. */}
        <motion.div variants={listItem} className="min-h-0 w-[320px] shrink-0">
          <CalendarPane day={selDay} expandedId={selEvent} onToggle={toggleEvent} />
        </motion.div>
      </div>
    </motion.div>
  );
}

/** The Calendar's right pane: the selected day's events. Tapping one expands
 *  its details IN PLACE (no view-swap, no back button) and collapses again. */
function CalendarPane({
  day, expandedId, onToggle,
}: {
  day: string; expandedId: string | null; onToggle: (id: string) => void;
}) {
  const s = useHousehold();
  // Seeded demo event times drift across the hydration boundary (see IpadToday);
  // the list sort waits for mount so the two renders can't disagree on order.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const evs = s.events
    .filter((e) => e.due === day)
    .sort((a, b) => (mounted ? timeMinutes(a.time) - timeMinutes(b.time) : 0) || a.id.localeCompare(b.id));
  const d = parse(day);

  return (
    <Card className="flex h-full flex-col">
      <TitleBlock
        size="card"
        className="shrink-0"
        eyebrow={isToday(day) ? "Today" : d.toLocaleDateString("en-GB", { weekday: "long" })}
        title={d.toLocaleDateString("en-GB", { day: "numeric", month: "long" })}
      />
      <div className="no-scrollbar mt-stack -mx-1 flex min-h-0 flex-1 flex-col overflow-y-auto px-1">
        {evs.map((e) => (
          <EventRow key={e.id} event={e} open={e.id === expandedId} onToggle={() => onToggle(e.id)} />
        ))}
        {evs.length === 0 && (
          <p className="py-8 text-center text-bodysm text-sub">Nothing on this day.</p>
        )}
      </div>
    </Card>
  );
}

/** One row in the day pane: a summary line that expands to the event's details
 *  and completion actions — the same ones the event sheet offers. */
function EventRow({ event, open, onToggle }: { event: HouseEvent; open: boolean; onToggle: () => void }) {
  const s = useHousehold();
  const who = s.members[event.who];
  return (
    <div className="border-b border-ink/[.06] last:border-b-0">
      <button
        onClick={onToggle}
        aria-expanded={open}
        className={clsx("-mx-1 flex w-[calc(100%+0.5rem)] items-center gap-3 rounded-sm px-1 py-2.5 text-left transition-colors hover:bg-surface", FOCUS)}
      >
        <Avatar member={who} size={32} />
        <span className="min-w-0 flex-1">
          <span className={clsx("block truncate text-bodysm font-medium", event.done && "text-sub line-through")}>{event.title}</span>
          <span className="block truncate text-caption text-sub">{who?.name ?? "—"}</span>
        </span>
        <span suppressHydrationWarning className="shrink-0 text-caption text-sub">{event.time}</span>
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={smooth} className="flex shrink-0 text-sub">
          <Icon name="chevDown" size={16} />
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
            <div className="pb-3.5 pl-[44px]">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-sub">
                <span suppressHydrationWarning className="flex items-center gap-1">
                  <Icon name="clock" size={13} /> {clockLabel(event.time)}
                </span>
                {event.journey && event.where && (
                  <span className="flex items-center gap-1"><Icon name="pin" size={13} /> {event.where}</span>
                )}
                {event.recurring && (
                  <span className="flex items-center gap-1"><Icon name="repeat" size={13} /> {event.recurring.toLowerCase()}</span>
                )}
              </div>

              {event.done ? (
                <p className="mt-3 flex items-center gap-1.5 text-caption font-medium text-sub">
                  <Icon name="check" size={14} /> Handled
                </p>
              ) : (
                <div className="mt-3 flex flex-wrap gap-2">
                  {/* "On my way" only with someone in `waiting` at the far end. */}
                  {!!event.waiting?.length && (
                    <Button size="touch" tone="dark" onClick={() => s.onWay(event.id)}>
                      <Icon name="car" size={14} /> On my way
                    </Button>
                  )}
                  <Button size="touch" tone={event.waiting?.length ? "outline" : "dark"} onClick={() => s.completeEvent(event.id)}>
                    <Icon name="check" size={14} /> Done
                  </Button>
                  <Button size="touch" tone="outline" onClick={() => s.remindForEvent(event.id)}>
                    <Icon name="bell" size={14} /> Remind me
                  </Button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   HOUSEHOLD — the people, how the work is sharing out, and the things around
   the house. Insights live here now: fairness belongs with the faces.
   ════════════════════════════════════════════════════════════════════════════ */

const ASSETS: [string, string, string][] = [
  ["HVAC system", "Warranty to 2027", "Filter in 4 days"],
  ["Dishwasher", "Warranty to 2026", "Descale next mo"],
  ["Washer + dryer", "Warranty to 2028", "—"],
  ["Lawn mower", "Warranty ends Oct", "Service due"],
];

/** One figure + its label in the wide insights card — ink on the lemon. With
 *  `onClick` it becomes a door (the balance stat opens the rebalance sheet),
 *  its label carrying a small arrow to say so. */
function Stat({ figure, label, onClick }: { figure: React.ReactNode; label: string; onClick?: () => void }) {
  const body = (
    <>
      <div className="truncate text-h1 font-medium leading-none tabular-nums">{figure}</div>
      <div className={clsx("mt-1 flex items-center gap-0.5 truncate text-caption font-medium", onClick ? "text-ink/70" : "text-ink/55")}>
        {label}{onClick && <Icon name="arrow" size={12} />}
      </div>
    </>
  );
  return onClick ? (
    <button onClick={onClick} className={clsx("-mx-1 min-w-0 rounded-sm px-1 py-0.5 text-left transition-colors hover:bg-ink/[.06]", FOCUS)}>
      {body}
    </button>
  ) : (
    <div className="min-w-0">{body}</div>
  );
}

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

  // The insights, baked in: how much gets finished, how it shares out, and the
  // machinery quietly carrying its own weight.
  const done = s.tasks.filter((t) => t.done).length;
  const pct = Math.round((done / Math.max(1, s.tasks.length)) * 100);
  const loads = doers(s).map((m) => ({ m, load: s.tasks.filter((t) => holder(t) === m.id).length }));
  const total = Math.max(1, loads.reduce((sum, l) => sum + l.load, 0));
  const autoOn = s.automations.filter((a) => a.on).length;
  const upkeep = s.maint.filter((m) => m.status === "over" || m.status === "due").length;

  // The pulse's live half: everything open (unclaimed work is still the
  // house's), and who ISN'T simply around right now.
  const open = s.tasks.filter((t) => !t.done).length;
  const elsewhere = doers(s)
    .map((m) => ({ m, p: m.availability?.presence ?? ("here" as const) }))
    .filter((x) => x.p !== "here");
  const whereLine = elsewhere.length === 0
    ? "Everyone’s around right now."
    : elsewhere
        .map(({ m, p }) =>
          p === "wfh" ? `${m.name} is home today`
          : p === "out" ? `${m.name} is out`
          : m.availability?.to ? `${m.name} is away until ${relativeInline(m.availability.to)}`
          : `${m.name} is away`)
        .join(" · ") + ".";
  // Balance is the ENGINE's call, not a re-derived spread: previewRebalance
  // returns a worthwhile move only when the load can actually be evened (it
  // already knows who's barred from what), so "Even" means as-even-as-it-gets,
  // not literally equal. When there IS a move, the stat becomes the door to it.
  const move = previewRebalance(s);
  const balanceLabel = move ? "Uneven" : "Even";

  return (
    <motion.div variants={listStagger} initial="hidden" animate="show" className="grid grid-cols-1 gap-card-pad pb-2 @[1024px]:grid-cols-4">
      {/* THE PULSE — the house speaking as itself, on the ink. Not a static
          "who lives here" any more: the census, what they're carrying, and a
          live where-everyone-is line, so the slot holds the house's state
          instead of one floating sentence. */}
      <motion.div variants={listItem} className="flex min-h-[200px] flex-col px-1.5 py-1 @[1024px]:col-span-2">
        <span className="flex -space-x-2">
          {everyone.slice(0, 5).map((m) => (
            <span key={m.id} className="ring-2 ring-ink">
              <Avatar member={m} size={34} />
            </span>
          ))}
        </span>
        <div className="mt-auto">
          <Eyebrow tone="onDark">The household</Eyebrow>
          <Sentence className="mt-1 max-w-[22ch] text-white">
            <Em>{people}</Em> {people === 1 ? "person" : "people"}
            {pets ? <> and <Em>{pets}</Em> {pets === 1 ? "pet" : "pets"}</> : null}, carrying{" "}
            <Em>{open}</Em> {open === 1 ? "thing" : "things"} between them.
          </Sentence>
          <p className="mt-2.5 text-bodysm font-medium text-white/50">{whereLine}</p>
        </div>
      </motion.div>

      {/* SHARE OF THE WORK — beside the people, where Rooms used to sit. The
          phone card grammar: icon, space, title, then the data. Rebalancing
          moved to the Last-30 card's balance stat, so no action lives here. */}
      <motion.div variants={listItem} className="@[1024px]:col-span-2">
        <Card tone="wash" className="flex h-full min-h-[200px] flex-col">
          <IconTile name="scale" tone="onDark" />
          <Eyebrow tone="onDark" className="mt-6">Share of the work</Eyebrow>
          {/* Caps at ~four rows and scrolls past that — a big family stays a
              tidy card beside the pulse instead of stretching the row. */}
          <div className="no-scrollbar mt-3 max-h-[164px] flex-1 overflow-y-auto">
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

      {/* The people run in ONE row that scrolls sideways — a big family never
          wraps onto a second line and shoves everything below out of rhythm.
          The row's height is auto, so an open role picker just grows it rather
          than being clipped. */}
      <motion.div variants={listItem} className="@[1024px]:col-span-4">
        <div className="no-scrollbar flex items-start gap-card-pad overflow-x-auto">
          {everyone.map((m) => (
            <div key={m.id} className="w-[264px] shrink-0">
              <PersonCard member={m} />
            </div>
          ))}
        </div>
      </motion.div>

      {/* HOW IT'S GOING — the household's month at a glance, full width and the
          screen's one lemon shout: a headline finish-rate plus the numbers
          behind it. Household voice throughout — never "you're". */}
      <motion.div variants={listItem} className="@[1024px]:col-span-4">
        {/* The family's "Your progress" — the SAME lavender progress card the
            phone wears, so the two surfaces read as one app: trend well on
            lavender, then the space, the title, and the figure. */}
        <Card tone="lavender" className="flex flex-col">
          <IconTile name="trend" tone="lemon" />
          <div className="mt-6 flex items-end gap-4">
            <div className="min-w-0 flex-1">
              <Eyebrow>Last 30 days</Eyebrow>
              <Sentence className="mt-1 max-w-[24ch]">
                The house is finishing <Em>most</Em>{" "}of what it&rsquo;s asked.
              </Sentence>
            </div>
            <span className="shrink-0 font-tight text-[56px] font-medium leading-none tabular-nums tracking-tighter">{pct}%</span>
          </div>
          <div className="mt-6 grid grid-cols-2 gap-4 border-t border-ink/10 pt-5 @[1024px]:grid-cols-4">
            <Stat figure={done} label={done === 1 ? "thing done" : "things done"} />
            <Stat figure={autoOn} label={autoOn === 1 ? "running on autopilot" : "on autopilot"} />
            <Stat figure={upkeep} label="upkeep due" />
            {/* The balance is the door to rebalancing — only when there's a
                worthwhile move; otherwise it's a plain, honest "Even". */}
            <Stat
              figure={balanceLabel}
              label={move ? "even it out" : "the balance"}
              onClick={move ? () => s.openSheet({ type: "rebalance" }) : undefined}
            />
          </div>
        </Card>
      </motion.div>

      {/* Appliances — a read-only status list, so it wears the wash like every
          other ambient block; white is reserved for worklists you act on. */}
      <motion.div variants={listItem} className="@[1024px]:col-span-4">
        <Card tone="wash" pad="none">
          <div className="px-card-pad pt-card-pad">
            <IconTile name="box" tone="onDark" />
            <Eyebrow tone="onDark" className="mt-6">Appliances &amp; warranties</Eyebrow>
          </div>
          <List className="pb-2 pt-3">
            {ASSETS.map(([name, warranty, next]) => (
              <Row key={name} tone="dark" lead={<IconTile name="box" tone="onDark" />} title={name} meta={warranty}
                actions={<Pill tone={next === "—" ? "dark" : "lavender"}>{next}</Pill>} />
            ))}
          </List>
        </Card>
      </motion.div>

      {/* THE THINGS AROUND — doors to the house's own machinery, in the
          sidebar idiom: quiet washes, nothing shouting. Own 2-up grid in
          portrait (a door full-width, stacked four deep, wastes height for
          what's a nav shortcut); `@[1024px]:contents` drops the wrapper in landscape
          so the doors resume being plain col-span-1 children of the outer grid. */}
      <div className="col-span-1 grid grid-cols-2 gap-card-pad @[1024px]:contents">
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
      </div>
    </motion.div>
  );
}
