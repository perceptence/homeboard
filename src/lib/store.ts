"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type {
  ActivityEntry, Automation, AutoThen, AutoWhen, DraftPerson, HouseEvent, HouseholdAxes, HouseholdPreset,
  InventoryItem, IpadRoute, MaintItem, Member, MemberId, MemberKind, OnboardingDraft, Persona, PhoneRoute,
  Availability, IslandNote, Presence, Priority, Reminder, Role, ShopItem, Task,
} from "./types";
import { ROLE_RANK, ROLE_SET } from "./types";
import type { IconName } from "@/components/Icons";
import { taskGlyph } from "./glyphs";
import {
  seedAutomations, seedEvents, seedInventory, seedMaint, seedMembers, seedShopping, seedTasks,
} from "./seed";
import { addDays, iso, isToday, relative, relativeInline, timeMinutes, todayIso } from "./dates";

export interface Sheet {
  // No separate "newEvent" — New task is the ONE add flow for both; the app
  // decides task vs event from what was typed (see `inferFixed` in parse.ts)
  // so the person is never asked to understand the app's own internal split.
  type: "task" | "event" | "maint" | "assign" | "handoff" | "newTask" | "newShop" | "activity" | "rebalance" | "shop" | "settings" | "manage" | "addPerson" | "addAutomation" | "stock" | "cover" | "reschedule";
  /** Tasks are numbered; events and upkeep carry string ids. Each sheet looks up
   *  its own kind, so one field is honest here. */
  id?: number | string;
  draft?: { title: string; owner: MemberId | null; when: string; priority: Priority };
  /** The person a Cover / Reschedule sheet is resolving a conflict for. */
  who?: MemberId;
  /** EDIT MODE for the one add composer (type "newTask"). Set exactly one: the
   *  sheet opens pre-filled from that task/event, titled "Edit", and its footer
   *  saves via updateTask / updateEvent instead of adding. The U of CRUD reuses
   *  the very same screen as the C, so an edit looks like the add it mirrors. */
  editTaskId?: number;
  editEventId?: string;
  /** Seed text for the automation builder — the sentence someone typed into New
   *  Task that turned out to be a routine. Present only when launched from that
   *  nudge, which is also the signal to CLOSE (not return to Manage) on save. */
  autoText?: string;
}

/** Colours cycle as people are added, so everyone stays visually distinct. */
export const PALETTE = ["#E8654B", "#3E86C8", "#8B5CF6", "#28A98B", "#C08A4A", "#D9557F", "#5AA9A0"];

/**
 * Task suitability, in one place. Every assignment path goes through this.
 *
 * TWO gates, deliberately independent (see types.ts):
 *   requires -> AUTHORITY. Can this person be held accountable for it?
 *   minAge   -> CAPABILITY. Can this person physically/safely do it?
 *
 * Neither is "are they an adult". That question was doing both jobs and getting
 * both wrong.
 */
export type Assignable = Pick<Task, "requires" | "minAge">;

export const canAssign = (m: Member, t: Assignable): boolean => {
  if (m.kind === "pet") return false;
  if (ROLE_RANK[m.role] < ROLE_RANK[t.requires ?? "guided"]) return false;
  // Unknown age never blocks: most people won't type one in, and refusing to let
  // someone take the bins out because they didn't share a birthday is hostile.
  // Onboarding asks for an age where it's likely to matter (see Onboarding).
  return m.age === undefined || m.age >= (t.minAge ?? 0);
};

/**
 * Why a person isn't offered this — said as CARE, not as a verdict on them.
 *
 * "Involves money, contracts or safety" was about the work and still landed
 * wrong, because of where it sits: greyed out, under a child's name. Read in
 * place it says "Leo can't be trusted with money" — the app editorialising about
 * a ten-year-old. The truer reading is the opposite: these gates exist so that
 * someone DOESN'T have to carry the boiler and the insurance renewal.
 *
 * ── ONE VOICE, TWO TAILS ────────────────────────────────────────────────────
 * Both branches open the same way, because they're the same kind of sentence and
 * a reader shouldn't have to change gear between two rows of one list. ("Ages
 * 14+" sat next to "Not Leo's to worry about" and read like a film rating had
 * wandered in — I rewrote one gate and forgot the other.)
 *
 * But the TAILS differ, because the gates genuinely do:
 *
 *   minAge   is TEMPORARY. Leo will be 14. The gate lifts by itself, so the
 *            sentence says "yet" and names the day it lifts.
 *   requires is ASSIGNED. It may never be theirs, and that's not a countdown —
 *            promising "yet" would be the app making an offer the owner never
 *            made.
 *
 * Same opening so they scan as one family; different endings because "not yet"
 * and "not yours" are not the same promise.
 */
export const whyNot = (m: Member, t: Assignable): string | null => {
  if (m.kind === "pet") return null;
  if (t.requires && ROLE_RANK[m.role] < ROLE_RANK[t.requires]) {
    return `Not ${m.name}'s to worry about`;
  }
  if (m.age !== undefined && m.age < (t.minAge ?? 0)) {
    return `Not ${m.name}'s yet — ages ${t.minAge}+`;
  }
  return null;
};

/* ============================================================
   AVAILABILITY — a signal, never a gate.

   Note what is NOT here: `canAssign` knows nothing about any of this. If you
   hand work to someone who's away, the app warns; it does not refuse. Sometimes
   you know better ("she's back Saturday, it's fine"). Same line the role model
   draws — say what the WORK needs; don't make a ruling about the person.
   ============================================================ */

/** Is this member away on a given DATE — not "today". A task due Monday doesn't
 *  care that they're away Thursday to Sunday. */
export const awayOn = (m: Member, date: string): boolean => {
  const a = m.availability;
  if (a?.presence !== "away") return false;
  if (a.from && date < a.from) return false;
  if (a.to && date > a.to) return false;
  return true;
};

/**
 * Does this need doing while someone who's `out` is out?
 *
 * `when` is free text ("Tonight", "3:15 PM", "Any time"), so this reads what it
 * can and CLAIMS NOTHING otherwise — an unknown `when` is not evidence of a
 * daytime job. (This is the same soft spot that makes busy-hours a bigger job
 * than it looks: the field isn't time-comparable.)
 */
const inWorkHours = (when: string): boolean => {
  const w = when.toLowerCase();
  if (/morning|afternoon|midday|noon/.test(w)) return true;
  if (/tonight|evening|night/.test(w)) return false;
  const m = when.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!m) return false;
  const h = (Number(m[1]) % 12) + (/pm/i.test(m[3]) ? 12 : 0);
  return h >= 9 && h < 18;
};

/** The epoch ms at which the member's CURRENT quiet window ends. Only meaningful
 *  while inQuietHours(m) is true. Handles the wrap: at 23:00 inside a 22:00→07:00
 *  window the answer is 07:00 TOMORROW; at 06:00 it's 07:00 today. */
export const quietEndsAt = (m: Member, now: number): number => {
  const q = m.availability?.quiet;
  if (!q) return now;
  const [h, min] = q.to.split(":").map(Number);
  const end = new Date(now);
  end.setHours(h, min, 0, 0);
  if (+end <= now) end.setDate(end.getDate() + 1);
  return +end;
};

/** Are we inside a quiet window right now? Wraps past midnight (22:00 → 07:00). */
export const inQuietHours = (m: Member, at: Date = new Date()): boolean => {
  const q = m.availability?.quiet;
  if (!q) return false;
  const now = `${String(at.getHours()).padStart(2, "0")}:${String(at.getMinutes()).padStart(2, "0")}`;
  return q.from <= q.to ? now >= q.from && now < q.to : now >= q.from || now < q.to;
};

/**
 * What availability says about giving THIS task to THIS person. Lower is better,
 * matching suggestTaker's scoring. Zero means "no opinion".
 *
 * CALIBRATION. `load` is worth 2 points per task, and these numbers are set
 * against that scale on purpose: availability is a fact the person TOLD us,
 * where load is only a proxy for capacity — so it has to outweigh the proxy, or
 * it's a preference the app collects and then ignores.
 *
 *   wfh  -4  = two tasks' worth. Being home beats being marginally less busy.
 *   out  +6  = three tasks' worth. Strong enough to actually lose, not merely to
 *              draw — at +3 this produced a TIE and the app said "either of them
 *              could take it" about someone who wasn't home.
 *
 * Still a suggestion, not a gate: canAssign never sees any of this.
 */
const availabilityScore = (m: Member, task: Task): number => {
  switch (m.availability?.presence) {
    // They're home all day. Favour them for home work — the whole point.
    case "wfh": return -4;
    // Out until tonight: daytime jobs are a bad fit, evening ones are fine.
    case "out": return inWorkHours(task.when ?? "") ? 6 : 0;
    default: return 0;
  }
};

/** The axes and starting cast each preset stands for. The app reads AXES; this
 *  table is the only place a preset means anything at all. */
export const PRESETS: Record<
  HouseholdPreset,
  { label: string; blurb: string; axes: HouseholdAxes; cast: Role[] }
> = {
  family: {
    label: "Family",
    blurb: "Shared money, and people who are looked after",
    axes: { money: "pooled", dependents: true },
    cast: ["owner", "full", "guided"],
  },
  couple: {
    label: "Couple",
    blurb: "Two people, shared money",
    axes: { money: "pooled", dependents: false },
    cast: ["owner", "full"],
  },
  roommates: {
    label: "Roommates",
    blurb: "Separate money, split expenses",
    axes: { money: "split", dependents: false },
    cast: ["owner", "full", "full"],
  },
  solo: {
    label: "Just me",
    blurb: "One person running one home",
    axes: { money: "pooled", dependents: false },
    cast: ["owner"],
  },
};

const emptyDraft = (): OnboardingDraft => ({
  step: 0,
  householdName: "",
  preset: "family",
  axes: PRESETS.family.axes,
  people: [
    { id: "p1", name: "", kind: "person", role: "owner" },
    { id: "p2", name: "", kind: "person", role: "full" },
  ],
  domains: ["Chores", "Shopping", "Bills"],
});

interface HouseholdState {
  members: Record<MemberId, Member>;
  tasks: Task[];
  shopping: ShopItem[];
  inventory: InventoryItem[];
  maint: MaintItem[];
  events: HouseEvent[];
  automations: Automation[];
  activity: ActivityEntry[];

  householdName: string;
  /** How this home works. Every surface branches on THIS, never on a preset —
   *  see types.ts. Changing an axis changes the app, not the household's label. */
  axes: HouseholdAxes;
  /** False while the onboarding flow is running. */
  setupComplete: boolean;
  onboarding: OnboardingDraft;

  persona: Persona;
  ipadRoute: IpadRoute;
  phoneRoute: PhoneRoute;
  sheet: Sheet | null;
  toast: string | null;
  /** Whose face rides along with the toast, when it's about a person. */
  toastWho: MemberId | null;
  /** An optional one-tap reversal for the current toast (e.g. undo a hand-off).
   *  Transient, never persisted — a closure, so it can't ride to disk. */
  toastUndo: (() => void) | null;
  /** Scheduled, not yet delivered. Persisted — a reminder survives a reload. */
  reminders: Reminder[];
  /** What the Dynamic Island is showing right now. Ephemeral. */
  island: IslandNote | null;
  query: string;
  unread: number;
  navTick: number;

  setPersona: (p: Persona) => void;
  goIpad: (r: IpadRoute) => void;
  goPhone: (r: PhoneRoute) => void;
  openSheet: (s: Sheet) => void;
  closeSheet: () => void;
  notify: (msg: string | null) => void;
  scheduleReminder: (r: { at: number; text: string; who: MemberId; title?: string; timeLabel?: string; targetAt?: number; eventId?: string; taskId?: number; icon?: IconName; journey?: boolean; where?: string; waiting?: MemberId[] }) => void;
  /** "Remind me" for an event — BOTH doors (the card and the sheet) call this,
   *  so there is exactly one notion of what that button promises. */
  remindForEvent: (id: string) => void;
  /** The same promise, for a task — journey tasks carry the island too. */
  remindForTask: (id: number) => void;
  dismissIsland: () => void;
  setIslandMode: (mode: "expanded" | "collapsed") => void;
  /** Put the island away, bring it back in `mins` (countdown target preserved). */
  snoozeIsland: (mins: number) => void;
  /** Done — mark the event handled, log it, dismiss the island. */
  islandDone: () => void;
  /** "On my way" from the island — starts the live trip for the island's event. */
  islandOnMyWay: () => void;
  /**
   * Announce a departure and start a LIVE JOURNEY — the island becomes an Uber-
   * style trip (origin → destination, ticking ETA) the household can watch.
   * Works from anywhere: the island's own button, an event's sheet (string id),
   * or a journey TASK's sheet (number id). Defaults to the island's current thing.
   */
  onWay: (id?: string | number) => void;
  /** Arrival — end the live trip, mark the thing handled, dismiss. Fired by the
   *  trip itself when the ETA lands (stand-in for real location); no button. */
  arrive: () => void;
  /** The traveler calls the trip off — logged, so the waiters know. */
  cancelTrip: () => void;
  /** Tap-through — open the event's detail in the app, dismiss the island. */
  islandOpen: () => void;
  /** Mark an event handled. */
  completeEvent: (id: string) => void;
  /** The clock. Called every second by <Ticker/>; fires what's due, holds what's quiet. */
  tick: () => void;
  setQuery: (q: string) => void;
  markRead: () => void;

  toggleTask: (id: number) => void;
  addTask: (t: { title: string; owner: MemberId | null; when: string; due: string; priority: Priority; requires?: Role; minAge?: number; source?: string; said?: string; recurring?: string; amount?: number }) => void;
  /** Edit a task in place — the U of CRUD (title, owner, day, time, priority, repeat). */
  updateTask: (id: number, patch: Partial<Pick<Task, "title" | "owner" | "when" | "due" | "priority" | "recurring">>) => void;
  /** Remove a task / event entirely. Both close their sheet and offer an undo. */
  deleteTask: (id: number) => void;
  addEvent: (e: { title: string; who: MemberId; due: string; time: string; recurring?: string }) => void;
  /** Edit an event in place — the U of CRUD (title, whose, day, time, repeat). */
  updateEvent: (id: string, patch: Partial<Pick<HouseEvent, "title" | "who" | "due" | "time" | "recurring">>) => void;
  deleteEvent: (id: string) => void;
  /** Push an event to a new time — the reschedule half of resolving a clash. */
  rescheduleEvent: (id: string, time: string) => void;
  /** Tell the far end you're running late (in-household → notify; optionally move). */
  flagRunningLate: (p: { eventId: string; tell?: MemberId; moveTo?: string }) => void;

  /* --- creating the things the phone could only view (owner/permitted) --- */
  addAutomation: (a: { when: AutoWhen; then: AutoThen }) => void;
  /** Recompose an existing rule from new parts — the builder's Save-on-edit. */
  updateAutomation: (id: string, a: { when: AutoWhen; then: AutoThen }) => void;
  removeAutomation: (id: string) => void;
  setOwner: (id: number, owner: MemberId | null) => void;
  /** A hand-off from the hand-off sheet: reassigns, LOGS it (the house should
   *  know work moved), keeps the sheet open — people hand off several in a row. */
  handOff: (id: number, to: MemberId) => void;
  acceptSuggestion: (id: number) => void;
  rebalance: () => void;

  toggleShopItem: (id: string) => void;
  addShopItem: (title: string, category: ShopItem["category"]) => void;
  /** Sweep the crossed-off items away — the after-shopping reset. */
  clearBought: () => void;

  /** Settle a BILL-TASK: mark it done and log the money. The provider handoff
   *  (payUrl -> new tab) happens at the glass; the store only records. */
  settleBill: (id: number) => void;
  restock: (id: string) => void;
  addInventory: (i: { title: string; location: string; quantity: string }) => void;
  scheduleMaint: (id: string) => void;
  toggleAutomation: (id: string) => void;

  /** Change someone's access. The ONLY way a role ever changes — there is no
   *  code path that infers one. Owner-only in the UI; the model just does as told. */
  setRole: (id: MemberId, role: Role) => void;

  /* --- household roster, managed post-setup (owner-only in the UI) --- */
  /** Rename any member. (setProfile only edits your OWN; this is the owner's.) */
  renameMember: (id: MemberId, name: string) => void;
  /** Add a member from the invite form — a named person (with an optional email
   *  to invite and a chosen role) or a pet. */
  addMember: (info: { name: string; email?: string; role: Role; kind: MemberKind }) => void;
  /** Remove a member: their open work goes back on the pile and every reference
   *  to them is scrubbed. The last owner can't be removed. */
  removeMember: (id: MemberId) => void;

  /** Where you are. ANY role may set their OWN — declaring your absence is a fact
   *  about your life, not a permission an owner grants. */
  setPresence: (id: MemberId, presence: Presence, span?: { from?: string; to?: string }) => void;
  setQuietHours: (id: MemberId, quiet?: { from: string; to: string }) => void;
  /** Hand every open task in someone's away span to whoever the Balancer picks.
   *  Reports honestly when it can't place them all. */
  coverAway: (id: MemberId) => void;
  /** Give it back. Cover is temporary by construction. */
  uncover: (taskId: number) => void;

  /* onboarding */
  startOnboarding: () => void;
  setStep: (n: number) => void;
  setHouseholdName: (n: string) => void;
  /** Edit the CURRENT person's own profile fields (name, email) from Settings. */
  setProfile: (patch: { name?: string; email?: string; photo?: string }) => void;
  setPreset: (p: HouseholdPreset) => void;
  setAxis: (patch: Partial<HouseholdAxes>) => void;
  addPerson: (kind: DraftPerson["kind"], role: Role) => void;
  updatePerson: (id: string, patch: Partial<DraftPerson>) => void;
  removePerson: (id: string) => void;
  toggleDomain: (d: string) => void;
  completeOnboarding: () => void;
  /** Bail out of setup and land in the seeded demo home, intact — NOT
   *  completeOnboarding (that builds from the draft, which is empty here). */
  skipOnboarding: () => void;
}

let nextId = 1000;

/** Every action that logs activity also bumps the unread count for the bell.
 *  `who` is whose doing it was — omit it for things the HOUSE did, not a person. */
const logged = (s: HouseholdState, text: string, who?: MemberId) => ({
  // 80, not 12. Twelve entries was a ticker; now that state persists this is
  // the household's short-term memory, and a week of family life fits in 80.
  activity: [{ text, at: Date.now(), who }, ...s.activity].slice(0, 80),
  unread: s.unread + 1,
});

/**
 * PERSISTED. The store was in-memory only — every reload wiped the household
 * back to the seed, which is fine for a demo reel and useless for a home.
 *
 * `skipHydration` is load-bearing: persist normally rehydrates the moment the
 * client bundle evaluates, BEFORE React hydrates — so the server HTML (seed)
 * wouldn't match the client tree (persisted state) and React would tear the page
 * down. <Rehydrate/> in page.tsx does it in an effect, after hydration settles.
 */
export const useHousehold = create<HouseholdState>()(persist((set, get) => ({
  members: seedMembers,
  tasks: seedTasks,
  shopping: seedShopping,
  inventory: seedInventory,
  maint: seedMaint,
  events: seedEvents,
  automations: seedAutomations,
  activity: [],

  householdName: "Rivera Home",
  axes: { money: "pooled", dependents: true },
  setupComplete: true,
  onboarding: emptyDraft(),

  persona: "ipad",
  ipadRoute: "today",
  phoneRoute: "today",
  sheet: null,
  toast: null,
  toastWho: null,
  toastUndo: null,
  reminders: [],
  island: null,
  query: "",
  unread: 0,
  navTick: 0,

  setPersona: (p) => set((s) => ({ persona: p, sheet: null, query: "", navTick: s.navTick + 1 })),
  goIpad: (r) => set((s) => ({ ipadRoute: r, query: "", navTick: s.navTick + 1 })),
  goPhone: (r) => set((s) => ({ phoneRoute: r, navTick: s.navTick + 1 })),
  openSheet: (sheet) => set({ sheet }),
  closeSheet: () => set({ sheet: null }),
  notify: (toast) => set({ toast, toastWho: null, toastUndo: null }),

  scheduleReminder: ({ at, text, who, title, timeLabel, targetAt, eventId, taskId, icon, journey, where, waiting }) =>
    set((s) => ({
      reminders: [...s.reminders, { id: ++nextId, at, text, who, title, timeLabel, targetAt, eventId, taskId, icon, journey, where, waiting }],
      toast: at - Date.now() < 60_000
        ? "Reminder set — any moment now"
        : `Reminder set for ${new Date(at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`,
      toastWho: who,
    })),

  remindForEvent: (id) => {
    const s = get();
    const e = s.events.find((x) => x.id === id);
    if (!e) return;
    /**
     * FIVE MINUTES' NOTICE, ANCHORED TO NOW — not to the event's clock time.
     *
     * The old version parsed the event's bare time ("8:00") and counted down
     * to THAT, minus 30 minutes. It broke on the most common case: with no
     * real backend, "now" is just Date.now(), and a seeded event's bare time
     * is almost always already behind it — so `targetAt` was born in the
     * past, the countdown read "Now" on arrival, and nothing ever ticked.
     * A live countdown that's dead on arrival isn't live.
     *
     * "Remind me" promises five minutes' notice. This gives it literally:
     * the island opens in a moment and counts that real five minutes down to
     * zero, live, no matter what the event's label says. The event's own
     * time still shows ("at 8:00") for context — it's just no longer what
     * the clock is racing toward.
     */
    s.scheduleReminder({
      at: Date.now() + 1500,
      text: `${e.title} at ${e.time}`,
      title: e.title,
      timeLabel: e.time,
      targetAt: Date.now() + 1500 + 5 * 60_000,
      who: e.who,
      eventId: e.id,
      icon: e.icon,
      journey: e.journey,
      where: e.where,
      waiting: e.waiting,
    });
  },

  remindForTask: (id) => {
    const s = get();
    const t = s.tasks.find((x) => x.id === id);
    const who = t && holder(t);
    if (!t || !who) return;
    s.scheduleReminder({
      at: Date.now() + 1500,
      text: `${t.title}${t.when ? ` at ${t.when}` : ""}`,
      title: t.title,
      timeLabel: t.when,
      targetAt: Date.now() + 1500 + 5 * 60_000,
      who,
      taskId: t.id,
      icon: taskGlyph(t),
      journey: t.journey,
      where: t.where,
      waiting: t.waiting,
    });
  },

  dismissIsland: () => set({ island: null }),
  setIslandMode: (mode) => set((s) => (s.island ? { island: { ...s.island, mode } } : {})),

  /**
   * Snooze — put the island away and bring it back in `mins`.
   *
   * The countdown TARGET is preserved, not restarted: the island was counting to
   * an actual moment (an event 5 min out), so snoozing two minutes should bring
   * it back showing ~3:00, not a fresh 2:00. It re-nudges you sooner; it doesn't
   * move the thing you're being nudged about.
   */
  snoozeIsland: (mins) => {
    const s = get();
    const i = s.island;
    if (!i) return;
    s.scheduleReminder({
      at: Date.now() + mins * 60_000,
      text: i.title,
      title: i.title,
      timeLabel: i.timeLabel,
      targetAt: i.targetAt,
      who: i.who ?? Object.keys(s.members)[0],
      eventId: i.eventId,
      taskId: i.taskId,
      icon: i.icon,
      journey: i.journey,
      where: i.where,
      waiting: i.waiting,
    });
    set({ island: null });
  },

  completeEvent: (id) =>
    set((s) => {
      const e = s.events.find((x) => x.id === id);
      if (!e) return {};
      return {
        events: s.events.map((x) => (x.id === id ? { ...x, done: true } : x)),
        ...logged(s, `${s.members[e.who]?.name ?? "Someone"} handled ${e.title}`, e.who),
      };
    }),

  islandDone: () => {
    const { island, tasks } = get();
    if (island?.eventId) get().completeEvent(island.eventId);
    const t = island?.taskId != null ? tasks.find((x) => x.id === island.taskId) : undefined;
    if (t && !t.done) get().toggleTask(t.id);
    set({ island: null, toast: "Nice — handled" });
  },

  islandOnMyWay: () => get().onWay(),

  /**
   * "On my way" → a LIVE JOURNEY. The reminder was yours alone; this turns it
   * into something the household watches: a feed entry ("Sam is on the way —
   * Pick up the kids") and a live island that counts an ETA down from ~8 minutes
   * out, origin (home) → destination, the way a delivery app narrates a courier.
   *
   * Works from either door — the island's button (no `id`, uses the current
   * island) or an event's detail sheet (`id` passed) — so both start the same
   * trip.
   */
  onWay: (id) => {
    const { island, members, events, tasks } = get();
    // Three doors, one trip: a task id (number), an event id (string), or
    // whatever the island is currently showing.
    const taskId = typeof id === "number" ? id : island?.taskId;
    const eventId = typeof id === "string" ? id : taskId == null ? island?.eventId : undefined;
    const t = taskId != null ? tasks.find((x) => x.id === taskId) : undefined;
    const e = eventId ? events.find((x) => x.id === eventId) : undefined;
    const who = (t && holder(t)) ?? e?.who ?? island?.who ?? null;
    const name = who ? members[who]?.name : "Someone";
    const title = t?.title ?? e?.title ?? island?.title ?? "";
    const where = t?.where ?? e?.where ?? island?.where;
    const waiting = t?.waiting ?? e?.waiting ?? island?.waiting;
    const now = Date.now();
    // A real-feeling ETA: eight minutes out, so the wait is watchable.
    // Arrival is the trip's own event (location would fire it for real) — the
    // island auto-arrives when this lands; there is no "Arrived" button.
    const etaAt = now + 8 * 60_000;

    /**
     * The LIVE TRIP belongs to the people in `waiting` (the island renders on
     * THEIR phones — see DynamicIsland's audience rule): the kids watch Dad
     * come. The traveler's screen would hand off to the maps app on a real
     * phone — in this demo that's said in the status, not performed (yanking
     * the person out of the app to a real browser tab isn't a demo of anything).
     */
    const names = (waiting ?? []).map((m) => members[m]?.name).filter(Boolean);
    const told = names.length === 0 ? "the house"
      : names.length === 1 ? names[0]
      : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
    set((s) => ({
      sheet: null,
      island: {
        title,
        who,
        mode: "expanded" as const,
        phase: "journey" as const,
        where,
        icon: (t ? taskGlyph(t) : e?.icon ?? island?.icon) as IconName | undefined,
        eventId,
        taskId,
        startAt: now,
        etaAt,
        waiting,
      },
      ...logged(s, `${name} is on the way${title ? ` — ${title}` : ""}`, who ?? undefined),
      // One short fact for the pill — the Maps hand-off is implied by leaving,
      // and the long version ran clean off the glass.
      toast: `On the way — told ${told}`,
      toastWho: who,
    }));
  },

  /**
   * The TRAVELER's way out — plans change, the other parent got there first.
   * Only the person driving can call a trip off; the audience can merely put
   * the widget away (dismiss). Cancelling says so to the people who were told
   * "on my way", so nobody stands at a gate watching a dead ETA.
   */
  cancelTrip: () => {
    const { island, members } = get();
    if (island?.phase !== "journey") return;
    const name = island.who ? members[island.who]?.name : "Someone";
    set((s) => ({
      island: null,
      ...logged(s, `${name} turned back${island.title ? ` — ${island.title}` : ""}`, island.who ?? undefined),
      toast: "Trip called off — the house knows",
      toastWho: island.who,
    }));
  },

  arrive: () => {
    const { island, tasks } = get();
    if (!island) return;
    if (island.eventId) get().completeEvent(island.eventId);
    // toggleTask carries the whole completion (stamp, stars, log) — guarded so
    // arrival can never UN-do a task someone already ticked off.
    const t = island.taskId != null ? tasks.find((x) => x.id === island.taskId) : undefined;
    if (t && !t.done) get().toggleTask(t.id);
    set({ island: null, toast: island.where ? `Arrived at ${island.where}` : "Arrived" });
  },

  islandOpen: () => {
    const { island } = get();
    set({
      island: null,
      sheet: island?.taskId != null ? { type: "task", id: island.taskId }
        : island?.eventId ? { type: "event", id: island.eventId }
        : null,
    });
  },

  /**
   * Delivery. One reminder per tick — the island is a mouth, not a queue — and
   * quiet hours are enforced HERE, at the moment of delivery, not at scheduling:
   * quiet hours can change between the promise and the appointed time, and the
   * setting that exists when the reminder comes due is the one that governs.
   */
  tick: () => {
    /**
     * BAIL BEFORE set(). `set({})` still builds a fresh state object, so every
     * subscriber re-rendered once a second — and that 1Hz heartbeat reset the
     * Toast's dismiss timer each beat (new onDone identity → effect re-run →
     * new setTimeout), which is why "Reminder set" never left the screen.
     * The clock may only touch the store when it has something to say.
     */
    if (!get().reminders.some((r) => r.at <= Date.now())) return;
    set((s) => {
      const now = Date.now();
      const due = s.reminders.find((r) => r.at <= now);
      if (!due) return {};

      const m = s.members[due.who];
      if (m && inQuietHours(m)) {
        // Held, not dropped. Re-aim at the quiet window's end.
        return {
          reminders: s.reminders.map((r) =>
            r.id === due.id ? { ...r, at: quietEndsAt(m, now), held: true } : r),
        };
      }
      return {
        reminders: s.reminders.filter((r) => r.id !== due.id),
        island: {
          title: due.title ?? due.text,
          timeLabel: due.timeLabel,
          targetAt: due.targetAt,
          who: due.who,
          held: due.held,
          mode: "expanded" as const,
          eventId: due.eventId,
          taskId: due.taskId,
          icon: due.icon,
          journey: due.journey,
          where: due.where,
          waiting: due.waiting,
          phase: "reminder" as const,
        },
        ...logged(s, due.text, due.who),
      };
    });
  },
  setQuery: (query) => set({ query }),
  markRead: () => set({ unread: 0 }),

  toggleTask: (id) =>
    set((s) => {
      const tasks = s.tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t));
      const t = tasks.find((x) => x.id === id)!;
      // The timestamp follows the checkbox: set on done, gone on undo. It is
      // the ONLY record of when — `due` is when it was wanted, not when it happened.
      t.completedAt = t.done ? Date.now() : undefined;
      const members = { ...s.members };
      let toast: string | null = t.done ? "Nice — that's done" : null;

      // Stars follow the ROLE that draws them, not an age. Whoever is on the
      // guided surface gets the reward loop that surface promises.
      // The person who DID it earns the star — covering for someone is still
      // doing the work.
      const did = holder(t);
      if (did && members[did]?.role === "guided") {
        const m = members[did];
        members[did] = { ...m, stars: Math.max(0, (m.stars ?? 0) + (t.done ? 1 : -1)) };
        if (t.done) toast = `${m.name} earned a star!`;
      }
      const who = did ? members[did].name : "Someone";
      return {
        tasks, members, toast,
        sheet: s.sheet?.type === "task" ? null : s.sheet,
        ...logged(s, `${who} ${t.done ? "completed" : "reopened"} “${t.title}”`, did ?? undefined),
      };
    }),

  /**
   * `due` is REQUIRED and comes from the form. It used to be inferred from the
   * `when` string — `when === "Today" ? 0 : when === "Weekend" ? 2 : 4` — which
   * fabricated a date from a field that is documented as time-of-day only.
   * Anything unrecognised landed four days out, so a task typed "Tonight" showed
   * "Tonight" beside a badge for next Tuesday. A card must never argue with itself.
   */
  addTask: ({ title, owner, when, due, priority, requires, minAge, source, said, recurring, amount }) =>
    set((s) => {
      const task: Task = {
        id: ++nextId, title, owner, when, due, recurring, amount,
        // A repeating task IS a routine — label its provenance so, unless it
        // already carries one. Money defaults to the Bills shelf.
        done: false, priority, requires, minAge,
        source: source ?? (typeof amount === "number" ? "Bills" : recurring ? "Routine" : undefined), said,
        // Nobody picked a person: leave it unowned and let the Balancer nominate,
        // rather than silently parking it on whoever opened the sheet. The gates
        // (and any money) ride along so the nomination is filtered the same way
        // the sheet's was — suggestTaker routes bills to the Bills owner.
        suggest: owner ? undefined : suggestTaker(s, { due, priority, requires, minAge, source, amount } as Task)?.id,
      };
      const forWho = owner ? ` for ${s.members[owner].name}` : "";
      return {
        tasks: [task, ...s.tasks],
        sheet: null,
        toast: `Task added${forWho}`,
        ...logged(s, `Added “${title}”${forWho}`, owner ?? undefined),
      };
    }),

  // Edit in place. Reassigning the owner clears a stale cover — a task handed to
  // someone new isn't still "covered by" whoever the old owner had arranged.
  updateTask: (id, patch) =>
    set((s) => {
      const t = s.tasks.find((x) => x.id === id);
      if (!t) return {};
      const reassigned = patch.owner !== undefined && patch.owner !== t.owner;
      const nextOwner = patch.owner !== undefined ? patch.owner : t.owner;
      return {
        tasks: s.tasks.map((x) =>
          x.id === id ? { ...x, ...patch, ...(reassigned ? { coveredBy: undefined } : {}) } : x,
        ),
        toast: "Task updated",
        toastWho: nextOwner,
        ...logged(s, `Edited “${patch.title ?? t.title}”`, nextOwner ?? undefined),
      };
    }),

  // Delete, with a real undo — the deleted thing rides in the toast's reversal
  // closure and slots back at its old index, so a mis-tap costs one more tap,
  // not the task. Closes the sheet it was opened from.
  deleteTask: (id) =>
    set((s) => {
      const idx = s.tasks.findIndex((t) => t.id === id);
      if (idx < 0) return {};
      const removed = s.tasks[idx];
      return {
        tasks: s.tasks.filter((t) => t.id !== id),
        sheet: s.sheet?.type === "task" ? null : s.sheet,
        toast: `Deleted “${removed.title}”`,
        toastWho: null,
        toastUndo: () =>
          set((s2) => ({
            tasks: [...s2.tasks.slice(0, idx), removed, ...s2.tasks.slice(idx)],
            toast: `“${removed.title}” restored`,
            toastUndo: null,
          })),
      };
    }),

  addEvent: ({ title, who, due, time, recurring }) =>
    set((s) => {
      const event: HouseEvent = { id: `e${++nextId}`, title, who, due, time, recurring, done: false };
      return {
        events: [...s.events, event],
        sheet: null,
        toast: "Event added",
        toastWho: who,
        ...logged(s, `Added “${title}” to the calendar`, who),
      };
    }),

  deleteEvent: (id) =>
    set((s) => {
      const idx = s.events.findIndex((e) => e.id === id);
      if (idx < 0) return {};
      const removed = s.events[idx];
      return {
        events: s.events.filter((e) => e.id !== id),
        sheet: s.sheet?.type === "event" ? null : s.sheet,
        toast: `Deleted “${removed.title}”`,
        toastWho: null,
        toastUndo: () =>
          set((s2) => ({
            events: [...s2.events.slice(0, idx), removed, ...s2.events.slice(idx)],
            toast: `“${removed.title}” restored`,
            toastUndo: null,
          })),
      };
    }),

  updateEvent: (id, patch) =>
    set((s) => {
      const e = s.events.find((x) => x.id === id);
      if (!e) return {};
      return {
        events: s.events.map((x) => (x.id === id ? { ...x, ...patch } : x)),
        toast: "Event updated",
        toastWho: (patch.who ?? e.who) as MemberId,
        ...logged(s, `Edited “${patch.title ?? e.title}”`, patch.who ?? e.who),
      };
    }),

  rescheduleEvent: (id, time) =>
    set((s) => {
      const e = s.events.find((x) => x.id === id);
      if (!e) return {};
      return {
        events: s.events.map((x) => (x.id === id ? { ...x, time } : x)),
        sheet: null,
        toast: `Moved to ${time} — the clash is gone`,
        toastWho: e.who,
        ...logged(s, `Moved “${e.title}” to ${time}`, e.who),
      };
    }),

  flagRunningLate: ({ eventId, tell, moveTo }) =>
    set((s) => {
      const e = s.events.find((x) => x.id === eventId);
      if (!e) return {};
      const events = moveTo ? s.events.map((x) => (x.id === eventId ? { ...x, time: moveTo } : x)) : s.events;
      const teller = s.members[e.who]?.name ?? "Someone";
      // In-household: it's a real notification — bump the unread dot, log it,
      // and land the toast under their face so it reads as "they now know".
      if (tell) {
        const name = s.members[tell]?.name ?? "them";
        return {
          events,
          sheet: null,
          toast: `${name} knows now`,
          toastWho: tell,
          // logged() already bumps unread — this IS the notification.
          ...logged(s, `${teller} let ${name} know they're running late to “${e.title}”`, tell),
        };
      }
      // Outside friend: the message was copied to send by hand — just record it.
      return {
        events,
        sheet: null,
        toast: moveTo ? `Message ready · moved to ${moveTo}` : "Message ready to send",
        toastWho: e.who,
        ...logged(s, `${teller} sorted the clash on “${e.title}”`, e.who),
      };
    }),

  addAutomation: ({ when, then }) =>
    set((s) => ({
      automations: [...s.automations, { id: `a${Date.now()}`, ...autoCopy(when, then, s.members), on: true, when, then }],
      toast: "Automation added — switched on",
    })),

  updateAutomation: (id, { when, then }) =>
    set((s) => ({
      automations: s.automations.map((a) =>
        a.id === id ? { ...a, ...autoCopy(when, then, s.members), when, then } : a),
      toast: "Automation updated",
    })),

  removeAutomation: (id) =>
    set((s) => {
      const a = s.automations.find((x) => x.id === id);
      return {
        automations: s.automations.filter((x) => x.id !== id),
        toast: a ? `Removed "${a.title}"` : null,
      };
    }),

  setOwner: (id, owner) =>
    set((s) => ({
      tasks: s.tasks.map((t) => (t.id === id ? { ...t, owner, suggest: undefined } : t)),
      sheet: null,
      toast: owner ? `${s.members[owner].name} has it from here` : "Back on the pile — nobody's got it",
      toastWho: owner ?? null,
    })),

  handOff: (id, to) =>
    set((s) => {
      const t = s.tasks.find((x) => x.id === id);
      if (!t) return {};
      const prevOwner = t.owner;
      const from = prevOwner ? s.members[prevOwner]?.name : "Nobody";
      return {
        tasks: s.tasks.map((x) => (x.id === id ? { ...x, owner: to, suggest: undefined } : x)),
        // No `sheet: null` — the hand-off sheet stays up for the next one.
        toast: `${s.members[to].name} has it from here`,
        toastWho: to,
        // A clean reversal: put the task back where it was, name the return, and
        // drop the undo so the confirming toast carries no second undo.
        toastUndo: () =>
          set((s2) => ({
            tasks: s2.tasks.map((x) => (x.id === id ? { ...x, owner: prevOwner, suggest: t.suggest } : x)),
            toast: prevOwner ? `Back with ${s2.members[prevOwner]?.name}` : "Back on the pile",
            toastWho: prevOwner,
            toastUndo: null,
          })),
        ...logged(s, `${from} handed “${t.title}” to ${s.members[to].name}`, to),
      };
    }),

  acceptSuggestion: (id) =>
    set((s) => {
      const t = s.tasks.find((x) => x.id === id);
      if (!t?.suggest) return {};
      const owner = t.suggest;
      return {
        tasks: s.tasks.map((x) => (x.id === id ? { ...x, owner, suggest: undefined } : x)),
        toast: `${s.members[owner].name} has it from here`,
        toastWho: owner,
        toastUndo: null,
      };
    }),

  /**
   * The Balancer. Move work off whoever is most loaded — but only onto someone
   * who may actually hold it. A child never inherits the electricity bill.
   */
  rebalance: () =>
    set((s) => {
      const move = previewRebalance(s);
      if (!move) return { toast: "Already nicely balanced" };
      const { task, from, to } = move;
      return {
        tasks: s.tasks.map((t) => (t.id === task.id ? { ...t, owner: to.id } : t)),
        toast: `Moved to ${to.name} — nicely balanced`,
        toastWho: to.id,
        toastUndo: null,
        ...logged(s, `Moved “${task.title}” from ${from.name} to ${to.name}`),
      };
    }),

  toggleShopItem: (id) =>
    set((s) => {
      /**
       * THE DEAD-CHECK BUG. A "Running low" row can be DERIVED — shoppingList()
       * invents it from inventory with id `auto-<inv>`; it exists in no array.
       * Mapping s.shopping missed it entirely, so those three checks ate taps
       * and did nothing — "clicks not working, very intermittent": real rows
       * worked, derived ones were dead. Buying one now MATERIALISES it as a
       * real crossed-off item (the selector stops re-deriving it by title), so
       * un-checking and "Clear bought" treat it like anything else.
       */
      if (id.startsWith("auto-")) {
        const inv = s.inventory.find((i) => i.id === id.slice(5));
        if (!inv) return {};
        return {
          shopping: [...s.shopping, {
            id,
            title: inv.title,
            category: (inv.title === "Dog food" ? "Pet" : inv.location === "Under sink" ? "Supplies" : "Groceries") as ShopItem["category"],
            low: true, done: true, auto: true,
          }],
        };
      }
      return { shopping: s.shopping.map((i) => (i.id === id ? { ...i, done: !i.done } : i)) };
    }),

  addShopItem: (title, category) =>
    set((s) => {
      // A want has a wanter: stamp whoever's phone did the asking (the shared
      // iPad stays anonymous — nobody specific was holding the pen), and tell
      // the feed — a shared list the house can't see changing isn't shared.
      const by = s.persona !== "ipad" ? s.persona : undefined;
      const name = by ? s.members[by]?.name ?? "Someone" : "The house";
      return {
        shopping: [{ id: `s${++nextId}`, title, category, low: false, done: false, by }, ...s.shopping],
        // The sheet STAYS OPEN — people add three things, not one. (It used to
        // set `sheet: null` here, which slammed the list shut on every Add.)
        // The toast NAMES THE AISLE: the app filed it without asking, so it
        // says where — transparency instead of a question.
        toast: `Added to ${category}`,
        ...logged(s, `${name} added ${title} to the shopping list`, by),
      };
    }),

  clearBought: () =>
    set((s) => {
      const n = s.shopping.filter((i) => i.done).length;
      if (!n) return {};
      return {
        shopping: s.shopping.filter((i) => !i.done),
        toast: `Cleared ${n} bought`,
        ...logged(s, `Cleared ${n} bought ${n === 1 ? "item" : "items"} off the shopping list`),
      };
    }),

  settleBill: (id) =>
    set((s) => {
      const t = s.tasks.find((x) => x.id === id);
      if (!t) return {};
      return {
        tasks: s.tasks.map((x) => (x.id === id ? { ...x, done: true, completedAt: Date.now() } : x)),
        toast: `Paid $${t.amount ?? 0} — ${t.title}`,
        ...logged(s, `Paid $${t.amount ?? 0} — ${t.title}`),
      };
    }),

  restock: (id) =>
    set((s) => {
      const item = s.inventory.find((i) => i.id === id);
      return {
        inventory: s.inventory.map((i) =>
          i.id === id ? { ...i, status: "ok" as const, quantity: "Restocked" } : i,
        ),
        toast: item ? `${item.title} back in stock` : null,
      };
    }),

  addInventory: ({ title, location, quantity }) =>
    set((s) => ({
      inventory: [...s.inventory, { id: `inv${Date.now()}`, title: title.trim() || "New item", location: location.trim() || "Home", quantity: quantity.trim() || "In stock", status: "ok" }],
      toast: "Added to the house",
    })),

  scheduleMaint: (id) =>
    set((s) => {
      const item = s.maint.find((m) => m.id === id);
      return {
        maint: s.maint.map((m) => (m.id === id ? { ...m, status: "up" as const, when: "Scheduled" } : m)),
        toast: item ? `${item.title} scheduled` : null,
        ...(item ? logged(s, `Scheduled “${item.title}”`) : {}),
      };
    }),

  toggleAutomation: (id) =>
    set((s) => {
      const a = s.automations.find((x) => x.id === id);
      return {
        automations: s.automations.map((x) => (x.id === id ? { ...x, on: !x.on } : x)),
        toast: a ? `${a.title} ${a.on ? "off" : "on"}` : null,
      };
    }),

  /**
   * Change someone's access — the only path a role ever changes by.
   *
   * Changing a role can strand work: demote the person holding the bills and
   * those tasks now sit with someone who may not hold them. We un-assign rather
   * than silently leave them, so the household SEES the gap instead of trusting
   * a name that no longer applies.
   */
  setRole: (id, role) =>
    set((s) => {
      const m = s.members[id];
      if (!m || m.role === role) return {};
      const next: Member = {
        ...m,
        role,
        // Stars belong to the guided surface: arriving starts a tally, leaving ends it.
        stars: role === "guided" ? m.stars ?? 0 : undefined,
      };
      const members = { ...s.members, [id]: next };
      let stranded = 0;
      const tasks = s.tasks.map((t) => {
        if (t.done) return t;
        let out = t;

        /**
         * COVER IS NOT A BACK DOOR ROUND THE GATE.
         *
         * This checked only tasks the person OWNED, which `coveredBy` quietly
         * turned into a hole: demote someone who's covering the electricity bill
         * and the cover survives, leaving a `limited` member holding work that
         * needs `full`. `canAssign` is the app's one gate and every path has to
         * pass through it — including the one added last.
         *
         * Cover breaks toward the OWNER, not to nobody: the job was always
         * theirs, so there's a right answer that isn't null.
         */
        if (out.coveredBy === id && !canAssign(next, out)) {
          out = { ...out, coveredBy: undefined };
        }
        if (out.owner === id && !canAssign(next, out)) {
          stranded++;
          out = { ...out, owner: null, suggest: suggestTaker({ ...s, members }, out)?.id };
        }
        return out;
      });
      return {
        members,
        tasks,
        ...logged(s, `${m.name} now ${ROLE_SET[role]}`, id),
        toast: stranded
          ? `${m.name} now ${ROLE_SET[role]} — ${stranded} ${stranded === 1 ? "task needs" : "tasks need"} a new owner`
          : `${m.name} now ${ROLE_SET[role]}`,
        toastWho: id,
      };
    }),

  renameMember: (id, name) =>
    set((s) => {
      const m = s.members[id];
      const n = name.trim();
      if (!m || !n || m.name === n) return {};
      return { members: { ...s.members, [id]: { ...m, name: n } } };
    }),

  addMember: (info) =>
    set((s) => {
      // A palette past the five seeded member colours, so a sixth face isn't a clash.
      const palette = ["#D9488B", "#5B8C3E", "#B26BD6", "#3EB0C8", "#E8994B", "#6C7BE0"];
      const id = `m${Date.now()}`;
      const name = info.name.trim() || "New member";
      const email = info.email?.trim() || undefined;
      // A person you emailed is INVITED (pending) until they accept; a pet, or a
      // person added without an email, just joins.
      const invited = info.kind === "person" && !!email;
      const member: Member = {
        id,
        name,
        kind: info.kind,
        role: info.kind === "pet" ? "guided" : info.role,
        email,
        color: palette[Object.keys(s.members).length % palette.length],
        stars: info.kind === "pet" ? undefined : 0,
        invited: invited || undefined,
      };
      return {
        members: { ...s.members, [id]: member },
        toast: invited ? `Invite sent to ${name}` : `${name} joined`,
      };
    }),

  removeMember: (id) =>
    set((s) => {
      const m = s.members[id];
      if (!m) return {};
      // The house always needs an owner; demote them first.
      if (m.role === "owner") return { toast: "Make someone else the owner first" };
      const members = { ...s.members };
      delete members[id];
      // Their open work goes back on the pile; every reference is scrubbed so
      // nothing points at a person who's gone.
      const tasks = s.tasks.map((t) => ({
        ...t,
        owner: t.owner === id ? null : t.owner,
        coveredBy: t.coveredBy === id ? undefined : t.coveredBy,
        suggest: t.suggest === id ? undefined : t.suggest,
      }));
      return {
        members,
        tasks,
        events: s.events.filter((e) => e.who !== id),
        shopping: s.shopping.map((it) => (it.by === id ? { ...it, by: undefined } : it)),
        reminders: s.reminders.filter((r) => r.who !== id),
        toast: `${m.name} removed`,
      };
    }),

  setPresence: (id, presence, span) =>
    set((s) => {
      const m = s.members[id];
      if (!m) return {};
      // Leaving `away` drops the span — a stale range would keep answering
      // awayOn() for a trip that already ended.
      const availability: Availability = {
        ...m.availability,
        presence,
        from: presence === "away" ? span?.from ?? todayIso() : undefined,
        to: presence === "away" ? span?.to : undefined,
      };
      const said =
        presence === "away"
          ? `${m.name} is away${availability.to ? ` until ${relativeInline(availability.to)}` : ""}`
          : presence === "wfh" ? `${m.name} is home today`
          : presence === "out" ? `${m.name} is out today`
          : `${m.name} is around`;
      return {
        members: { ...s.members, [id]: { ...m, availability } },
        toast: said,
        toastWho: id,
        ...logged(s, said, id),
      };
    }),

  setQuietHours: (id, quiet) =>
    set((s) => {
      const m = s.members[id];
      if (!m) return {};
      return {
        members: { ...s.members, [id]: { ...m, availability: { presence: "here", ...m.availability, quiet } } },
        toast: quiet ? `Quiet from ${quiet.from} to ${quiet.to}` : "Quiet hours off",
      };
    }),

  /**
   * Cover a trip.
   *
   * Only the tasks that fall INSIDE the span — being away Thursday says nothing
   * about a task due next Tuesday, and quietly handing that one off too would be
   * the app overreaching on a fact it was given for a narrower purpose.
   *
   * It reports what it could NOT place. An app that says "done" while silently
   * leaving three tasks stranded on someone who's in Spain is worse than one that
   * says "two of these have nobody" — the second is actionable, the first is a
   * surprise on Friday night.
   */
  coverAway: (id) =>
    set((s) => {
      const m = s.members[id];
      if (!m || m.availability?.presence !== "away") return {};

      const stranded: string[] = [];
      let placed = 0;

      /**
       * ACCUMULATE. suggestTaker scores by load, so each pick has to see the
       * previous one — asking it five times against the same starting state
       * returns the same least-loaded person five times, and "covered 5 tasks"
       * means "dumped all five on Sam". The Balancer can only balance against a
       * board that's being updated.
       */
      const tasks = [...s.tasks];
      for (let i = 0; i < tasks.length; i++) {
        const t = tasks[i];
        if (t.owner !== id || t.done || t.coveredBy || !awayOn(m, t.due)) continue;
        const pick = suggestTaker({ ...s, tasks }, t);
        if (!pick) { stranded.push(t.title); continue; }
        tasks[i] = { ...t, coveredBy: pick.id };
        placed++;
      }

      if (!placed && !stranded.length) return { toast: "Nothing to cover" };
      const toast = !placed
        ? `Nobody can cover ${stranded.length === 1 ? "it" : "these"} — ${stranded.length} still on you`
        : stranded.length
          ? `Covered ${placed}. ${stranded.length} nobody can take.`
          : `Covered ${placed} ${placed === 1 ? "task" : "tasks"} while you're away`;

      return {
        tasks,
        toast,
        toastWho: id,
        ...(placed ? logged(s, `${m.name}'s ${placed} ${placed === 1 ? "task" : "tasks"} covered while away`, id) : {}),
      };
    }),

  uncover: (taskId) =>
    set((s) => ({
      tasks: s.tasks.map((t) => (t.id === taskId ? { ...t, coveredBy: undefined } : t)),
      toast: "Back with you",
    })),

  /* ---------------- onboarding ---------------- */

  startOnboarding: () =>
    // Keep the current surface: start it from a phone and you set up on a phone
    // (a household with no iPad), from the iPad and you set up there.
    set({ setupComplete: false, onboarding: emptyDraft(), sheet: null }),

  setStep: (step) =>
    set((s) => ({ onboarding: { ...s.onboarding, step }, navTick: s.navTick + 1 })),

  setHouseholdName: (householdName) =>
    set((s) => ({ onboarding: { ...s.onboarding, householdName } })),

  setProfile: (patch) =>
    set((s) => {
      const id = s.persona !== "ipad" ? s.persona : null;
      if (!id || !s.members[id]) return {};
      return { members: { ...s.members, [id]: { ...s.members[id], ...patch } } };
    }),

  /** A preset is a SHORTCUT: it sets the axes and suggests a cast. Both stay
   *  editable afterwards — picking "Family" is a starting point, not a category
   *  you're filed under. */
  setPreset: (preset) =>
    set((s) => {
      const p = PRESETS[preset];
      const people: DraftPerson[] = p.cast.map((role, i) => ({
        id: `p${i + 1}`,
        name: s.onboarding.people[i]?.name ?? "",
        kind: "person",
        role,
      }));
      return { onboarding: { ...s.onboarding, preset, axes: p.axes, people } };
    }),

  /** Change an axis directly — this is what makes the preset disposable. A couple
   *  who has a baby flips `dependents`; they don't become a different household. */
  setAxis: (patch) =>
    set((s) => ({ onboarding: { ...s.onboarding, axes: { ...s.onboarding.axes, ...patch } } })),

  addPerson: (kind, role) =>
    set((s) => ({
      onboarding: {
        ...s.onboarding,
        people: [...s.onboarding.people, { id: `p${Date.now()}`, name: "", kind, role }],
      },
    })),

  updatePerson: (id, patch) =>
    set((s) => ({
      onboarding: {
        ...s.onboarding,
        people: s.onboarding.people.map((p) => (p.id === id ? { ...p, ...patch } : p)),
      },
    })),

  removePerson: (id) =>
    set((s) => ({
      onboarding: { ...s.onboarding, people: s.onboarding.people.filter((p) => p.id !== id) },
    })),

  toggleDomain: (d) =>
    set((s) => ({
      onboarding: {
        ...s.onboarding,
        domains: s.onboarding.domains.includes(d)
          ? s.onboarding.domains.filter((x) => x !== d)
          : [...s.onboarding.domains, d],
      },
    })),

  /**
   * Commit the draft into a real household. We seed a handful of starter
   * responsibilities from the chosen domains and share them round-robin, so the
   * home is already running the moment you land in it — no blank page.
   */
  completeOnboarding: () =>
    set((s) => {
      const d = s.onboarding;
      const members: Record<MemberId, Member> = {};
      d.people
        .filter((p) => p.name.trim())
        .forEach((p, i) => {
          const id = p.name.trim().toLowerCase().replace(/[^a-z0-9]/g, "") || `member${i}`;
          members[id] = {
            id, name: p.name.trim(), kind: p.kind, age: p.age,
            color: PALETTE[i % PALETTE.length],
            // The role the user CHOSE. Not "i === 0", not derived from an age.
            role: p.role,
            // Stars belong to the guided surface, which is where the reward loop
            // is drawn — so they follow the ROLE, not a birthday.
            stars: p.role === "guided" ? 0 : undefined,
            responsibility: { domains: [], spaces: [] },
          };
        });

      const people = Object.values(members).filter((m) => m.kind !== "pet");

      type Starter = Assignable & { title: string; domain: string; when: string; recurring?: string };
      const starters: Starter[] = [
        { title: "Take out the trash", domain: "Chores", when: "Tonight", recurring: "Weekly", minAge: 8 },
        { title: "Tidy the kitchen", domain: "Chores", when: "Today", recurring: "Daily", minAge: 6 },
        { title: "Weekly grocery run", domain: "Shopping", when: "This week", recurring: "Weekly", requires: "full" },
        { title: "Pay the electric bill", domain: "Bills", when: "This week", requires: "full" },
        { title: "Replace the HVAC filter", domain: "Maintenance", when: "This week", recurring: "Quarterly", requires: "full" },
        { title: "Walk the dog", domain: "Pets", when: "Today", recurring: "Daily", minAge: 10 },
        { title: "School run", domain: "Kids", when: "Today", recurring: "Weekdays", requires: "full" },
      ];

      // Share the work out, but only among people who may actually hold each task,
      // always handing it to whoever is carrying least so far.
      const running: Record<MemberId, number> = {};
      people.forEach((m) => (running[m.id] = 0));

      const tasks: Task[] = starters
        .filter((st) => d.domains.includes(st.domain))
        .map((st) => {
          const eligible = people
            .filter((m) => canAssign(m, st))
            .sort((a, b) => running[a.id] - running[b.id]);
          const owner = eligible[0]?.id ?? null;
          if (owner) running[owner] += 1;
          return {
            id: ++nextId,
            title: st.title,
            owner,
            when: st.when,
            due: iso(addDays(new Date(), st.when === "This week" ? 3 : 0)),
            done: false,
            priority: "med" as const,
            recurring: st.recurring,
            requires: st.requires,
            minAge: st.minAge,
          };
        });

      return {
        setupComplete: true,
        householdName: d.householdName.trim() || "Our home",
        axes: d.axes,
        members,
        tasks,
        shopping: [],
        inventory: [],
        maint: [],
        events: [],
        activity: [{ text: `${d.householdName.trim() || "Your home"} is set up`, at: Date.now() }],
        unread: 1,
        persona: "ipad",
        ipadRoute: "today",
        toast: "Your home is set up",
        navTick: s.navTick + 1,
      };
    }),

  skipOnboarding: () =>
    set((s) => ({
      setupComplete: true,
      onboarding: emptyDraft(),
      householdName: "Rivera Home",
      members: seedMembers,
      tasks: seedTasks,
      shopping: seedShopping,
      inventory: seedInventory,
      maint: seedMaint,
      events: seedEvents,
      automations: seedAutomations,
      sheet: null,
      navTick: s.navTick + 1,
    })),
}), {
  name: "homeboard",
  // 2: seed event times gained explicit AM/PM. Persisted state predating this
  // holds bare times ("8:00") that the display heuristic mis-guesses (trash
  // night reads 8:00 AM). Bumping the version discards the stale copy and
  // re-seeds — the honest way to ship a data change with no backend to migrate.
  // 3: events gained journey/where/icon and a "Pick up the kids" event (e9)
  // replaced the task of the same name; re-seed so both land.
  // 4: the trash pair merged into one dual-sourced task; pickup went back to
  // being a TASK (a journey one). Re-seed.
  // 5: shopping gained an age-gated item (wine, minAge 18). Re-seed.
  // 6: "Auto" source label; demo events seeded relative to now. Re-seed.
  // 7: "On my way" needs an audience — `waiting` landed on the pickup. Re-seed.
  // 8: dentist wears a tooth, yoga a lotus. Re-seed.
  // 9: shopping items carry `by` (whose want it is). Re-seed.
  // 10: seeded `completedAt` history so the You tab's contribution is live. Re-seed.
  // 11: members gained `email` (Settings). Re-seed.
  // 12: the iPad collapsed to three tabs — IpadRoute lost home/tasks/shopping/
  //     calendar/insights/more/bills; a persisted stale route would render
  //     nothing. Re-seed.
  // 13: the middle tab is Calendar again ("ahead" is no longer a route) — a
  //     persisted "ahead" would leave the collapsed nav pill EMPTY. Re-seed.
  // 14: today is topped up to a floor (5 Maya / 5 Sam / 2 Leo / 2 Ada) so the
  //     demo never opens onto a thin day. Re-seed.
  // 15: every task has an owner now (Mow the lawn was the last unowned one).
  //     Re-seed.
  version: 15,
  // Discard-and-reseed IS our migration (no backend, demo data). Returning an
  // empty patch hands the store its fresh seed — and stops zustand logging
  // "couldn't be migrated" as a console error on every version bump.
  migrate: () => ({} as never),
  storage: createJSONStorage(() => localStorage),
  skipHydration: true,
  /**
   * DATA persists; the moment doesn't. A sheet half-open at save time reopening
   * a day later is a haunting, not a restore — same for toasts, the island,
   * search text and the onboarding draft. Persona and routes DO persist: reload
   * should put the phone back in the hand it was in.
   */
  partialize: (s) => ({
    members: s.members, tasks: s.tasks, shopping: s.shopping,
    inventory: s.inventory, maint: s.maint, events: s.events, automations: s.automations,
    activity: s.activity, unread: s.unread, reminders: s.reminders,
    householdName: s.householdName, axes: s.axes, setupComplete: s.setupComplete,
    persona: s.persona, phoneRoute: s.phoneRoute, ipadRoute: s.ipadRoute,
  }),
  onRehydrateStorage: () => (state) => {
    // The id counter is module state and resets to 1000 on every load, while
    // persisted tasks keep their old ids — the first task added after a reload
    // would collide with (and silently toggle) an existing one. Re-seat it past
    // everything on record.
    if (!state) return;
    const top = Math.max(999, ...state.tasks.map((t) => t.id),
      ...state.shopping.map((i) => Number(String(i.id).replace(/\D/g, "")) || 0));
    nextId = top;
    // MIGRATION: the short-lived "feed" merge is undone — a persisted route
    // naming a screen that no longer exists would render an empty body.
    if (!["today", "ahead", "house", "you"].includes(state.phoneRoute)) state.phoneRoute = "today";
  },
}));

/* ---------------- selectors ---------------- */

export const currentMember = (s: HouseholdState): MemberId => {
  // A persisted persona can outlive the member it names: rebuild the household
  // (onboarding mints name-derived ids) and yesterday's "maya" points at
  // nobody. Never hand back an id that isn't in members — every consumer
  // immediately dereferences it (me.name), and the shell dies on load.
  if (s.persona !== "ipad" && s.members[s.persona]) return s.persona;
  const owner = Object.values(s.members).find((m) => m.role === "owner") ?? Object.values(s.members)[0];
  return owner?.id ?? "";
};

/**
 * WHO IS DOING THIS — the only answer to that question anywhere in the app.
 *
 * `owner` is whose job it is; `coveredBy` is who's doing it while they can't.
 * Read `owner` directly ONLY to ask about precedent (see recall). Everything
 * else — load, "my tasks", the avatar on a card, the Balancer, stars — is
 * asking who's on the hook TODAY, and that's this.
 */
export const holder = (t: Assignable & { coveredBy?: MemberId; owner: MemberId | null }): MemberId | null =>
  t.coveredBy ?? t.owner;

/**
 * How much open work someone is carrying.
 *
 * This existed, and three surfaces re-implemented it inline anyway
 * (`tasks.filter(t => t.owner === id && !t.done).length`). That's how `coveredBy`
 * would have shipped broken: cover would have counted on the You tab and not on
 * the iPad, because the same idea was written in four places and only one of
 * them got the memo. One definition, four callers.
 */
export const pendingFor = (s: HouseholdState, id: MemberId) =>
  s.tasks.filter((t) => holder(t) === id && !t.done).length;

/** Open work someone OWNS but isn't doing — what a trip leaves behind. */
export const coveredFor = (s: HouseholdState, id: MemberId) =>
  s.tasks.filter((t) => t.owner === id && t.coveredBy && !t.done);

export interface Move { task: Task; from: Member; to: Member }

/**
 * WHAT THE BALANCER WOULD DO — decided, but not done.
 *
 * This logic used to live inside `rebalance()`, which meant the only way to find
 * out what "Even it out" would change was to let it change it. A button that
 * silently moves someone else's work and then reports it in a toast is asking
 * for trust it hasn't earned — you couldn't see the move before it happened, and
 * the toast is gone in three seconds.
 *
 * Splitting the decision from the commit lets the sheet show the exact move and
 * lets `rebalance()` stay the one place that applies it. Same answer both times,
 * because it's the same function.
 */
export function previewRebalance(s: HouseholdState): Move | null {
  const load = (id: MemberId) => pendingFor(s, id);
  const people = doers(s);
  const heavy = [...people].sort((a, b) => load(b.id) - load(a.id))[0];
  if (!heavy) return null;

  // Prefer shifting low-stakes work first.
  const movable = s.tasks
    .filter((t) => holder(t) === heavy.id && !t.done)
    .sort((a, b) => (a.priority === "high" ? 1 : 0) - (b.priority === "high" ? 1 : 0));

  for (const task of movable) {
    const takers = people
      .filter((m) => m.id !== heavy.id && canAssign(m, task))
      .sort((a, b) => load(a.id) - load(b.id));
    const to = takers[0];
    // Only worth moving if it actually evens things out.
    if (!to || load(heavy.id) - load(to.id) < 2) continue;
    return { task, from: heavy, to };
  }
  return null;
}

/** People who can be assigned work (everyone except pets). */
export const doers = (s: HouseholdState) =>
  Object.values(s.members).filter((m) => m.kind !== "pet");

/** The money among the tasks — a bill is a task with an amount on it. */
export const billTasks = (s: HouseholdState) =>
  s.tasks.filter((t) => typeof t.amount === "number");

/**
 * WHERE THE DAY COLLIDES — the Anticipator/Conflict Resolver made visible: the
 * two ways a plan is quietly broken before anyone flags it.
 *
 *   • away  — someone is AWAY today but still HOLDS work dated today (owned,
 *             undone, not yet covered). The work can't happen; resolve with
 *             `coverAway()`, the same engine the phone's "Find cover" uses.
 *   • clash — the same person has two TIMED things today whose start times fall
 *             within CLASH_MINS of each other. Nothing here has a duration, so
 *             "too close to do both" is the honest signal, not a hard overlap.
 *             There's no reschedule flow yet, so a task in the pair offers a
 *             reassign; otherwise it's a heads-up the app raised on its own.
 *
 * Household-wide — this is the shared iPad's lens. `for` a member scopes it to
 * the conflicts that person is actually in (the phone's lens).
 */
export interface Conflict {
  kind: "away" | "clash";
  key: string;
  who: MemberId;
  title: string;
  detail: string;
  /** A task that can be reassigned to relieve a clash, when the app can't fix it itself. */
  taskId?: number;
}

const CLASH_MINS = 45;

/** One timed thing on someone's day, carrying enough to resolve it later. */
export interface ClashItem {
  at: number;      // minutes into the day
  title: string;
  time: string;    // the clock label as shown ("9:40 AM")
  taskId?: number;
  eventId?: string;
}

/** Work someone still HOLDS that can't happen because they're away today. */
export const strandedByAway = (s: HouseholdState, memberId: MemberId): Task[] => {
  const m = s.members[memberId];
  if (!m || m.availability?.presence !== "away") return [];
  return s.tasks.filter((t) => t.owner === memberId && !t.done && !t.coveredBy && awayOn(m, t.due));
};

/** The first two of a person's today items that start too close to do both. */
export const clashPair = (s: HouseholdState, memberId: MemberId): [ClashItem, ClashItem] | null => {
  const timed: ClashItem[] = [
    ...s.tasks
      .filter((t) => holder(t) === memberId && !t.done && isToday(t.due) && timeMinutes(t.when) >= 0)
      .map((t) => ({ at: timeMinutes(t.when), title: t.title, time: t.when, taskId: t.id })),
    ...s.events
      .filter((e) => e.who === memberId && !e.done && isToday(e.due) && timeMinutes(e.time) >= 0)
      .map((e) => ({ at: timeMinutes(e.time), title: e.title, time: e.time, eventId: e.id })),
  ].sort((a, b) => a.at - b.at);
  for (let i = 1; i < timed.length; i++) {
    if (timed[i].at - timed[i - 1].at <= CLASH_MINS) return [timed[i - 1], timed[i]];
  }
  return null;
};

export const conflicts = (s: HouseholdState, forMember?: MemberId): Conflict[] => {
  const out: Conflict[] = [];
  const people = forMember ? doers(s).filter((m) => m.id === forMember) : doers(s);

  for (const m of people) {
    // AWAY — work dated within their away span that's still theirs to do.
    const stranded = strandedByAway(s, m.id);
    if (stranded.length) {
      out.push({
        kind: "away",
        key: `away-${m.id}`,
        who: m.id,
        title: `${m.name} is away today`,
        detail: `${stranded.length} ${stranded.length === 1 ? "task" : "tasks"} still on them — ${stranded.map((t) => t.title).join(", ")}`,
      });
    }

    // CLASH — two today items starting too close to do both.
    const pair = clashPair(s, m.id);
    if (pair) {
      const [a, b] = pair;
      out.push({
        kind: "clash",
        key: `clash-${m.id}`,
        who: m.id,
        title: `${m.name} is double-booked`,
        detail: `${a.title} and ${b.title}, ${b.at - a.at} min apart`,
        taskId: a.taskId ?? b.taskId,
      });
    }
  }
  return out;
};

/**
 * WHAT "FIND COVER" WOULD DO — decided, not done (the RebalanceSheet pattern).
 * Mirrors coverAway's ACCUMULATE exactly (each pick sees the prior ones), so the
 * confirmation sheet shows the very moves coverAway will apply. A task nobody can
 * take is simply absent from the list — the sheet counts those as still-stranded.
 */
export const previewCoverAway = (s: HouseholdState, memberId: MemberId): Move[] => {
  const m = s.members[memberId];
  if (!m || m.availability?.presence !== "away") return [];
  const moves: Move[] = [];
  const tasks = [...s.tasks];
  for (let i = 0; i < tasks.length; i++) {
    const t = tasks[i];
    if (t.owner !== memberId || t.done || t.coveredBy || !awayOn(m, t.due)) continue;
    const pick = suggestTaker({ ...s, tasks }, t);
    const to = pick ? s.members[pick.id] : undefined;
    if (!to) continue;
    tasks[i] = { ...t, coveredBy: to.id };
    moves.push({ task: t, from: m, to });
  }
  return moves;
};

/* ─────────────── automations: the rule, said out loud ─────────────── */

/** The trigger, mid-sentence — reads after "When …". */
export const autoWhenPhrase = (w: AutoWhen): string => {
  switch (w.kind) {
    case "low": return "something runs low";
    case "daily": return `every day at ${w.time}`;
    case "weekday": return `every ${w.day} at ${w.time}`;
    case "email": return "a billing email arrives";
    case "unclaimed": return "a task sits unclaimed for a day";
    case "dueSoon": return "a bill is three days out";
  }
};

/** The action as a short NAME — it becomes the rule's title. */
export const autoThenTitle = (t: AutoThen, members: Record<MemberId, Member>): string => {
  switch (t.kind) {
    case "shop": return "Add it to shopping";
    case "task": return `Create “${t.title.trim() || "a task"}”`;
    case "nudge": return `Nudge ${members[t.who]?.name ?? "someone"}`;
    case "rebalance": return "Even out the week";
    case "bill": return "File the bill in the feed";
  }
};

/** Compose a structured rule's display copy — one voice for every rule. */
const autoCopy = (when: AutoWhen, then: AutoThen, members: Record<MemberId, Member>) => ({
  title: autoThenTitle(then, members),
  description: `When ${autoWhenPhrase(when)}`,
});

/** Who money lands on: whoever claimed the "Bills" domain in their
 *  responsibilities; the owner failing that. Never a pet, never nobody. */
export const billOwner = (s: HouseholdState): MemberId | null =>
  doers(s).find((m) => m.responsibility?.domains.includes("Bills"))?.id
  ?? doers(s).find((m) => m.role === "owner")?.id
  ?? doers(s)[0]?.id ?? null;

/* ============================================================
   READING A NEW TASK — what the household already knows.

   A regex can read grammar (dates, times, names). It cannot read MEANING, and a
   keyword list pretending to is a treadmill: "alcohol" is covered, "vodka" is
   covered, "grab a bottle of red" never will be. Worse, a list is frozen — it
   learns nothing from the home it runs in.

   But this household is not a blank page. It has a memory:

     · every past task, its DOMAIN, and who actually held it
     · who is responsible for which domains and which spaces

   So before guessing, REMEMBER. "Water the plants" isn't a sentence to classify —
   it's a thing this house has done eleven times, always Leo, always minAge 5.
   That's not intelligence we hardcoded; it's intelligence they created by using
   the app, and it sharpens every week.

   Precedent also carries the SAFETY with it: matching a past task inherits its
   `requires`/`minAge`, so vetting done once is never re-guessed.
   ============================================================ */

/** Words that carry no signal — matching on "the" would make everything similar. */
const STOP = new Set([
  "the", "a", "an", "to", "of", "for", "and", "or", "my", "our", "your", "some",
  "please", "up", "on", "at", "in", "it", "this", "that", "with", "do", "get",
]);

const words = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w && !STOP.has(w));

/**
 * Shared significant words over the SHORTER phrase — so a terse "water plants"
 * still matches "Water the plants", without every two-word task matching
 * everything. Deliberately dumb and deliberately strict: it must fail closed.
 */
function similarity(a: string[], b: string[]): { score: number; hits: number } {
  if (!a.length || !b.length) return { score: 0, hits: 0 };
  const B = new Set(b);
  const hits = a.filter((w) => B.has(w)).length;
  return { score: hits / Math.min(a.length, b.length), hits };
}

export interface Recall {
  /** Everything the precedent knows, to fold into the new task. */
  source?: string;
  requires?: Role;
  minAge?: number;
  owner?: MemberId;
  /** Said to the user, in their household's own terms. */
  because: string;
}

/**
 * What does this household already know about a sentence like this?
 *
 * Two readings, strongest first:
 *   1. PRECEDENT — we have done this before. Inherit its domain, its vetting and
 *      its usual owner.
 *   2. RESPONSIBILITY — it names a domain or a space someone looks after.
 *
 * Returns null when it genuinely doesn't know, which is most of the time and is
 * the honest answer. The load-balancer is the fallback, not the first resort.
 */
export function recall(s: HouseholdState, text: string): Recall | null {
  const q = words(text);
  if (q.length < 2) return null; // one word is not a sentence

  /* ---- 1. have we done this before? ---- */
  let best: { t: Task; score: number } | null = null;
  for (const t of s.tasks) {
    const { score, hits } = similarity(q, words(t.title));
    // Two shared words minimum: one is a coincidence. "pick alcohol" shares
    // exactly "pick" with "Pick up the kids" — that must not be a match.
    if (hits < 2 || score < 0.67) continue;
    if (!best || score > best.score) best = { t, score };
  }

  if (best) {
    // Who actually holds it — count every instance, not just the one we matched.
    const family = s.tasks.filter((t) => t.source && t.source === best!.t.source);
    const tally = new Map<MemberId, number>();
    for (const t of family) if (t.owner) tally.set(t.owner, (tally.get(t.owner) ?? 0) + 1);
    const usual = [...tally.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? best.t.owner ?? undefined;

    return {
      source: best.t.source,
      requires: best.t.requires,
      minAge: best.t.minAge,
      owner: usual,
      because: usual
        ? `${s.members[usual]?.name} usually does this`
        : `Like “${best.t.title}”`,
    };
  }

  /* ---- 2. is it in someone's patch? ---- */
  for (const m of doers(s)) {
    const r = m.responsibility;
    if (!r) continue;
    const space = r.spaces.find((sp) => words(sp).some((w) => q.includes(w)));
    if (space) return { owner: m.id, because: `${m.name} looks after the ${space.toLowerCase()}` };
    const domain = r.domains.find((d) => words(d).some((w) => q.includes(w)));
    if (domain) return { owner: m.id, source: domain, because: `${m.name} looks after ${domain.toLowerCase()}` };
  }

  return null;
}

/* ============================================================
   Who should take this?

   A ranked suggestion built from what the household ACTUALLY knows — not a guess.
   Every signal here is real state, and the reason we show the user is the signal
   that actually decided it. If we can't justify a pick, we don't make one.
   ============================================================ */

export interface Suggestion {
  id: MemberId;
  /** The signal that decided it — shown to the user, in their words. */
  reason: string;
}

export function suggestTaker(s: HouseholdState, task: Task): Suggestion | null {
  // MONEY ROUTES BY RESPONSIBILITY, not by load. Whoever claimed the "Bills"
  // domain gets the bill — a light day doesn't qualify anyone to hold the
  // household's money. One rule, every caller: the composer's dock, addTask,
  // and the rebalancer all agree on where a bill goes.
  if (typeof task.amount === "number") {
    const banker = billOwner(s);
    const m = banker ? s.members[banker] : null;
    if (m && m.id !== holder(task)) return { id: m.id, reason: "runs the bills" };
    return null;
  }
  const able = doers(s).filter((m) => m.id !== holder(task) && canAssign(m, task));

  /**
   * UNVETTED WORK IS ONLY EVER OFFERED TO SOMEONE WHO CAN HOLD ANYTHING.
   *
   * A task with no `requires` and no `minAge` hasn't been assessed — it's a
   * sentence someone half-typed. `canAssign` clears everyone for it, and the
   * scorer then hands it to whoever is least busy. The least busy person in a
   * family is always the child, so EVERY unassessed task landed on Leo: "pick
   * alcohol", "pick up the kids" — a 10-year-old, because he had a light day.
   *
   * A role below `full` is the household stating this person does NOT hold
   * everything. Unvetted work could be anything. So the guess is only offered to
   * `full`/`owner` — the people who, by definition, can hold whatever it turns
   * out to be.
   *
   * This is about VOLUNTEERING, not ability. Once work IS assessed — an explicit
   * minAge Leo meets, a domain that's his — he's a candidate like anyone else,
   * which is exactly what keeps kids in the rota rather than exempt from it.
   *
   * If that leaves nobody, we say nothing rather than fall back to the guess we
   * just refused to make.
   */
  const vetted = task.requires !== undefined || task.minAge !== undefined;
  const roleOk = vetted ? able : able.filter((m) => ROLE_RANK[m.role] >= ROLE_RANK.full);

  /**
   * AWAY LEAVES THE SUGGESTION POOL — checked against the task's OWN due date,
   * not today. Someone away Thursday to Sunday is a fine owner for a Monday job.
   *
   * This narrows what we OFFER, not what's possible: canAssign is untouched, so
   * a human can still hand them the task and get a warning instead of a wall.
   */
  const eligible = roleOk.filter((m) => !awayOn(m, task.due));
  if (!eligible.length) return null;

  // One candidate isn't a suggestion, it's the only door. Saying "their day is
  // clear" here would dress up a constraint as a recommendation.
  if (eligible.length === 1) {
    return {
      id: eligible[0].id,
      // Name the CONSTRAINT, not the person. "The only grown-up free" was both
      // wrong (it's about access, not age) and faintly rude.
      /**
       * WARM, AND STILL TRUE.
       *
       * This went "The only one with full access who's free" -> "The only one
       * free who can take it" -> here. Both earlier lines led with the absence of
       * anyone else, which frames the person as what's left when the options run
       * out. Nobody wants to be handed a job by an app that opens with "well,
       * there's no one else".
       *
       * "The right hands for this" is not a dressed-up constraint: Sam genuinely
       * can hold it and is genuinely free, which is the whole of what the app
       * knows. That there was no rival candidate isn't a fact about Sam and
       * doesn't belong in a line about Sam — and the sheet already shows, in
       * place, why everyone else isn't offered.
       */
      reason: "The right hands for this",
    };
  }

  const load = (id: MemberId) => pendingFor(s, id);
  /** Events on their calendar today — a proxy for "their day is already full". */
  const busy = (id: MemberId) => s.events.filter((e) => e.who === id && isToday(e.due)).length;
  /** Already doing something from the same domain — they're in that mode already. */
  const inMode = (id: MemberId) =>
    !!task.source && s.tasks.some((t) => holder(t) === id && !t.done && t.source === task.source);

  const scored = eligible
    .map((m) => ({
      m,
      // Load dominates; a busy calendar nudges away; being in-mode pulls toward;
      // availability is what they actually TOLD us, so it outweighs the proxy.
      score: load(m.id) * 2 + busy(m.id) - (inMode(m.id) ? 3 : 0) + availabilityScore(m, task),
      load: load(m.id),
      busy: busy(m.id),
      inMode: inMode(m.id),
      wfh: m.availability?.presence === "wfh",
    }))
    .sort((a, b) => a.score - b.score || a.load - b.load);

  const best = scored[0];
  const runnerUp = scored[1];

  // If it's a coin toss, say so rather than inventing a rationale.
  if (runnerUp && Math.abs(best.score - runnerUp.score) < 0.5) {
    return { id: best.m.id, reason: "Either of them could take it" };
  }

  // The reason must name the signal that ACTUALLY decided it. "Home today" ranks
  // above load here because when it's what tipped the score, it's the true answer
  // — and it's the one a person would give.
  const reason =
    best.wfh ? "Home today"
    : best.inMode ? `Already on ${task.source?.toLowerCase()} today`
    : best.load === 0 ? "Nothing on their plate today"
    : runnerUp && best.load < runnerUp.load ? `Lightest load — ${best.load} ${best.load === 1 ? "task" : "tasks"}`
    : best.busy === 0 ? "Their day is clear"
    : "Evens out the week";

  return { id: best.m.id, reason };
}

export const shoppingList = (s: HouseholdState): ShopItem[] => {
  // ANY switched-on "runs low -> shopping" rule qualifies — the user can
  // delete the seed and build their own and the behaviour follows the RULE,
  // not a magic id.
  const autoOn = s.automations.some((a) => a.on && a.when?.kind === "low" && a.then?.kind === "shop");
  const list = [...s.shopping];
  if (!autoOn) return list;
  for (const inv of s.inventory) {
    if (inv.status !== "low") continue;
    if (list.some((x) => x.title.toLowerCase() === inv.title.toLowerCase())) continue;
    list.push({
      id: `auto-${inv.id}`,
      title: inv.title,
      category: inv.title === "Dog food" ? "Pet" : inv.location === "Under sink" ? "Supplies" : "Groceries",
      low: true, done: false, auto: true,
    });
  }
  return list;
};

export interface SearchHit {
  key: string;
  icon: "tasks" | "cart" | "bill" | "box" | "wrench" | "cal" | "user";
  title: string;
  meta: string;
  route: IpadRoute;
  taskId?: number;
}

/** Search everything — one query across every domain in the home. */
export const searchAll = (s: HouseholdState, raw: string): SearchHit[] => {
  const q = raw.trim().toLowerCase();
  if (!q) return [];
  const hits: SearchHit[] = [];

  s.tasks.forEach((t) => {
    if (!t.title.toLowerCase().includes(q)) return;
    // Who's DOING it — a search result naming the owner of work someone else
    // picked up would send you to the wrong person.
    const did = holder(t);
    const who = did ? s.members[did]?.name : "Unassigned";
    hits.push({
      key: `t${t.id}`, icon: "tasks", title: t.title,
      meta: `Task · ${who}${t.done ? " · done" : ""}`, route: "today", taskId: t.id,
    });
  });
  shoppingList(s).forEach((i) => {
    if (!i.title.toLowerCase().includes(q)) return;
    // The shopping list lives on Today now — a shopping hit lands there.
    hits.push({ key: `s${i.id}`, icon: "cart", title: i.title, meta: `Shopping · ${i.category}`, route: "today" });
  });
  s.inventory.forEach((i) => {
    if (!i.title.toLowerCase().includes(q)) return;
    hits.push({ key: `i${i.id}`, icon: "box", title: i.title, meta: `Inventory · ${i.location}`, route: "inventory" });
  });
  s.maint.forEach((m) => {
    if (!m.title.toLowerCase().includes(q)) return;
    hits.push({ key: `m${m.id}`, icon: "wrench", title: m.title, meta: `Maintenance · ${relative(m.due)}`, route: "maint" });
  });
  s.events.forEach((e) => {
    if (!e.title.toLowerCase().includes(q)) return;
    hits.push({ key: `e${e.id}`, icon: "cal", title: e.title, meta: `Calendar · ${e.time}`, route: "calendar" });
  });
  Object.values(s.members).forEach((m) => {
    if (!m.name.toLowerCase().includes(q)) return;
    hits.push({ key: `p${m.id}`, icon: "user", title: m.name, meta: `Person · ${pendingFor(s, m.id)} open tasks`, route: "household" });
  });
  return hits;
};

/** Dev handle. The store is module-scoped, so nothing outside the bundle can
 *  reach it — which makes "schedule a reminder 3 seconds out and watch the
 *  island" untestable from a console. Stripped from production by the guard. */
if (process.env.NODE_ENV !== "production" && typeof window !== "undefined") {
  (window as unknown as Record<string, unknown>).__homeboard = useHousehold;
}
