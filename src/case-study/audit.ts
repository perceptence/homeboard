/**
 * The accessibility audit result, recorded by hand because it cannot be
 * computed from source: it comes from running axe-core against this page in a
 * real browser at two viewports. The figure below is what that run returned.
 *
 * Kept in its own module so the page prints it from one place, and so it's
 * obvious this is a measurement with a date on it rather than a claim.
 */
export const AUDIT = {
  tool: "axe-core",
  ruleset: "WCAG 2.1 A + AA",
  /** Viewports the page was audited at. */
  viewports: ["1440 × 900", "390 × 844"],
  /** Total violations across both viewports. */
  violations: 0,
  /** Serious/critical among them. */
  serious: 0,
  date: "August 2026",
} as const;
