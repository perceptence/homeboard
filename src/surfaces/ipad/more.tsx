"use client";

import clsx from "clsx";
import { motion } from "framer-motion";
import { Icon, type IconName } from "@/components/Icons";
import { Button, Card, type CardTone, Em, IconTile, List, Pill, type PillTone, Row, Sentence } from "@/components/ui";
import { listItem, listStagger } from "@/lib/motion";
import { relative } from "@/lib/dates";
import { billTasks, useHousehold } from "@/lib/store";
import type { IpadRoute, MaintStatus, StockStatus } from "@/lib/types";

/** Shared header for every More sub-domain. */
function Back({ title, subtitle }: { title: string; subtitle?: string }) {
  const goIpad = useHousehold((s) => s.goIpad);
  return (
    <motion.div variants={listItem} className="mb-stack">
      <div className="flex items-center gap-4">
        <button
          onClick={() => goIpad("more")}
          aria-label="Back to More"
          className="grid h-touch w-touch place-items-center rounded-pill bg-card text-ink shadow-e2 transition-shadow hover:shadow-e3"
        >
          <Icon name="back" size={18} />
        </button>
        <h1 className="text-h1">{title}</h1>
      </div>
      {subtitle && <p className="ml-[52px] mt-1 text-body font-medium text-sub">{subtitle}</p>}
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
        <h1 className="text-h1">More</h1>
        <p className="mt-1 text-body font-medium text-sub">Everything else your home runs on</p>
      </motion.div>
      <motion.div variants={listItem} className="mt-section grid grid-cols-3 gap-tile">
        {TILES.map((t, i) => (
          <Card
            key={t.route}
            tone={t.card}
            onClick={() => goIpad(t.route)}
            className={clsx("flex min-h-[170px] flex-col", i === 0 && "col-span-2")}
          >
            <IconTile name={t.icon} tone="onTint" />
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
        <Card tone="white" className="flex min-h-[150px] flex-col">
          <IconTile name="bill" tone="onTint" />
          <Sentence className="mt-auto max-w-[22ch] !text-[26px]">
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
                lead={<IconTile name={t.source?.startsWith("Email") ? "mail" : "bill"} tone="neutral" />}
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
        <Card tone="lavender" className="flex min-h-[150px] flex-col">
          <IconTile name="box" tone="onTint" />
          <Sentence className="mt-auto max-w-[26ch] !text-[26px]">
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
                lead={<IconTile name="box" tone="neutral" />}
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
        <Card tone="white" className="flex min-h-[150px] flex-col">
          <IconTile name="wrench" tone="onTint" />
          <Sentence className="mt-auto max-w-[24ch] !text-[26px]">
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
                lead={<IconTile name="wrench" tone="neutral" />}
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
        <Card tone="lavender" className="flex min-h-[150px] flex-col">
          <IconTile name="bolt" tone="onTint" />
          <Sentence className="mt-auto max-w-[24ch] !text-[26px]">
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
                lead={<IconTile name="bolt" tone={a.on ? "onTint" : "neutral"} />}
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
                      className={clsx(
                        "absolute top-[4px] block h-[22px] w-[22px] rounded-pill shadow-sm",
                        a.on ? "left-[24px] bg-lemon" : "left-[4px] bg-white",
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
