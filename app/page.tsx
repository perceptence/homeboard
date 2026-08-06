"use client";

import clsx from "clsx";
import { MotionConfig } from "framer-motion";
import { useCallback, useEffect, useState } from "react";
import { Icon } from "@/components/Icons";
import { DeviceFrame } from "@/components/DeviceFrame";
import { Splash } from "@/components/Splash";
import { Avatar, Toast } from "@/components/ui";
import { doers, useHousehold } from "@/lib/store";
import { GROUPS, JOURNEYS } from "@/lib/journeys";
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
  // Preview-only, ephemeral: which way the iPad frame is turned. Not app
  // data, so it doesn't touch the persisted store — a reload always comes
  // back up landscape.
  const [orientation, setOrientation] = useState<"landscape" | "portrait">("landscape");

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
    // reducedMotion="user" makes every framer animation in the app honor the
    // OS "Reduce Motion" setting — transform/layout animations (slides, the
    // nav's sliding fill, sheet travel, entrance y-shifts) collapse to instant
    // while opacity fades stay, which is the accessible default. Drags and the
    // DeviceFrame's CSS scale are untouched (neither is a framer animation).
    <MotionConfig reducedMotion="user">
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

          {/* Rotate the iPad frame — preview-only, so it only shows up when
              there's an iPad on screen to turn. */}
          {!isPhone && (
            <button
              onClick={() => setOrientation((o) => (o === "landscape" ? "portrait" : "landscape"))}
              aria-label={`Rotate to ${orientation === "landscape" ? "portrait" : "landscape"}`}
              className="rounded-pill p-2 text-white/55 transition-colors hover:text-white"
            >
              <Icon name="rotate" size={16} strokeWidth={2.2} />
            </button>
          )}

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

      <DeviceFrame kind={kind} chromeGap={onboarding ? 90 : 130} orientation={isPhone ? undefined : orientation}>
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
    </MotionConfig>
  );
}

/**
 * DEMO PANEL — a driver's map for the preview. Every button jumps straight to a
 * journey by setting the persona, surface, route, and sheet in one go, so a
 * walkthrough never has to hunt for a screen. Preview-only chrome; it drives the
 * same store the app does.
 *
 * The journeys themselves live in src/lib/journeys.ts, so the case-study page
 * can offer the same screens as deep links without a second copy to drift.
 */
function DemoPanel() {
  const [open, setOpen] = useState(true);
  return (
    <div className="fixed left-3 top-3 z-[100] w-[168px] overflow-hidden rounded-2xl bg-ink/95 text-white shadow-e3 backdrop-blur">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-2.5 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-white/45 transition-colors hover:text-white/80"
      >
        Demo
        <span className="text-white/40">{open ? "\u2013" : "+"}</span>
      </button>
      {open && (
        <div className="no-scrollbar max-h-[calc(100vh-64px)] overflow-y-auto px-2 pb-2">
          {GROUPS.map((g) => (
            <div key={g} className="mt-1">
              <div className="px-1 pb-1 pt-1.5 text-[9px] font-bold uppercase tracking-[0.12em] text-white/30">{g}</div>
              <div className="flex flex-col gap-0.5">
                {JOURNEYS.filter((j) => j.group === g).map((j) => (
                  <button
                    key={j.id}
                    onClick={j.run}
                    className="rounded-lg px-2 py-1.5 text-left text-[12px] font-medium text-white/70 transition-colors hover:bg-white/10 hover:text-white"
                  >
                    {j.label}
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
