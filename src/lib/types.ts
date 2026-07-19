import type { IconName } from "@/components/Icons";

/** Homeboard — domain model.
 *  One household; many lenses. Every surface reads from these types.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE USER MODEL — four things that must never contaminate each other.
 *
 * "Mom", "Dad", "Kid", "Roommate" are RELATIONSHIPS. They describe how people
 * feel about each other. They are not a permission system, they are not a
 * capability model, and any app that treats them as one is wrong about real
 * homes: the teenager who runs the family budget, the grandparent who lives
 * with you and shouldn't be locked out, the au pair who needs the school run
 * but not the bank account, the adult child moving back in. None of them fit.
 *
 * So the model separates:
 *
 *   1. HOUSEHOLD TYPE  — how this home WORKS      (axes; a preset is a shortcut)
 *   2. IDENTITY        — who someone IS           (name, age, person or pet)
 *   3. ROLE            — what someone MAY DO      (never inferred from 1 or 2)
 *   4. RESPONSIBILITY  — what someone LOOKS AFTER (domains and spaces)
 *
 * The load-bearing rule: **ROLE IS ASSIGNED, NEVER DERIVED.** Age does not
 * grant authority and authority does not imply age. A 15-year-old can hold
 * `full`; a 40-year-old can be `guided` after an illness. The app must never
 * write `age < 18 ? "limited" : "full"` — that is the bug this model exists
 * to prevent.
 * ═══════════════════════════════════════════════════════════════════════════
 */

/** Open string — onboarding lets people create whoever actually lives in their home. */
export type MemberId = string;

/* ───────────────────────── 1. HOUSEHOLD TYPE ───────────────────────── */

/**
 * How this home works. The app branches on THESE — never on the preset — so a
 * household that matches no preset still works, and a household that outgrows
 * its preset (a couple has a baby; roommates start pooling) changes one axis
 * instead of migrating type.
 *
 * Only two axes survive scrutiny. `size` was a third in the sketch and is gone:
 * it's derivable from the member list, and storing what you can derive is a
 * drift bug waiting to happen.
 */
export interface HouseholdAxes {
  /** Pooled: a bill is just a bill. Split: every expense carries shares. */
  money: "pooled" | "split";
  /**
   * Does anyone here depend on someone else's decisions?
   *
   * NOT derivable from roles, despite appearances — it's what makes the guided
   * role OFFERABLE in the first place, so deriving it from "is anyone guided"
   * would be circular. A roommate house never sees guided surfaces, star
   * rewards, or the age gate on tasks.
   */
  dependents: boolean;
}

/** An onboarding shortcut that sets `axes` and suggests a starting cast.
 *  Nothing in the app may branch on this — see HouseholdAxes. */
export type HouseholdPreset = "family" | "couple" | "roommates" | "solo";

/* ─────────────────────── 2. IDENTITY ─────────────────────── */

/** WHAT someone is — a species, not a status. "adult" and "kid" used to live
 *  here and were doing three jobs at once: species, life stage, and permission. */
export type MemberKind = "person" | "pet";

/* ─────────────────────── 3. PERMISSION ROLE ─────────────────────── */

/**
 * What someone MAY do. Assigned by an owner; never inferred from age, never
 * inferred from a relationship.
 *
 *   owner    runs the household: settings, people, and other people's roles.
 *   full     everything except household settings. Money, contracts, anyone's work.
 *   limited  their own work and shared chores. No money, no settings, can't
 *            reassign other people. (Was "Teen" — but nothing about it is teenage.)
 *   guided   a simplified surface: only their own things, one at a time, with
 *            stars. (Was "Child" — but it fits anyone who wants less surface.)
 */
export type Role = "owner" | "full" | "limited" | "guided";

/** Authority order. The ONLY thing that may compare roles. */
export const ROLE_RANK: Record<Role, number> = { guided: 0, limited: 1, full: 2, owner: 3 };

/**
 * What each role is CALLED, to a family.
 *
 * "Owner / Full access / Limited / Guided" was an IAM console wearing a home
 * app's clothes. Nobody in a house says "I have full access" — and "Limited"
 * quietly told a fourteen-year-old the app thinks less of them, which is the
 * opposite of what the role model is for. These say what someone DOES.
 *
 * A noun phrase, not a sentence: it has to sit under "Your access" as a label
 * and next to a name on the iPad. For "Sam is now ___" use ROLE_SET; for what a
 * TASK needs, use ROLE_NEEDS. Three jobs, three tables — one string trying to do
 * all three is how "The only one with full access" ended up in a handoff.
 */
export const ROLE_LABEL: Record<Role, string> = {
  owner: "Runs the home",
  full: "Shares the running",
  limited: "Tasks and chores",
  guided: "A simpler view",
};

/**
 * The detail under the label. Says what the person can DO — never "child",
 * never "adult".
 *
 * Deliberately PRONOUN-FREE. These show on your own profile ("Your access") and
 * about other people (the iPad's household list), and no single pronoun is right
 * in both: "just their own things" was being read back to Ada about Ada.
 */
export const ROLE_HINT: Record<Role, string> = {
  owner: "Settings, people, and who can do what",
  full: "Everything except the household's own settings",
  limited: "No money, no settings, no changing anyone else's jobs",
  guided: "One task at a time — a star for finishing",
};

/** A verb phrase for "Sam now ___". The label is a noun and won't fit here:
 *  "Sam is now tasks and chores" is not a sentence. */
export const ROLE_SET: Record<Role, string> = {
  owner: "runs the home",
  full: "shares the running",
  limited: "does tasks and chores",
  guided: "sees a simpler view",
};

/**
 * The specific powers behind the label — the itemised answer to "so what can
 * they actually do", shown as a list under "Your access".
 *
 * CUMULATIVE by design: an owner can do everything a full member can and more,
 * so the top of each list is where a role goes BEYOND the one below it. That's
 * what makes "the owner has more" a thing you can see, not just be told.
 * Pronoun-free, like ROLE_HINT — it reads on your own profile and about others.
 */
export const ROLE_CAN: Record<Role, string[]> = {
  owner: [
    "Add or remove people, and set what each can do",
    "Change household settings and automations",
    "Assign, hand off, or rebalance any task",
    "Handle the shopping list and the bills",
  ],
  full: [
    "Assign, hand off, or rebalance any task",
    "Handle the shopping list and the bills",
    "Set up automations",
  ],
  limited: [
    "Take on tasks and chores that fit",
    "Add things to the shopping list",
  ],
  guided: [
    "Do one guided thing at a time",
    "Earn stars for finishing",
  ],
};

/**
 * What the WORK needs — never what the person is.
 *
 * A role is a fact about a person, so it has no business being the reason a task
 * is out of reach: "Needs full access" describes the wrong noun. `requires:
 * "full"` in practice means money, contracts, alcohol, prescriptions, bleach,
 * the boiler, a chainsaw, driving (see NEEDS_FULL in parse.ts) — that's not
 * ACCESS, it's ACCOUNTABILITY. So say the work.
 */
export const ROLE_NEEDS: Record<Role, string> = {
  guided: "",
  limited: "a shared chore",
  full: "money, contracts or safety",
  owner: "running the home",
};

/* ─────────────────────── 4. RESPONSIBILITY ─────────────────────── */

/**
 * Responsibility is TWO independent questions, and collapsing them loses real
 * households: "Sam does the cooking" (what) and "Leo keeps his room" (where)
 * are not the same shape of promise.
 */
export interface Responsibility {
  /** WHAT — a domain of home life: "Meals", "Bills", "Laundry". */
  domains: string[];
  /** WHERE — a space: "Kitchen", "Garden", "Leo's room". */
  spaces: string[];
}

/* ─────────────────────── 5. AVAILABILITY ─────────────────────── */

/**
 * WHERE someone is. A fact about their life — never a permission.
 *
 * `suggestTaker` used to infer "busy" from `events.filter(isToday)`, a proxy that
 * rates a dentist appointment the same as a week in Spain. This replaces the
 * guess with something the person actually told us.
 *
 *   here   the default. No effect.
 *   wfh    at home all day — a POSITIVE. They can take the delivery and put the
 *          laundry on. Every other app treats availability as "don't bother me";
 *          working from home makes you MORE useful for home work, not less.
 *   out    gone for the day, back tonight — daytime work skips them, evenings don't.
 *   away   gone for days. Nothing new lands within the span.
 *
 * "Working today" isn't here: everyone is working today. It's `here` with extra
 * words.
 */
export type Presence = "here" | "wfh" | "out" | "away";

export interface Availability {
  presence: Presence;
  /** The span `away` covers, ISO. Only `away` needs one — the rest are about today. */
  from?: string;
  to?: string;
  /**
   * Don't nudge me between these. "HH:MM", local, and it may wrap past midnight
   * (22:00 → 07:00).
   *
   * NOTHING CONSUMES THIS YET beyond the reminder copy — the app has no push
   * notifications, only toasts, and a toast is feedback for your own tap, which
   * must never be silenced. It's modelled now because reminders are coming and
   * the household's answer ("don't wake the kids") shouldn't wait for them.
   */
  quiet?: { from: string; to: string };
}

/* ─────────────────────── the member ─────────────────────── */

export interface Member {
  /* identity */
  id: MemberId;
  name: string;
  /** How the household reaches them — the one bit of contact info the app keeps.
   *  Optional: a young kid on a shared device may have none. Edited in Settings. */
  email?: string;
  kind: MemberKind;
  /** A custom profile picture, as a (downscaled) data URL. When set, it replaces
   *  the illustrated face everywhere. Set from Settings; absent by default. */
  photo?: string;
  /** Emailed an invite but hasn't accepted yet — shown as "Pending". */
  invited?: boolean;
  /** Real, and only ever used as a CAPABILITY gate against a task's minAge —
   *  never as a permission. Optional: plenty of adults won't type it in. */
  age?: number;
  /** CSS colour token for this person — used for bars, event chips, and the pet chip. */
  color: string;

  /* permission — independent of everything above */
  role: Role;

  /* responsibility */
  responsibility?: Responsibility;

  /** Where they are. A SIGNAL for the Balancer — never a gate. See canAssign. */
  availability?: Availability;

  /** Earned on the guided surface, where the reward loop lives. Follows the
   *  ROLE, not an age: whoever is guided collects stars. */
  stars?: number;
}

/** A person being created during onboarding, before they become a Member. */
export interface DraftPerson {
  id: string;
  name: string;
  kind: MemberKind;
  /** Chosen explicitly in onboarding. Never defaulted from an age. */
  role: Role;
  age?: number;
}

export interface OnboardingDraft {
  step: number;
  householdName: string;
  preset: HouseholdPreset;
  axes: HouseholdAxes;
  people: DraftPerson[];
  /** Which parts of home life this household wants run for them. */
  domains: string[];
}

export type Priority = "low" | "med" | "high";

export interface Task {
  id: number;
  title: string;
  /** null = unassigned; the Balancer may suggest an owner. */
  owner: MemberId | null;
  suggest?: MemberId;
  /** TIME OF DAY only ("Tonight", "6:30 PM") — never the date. The date is `due`,
      and the two sitting side by side on a card must not contradict each other. */
  when: string;
  /** The date it's due — ISO YYYY-MM-DD. The single source of truth for
      sorting, grouping and the date badge. */
  due: string;
  done: boolean;
  /**
   * WHEN it was finished, epoch ms — stamped by toggleTask, cleared on undo.
   * Without this the app cannot answer "how did this week go": the progress
   * card was counting every task ever completed as "today", and its
   * Weekly/Monthly toggle animated while changing nothing.
   */
  completedAt?: number;
  priority: Priority;
  recurring?: string;
  /** Where this task came from — the domain that raised it. Shown as the card eyebrow. */
  source?: string;
  /**
   * VERBATIM — exactly what the person typed or said, before we read it.
   *
   * The title is cleaned up ("Leo water plants tonight" -> "Water plants") because
   * a list of raw utterances is a mess to scan. But cleaning is interpretation,
   * and interpretation must be auditable: if the app decides "tonight" was a date
   * rather than part of the name, the person has to be able to see what they
   * actually said and judge for themselves. Kept only when it differs from the
   * title — storing an identical copy says nothing.
   */
  said?: string;

  /* --- Who may hold this work. Suitability is a property of the TASK, so every
     path that assigns (onboarding, the Balancer, manual assign) respects it.
     Two gates, because they are two different questions. --- */
  /**
   * AUTHORITY: the minimum role. Money, contracts, anything the household holds
   * someone accountable for.
   *
   * This replaced `adultOnly`, which asked the wrong question. "Adult" bundled
   * age with authority and got both wrong: it locked out the 16-year-old the
   * family trusts with the shopping card, and let in any adult houseguest.
   * `requires: "full"` says the true thing — this needs someone with authority,
   * whoever that is.
   */
  requires?: Role;
  /**
   * CAPABILITY: minimum age. Sharp, hot, heavy, or simply too big to carry.
   * Orthogonal to `requires` — being trusted doesn't make you tall enough.
   */
  minAge?: number;

  /**
   * A JOURNEY task — you GO somewhere to do it (a pickup, an appointment run).
   * Journeys get a heading and, when driven, a map. "Pick up the kids" IS a
   * task — it just also happens somewhere else.
   */
  journey?: boolean;
  /** WHERE the journey goes ("School"). Only meaningful with `journey`. */
  where?: string;
  /**
   * WHO IS AT THE FAR END — the audience for "On my way". An announcement
   * needs someone to hear it: the kids waiting at school get the notification
   * and the live trip; a parcel locker does not care that you're coming. No
   * `waiting` → no "On my way" — the journey is still a journey, it's just
   * nobody's news.
   */
  waiting?: MemberId[];
  /** Explicit glyph override. Most tasks derive theirs from title/source. */
  icon?: IconName;

  /**
   * Someone doing this ONCE, because `owner` can't. Cover, not a transfer.
   *
   * ── Why this is a field and not just `owner = sam` ──────────────────────
   * The obvious implementation of "Sam covers Maya's week away" is to reassign
   * the tasks. It's wrong, and quietly so: `recall()` learns precedent by
   * tallying `owner` across every task sharing a `source`. Reassign five Meals
   * tasks for one trip and the household's memory now says *Sam* usually cooks
   * — permanently, because nothing restores it when Maya lands. A week away
   * would rewrite a standing agreement, and the app would keep acting on the
   * lie long after.
   *
   * So `owner` stays TRUE (whose job this is) and `coveredBy` carries the
   * temporary fact (who's actually doing it). The split is what lets cover
   * expire without an undo step: clear one field and the truth is still there.
   *
   * ── The rule ───────────────────────────────────────────────────────────
   * Anything asking "who is doing this?" reads `holder()`. Only precedent —
   * who this work BELONGS to — reads `owner`. Getting these backwards is the
   * bug this field exists to make thinkable.
   */
  coveredBy?: MemberId;
}

export type ShopCategory = "Groceries" | "Supplies" | "Pet";

export interface ShopItem {
  id: string;
  title: string;
  category: ShopCategory;
  /** Surfaced because inventory ran low (may be auto-added). */
  low: boolean;
  done: boolean;
  note?: string;
  auto?: boolean;
  /**
   * WHO ASKED. The list is the household's one truly shared surface, and a
   * want has a wanter: the house's own asks already say "Running low"; a
   * person's ask shows their face. Absent on auto/low items (the house asked)
   * and on iPad-added ones (nobody specific was holding the pen).
   */
  by?: MemberId;
  /**
   * CAPABILITY gate, same field and same meaning as a Task's: the checkout will
   * refuse this to a minor (alcohol, medicines), so the app shouldn't pretend
   * otherwise. Gates CHECKING OFF only — anyone may ADD to the list; asking for
   * a thing and buying it are different acts.
   */
  minAge?: number;
}

export type BillStatus = "due" | "upcoming" | "scheduled" | "paid";
export interface Bill {
  id: string;
  title: string;
  amount: number;
  due: string;
  status: BillStatus;
}

export type StockStatus = "low" | "ok" | "expiring";
export interface InventoryItem {
  id: string;
  title: string;
  location: string;
  quantity: string;
  status: StockStatus;
}

export type MaintStatus = "over" | "due" | "season" | "up";
export interface MaintItem {
  id: string;
  title: string;
  asset: string;
  /** ISO YYYY-MM-DD. `status` and the "when" text both derive from this. */
  due: string;
  status: MaintStatus;
  cadence: string;
}

export interface HouseEvent {
  id: string;
  /** ISO YYYY-MM-DD — same field, same meaning, as a Task's. */
  due: string;
  title: string;
  time: string;
  who: MemberId;
  /** How often it recurs — shown with the repeat glyph, same as a task. */
  recurring?: string;
  /** Handled. An event is a show-up thing, not a checkbox — but a reminder's
   *  "Done" needs somewhere to land, so marking one done records that it was
   *  dealt with and mutes the card. */
  done?: boolean;

  /**
   * A JOURNEY, not a thing-at-home. Picking up the kids, a dentist run, the
   * weekly shop — you GO somewhere. Trash night and WFH don't; they're done
   * where you already are.
   */
  journey?: boolean;
  /** WHERE a journey goes — the destination on the live trip ("School"). Only
   *  meaningful with `journey`. Origin is always home. */
  where?: string;
  /** WHO IS AT THE FAR END — the audience for "On my way" (see Task.waiting).
   *  Padel with a friend is a journey, but the friend isn't in the household:
   *  nobody to notify, so no announcement. */
  waiting?: MemberId[];
  /** The glyph that STANDS FOR this event on the island. The notification lands
   *  on the person who's tasked, so their own avatar tells them nothing — an
   *  icon for the thing (trash, a child, a plant) does. Falls back to a bell. */
  icon?: IconName;
}

export interface Automation {
  id: string;
  title: string;
  description: string;
  on: boolean;
}

/**
 * A promise to speak up later. This is the app's whole notification layer —
 * there's no backend, so "push" means: the store keeps the promise, a 1s ticker
 * checks it, and the Dynamic Island delivers it.
 *
 * QUIET HOURS FINALLY HAVE A CONSUMER. A reminder that comes due inside the
 * member's quiet window is HELD — rescheduled to the window's end — and says so
 * when it lands. That's the contract the Availability card has been promising
 * ("No reminders 11:00 PM – 7:00 AM") since the field was modelled.
 */
export interface Reminder {
  id: number;
  /** When to fire, epoch ms. */
  at: number;
  /** The full sentence, for the activity log. */
  text: string;
  /** The thing itself, for the island ("Pick up the kids"). Falls back to text. */
  title?: string;
  /** How the person hears the event's time said aloud ("8:00 PM") — shown
   *  beside the countdown. NOT derived from targetAt; the two serve different
   *  jobs (see targetAt) and a bare 5-minute countdown is not what time it is. */
  timeLabel?: string;
  /** What the island counts down to. Five minutes out from the moment the
   *  reminder was SET — see remindForEvent for why it isn't the real event
   *  clock time. */
  targetAt?: number;
  /** Whose reminder it is — whose quiet hours apply, whose phone it lands on. */
  who: MemberId;
  /** It came due during quiet hours and was pushed past them. */
  held?: boolean;
  /** The event this reminds about — lets the island's actions (open, done, on my
   *  way) reach the real thing, not just a copy of its text. */
  eventId?: string;
  /** …or the task, when the thing being reminded about is a Task. One of the
   *  two, never both. */
  taskId?: number;
  /** Snapshotted from the source so the island is self-contained: which glyph
   *  to show, whether this is a journey, where it goes, and who's at the far
   *  end (no `waiting` → the island offers no "On my way"). */
  icon?: IconName;
  journey?: boolean;
  where?: string;
  waiting?: MemberId[];
}

/**
 * What the Dynamic Island is tracking. One at a time — it's a mouth, not a
 * queue; the activity feed is the queue.
 *
 * A LIVE ACTIVITY, not a message: it has two states and a clock.
 *   expanded  — edge to edge under the bezel: the thing, its time, a countdown.
 *   collapsed — status-bar height, still naming the thing, still counting.
 * Tapping moves between them; only a countdown that has ARRIVED dismisses on
 * tap, because until then the island still has something true to say.
 */
export interface IslandNote {
  title: string;
  /** "3:15 PM" — the moment it's about, as a person says it. */
  timeLabel?: string;
  /** Countdown target, epoch ms. Absent → plain notification, no clock. */
  targetAt?: number;
  who: MemberId | null;
  held?: boolean;
  mode: "expanded" | "collapsed";
  /** The event behind it, for the action buttons. */
  eventId?: string;
  /** …or the task behind it — journeys and reminders work for both. */
  taskId?: number;
  /** The glyph for the thing — an icon in place of the tasked person's avatar. */
  icon?: IconName;
  /** This reminder is for a journey (heading, map on departure). */
  journey?: boolean;
  /**
   * WHO'S AT THE FAR END. Dual duty, one meaning — the people the trip is FOR:
   *   reminder phase — non-empty `waiting` is what earns the "On my way" button.
   *   journey phase  — these are the AUDIENCE: the live trip renders on THEIR
   *                    phones (the kids watch Dad come), not the traveler's —
   *                    the traveler is in Maps, driving.
   */
  waiting?: MemberId[];

  /**
   * WHAT KIND of live activity this is.
   *   reminder — the default: a thing coming up, with a countdown.
   *   journey  — someone said "On my way": a live trip, origin → destination,
   *              ticking down an ETA the way Uber/DoorDash do, shown to the
   *              people in `waiting`.
   */
  phase?: "reminder" | "journey";
  /** Journey only. Destination name; the trip's start and its arrival ETA (epoch
   *  ms) — together they drive the live progress bar and the "8 min" readout. */
  where?: string;
  startAt?: number;
  etaAt?: number;
}

export interface ActivityEntry {
  text: string;
  at: number;
  /**
   * Whose doing it was. Without this the feed can only be the HOUSEHOLD's — which
   * is right on the shared iPad and wrong on a phone, where "Recent activity" was
   * showing Maya paying a bill on Leo's own profile.
   *
   * Optional: some events are the house's, not a person's (a bill got paid, a
   * rebalance ran). Those belong to everyone and are filtered out of "yours".
   */
  who?: MemberId;
}

/** Which lens we're looking through. "ipad" = the shared family/owner superset. */
export type Persona = "ipad" | MemberId;
export type IpadRoute =
  | "home" | "tasks" | "shopping" | "calendar" | "household" | "insights"
  | "more" | "bills" | "inventory" | "maint" | "autos" | "settings";
/**
 * The phone has THREE tabs, on one axis: now -> later -> me.
 * today = what's on right now · ahead = the week/month/quarter · you = the person.
 */
export type PhoneRoute = "today" | "ahead" | "you";
