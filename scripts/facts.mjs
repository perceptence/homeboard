/** Writes the computed repo facts into a file the case-study page imports. */
import { writeFileSync } from "node:fs";
import { computeFacts } from "./repo-facts.mjs";

const f = computeFacts();
const out = new URL("../src/case-study/facts.generated.ts", import.meta.url);

writeFileSync(out, `/**
 * GENERATED — do not edit by hand. Run \`npm run facts\`.
 *
 * These are the repo-level numbers the case study prints. They're written here
 * by scripts/facts.mjs and re-checked by facts.test.ts, which recomputes them
 * from the working tree and fails if this file has gone stale. That's the whole
 * mechanism keeping the page honest: a figure can't rot quietly, because the
 * suite recomputes it on every run.
 */
export const REPO = {
  /** Commits on HEAD when this was generated. Asserted as a floor — it only rises. */
  commits: ${f.commits},
  /** Lines of TypeScript/TSX across src/ and app/, excluding tests. */
  lines: ${f.lines},
  /** Exported React components (\`export function Name\`), excluding tests. */
  components: ${f.components},
  /** Exported components in the SHARED UI kit (src/components) — the reusable
   *  pieces both surfaces render from, excluding this page's own furniture. */
  uiComponents: ${f.uiComponents},
  /** Source files counted for \`lines\`. */
  sourceFiles: ${f.sourceFiles},
  /** Test files in the suite. */
  testFiles: ${f.testFiles},
} as const;
`);

console.log("wrote facts.generated.ts:", f);
