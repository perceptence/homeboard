import { describe, it, expect } from "vitest";
import { boxShadow, colors, fontSize, radius, spacing, tokenCounts } from "@/lib/tokens";

/**
 * The design system claims a handful of invariants out loud, on the case-study
 * page and in DESIGN.md. These assert them, because each one is a rule a real
 * bug broke: half-pixel line-heights came from ratios, and an elevation named
 * after a colour builds a white shadow instead of a shadow.
 */

const px = (v: string) => Number(v.replace("px", ""));

describe("spacing", () => {
  it("is entirely on the 2px grid", () => {
    for (const [name, value] of Object.entries(spacing)) {
      expect(value, `${name} should be a px value`).toMatch(/^\d+px$/);
      expect(px(value) % 2, `spacing.${name} = ${value} is not even`).toBe(0);
    }
  });
});

describe("type scale", () => {
  it("uses even sizes and even line-heights, never a ratio", () => {
    for (const key of Object.keys(fontSize) as (keyof typeof fontSize)[]) {
      const [size, meta] = fontSize[key] as unknown as [string, Record<string, string>];
      expect(size, `${key} size`).toMatch(/^\d+px$/);
      // A RATIO is the bug: 28 * 1.25 = 35, and half-pixels spread from there.
      expect(meta.lineHeight, `${key} line-height must be px, not a ratio`).toMatch(/^\d+px$/);
      expect(px(size) % 2, `${key} size ${size} is not even`).toBe(0);
      expect(px(meta.lineHeight) % 2, `${key} line-height ${meta.lineHeight} is not even`).toBe(0);
    }
  });

  it("never sets a weight above 500 — nothing in this product shouts", () => {
    for (const key of Object.keys(fontSize) as (keyof typeof fontSize)[]) {
      const [, meta] = fontSize[key] as unknown as [string, Record<string, string>];
      expect(Number(meta.fontWeight)).toBeLessThanOrEqual(500);
    }
  });

  it("keeps the display sizes at Regular — a home is unhurried", () => {
    /**
     * The claim in DESIGN.md is specifically about the BIG sizes: heavy display
     * type reads as urgency, so display and h1 stay at 400. It is NOT a
     * monotonic rule across the whole scale — h2 is 18px at 500 on purpose,
     * because it's a label role and 500 is what keeps a label legible. An
     * earlier version of this test asserted strict monotonicity and failed;
     * the scale was right and the test was wrong.
     */
    for (const key of ["display", "h1"] as const) {
      const [, meta] = fontSize[key] as unknown as [string, Record<string, string>];
      expect(Number(meta.fontWeight), `${key} should be Regular`).toBe(400);
    }
  });
});

describe("elevation", () => {
  it("has no name that collides with a colour token", () => {
    // `shadow-<name>` resolves to a shadow COLOUR when <name> is also a colour,
    // so an elevation called `card` silently becomes a white shadow.
    const colourNames = new Set(Object.keys(colors));
    for (const name of Object.keys(boxShadow)) {
      expect(colourNames.has(name), `elevation "${name}" collides with a colour of the same name`).toBe(false);
    }
  });

  it("layers two shadows per step, so raised cards keep contact with the page", () => {
    for (const [name, value] of Object.entries(boxShadow)) {
      if (name === "e1") continue; // the contact-only step
      expect(value.split("),").length, `${name} should be a layered shadow`).toBeGreaterThan(1);
    }
  });
});

describe("radius", () => {
  it("always carries a unit — a bare number is invalid CSS and silently ignored", () => {
    for (const [name, value] of Object.entries(radius)) {
      expect(value, `radius.${name}`).toMatch(/^\d+px$/);
    }
  });
});

describe("the counts the case study prints", () => {
  it("are derived from the palette, not typed by hand", () => {
    expect(tokenCounts.colorKeys).toBe(Object.keys(colors).length);
    expect(tokenCounts.members).toBe(Object.keys(colors.member).length);
    expect(tokenCounts.colorValues).toBe(
      Object.keys(colors).length - 1 + Object.keys(colors.member).length,
    );
    expect(tokenCounts.spacing).toBe(Object.keys(spacing).length);
    expect(tokenCounts.radius).toBe(Object.keys(radius).length);
    expect(tokenCounts.type).toBe(Object.keys(fontSize).length);
    expect(tokenCounts.elevation).toBe(Object.keys(boxShadow).length);
  });
});
