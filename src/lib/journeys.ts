/**
 * THE JOURNEYS — one table, three consumers.
 *
 * Every entry names a destination the real store can be driven to: a surface, a
 * route, optionally a sheet, optionally an extra action. Nothing here
 * re-implements navigation; it calls the same `setPersona` / `goPhone` /
 * `goIpad` / `openSheet` actions a tap would.
 *
 * Consumers:
 *   1. the preview page's Demo panel, which jumps the whole preview to a
 *      journey via `run()`;
 *   2. the case study's embed, which drives TWO devices at once and therefore
 *      cannot use `run()` — a phone journey that flipped the persona to "ipad"
 *      would yank the other device out from under the reader. It reads
 *      `surface` / `route` / `sheet` and applies only the parts that belong to
 *      the device it's steering;
 *   3. the test suite, which asserts the two can't drift apart.
 *
 * Which is why the destination is DECLARED and `run()` is derived from it,
 * rather than the route living inside a closure where only one consumer could
 * reach it. (It used to. Three entries had also quietly rotted: `home`,
 * `insights` and `bills` were passed to `goIpad` through an `as never` cast, so
 * TypeScript never checked them against IpadRoute. They weren't routes. The
 * shell's switch fell through to its default and rendered Today for all three.)
 */
import type { MemberId, IpadRoute, PhoneRoute } from "./types";
import { useHousehold } from "./store";

export interface Journey {
  /** Stable slug — the case study's ?screen= value. Never rename casually. */
  id: string;
  label: string;
  /** Which panel group it belongs to. */
  group: "Setup" | "Phone" | "Owner admin" | "Live trip" | "iPad";
  /** Which device the journey wants. */
  surface: "phone" | "ipad";
  /** Who to view as. The embed pins this so a cold load is deterministic. */
  persona: MemberId | "ipad";
  /** Where it lands — a PhoneRoute or an IpadRoute, per `surface`. */
  route: PhoneRoute | IpadRoute;
  /** A sheet to open on arrival. Absent means "close whatever was open". */
  sheet?: string;
  /**
   * Keep `persona` exactly as declared, instead of staying with whoever the
   * preview is currently viewing as. Owner-only screens and the live-trip pair
   * need a specific person for their controls to be live; an ordinary phone
   * screen is nicer to browse as whoever you're already being.
   */
  pinPersona?: boolean;
  /** Anything beyond routing — starting a trip, kicking off onboarding. */
  extra?: () => void;
  /** ONE line, for the case study's journey list. */
  blurb: string;
  /** Offered in the case study's embed. */
  featured?: boolean;
  /** Jump the WHOLE preview here: persona, surface, route and sheet together. */
  run: () => void;
}

type Spec = Omit<Journey, "run">;

const st = () => useHousehold.getState();

/**
 * Every jump must land IN THE SEED DEMO. Two ways the current state can be
 * somewhere else: a setup run is in progress (the app renders Onboarding
 * regardless of routes, so navigation happens underneath a flow that never
 * shows it), or a real onboarding run built a household of its own — whose
 * name-derived member ids don't include the maya/sam/leo these journeys
 * reference, so pointing the persona at them crashes the shell. Either way,
 * restore the seed home first.
 */
const home = () => {
  const s = st();
  if (!s.setupComplete || !s.members.maya) s.skipOnboarding();
  return st();
};

const memberOr = (fallback: MemberId): MemberId => {
  const p = st().persona;
  return p === "ipad" ? fallback : p;
};

/** The full jump — what the Demo panel wants. */
const runSpec = (j: Spec) => () => {
  const s = home();
  if (j.surface === "ipad") {
    s.setPersona("ipad");
    s.goIpad(j.route as IpadRoute);
  } else {
    const who = j.persona === "ipad" ? "maya" : (j.persona as MemberId);
    s.setPersona(j.pinPersona ? who : memberOr(who));
    s.goPhone(j.route as PhoneRoute);
  }
  if (j.sheet) s.openSheet({ type: j.sheet } as never);
  else s.closeSheet();
  j.extra?.();
};

const SPECS: Spec[] = [
  /* ── Setup ─────────────────────────────────────────────────────────── */
  {
    id: "onboarding-phone", label: "Onboarding · phone", group: "Setup",
    surface: "phone", persona: "maya", route: "today", pinPersona: true,
    extra: () => { st().startOnboarding(); st().setStep(0); },
    blurb: "Building a household from scratch, one question at a time.",
  },
  {
    id: "onboarding-ipad", label: "Onboarding · iPad", group: "Setup",
    surface: "ipad", persona: "ipad", route: "today",
    extra: () => { st().startOnboarding(); st().setStep(0); },
    blurb: "The same setup, laid out for the family screen.",
  },
  {
    id: "reset", label: "Reset to demo", group: "Setup",
    surface: "phone", persona: "maya", route: "today", pinPersona: true,
    // Always lands somewhere visibly different — persona, route and any open
    // sheet reset together — so this never looks like a no-op just because you
    // were already mid-demo.
    extra: () => { st().skipOnboarding(); st().notify("Demo reset"); },
    blurb: "Puts the seeded household back, from wherever you'd wandered.",
  },

  /* ── Phone ─────────────────────────────────────────────────────────── */
  {
    id: "today", label: "Today", group: "Phone", surface: "phone", persona: "maya",
    route: "today",
    blurb: "What's yours today, and the one thing that needs deciding first.",
  },
  {
    id: "ahead", label: "Ahead", group: "Phone", surface: "phone", persona: "maya",
    route: "ahead",
    blurb: "The week and the month, at whichever grain you're thinking in.",
  },
  {
    id: "house", label: "Household", group: "Phone", surface: "phone", persona: "maya",
    route: "house",
    blurb: "Everyone's load beside your own — the shared view on a personal phone.",
  },
  {
    id: "you", label: "You", group: "Phone", surface: "phone", persona: "maya",
    route: "you",
    blurb: "Your standing: what you've finished, what you're carrying.",
  },
  {
    id: "shopping", label: "The shared list", group: "Phone", surface: "phone", persona: "maya",
    route: "today", sheet: "shop",
    blurb: "The one list the whole house writes to.",
    featured: true,
  },
  {
    id: "stock", label: "In the house", group: "Phone", surface: "phone", persona: "maya",
    route: "today", sheet: "stock",
    blurb: "What's running low, before anyone has to notice.",
  },
  {
    id: "new-task", label: "Add something", group: "Phone", surface: "phone", persona: "maya",
    route: "today", sheet: "newTask",
    blurb: "Say it or type it; the app decides whether it's a task or an event.",
    featured: true,
  },
  {
    id: "handoff", label: "Hand something over", group: "Phone", surface: "phone",
    persona: "sam", route: "today", sheet: "handoff", pinPersona: true,
    blurb: "Too much on — give one of today's jobs to whoever has room.",
    featured: true,
  },
  {
    id: "activity", label: "Activity", group: "Phone", surface: "phone", persona: "maya",
    route: "you", sheet: "activity",
    blurb: "The household's short-term memory, grouped by when it happened.",
  },
  {
    id: "rebalance", label: "Even out the week", group: "Phone", surface: "phone", persona: "maya",
    route: "you", sheet: "rebalance",
    blurb: "One move to level the week — shown before it's made.",
    featured: true,
  },

  /* ── Owner admin ───────────────────────────────────────────────────── */
  {
    id: "settings", label: "Settings", group: "Owner admin", surface: "phone",
    persona: "maya", route: "you", sheet: "settings", pinPersona: true,
    blurb: "Your profile, your quiet hours, and the door to the household.",
  },
  {
    id: "manage", label: "Manage household", group: "Owner admin", surface: "phone",
    persona: "maya", route: "you", sheet: "manage", pinPersona: true,
    blurb: "People, access and automations — the one place roles change.",
  },
  {
    id: "add-person", label: "Add person", group: "Owner admin", surface: "phone",
    persona: "maya", route: "you", sheet: "addPerson", pinPersona: true,
    blurb: "Adding someone without guessing what they're allowed to do.",
  },
  {
    id: "add-automation", label: "New automation", group: "Owner admin", surface: "phone",
    persona: "maya", route: "you", sheet: "addAutomation", pinPersona: true,
    blurb: "A when/then rule in the household's own words.",
  },

  /* ── Live trip ─────────────────────────────────────────────────────── */
  {
    id: "on-my-way", label: "Leave for the school run", group: "Live trip", surface: "phone",
    persona: "sam", route: "today", pinPersona: true,
    extra: () => st().onWay(4),
    blurb: "Leaving for the school run, announced to whoever's waiting.",
    featured: true,
  },
  {
    id: "waiting", label: "Waiting · Leo", group: "Live trip", surface: "phone",
    persona: "leo", route: "today", pinPersona: true,
    blurb: "The same trip from the other end, on the phone being collected.",
  },

  /* ── iPad ──────────────────────────────────────────────────────────── */
  {
    id: "ipad-today", label: "Home", group: "iPad", surface: "ipad", persona: "ipad",
    route: "today",
    blurb: "The family board: the day, the people, and what's already handled.",
  },
  {
    id: "ipad-calendar", label: "Calendar", group: "iPad", surface: "ipad", persona: "ipad",
    route: "calendar",
    blurb: "Week and month for the whole house, in one grid.",
  },
  {
    id: "ipad-household", label: "Household", group: "iPad", surface: "ipad", persona: "ipad",
    route: "household",
    blurb: "Who's carrying what, and how the house has been doing since January.",
  },
  {
    id: "ipad-rebalance", label: "Even the house out", group: "iPad", surface: "ipad",
    persona: "ipad", route: "today", sheet: "rebalance",
    blurb: "The board proposes one move, and shows it before it makes it.",
    featured: true,
  },
  {
    id: "ipad-connect", label: "Connect a calendar", group: "iPad", surface: "ipad",
    persona: "ipad", route: "autos", sheet: "connectCalendar",
    blurb: "Pull an outside calendar in — events arrive badged with where they came from.",
    featured: true,
  },
  {
    id: "ipad-autos", label: "Automations", group: "iPad", surface: "ipad", persona: "ipad",
    route: "autos",
    blurb: "The rules quietly running in the background.",
    featured: true,
  },
  {
    id: "ipad-upkeep", label: "Upkeep", group: "iPad", surface: "ipad", persona: "ipad",
    route: "maint",
    blurb: "The boiler, the filters, the alarms — jobs a house asks for, not a person.",
    featured: true,
  },
];

export const JOURNEYS: Journey[] = SPECS.map((spec) => ({ ...spec, run: runSpec(spec) }));

/**
 * The subset the case study offers.
 *
 * Deliberately not "all of them". The phone side ran to nine, which read as an
 * index rather than a tour and buried the ones that carry an argument. What's
 * left is a handful per surface that each say something different. Everything
 * else is still in the table and still reachable from the demo panel.
 */
export const FEATURED = JOURNEYS.filter((j) => j.featured);

export const journeyById = (id: string | null | undefined) =>
  JOURNEYS.find((j) => j.id === id);

/**
 * What each surface's OWN nav already offers.
 *
 * These are the tabs drawn inside the device, a tap away on the screen itself —
 * so nothing that merely lands on one of them earns a control OUTSIDE the
 * device. The case study briefly shipped exactly that: pills reading "Home ·
 * Calendar · Household" sitting directly above an iPad whose own nav read the
 * same three words. Duplicated chrome, and it quietly redefined "journey" as
 * "tab". A journey is something a household DOES. A test walks FEATURED
 * against this list.
 */
export const TAB_ROUTES = {
  phone: ["today", "ahead", "house", "you"],
  ipad: ["today", "calendar", "household"],
} as const;

/** Panel order — the groups, in the order the Demo panel shows them. */
export const GROUPS = ["Setup", "Phone", "Owner admin", "Live trip", "iPad"] as const;
