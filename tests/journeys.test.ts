import { describe, it, expect, beforeEach } from "vitest";
import { FEATURED, GROUPS, JOURNEYS, TAB_ROUTES, journeyById } from "@/lib/journeys";
import { useHousehold } from "@/lib/store";
import { IPAD_ROUTES, PHONE_ROUTES } from "@/lib/types";
import { DEFAULT_JOURNEY, SURFACE_GROUPS } from "@/case-study/Embed";
import { SCENE } from "@/case-study/Duet";
import { seedTasks } from "@/lib/seed";
import { todayIso } from "@/lib/dates";

/**
 * THE JOURNEY TABLE — the case study's deep links and the demo panel's buttons
 * are the same list, and this is what stops them drifting apart.
 *
 * The test that matters most is the last one. Three journeys used to point at
 * iPad routes that didn't exist; a cast hid it from TypeScript and the shell's
 * default case hid it from the eye, so two labelled screens quietly rendered
 * the wrong thing. Running each journey and checking where the store lands is
 * the check that would have caught it.
 */

beforeEach(() => {
  useHousehold.getState().skipOnboarding();
});

describe("the table itself", () => {
  it("has unique ids", () => {
    const ids = JOURNEYS.map((j) => j.id);
    expect(new Set(ids).size, `duplicate id in ${ids.join(", ")}`).toBe(ids.length);
  });

  it("gives every journey a one-line blurb for the case study", () => {
    for (const j of JOURNEYS) {
      expect(j.blurb.length, `${j.id} has no blurb`).toBeGreaterThan(10);
      // ONE line means one sentence — the list has a fixed row height.
      expect(j.blurb.length, `${j.id}'s blurb is too long for one line`).toBeLessThan(120);
    }
  });

  it("only uses groups the demo panel renders", () => {
    for (const j of JOURNEYS) {
      expect(GROUPS, `${j.id} is in group "${j.group}", which the panel never shows`).toContain(j.group);
    }
  });

  it("puts every group in the panel to use", () => {
    for (const g of GROUPS) {
      expect(JOURNEYS.some((j) => j.group === g), `group "${g}" has no journeys`).toBe(true);
    }
  });
});

describe("the case study's list can't drift from the table", () => {
  it("features only journeys that exist", () => {
    for (const j of FEATURED) {
      expect(journeyById(j.id), `featured journey ${j.id} is not in JOURNEYS`).toBeTruthy();
    }
  });

  it("never features a journey that is just a tab the app already offers", () => {
    /**
     * THE RULE: a journey is something a household DOES, not a place the app
     * can already take you. Both devices draw their own nav — Today/Ahead/
     * House/You on the phone, Today/Calendar/Household on the board — a tap
     * away on the screen itself. A control outside the device that merely
     * lands on one of those is duplicated chrome, and it quietly redefines
     * "journey" as "tab". The embed shipped exactly that mistake: pills
     * reading "Home · Calendar · Household" sitting directly above an iPad
     * whose own nav read the same three words.
     *
     * So every featured journey must EARN its control: open a sheet, run an
     * action, or land somewhere the tabs can't reach (a door like Upkeep or
     * Automations, which live under Household rather than in the nav).
     */
    for (const j of FEATURED) {
      const tabs = TAB_ROUTES[j.surface] as readonly string[];
      const isBareTab = tabs.includes(j.route) && !j.sheet && !j.extra;
      expect(
        isBareTab,
        `"${j.label}" only lands on the ${j.surface}'s own "${j.route}" tab — the device already offers that`,
      ).toBe(false);
    }
  });

  it("features at least one of each surface, so the embed shows both devices", () => {
    expect(FEATURED.some((j) => j.surface === "phone")).toBe(true);
    expect(FEATURED.some((j) => j.surface === "ipad")).toBe(true);
  });

  it("puts every featured journey inside a group the embed renders", () => {
    // The list is grouped by surface; a journey whose surface has no group
    // would simply vanish from the page without any error.
    const grouped = new Set(SURFACE_GROUPS.map((g) => g.surface));
    for (const j of FEATURED) {
      expect(grouped, `featured journey "${j.id}" has surface "${j.surface}", which no group renders`)
        .toContain(j.surface);
    }
  });

  it("gives every surface group at least one journey to show", () => {
    for (const g of SURFACE_GROUPS) {
      expect(
        FEATURED.some((j) => j.surface === g.surface),
        `surface group "${g.title}" would render empty`,
      ).toBe(true);
    }
  });

  it("opens on a journey that exists and isn't the onboarding flow", () => {
    const d = journeyById(DEFAULT_JOURNEY);
    expect(d, `default journey "${DEFAULT_JOURNEY}" is not in the table`).toBeTruthy();
    expect(d!.group, "the embed should not open a cold visitor into setup").not.toBe("Setup");
  });
});

describe("every journey lands on a route that exists", () => {
  for (const j of JOURNEYS) {
    // Onboarding deliberately takes over the shell, so route is not the subject.
    if (j.group === "Setup") continue;

    it(`${j.id} → a real ${j.surface} route`, () => {
      useHousehold.getState().setPersona(j.persona);
      j.run();
      const s = useHousehold.getState();

      if (j.surface === "ipad") {
        expect(
          IPAD_ROUTES as readonly string[],
          `${j.id} left ipadRoute = "${s.ipadRoute}", which no screen renders`,
        ).toContain(s.ipadRoute);
      } else {
        expect(
          PHONE_ROUTES as readonly string[],
          `${j.id} left phoneRoute = "${s.phoneRoute}"`,
        ).toContain(s.phoneRoute);
      }
    });
  }
});

describe("journeys are deterministic", () => {
  it("a journey lands the same way regardless of what preceded it", () => {
    const target = journeyById("ipad-household")!;

    useHousehold.getState().setPersona("leo");
    useHousehold.getState().goPhone("you");
    useHousehold.getState().setPersona(target.persona);
    target.run();
    const first = useHousehold.getState().ipadRoute;

    useHousehold.getState().setPersona("sam");
    useHousehold.getState().goPhone("ahead");
    useHousehold.getState().setPersona(target.persona);
    target.run();
    const second = useHousehold.getState().ipadRoute;

    expect(second).toBe(first);
  });
});

describe("the two-surface scene has real actors to find", () => {
  /**
   * The scene locates its target by walking the live DOM for a card titled
   * SCENE.taskTitle with a Done button, then click()s it. That only works if
   * the seed actually ships that task — open, owned by the persona whose phone
   * is on stage, and due today so it appears on both surfaces. If someone
   * renames the chore in the seed, this is the test that says so, instead of
   * the scene silently reporting "couldn't stage".
   */
  it(`seeds an open "${SCENE.taskTitle}" for ${SCENE.persona}, due today`, () => {
    const t = seedTasks.find((x) => x.title === SCENE.taskTitle);
    expect(t, `no seed task titled "${SCENE.taskTitle}"`).toBeTruthy();
    expect(t!.owner).toBe(SCENE.persona);
    expect(t!.done).toBe(false);
    expect(t!.due).toBe(todayIso());
  });
});

/**
 * ONE STORE, TWO DEVICES — and no wires between them.
 *
 * The app shows one surface at a time, so anything scoped to "the current
 * screen" could live in a single field and nobody would ever see the problem.
 * The case study runs both surfaces at once off this store, and there a shared
 * field is a wire: the phone navigated and the board replayed its entrance
 * animation; someone typed in the phone's search and the board filled with
 * results for it. Neither is a change the board can even read — it has no
 * persona, and it wasn't the thing being searched.
 *
 * So both are per-surface now, and this is what holds them apart.
 */
describe("what one surface does, the other doesn't feel", () => {
  beforeEach(() => {
    useHousehold.getState().skipOnboarding();
    useHousehold.setState({ navTick: { phone: 0, ipad: 0 }, query: { phone: "", ipad: "" } });
  });

  const tick = () => useHousehold.getState().navTick;
  const query = () => useHousehold.getState().query;

  it("replays only the phone's entrance when the phone navigates", () => {
    useHousehold.getState().goPhone("ahead");
    expect(tick(), "goPhone must not touch the board").toEqual({ phone: 1, ipad: 0 });
  });

  it("replays only the board's entrance when the board navigates", () => {
    useHousehold.getState().goIpad("calendar");
    expect(tick(), "goIpad must not touch the phone").toEqual({ phone: 0, ipad: 1 });
  });

  it("leaves the board alone when the phone changes who it is showing", () => {
    // The sharpest case: IpadShell reads no persona at all, so switching member
    // is a change the board is structurally incapable of reflecting.
    useHousehold.getState().setPersona("leo");
    expect(tick(), "setPersona is a phone concern").toEqual({ phone: 1, ipad: 0 });
  });

  it("rebuilds both when the household itself is replaced", () => {
    // The exception that proves the rule — a reset really is news everywhere.
    useHousehold.getState().skipOnboarding();
    expect(tick()).toEqual({ phone: 1, ipad: 1 });
  });

  it("keeps each surface's search to itself", () => {
    useHousehold.getState().setQuery("phone", "bill");
    expect(query()).toEqual({ phone: "bill", ipad: "" });

    useHousehold.getState().setQuery("ipad", "boiler");
    expect(query(), "two people can search two things at once").toEqual({
      phone: "bill", ipad: "boiler",
    });
  });

  it("clears only the searching surface's query on navigation", () => {
    useHousehold.setState({ query: { phone: "bill", ipad: "boiler" } });
    useHousehold.getState().goPhone("ahead");
    expect(query(), "the board was still reading its results").toEqual({
      phone: "", ipad: "boiler",
    });
    useHousehold.getState().goIpad("household");
    expect(query()).toEqual({ phone: "", ipad: "" });
  });
});

/**
 * A DEMO THAT OUTLIVES ITS OWN DAY.
 *
 * The seed is written relative to now — `d(0)` is today — and persistence then
 * freezes those dates. A household laid down on Monday still believed it was
 * Monday on Friday: nothing due today, everything overdue, the trend chart
 * stopping mid-week. Two people on the same build saw different products,
 * depending only on whether their browser had been here before.
 */
describe("the seeded day", () => {
  it("stamps the day the data was laid down", () => {
    useHousehold.getState().skipOnboarding();
    expect(useHousehold.getState().seededOn).toBe(todayIso());
  });

  it("seeds work that is actually due today", () => {
    useHousehold.getState().skipOnboarding();
    const due = useHousehold.getState().tasks.filter((t) => t.due === todayIso());
    expect(due.length, "a demo that opens on an empty day is the bug").toBeGreaterThan(0);
  });

  it("re-anchors a household that was stored on an earlier day", async () => {
    // The guard lives in onRehydrateStorage, so it only fires on a real
    // rehydration — which is why the three assertions above pass with it
    // switched off. This one drives the actual path: write a stored household
    // stamped nine days ago, rehydrate, and check what comes back.
    useHousehold.getState().skipOnboarding();
    const stale = JSON.parse(JSON.stringify({
      state: {
        ...useHousehold.getState(),
        seededOn: "2026-07-28",
        tasks: useHousehold.getState().tasks.map((t) => ({ ...t, due: "2026-07-28" })),
      },
      version: 21,
    }));
    localStorage.setItem("homeboard", JSON.stringify(stale));

    await useHousehold.persist.rehydrate();

    expect(useHousehold.getState().seededOn, "the stamp must move to today").toBe(todayIso());
    expect(
      useHousehold.getState().tasks.filter((t) => t.due === todayIso()).length,
      "a re-anchored demo opens on today, not on the day it was stored",
    ).toBeGreaterThan(0);
  });

  it("leaves a household stored on the SAME day alone", async () => {
    // The other half: re-seeding mid-visit would throw away whatever the
    // reader had just done, which is the failure this guard must not become.
    useHousehold.getState().skipOnboarding();
    const open = useHousehold.getState().tasks.find((t) => !t.done)!;
    useHousehold.getState().toggleTask(open.id);
    localStorage.setItem("homeboard", JSON.stringify({
      state: JSON.parse(JSON.stringify(useHousehold.getState())),
      version: 21,
    }));

    await useHousehold.persist.rehydrate();

    expect(
      useHousehold.getState().tasks.find((t) => t.id === open.id)?.done,
      "same-day rehydration wiped the visitor's work",
    ).toBe(true);
  });

  it("re-seeds relative to whenever it is called, not to module load", () => {
    // The guard is only worth anything if a later call produces a later demo.
    // If the seed were captured once and reused, re-anchoring would restore
    // exactly the stale dates it was trying to replace.
    useHousehold.getState().skipOnboarding();
    const first = useHousehold.getState().tasks.map((t) => t.due).join();
    useHousehold.setState({ seededOn: "2020-01-01" });
    useHousehold.getState().skipOnboarding();
    expect(useHousehold.getState().seededOn).toBe(todayIso());
    expect(useHousehold.getState().tasks.map((t) => t.due).join()).toBe(first);
  });
});
