"use client";

import clsx from "clsx";
import { motion } from "framer-motion";
import { Icon, type IconName } from "@/components/Icons";
import { Button, Card, Em, IconTile, List, Pill, type PillTone, Row, Sentence, TitleBlock } from "@/components/ui";
import { listItem, listStagger } from "@/lib/motion";
import { relative } from "@/lib/dates";
import { useHousehold } from "@/lib/store";
import type { MaintStatus, StockStatus } from "@/lib/types";

/**
 * HOUSEHOLD'S SUB-SCREENS — Inventory, Maintenance, Automations, Settings.
 * Doors off the Household tab, not tabs of their own: the nav keeps Household
 * lit while you're in one, and Back returns you to the people.
 *
 * Shared header: `TitleBlock tone="onDark"` — the title inherits white from
 * the page, and the subtitle must never be text-sub (a LIGHT-surface gray)
 * on the dark ink backdrop.
 */
function Back({ title, subtitle }: { title: string; subtitle?: string }) {
  const goIpad = useHousehold((s) => s.goIpad);
  return (
    <motion.div variants={listItem} className="mb-stack flex items-center gap-4">
      <button
        onClick={() => goIpad("household")}
        aria-label="Back to Household"
        className="grid h-touch w-touch shrink-0 place-items-center rounded-pill bg-card text-ink shadow-e2 transition-shadow hover:shadow-e3"
      >
        <Icon name="back" size={18} />
      </button>
      <TitleBlock size="page" tone="onDark" title={title} subtext={subtitle} />
    </motion.div>
  );
}

/* ---------------- Inventory ---------------- */

const stockTone: Record<StockStatus, PillTone> = { low: "lavender", expiring: "light", ok: "tag" };
const stockLabel: Record<StockStatus, string> = { low: "Running low", expiring: "Expiring", ok: "In stock" };

export function IpadInventory() {
  const { inventory, restock } = useHousehold();
  return (
    <motion.div variants={listStagger} initial="hidden" animate="show">
      <Back title="Inventory" />
      <motion.div variants={listItem} className="mb-stack px-1.5">
        <Sentence className="max-w-[26ch] text-white">
          <Em>{inventory.filter((i) => i.status === "low").length}</Em> things running low — they go
          straight onto the shopping list.
        </Sentence>
      </motion.div>
      <motion.div variants={listItem}>
        <Card pad="none">
          <List>
            {inventory.map((i) => (
              <Row
                key={i.id}
                lead={<IconTile name="box" />}
                title={i.title}
                meta={`${i.location} · ${i.quantity}`}
                actions={
                  <>
                    <Pill tone={stockTone[i.status]}>{stockLabel[i.status]}</Pill>
                    {i.status === "low" && (
                      <Button size="touch" tone="outline" onClick={() => restock(i.id)}>Restocked</Button>
                    )}
                  </>
                }
              />
            ))}
          </List>
        </Card>
      </motion.div>
    </motion.div>
  );
}

/* ---------------- Maintenance ---------------- */

const maintTone: Record<MaintStatus, PillTone> = { over: "light", due: "lavender", season: "tag", up: "tag" };

export function IpadMaint() {
  const { maint, scheduleMaint } = useHousehold();
  return (
    <motion.div variants={listStagger} initial="hidden" animate="show">
      <Back title="Home maintenance" />
      <motion.div variants={listItem} className="mb-stack px-1.5">
        <Sentence className="max-w-[24ch] text-white">
          <Em>{maint.filter((m) => m.status === "over" || m.status === "due").length}</Em> bits of
          upkeep want a look. Nothing rots quietly.
        </Sentence>
      </motion.div>
      <motion.div variants={listItem}>
        <Card pad="none">
          <List>
            {maint.map((m) => (
              <Row
                key={m.id}
                lead={<IconTile name="wrench" />}
                title={m.title}
                meta={`${m.asset} · ${m.cadence}`}
                actions={
                  <>
                    <Pill tone={maintTone[m.status]}>{relative(m.due)}</Pill>
                    {m.status !== "up" && (
                      <Button size="touch" tone="outline" onClick={() => scheduleMaint(m.id)}>Schedule</Button>
                    )}
                  </>
                }
              />
            ))}
          </List>
        </Card>
      </motion.div>
    </motion.div>
  );
}

/* ---------------- Automations ---------------- */

export function IpadAutomations() {
  const { automations, toggleAutomation, openSheet } = useHousehold();
  return (
    <motion.div variants={listStagger} initial="hidden" animate="show">
      <Back title="Automations" />
      <motion.div variants={listItem} className="mb-stack px-1.5">
        <Sentence className="max-w-[24ch] text-white">
          <Em>{automations.filter((a) => a.on).length}</Em> things the house runs on its own.
        </Sentence>
      </motion.div>
      <motion.div variants={listItem}>
        <Card pad="none">
          <List>
            {automations.map((a) => (
              <Row
                key={a.id}
                // On/off already reads from the switch itself (filled ink
                // track = on) — the icon tone doesn't need to double-encode it.
                lead={<IconTile name="bolt" />}
                title={a.title}
                meta={a.description}
                // The row opens the BUILDER; the switch (in actions, which
                // stops propagation) stays its own target.
                onClick={() => openSheet({ type: "addAutomation", id: a.id })}
                actions={
                  <button
                    role="switch"
                    aria-checked={a.on}
                    aria-label={a.title}
                    onClick={() => toggleAutomation(a.id)}
                    className={clsx(
                      "relative h-7 w-12 rounded-pill transition-colors",
                      a.on ? "bg-ink" : "bg-black/15",
                    )}
                  >
                    <motion.span
                      layout
                      transition={{ type: "spring", stiffness: 500, damping: 34 }}
                      // White knob both ways — the ink track says ON; lemon is
                      // for the active moment, not resting furniture.
                      className={clsx(
                        "absolute top-[4px] block h-[22px] w-[22px] rounded-pill bg-white shadow-sm",
                        a.on ? "left-[24px]" : "left-[4px]",
                      )}
                    />
                  </button>
                }
              />
            ))}
          </List>
        </Card>
      </motion.div>

    </motion.div>
  );
}

/* ---------------- Settings ---------------- */

const SETTINGS: [IconName, string, string][] = [
  ["house", "Household", "Rivera Home · 4 people, 1 pet"],
  ["people", "Members & permissions", "Stewards, juniors, guests"],
  ["bell", "Notifications", "Quiet hours 9pm–7am"],
  ["gear", "Privacy", "Local-first · no ads, ever"],
  ["spark", "AI preferences", "Propose-first · you approve autonomy"],
];

export function IpadSettings() {
  return (
    <motion.div variants={listStagger} initial="hidden" animate="show">
      <Back title="Settings" subtitle="Household, members, privacy & AI" />
      <motion.div variants={listItem}>
        <Card pad="none">
          <List>
            {SETTINGS.map(([icon, title, meta]) => (
              <Row
                key={title}
                lead={<IconTile name={icon} />}
                title={title}
                meta={meta}
                onClick={() => {}}
                actions={<Icon name="fwd" size={16} className="text-sub" />}
              />
            ))}
          </List>
        </Card>
      </motion.div>
    </motion.div>
  );
}
