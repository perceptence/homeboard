"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import { DeviceFrame } from "@/components/DeviceFrame";
import { Icon } from "@/components/Icons";
import { Toast } from "@/components/ui";
import { useHousehold } from "@/lib/store";
import { Sheets } from "@/surfaces/Sheets";
import { IpadShell } from "@/surfaces/ipad/IpadShell";
import { PhoneShell } from "@/surfaces/phone/PhoneShell";
import { Label } from "./kit";
import { useInView } from "./useInView";

/**
 * ONE SCENE, PLAYED ON BOTH DEVICES — a directed camera over two live apps.
 *
 * The first cut of this section ran four store actions on a timer and asked the
 * reader to notice what changed. Nobody could: the actions were invisible, the
 * reactions were three hundred pixels away, and "watch both devices" is not an
 * instruction human eyes can follow. A walkthrough with no camera is a list.
 *
 * So this is a single use case, directed. The camera zooms to the board's
 * headline count and tells you to remember it. It travels to Sam's phone,
 * scrolls his list to the evening chore, and PRESSES THE REAL BUTTON — a
 * visible fingertip lands on the actual DOM node and calls click() on it, the
 * same handler a thumb fires. Then it pulls back out, returns to the board,
 * and rings the number that moved. One tap, one truth, both surfaces.
 *
 * Everything on stage is live. The zoom is a transform over the devices
 * themselves (real DOM scales losslessly — that is the point of embedding the
 * product instead of screenshotting it), and the choreography deliberately
 * passes through identity between moves, which is also what keeps the camera
 * maths simple: every measurement happens at scale 1.
 */

export const SCENE = {
  /** The chore the fingertip presses. Pinned by a test against the seed. */
  taskTitle: "Take out the trash",
  persona: "sam" as const,
} as const;

type Cam = { x: number; y: number; scale: number };
const IDENTITY: Cam = { x: 0, y: 0, scale: 1 };

/** The steps, for the caption's "step n of…" index. */
const STEPS = [
  "The board, before",
  "Over to the phone",
  "The chore",
  "The tap",
  "Back out",
  "The board, after",
] as const;

const st = () => useHousehold.getState();

export function Duet() {
  const s = useHousehold();

  const phoneHost = useRef<HTMLDivElement>(null);
  const padHost = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const cameraRef = useRef<HTMLDivElement>(null);
  const snapshot = useRef<ReturnType<typeof useHousehold.getState> | null>(null);
  const stopRef = useRef(false);

  const [mounted, setMounted] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [done, setDone] = useState(false);
  const [cam, setCam] = useState<Cam>(IDENTITY);
  const [tapAt, setTapAt] = useState<{ x: number; y: number } | null>(null);
  const [pulse, setPulse] = useState<{ w: number; h: number } | null>(null);
  const [caption, setCaption] = useState<{
    step: number; side: "phone" | "ipad" | null; title: string; body: string;
  }>({
    step: 0, side: null,
    title: "One scene, on both devices",
    body: "Press play. The camera zooms to the board's count, follows a real tap on Sam's phone, and comes back to watch the number move.",
  });

  /* Mount after hydration AND only while near the viewport — see useInView.
     If the reader scrolls away mid-scene the shells unmount, so the scene
     stops itself rather than pressing buttons that no longer exist. */
  const root = useRef<HTMLDivElement>(null);
  const near = useInView(root, { once: false, rootMargin: "800px" });
  useEffect(() => {
    if (near) useHousehold.persist.rehydrate();
    else stopRef.current = true;
    setMounted(near);
  }, [near]);

  /* Take the household as we found it, so Put-it-back restores it exactly —
     this store is shared with the embed above. */
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

  const stage = useCallback(() => {
    const g = st();
    g.setPersona(SCENE.persona);
    g.goPhone("today");
    g.goIpad("today");
    g.closeSheet();
  }, []);

  const say = (step: number, side: "phone" | "ipad" | null, title: string, body: string) =>
    setCaption({ step, side, title, body });

  /** Sleep, unless the scene was stopped — then bail out of the whole timeline. */
  const tick = async (ms: number) => {
    await new Promise((r) => setTimeout(r, ms));
    if (stopRef.current) throw new Error("stopped");
  };

  /* ── the camera ────────────────────────────────────────────────────────
     All rects are measured AT IDENTITY (the choreography always returns to
     scale 1 before the next move). With transform-origin 0 0 on the camera,
     a camera-local point q lands at  o + q·s + t  in stage space, where o is
     the camera's resting offset inside the stage. Solve for t so the target's
     centre lands on the stage's centre. */
  const zoomTo = (el: Element, pad = 24, maxS = 2.1) => {
    const sr = stageRef.current!.getBoundingClientRect();
    const cr = cameraRef.current!.getBoundingClientRect();
    const tr = el.getBoundingClientRect();
    const scale = Math.min(
      maxS,
      Math.max(1.15, 0.85 * Math.min(sr.width / (tr.width + pad * 2), sr.height / (tr.height + pad * 2))),
    );
    const o = { x: cr.left - sr.left, y: cr.top - sr.top };
    const q = { x: tr.left + tr.width / 2 - cr.left, y: tr.top + tr.height / 2 - cr.top };
    const t = { x: sr.width / 2 - o.x - q.x * scale, y: sr.height / 2 - o.y - q.y * scale };
    return {
      cam: { x: t.x, y: t.y, scale },
      tw: tr.width * scale,
      th: tr.height * scale,
      /** Where some OTHER element ends up in stage space under this transform —
       *  how the fingertip finds the Done button while the CARD is centred. */
      at: (el2: Element) => {
        const r2 = el2.getBoundingClientRect();
        return {
          x: o.x + (r2.left + r2.width / 2 - cr.left) * scale + t.x,
          y: o.y + (r2.top + r2.height / 2 - cr.top) * scale + t.y,
        };
      },
    };
  };

  /* ── finding the actors ──────────────────────────────────────────────── */

  /** The board's hero sentence ("… has N things on today, M already done."). */
  const findBoardHero = () => {
    const pad = padHost.current;
    if (!pad) return null;
    const els = [...pad.querySelectorAll<HTMLElement>("div,p,span")]
      .filter((e) => /things on/.test(e.textContent ?? "") && /already done/.test(e.textContent ?? ""))
      .sort((a, b) => (a.textContent?.length ?? 0) - (b.textContent?.length ?? 0));
    const el = els[0];
    if (!el) return null;
    return { el, zoomEl: (el.closest(".bg-lemon") as HTMLElement) ?? el };
  };

  const countsOf = (el: Element) => {
    const m = (el.textContent ?? "").match(/has (\d+) things on today, (\d+) already done/);
    return m ? { open: Number(m[1]), done: Number(m[2]) } : null;
  };

  /** The chore's card and its real Done button, inside the phone. */
  const findPhoneCard = () => {
    const ph = phoneHost.current;
    if (!ph) return null;
    for (const button of [...ph.querySelectorAll<HTMLElement>("button")]) {
      if (button.textContent?.trim() !== "Done") continue;
      let card: HTMLElement | null = button;
      for (let hops = 0; card && hops < 9; hops++) {
        if (card.textContent?.includes(SCENE.taskTitle)) return { card, button };
        card = card.parentElement;
      }
    }
    return null;
  };

  /** Scroll the phone's OWN list so the card is centred — converting the visual
   *  delta back to layout px, because the phone renders at true size inside a
   *  scale transform and scrollTop speaks layout, not pixels-on-screen. */
  const scrollPhoneTo = (card: HTMLElement) => {
    let n: HTMLElement | null = card.parentElement;
    while (n && n !== phoneHost.current) {
      if (/auto|scroll/.test(getComputedStyle(n).overflowY)) break;
      n = n.parentElement;
    }
    if (!n || n === phoneHost.current) return;
    const frameScale = card.getBoundingClientRect().width / (card.offsetWidth || 1) || 1;
    const cr = card.getBoundingClientRect();
    const nr = n.getBoundingClientRect();
    const deltaVisual = cr.top + cr.height / 2 - (nr.top + nr.height / 2);
    n.scrollBy({ top: deltaVisual / frameScale, behavior: "smooth" });
  };

  /* ── the scene itself ────────────────────────────────────────────────── */
  const play = async () => {
    if (playing || !mounted) return;
    stopRef.current = false;
    setDone(false);
    setPlaying(true);
    try {
      if (!snapshot.current) capture();
      else restore(); // replays start from the same household, chore un-done
      stage();
      await tick(900);

      // 1 — the board, before. Plant the number.
      const before = findBoardHero();
      if (!before) throw new Error("stage");
      const n0 = countsOf(before.el);
      setCam(zoomTo(before.zoomEl, 28, 1.8).cam);
      say(1, "ipad", "The board, before",
        n0
          ? `${n0.open} things on today, ${n0.done} already done. Keep hold of those two numbers.`
          : "Keep hold of the day's count.");
      await tick(3000);

      // 2 — travel.
      setCam(IDENTITY);
      say(2, null, "Over to Sam's phone", "Same household — one person's slice of it.");
      await tick(1150);

      // 3 — the chore. Scroll his list, then close in on the card.
      const found = findPhoneCard();
      if (!found) throw new Error("stage");
      scrollPhoneTo(found.card);
      await tick(700);
      const z = zoomTo(found.card, 48, 2.1);
      setCam(z.cam);
      say(3, "phone", "His evening chore",
        "“Take out the trash”, due at eight. That Done button is the app's own — watch it get pressed.");
      await tick(1900);

      // 4 — the tap. A fingertip lands on the real button, then click()s it.
      setTapAt(z.at(found.button));
      await tick(520);
      found.button.click(); // the same handler a thumb fires
      await tick(420);
      setTapAt(null);
      say(4, "phone", "One tap",
        "A real click on the real button — the card marks done and slides off his day.");
      await tick(1900);

      // 5 — back out. Both devices in view again.
      setCam(IDENTITY);
      say(5, null, "And the board already knows", "No refresh, no sync step — there is only one store for it to read.");
      await tick(1200);

      // 6 — the board, after. Ring the number that moved.
      const after = findBoardHero();
      if (!after) throw new Error("stage");
      const n1 = countsOf(after.el);
      const zb = zoomTo(after.zoomEl, 28, 1.8);
      setCam(zb.cam);
      setPulse({ w: zb.tw + 20, h: zb.th + 20 });
      say(6, "ipad", "The board, after",
        n0 && n1
          ? `${n0.open} became ${n1.open}. ${n0.done} became ${n1.done}. It moved in the same frame as the tap.`
          : "The count moved in the same frame as the tap.");
      await tick(3200);
      setPulse(null);

      // curtain.
      setCam(IDENTITY);
      say(0, null, "That's the whole product",
        "Two applications over one truth. Both devices are still live — click around in them.");
      setDone(true);
    } catch (e) {
      setCam(IDENTITY);
      setTapAt(null);
      setPulse(null);
      if ((e as Error).message === "stage") {
        say(0, null, "Couldn't stage the scene", "Press “Put it back”, then play again.");
      } else {
        say(0, null, "Stopped", "The household stays as it is — “Put it back” restores it.");
      }
    } finally {
      setPlaying(false);
    }
  };

  const stop = () => { stopRef.current = true; };

  const reset = useCallback(() => {
    stopRef.current = true;
    restore();
    stage();
    setCam(IDENTITY);
    setTapAt(null);
    setPulse(null);
    setDone(false);
    say(0, null, "One scene, on both devices",
      "Press play. The camera zooms to the board's count, follows a real tap on Sam's phone, and comes back to watch the number move.");
  }, [restore, stage]);

  const clearToast = useCallback(() => st().notify(null), []);

  return (
    <MotionConfig reducedMotion="user">
    <div ref={root}>
      {/* THE STAGE — the app's own bg-room gradient, and a hard overflow clip:
          the zoom is a transform on everything inside, and the stage's edge is
          the camera's frame. */}
      <div
        ref={stageRef}
        className="relative overflow-hidden rounded-card bg-room ring-1 ring-inset ring-ink/10"
      >
        <motion.div
          ref={cameraRef}
          className="p-inner will-change-transform"
          style={{ transformOrigin: "0 0" }}
          animate={cam}
          transition={{ duration: 0.85, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="grid items-end gap-inner lg:grid-cols-[minmax(0,1.62fr)_minmax(0,1fr)]">
            {/* iPad — the family board. */}
            <figure className="m-0 flex min-w-0 flex-col">
              <figcaption className="mb-3 flex items-baseline gap-2">
                <span
                  className={clsx(
                    "rounded-pill px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.12em] transition-colors",
                    caption.side === "ipad" ? "bg-ink text-lemon" : "bg-ink/[.07] text-sub",
                  )}
                >
                  Family iPad
                </span>
                <span className="text-micro text-sub">the room&rsquo;s view</span>
              </figcaption>
              <div ref={padHost} className="flex h-[300px] w-full items-center justify-center sm:h-[380px]">
                <DeviceFrame kind="tablet" host={padHost} orientation="landscape">
                  {mounted && (
                    <>
                      <IpadShell />
                      <Sheets variant="ipad" />
                    </>
                  )}
                </DeviceFrame>
              </div>
            </figure>

            {/* Phone — one person's lens. */}
            <figure className="m-0 flex min-w-0 flex-col">
              <figcaption className="mb-3 flex items-baseline gap-2">
                <span
                  className={clsx(
                    "rounded-pill px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.12em] transition-colors",
                    caption.side === "phone" ? "bg-ink text-lemon" : "bg-ink/[.07] text-sub",
                  )}
                >
                  Sam&rsquo;s phone
                </span>
                <span className="text-micro text-sub">one person&rsquo;s lens</span>
              </figcaption>
              <div ref={phoneHost} className="flex h-[300px] w-full items-center justify-center sm:h-[380px]">
                <DeviceFrame kind="phone" host={phoneHost}>
                  {mounted && (
                    <>
                      <PhoneShell />
                      <Sheets variant="phone" />
                      <Toast
                        message={s.toast}
                        who={s.toastWho ? s.members[s.toastWho] : undefined}
                        onDone={clearToast}
                        onUndo={s.toastUndo ?? undefined}
                      />
                    </>
                  )}
                </DeviceFrame>
              </div>
            </figure>
          </div>
        </motion.div>

        {/* THE FINGERTIP — lands on the real button's mapped position, presses,
            and a ring rolls off it. Outside the camera, so it doesn't scale. */}
        <AnimatePresence>
          {tapAt && (
            <motion.div
              key="tap"
              className="pointer-events-none absolute z-30"
              style={{ left: tapAt.x, top: tapAt.y }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.span
                className="absolute -left-[18px] -top-[18px] block h-9 w-9 rounded-pill bg-ink/85 ring-2 ring-lemon shadow-e3"
                initial={{ scale: 0.4 }}
                animate={{ scale: [0.4, 1, 0.8, 1] }}
                transition={{ duration: 0.7, times: [0, 0.45, 0.7, 1] }}
              />
              <motion.span
                className="absolute -left-[18px] -top-[18px] block h-9 w-9 rounded-pill border-2 border-ink/50"
                initial={{ scale: 0.6, opacity: 0.9 }}
                animate={{ scale: 2.1, opacity: 0 }}
                transition={{ duration: 0.9, ease: "easeOut", delay: 0.35 }}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* THE RING around what changed — centred, because the camera centred it. */}
        <AnimatePresence>
          {pulse && (
            <motion.div
              key="pulse"
              className="pointer-events-none absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2 rounded-card border-2 border-ink/70"
              style={{ width: pulse.w, height: pulse.h }}
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 1, 0.35, 1, 0.6] }}
              exit={{ opacity: 0 }}
              transition={{ duration: 2.2 }}
            />
          )}
        </AnimatePresence>
      </div>

      {/* THE NARRATION — under the stage: what just happened, and where to look. */}
      <div className="mt-tile grid gap-tile lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
        <div className="min-w-0 rounded-card bg-white/[.06] p-card-pad">
          <motion.div key={`${caption.step}-${caption.title}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
            <Label className="!text-lemon">
              {caption.step > 0 ? `Scene · ${caption.step} of ${STEPS.length} — ${STEPS[caption.step - 1]}` : "Scene"}
            </Label>
            <p className="mt-2 text-body font-medium text-white">{caption.title}</p>
            <p className="mt-1.5 flex items-start gap-2 text-bodysm leading-relaxed text-white/60">
              <span className="mt-0.5 shrink-0 text-lemon"><Icon name="arrow" size={14} /></span>
              {caption.body}
            </p>
          </motion.div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={playing ? stop : play}
            disabled={!mounted}
            className={clsx(
              "flex h-ctl items-center gap-2 rounded-pill bg-lemon px-5 text-bodysm font-semibold text-ink transition-opacity hover:opacity-90",
              !mounted && "cursor-not-allowed opacity-40",
            )}
          >
            {playing ? "Stop" : done ? "Play it again" : "Play the scene"}
          </button>
          <button
            onClick={reset}
            disabled={playing || !snapshot.current}
            className={clsx(
              "flex h-ctl items-center gap-2 rounded-pill px-4 text-bodysm font-medium transition-colors",
              playing || !snapshot.current
                ? "cursor-not-allowed text-white/30"
                : "text-white/70 hover:bg-white/10 hover:text-white",
            )}
          >
            <Icon name="undo" size={15} /> Put it back
          </button>
        </div>
      </div>

      <p className="mt-4 text-bodysm leading-relaxed text-white/60">
        Both devices above are the real shells, mounted side by side in this page and reading one
        Zustand store — the same store the section above uses. The scene presses a real button with
        a real <code className="font-mono text-[12px] text-white/75">click()</code>; nothing is
        simulated, which is why you can interrupt it, click around yourself, and{" "}
        <span className="text-white/85">the two surfaces can never disagree</span>.{" "}
        {s.tasks.filter((t) => !t.done).length} open tasks right now, on both.
      </p>
    </div>
    </MotionConfig>
  );
}
