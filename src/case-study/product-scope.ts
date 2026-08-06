import type { SheetType } from "@/lib/store";
import { IPAD_ROUTES, PHONE_ROUTES, type IpadRoute, type PhoneRoute } from "@/lib/types";

/**
 * THE SHAPE OF THE PRODUCT — what was designed, not what was typed.
 *
 * This replaced a row of repository statistics: commits, lines of TypeScript,
 * test files. Those numbers were true and they were also the wrong subject.
 * They describe the effort of building a thing, and nobody choosing a designer
 * needs the effort measured — they need to know what the thing IS: how many
 * complete paths a household can take through it, how many domains it covers,
 * how much of it is one system rather than many, and how much of the work was
 * mine.
 *
 * The honesty mechanism survives the change, though — that mattered more than
 * the metrics did. Every figure here is still derived rather than asserted:
 * journeys are counted from the journey table, screens from the route unions,
 * components from the filesystem. And each module below names the actual
 * screens and sheets it covers, typed against the app's own unions — so a
 * module CANNOT claim a screen the product doesn't have. The compiler rejects
 * it before a test gets the chance.
 */

export interface Module {
  name: string;
  /** One line: what this part of the product is responsible for. */
  note: string;
  /** Real routes, checked by the compiler against the app's own unions. */
  routes?: (IpadRoute | PhoneRoute)[];
  /** Real sheets, likewise — `SheetType` is the app's own union. */
  sheets?: SheetType[];
}

/**
 * The twelve domains, each anchored to the screens that implement it.
 *
 * A test asserts these cover EVERY sheet the product can open and every route
 * it can reach — so the list can't quietly fall behind the app. Add a sheet and
 * forget to place it, and the suite says which one is homeless.
 */
export const MODULES: Module[] = [
  {
    name: "The day",
    note: "What's on now and what's coming, per person and for the whole house.",
    routes: ["today", "ahead"],
    sheets: ["task", "event", "newTask"],
  },
  {
    name: "Calendar",
    note: "Week and month for everyone at once, with clashes caught before they land.",
    routes: ["calendar"],
    sheets: ["reschedule"],
  },
  {
    name: "Hand-off & cover",
    note: "Giving a job to someone with room, and covering for whoever's away.",
    sheets: ["assign", "handoff", "cover"],
  },
  {
    name: "Fair share",
    note: "The house watching its own balance, and proposing one move to level it.",
    sheets: ["rebalance"],
  },
  {
    name: "The shared list",
    note: "One list the whole household writes to, from any surface.",
    sheets: ["shop", "newShop"],
  },
  {
    name: "What's in the house",
    note: "Stock levels that notice they're running low before anyone does.",
    routes: ["inventory"],
    sheets: ["stock"],
  },
  {
    name: "Upkeep",
    note: "The boiler, the filters, the alarms — jobs a house asks for, not a person.",
    routes: ["maint"],
    sheets: ["maint"],
  },
  {
    name: "People & access",
    note: "Who lives here and what each person may do, on four independent axes.",
    routes: ["household", "house"],
    sheets: ["manage", "addPerson"],
  },
  {
    name: "Automations",
    note: "When/then rules in the household's own words, running quietly.",
    routes: ["autos"],
    sheets: ["addAutomation"],
  },
  {
    name: "Outside calendars",
    note: "Pulling an external calendar in, badged with where each event came from.",
    sheets: ["connectCalendar"],
  },
  {
    name: "Activity",
    note: "The household's short-term memory, so nothing changes without a trace.",
    sheets: ["activity"],
  },
  {
    name: "Settings & quiet hours",
    note: "The person, their hours, and the door into the household's own admin.",
    routes: ["settings", "you"],
    sheets: ["settings"],
  },
];

/**
 * The phases carried, start to finish.
 *
 * Listed rather than summarised because the claim IS the list: the same person
 * framed the problem, decided what the product refuses to do, drew it, built
 * the system, and shipped the running thing this page embeds.
 */
export const PHASES = [
  "Discovery",
  "Strategy",
  "UX",
  "Visual design",
  "Prototype",
  "Implementation",
] as const;

/** The two surfaces. Not one layout at two widths — see the section below. */
export const SURFACES = ["Family tablet", "Personal phone"] as const;

/** Every screen the product can be on, across both surfaces. */
export const SCREEN_COUNT = IPAD_ROUTES.length + PHONE_ROUTES.length;
