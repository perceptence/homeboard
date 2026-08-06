"use client";

import clsx from "clsx";
import { MotionConfig } from "framer-motion";
import { useCallback, useEffect, useState } from "react";
import { Icon } from "@/components/Icons";
import { DemoPalette } from "@/components/DemoPalette";
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
      {/* THE BAR SURVIVES ONBOARDING, with only what setup can answer for.
          It used to disappear entirely, which forced the one control that must
          outlive setup — the way back to the seeded demo — to float over the
          page as a fixed pill. Fixed means out of flow, so it collided with the
          device: measured 3px into the frame on both surfaces, because the pill
          and the device are both centred. Keeping the bar puts that control
          back in flow, where it reserves its own space and can't overlap, and
          hands iPad setup the rotate control it never had.

          mb-9 (36px) IS the gap under the bar, declared rather than emerging
          from the fit — see DeviceFrame's `align` note. */}
      <div className="mb-9 flex shrink-0 flex-wrap items-center justify-center gap-1 rounded-pill bg-ink/90 p-1.5 shadow-e3 backdrop-blur">
        <span className="px-2 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-white/35">
          {onboarding ? "Setting up" : "Viewing"}
        </span>

        {!onboarding && (
          <SwitchButton active={!isPhone} onClick={() => s.setPersona("ipad")}>
            <Icon name="house" size={16} strokeWidth={2.2} />
            Family iPad
          </SwitchButton>
        )}

        {/* Rotate the frame. Disabled rather than removed on a phone: pulling a
            control out of a row re-flows everything after it, so every switch
            to a phone shifted the people and "+ New home" leftward. A control
            that greys out reads as "not for this surface"; one that vanishes
            reads as the bar being unstable. Setup gets it too — an iPad being
            set up is still an iPad, and the flow lays out differently in
            portrait. */}
        <button
          onClick={() => setOrientation((o) => (o === "landscape" ? "portrait" : "landscape"))}
          disabled={isPhone}
          aria-label={
            isPhone
              ? "Rotate — available for the iPad"
              : `Rotate to ${orientation === "landscape" ? "portrait" : "landscape"}`
          }
          className={clsx(
            "rounded-pill p-2 transition-colors",
            isPhone ? "cursor-not-allowed text-white/20" : "text-white/55 hover:text-white",
          )}
        >
          <Icon name="rotate" size={16} strokeWidth={2.2} />
        </button>

        {!onboarding && people.slice(0, 4).map((m) => (
          <SwitchButton key={m.id} active={s.persona === m.id} onClick={() => s.setPersona(m.id)}>
            <Avatar member={m} size={20} />
            {m.name}
          </SwitchButton>
        ))}

        <span className="mx-1.5 h-4 w-px bg-white/10" />

        <DemoPalette />

        {!onboarding && (
          <button
            onClick={s.startOnboarding}
            className="rounded-pill px-3 py-2 text-[13px] font-semibold text-white/55 transition-colors hover:text-white"
          >
            + New home
          </button>
        )}
      </div>

      {/* 100 = pt-2 (8) + bar (48) + mb-9 (36) + pb-2 (8). Reserving MORE than
          the chrome actually takes is what created the slack the device used to
          centre in. One number now, because the bar is always there. */}
      <DeviceFrame
        kind={kind}
        chromeGap={100}
        orientation={isPhone ? undefined : orientation}
        align="start"
      >
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

    </main>
    </MotionConfig>
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
