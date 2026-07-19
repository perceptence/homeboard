"use client";

import clsx from "clsx";
import { motion } from "framer-motion";
import { Icon, type IconName } from "@/components/Icons";
import { ActionButton, Button } from "@/components/ui";
import { isToday } from "@/lib/dates";
import { press, smooth, spring } from "@/lib/motion";
import { doers, shoppingList, useHousehold } from "@/lib/store";
import type { IpadRoute } from "@/lib/types";
import { IpadCalendar, IpadHome, IpadHousehold, IpadInsights, IpadShopping, IpadTasks } from "./screens";
import { IpadAutomations, IpadBills, IpadInventory, IpadMaint, IpadMore, IpadSettings } from "./more";
import { SearchResults } from "./Search";

/** Every iPad destination, in one place. */
function RouteView({ route }: { route: IpadRoute }) {
  switch (route) {
    case "home": return <IpadHome />;
    case "tasks": return <IpadTasks />;
    case "shopping": return <IpadShopping />;
    case "calendar": return <IpadCalendar />;
    case "household": return <IpadHousehold />;
    case "insights": return <IpadInsights />;
    case "more": return <IpadMore />;
    case "bills": return <IpadBills />;
    case "inventory": return <IpadInventory />;
    case "maint": return <IpadMaint />;
    case "autos": return <IpadAutomations />;
    case "settings": return <IpadSettings />;
    default: return <IpadHome />;
  }
}

const NAV: { route: IpadRoute; icon: IconName; label: string }[] = [
  { route: "home", icon: "home", label: "Home" },
  { route: "tasks", icon: "tasks", label: "Tasks" },
  { route: "shopping", icon: "cart", label: "Shopping" },
  { route: "calendar", icon: "cal", label: "Calendar" },
  { route: "household", icon: "house", label: "Household" },
  { route: "insights", icon: "chart", label: "Insights" },
  { route: "more", icon: "grid", label: "More" },
];

const TITLES: Record<string, string> = {
  home: "Home", tasks: "Tasks", shopping: "Shopping", calendar: "Calendar",
  household: "Household", insights: "Insights", more: "More",
  bills: "Bills", inventory: "Inventory", maint: "Maintenance",
  autos: "Automations", settings: "Settings",
};

export function IpadShell() {
  const s = useHousehold();
  const route = s.ipadRoute;

  const todayCount = s.tasks.filter((t) => !t.done && isToday(t.due)).length;
  const shopCount = shoppingList(s).filter((i) => !i.done).length;
  // Whoever runs the home — never a hardcoded id, which broke for any
  // onboarded household without a member literally named Maya.
  const owner = doers(s).find((m) => m.role === "owner") ?? doers(s)[0];

  return (
    <div className="absolute inset-0 grid min-h-0 grid-cols-[264px_1fr] overflow-hidden bg-ink text-white">
      {/* SIDEBAR — the phone's floating glass nav, stood on its end. Translucent and
          blurred, detached from the edge, with the active route marked by a WHITE
          fill that MORPHS between items via a shared layoutId (same as the phone). */}
      <aside className="min-h-0 p-tile">
        <div className="no-scrollbar flex h-full min-h-0 flex-col gap-1 overflow-y-auto overscroll-contain rounded-[24px]
                        border border-white/15 bg-white/[.06] p-tile shadow-e3
                        backdrop-blur-xl backdrop-saturate-150">
          <div className="flex items-center gap-3 px-2 pb-6 pt-2 text-h2 text-white">
            <span className="grid h-touch w-touch shrink-0 place-items-center rounded-sm bg-lemon text-ink">
              <Icon name="house" size={18} />
            </span>
            <span className="truncate">{s.householdName}</span>
          </div>

          <nav className="flex flex-col gap-1">
            {NAV.map((n) => {
              const active = route === n.route || (["bills", "inventory", "maint", "autos", "settings"].includes(route) && n.route === "more");
              const badge = n.route === "tasks" ? todayCount : n.route === "shopping" ? shopCount : 0;
              return (
                <motion.button
                  key={n.route}
                  whileTap={press}
                  transition={smooth}
                  onClick={() => s.goIpad(n.route)}
                  aria-current={active ? "page" : undefined}
                  className="relative flex min-h-touch items-center gap-3 rounded-[16px] px-3 text-left text-bodysm font-medium"
                >
                  {active && (
                    <motion.span
                      layoutId="ipadTab"
                      transition={spring}
                      className="absolute inset-0 rounded-[16px] bg-white shadow-e1"
                    />
                  )}
                  <span className={clsx("relative shrink-0 transition-colors duration-300 ease-out",
                    active ? "text-ink" : "text-white/45")}>
                    <Icon name={n.icon} />
                  </span>
                  <span className={clsx("relative transition-colors duration-300 ease-out",
                    active ? "text-ink" : "text-white/45")}>
                    {n.label}
                  </span>
                  {badge > 0 && (
                    <span className={clsx("relative ml-auto rounded-pill px-2 text-caption font-medium",
                      active ? "bg-ink/10 text-ink" : "bg-white/10 text-white/70")}>
                      {badge}
                    </span>
                  )}
                </motion.button>
              );
            })}
          </nav>
        </div>
      </aside>

      {/* Main */}
      <div className="flex min-h-0 min-w-0 flex-col">
        <header className="flex shrink-0 items-center gap-4 border-b border-white/[.06] px-inner py-5">
          <span className="font-tight text-h1 text-white">{s.query ? "Search" : TITLES[route] ?? "Home"}</span>
          {/* Pill, h-touch — the same shape and floor as the Feed's search bar
              and every other control in the app. Was rounded-xl at ~40px, an
              outlier shape under the 44px touch minimum. */}
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
            {/* tone="light" — the on-dark default everywhere else in the app.
                The bare default (tone="dark") painted bg-ink ON bg-ink: an
                invisible well, just a floating glyph. */}
            <ActionButton
              name="bell"
              label="Activity"
              tone="light"
              dot={s.unread > 0}
              // Open ONLY — markRead moved into the sheet itself. Calling it here
              // burned the evidence before the sheet could render: `unread` is
              // the only record of where "new to you" ends, and it was zeroed a
              // frame before anything could read it.
              onClick={() => s.openSheet({ type: "activity" })}
            />
            {/* tone="lemon" — the app's one primary-action color, and what
                "Add" already means on the phone. Same invisible-button bug as
                the bell: default tone="dark" was bg-ink on bg-ink. */}
            <Button
              tone="lemon"
              onClick={() => s.openSheet({ type: "newTask", draft: { title: "", owner: owner?.id ?? null, when: "Today", priority: "med" } })}
            >
              <Icon name="plus" size={16} /> Add
            </Button>
          </div>
        </header>

        {/* Entrance motion is keyed to navTick — mutations never re-trigger it.
            p-inner (24px) — "inner padding of larger containers," not the
            page-gutter token (p-screen, 4px) this was borrowing, which left a
            900px-wide pane tighter than the phone's own 350px card. */}
        <motion.div key={s.query ? "search" : s.navTick} className="no-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain p-inner">
          {s.query ? <SearchResults /> : <RouteView route={route} />}
        </motion.div>
      </div>
    </div>
  );
}
