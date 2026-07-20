"use client";

import clsx from "clsx";
import { useRef } from "react";
import { motion } from "framer-motion";
import { Icon, type IconName } from "@/components/Icons";
import { ActionButton, Button } from "@/components/ui";
import { press, spring } from "@/lib/motion";
import { doers, useHousehold } from "@/lib/store";
import { useBackdropTone } from "@/lib/useBackdropTone";
import type { IpadRoute } from "@/lib/types";
import { IpadCalendar, IpadHousehold, IpadToday } from "./screens";
import { IpadAutomations, IpadInventory, IpadMaint, IpadSettings } from "./more";
import { SearchResults } from "./Search";

/** Every iPad destination, in one place. */
function RouteView({ route }: { route: IpadRoute }) {
  switch (route) {
    case "today": return <IpadToday />;
    case "calendar": return <IpadCalendar />;
    case "household": return <IpadHousehold />;
    case "inventory": return <IpadInventory />;
    case "maint": return <IpadMaint />;
    case "autos": return <IpadAutomations />;
    case "settings": return <IpadSettings />;
    default: return <IpadToday />;
  }
}

/** Three tabs, the phone's axis minus the personal one: now → later → us. */
const NAV: { route: IpadRoute; icon: IconName; label: string }[] = [
  { route: "today", icon: "feed", label: "Today" },
  { route: "calendar", icon: "cal", label: "Calendar" },
  { route: "household", icon: "people", label: "Household" },
];

/** Household's sub-screens are doors, not tabs — being in one keeps it lit. */
const UNDER_HOUSEHOLD: IpadRoute[] = ["inventory", "maint", "autos", "settings"];

export function IpadShell() {
  const s = useHousehold();
  const route = s.ipadRoute;

  // Whoever runs the home — never a hardcoded id, which broke for any
  // onboarded household without a member literally named Maya.
  const owner = doers(s).find((m) => m.role === "owner") ?? doers(s)[0];

  // Which NAV item is lit: a Household sub-screen keeps that tab active.
  const navRoute: IpadRoute = UNDER_HOUSEHOLD.includes(route) ? "household" : route;

  // The floating nav is glass over a scrolling canvas — dark ink one moment, a
  // white worklist card the next. Same hook the phone uses: read the backdrop
  // and invert the contents, so the labels never wash out.
  const navRef = useRef<HTMLElement>(null);
  const onLight = useBackdropTone(navRef, [route, s.navTick, s.query]) === "light";

  return (
    <div className="absolute inset-0 flex min-h-0 flex-col overflow-hidden bg-ink text-white">
      <header className="flex shrink-0 items-center gap-4 border-b border-white/[.06] px-inner py-5">
        {/* The household's own mark, relocated from the old sidebar — the one
            fixed "which home is this" anchor now that the nav floats and hides. */}
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-touch w-touch shrink-0 place-items-center rounded-sm bg-lemon text-ink">
            <Icon name="house" size={18} />
          </span>
          <span className="truncate font-tight text-h1 text-white">{s.householdName}</span>
        </div>
        {/* Pill, h-touch — the same shape and floor as the Feed's search bar
            and every other control in the app. */}
        <label className="ml-2 flex h-touch max-w-[320px] flex-1 items-center gap-2 rounded-pill bg-white/[.06] px-3.5 text-white/45 focus-within:bg-white/[.10]">
          <Icon name="search" size={16} />
          <input
            value={s.query}
            onChange={(e) => s.setQuery(e.target.value)}
            placeholder="Search tasks, items, bills…"
            className="w-full bg-transparent text-bodysm text-white outline-none placeholder:text-white/30"
          />
          {s.query && (
            <button onClick={() => s.setQuery("")} aria-label="Clear search">
              <Icon name="x" size={14} />
            </button>
          )}
        </label>
        <div className="ml-auto flex items-center gap-2.5">
          {/* tone="light" — the on-dark default everywhere else in the app. */}
          <ActionButton
            name="bell"
            label="Activity"
            tone="light"
            dot={s.unread > 0}
            // Open ONLY — markRead moved into the sheet itself. Calling it here
            // burned the evidence before the sheet could render.
            onClick={() => s.openSheet({ type: "activity" })}
          />
          {/* tone="lemon" — the app's one primary-action color. */}
          <Button
            tone="lemon"
            onClick={() => s.openSheet({ type: "newTask", draft: { title: "", owner: owner?.id ?? null, when: "Today", priority: "med" } })}
          >
            <Icon name="plus" size={16} /> Add
          </Button>
        </div>
      </header>

      {/* Entrance motion is keyed to navTick — mutations never re-trigger it.
          p-inner (24px) all round; the deep bottom pad clears the floating nav
          so the last row never hides behind it. */}
      <motion.div
        key={s.query ? "search" : s.navTick}
        className="no-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain p-inner pb-28"
      >
        {s.query ? <SearchResults /> : <RouteView route={route} />}
      </motion.div>

      {/* FLOATING GLASS NAV — always open, centred at the bottom. Every tab is
          named; the active one wears an inverting fill that SLIDES between tabs
          on navigation (shared layoutId). */}
      <div className="pointer-events-none absolute inset-x-0 bottom-6 z-30 flex justify-center px-inner">
        {/* The glass stays glass — it READS its backdrop (useBackdropTone) and
            inverts its contents: dark ink over a light card, white over ink. */}
        <nav
          ref={navRef}
          className={clsx(
            `pointer-events-auto flex items-center gap-1 rounded-[24px]
             border bg-white/10 p-2 shadow-e3 backdrop-blur-xl backdrop-saturate-150`,
            onLight ? "border-ink/[.08]" : "border-white/15",
          )}
        >
          {NAV.map((n) => {
            const active = n.route === navRoute;
            return (
              <motion.button
                key={n.route}
                whileTap={press}
                aria-label={n.label}
                aria-current={active ? "page" : undefined}
                onClick={() => s.goIpad(n.route)}
                className="relative flex h-[52px] items-center gap-2 rounded-[18px] px-[14px]"
              >
                {/* The selected fill inverts too — a white pill on a white card
                    is as invisible as white text on it. Shared layoutId slides
                    it to whichever tab is active. */}
                {active && (
                  <motion.span
                    layoutId="ipadTab"
                    transition={spring}
                    className={clsx(
                      "absolute inset-0 rounded-[18px] shadow-e1 transition-colors duration-300 ease-out",
                      onLight ? "bg-ink" : "bg-white",
                    )}
                  />
                )}

                <span className={clsx("relative shrink-0 transition-colors duration-300 ease-out",
                  active
                    ? onLight ? "text-white" : "text-ink"
                    : onLight ? "text-ink/45" : "text-white/50")}>
                  <Icon name={n.icon} size={22} />
                </span>

                <span className={clsx("relative whitespace-nowrap text-bodysm font-medium transition-colors duration-300 ease-out",
                  active
                    ? onLight ? "text-white" : "text-ink"
                    : onLight ? "text-ink/55" : "text-white/60")}>
                  {n.label}
                </span>
              </motion.button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
