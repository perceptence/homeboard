import type { IconName } from "@/components/Icons";
import type { Task } from "./types";

/**
 * The glyph that stands for a task — one mapping, shared by every surface that
 * shows one (detail sheets, the hand-off list, the Dynamic Island), so "Take
 * out the trash" wears the same trash mark everywhere. Title keywords first,
 * then the source domain, then a generic checklist.
 */
const TASK_GLYPHS: [RegExp, IconName][] = [
  [/trash|bin|rubbish|recycl/i, "trash"],
  [/plant|water|garden/i, "plant"],
  [/pick ?up|school run|drop ?off/i, "kid"],
  [/homework|study/i, "grad"],
  [/laundry|fold|wash/i, "spark"],
  [/mow|lawn|hedge|leaves/i, "plant"],
  [/cook|dinner|meal|table/i, "dine"],
  [/groc|shopping/i, "cart"],
  [/vacuum|clean|dust|tidy|sweep/i, "spark"],
  [/hvac|filter|boiler|service|repair|fix/i, "wrench"],
  [/bill|insurance|rent|renew/i, "bill"],
];

const SOURCE_GLYPHS: Record<string, IconName> = {
  Automation: "bolt", Meals: "dine", "Home maintenance": "wrench", "Home care": "plant",
  Cleaning: "spark", Laundry: "spark", Kids: "kid", Bills: "bill", Calendar: "cal",
};

export function taskGlyph(t: Task): IconName {
  if (t.icon) return t.icon;
  for (const [re, name] of TASK_GLYPHS) if (re.test(t.title)) return name;
  // The source may be compound ("Automation · Calendar") — first part decides.
  const src = t.source?.split("·")[0]?.trim();
  return (src ? SOURCE_GLYPHS[src] : undefined) ?? "tasks";
}
