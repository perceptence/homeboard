/**
 * GENERATED — do not edit by hand. Run `npm run facts`.
 *
 * These are the repo-level numbers the case study prints. They're written here
 * by scripts/facts.mjs and re-checked by facts.test.ts, which recomputes them
 * from the working tree and fails if this file has gone stale. That's the whole
 * mechanism keeping the page honest: a figure can't rot quietly, because the
 * suite recomputes it on every run.
 */
export const REPO = {
  /** Commits on HEAD when this was generated. Asserted as a floor — it only rises. */
  commits: 189,
  /** Lines of TypeScript/TSX across src/ and app/, excluding tests. */
  lines: 17770,
  /** Exported React components (`export function Name`), excluding tests. */
  components: 67,
  /** Exported components in the SHARED UI kit (src/components) — the reusable
   *  pieces both surfaces render from, excluding this page's own furniture. */
  uiComponents: 35,
  /** Source files counted for `lines`. */
  sourceFiles: 42,
  /** Test files in the suite. */
  testFiles: 5,
} as const;
