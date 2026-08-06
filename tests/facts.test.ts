/// <reference types="vite/client" />
import { describe, it, expect } from "vitest";
import { REPO } from "@/case-study/facts.generated";
import { AUDIT } from "@/case-study/audit";
import { tokenCounts } from "@/lib/tokens";
import { FEATURED, JOURNEYS } from "@/lib/journeys";
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
  commits: number; lines: number; components: number; sourceFiles: number; testFiles: number;
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

  it("quotes a worst-case ratio that is actually the worst one listed", () => {
    // parseFloat, not Number(): these read "1.16:1" and "3.79 – 4.26:1", and
    // Number() returns NaN for both because of the trailing ":1".
    const listed = AUDIT.product.findings
      .map((f) => parseFloat(f.ratio))
      .filter((n) => !Number.isNaN(n));
    expect(AUDIT.product.worst).toBe(Math.min(...listed));
  });
});
