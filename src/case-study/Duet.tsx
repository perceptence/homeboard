"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { MotionConfig, motion } from "framer-motion";
import { DeviceFrame } from "@/components/DeviceFrame";
import { Icon } from "@/components/Icons";
import { useHousehold } from "@/lib/store";
import { todayIso } from "@/lib/dates";
import { Sheets } from "@/surfaces/Sheets";
import { IpadShell } from "@/surfaces/ipad/IpadShell";
import { PhoneShell } from "@/surfaces/phone/PhoneShell";
import { Label } from "./kit";
import { useInView } from "./useInView";

/**
 * ONE HOUSEHOLD, TWO SURFACES — both running, at once, off the same store.
 *
 * This is the part of the product that a gallery of screenshots cannot show and
 * a single embedded device cannot either: the iPad is not the phone at a larger
 * size. It is a different application over the same data. The phone answers
 * "what do I owe the house today"; the board answers "how is the house doing" —
 * different screens, different information architecture, different verbs. The
 * only thing they share is the truth underneath.
 *
 * So: mount both. `IpadShell` reads no persona (the board belongs to the room,
 * not a person), and `PhoneShell` scopes itself to `currentMember` — so setting
 * the persona once gives a genuine pair, one lens each, live. Then drive real
 * store actions and let the reader watch the other surface answer.
 *
 * Nothing here simulates anything. `toggleTask`, `addTask`, `setPresence` and
 * `rebalance` are the same actions a tap fires.
 */

type Beat = {
  /** Which device performs the action — that one lifts, the other reacts. */
  actor: "phone" | "ipad";
  title: string;
  /** What to look for on the OTHER surface. */
  watch: string;
  run: () => void;
};

const st = () => useHousehold.getState();
const taskId = (title: string) => st().tasks.find((t) => t.title === title && !t.done)?.id;

/** The person whose phone we're watching. */
const ME = "sam";

const BEATS: Beat[] = [
  {
    actor: "phone",
    title: "Sam ticks the bins off his own list.",
    watch: "The board drops it from tonight and the day's count falls — no refresh, no sync step.",
    run: () => {
      const id = taskId("Take out the trash") ?? st().tasks.find((t) => !t.done && t.owner === ME)?.id;
      if (id != null) st().toggleTask(id);
    },
  },
  {
    actor: "ipad",
    title: "Someone adds the school run at the family board.",
    watch: "It lands on Sam's phone already assigned — the board decided who, and said why.",
    run: () => {
      st().addTask({
        title: "Collect Ada from swimming",
        owner: ME, when: "5:30 PM", due: todayIso(), priority: "high",
      });
    },
  },
  {
    actor: "ipad",
    title: "Leo is marked away for a few days.",
    watch: "The board immediately flags the work that just lost its owner. Nobody had to notice.",
    run: () => {
      const to = new Date(); to.setDate(to.getDate() + 4);
      st().setPresence("leo", "away", { from: todayIso(), to: to.toISOString().slice(0, 10) });
      st().goIpad("today");
    },
  },
  {
    actor: "ipad",
    title: "The board evens out the week.",
    watch: "One task changes hands. Both surfaces agree in the same frame, because there is only one of them.",
    run: () => st().rebalance(),
  },
];

export function Duet() {
  const s = useHousehold();
  const [i, setI] = useState(-1);          // -1 = idle, before the first beat
  const [playing, setPlaying] = useState(false);
  const phoneHost = useRef<HTMLDivElement>(null);
  const padHost = useRef<HTMLDivElement>(null);
  const snapshot = useRef<ReturnType<typeof useHousehold.getState> | null>(null);
  const [mounted, setMounted] = useState(false);

  /* Mount after hydration AND after this section is reached — everything below
     reads the local clock and a rehydrated store (so server-rendering it
     guarantees a text mismatch), and running two more copies of the product
     before the reader gets here is what stopped the browser painting at all. */
  const root = useRef<HTMLDivElement>(null);
  const near = useInView(root, { once: false, rootMargin: "800px" });
  useEffect(() => {
    if (near) useHousehold.persist.rehydrate();
    setMounted(near);
  }, [near]);

  /* Take the household as we found it, so Restart can put it back exactly.
     A walkthrough that permanently rearranges the demo would poison every
     section after it — this one shares its store with the embed above. */
  const capture = useCallback(() => {
    const g = st();
    snapshot.current = { ...g, tasks: [...g.tasks], events: [...g.events], activity: [...g.activity] } as never;
  }, []);

  const restore = useCallback(() => {
    const snap = snapshot.current;
    if (!snap) return;
    useHousehold.setState({
      tasks: [...snap.tasks], events: [...snap.events],
      activity: [...snap.activity], members: snap.members,
      toast: null, toastUndo: null, sheet: null,
    });
  }, []);

  /* Put both surfaces where the walkthrough expects them. */
  const stage = useCallback(() => {
    const g = st();
    g.setPersona(ME);
    g.goPhone("today");
    g.goIpad("today");
    g.closeSheet();
  }, []);

  const start = useCallback(() => {
    if (!snapshot.current) capture();
    else restore();
    stage();
    setI(0);
    setPlaying(true);
  }, [capture, restore, stage]);

  const reset = useCallback(() => {
    setPlaying(false);
    restore();
    stage();
    setI(-1);
  }, [restore, stage]);

  /* Run the current beat, then queue the next. Pausing stops the queue, not the
     state — you keep whatever the household has already become. */
  useEffect(() => {
    if (!playing || i < 0 || i >= BEATS.length) return;
    BEATS[i].run();
    if (i === BEATS.length - 1) { setPlaying(false); return; }
    const t = setTimeout(() => setI((n) => n + 1), 3600);
    return () => clearTimeout(t);
  }, [i, playing]);

  const beat = i >= 0 ? BEATS[Math.min(i, BEATS.length - 1)] : null;
  const done = i >= BEATS.length - 1 && !playing && i >= 0;

  const clearToast = useCallback(() => st().notify(null), []);

  return (
    <div ref={root}>
      {/* THE STAGE. A light surface, and specifically the app's own `bg-room`
          gradient — the backdrop the product already sits on in its preview.
          Two near-black devices on a near-black page was three blacks stacked;
          the devices had no edge and the section read as a smudge. */}
      <div className="overflow-hidden rounded-card bg-room p-inner ring-1 ring-inset ring-ink/10">
        <div className="grid items-end gap-inner lg:grid-cols-[minmax(0,1.62fr)_minmax(0,1fr)]">
          {/* iPad — the family board. */}
          <figure className="m-0 flex min-w-0 flex-col">
            <figcaption className="mb-3 flex items-baseline gap-2">
              <span
                className={clsx(
                  "rounded-pill px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.12em] transition-colors",
                  beat?.actor === "ipad" ? "bg-ink text-lemon" : "bg-ink/[.07] text-sub",
                )}
              >
                Family iPad
              </span>
              <span className="text-micro text-sub">the room&rsquo;s view</span>
            </figcaption>
            <div ref={padHost} className="flex h-[300px] w-full items-center justify-center sm:h-[380px]">
              <MotionConfig reducedMotion="user">
                <DeviceFrame kind="tablet" host={padHost} orientation="landscape">
                  {mounted && (
                    <>
                      <IpadShell />
                      <Sheets variant="ipad" />
                    </>
                  )}
                </DeviceFrame>
              </MotionConfig>
            </div>
          </figure>

          {/* Phone — one person's lens. */}
          <figure className="m-0 flex min-w-0 flex-col">
            <figcaption className="mb-3 flex items-baseline gap-2">
              <span
                className={clsx(
                  "rounded-pill px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.12em] transition-colors",
                  beat?.actor === "phone" ? "bg-ink text-lemon" : "bg-ink/[.07] text-sub",
                )}
              >
                Sam&rsquo;s phone
              </span>
              <span className="text-micro text-sub">one person&rsquo;s lens</span>
            </figcaption>
            <div ref={phoneHost} className="flex h-[300px] w-full items-center justify-center sm:h-[380px]">
              <MotionConfig reducedMotion="user">
                <DeviceFrame kind="phone" host={phoneHost}>
                  {mounted && (
                    <>
                      <PhoneShell />
                      <Sheets variant="phone" />
                    </>
                  )}
                </DeviceFrame>
              </MotionConfig>
            </div>
          </figure>
        </div>
      </div>

      {/* THE NARRATION — under the stage, on the page's own ink, so the light
          stage stays a stage and the reading stays reading. */}
      <div className="mt-tile grid gap-tile lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
        <div className="min-w-0 rounded-card bg-white/[.06] p-card-pad">
          {beat ? (
            <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
              <Label className="!text-lemon">
                Step {i + 1} of {BEATS.length} · on the {beat.actor === "ipad" ? "board" : "phone"}
              </Label>
              <p className="mt-2 text-body font-medium text-white">{beat.title}</p>
              <p className="mt-1.5 flex items-start gap-2 text-bodysm leading-relaxed text-white/60">
                <span className="mt-0.5 shrink-0 text-lemon"><Icon name="arrow" size={14} /></span>
                {beat.watch}
              </p>
            </motion.div>
          ) : (
            <div>
              <Label className="!text-lemon">Walkthrough</Label>
              <p className="mt-2 text-body font-medium text-white">
                Four moves across two devices, on one household.
              </p>
              <p className="mt-1.5 text-bodysm leading-relaxed text-white/60">
                Press play. Every action below is a real store action — the same one a tap fires —
                so both surfaces answer at once, because there is only one of them underneath.
              </p>
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={playing ? () => setPlaying(false) : (i < 0 || done ? start : () => setPlaying(true))}
            className="flex h-ctl items-center gap-2 rounded-pill bg-lemon px-5 text-bodysm font-semibold text-ink transition-opacity hover:opacity-90"
          >
            {playing ? "Pause" : done ? "Play again" : i < 0 ? "Play the walkthrough" : "Resume"}
          </button>
          <button
            onClick={reset}
            disabled={i < 0}
            className={clsx(
              "flex h-ctl items-center gap-2 rounded-pill px-4 text-bodysm font-medium transition-colors",
              i < 0 ? "cursor-not-allowed text-white/30" : "text-white/70 hover:bg-white/10 hover:text-white",
            )}
          >
            <Icon name="undo" size={15} /> Put it back
          </button>
        </div>
      </div>

      {/* The beats, as a legible index — and a progress read for anyone who
          would rather not sit through the timing. */}
      <ol className="mt-tile grid gap-1 sm:grid-cols-2 lg:grid-cols-4">
        {BEATS.map((b, n) => {
          const on = n === i;
          const past = n < i;
          return (
            <li key={b.title}>
              <button
                onClick={() => { if (!snapshot.current) capture(); setPlaying(false); setI(n); }}
                aria-current={on ? "step" : undefined}
                className={clsx(
                  "h-full w-full rounded-md px-3 py-2.5 text-left transition-colors",
                  on ? "bg-lemon text-ink" : past ? "bg-white/[.10] text-white/70" : "bg-white/[.04] text-white/60 hover:bg-white/10",
                )}
              >
                <span className={clsx("font-mono text-[10px] font-bold", on ? "text-ink/70" : "text-white/60")}>
                  {String(n + 1).padStart(2, "0")}
                </span>
                <span className="mt-1 block text-micro leading-[16px]">{b.title}</span>
              </button>
            </li>
          );
        })}
      </ol>

      <p className="mt-4 text-bodysm leading-relaxed text-white/60">
        Both devices above are the real shells, mounted side by side in this page and reading one
        Zustand store — which is also the store the section above uses, so anything you change here
        is still changed up there. That is the architecture, not a trick for the demo:{" "}
        <span className="text-white/85">the surfaces are different applications over identical truth.</span>{" "}
        {s.tasks.filter((t) => !t.done).length} open tasks right now, on both.
      </p>
    </div>
  );
}
