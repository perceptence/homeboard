"use client";

import clsx from "clsx";
import { useEffect, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Icon, type IconName } from "@/components/Icons";
import { Avatar, AvatarStack, Button, Card, Check, Choice, Eyebrow, IconTile, MiniCalendar, MiniClock, PickerChip, PickerPanel, Pill, PRIORITY_LABEL, PriorityPill, Sheet, TitleBlock } from "@/components/ui";
import { smooth } from "@/lib/motion";
import { addDays, ago, badge, clockLabel, dayLabel, iso, relative, startOfWeek, todayIso } from "@/lib/dates";
import { taskGlyph } from "@/lib/glyphs";
import { parseTask } from "@/lib/parse";
import { useDictation } from "@/lib/useDictation";
import { doers, pendingFor, previewRebalance, recall, shoppingList, suggestTaker, useHousehold, whyNot } from "@/lib/store";
import type { Member, MemberId, Priority, ShopCategory, ShopItem, Task } from "@/lib/types";
import { ROLE_CAN, ROLE_HINT, ROLE_LABEL, ROLE_NEEDS } from "@/lib/types";

/** Where a typed shopping item files itself — read from the words, shown live
 *  on the aisle chips, and one tap overrides it. Pet words win over Supplies
 *  words ("dog shampoo" is the dog's). Default: food. */
const inferCat = (t: string): ShopCategory =>
  /dog|cat|pet|litter|kibble|chew|juno/i.test(t) ? "Pet"
  : /soap|towel|paper|deterg|clean|spray|sponge|foil|batter|bulb|bin|bag|tissue|shampoo|toothpaste|brush|wipe|polish/i.test(t) ? "Supplies"
  : "Groceries";

/** All sheets for both surfaces. Phone gets a bottom sheet; iPad gets a centred modal. */
export function Sheets({ variant }: { variant: "phone" | "ipad" }) {
  const s = useHousehold();
  const sheet = s.sheet;
  const close = s.closeSheet;

  return (
    <>
      <Sheet open={!!sheet && sheet.type !== "newTask"} onClose={close} variant={variant}>
        {sheet?.type === "task" && <TaskSheet id={sheet.id as number} />}
        {/* Events and upkeep wear the same card as a task, so they must open like
            one. Until now only tasks had a sheet, and the other two silently
            refused the tap — same affordance, different behaviour. */}
        {sheet?.type === "event" && <EventSheet id={sheet.id as string} />}
        {sheet?.type === "maint" && <MaintSheet id={sheet.id as string} />}
        {sheet?.type === "assign" && <AssignSheet id={sheet.id as number} />}
        {sheet?.type === "handoff" && <HandoffSheet id={sheet.id as number | undefined} />}
        {sheet?.type === "rebalance" && <RebalanceSheet />}
        {sheet?.type === "shop" && <ShopSheet />}
        {sheet?.type === "activity" && <ActivitySheet />}
        {sheet?.type === "settings" && <SettingsSheet />}
      </Sheet>

      {/* New Task renders its OWN Sheet: its pinned title and footer are part of
          its chrome, and the footer's label reads state that lives inside it.
          Kept mounted while closed so the dismiss still animates. */}
      <NewTaskSheet open={sheet?.type === "newTask"} variant={variant} onClose={close} />
    </>
  );
}

function TaskSheet({ id }: { id: number }) {
  const s = useHousehold();
  const task = s.tasks.find((t) => t.id === id);
  if (!task) return null;
  const owner = task.owner ? s.members[task.owner] : undefined;

  return (
    <>
      {/* Icon tile + title — the SAME header an event's detail wears, so a task
          and an event read as one family. */}
      <span className="flex items-center gap-3">
        <IconTile name={taskGlyph(task)} tone="lemon" />
        <h2 className="min-w-0 font-tight text-h1">{task.title}</h2>
      </span>

      {/* ONE FACT GRAMMAR for tasks and events alike: Who · Time · a third that
          is genuinely different per kind (Priority here; Heading on a journey
          event). The labels used to diverge ("Assigned/When" vs "Who/Time") and
          two sheets describing the same card read as two apps. */}
      <div className="mt-4 grid grid-cols-3 gap-2">
        <Fact label="Who">
          <button
            onClick={() => s.openSheet({ type: "assign", id })}
            className="flex items-center gap-2 text-bodysm font-medium"
          >
            <Avatar member={owner} size={22} />
            <span className="truncate">{owner?.name ?? "Anyone"}</span>
          </button>
        </Fact>
        <Fact label="Time">
          <span className="text-bodysm font-medium">{clockLabel(task.when || "Any time")}</span>
        </Fact>
        <Fact label="Priority">
          <span className={clsx("flex items-center gap-1 text-bodysm font-medium",
            task.priority === "high" ? "text-danger" : "text-ink")}>
            {PRIORITY_LABEL[task.priority]}
            {task.priority === "high" && <Icon name="high" size={12} />}
          </span>
        </Fact>
      </div>

      {/* THE RECEIPT.
          The title on the card is our cleanup of a sentence — "Leo water plants
          tonight" became "Water plants", and the date, time and owner beside it
          are all things we DECIDED that sentence meant. That's interpretation,
          and interpretation has to be checkable: if we read "tonight" as a date
          when it was part of the name, this is the only place you could tell.
          Quiet, and only when it differs from the title. */}
      {task.said && (
        <div className="mt-5">
          <span className="text-caption font-medium uppercase tracking-wide text-sub">You said</span>
          <p className="mt-1.5 flex items-start gap-2 text-bodysm text-sub">
            <Icon name="mic" size={14} className="mt-0.5 shrink-0" />
            <span className="italic">&ldquo;{task.said}&rdquo;</span>
          </p>
        </div>
      )}

      {/* THE SAME VERBS AS THE NOTIFICATION. "On my way" only when someone is
          WAITING at the far end — it tells them, runs the live trip on their
          phones, and opens Maps for the driver; arrival completes it by itself.
          Every task keeps Done; "Remind me" is the quiet path to the island. */}
      {task.done ? (
        <Button tone="outline" size="lg" className="mt-5 w-full" onClick={() => s.toggleTask(id)}>
          <Icon name="undo" size={16} /> Mark not done
        </Button>
      ) : (
        <>
          <div className="mt-5 flex gap-2">
            {/* While the trip is live this is the TRAVELER's cancel door —
                the audience's island can only dismiss. */}
            {s.island?.phase === "journey" && s.island.taskId === task.id ? (
              <Button tone="outline" size="lg" className="flex-1" onClick={() => s.cancelTrip()}>
                <Icon name="x" size={16} /> Cancel trip
              </Button>
            ) : !!task.waiting?.length && (
              <Button tone="dark" size="lg" className="flex-1" onClick={() => s.onWay(task.id)}>
                <Icon name="car" size={16} /> On my way
              </Button>
            )}
            <Button
              tone={task.waiting?.length ? "outline" : "dark"}
              size="lg"
              className="flex-1"
              onClick={() => s.toggleTask(id)}
            >
              <Icon name="check" size={16} /> Done
            </Button>
          </div>
          <Button tone="outline" size="lg" className="mt-2 w-full" onClick={() => s.remindForTask(task.id)}>
            <Icon name="bell" size={16} /> Remind me
          </Button>
        </>
      )}
    </>
  );
}

/**
 * "Even it out" — the move, before it happens.
 *
 * The Balancer moves someone else's work. It used to do that on tap and report it
 * in a toast, which is gone in three seconds: you couldn't see what would change
 * before it changed, and afterwards you couldn't see what had. That's a lot of
 * authority for a button to take on its own.
 *
 * So it shows its working and asks. `previewRebalance` decides; this displays the
 * exact same decision `rebalance()` will apply — one function, so the sheet
 * cannot promise a move the store then makes differently.
 */
function RebalanceSheet() {
  const s = useHousehold();
  const move = previewRebalance(s);

  if (!move) {
    return (
      <>
        <h2 className="font-tight text-h1">Already even</h2>
        <p className="mt-1.5 text-bodysm text-sub">
          Nothing worth moving — the work is shared out about as fairly as it goes.
        </p>
        <Button tone="dark" size="lg" className="mt-5 w-full" onClick={s.closeSheet}>Close</Button>
      </>
    );
  }

  const { task, from, to } = move;
  return (
    <>
      <h2 className="font-tight text-h1">Even it out</h2>
      <p className="mt-1.5 text-bodysm text-sub">One move, and the house is level again.</p>

      {/* The task, named. "Move a task" is not a thing anyone can agree to. */}
      <div className="mt-4 rounded-card bg-card p-card-pad">
        <b className="block text-body">{task.title}</b>
        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-caption text-sub">
          {task.source && <span className="text-ink">{task.source}</span>}
          <span>{relative(task.due)}</span>
          {task.when !== "Any time" && <>· <span>{clockLabel(task.when)}</span></>}
        </div>

        {/* Both faces, and the direction. Who LOSES it matters as much as who
            gains it — this is the app rearranging someone's day. */}
        <div className="mt-4 flex items-center gap-3">
          <span className="flex min-w-0 items-center gap-2">
            <Avatar member={from} size={28} />
            <span className="truncate text-bodysm font-medium">{from.name}</span>
            <span className="shrink-0 text-caption text-sub">{pendingFor(s, from.id)}</span>
          </span>
          <Icon name="arrow" size={16} className="shrink-0 text-sub" />
          <span className="flex min-w-0 items-center gap-2">
            <Avatar member={to} size={28} />
            <span className="truncate text-bodysm font-medium">{to.name}</span>
            <span className="shrink-0 text-caption text-sub">{pendingFor(s, to.id)}</span>
          </span>
        </div>
      </div>

      <div className="mt-5 flex gap-2">
        <Button tone="outline" size="lg" className="flex-1" onClick={s.closeSheet}>Not now</Button>
        <Button
          tone="dark"
          size="lg"
          className="flex-1"
          onClick={() => { s.rebalance(); s.closeSheet(); }}
        >
          Move it
        </Button>
      </div>
    </>
  );
}


/**
 * The shopping list, on the phone — the domain the 3-tab reduction orphaned.
 *
 * Grouped by category because that is how a shop is walked; auto-added low-stock
 * items keep their "low" tag so it's clear the HOUSE asked for them, not a
 * person. Checked items sink but stay — mid-aisle you un-check things, and a
 * list that deletes on tap punishes a fat thumb.
 */
function ShopSheet() {
  const s = useHousehold();
  const [text, setText] = useState("");
  const list = shoppingList(s);
  const open = list.filter((i) => !i.done);
  const done = list.filter((i) => i.done);

  /**
   * THE AISLE IS THE APP'S JOB, not a question. A person scribbling "sponges"
   * on the fridge list doesn't file it — the app reads the words (inferCat)
   * and the TOAST says where it went ("Added to Supplies"): transparency
   * instead of a picker. (v1 hardcoded Groceries; v2 asked with chips — a
   * decision nobody wanted handed to them.)
   */
  const add = () => {
    const t = text.trim();
    if (!t) return;
    s.addShopItem(t, inferCat(t));
    setText("");
  };

  /**
   * WHO'S HOLDING THE PHONE gates the CHECKING, never the ADDING. Asking for a
   * thing and buying it are different acts: everyone may put wants on the list;
   * ticking one off claims "bought", and that claim isn't Ada's to make (guided
   * — she's not doing the shop), and isn't Leo's for the wine (the till would
   * refuse him; minAge, the same field tasks use). On the shared iPad nobody
   * specific is claiming anything, so nothing is gated.
   */
  const me = s.persona !== "ipad" ? s.members[s.persona] : undefined;
  const cantShop = me?.role === "guided";
  const tooYoung = (i: ShopItem) => !!i.minAge && me?.age != null && me.age < i.minAge;
  const gated = (i: ShopItem) => cantShop || tooYoung(i);

  /**
   * Grouped by aisle, and each group ORDERS ITSELF like a person shops:
   * running-low first, then the rest, then what's already crossed off — kept in
   * its group so un-checking a fat-thumbed tap is one glance away. A group
   * that's ENTIRELY crossed has nothing left to ask, so it sinks whole.
   */
  const CATS: { cat: ShopCategory; glyph: IconName }[] = [
    // veg, not cart: the aisle is FOOD — the cart is the act of shopping, and
    // it's already on the sheet's own header doing that job.
    { cat: "Groceries", glyph: "veg" }, { cat: "Supplies", glyph: "box" }, { cat: "Pet", glyph: "pet" },
  ];
  const groups = CATS
    .map(({ cat, glyph }) => {
      const items = list.filter((i) => i.category === cat);
      return {
        cat, glyph,
        left: items.filter((i) => !i.done).length,
        allDone: items.length > 0 && items.every((i) => i.done),
        items: [
          ...items.filter((i) => !i.done && i.low),
          ...items.filter((i) => !i.done && !i.low),
          ...items.filter((i) => i.done),
        ],
      };
    })
    .filter((g) => g.items.length)
    .sort((a, b) => Number(a.allDone) - Number(b.allDone));

  /**
   * `layout`, and it's a BUG FIX, not garnish: checking an item re-sorts it to
   * the group's foot INSTANTLY — rows teleported under the finger, the next
   * row slid into the tap you'd already aimed, and the list read as "clicks
   * not working". Animated, the same reorder is legible motion: you see your
   * item glide down, and nothing swaps places inside a tap. */
  const Row = (i: (typeof list)[number]) => (
    <motion.div
      layout
      key={i.id}
      transition={smooth}
      className="flex min-h-touch items-center gap-3 border-t border-ink/[.05] py-2 first:border-t-0"
    >
      {gated(i) ? (
        /* A dashed ring with a small lock: "someone else ticks this one". Not
           red, not an error — nothing failed, it's just not this person's claim
           to make. */
        <span aria-label="Checked off by someone older" className="grid h-6 w-6 shrink-0 place-items-center rounded-pill border-2 border-dashed border-ink/20 text-sub">
          <Icon name="lock" size={11} />
        </span>
      ) : (
        <Check done={i.done} size={26} onClick={() => s.toggleShopItem(i.id)} />
      )}
      <span className="min-w-0 flex-1">
        {/* Body size, not bodysm — this list is read mid-aisle at arm's length. */}
        <span className={clsx("block truncate text-body font-medium", i.done && "text-sub line-through")}>
          {i.title}
        </span>
        {i.note && !i.done && <span className="block text-caption text-sub">{i.note}</span>}
      </span>
      {/* The house asked, not a person — inventory ran low and the automation put
          it here. Worth a word: an item nobody remembers adding looks like a glitch. */}
      {i.low && !i.done && <Pill tone="tag">Running low</Pill>}
      {i.minAge && !i.done ? <Pill tone="tag">{i.minAge}+</Pill> : null}
      {/* WHOSE want this is — a want has a wanter, and on the one truly shared
          surface "who asked for this?" deserves an answer at a glance. The
          house's asks wear the pill above instead; both kinds are attributed. */}
      {i.by && !i.low && !i.done && <Avatar member={s.members[i.by]} size={20} />}
    </motion.div>
  );

  return (
    <>
      {/* Same header family as every other sheet: lemon tile, ink glyph, title. */}
      <span className="flex items-center gap-3">
        <IconTile name="cart" tone="lemon" />
        <h2 className="min-w-0 font-tight text-h1">Shopping</h2>
      </span>
      <p className="mt-1.5 text-bodysm text-sub">
        {open.length ? `${open.length} to get · shared with everyone` : "All bought — nice work"}
      </p>
      {/* Said once, kindly, up front — not repeated as a nag on every row. */}
      {cantShop && (
        <p className="mt-2 flex items-center gap-1.5 text-caption text-sub">
          <Icon name="spark" size={14} className="shrink-0" />
          Add anything the house needs — ticking off happens at the shop.
        </p>
      )}

      {/* Each aisle is a WHITE card on the grey sheet. Its glyph sits in the
          SMALL neutral well (32px, ink-wash) — a step BELOW the sheet header's
          40px lemon tile, because a group heading outranking the page heading
          is hierarchy upside-down. And no lemon-on-ink here: the ink-stadium
          treatment was starting to answer every question, and an aisle label
          is furniture, not a hero. */}
      <div className="mt-4 space-y-3">
        {groups.map((g) => (
          <div key={g.cat} className={clsx("rounded-card bg-card p-4", g.allDone && "opacity-60")}>
            <div className="flex items-center gap-2.5">
              <IconTile name={g.glyph} tone="onTint" size="sm" />
              <div className="min-w-0">
                <Eyebrow>{g.cat}</Eyebrow>
                <div className="mt-hair text-caption font-medium text-sub">
                  {g.allDone ? "All bought" : `${g.left} to get`}
                </div>
              </div>
            </div>
            <div className="mt-2">{g.items.map(Row)}</div>
          </div>
        ))}
      </div>

      {/* A list with nothing on it says so warmly, not with blank space. */}
      {groups.length === 0 && (
        <div className="mt-4 flex flex-col items-center gap-2 rounded-card bg-card px-6 py-10 text-center">
          <span className="grid h-12 w-12 place-items-center rounded-pill bg-lemon text-ink">
            <Icon name="cart" size={22} />
          </span>
          <p className="mt-1 text-bodysm font-medium">Nothing on the list</p>
          <p className="text-caption text-sub">Add the first thing below — everyone sees it.</p>
        </div>
      )}

      {/* THE AFTER-SHOP SWEEP. Crossed items stay visible mid-aisle (un-checking
          a fat thumb needs them) — but they shouldn't haunt the list for weeks:
          one quiet control clears the cart when the trip's done. */}
      {done.length > 0 && (
        <button
          onClick={() => s.clearBought()}
          className="mt-3 flex items-center gap-1.5 text-caption font-medium text-sub transition-colors hover:text-ink"
        >
          <Icon name="trash" size={14} /> Clear {done.length} bought
        </button>
      )}

      {/* The add row lives at the BOTTOM — under the list it feeds, where the
          next blank line of a paper list would be. Adding keeps the sheet open:
          people add three things, not one. */}
      <label className="mt-5 flex items-center gap-2 rounded-pill border border-ink/[.08] bg-card py-1 pl-4 pr-1.5 transition-colors focus-within:border-ink">
        <Icon name="plus" size={18} className="shrink-0 text-sub" />
        <span className="sr-only">Add an item</span>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="Add an item…"
          className="min-w-0 flex-1 bg-transparent py-2.5 text-bodysm font-medium outline-none placeholder:text-sub"
        />
        {text.trim() && (
          <button onClick={add} className="shrink-0 rounded-pill bg-lemon px-4 py-2 text-caption font-semibold text-ink">Add</button>
        )}
      </label>

    </>
  );
}

/** One labelled fact in the detail row. Equal column, hugging its own label. */
function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="text-caption font-medium uppercase tracking-wide text-sub">{label}</div>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

/**
 * SETTINGS — the account surface the You tab (now a living dashboard) can't be.
 *
 * The dashboard answers "how's my week"; this answers "who am I to the app".
 * Reached from the gear in the You header. Edits only what's REAL and yours:
 * your name and email (setProfile). Everything else the app can't honestly
 * toggle is shown as fact, not a dead switch — role is read-only (the role
 * model: assigned, never self-granted), reminders are described not faked
 * (there's no push yet), the household is displayed. Honesty over a toggle farm.
 */

/** Read a chosen image, centre-crop it to a square and downscale to 240px, and
 *  return a JPEG data URL — small enough to live in the persisted store and
 *  sharp at every size an Avatar is drawn (22–64px). */
function fileToAvatarDataUrl(file: File, size = 240): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Not an image"));
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("No canvas"));
        const crop = Math.min(img.width, img.height);
        ctx.drawImage(img, (img.width - crop) / 2, (img.height - crop) / 2, crop, crop, 0, 0, size, size);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

function SettingsSheet() {
  const s = useHousehold();
  const meId = s.persona !== "ipad" ? s.persona : doers(s)[0]?.id;
  const me = meId ? s.members[meId] : undefined;
  if (!me) return null;
  const owner = Object.values(s.members).find((m) => m.role === "owner");
  const people = doers(s);

  return (
    <>
      <span className="flex items-center gap-3">
        <IconTile name="gear" tone="lemon" />
        <h2 className="min-w-0 font-tight text-h1">Settings</h2>
      </span>

      {/* WHO YOU ARE — the portrait, then the two fields that are actually yours
          to edit. Inputs commit on blur (a name change ripples to the header). */}
      <div className="mt-5 flex items-center gap-4">
        {/* The portrait is the ONE place a photo is set. Tapping it opens the
            picker; the camera badge says so. */}
        <label className="relative shrink-0 cursor-pointer" title="Change your photo">
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              try {
                s.setProfile({ photo: await fileToAvatarDataUrl(file) });
              } catch {
                s.notify("Couldn’t use that image");
              }
            }}
          />
          <Avatar member={me} size={64} />
          <span className="absolute -bottom-0.5 -right-0.5 grid h-[22px] w-[22px] place-items-center rounded-pill bg-ink text-white ring-2 ring-surface">
            <Icon name="camera" size={12} />
          </span>
        </label>
        <div className="min-w-0">
          <div className="truncate text-h2">{me.name}</div>
          <div className="text-caption text-sub">{ROLE_LABEL[me.role]}</div>
          {me.photo && (
            <button
              onClick={() => s.setProfile({ photo: undefined })}
              className="mt-0.5 text-caption text-sub transition-colors hover:text-ink"
            >
              Remove photo
            </button>
          )}
        </div>
      </div>

      <Eyebrow className="mt-6">Your details</Eyebrow>
      <div className="mt-2 divide-y divide-ink/[.06] overflow-hidden rounded-card bg-card shadow-e1">
        <SettingField label="Name" value={me.name} placeholder="Your name" onCommit={(v) => v && s.setProfile({ name: v })} />
        <SettingField label="Email" value={me.email ?? ""} type="email" placeholder="Add your email" onCommit={(v) => s.setProfile({ email: v })} />
      </div>

      {/* ACCESS — the label, then WHAT it actually lets you do. The list is
          cumulative (owner ⊃ full ⊃ …), so more access reads as a longer list,
          not just a different word. Read-only: a role is assigned elsewhere. */}
      <Eyebrow className="mt-6">Your access</Eyebrow>
      <div className="mt-2 rounded-card bg-card p-4 shadow-e1">
        <div className="flex items-center gap-2.5">
          <Icon name="key" size={16} className="shrink-0 text-sub" />
          <span className="text-bodysm font-medium">{ROLE_LABEL[me.role]}</span>
        </div>
        <ul className="mt-3 space-y-2.5">
          {ROLE_CAN[me.role].map((can) => (
            <li key={can} className="flex items-start gap-2.5 text-bodysm">
              <Icon name="check" size={16} className="mt-0.5 shrink-0 text-ink/35" />
              <span>{can}</span>
            </li>
          ))}
        </ul>
        {me.role !== "owner" && owner && (
          <p className="mt-3 border-t border-ink/[.05] pt-2.5 text-caption text-sub">{ROLE_HINT[me.role]} · only {owner.name} can change this.</p>
        )}
      </div>

      {/* REMINDERS — described, not faked. There's no push layer, so a toggle
          here would be a lie; the quiet-hours control that DOES work lives on
          your profile, and this points to it. */}
      <Eyebrow className="mt-6">Reminders</Eyebrow>
      <div className="mt-2 rounded-card bg-card p-4 shadow-e1">
        <div className="flex items-center gap-2.5 text-bodysm">
          <Icon name="bell" size={16} className="shrink-0 text-sub" />
          Reminders arrive in the Dynamic Island.
        </div>
        <div className="mt-2.5 flex items-center gap-2.5 border-t border-ink/[.05] pt-2.5 text-bodysm">
          <Icon name="moon" size={16} className="shrink-0 text-sub" />
          <span className="flex-1">Quiet hours</span>
          <span className="text-caption text-sub">{me.availability?.quiet ? "On" : "Off"} · set on your profile</span>
        </div>
      </div>

      {/* THE HOUSEHOLD — displayed, not managed here (it's a shared thing). */}
      <Eyebrow className="mt-6">Household</Eyebrow>
      <div className="mt-2 flex items-center gap-3 rounded-card bg-card p-4 shadow-e1">
        <AvatarStack members={people} size={30} ringClass="ring-card" />
        <div className="min-w-0">
          <div className="truncate text-bodysm font-medium">{s.householdName}</div>
          <div className="text-caption text-sub">{people.length} people</div>
        </div>
      </div>

      <button
        onClick={() => s.notify("Signed out — this is a demo")}
        className="mt-6 w-full rounded-card bg-card p-4 text-center text-bodysm font-semibold text-danger shadow-e1 transition-colors hover:bg-danger/[.04]"
      >
        Sign out
      </button>
      <p className="mt-4 text-center text-caption text-sub">Homeboard · demo build</p>
    </>
  );
}

/** One editable settings row: label left, right-aligned input that commits on
 *  blur (typing every keystroke into the store would ripple the name across the
 *  app mid-edit). Local state re-syncs if the store value changes underneath. */
function SettingField({
  label, value, placeholder, type = "text", onCommit,
}: { label: string; value: string; placeholder?: string; type?: string; onCommit: (v: string) => void }) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  return (
    <label className="flex items-center gap-3 px-4 py-3.5">
      <span className="w-16 shrink-0 text-bodysm font-medium">{label}</span>
      <input
        type={type}
        value={v}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => { const t = v.trim(); if (t !== value) onCommit(t); }}
        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        placeholder={placeholder}
        className="min-w-0 flex-1 bg-transparent text-right text-bodysm outline-none placeholder:text-sub/70"
      />
    </label>
  );
}

/**
 * An event's detail — the same three-fact row as a task, because it wears the
 * same card.
 *
 * ITS ACTIONS MIRROR THE NOTIFICATION. Opening this from the island used to
 * strand you on a lone "Remind me" while the island itself offered Done / On my
 * way — two doors to the same event, two different sets of verbs. Now they
 * match: a journey shows "On my way" (start the live trip) and "Done"; a
 * thing-at-home shows "Done". "Remind me" stays as the quiet way to be nudged
 * later — the sheet's version of snooze, and the only action that makes sense
 * before there's ever a reminder to snooze.
 */
function EventSheet({ id }: { id: string }) {
  const s = useHousehold();
  const e = s.events.find((x) => x.id === id);
  if (!e) return null;
  const who = s.members[e.who];

  return (
    <>
      <span className="flex items-center gap-3">
        {/* The thing's glyph — same one the island shows, so the sheet you land
            on from the notification reads as the same object. Same tile as every
            other: 40px well, 20px glyph, ink on lime. */}
        <IconTile name={e.icon ?? "cal"} tone="lemon" />
        <h2 className="min-w-0 font-tight text-h1">{e.title}</h2>
      </span>

      {/* Same grammar as a task's sheet: Who · Time · the kind-specific third
          (Heading on a journey, the day otherwise). */}
      <div className="mt-4 grid grid-cols-3 gap-2">
        <Fact label="Who">
          <span className="flex items-center gap-2 text-bodysm font-medium">
            <Avatar member={who} size={22} />
            <span className="truncate">{who?.name ?? "—"}</span>
          </span>
        </Fact>
        <Fact label="Time">
          <span className="text-bodysm font-medium">{clockLabel(e.time)}</span>
        </Fact>
        <Fact label={e.journey ? "Heading" : "Day"}>
          <span className="truncate text-bodysm font-medium">{e.journey && e.where ? e.where : relative(e.due)}</span>
        </Fact>
      </div>

      {e.recurring && (
        <p className="mt-4 flex items-center gap-1.5 text-caption text-sub">
          <Icon name="repeat" size={14} /> Repeats {e.recurring.toLowerCase()}
        </p>
      )}

      {e.done ? (
        <p className="mt-5 flex items-center justify-center gap-1.5 rounded-2xl bg-ink/[.05] py-3 text-bodysm font-medium text-sub">
          <Icon name="check" size={16} /> Handled
        </p>
      ) : (
        <>
          {/* The completion actions — the SAME set the island offers. "On my
              way" only with someone in `waiting` at the far end: Padel is a
              journey, but Marco isn't in the household — announcing to nobody
              is theatre. */}
          <div className="mt-5 flex gap-2">
            {!!e.waiting?.length && (
              <Button tone="dark" size="lg" className="flex-1" onClick={() => s.onWay(e.id)}>
                <Icon name="car" size={16} /> On my way
              </Button>
            )}
            <Button
              tone={e.waiting?.length ? "outline" : "dark"}
              size="lg"
              className="flex-1"
              onClick={() => s.completeEvent(e.id)}
            >
              <Icon name="check" size={16} /> Done
            </Button>
          </div>
          {/* The quiet path: be nudged later. */}
          <Button tone="outline" size="lg" className="mt-2 w-full" onClick={() => s.remindForEvent(e.id)}>
            <Icon name="bell" size={16} /> Remind me
          </Button>
        </>
      )}
    </>
  );
}

/** Upkeep's detail. Its action is to SCHEDULE it — turning a standing obligation
 *  into a dated job someone holds. */
function MaintSheet({ id }: { id: string }) {
  const s = useHousehold();
  const m = s.maint.find((x) => x.id === id);
  if (!m) return null;
  const over = m.status === "over";

  return (
    <>
      <h2 className="font-tight text-h1">{m.title}</h2>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <Fact label="Asset">
          <span className="truncate text-bodysm font-medium">{m.asset}</span>
        </Fact>
        <Fact label="Due">
          <span className={clsx("text-bodysm font-medium", over && "text-danger")}>{relative(m.due)}</span>
        </Fact>
        <Fact label="Every">
          <span className="truncate text-bodysm font-medium">{m.cadence}</span>
        </Fact>
      </div>

      {over && (
        <p className="mt-4 flex items-center gap-1.5 text-caption text-danger">
          <Icon name="high" size={14} /> This one&rsquo;s overdue.
        </p>
      )}

      <Button tone="dark" size="lg" className="mt-5 w-full" onClick={() => s.scheduleMaint(m.id)}>
        Schedule it
      </Button>
    </>
  );
}
/**
 * HAND OFF — task cards with a SPLIT CTA and a per-card dock.
 *
 * The pill is two tap zones in one control, parted by a hairline pipe:
 *   [⇄ Maya] — the recommended hand-off, DONE on tap. The Balancer's pick is
 *              the 90% case; it costs exactly one touch and no navigation.
 *   [  ▾  ]  — opens the card's own ink dock to choose someone else. Manual
 *              picks CONFIRM ("Hand to Leo") — you're overriding the app's
 *              judgement, so the sheet reads the decision back before it
 *              moves someone's work. The fast path stays fast; the deliberate
 *              path stays deliberate.
 * (A split button, not two separate CTAs: "adjust" is a modifier of the same
 * verb, and giving it its own button would rank it equal to the act itself.)
 *
 * Rows are real task cards — ink glyph stadium, standard trio — and the dock
 * lives INSIDE the open card, so task and takers share one glance at any
 * list length.
 */
function HandoffSheet({ id }: { id?: number }) {
  const s = useHousehold();
  const meId = s.persona !== "ipad" ? s.persona : doers(s)[0]?.id;
  const mine = s.tasks.filter((t) => t.owner === meId && !t.done);

  const [openId, setOpenId] = useState<number | undefined>(id);
  /** The dock's selection — starts on the suggestion when a card opens. */
  const [choice, setChoice] = useState<MemberId | null>(null);

  /** The dock's one-breath version of whyNot — a cell caption, not a sentence.
   *  Same two tails as the long form: an age gate names its number (it lifts by
   *  itself); a role gate stays possessive ("Not Leo's"), never "adults only". */
  const shortWhy = (m: Member, t: Task): string | null => {
    if (!whyNot(m, t)) return null;
    if (t.minAge && m.age != null && m.age < t.minAge) return `Ages ${t.minAge}+`;
    return `Not ${m.name}’s`;
  };

  return (
    <>
      {/* Same header family as every sheet: lemon tile, ink glyph, title. */}
      <span className="flex items-center gap-3">
        <IconTile name="handoff" tone="lemon" />
        <h2 className="min-w-0 font-tight text-h1">Hand off</h2>
      </span>
      <p className="mt-1.5 text-bodysm text-sub">Which one should someone else take?</p>

      {mine.length === 0 ? (
        <div className="mt-4 flex flex-col items-center gap-2 rounded-card bg-card px-6 py-10 text-center">
          <span className="grid h-12 w-12 place-items-center rounded-pill bg-lemon text-ink">
            <Icon name="check" size={22} />
          </span>
          <p className="mt-1 text-bodysm font-medium">Nothing left to hand off</p>
          <p className="text-caption text-sub">Everything of yours is where it should be.</p>
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          {mine.map((t) => {
            const open = openId === t.id;
            const pick = suggestTaker(s, t);
            const taker = pick ? s.members[pick.id] : undefined;
            const toggle = () => {
              setOpenId(open ? undefined : t.id);
              setChoice(open ? null : pick?.id ?? null);
            };
            return (
              <motion.div
                layout
                key={t.id}
                transition={smooth}
                className={clsx(
                  "overflow-hidden rounded-card bg-card transition-shadow duration-300",
                  open ? "shadow-e2" : "shadow-e1",
                )}
              >
                {/* A DIV, not a button — the split CTA inside holds real
                    <button>s. Tapping the body anywhere still opens the dock. */}
                <div
                  onClick={toggle}
                  className="flex w-full cursor-pointer items-stretch gap-3 p-3 text-left"
                >
                  {/* THE STADIUM — the task-card anchor (DateBadge's shape).
                      WHITE glyph on ink at rest — the dark post carries the
                      row on its own; lemon-on-ink everywhere was one sauce on
                      every dish. The open state keeps the lemon lift: colour
                      spent once, on the thing in hand. */}
                  <span
                    className={clsx(
                      "grid w-[44px] shrink-0 place-items-center self-stretch rounded-pill transition-colors duration-300",
                      open ? "bg-lemon text-ink" : "bg-ink text-white",
                    )}
                  >
                    <Icon name={taskGlyph(t)} size={20} />
                  </span>

                  <TitleBlock
                    className="min-w-0 flex-1 self-center"
                    oneLine
                    eyebrow={t.source ?? (t.recurring ? "Routine" : "Added by you")}
                    title={t.title}
                    subtext={
                      <>
                        {clockLabel(t.when)}
                        {t.recurring && (
                          <>
                            <Icon name="repeat" size={14} />
                            {t.recurring}
                          </>
                        )}
                        <PriorityPill priority={t.priority} />
                      </>
                    }
                  />

                  {/* THE SPLIT CTA. Left zone commits the recommendation in one
                      tap; right zone (past the pipe) opens the dock to choose. */}
                  <span className="flex shrink-0 items-stretch self-center overflow-hidden rounded-pill bg-ink text-white">
                    <button
                      disabled={!pick}
                      onClick={(e) => { e.stopPropagation(); if (pick) s.handOff(t.id, pick.id); }}
                      className="flex items-center gap-1.5 py-2 pl-3 pr-2.5 transition-colors hover:bg-white/10 disabled:opacity-50"
                    >
                      <Icon name="handoff" size={12} className="shrink-0" />
                      {taker && <span className="max-w-[56px] truncate text-[11px] font-semibold">{taker.name}</span>}
                    </button>
                    <span aria-hidden className="my-1.5 w-px bg-white/20" />
                    <button
                      aria-expanded={open}
                      aria-label="Choose someone else"
                      onClick={(e) => { e.stopPropagation(); toggle(); }}
                      className="flex items-center px-2 transition-colors hover:bg-white/10"
                    >
                      <motion.span animate={{ rotate: open ? 180 : 0 }} transition={smooth} className="flex">
                        <Icon name="chevDown" size={12} className="text-white/70" />
                      </motion.span>
                    </button>
                  </span>
                </div>

                <AnimatePresence initial={false}>
                  {open && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={smooth}
                    >
                      {/* THE CARD'S OWN DOCK — a PICKER in the LIGHT palette:
                          a soft grey well, white face cells, an ink RING for the
                          pick, and a dark confirm. No black slab, no lemon — the
                          "black + lime again" the whole app had been trimming. */}
                      <div className="px-3 pb-3">
                        <div className="rounded-[18px] bg-surface p-3">
                          <Eyebrow>Hand it to</Eyebrow>
                          <div className="mt-2.5 flex gap-1.5">
                            {doers(s)
                              .filter((m) => m.id !== meId)
                              .map((m) => {
                                const why = shortWhy(m, t);
                                const suggested = !why && pick?.id === m.id;
                                const chosen = choice === m.id;
                                return (
                                  <button
                                    key={m.id}
                                    disabled={!!why}
                                    onClick={() => setChoice(m.id)}
                                    aria-pressed={chosen}
                                    className={clsx(
                                      "flex flex-1 flex-col items-center gap-1 rounded-2xl px-1 py-2.5 transition-shadow duration-300",
                                      why
                                        ? "opacity-40"
                                        : chosen
                                          ? "bg-card shadow-e2 ring-2 ring-inset ring-ink"
                                          : "bg-card shadow-e1 hover:shadow-e2",
                                    )}
                                  >
                                    <Avatar member={m} size={36} />
                                    <span className="max-w-full truncate text-caption font-semibold text-ink">{m.name}</span>
                                    <span className={clsx("max-w-full truncate text-[10px] leading-none", suggested ? "font-medium text-ink/70" : "text-sub")}>
                                      {why ?? (suggested ? "✦ lightest load" : `${pendingFor(s, m.id)} ${pendingFor(s, m.id) === 1 ? "task" : "tasks"}`)}
                                    </span>
                                  </button>
                                );
                              })}
                          </div>

                          {/* THE READBACK — a DARK confirm (not lemon): a clear
                              primary that reads the decision back. */}
                          <button
                            disabled={!choice}
                            onClick={() => {
                              if (!choice) return;
                              s.handOff(t.id, choice);
                              setOpenId(undefined);
                              setChoice(null);
                            }}
                            className={clsx(
                              "mt-2.5 flex h-touch w-full items-center justify-center gap-1.5 rounded-pill text-bodysm font-semibold transition-colors duration-300",
                              choice ? "bg-ink text-white hover:bg-ink/90" : "cursor-not-allowed bg-ink/[.06] text-ink/40",
                            )}
                          >
                            <Icon name="handoff" size={14} />
                            {choice ? `Hand to ${s.members[choice].name}` : "Pick someone"}
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      )}
    </>
  );
}

function AssignSheet({ id, handoff }: { id: number; handoff?: boolean }) {
  const s = useHousehold();
  const task = s.tasks.find((t) => t.id === id);

  return (
    <>
      <h2 className="font-tight text-h1">{handoff ? "Hand off" : "Assign task"}</h2>
      <p className="mt-1 font-medium text-sub">{task?.title}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {doers(s)
          .filter((m) => !handoff || m.id !== task?.owner)
          .map((m) => {
            const blocked = task ? whyNot(m, task) : null;
            return (
              <button
                key={m.id}
                disabled={!!blocked}
                title={blocked ?? undefined}
                onClick={() => !blocked && s.setOwner(id, m.id)}
                className={clsx(
                  "flex items-center gap-2 rounded-pill border border-black/[.08] px-3 py-2 font-medium",
                  blocked
                    ? "cursor-not-allowed bg-card opacity-45"
                    : task?.owner === m.id
                      ? "bg-ink text-white"
                      : "bg-card",
                )}
              >
                <Avatar member={m} size={24} /> {m.name}
                {blocked ? (
                  /* `text-sub`, NOT `text-danger`. Nothing has gone wrong here —
                     a ten-year-old not being offered the insurance renewal is the
                     app working. Red is for "High ↗" (DESIGN §2) and it turned a
                     kind sentence into an alarm: warm words in error paint still
                     read as an error. The row is already dimmed; that's the whole
                     signal it needs. */
                  <span className="text-xs font-medium text-sub">{blocked}</span>
                ) : (
                  <span className="text-xs font-medium opacity-60">({pendingFor(s, m.id)})</span>
                )}
              </button>
            );
          })}
      </div>
      {/* Say what the TASK needs, not what people are. "This one stays with the
          grown-ups" was the old model talking: it made a statement about the
          people in the room when the only real constraint is on the work. */}
      {task?.requires && (
        <p className="mt-3 text-sm font-medium text-sub">
          This one involves {ROLE_NEEDS[task.requires]}.
        </p>
      )}
    </>
  );
}

/** The date chips. Relative, because that's how people say dates out loud —
 *  and every one resolves to a REAL date, so the card can never contradict itself. */
const DATE_CHIPS: { label: string; due: () => string }[] = [
  { label: "Today", due: () => todayIso() },
  { label: "Tomorrow", due: () => iso(addDays(new Date(), 1)) },
  { label: "Weekend", due: () => iso(addDays(startOfWeek(new Date()), 5)) },
  { label: "Next week", due: () => iso(addDays(startOfWeek(new Date()), 7)) },
];

const TIMES = ["Any time", "Morning", "Afternoon", "Evening"];

/**
 * The chip that reveals OUR picker.
 *
 * It used to be a hidden `<input type="date">` + `showPicker()`. That worked, but
 * the thing it popped is browser chrome — Chrome's blue calendar, Safari's grey
 * wheel — and CSS cannot reach inside it. Two generic OS widgets in the middle of
 * a designed sheet. So the calendar is ours.
 *
 * It EXPANDS INLINE rather than floating. A popover was the obvious move and it
 * was wrong twice: the sheet's middle is `overflow-y-auto`, so an absolutely
 * positioned panel got sliced off at the scroll edge — and a floating layer
 * inside a bottom sheet is two competing surfaces anyway. Expanding in flow is
 * the same accordion language "Adjust" already speaks, and it can't be clipped.
 */

/**
 * Say it, check it, done.
 *
 * The last version had five field-groups on screen and called itself easy. It
 * wasn't — it was a form with a parser bolted on. This one leads with the
 * fastest input a phone has (your voice), runs it through the SAME engine the
 * typed field uses, and shows ONE line of readback. The chips still exist, but
 * they're folded away behind "Adjust" — there to correct a wrong guess, not to
 * be filled in.
 *
 * The default path is: tap mic → talk → read one line → Add. No fields at all.
 */
function NewTaskSheet({
  open, variant, onClose,
}: { open: boolean; variant: "phone" | "ipad"; onClose: () => void }) {
  const s = useHousehold();
  const [raw, setRaw] = useState("");
  const [adjusting, setAdjusting] = useState(false);
  const [ownerPick, setOwnerPick] = useState<MemberId | null | undefined>(undefined);
  const [pickedDue, setPickedDue] = useState<string | null>(null);
  const [pickedWhen, setPickedWhen] = useState<string | null>(null);
  const [pickedPri, setPickedPri] = useState<Priority | null>(null);
  const [dateOpen, setDateOpen] = useState(false);
  const [timeOpen, setTimeOpen] = useState(false);

  // The sheet stays mounted so it can animate out — so it must forget the last
  // task when it opens again, or you'd reopen onto someone else's sentence.
  useEffect(() => {
    if (!open) return;
    setRaw("");
    setAdjusting(false);
    setOwnerPick(undefined);
    setPickedDue(null);
    setPickedWhen(null);
    setPickedPri(null);
    setDateOpen(false);
    setTimeOpen(false);
  }, [open]);

  const people = doers(s);
  const dictation = useDictation((text) => setRaw(text));

  // ONE engine, two doors: speech and typing both land here.
  const parsed = parseTask(raw, people);
  // The POLISHED name — "Leo water plants tonight" -> "Water plants". A list of
  // raw utterances is a mess to scan, so the card gets a clean title. But the
  // cleaning is an interpretation, so we keep the receipt: `said` is the verbatim
  // input, stored only when it differs, and shown in the task's detail.
  const title = parsed.title;
  const said = raw.trim().toLowerCase() !== title.toLowerCase() ? raw.trim() : undefined;
  const due = pickedDue ?? parsed.due ?? todayIso();
  const when = pickedWhen ?? parsed.when ?? "Any time";
  const priority = pickedPri ?? parsed.priority ?? "med";
  const ready = title.length > 0;

  // The suggestion waits for you to STOP TYPING.
  //
  // It used to recompute on every keystroke, so "Suggested Ada" appeared at the
  // first letter and then swapped to Leo three words later — the app guessing out
  // loud while you were still talking. A name you TYPE is deterministic and lands
  // instantly; only the guess is debounced.
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    setSettled(false);
    const t = setTimeout(() => setSettled(true), 450);
    return () => clearTimeout(t);
  }, [raw]);

  // A fragment is not a task. "Pick" is one word and could be picking up milk or
  // picking up a prescription — guessing an owner from it is the app talking over
  // someone mid-sentence. Two words is the cheapest honest threshold.
  const substantive = title.split(/\s+/).filter(Boolean).length >= 2;

  /**
   * REMEMBER BEFORE GUESSING.
   *
   * The household has done things before, and knows whose patch is whose. That
   * beats both the keyword list (frozen) and the load-balancer (blind) — and it
   * carries the VETTING with it: a precedent's requires/minAge come along, so
   * work assessed once is never re-assessed by a regex.
   */
  const known = ready && settled && substantive ? recall(s, title) : null;
  const requires = parsed.requires ?? known?.requires;
  const minAge = known?.minAge;
  const source = known?.source;

  // Four readings, strongest first: what you tapped > who you named > what this
  // house already does > who's free. Each is more certain than the next.
  const owner = ownerPick !== undefined ? ownerPick : parsed.owner ?? known?.owner ?? null;
  // WHICH of them actually decided it. Without this the sheet explained an owner
  // it didn't choose: type "Sam water plants" and it assigned Sam, then said
  // "Leo usually does this" — the precedent's reason attached to someone else's
  // name. A reason may only be shown by whoever supplied the answer.
  const ownerFrom = ownerPick !== undefined ? "picked" : parsed.owner ? "named" : known?.owner ? "known" : null;

  const gate = { due, priority, requires, minAge } as Task;
  /**
   * The recommendation is about the TASK, not about who currently holds it — so
   * it stands whether or not you've overridden it.
   *
   * It used to be gated on `!owner`, which meant tapping anyone erased it: the
   * app quietly withdrew its opinion the moment you disagreed. That's the one
   * moment the opinion is worth reading — you're choosing between people, and
   * "we'd have said Maya, because lightest load" is exactly the context that
   * makes the choice informed rather than blind.
   *
   * `gate` deliberately carries no owner, so suggestTaker ranks everyone and
   * doesn't exclude whoever is currently picked.
   */
  const nominee = ready && settled && substantive ? suggestTaker(s, gate) : null;

  /**
   * WHO ACTUALLY GETS IT — including the Balancer's pick.
   *
   * The nominee used to be advice the sheet showed and the store ignored: it
   * displayed "Maya (suggested)", then saved `owner: null` with the name tucked
   * into `suggest`. Two things went wrong at once. The readback lied — it
   * promised a person nobody was recorded as holding. And every phone list
   * filters `owner === me`, so a task with no owner belonged to no one's lens:
   * you'd add it and watch it vanish.
   *
   * The readback IS the confirmation. It names who'll get it and why, before you
   * commit, and Adjust is right there to change it. Tapping Add is agreement, so
   * the pick becomes the owner. `suggest` still exists — it's for tasks that lose
   * an owner later (a role change strands work; rebalance moves it).
   */
  const assignee = owner ?? nominee?.id ?? null;
  /**
   * Only whoever supplied the answer may explain it — the readback line sits
   * under the assignee's name, so a reason about someone else would read as
   * being about them. When you override, the recommendation moves to the badge
   * and the reason travels with it into Adjust, where the pills are.
   */
  const why =
    ownerFrom === "known" ? known?.because
    : assignee && assignee === nominee?.id ? nominee.reason
    : null;
  const dateLabel = DATE_CHIPS.find((c) => c.due() === due)?.label ?? relative(due);
  // `requires` rides along: the gate the suggestion respected must also land on
  // the task, or a nomination refused here could be hand-assigned there.
  const commit = () =>
    ready && s.addTask({ title, owner: assignee, when, due, priority, requires, minAge, source, said });

  return (
    <Sheet
      open={open}
      onClose={onClose}
      variant={variant}
      title="New task"
      footer={
        <Button tone="lemon" size="lg" className={clsx("w-full", !ready && "opacity-40")} onClick={commit}>
          {ready ? `Add “${title}”` : "Add task"}
        </Button>
      }
    >
      {/* ONE input, two doors. The mic and the field used to be two unrelated
          boxes with a limp "…or type it" between them — the speaking half looked
          designed and the typing half looked like a fallback nobody wanted. They
          are the same input: same engine, same result, so they share a surface,
          split by a hairline instead of an apology.

          Restored from the session transcript after I replaced it with a single
          pill that put the mic INSIDE the field. That looked tidier and said less:
          a 44px circle in a 58px pill leaves the speaking path no room to explain
          itself, so "tap and talk — we'll fill it in" had nowhere to live and the
          fast path went back to being a mystery icon. Two rooms, one house. */}
      <div className={clsx(
        "overflow-hidden rounded-card border transition-colors",
        dictation.listening ? "border-ink" : "border-ink/[.08]",
      )}>
        {dictation.supported && (
          <button
            onClick={() => (dictation.listening ? dictation.stop() : dictation.start())}
            className={clsx(
              "flex w-full items-center gap-3 p-card-pad text-left transition-colors",
              dictation.listening ? "bg-ink text-white" : "bg-card hover:bg-surface",
            )}
          >
            <motion.span
              // Pulses ONLY while live — a mic that looks alive when it isn't is a
              // lie about whether you're being recorded.
              animate={dictation.listening ? { scale: [1, 1.12, 1] } : { scale: 1 }}
              transition={dictation.listening ? { duration: 1.4, repeat: Infinity } : smooth}
              className={clsx(
                "grid h-11 w-11 shrink-0 place-items-center rounded-pill",
                dictation.listening ? "bg-danger text-white" : "bg-lemon text-ink",
              )}
            >
              <Icon name="mic" size={20} />
            </motion.span>
            <span className="min-w-0 flex-1">
              <b className="block text-bodysm">{dictation.listening ? "Listening…" : "Say the task"}</b>
              <span className={clsx("block truncate text-caption", dictation.listening ? "text-white/70" : "text-sub")}>
                {dictation.listening
                  ? dictation.heard || "“Leo water the plants tonight”"
                  : "Tap and talk — we'll fill it in"}
              </span>
            </span>
          </button>
        )}

        {/* No glyph in front of the field. The "…" belongs to the SENTENCE —
            "…or write it" — where it does the joining work: the mic block above
            offers one way, this line trails on with the other. I'd put the
            ellipsis in a 44px slot to keep the two halves aligned, which turned
            a piece of punctuation into a pretend icon and made the box look like
            it had two labels. The placeholder starts at the card's own padding;
            nothing needs to line up with a mic that isn't a column. */}
        <label className={clsx(
          "flex items-center bg-card px-card-pad",
          dictation.supported && "border-t border-ink/[.06]",
        )}>
          <span className="sr-only">What needs doing?</span>
          <input
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && commit()}
            placeholder={dictation.supported ? "…or write it" : "Leo water the plants tonight"}
            className="min-w-0 flex-1 bg-transparent py-4 text-bodysm font-medium outline-none placeholder:text-sub"
          />
        </label>
      </div>

      {dictation.error && <p className="mt-2 text-caption text-danger">{dictation.error}</p>}

      {/* ONE line of readback. This is the whole form in the common case. */}
      {ready && (
        <div className="mt-4 rounded-card bg-card p-card-pad">
          <b className="block text-body">{title}</b>
          <div className="mt-1 flex flex-wrap items-center gap-1 text-caption text-sub">
            <Icon name="spark" size={12} className="text-ink" />
            <span className="text-ink">{dateLabel}</span>
            {when !== "Any time" && <>· <span className="text-ink">{when}</span></>}
            {/* The name, flat. It used to read "Maya (suggested)" — hedging on a
                decision the app had already made, and then not making it. If
                nobody is eligible at all we say THAT, rather than "Anyone",
                which sounded like a choice and meant nobody. */}
            · <span className="text-ink">{assignee ? s.members[assignee].name : "Needs an owner"}</span>
            {priority !== "med" && <>· <span className="text-ink">{PRIORITY_LABEL[priority]}</span></>}
          </div>
          {/* WHY. The app filled a person in from its own memory, so it has to
              show its working — "Leo usually does this" is checkable; a name
              appearing on its own is just the app being confident at you. */}
          {why && <p className="mt-1 text-caption text-sub">{why}.</p>}
          <button
            onClick={() => setAdjusting(!adjusting)}
            aria-expanded={adjusting}
            className="mt-2 flex items-center gap-1 text-caption font-medium text-sub transition-colors hover:text-ink"
          >
            {adjusting ? "Done adjusting" : "Adjust"}
            <motion.span animate={{ rotate: adjusting ? 180 : 0 }} transition={smooth} className="flex">
              <Icon name="chevDown" size={12} />
            </motion.span>
          </button>
        </div>
      )}

      {/* The old form, folded away. Here to CORRECT a guess, not to be filled in. */}
      <AnimatePresence initial={false}>
        {adjusting && ready && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={smooth}
            className="overflow-hidden"
          >
            <div className="pt-4">
              <span className="text-caption font-medium uppercase tracking-wide text-sub">When</span>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {DATE_CHIPS.map((c) => {
                  const d = c.due();
                  return (
                    <Choice key={c.label} selected={due === d} onClick={() => setPickedDue(d)}>{c.label}</Choice>
                  );
                })}
                <PickerChip
                  kind="date"
                  open={dateOpen}
                  onToggle={() => { setDateOpen(!dateOpen); setTimeOpen(false); }}
                  active={DATE_CHIPS.every((c) => c.due() !== due)}
                >
                  {DATE_CHIPS.every((c) => c.due() !== due) ? `${badge(due).day} ${badge(due).weekday}` : "Pick"}
                </PickerChip>
              </div>
              <PickerPanel open={dateOpen}>
                <MiniCalendar value={due} onPick={(v) => { setPickedDue(v); setDateOpen(false); }} />
              </PickerPanel>
            </div>

            <div className="mt-4">
              <span className="text-caption font-medium uppercase tracking-wide text-sub">Time of day</span>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {TIMES.map((t) => (
                  <Choice key={t} selected={when === t} onClick={() => setPickedWhen(t)}>{t}</Choice>
                ))}
                {/* A clock time is a different KIND of answer from "Morning" — it
                    gets the picker, and shows itself once set. */}
                <PickerChip
                  kind="time"
                  open={timeOpen}
                  onToggle={() => { setTimeOpen(!timeOpen); setDateOpen(false); }}
                  active={!TIMES.includes(when)}
                >
                  {TIMES.includes(when) ? "Pick" : when}
                </PickerChip>
              </div>
              {/* NO auto-close: a wheel emits on every notch as you scroll past
                  it, so closing on pick would slam shut under your finger. The
                  calendar closes because a day is one discrete choice; a time is
                  three, and you're done when you say you are. */}
              <PickerPanel open={timeOpen}>
                <MiniClock value={TIMES.includes(when) ? "" : when} onPick={setPickedWhen} />
              </PickerPanel>
            </div>

            <div className="mt-4">
              <span className="text-caption font-medium uppercase tracking-wide text-sub">Assign to</span>
              {/* Shows who is ACTUALLY getting it — including the Balancer's pick,
                  which is now a real answer rather than a hint. No "Anyone" pill
                  and no toggle-to-clear: there is always an owner, so clearing
                  would just re-run the Balancer and land on the same person. */}
              <div className="mt-2 flex flex-wrap gap-2">
                {people.map((m) => (
                  <Choice
                    key={m.id}
                    selected={assignee === m.id}
                    onClick={() => setOwnerPick(m.id)}
                  >
                    <Avatar member={m} size={22} /> {m.name}
                    {/* The recommendation, ON the person it's about. Saying
                        "we'd suggest Ada" in prose below made you read a name and
                        then go hunting for the matching pill. */}
                    {/* Always lemon, selected or not. It used to dim to white/20
                        on the ink pill — which was fine while the Balancer's pick
                        was never the assignee, and wrong the moment it became one:
                        the badge vanished into the fill exactly when it was
                        describing the live answer. "Best fit" means the same thing
                        either way, so it looks the same either way — and lemon on
                        ink is the loudest the palette gets. */}
                    {nominee?.id === m.id && (
                      <span className="-mr-1 ml-0.5 rounded-pill bg-lemon px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[.1em] text-ink">
                        Best fit
                      </span>
                    )}
                  </Choice>
                ))}
              </div>
              {/* The reason, kept with the badge. Once you override, it can't sit
                  in the readback any more — that line is under the assignee's
                  name and would read as being about them. Here it's directly
                  under the badged pill, so "we'd have said Maya, and why" stays
                  available exactly while you're weighing the choice. */}
              {nominee && assignee !== nominee.id && (
                <p className="mt-2 text-caption text-sub">
                  {s.members[nominee.id]?.name} is the best fit — {nominee.reason.toLowerCase()}.
                </p>
              )}
            </div>

            <div className="mt-4">
              <span className="text-caption font-medium uppercase tracking-wide text-sub">Priority</span>
              {/* Hug, like every other pill on this sheet. `flex-1` stretched these
                  three to fill the row, so one control group sat to a different
                  rhythm than the four above it for no reason. */}
              <div className="mt-2 flex flex-wrap gap-1.5">
                {(["low", "med", "high"] as Priority[]).map((p) => (
                  <Choice key={p} className="!gap-1" selected={priority === p} onClick={() => setPickedPri(p)}>
                    {PRIORITY_LABEL[p]}
                    {p === "high" && <Icon name="high" size={12} className={priority === p ? "" : "text-danger"} />}
                  </Choice>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Sheet>
  );
}

/**
 * Activity — the household's short-term memory, read out loud.
 *
 * This was a bare list of twelve strings. No faces, no times, no shape — a
 * ticker, not a memory. The rebuild follows the app's own rules:
 *
 *   VERDICT FIRST. The header states what the feed would make you count:
 *   how much happened today, who carried it, and how much the house itself
 *   handled — that last number being the whole thesis (the Kernel is an
 *   attributable actor, and its work should be visible work).
 *
 *   NEW BEFORE OLD. "Since you looked" is the one question a bell answers.
 *   `unread` is captured AT MOUNT (before markRead zeroes it) and splits the
 *   feed; the "You're caught up" line is the exhale between the two.
 *
 *   THEN A DIARY. Today / Yesterday / weekday — the same page-per-day shape
 *   Ahead uses, because the feed is Ahead's mirror: one looks forward, this
 *   looks back.
 *
 * Rows lead with the face (the app's identity language); the house's own acts
 * wear the spark. The name is bolded INSIDE the sentence rather than repeated
 * beside the avatar — "Sam · Sam completed" said everything twice.
 */
function ActivitySheet() {
  const s = useHousehold();
  /** How many entries were new when this sheet OPENED — captured before
   *  markRead resets the counter, which is why the bell no longer calls it. */
  const [newCount] = useState(() => Math.min(useHousehold.getState().unread, useHousehold.getState().activity.length));
  useEffect(() => { s.markRead(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const all = s.activity;
  const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
  const today = all.filter((a) => a.at >= +startOfDay);
  const byHouse = today.filter((a) => !a.who).length;

  /** Who did most today — only claimed when someone clearly did. */
  const tally = new Map<string, number>();
  today.forEach((a) => a.who && tally.set(a.who, (tally.get(a.who) ?? 0) + 1));
  const ranked = [...tally.entries()].sort((a, b) => b[1] - a[1]);
  const top = ranked[0] && (!ranked[1] || ranked[0][1] > ranked[1][1]) && ranked[0][1] >= 2
    ? s.members[ranked[0][0]] : undefined;

  const subtext = today.length
    ? [top && `Most of it ${top.name}`, byHouse > 0 && `${byHouse} by the house itself`]
        .filter(Boolean).join(" · ") || undefined
    : all.length ? `Last thing ${ago(all[0].at)}` : undefined;

  const fresh = all.slice(0, newCount);
  const rest = all.slice(newCount);

  /** The diary: consecutive runs of one day, newest first. */
  const groups: { label: string; items: typeof all }[] = [];
  for (const a of rest) {
    const label = dayLabel(a.at);
    const g = groups[groups.length - 1];
    if (g && g.label === label) g.items.push(a);
    else groups.push({ label, items: [a] });
  }

  return (
    <>
      {/* Same header family as every other sheet: lemon tile, ink glyph, title,
          then the reading of the day as the subtitle. This was the one overlay
          still opening with a bare TitleBlock. */}
      <span className="flex items-center gap-3">
        <IconTile name="feed" tone="lemon" />
        <h2 className="min-w-0 font-tight text-h1">Activity</h2>
      </span>
      <p className="mt-1.5 text-bodysm text-sub">
        {today.length ? `${today.length} ${today.length === 1 ? "thing" : "things"} so far today` : "Quiet so far today"}
        {subtext && ` · ${subtext}`}
      </p>

      {all.length === 0 && (
        <p className="py-12 text-center font-medium text-sub">
          Nothing yet — the first thing anyone does will show up here.
        </p>
      )}

      {fresh.length > 0 && (
        <div className="mt-5">
          <Eyebrow>Since you looked</Eyebrow>
          <div className="mt-1">
            {fresh.map((a, i) => <ActivityRow key={`n${i}`} a={a} />)}
          </div>
          {rest.length > 0 && (
            <div className="mt-3 flex items-center gap-3" aria-hidden>
              <span className="h-px flex-1 bg-ink/[.08]" />
              <span className="text-caption text-sub">You&rsquo;re caught up</span>
              <span className="h-px flex-1 bg-ink/[.08]" />
            </div>
          )}
        </div>
      )}

      {groups.map((g) => (
        <div key={g.label} className="mt-5">
          <Eyebrow>{g.label}</Eyebrow>
          <div className="mt-1">
            {g.items.map((a, i) => <ActivityRow key={i} a={a} />)}
          </div>
        </div>
      ))}
    </>
  );
}

/** One thing that happened: who, what, when-ago. */
function ActivityRow({ a }: { a: { text: string; at: number; who?: MemberId } }) {
  const members = useHousehold((s) => s.members);
  const m = a.who ? members[a.who] : undefined;
  /** The sentence already starts with the name — bold it instead of repeating
   *  it beside the face. When it doesn't (or the member left), show as-is. */
  const rest = m && a.text.startsWith(m.name) ? a.text.slice(m.name.length) : null;

  return (
    <div className="flex min-h-touch items-center gap-3 border-t border-ink/[.06] py-2.5 first:border-t-0">
      {m ? (
        <Avatar member={m} size={28} />
      ) : (
        /* The house's own doing — the Kernel is an actor and wears its mark. */
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-pill bg-lemon text-ink">
          <Icon name="spark" size={14} />
        </span>
      )}
      <span className="min-w-0 flex-1 text-bodysm">
        {rest !== null ? <><b className="font-medium">{m!.name}</b>{rest}</> : a.text}
      </span>
      <span className="shrink-0 text-caption tabular-nums text-sub">{ago(a.at)}</span>
    </div>
  );
}
