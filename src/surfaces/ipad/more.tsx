"use client";

import clsx from "clsx";
import { motion } from "framer-motion";
import { Icon, type IconName } from "@/components/Icons";
import { Button, Card, type CardTone, Em, IconTile, List, Pill, type PillTone, Row, Sentence, TitleBlock } from "@/components/ui";
import { listItem, listStagger } from "@/lib/motion";
import { relative } from "@/lib/dates";
import { billTasks, useHousehold } from "@/lib/store";
import type { IpadRoute, MaintStatus, StockStatus } from "@/lib/types";

/**
 * Shared header for every More sub-domain — `TitleBlock tone="onDark"`, same
 * as every page header on the phone. The title itself read fine before (it
 * inherits white from the page), but the subtitle was set in `text-sub`, a
 * LIGHT-surface gray, directly on the dark ink backdrop — nearly illegible.
 * `onDark` gets it back to white/55.
 */
function Back({ title, subtitle }: { title: string; subtitle?: string }) {
  const goIpad = useHousehold((s) => s.goIpad);
  return (
    <motion.div variants={listItem} className="mb-stack flex items-center gap-4">
      <button
        onClick={() => goIpad("more")}
        aria-label="Back to More"
        className="grid h-touch w-touch shrink-0 place-items-center rounded-pill bg-card text-ink shadow-e2 transition-shadow hover:shadow-e3"
      >
        <Icon name="back" size={18} />
      </button>
      <TitleBlock size="page" tone="onDark" title={title} subtext={subtitle} />
    </motion.div>
  );
}

/* ---------------- More index ---------------- */

const TILES: { route: IpadRoute; icon: IconName; card: CardTone; label: string; blurb: string }[] = [
  { route: "bills", icon: "bill", card: "lemon", label: "Bills", blurb: "Rent, utilities, subscriptions" },
  { route: "inventory", icon: "box", card: "white", label: "Inventory", blurb: "Pantry, supplies, medicine" },
  { route: "maint", icon: "wrench", card: "lavender", label: "Maintenance", blurb: "Upkeep & warranties" },
  { route: "autos", icon: "bolt", card: "white", label: "Automations", blurb: "Rules & AI" },
  { route: "settings", icon: "gear", card: "white", label: "Settings", blurb: "Members, privacy, AI" },
];

export function IpadMore() {
  const goIpad = useHousehold((s) => s.goIpad);
  return (
    <motion.div variants={listStagger} initial="hidden" animate="show">
      <motion.div variants={listItem}>
        <TitleBlock size="page" tone="onDark" title="More" subtext="Everything else your home runs on" />
      </motion.div>
      <motion.div variants={listItem} className="mt-section grid grid-cols-3 gap-card-pad">
        {TILES.map((t, i) => (
          <Card
            key={t.route}
            tone={t.card}
            onClick={() => goIpad(t.route)}
            className={clsx("flex min-h-[200px] flex-col", i === 0 && "col-span-2")}
          >
            <IconTile name={t.icon} />
            <div className="mt-auto">
              <b className="block text-h2">{t.label}</b>
              <div className="mt-0.5 text-bodysm font-medium opacity-60">{t.blurb}</div>
            </div>
          </Card>
        ))}
      </motion.div>
    </motion.div>
  );
}

/* ---------------- Bills ---------------- */

/**
 * A money LENS, not a store. The Bill object died — a bill is a task with an
 * amount — so this screen just reads the money off the one timeline: what's
 * still owed on top, settled underneath. Paying here is the same act as
 * completing the task anywhere else.
 */
export function IpadBills() {
  const s = useHousehold();
  const money = billTasks(s).sort((a, b) => Number(a.done) - Number(b.done) || a.due.localeCompare(b.due));
  const owed = money.filter((t) => !t.done);
  const outstanding = owed.reduce((sum, t) => sum + (t.amount ?? 0), 0);

  return (
    <motion.div variants={listStagger} initial="hidden" animate="show">
      <Back title="Bills" />
      <motion.div variants={listItem} className="mb-stack">
        <Card tone="white" className="flex min-h-[160px] flex-col">
          <IconTile name="bill" />
          <Sentence className="mt-auto max-w-[22ch]">
            {outstanding ? <><Em>${outstanding}</Em> still to pay.</> : <>Everything&rsquo;s <Em>paid</Em>.</>}
          </Sentence>
        </Card>
      </motion.div>
      <motion.div variants={listItem}>
        <Card pad="none">
          <List>
            {money.map((t) => (
              <Row
                key={t.id}
                lead={<IconTile name={t.source?.startsWith("Email") ? "mail" : "bill"} />}
                title={t.title}
                muted={t.done}
                // Provenance leads: a bill that filed ITSELF (the email
                // automation) says so, and wears the mail glyph.
                meta={<span suppressHydrationWarning>
                  {t.source ? `${t.source} · ` : ""}{t.done ? "settled" : relative(t.due).toLowerCase()}
                </span>}
                actions={
                  <>
                    <b className="text-bodysm tabular-nums">${t.amount}</b>
                    {t.done ? (
                      <Pill tone="tag">Paid</Pill>
                    ) : (
                      // With a payUrl, "Pay" is a HANDOFF to the provider's own
                      // page (new tab — the app never touches card details);
                      // the task is recorded settled here.
                      <Button
                        size="touch"
                        onClick={() => {
                          if (t.payUrl) window.open(t.payUrl, "_blank", "noopener");
                          s.settleBill(t.id);
                        }}
                      >
                        Pay{t.payUrl && <Icon name="out" size={13} />}
                      </Button>
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

/* ---------------- Inventory ---------------- */

const stockTone: Record<StockStatus, PillTone> = { low: "lavender", expiring: "light", ok: "tag" };
const stockLabel: Record<StockStatus, string> = { low: "Running low", expiring: "Expiring", ok: "In stock" };

export function IpadInventory() {
  const { inventory, restock } = useHousehold();
  return (
    <motion.div variants={listStagger} initial="hidden" animate="show">
      <Back title="Inventory" />
      <motion.div variants={listItem} className="mb-stack">
        <Card tone="lavender" className="flex min-h-[160px] flex-col">
          <IconTile name="box" />
          <Sentence className="mt-auto max-w-[26ch]">
            <Em>{inventory.filter((i) => i.status === "low").length}</Em> things running low — they go
            straight onto the shopping list.
          </Sentence>
        </Card>
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
      <motion.div variants={listItem} className="mb-stack">
        <Card tone="white" className="flex min-h-[160px] flex-col">
          <IconTile name="wrench" />
          <Sentence className="mt-auto max-w-[24ch]">
            <Em>{maint.filter((m) => m.status === "over" || m.status === "due").length}</Em> bits of
            upkeep want a look. Nothing rots quietly.
          </Sentence>
        </Card>
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
      <motion.div variants={listItem} className="mb-stack">
        <Card tone="lavender" className="flex min-h-[160px] flex-col">
          <IconTile name="bolt" />
          <Sentence className="mt-auto max-w-[24ch]">
            <Em>{automations.filter((a) => a.on).length}</Em> things the house runs on its own.
          </Sentence>
        </Card>
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
