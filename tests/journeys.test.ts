import { describe, it, expect, beforeEach } from "vitest";
import { FEATURED, GROUPS, JOURNEYS, journeyById } from "@/lib/journeys";
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
