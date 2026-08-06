"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { AnimatePresence, MotionConfig, motion, useAnimationControls } from "framer-motion";
import { DeviceFrame } from "@/components/DeviceFrame";
import { Icon } from "@/components/Icons";
import { Toast } from "@/components/ui";
import { ease } from "@/lib/motion";
import { useHousehold } from "@/lib/store";
import { Sheets } from "@/surfaces/Sheets";
import { IpadShell } from "@/surfaces/ipad/IpadShell";
import { PhoneShell } from "@/surfaces/phone/PhoneShell";
import { Label } from "./kit";
import { useInView } from "./useInView";

/**
 * ONE SCENE, ON TWO LIVE SURFACES — a directed camera over the running product.
 *
 * Rules of the cinematography, learned the hard way:
 *
 *   THE CAMERA AND THE CONTENT NEVER MOVE AT ONCE. The first cut zoomed while
 *   the surfaces were still playing their entrance stagger, and scrolled the
 *   phone while measuring it — every move landed on a target that was itself
 *   mid-flight. Now the scene opens with a curtain beat that lets both screens
 *   arrive; the phone's scroll gets its own beat and is POLLED until the card
 *   stops moving; only then does anything get measured.
 *
 *   EVERY MEASUREMENT HAPPENS AT SCALE 1. All rects for a device are taken in
 *   one identity pass — the chore card, its button, the hero count — and every
 *   camera position is solved from those. That's what lets the camera PAN
 *   between two zoomed positions (card → hero) without ever passing through
 *   identity: both were solved from the same resting geometry. (The previous
 *   cut computed the fingertip's position AFTER zooming, from a rect that was
 *   already transformed — which is why the tap could land beside the button.)
 *
 *   EVERY MOVE IS AWAITED, NOT TIMED. The camera runs on animation controls;
 *   each start() resolves when the move actually completes. No guessed
 *   setTimeouts racing a 0.85s tween.
 *
 *   THE PRESS IS REAL. pointerdown, a beat, pointerup, click — dispatched on
 *   the app's own <Button>, whose whileTap compresses exactly as it does under
 *   a thumb. The card's departure is the app's own completion exit (built
 *   because this camera exposed its absence), and the list closes ranks with
 *   layout animation. Nothing on stage is a special effect.
 */

export const SCENE = {
  /** The chore the fingertip presses. Pinned by a test against the seed. */
  taskTitle: "Take out the trash",
  persona: "sam" as const,
} as const;

type Cam = { x: number; y: number; scale: number };
const IDENTITY: Cam = { x: 0, y: 0, scale: 1 };

/** Camera grammar: arrivals are slower than departures; a pan is slowest. */
const MOVE = {
  in: { duration: 1.1, ease },
  out: { duration: 0.9, ease },
  pan: { duration: 1.35, ease },
} as const;

const STEPS = [
  "The board, before",
  "Across to the phone",
  "The chore",
  "The press",
  "His count",
  "Pull back",
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
  const cam = useAnimationControls();

  const [mounted, setMounted] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [done, setDone] = useState(false);
  const [tap, setTap] = useState<{ x: number; y: number; phase: "land" | "press" | "lift" } | null>(null);
  const [pulse, setPulse] = useState<{ w: number; h: number } | null>(null);
  const [caption, setCaption] = useState<{
    step: number; side: "phone" | "ipad" | null; title: string; body: string;
  }>({
    step: 0, side: null,
    title: "One scene, on two live surfaces",
    body: "Press play — the camera zooms to the board's number, walks over to Sam's phone, presses the real Done button, and follows the change back.",
  });

  /* Mount only while near the viewport; scrolling away mid-scene stops the
     show rather than pressing buttons that no longer exist. */
  const root = useRef<HTMLDivElement>(null);
  const near = useInView(root, { once: false, rootMargin: "800px" });
  useEffect(() => {
    if (near) useHousehold.persist.rehydrate();
    else stopRef.current = true;
    setMounted(near);
  }, [near]);

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

  /** Hold, unless the scene was stopped. */
  const hold = async (ms: number) => {
    await new Promise((r) => setTimeout(r, ms));
    if (stopRef.current) throw new Error("stopped");
  };

  /** An awaited camera move — resolves when the tween actually finishes. */
  const move = async (to: Cam, t: { duration: number; ease: readonly number[] }) => {
    await cam.start(to, t as never);
    if (stopRef.current) throw new Error("stopped");
  };

  /** Poll an element until it stops moving (scroll settle), capped. */
  const waitStill = async (el: Element, cap = 1800) => {
    let last = el.getBoundingClientRect().top;
    let still = 0;
    const t0 = performance.now();
    while (performance.now() - t0 < cap && still < 3) {
      await new Promise((r) => setTimeout(r, 60));
      if (stopRef.current) throw new Error("stopped");
      const now = el.getBoundingClientRect().top;
      if (Math.abs(now - last) < 0.5) still += 1; else still = 0;
      last = now;
    }
  };

  /* ── camera solving (all inputs measured at identity) ─────────────────
     With transform-origin 0 0, a camera-local point q renders at o + q·s + t
     in stage space (o = the camera's resting offset). Solve t so the target's
     centre sits on the stage's centre; `at` maps any OTHER identity rect
     through the same solution — how the fingertip finds the button while the
     card is what's centred. */
  const solve = (el: Element, pad = 24, maxS = 2.1) => {
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

  const findBoardSentence = () => {
    const pad = padHost.current;
    if (!pad) return null;
    return [...pad.querySelectorAll<HTMLElement>("div,p,span")]
      .filter((e) => /things on/.test(e.textContent ?? "") && /already done/.test(e.textContent ?? ""))
      .sort((a, b) => (a.textContent?.length ?? 0) - (b.textContent?.length ?? 0))[0] ?? null;
  };

  const boardCounts = (el: Element) => {
    const m = (el.textContent ?? "").match(/has (\d+) things on today, (\d+) already done/);
    return m ? { open: Number(m[1]), done: Number(m[2]) } : null;
  };

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

  /** The phone's hero count ("You have N tasks / for today"). */
  const findPhoneHero = () => {
    const ph = phoneHost.current;
    if (!ph) return null;
    return [...ph.querySelectorAll<HTMLElement>('[class*="text-display"]')]
      .find((e) => /You have|Nothing to|caught up/.test(e.textContent ?? "")) ?? null;
  };

  const heroLine = (el: Element | null) =>
    (el?.textContent ?? "").replace(/\s+/g, " ").trim();

  /** Scroll the phone's own list so the card is centred — visual delta ÷ frame
   *  scale, because scrollTop speaks layout px inside a scale transform. */
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
    n.scrollBy({ top: (cr.top + cr.height / 2 - (nr.top + nr.height / 2)) / frameScale, behavior: "smooth" });
  };

  /** A real press: down, a beat, up, click — so the app's whileTap plays. */
  const press = async (button: HTMLElement, tapXY: { x: number; y: number }) => {
    const fire = (type: string) =>
      button.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 1, isPrimary: true, pointerType: "touch" }));
    setTap({ ...tapXY, phase: "land" });
    await hold(420);
    setTap({ ...tapXY, phase: "press" });
    fire("pointerdown");
    await hold(260);
    fire("pointerup");
    button.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    setTap({ ...tapXY, phase: "lift" });
    await hold(360);
    setTap(null);
  };

  /* ── the scene ───────────────────────────────────────────────────────── */
  const play = async () => {
    if (playing || !mounted) return;
    stopRef.current = false;
    setDone(false);
    setPlaying(true);
    try {
      // CURTAIN. Restore, stage, and let both entrances finish before any move.
      if (!snapshot.current) capture();
      else restore();
      stage();
      say(0, null, "Curtain up", "Both surfaces arrive on the same household — the room's evening on the left, Sam's on the right.");
      await hold(1600);

      // 1 — THE BOARD, BEFORE. Tight on the sentence; plant the numbers.
      const sentence0 = findBoardSentence();
      if (!sentence0) throw new Error("stage");
      const n0 = boardCounts(sentence0);
      say(1, "ipad", "The board, before",
        n0 ? `${n0.open} things on today, ${n0.done} already done. Hold those two numbers.` : "Hold the day's count.");
      await move(solve(sentence0, 26, 2.35).cam, MOVE.in);
      await hold(2900);

      // 2 — ACROSS. Out to identity; the phone finds the chore on its own.
      say(2, "phone", "Across to Sam's phone", "Same store, one person's slice — his list scrolls to the evening chore.");
      await move(IDENTITY, MOVE.out);
      const found = findPhoneCard();
      if (!found) throw new Error("stage");
      scrollPhoneTo(found.card);
      await waitStill(found.card);
      await hold(350);

      // ONE identity pass for everything the phone act needs.
      const hero = findPhoneHero();
      const heroBefore = heroLine(hero);
      const zCard = solve(found.card, 52, 2.05);
      const tapXY = zCard.at(found.button);
      const zHero = hero ? solve(hero, 44, 1.9) : null;

      // 3 — THE CHORE. Close in on the real card.
      say(3, "phone", "Take out the trash — 8 PM",
        "The camera is over the live card. That Done button is the app's own, and it is about to be pressed for real.");
      await move(zCard.cam, MOVE.in);
      await hold(1500);

      // 4 — THE PRESS. Fingertip lands, the button compresses, the card leaves.
      say(4, "phone", "Pressed",
        "A true pointer press — the button compresses, the card takes its leave, and the list closes ranks beneath it.");
      await press(found.button, tapXY);
      await hold(1400); // the completion exit plays out under the held camera

      // 5 — HIS COUNT. Pan up the phone, zoomed the whole way.
      if (zHero) {
        const heroAfter = heroLine(findPhoneHero());
        say(5, "phone", "His day, lighter",
          heroBefore && heroAfter && heroBefore !== heroAfter
            ? `The hero now reads “${heroAfter}” — a moment ago it said “${heroBefore}”.`
            : "The day's count drops in the same breath.");
        await move(zHero.cam, MOVE.pan);
        await hold(2400);
      }

      // 6 — PULL BACK. Both devices in frame.
      say(6, null, "Pull back", "No sync, no refresh — there is only one store for either screen to read.");
      await move(IDENTITY, MOVE.out);
      await hold(1000);

      // 7 — THE BOARD, AFTER. Same sentence, new numbers, one soft ring.
      const sentence1 = findBoardSentence();
      if (!sentence1) throw new Error("stage");
      const n1 = boardCounts(sentence1);
      say(7, "ipad", "The board, after",
        n0 && n1
          ? `${n0.open} became ${n1.open}; ${n0.done} became ${n1.done} — it moved in the frame the button released.`
          : "The count moved in the frame the button released.");
      const zb = solve(sentence1, 26, 2.35);
      await move(zb.cam, MOVE.in);
      setPulse({ w: zb.tw + 28, h: zb.th + 24 });
      await hold(3200);
      setPulse(null);

      // CURTAIN CALL.
      await move(IDENTITY, MOVE.out);
      say(0, null, "Still live",
        "Press Undo on his phone and the board gives the chore back — go on, it's the same store.");
      setDone(true);
    } catch (e) {
      cam.start(IDENTITY, { duration: 0.5, ease } as never);
      setTap(null);
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
    cam.start(IDENTITY, { duration: 0.4, ease } as never);
    setTap(null);
    setPulse(null);
    setDone(false);
    say(0, null, "One scene, on two live surfaces",
      "Press play — the camera zooms to the board's number, walks over to Sam's phone, presses the real Done button, and follows the change back.");
  }, [cam, restore, stage]);

  const clearToast = useCallback(() => st().notify(null), []);

  return (
    <MotionConfig reducedMotion="user">
    <div ref={root}>
      {/* THE STAGE — the app's own room gradient; its edge is the camera's frame. */}
      <div
        ref={stageRef}
        className="relative overflow-hidden rounded-card bg-room ring-1 ring-inset ring-ink/10"
      >
        <motion.div
          ref={cameraRef}
          className="p-inner will-change-transform"
          style={{ transformOrigin: "0 0" }}
          initial={IDENTITY}
          animate={cam}
        >
          <div className="grid items-end gap-inner lg:grid-cols-[minmax(0,1.62fr)_minmax(0,1fr)]">
            <figure className="m-0 flex min-w-0 flex-col">
              <figcaption className="mb-3 flex items-baseline gap-2">
                <span
                  className={clsx(
                    "rounded-pill px-2.5 py-1 font-mono text-micro font-bold uppercase tracking-[0.12em] transition-colors",
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

            <figure className="m-0 flex min-w-0 flex-col">
              <figcaption className="mb-3 flex items-baseline gap-2">
                <span
                  className={clsx(
                    "rounded-pill px-2.5 py-1 font-mono text-micro font-bold uppercase tracking-[0.12em] transition-colors",
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

        {/* THE FINGERTIP — mapped from the button's identity rect through the
            zoom, so it lands ON the button. Its press is synchronised with the
            pointerdown the button actually receives. */}
        <AnimatePresence>
          {tap && (
            <motion.div
              key="tip"
              className="pointer-events-none absolute z-30"
              style={{ left: tap.x, top: tap.y }}
              initial={{ opacity: 0 }}
              animate={{ opacity: tap.phase === "lift" ? 0 : 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <motion.span
                className="absolute -left-[15px] -top-[15px] block h-[30px] w-[30px] rounded-pill border border-ink/40 bg-white/85 shadow-e3"
                initial={{ scale: 1.15, y: -16 }}
                animate={{
                  scale: tap.phase === "press" ? 0.86 : tap.phase === "lift" ? 1.12 : 1,
                  y: tap.phase === "land" ? 0 : tap.phase === "press" ? 1 : -12,
                }}
                transition={{ duration: tap.phase === "press" ? 0.16 : 0.3, ease }}
              />
              {tap.phase === "lift" && (
                <motion.span
                  className="absolute -left-[15px] -top-[15px] block h-[30px] w-[30px] rounded-pill border-2 border-ink/45"
                  initial={{ scale: 0.9, opacity: 0.8 }}
                  animate={{ scale: 2.2, opacity: 0 }}
                  transition={{ duration: 0.55, ease: "easeOut" }}
                />
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* One soft ring around the sentence that changed — centred, because
            the camera centred it. */}
        <AnimatePresence>
          {pulse && (
            <motion.div
              key="pulse"
              className="pointer-events-none absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2 rounded-md border-2 border-ink/60"
              style={{ width: pulse.w, height: pulse.h }}
              initial={{ opacity: 0, scale: 1.06 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.6, ease }}
            />
          )}
        </AnimatePresence>

        {/* While the scene runs, the stage is the director's: a transparent
            shield keeps stray clicks from derailing it. Synthetic dispatch
            doesn't hit-test, so the scene's own press passes through. */}
        {playing && <div className="absolute inset-0 z-40" aria-hidden />}
      </div>

      {/* THE NARRATION. */}
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
        Both devices are the real shells, reading one Zustand store — the same one the section above
        uses. The press is a genuine pointer sequence on the app&rsquo;s own button, so its{" "}
        <code className="font-mono text-micro text-white/75">whileTap</code> compresses exactly as it
        would under a thumb, and the card&rsquo;s exit is the app&rsquo;s own completion animation —
        built because this camera exposed its absence.{" "}
        <span className="text-white/85">Nothing on stage is a special effect.</span>{" "}
        {s.tasks.filter((t) => !t.done).length} open tasks right now, on both.
      </p>
    </div>
    </MotionConfig>
  );
}
