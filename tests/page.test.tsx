import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import CaseStudy from "../app/case-study/page";
import { CONTENT_WIDTH } from "@/case-study/kit";
import { DEVICES } from "@/components/DeviceFrame";
import { FEATURED, JOURNEYS } from "@/lib/journeys";
import { REPO } from "@/case-study/facts.generated";
import { MODULES, PHASES, SCREEN_COUNT } from "@/case-study/product-scope";
import { SURFACE_GROUPS } from "@/case-study/Embed";

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

  it("mounts BOTH devices at once, not one at a time", () => {
    // The section's argument is that the iPad is a different application, not
    // a width — which only lands if both are genuinely running side by side.
    const product = container.querySelector("#product")!;
    // Assert against the titles the component actually declares, rather than
    // repeating them here — this test broke on a copy edit once, which proved
    // it was checking the wording and not the thing the wording is about.
    for (const g of SURFACE_GROUPS) {
      expect(product.textContent, `${g.surface} is never named`).toContain(g.title);
    }
    const frames = product.querySelectorAll('[style*="translate"]');
    expect(frames.length, "expected a tablet frame and a phone frame").toBeGreaterThanOrEqual(2);
  });

  it("gives each device its own controls", () => {
    // Every featured journey must be offered, and the two surfaces' journeys
    // must be reachable independently — one shared list would mean picking a
    // board screen could only be done by giving up the phone's.
    const product = container.querySelector("#product")!;
    const labels = [...product.querySelectorAll("button")].map((b) => b.textContent?.trim());
    for (const j of FEATURED) {
      expect(labels, `journey "${j.label}" is missing from the embed`).toContain(j.label);
    }
    expect(FEATURED.filter((j) => j.surface === "phone").length).toBeGreaterThan(0);
    expect(FEATURED.filter((j) => j.surface === "ipad").length).toBeGreaterThan(0);
  });

  it("renders the shared sheet layer in only one device at a time", () => {
    // The store holds ONE open sheet; rendering <Sheets> in both frames would
    // paint the same composer inside two devices at once.
    const product = container.querySelector("#product")!;
    const overlays = product.querySelectorAll("[data-sheet-host]");
    expect(overlays.length, "exactly one device may own the sheet layer").toBe(1);
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

describe("the known tradeoff of embedding whole applications", () => {
  it("pins the extra h1s rather than hiding them", () => {
    /**
     * The mounted iPad shell greets the room, and that greeting is its page
     * title — so it contributes an <h1> to this document. The ceiling is two:
     * this page's headline, and the board's.
     *
     * Multiple h1s are valid HTML5 and axe reports no violation for them. The
     * count is asserted rather than suppressed because the honest thing is to
     * know the number, not to hide it — and if it ever climbs past three,
     * something has been mounted that nobody meant to mount.
     */
    const h1s = [...container.querySelectorAll("h1")];
    expect(h1s.length, h1s.map((h) => h.textContent?.slice(0, 24)).join(" | ")).toBeLessThanOrEqual(2);
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

/**
 * THE FIGURES SURVIVE WITHOUT THE ANIMATION.
 *
 * jsdom has no IntersectionObserver callback and no frame loop, which is the
 * same condition as a tab opened in the background and as the server-rendered
 * HTML. The count-up was originally written with state starting at zero, so in
 * exactly those cases every figure on the page rendered as 0. This asserts the
 * number is the default and the animation is only decoration on top of it.
 */
describe("“Product at a glance” prints real figures with no motion at all", () => {
  it("shows each figure, not a zero", () => {
    const glance = container.querySelector("#glance")!;
    const text = glance.textContent ?? "";
    for (const [label, n] of [
      ["journeys", JOURNEYS.length],
      ["modules", MODULES.length],
      ["kit components", REPO.uiComponents],
      ["screens", SCREEN_COUNT],
      ["phases", PHASES.length],
    ] as const) {
      expect(text, `${label} should read ${n}`).toContain(String(n));
    }
    expect(text, "a zeroed figure means the count-up replaced the truth")
      .not.toMatch(/>\s*0\s*</);
  });

  it("names the modules and the phases rather than only counting them", () => {
    const text = container.querySelector("#glance")!.textContent ?? "";
    expect(text).toContain(MODULES[0].name);
    expect(text).toContain(PHASES[0]);
    expect(text).toContain(PHASES[PHASES.length - 1]);
  });

  it("has dropped every repository statistic", () => {
    // The point of the rewrite: scope, not effort.
    const text = container.querySelector("#glance")!.textContent ?? "";
    for (const banned of ["commit", "lines of", "test file", "colour value"]) {
      expect(text.toLowerCase(), `“${banned}” is codebase trivia`).not.toContain(banned);
    }
  });
});
