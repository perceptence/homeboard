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
 * Both viewports are published, because neither is uniformly worse: the wide
 * one finds more failing elements, the narrow one finds a worse ratio. The
 * headline numbers take the unflattering half of each.
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
   * Recorded per viewport, because neither is uniformly worse and collapsing
   * them would hide something either way: the wide run finds MORE failing
   * elements, the narrow run finds a WORSE one. `nodes` is the higher count and
   * `worst` the lower ratio, so the headline figures are the unflattering pick
   * from each.
   */
  product: {
    violations: 1,
    byViewport: [
      { viewport: "1440 × 900", nodes: 13, worst: 3.79 },
      { viewport: "390 × 844", nodes: 11, worst: 1.16 },
    ],
    nodes: 13,
    worst: 1.16,
    findings: [
      {
        what: "Inactive labels in the iPad's floating nav (narrow viewport)",
        ratio: "1.16:1",
        why: "A real bug, not a thin token. The nav samples what's behind it and inverts its text to suit; that sampling uses elementsFromPoint, which misreads once the app sits inside a scaled container — so it decides the glass is over something light and paints ink on near-black. Correct at full size, wrong in the embed, and worth fixing either way.",
      },
      {
        what: "Time-of-day headings on the board (Morning, Afternoon, Evening)",
        ratio: "3.79:1",
        why: "White at 40% opacity on the ink canvas. The token clears AA on its own; the transparency is what drops it under.",
      },
      {
        what: "Card eyebrows on white (Meals, Bills, Garage…)",
        ratio: "3.93:1",
        why: "text-sub at 75% opacity — the largest single group. Same cause: a good token, thinned.",
      },
      {
        what: "The Worth-a-look heading and its second lines",
        ratio: "4.26 – 4.43:1",
        why: "White at 45% on ink and on a raised dark card. Closest to passing, and the easiest to fix.",
      },
    ],
  },
} as const;
