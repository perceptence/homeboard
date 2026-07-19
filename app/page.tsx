"use client";

import clsx from "clsx";
import { useCallback, useEffect, useState } from "react";
import { Icon } from "@/components/Icons";
import { DeviceFrame } from "@/components/DeviceFrame";
import { Splash } from "@/components/Splash";
import { Avatar, Toast } from "@/components/ui";
import { doers, useHousehold } from "@/lib/store";
import { Onboarding } from "@/surfaces/Onboarding";
import { Sheets } from "@/surfaces/Sheets";
import { IpadShell } from "@/surfaces/ipad/IpadShell";
import { PhoneShell } from "@/surfaces/phone/PhoneShell";

/**
 * One household, two lenses.
 * The iPad Pro is the shared family surface (the owner's superset); each
 * member's iPhone is the same data, scoped to them. Both read the same store —
 * so a task completed on a kid's phone moves on the family iPad instantly.
 */
export default function Page() {
  const s = useHousehold();

  useEffect(() => {
    // Rehydrate AFTER React has hydrated — persist's default (rehydrate on
    // module load) races SSR: server HTML holds the seed, client state holds
    // yesterday, React sees two different trees and tears the page down.
    useHousehold.persist.rehydrate();
    // The reminder clock. One second is the island's resolution, not the CPU's
    // concern — tick() is a find() over a near-empty array.
    const t = setInterval(() => useHousehold.getState().tick(), 1000);
    return () => clearInterval(t);
  }, []);
  const isPhone = s.persona !== "ipad";
  const onboarding = !s.setupComplete;
  const people = doers(s);

  // Setup follows whatever surface you're on: a household with no iPad onboards
  // on a phone. (Switch to a member before "+ New home" to see phone setup.)
  const kind = isPhone ? "phone" : "tablet";

  // Stable identity, deliberately. Toast's timer effect re-runs when onDone
  // changes — an inline arrow here is a new function every render, so every
  // unrelated rerender restarted the 2.4s countdown from zero.
  const clearToast = useCallback(() => useHousehold.getState().notify(null), []);

  return (
    <main
      className={clsx(
        "flex h-screen flex-col items-center overflow-hidden bg-room px-4 pb-2 pt-2",
      )}
    >
      {!onboarding && (
        <div className="mb-2 flex shrink-0 flex-wrap items-center justify-center gap-1 rounded-pill bg-ink/90 p-1.5 shadow-e3 backdrop-blur">
          <span className="px-2 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-white/35">
            Viewing
          </span>

          <SwitchButton active={!isPhone} onClick={() => s.setPersona("ipad")}>
            <Icon name="house" size={16} strokeWidth={2.2} />
            Family iPad
          </SwitchButton>

          {people.slice(0, 4).map((m) => (
            <SwitchButton key={m.id} active={s.persona === m.id} onClick={() => s.setPersona(m.id)}>
              <Avatar member={m} size={20} />
              {m.name}
            </SwitchButton>
          ))}

          <span className="mx-1.5 h-4 w-px bg-white/10" />
          <button
            onClick={s.startOnboarding}
            className="rounded-pill px-3 py-2 text-[13px] font-semibold text-white/55 transition-colors hover:text-white"
          >
            + New home
          </button>
        </div>
      )}

      <DeviceFrame kind={kind} chromeGap={onboarding ? 90 : 130}>
        {/* Launch splash — INSIDE the glass. It's the app opening, not the
            demo page loading, so it belongs on the device's own screen. */}
        <Splash />
        {onboarding ? (
          <Onboarding />
        ) : (
          <>
            {isPhone ? <PhoneShell /> : <IpadShell />}
            <Sheets variant={isPhone ? "phone" : "ipad"} />
          </>
        )}
        <Toast message={s.toast} who={s.toastWho ? s.members[s.toastWho] : undefined} onDone={clearToast} onUndo={s.toastUndo ?? undefined} />
      </DeviceFrame>

      <DemoPanel />
    </main>
  );
}

/**
 * DEMO PANEL — a driver's map for the preview. Every button jumps straight to a
 * journey by setting the persona, surface, route, and sheet in one go, so a
 * walkthrough never has to hunt for a screen. Preview-only chrome; it drives the
 * same store the app does.
 */
type Jump = { label: string; run: () => void };
function DemoPanel() {
  const [open, setOpen] = useState(true);
  const st = () => useHousehold.getState();
  // Every jump must land IN THE SEED DEMO. Two ways the current state can be
  // somewhere else: a setup run is in progress (the app renders Onboarding
  // regardless of routes, so navigation happens underneath a flow that never
  // shows it), or a real onboarding run built a household of its own — whose
  // name-derived member ids don't include the maya/sam/leo these journeys
  // reference, so pointing the persona at them crashes the shell. Either way,
  // restore the seed home first.
  const home = () => {
    const s = st();
    if (!s.setupComplete || !s.members.maya) s.skipOnboarding();
    return st();
  };
  const memberOr = (fallback = "maya") => {
    const p = st().persona;
    return p === "ipad" ? fallback : p;
  };

  // Land on a phone screen (as a member — falls back to the owner from the iPad).
  const phone = (route: "today" | "ahead" | "house" | "you", sheet?: string): Jump["run"] => () => {
    const s = home();
    s.setPersona(memberOr());
    s.goPhone(route);
    if (sheet) s.openSheet({ type: sheet } as never);
    else s.closeSheet();
  };
  // Owner-only journeys always view as Maya so every control is live.
  const owner = (sheet: string): Jump["run"] => () => {
    const s = home();
    s.setPersona("maya");
    s.goPhone("you");
    s.openSheet({ type: sheet } as never);
  };
  const ipad = (route: string): Jump["run"] => () => {
    const s = home();
    s.setPersona("ipad");
    s.goIpad(route as never);
    s.closeSheet();
  };

  const groups: { title: string; items: Jump[] }[] = [
    { title: "Setup", items: [
      { label: "Onboarding · phone", run: () => { const s = st(); s.setPersona("maya"); s.startOnboarding(); s.setStep(0); } },
      { label: "Onboarding · iPad", run: () => { const s = st(); s.setPersona("ipad"); s.startOnboarding(); s.setStep(0); } },
      {
        label: "Reset to demo",
        // Always lands somewhere visibly different — persona, route, and any
        // open sheet/dropdown all reset together — so clicking this never
        // looks like a no-op just because you were already mid-demo.
        run: () => {
          const s = st();
          s.skipOnboarding();
          s.setPersona("maya");
          s.goPhone("today");
          s.closeSheet();
          s.notify("Demo reset");
        },
      },
    ] },
    { title: "Phone", items: [
      { label: "Today", run: phone("today") },
      { label: "Ahead", run: phone("ahead") },
      { label: "You", run: phone("you") },
      { label: "Household", run: phone("house") },
      { label: "Shopping", run: phone("today", "shop") },
      { label: "In the house", run: phone("today", "stock") },
      { label: "New task", run: phone("today", "newTask") },
      { label: "Activity", run: phone("you", "activity") },
      { label: "Rebalance", run: phone("you", "rebalance") },
    ] },
    { title: "Owner admin", items: [
      { label: "Settings", run: owner("settings") },
      { label: "Manage household", run: owner("manage") },
      { label: "Add person", run: owner("addPerson") },
      { label: "New bill", run: owner("addBill") },
      { label: "New automation", run: owner("addAutomation") },
    ] },
    { title: "Live trip", items: [
      { label: "On my way · Sam", run: () => { const s = home(); s.setPersona("sam"); s.goPhone("today"); s.closeSheet(); s.onWay(4); } },
      { label: "Waiting · Leo", run: () => { const s = home(); s.setPersona("leo"); s.goPhone("today"); s.closeSheet(); } },
    ] },
    { title: "iPad", items: [
      { label: "Home", run: ipad("home") },
      { label: "Household", run: ipad("household") },
      { label: "Insights", run: ipad("insights") },
      { label: "Bills", run: ipad("bills") },
      { label: "Automations", run: ipad("autos") },
    ] },
  ];

  return (
    <div className="fixed left-3 top-3 z-[100] w-[168px] overflow-hidden rounded-2xl bg-ink/95 text-white shadow-e3 backdrop-blur">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-2.5 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-white/45 transition-colors hover:text-white/80"
      >
        Demo
        <span className="text-white/40">{open ? "–" : "+"}</span>
      </button>
      {open && (
        <div className="no-scrollbar max-h-[calc(100vh-64px)] overflow-y-auto px-2 pb-2">
          {groups.map((g) => (
            <div key={g.title} className="mt-1">
              <div className="px-1 pb-1 pt-1.5 text-[9px] font-bold uppercase tracking-[0.12em] text-white/30">{g.title}</div>
              <div className="flex flex-col gap-0.5">
                {g.items.map((it) => (
                  <button
                    key={it.label}
                    onClick={it.run}
                    className="rounded-lg px-2 py-1.5 text-left text-[12px] font-medium text-white/70 transition-colors hover:bg-white/10 hover:text-white"
                  >
                    {it.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SwitchButton({
  active, onClick, children,
}: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        "flex items-center gap-2 rounded-pill px-3.5 py-2 text-[13px] font-bold transition-colors",
        active ? "bg-lemon text-ink" : "text-white/55 hover:text-white",
      )}
    >
      {children}
    </button>
  );
}
