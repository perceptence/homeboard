"use client";

import clsx from "clsx";
import { motion } from "framer-motion";
import { Icon } from "@/components/Icons";
import { AvatarStack, Button, Card, Em, IconTile, List, Pill, type PillTone, Row, Sentence, TitleBlock } from "@/components/ui";
import { listItem, listStagger } from "@/lib/motion";
import { relative } from "@/lib/dates";
import { doers, useHousehold } from "@/lib/store";
import type { MaintStatus, StockStatus } from "@/lib/types";

/**
 * HOUSEHOLD'S SUB-SCREENS — Inventory, Maintenance, Automations, Settings.
 * Doors off the Household tab, not tabs of their own: the nav keeps Household
 * lit while you're in one, and Back returns you to the people.
 *
 * Every list here lives on the WASH (translucent gray on ink), not a white
 * card — the dark-canvas grammar the rest of the iPad follows. So everything
 * inside inverts: `Row tone="dark"`, `IconTile tone="onDark"`, pills and
 * buttons in their dark variants, the switch reading bright-track-is-on.
 */
function Back({ title, subtitle }: { title: string; subtitle?: string }) {
  const goIpad = useHousehold((s) => s.goIpad);
  return (
    <motion.div variants={listItem} className="mb-stack flex items-center gap-4">
      {/* The dark idiom, not a white disc — a wash well with a white chevron, so
          the one bright thing on the page stays the content, not the way out. */}
      <button
        onClick={() => goIpad("household")}
        aria-label="Back to Household"
        className="grid h-touch w-touch shrink-0 place-items-center rounded-pill bg-white/10 text-white transition-colors hover:bg-white/[.16]"
      >
        <Icon name="back" size={18} />
      </button>
      <TitleBlock size="page" tone="onDark" title={title} subtext={subtitle} />
    </motion.div>
  );
}

/** The automations switch, on a dark surface: a BRIGHT track reads as ON where
 *  the phone's ink track would vanish. Knob inverts (ink on the bright track)
 *  so the state is unmistakable without spending the lemon accent. */
function DarkSwitch({ on, onToggle, label }: { on: boolean; onToggle: () => void; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onToggle}
      className={clsx(
        "relative h-7 w-12 shrink-0 rounded-pill transition-colors outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lemon",
        on ? "bg-white" : "bg-white/15",
      )}
    >
      <motion.span
        layout
        transition={{ type: "spring", stiffness: 500, damping: 34 }}
        className={clsx(
          "absolute top-[3px] block h-[22px] w-[22px] rounded-pill shadow-sm",
          on ? "left-[23px] bg-ink" : "left-[3px] bg-white",
        )}
      />
    </button>
  );
}

/* ---------------- Inventory ---------------- */

// `ok`/`season` pills sit on the wash — `tag` (ink-on-ink) would vanish, so
// they take the `dark` chip; the coloured ones (lavender) read fine as-is.
const stockTone: Record<StockStatus, PillTone> = { low: "lavender", expiring: "light", ok: "dark" };
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
        <Card tone="wash" pad="none">
          <List>
            {inventory.map((i) => (
              <Row
                key={i.id}
                tone="dark"
                lead={<IconTile name="box" tone="onDark" />}
                title={i.title}
                meta={`${i.location} · ${i.quantity}`}
                actions={
                  <>
                    <Pill tone={stockTone[i.status]}>{stockLabel[i.status]}</Pill>
                    {i.status === "low" && (
                      <Button size="touch" tone="outlineDark" onClick={() => restock(i.id)}>Restocked</Button>
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

const maintTone: Record<MaintStatus, PillTone> = { over: "light", due: "lavender", season: "dark", up: "dark" };

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
        <Card tone="wash" pad="none">
          <List>
            {maint.map((m) => (
              <Row
                key={m.id}
                tone="dark"
                lead={<IconTile name="wrench" tone="onDark" />}
                title={m.title}
                meta={`${m.asset} · ${m.cadence}`}
                actions={
                  <>
                    <Pill tone={maintTone[m.status]}>{relative(m.due)}</Pill>
                    {m.status !== "up" && (
                      <Button size="touch" tone="outlineDark" onClick={() => scheduleMaint(m.id)}>Schedule</Button>
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
  const { automations, toggleAutomation, openSheet, calendar } = useHousehold();
  return (
    <motion.div variants={listStagger} initial="hidden" animate="show">
      <Back title="Automations" />
      <motion.div variants={listItem} className="mb-stack px-1.5">
        <Sentence className="max-w-[24ch] text-white">
          <Em>{automations.filter((a) => a.on).length}</Em> things the house runs on its own.
        </Sentence>
      </motion.div>
      <motion.div variants={listItem}>
        <Card tone="wash" pad="none">
          <List>
            {automations.map((a) => (
              <Row
                key={a.id}
                tone="dark"
                lead={<IconTile name="bolt" tone="onDark" />}
                title={a.title}
                meta={a.description}
                // The row opens the BUILDER; the switch (in actions, which
                // stops propagation) stays its own target.
                onClick={() => openSheet({ type: "addAutomation", id: a.id })}
                actions={<DarkSwitch on={a.on} onToggle={() => toggleAutomation(a.id)} label={a.title} />}
              />
            ))}
          </List>
        </Card>
      </motion.div>

      {/* CONNECT — the same "outside comes in" idea as the email-bills rule
          above, so it belongs on this screen too. Opens the shared connect sheet. */}
      <motion.div variants={listItem} className="mt-stack">
        <Card tone="wash" pad="none">
          <List>
            <Row
              tone="dark"
              lead={<IconTile name="cal" tone="onDark" />}
              title={calendar.connected ? `Calendar · connected to ${calendar.connected === "google" ? "Google" : "Apple"}` : "Connect calendar"}
              meta={calendar.connected ? "Imported events show on the calendar" : "Pull events in from Google or Apple"}
              onClick={() => openSheet({ type: "connectCalendar" })}
              actions={<Icon name="fwd" size={16} className="text-white/40" />}
            />
          </List>
        </Card>
      </motion.div>
    </motion.div>
  );
}

/* ---------------- Settings ---------------- */

/**
 * Real doors, not placeholders: the household admin and the account/profile
 * sheets are already built (the phone uses them), and render on the iPad's
 * shared Sheet host — so each row here opens a working screen.
 */
export function IpadSettings() {
  const s = useHousehold();
  const people = doers(s);
  const pets = Object.values(s.members).filter((m) => m.kind === "pet");

  const rows: { icon: Parameters<typeof IconTile>[0]["name"]; title: string; meta: string; lead?: React.ReactNode; onClick: () => void }[] = [
    {
      icon: "house",
      title: "Manage household",
      meta: `${s.householdName} · ${people.length} ${people.length === 1 ? "person" : "people"}${pets.length ? `, ${pets.length} pet${pets.length === 1 ? "" : "s"}` : ""}`,
      lead: <AvatarStack members={people.slice(0, 4)} size={32} ringClass="ring-ink" />,
      onClick: () => s.openSheet({ type: "manage" }),
    },
    { icon: "user", title: "Account & profile", meta: "Photo, your access, sign out", onClick: () => s.openSheet({ type: "settings" }) },
    { icon: "bell", title: "Notifications", meta: "Reminders in the Dynamic Island · quiet hours", onClick: () => s.openSheet({ type: "settings" }) },
    { icon: "lock", title: "Privacy & data", meta: "Local-first — nothing leaves this device", onClick: () => s.notify("Local-first — your data never leaves this device. Demo build.") },
  ];

  return (
    <motion.div variants={listStagger} initial="hidden" animate="show">
      <Back title="Settings" subtitle="Household, account, privacy & AI" />
      <motion.div variants={listItem}>
        <Card tone="wash" pad="none">
          <List>
            {rows.map((r) => (
              <Row
                key={r.title}
                tone="dark"
                lead={r.lead ?? <IconTile name={r.icon} tone="onDark" />}
                title={r.title}
                meta={r.meta}
                onClick={r.onClick}
                actions={<Icon name="fwd" size={16} className="text-white/40" />}
              />
            ))}
          </List>
        </Card>
      </motion.div>
    </motion.div>
  );
}
