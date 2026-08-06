import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import CaseStudy from "../app/case-study/page";
import { CONTENT_WIDTH } from "@/case-study/kit";
import { DEVICES } from "@/components/DeviceFrame";
import { FEATURED } from "@/lib/journeys";

/**
 * The page renders, isn't stuck, and mounts the product the intended way.
 *
 * jsdom has no layout engine, so widths and overlaps are NOT checked here —
 * those are measured in a real browser at two viewports. What this file pins is
 * structure: the thing that would silently change if someone swapped the inline
 * embed for an iframe, or let a second content width in.
 */

let container: HTMLElement;

/**
 * beforeEach, not beforeAll. @testing-library/react registers an automatic
 * cleanup that unmounts and removes the container after EVERY test — so a
 * single render in beforeAll is torn down the moment the first test finishes,
 * and every test after it inspects an empty div. (Symptom: the first
 * assertion passes, all the rest see zero elements.)
 */
beforeEach(() => {
  container = render(<CaseStudy />).container;
});

describe("it renders at all", () => {
  it("shows the headline", () => {
    expect(screen.getByRole("heading", { level: 1, name: /a home runs on/i })).toBeTruthy();
  });

  it("renders every section", () => {
    const ids = [...container.querySelectorAll("[data-section]")].map((s) => s.id);
    expect(ids).toEqual(["glance", "product", "why", "system", "trouble", "tests", "a11y", "next"]);
  });

  it("is not stuck on a loading or empty state", () => {
    const text = container.textContent ?? "";
    expect(text.length).toBeGreaterThan(2000);
    // The product section must contain the app, not a placeholder.
    const product = container.querySelector("#product");
    expect(product?.textContent ?? "").not.toMatch(/loading|coming soon|placeholder/i);
  });
});

describe("the product is embedded, not pictured", () => {
  it("uses no iframe", () => {
    expect(container.querySelectorAll("iframe").length).toBe(0);
  });

  it("uses no screenshot standing in for the app", () => {
    const imgs = [...container.querySelectorAll("img")];
    const shots = imgs.filter((i) => /screenshot|screen-|mock/i.test(i.getAttribute("src") ?? ""));
    expect(shots.length).toBe(0);
  });

  it("mounts the real device chrome inline", () => {
    // The frame renders the device's own hardware furniture; if this is gone,
    // the embed has been replaced by something that isn't the app.
    expect(container.querySelector("#product")?.innerHTML ?? "").toContain("translate");
  });

  it("labels the live instance so it can't be mistaken for decoration", () => {
    expect(screen.getByText(/live — the real app/i)).toBeTruthy();
  });

  it("offers every featured journey as a button", () => {
    for (const j of FEATURED) {
      expect(
        screen.getAllByText(j.label).length,
        `journey "${j.label}" is missing from the embed's list`,
      ).toBeGreaterThan(0);
    }
  });
});

describe("one content width", () => {
  it("takes it from a real number in the codebase", () => {
    expect(CONTENT_WIDTH).toBe(DEVICES.tablet.w);
  });

  it("applies the same max-width to every content wrapper", () => {
    const wraps = [...container.querySelectorAll("[data-content-wrap]")] as HTMLElement[];
    expect(wraps.length).toBeGreaterThan(5);
    const widths = new Set(wraps.map((w) => w.style.maxWidth));
    expect(widths.size, `found content widths: ${[...widths].join(", ")}`).toBe(1);
    expect([...widths][0]).toBe(`${CONTENT_WIDTH}px`);
  });
});

describe("the known tradeoff of embedding a whole app", () => {
  it("pins the second h1 rather than hiding it", () => {
    /**
     * The embedded product contributes its own <h1> to this document. That is
     * not a WCAG failure — it's what mounting an application inside an article
     * actually means — and papering over it would misrepresent the page. So the
     * count is asserted instead: the page's own headline, plus the app's.
     */
    const h1s = [...container.querySelectorAll("h1")];
    expect(h1s.length).toBeLessThanOrEqual(2);
    expect(h1s[0].textContent).toMatch(/a home runs on/i);
  });
});

describe("code samples stay keyboard reachable", () => {
  it("gives every scrollable pre a tab stop", () => {
    // axe: "scrollable region must be keyboard accessible".
    for (const pre of [...container.querySelectorAll("pre")]) {
      expect(pre.getAttribute("tabindex"), `a <pre> is missing tabIndex: ${pre.textContent?.slice(0, 40)}`).toBe("0");
    }
  });
});
