"use client";

import clsx from "clsx";
import { motion } from "framer-motion";
import { badge, clockLabel, relative } from "@/lib/dates";
import { holder, useHousehold } from "@/lib/store";
import type { HouseEvent, MaintItem, Task } from "@/lib/types";
import { Icon } from "./Icons";
import { Avatar, Button, Card, DateBadge, PriorityPill, TitleBlock } from "./ui";

/**
 * THE STANDARD CARD FORMAT — every task and event on a white card uses it:
 *
 *   Eyebrow   where it came from  ("Home maintenance", "Calendar", "Automation")
 *   Title     what it is          ("Take out the trash")
 *   Subtitle  when + frequency    ("Tonight ⟳ Weekly")
 *
 * One task, one card. Tasks are never grouped into a shared box.
 *
 * EVERY card that wears this opens. Tasks, events and upkeep look identical on
 * purpose — so if one of them refuses the tap, the card is lying about what it
 * is. `onOpen` is effectively required; the optional signature is only for the
 * iPad's read-only summaries.
 */
function ItemCard({
  day, weekday, source, title, subtitle, done, onOpen, actions,
}: {
  day: number | string; weekday: string;
  source: string; title: string; subtitle: React.ReactNode;
  done?: boolean; onOpen?: () => void; actions?: React.ReactNode;
}) {
  return (
    <Card className={clsx(done && "opacity-60")}>
      {/* items-stretch: the date pill runs the FULL height of the card. */}
      <div className="flex items-stretch gap-4">
        <DateBadge day={day} weekday={weekday} />

        <button onClick={onOpen} disabled={!onOpen} className="min-w-0 flex-1 text-left">
          {/* Same component as the page header — just the card size. `oneLine`:
              a row's eyebrow and subtext clip rather than wrap, so no source
              name or long subtitle can make one card taller than the next. */}
          <TitleBlock size="card" oneLine eyebrow={source} title={title} subtext={subtitle} muted={done} />
        </button>

        {actions && <div className="flex shrink-0 items-center gap-2 self-center">{actions}</div>}
      </div>
    </Card>
  );
}

/** Fallback when a task has no explicit source (e.g. one the user just added). */
const sourceOf = (t: Task) =>
  t.source ?? (t.recurring ? "Routine" : t.suggest ? "Suggested" : "Added by you");

export function TaskCard({ task, showOwner }: { task: Task; showOwner?: boolean }) {
  const { members, toggleTask, onWay, openSheet } = useHousehold();
  const did = holder(task);
  const owner = did ? members[did] : undefined;
  /** Cover has to be VISIBLE or it's indistinguishable from a reassignment —
   *  the card would quietly say this is Sam's job when it isn't. */
  const covering = !!task.coveredBy;
  const d = badge(task.due);

  return (
    <motion.div layout>
      <ItemCard
        day={d.day}
        weekday={d.weekday}
        source={sourceOf(task)}
        title={task.title}
        done={task.done}
        onOpen={() => openSheet({ type: "task", id: task.id })}
        subtitle={
          <>
            {clockLabel(task.when)}
            {task.recurring && (
              <>
                <Icon name="repeat" size={14} />
                {task.recurring}
              </>
            )}
            {!task.done && <PriorityPill priority={task.priority} />}
            {/* Without this the card is a lie of omission: the avatar would show
                Sam and nothing would say the job is still Maya's. Cover you
                can't see is just a reassignment with extra steps. */}
            {covering && task.owner && (
              <span className="flex items-center gap-1">
                <Icon name="handoff" size={14} />
                Covering for {members[task.owner]?.name}
              </span>
            )}
          </>
        }
        actions={
          <>
            {showOwner && owner && (
              <button aria-label="Reassign" onClick={() => openSheet({ type: "assign", id: task.id })}>
                <Avatar member={owner} />
              </button>
            )}
            {/* THE PRIMARY ACTION, not a default. A journey task's first verb is
                "On my way" (it starts the live trip; arrival completes it) — a
                card offering "Done" for a pickup you haven't left for yet is
                answering the wrong question. Done still lives in the detail.
                Every action button wears its icon — one rule, no stragglers.
                (`light` is WHITE — invisible on a white card; hence dark.) */}
            {task.journey && !task.done ? (
              <Button tone="dark" onClick={() => onWay(task.id)}>
                <Icon name="car" size={14} /> On my way
              </Button>
            ) : (
              <Button tone={task.done ? "outline" : "dark"} onClick={() => toggleTask(task.id)}>
                <Icon name={task.done ? "undo" : "check"} size={14} /> {task.done ? "Undo" : "Done"}
              </Button>
            )}
          </>
        }
      />
    </motion.div>
  );
}

/**
 * An event wears the same card as a task — it's just sourced from the calendar.
 *
 * `showOwner` is OFF by default: on your own phone every card is yours, so an
 * avatar (and a trailing "· Sam") only repeats what you already know. It earns
 * its place on the shared iPad, where the household sees one screen.
 */
export function EventCard({ event, showOwner }: { event: HouseEvent; showOwner?: boolean }) {
  const { members, remindForEvent, openSheet } = useHousehold();
  const who = members[event.who];
  const d = badge(event.due);

  return (
    <motion.div layout>
      <ItemCard
        day={d.day}
        weekday={d.weekday}
        source="Calendar"
        title={event.title}
        done={event.done}
        onOpen={() => openSheet({ type: "event", id: event.id })}
        subtitle={
          <>
            {clockLabel(event.time)}
            {event.recurring && (
              <>
                <Icon name="repeat" size={14} />
                {event.recurring}
              </>
            )}
            {showOwner && who && <> · {who.name}</>}
          </>
        }
        actions={
          <>
            {showOwner && who && <Avatar member={who} />}
            {/* Once handled (a reminder's "Done" landed here), the card wears a
                quiet "Handled" instead of offering to remind you about a thing
                that's over. Otherwise: "Remind me", a real promise via the
                reminder engine. */}
            {event.done ? (
              <span className="flex items-center gap-1 text-caption font-medium text-sub">
                <Icon name="check" size={14} /> Handled
              </span>
            ) : (
              <Button tone="outline" onClick={() => remindForEvent(event.id)}>
                <Icon name="bell" size={14} /> Remind me
              </Button>
            )}
          </>
        }
      />
    </motion.div>
  );
}

/** Upkeep wears the same card — sourced from home maintenance. */
export function MaintCard({ item }: { item: MaintItem }) {
  const { openSheet } = useHousehold();
  return (
    <motion.div layout>
      <ItemCard
        day={badge(item.due).day}
        weekday={badge(item.due).weekday}
        source={`Home maintenance · ${item.asset}`}
        title={item.title}
        onOpen={() => openSheet({ type: "maint", id: item.id })}
        subtitle={
          <>
            {relative(item.due)}
            <Icon name="repeat" size={14} />
            {item.cadence}
          </>
        }
      />
    </motion.div>
  );
}
