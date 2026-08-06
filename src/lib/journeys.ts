/**
 * THE JOURNEYS — one table, three consumers.
 *
 * Every entry drives the real store the real app reads: set the persona, the
 * surface, the route and any open sheet in one call, and the product lands on
 * that screen. Nothing here re-implements navigation; it calls the same
 * `setPersona` / `goPhone` / `goIpad` / `openSheet` actions a tap would.
 *
 * Consumers:
 *   1. the preview page's Demo panel (grouped, all of them),
 *   2. the case study's live embed (the `featured` subset, each as ?screen=<id>),
 *   3. the test suite, which asserts the two can't drift apart.
 *
 * This used to live as closures inside the Demo panel component, where nothing
 * else could reach it — and where three entries had quietly rotted: `home`,
 * `insights` and `bills` were passed to `goIpad` through an `as never` cast,
 * so TypeScript never checked them against IpadRoute. They aren't routes. The
 * shell's switch fell through to its default and rendered Today for all three,
 * meaning two labelled journeys had been showing the wrong screen, silently,
 * for as long as the cast had been there. Typing this table is what makes that
 * impossible to repeat.
 */
import type { MemberId, IpadRoute, PhoneRoute } from "./types";
import { useHousehold } from "./store";

export interface Journey {
  /** Stable slug — the case study's ?screen= value. Never rename casually. */
  id: string;
  label: string;
  /** Which panel group it belongs to. */
  group: "Setup" | "Phone" | "Owner admin" | "Live trip" | "iPad";
  /** Which device the journey wants. The embed sizes its frame from this. */
  surface: "phone" | "ipad";
  /** Who the embed views as, so a cold load is deterministic. */
  persona: MemberId | "ipad";
  /** ONE line, for the case study's journey list. */
  blurb: string;
  /** Shown in the case study's embed picker. */
  featured?: boolean;
  run: () => void;
}

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

const memberOr = (fallback: MemberId = "maya"): MemberId => {
  const p = st().persona;
  return p === "ipad" ? fallback : p;
};

/** Land on a phone screen (as a member — falls back to the owner from the iPad). */
const phone = (route: PhoneRoute, sheet?: string) => () => {
  const s = home();
  s.setPersona(memberOr());
  s.goPhone(route);
  if (sheet) s.openSheet({ type: sheet } as never);
  else s.closeSheet();
};

/** Owner-only journeys always view as Maya so every control is live. */
const owner = (sheet: string) => () => {
  const s = home();
  s.setPersona("maya");
  s.goPhone("you");
  s.openSheet({ type: sheet } as never);
};

/** `route` is a real IpadRoute now — no cast, so a dead one won't compile. */
const ipad = (route: IpadRoute) => () => {
  const s = home();
  s.setPersona("ipad");
  s.goIpad(route);
  s.closeSheet();
};

export const JOURNEYS: Journey[] = [
  /* ── Setup ─────────────────────────────────────────────────────────── */
  {
    id: "onboarding-phone", label: "Onboarding · phone", group: "Setup",
    surface: "phone", persona: "maya",
    blurb: "Building a household from scratch, one question at a time.",
    featured: true,
    run: () => { const s = st(); s.setPersona("maya"); s.startOnboarding(); s.setStep(0); },
  },
  {
    id: "onboarding-ipad", label: "Onboarding · iPad", group: "Setup",
    surface: "ipad", persona: "ipad",
    blurb: "The same setup, laid out for the family screen.",
    run: () => { const s = st(); s.setPersona("ipad"); s.startOnboarding(); s.setStep(0); },
  },
  {
    id: "reset", label: "Reset to demo", group: "Setup",
    surface: "phone", persona: "maya",
    blurb: "Puts the seeded household back, from wherever you'd wandered.",
    // Always lands somewhere visibly different — persona, route, and any open
    // sheet all reset together — so this never looks like a no-op just because
    // you were already mid-demo.
    run: () => {
      const s = st();
      s.skipOnboarding(); s.setPersona("maya"); s.goPhone("today");
      s.closeSheet(); s.notify("Demo reset");
    },
  },

  /* ── Phone ─────────────────────────────────────────────────────────── */
  {
    id: "today", label: "Today", group: "Phone", surface: "phone", persona: "maya",
    blurb: "What's yours today, and the one thing that needs deciding first.",
    featured: true, run: phone("today"),
  },
  {
    id: "ahead", label: "Ahead", group: "Phone", surface: "phone", persona: "maya",
    blurb: "The week and the month, at whichever grain you're thinking in.",
    featured: true, run: phone("ahead"),
  },
  {
    id: "house", label: "Household", group: "Phone", surface: "phone", persona: "maya",
    blurb: "Everyone's load beside your own — the shared view on a personal phone.",
    featured: true, run: phone("house"),
  },
  {
    id: "you", label: "You", group: "Phone", surface: "phone", persona: "maya",
    blurb: "Your standing: what you've finished, what you're carrying.",
    featured: true, run: phone("you"),
  },
  {
    id: "shopping", label: "Shopping", group: "Phone", surface: "phone", persona: "maya",
    blurb: "The one list the whole house writes to.",
    featured: true, run: phone("today", "shop"),
  },
  {
    id: "stock", label: "In the house", group: "Phone", surface: "phone", persona: "maya",
    blurb: "What's running low, before anyone has to notice.",
    run: phone("today", "stock"),
  },
  {
    id: "new-task", label: "New task", group: "Phone", surface: "phone", persona: "maya",
    blurb: "Say it or type it; the app decides whether it's a task or an event.",
    featured: true, run: phone("today", "newTask"),
  },
  {
    id: "activity", label: "Activity", group: "Phone", surface: "phone", persona: "maya",
    blurb: "The household's short-term memory, grouped by when it happened.",
    run: phone("you", "activity"),
  },
  {
    id: "rebalance", label: "Rebalance", group: "Phone", surface: "phone", persona: "maya",
    blurb: "One move to level the week — shown before it's made.",
    featured: true, run: phone("you", "rebalance"),
  },

  /* ── Owner admin ───────────────────────────────────────────────────── */
  {
    id: "settings", label: "Settings", group: "Owner admin", surface: "phone", persona: "maya",
    blurb: "Your profile, your quiet hours, and the door to the household.",
    run: owner("settings"),
  },
  {
    id: "manage", label: "Manage household", group: "Owner admin", surface: "phone", persona: "maya",
    blurb: "People, access and automations — the one place roles change.",
    run: owner("manage"),
  },
  {
    id: "add-person", label: "Add person", group: "Owner admin", surface: "phone", persona: "maya",
    blurb: "Adding someone without guessing what they're allowed to do.",
    run: owner("addPerson"),
  },
  {
    id: "add-automation", label: "New automation", group: "Owner admin", surface: "phone", persona: "maya",
    blurb: "A when/then rule in the household's own words.",
    run: owner("addAutomation"),
  },

  /* ── Live trip ─────────────────────────────────────────────────────── */
  {
    id: "on-my-way", label: "On my way · Sam", group: "Live trip", surface: "phone", persona: "sam",
    blurb: "Leaving for the school run, announced to whoever's waiting.",
    featured: true,
    run: () => { const s = home(); s.setPersona("sam"); s.goPhone("today"); s.closeSheet(); s.onWay(4); },
  },
  {
    id: "waiting", label: "Waiting · Leo", group: "Live trip", surface: "phone", persona: "leo",
    blurb: "The same trip from the other end, on the phone being collected.",
    run: () => { const s = home(); s.setPersona("leo"); s.goPhone("today"); s.closeSheet(); },
  },

  /* ── iPad ──────────────────────────────────────────────────────────── */
  {
    id: "ipad-today", label: "Home", group: "iPad", surface: "ipad", persona: "ipad",
    blurb: "The family board: the day, the people, and what's already handled.",
    featured: true, run: ipad("today"),
  },
  {
    id: "ipad-calendar", label: "Calendar", group: "iPad", surface: "ipad", persona: "ipad",
    blurb: "Week and month for the whole house, in one grid.",
    featured: true, run: ipad("calendar"),
  },
  {
    id: "ipad-household", label: "Household", group: "iPad", surface: "ipad", persona: "ipad",
    blurb: "Who's carrying what, and how the house has been doing since January.",
    featured: true, run: ipad("household"),
  },
  {
    id: "ipad-autos", label: "Automations", group: "iPad", surface: "ipad", persona: "ipad",
    blurb: "The rules quietly running in the background.",
    run: ipad("autos"),
  },
];

/** The subset the case study offers as deep-linkable screens. */
export const FEATURED = JOURNEYS.filter((j) => j.featured);

export const journeyById = (id: string | null | undefined) =>
  JOURNEYS.find((j) => j.id === id);

/** Panel order — the groups, in the order the Demo panel shows them. */
export const GROUPS = ["Setup", "Phone", "Owner admin", "Live trip", "iPad"] as const;
