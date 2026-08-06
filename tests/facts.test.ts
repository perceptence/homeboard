/// <reference types="vite/client" />
import { describe, it, expect } from "vitest";
import { REPO } from "@/case-study/facts.generated";
import { AUDIT } from "@/case-study/audit";
import { tokenCounts } from "@/lib/tokens";
import { FEATURED, JOURNEYS } from "@/lib/journeys";
import { MODULES, PHASES, SCREEN_COUNT, SURFACES } from "@/case-study/product-scope";
import { IPAD_ROUTES, PHONE_ROUTES } from "@/lib/types";
import { SHEET_TYPES } from "@/lib/store";
// @ts-expect-error — plain .mjs helper, shared with scripts/facts.mjs
import { computeFacts } from "../scripts/repo-facts.mjs";

/**
 * SELF-ENFORCING HONESTY.
 *
 * Every number the case study prints is checked here against the thing it
 * describes. Stats on a portfolio page rot in silence — the code moves, the
 * figures don't, and nobody notices for a year. This makes that a red test
 * that names the figure which drifted.
 */

const fresh = computeFacts() as {
  commits: number; lines: number; components: number; uiComponents: number;
  sourceFiles: number; testFiles: number;
};

describe("the figures in “At a glance”", () => {
  it("count the lines of source that are actually there", () => {
    expect(
      REPO.lines,
      `facts.generated.ts says ${REPO.lines} lines, the repo has ${fresh.lines}. Run: npm run facts`,
    ).toBe(fresh.lines);
  });

  it("count the components that are actually exported", () => {
    expect(
      REPO.components,
      `facts.generated.ts says ${REPO.components} components, the repo has ${fresh.components}. Run: npm run facts`,
    ).toBe(fresh.components);
  });

  it("count the source files that were measured", () => {
    expect(REPO.sourceFiles).toBe(fresh.sourceFiles);
  });

  it("never overstate the commit count", () => {
    // A floor, not equality: the number only rises, and committing this very
    // test would otherwise make it fail on the commit that adds it.
    expect(
      REPO.commits,
      `the page claims ${REPO.commits} commits but HEAD is at ${fresh.commits}`,
    ).toBeLessThanOrEqual(fresh.commits);
  });
});

describe("the test-file count the page prints", () => {
  it("matches the number of test files in the suite", () => {
    /**
     * import.meta.glob resolves at build time and EXCLUDES the module doing the
     * importing — so this file has to add itself back. That off-by-one is the
     * entire reason this assertion is written the long way instead of trusting
     * a single number.
     */
    const others = Object.keys(import.meta.glob("./*.test.ts{,x}"));
    const total = others.length + 1; // + this file, which the glob leaves out

    expect(REPO.testFiles, `facts say ${REPO.testFiles} test files; glob sees ${total}`).toBe(total);
    // And the filesystem walk in repo-facts.mjs must agree with the bundler.
    expect(fresh.testFiles).toBe(total);
  });
});

describe("counts derived from modules need no pinning", () => {
  it("token counts are computed from the palette itself", () => {
    expect(tokenCounts.colorValues).toBeGreaterThan(0);
    expect(tokenCounts.type).toBeGreaterThan(0);
  });

  it("journey counts come from the journey table", () => {
    expect(JOURNEYS.length).toBeGreaterThan(0);
    expect(FEATURED.length).toBeGreaterThan(0);
    expect(FEATURED.length).toBeLessThanOrEqual(JOURNEYS.length);
  });
});

describe("the accessibility figures", () => {
  it("record the tool, ruleset, viewports and date that produced them", () => {
    expect(AUDIT.tool).toMatch(/axe/i);
    expect(AUDIT.ruleset).toMatch(/WCAG/);
    expect(AUDIT.viewports.length).toBeGreaterThanOrEqual(2);
    expect(AUDIT.date).toBeTruthy();
  });

  it("keep the page's own result separate from the embedded product's", () => {
    // One combined number would let the article hide behind the product, or
    // the product hide behind the article. Two numbers, always.
    expect(AUDIT.page.violations).toBe(0);
    expect(AUDIT.product.nodes).toBeGreaterThan(0);
  });

  it("names every failure it counts, rather than only totalling them", () => {
    // A count with no list is a number nobody can act on.
    expect(AUDIT.product.findings.length).toBeGreaterThan(0);
    for (const f of AUDIT.product.findings) {
      expect(f.what.length, "each finding says what it is").toBeGreaterThan(8);
      expect(f.ratio, "each finding states its measured ratio").toMatch(/\d(\.\d+)?:1/);
      expect(f.why.length, "each finding explains the cause").toBeGreaterThan(30);
    }
  });

  it("takes its headline numbers from the unflattering half of each viewport", () => {
    // Neither viewport is uniformly worse, so the published figures must be the
    // highest node count seen and the lowest ratio seen — never one viewport's
    // friendlier pair.
    const counts = AUDIT.product.byViewport.map((v) => v.nodes);
    const ratios = AUDIT.product.byViewport.map((v) => v.worst);
    expect(AUDIT.product.nodes).toBe(Math.max(...counts));
    expect(AUDIT.product.worst).toBe(Math.min(...ratios));
    expect(AUDIT.product.byViewport.length).toBe(AUDIT.viewports.length);
  });

  it("quotes a worst-case ratio that is actually the worst one listed", () => {
    // parseFloat, not Number(): these read "1.16:1" and "3.79 – 4.26:1", and
    // Number() returns NaN for both because of the trailing ":1".
    const listed = AUDIT.product.findings
      .map((f) => parseFloat(f.ratio))
      .filter((n) => !Number.isNaN(n));
    expect(AUDIT.product.worst).toBe(Math.min(...listed));
  });
});

/**
 * PRODUCT SCOPE — the figures that replaced the repository statistics.
 *
 * "At a glance" used to print commits, lines of TypeScript and test files.
 * True, measured, and the wrong subject: they size the effort of building
 * rather than describing what was built. These are the replacements, and they
 * are held to the same standard — derived from the thing they describe, never
 * asserted, so none can quietly stop being true.
 */
describe("the figures in “Product at a glance”", () => {
  it("counts the shared UI kit, not the whole repo", () => {
    expect(
      REPO.uiComponents,
      `facts say ${REPO.uiComponents} kit components, the repo has ${fresh.uiComponents}. Run: npm run facts`,
    ).toBe(fresh.uiComponents);
    // Narrower than `components` by construction: that figure includes this
    // page's own panels, which are article furniture, not product.
    expect(REPO.uiComponents).toBeLessThan(REPO.components);
  });

  it("counts screens from the route unions the shells actually switch on", () => {
    expect(SCREEN_COUNT).toBe(IPAD_ROUTES.length + PHONE_ROUTES.length);
  });

  it("places every screen the product can reach in a named module", () => {
    // The guard that matters: add a route and forget to place it, and this says
    // which one is homeless rather than letting the module count drift.
    const placed = new Set(MODULES.flatMap((m) => m.routes ?? []));
    const all = [...IPAD_ROUTES, ...PHONE_ROUTES];
    const homeless = all.filter((r) => !placed.has(r));
    expect(homeless, `routes in no module: ${homeless.join(", ")}`).toEqual([]);
  });

  it("places every sheet the product can open in a named module", () => {
    // Walked against SHEET_TYPES, the app's own union-as-a-value — NOT against
    // the sheets the journeys happen to open. The first version of this test
    // did the latter and passed while a sheet sat in no module at all, because
    // no featured journey opened that one.
    const placed = new Set<string>(MODULES.flatMap((m) => m.sheets ?? []));
    const homeless = SHEET_TYPES.filter((t) => !placed.has(t));
    expect(homeless, `sheets in no module: ${homeless.join(", ")}`).toEqual([]);
  });

  it("says something about every module and every phase", () => {
    // A count with nothing behind it is a claim. Each module names what it owns.
    expect(MODULES.length).toBeGreaterThan(0);
    for (const m of MODULES) {
      expect(m.name.length, `${m.name} needs a name`).toBeGreaterThan(2);
      expect(m.note.length, `${m.name} needs to say what it covers`).toBeGreaterThan(30);
      expect(
        (m.routes?.length ?? 0) + (m.sheets?.length ?? 0),
        `${m.name} anchors to no real screen`,
      ).toBeGreaterThan(0);
    }
    expect(PHASES.length).toBe(6);
    expect(SURFACES.length).toBe(2);
  });
});
