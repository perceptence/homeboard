/**
 * Every repo-level number the case study prints, computed from the repo itself.
 *
 * This module is imported by TWO things: `scripts/facts.mjs`, which writes the
 * numbers into a committed TypeScript file the page reads, and the test suite,
 * which recomputes them and asserts the committed file still matches. So a
 * number on the page cannot quietly go stale — if the codebase moves and nobody
 * regenerates, the suite goes red and names the figure that drifted.
 *
 * Run `npm run facts` to regenerate.
 */
import { execSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, extname } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * The repo root.
 *
 * fileURLToPath, not `.pathname` — the latter keeps URL escaping, so any path
 * containing a space silently resolves to a directory that isn't there and
 * every count comes back zero. And no dirname() around it: `new URL("..")`
 * already lands on the root WITH a trailing slash, and dirname() of a
 * trailing-slash path climbs one level further than you meant.
 */
const ROOT = (() => {
  try {
    return fileURLToPath(new URL("..", import.meta.url));
  } catch {
    // Vitest rewrites import.meta.url for transformed modules, and it isn't
    // always a file: URL — fall back to the working directory, which is the
    // repo root for both `npm run facts` and `vitest run`.
    return process.cwd() + "/";
  }
})();

/** Every file under `dirs` with one of `exts`, recursively, skipping junk. */
export function walk(dirs, exts, skip = /node_modules|\.next|\.git/) {
  const out = [];
  const visit = (dir) => {
    let entries;
    try { entries = readdirSync(join(ROOT, dir)); } catch { return; }
    for (const name of entries) {
      const rel = join(dir, name);
      if (skip.test(rel) || name.startsWith(".")) continue;
      const abs = join(ROOT, rel);
      if (statSync(abs).isDirectory()) visit(rel);
      else if (exts.includes(extname(name))) out.push(rel);
    }
  };
  dirs.forEach(visit);
  return out.sort();
}

const read = (rel) => readFileSync(join(ROOT, rel), "utf8");

export function computeFacts() {
  const sourceFiles = walk(["src", "app"], [".ts", ".tsx"]);
  const appFiles = sourceFiles.filter((f) => !f.includes(".test."));

  /** Lines of TypeScript/TSX we actually wrote (tests excluded). */
  const lines = appFiles.reduce((n, f) => n + read(f).split("\n").length, 0);

  /** Exported React components — `export function Name` / `export default function Name`. */
  const components = appFiles
    .filter((f) => f.endsWith(".tsx"))
    .reduce((n, f) => n + (read(f).match(/^export (?:default )?function [A-Z]/gm) || []).length, 0);

  /**
   * The REUSABLE interface kit — exported components under src/components only.
   *
   * Deliberately narrower than `components` above, which counts every exported
   * component in the repo including this case study's own one-off panels. What
   * the product's scale is actually made of is the shared kit: the pieces both
   * surfaces render from. Counting the article's furniture alongside them would
   * inflate a design figure with page decoration.
   */
  const uiComponents = appFiles
    .filter((f) => f.includes("/components/") && f.endsWith(".tsx"))
    .reduce((n, f) => n + (read(f).match(/^export (?:default )?function [A-Z]/gm) || []).length, 0);

  /** Test files, counted the same way the suite counts itself. */
  const testFiles = walk(["src", "app", "tests"], [".ts", ".tsx"]).filter((f) => f.includes(".test."));

  /** Commits — a floor, not a fixed figure: it only ever goes up. */
  let commits = 0;
  try {
    commits = Number(execSync("git rev-list --count HEAD", { cwd: ROOT }).toString().trim());
  } catch { /* not a git checkout — leave 0 */ }

  return {
    commits,
    lines,
    components,
    uiComponents,
    sourceFiles: appFiles.length,
    testFiles: testFiles.length,
  };
}
