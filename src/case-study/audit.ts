/**
 * The accessibility audit, recorded by hand because it cannot be computed from
 * source: it comes from running axe-core against this page in a real browser at
 * two viewports, with the embed scrolled into view so both applications are
 * actually mounted.
 *
 * SPLIT ON PURPOSE. This page is two things in one document — a written
 * article, and two live copies of a product running inside it. Reporting one
 * number would let the article hide behind the product, or the product hide
 * behind the article. So they're counted separately, and the product's failures
 * are listed rather than rounded off.
 *
 * Both viewports are still published, but they no longer disagree. They used to:
 * the wide run found more failing elements and the narrow run a worse ratio, so
 * the headline took the unflattering half of each. Enlarging the embed's devices
 * changed that — the board's floating nav now misreads its backdrop at BOTH
 * sizes, not just the narrow one — and the two runs came out identical. The
 * rule for the headline is unchanged (highest count, lowest ratio); there is
 * simply nothing left for it to choose between.
 */
export const AUDIT = {
  tool: "axe-core 4.10.2",
  ruleset: "WCAG 2.1 A + AA",
  viewports: ["1440 × 900", "390 × 844"],
  date: "August 2026",
  measuredWith: "the embed on screen, both the iPad and the phone mounted, each resting on its home screen",

  /** The case study's own chrome: type, cards, specimens, controls, hero. */
  page: { violations: 0, nodes: 0 },

  /**
   * The embedded product. All one rule — colour contrast — and every one of
   * them is the app's own palette, not this page's.
   *
   * Recorded per viewport rather than collapsed, so that a future divergence
   * shows up instead of averaging away. `nodes` is the higher count and `worst`
   * the lower ratio across the runs — which is the same pick either way now
   * that the two agree.
   */
  product: {
    violations: 1,
    byViewport: [
      { viewport: "1440 × 900", nodes: 15, worst: 1.16 },
      { viewport: "390 × 844", nodes: 15, worst: 1.16 },
    ],
    nodes: 15,
    worst: 1.16,
    findings: [
      {
        what: "Inactive labels in the iPad's floating nav",
        ratio: "1.16:1",
        why: "A real bug, not a thin token: the glass samples what's behind it to invert its text, and elementsFromPoint misreads inside a scaled container. It used to show only at the narrow viewport; at the embed's current device size it shows at both.",
      },
      {
        what: "Time-of-day headings on the board",
        ratio: "3.79:1",
        why: "White at 40% on the ink canvas. The token clears AA alone; the transparency is what drops it under.",
      },
      {
        what: "Card eyebrows on white (Meals, Bills, Garage…)",
        ratio: "3.93:1",
        why: "text-sub at 75% — the largest single group, and the same cause: a good token, thinned.",
      },
      {
        what: "The Worth-a-look heading and its second lines",
        ratio: "4.26 – 4.43:1",
        why: "White at 45% on ink and on a raised card. Closest to passing, and the easiest to fix.",
      },
    ],
  },
} as const;
