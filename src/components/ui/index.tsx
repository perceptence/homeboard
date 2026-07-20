"use client";

import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { Face } from "@/components/Face";
import { Icon, type IconName } from "@/components/Icons";
import { iso, parse as parseDate, todayIso } from "@/lib/dates";
import { press, smooth, spring } from "@/lib/motion";
import type { Member, Priority } from "@/lib/types";

/* ============================================================
   Card — radius 24, padding 20, soft elevation, hover lifts 2px.
   Only three tones exist: Primary (lemon), Secondary (white),
   Progress (lavender).
   ============================================================ */

export type CardTone = "white" | "lemon" | "lavender" | "mint" | "wash";
export type Pad = "none" | "md" | "lg";

const toneClass: Record<CardTone, string> = {
  white: "bg-card text-ink shadow-e2",
  lemon: "bg-lemon text-ink shadow-e2",
  lavender: "bg-lavender text-ink shadow-e2",
  // The shared-list card — see the mint token. Reserved for the household's
  // collective surfaces; not a general-purpose fourth colour.
  mint: "bg-mint text-ink shadow-e2",
  // The phone's ink-wash idiom, promoted to a tone: a translucent panel that
  // BELONGS to the dark backdrop instead of sitting on it. No shadow — a
  // see-through surface casting elevation reads false. This is the default
  // furniture on a dark canvas; opaque tones are the punctuation.
  wash: "border border-white/10 bg-white/[.06] text-white",
};

const padClass: Record<Pad, string> = {
  none: "p-0",
  md: "p-card-pad",
  lg: "p-inner",
};

export function Card({
  tone = "white", pad = "md", className, children, onClick,
}: {
  tone?: CardTone; pad?: Pad; className?: string; children: ReactNode; onClick?: () => void;
}) {
  const cls = clsx("w-full rounded-card text-left", toneClass[tone], padClass[pad], className);
  if (!onClick) return <div className={cls}>{children}</div>;

  // A wash doesn't lift on hover — it BRIGHTENS (it's part of the backdrop,
  // not an object above it), and its focus ring is lemon, the on-dark ring.
  if (tone === "wash") {
    return (
      <motion.button
        onClick={onClick}
        whileTap={press}
        className={clsx(cls, "transition-colors hover:bg-white/[.09] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lemon outline-none")}
      >
        {children}
      </motion.button>
    );
  }

  return (
    <motion.button
      onClick={onClick}
      whileHover={{ y: -2 }}
      whileTap={press}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className={clsx(cls, "hover:shadow-e3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink")}
    >
      {children}
    </motion.button>
  );
}

/* ============================================================
   List + Row — every row clears the 44px touch minimum
   ============================================================ */

export function List({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={clsx("px-card-pad", className)}>{children}</div>;
}

export function Row({
  lead, title, meta, actions, onClick, muted, tone = "light",
}: {
  lead?: ReactNode; title: ReactNode; meta?: ReactNode; actions?: ReactNode;
  onClick?: () => void; muted?: boolean;
  /** `dark` — the row lives on a wash/ink surface: the hairline and meta invert
   *  to white so the whole row reads on the dark canvas. Title inherits (white
   *  from the wash), same as on a light card it inherits ink. */
  tone?: "light" | "dark";
}) {
  const dark = tone === "dark";
  return (
    <div
      onClick={onClick}
      className={clsx(
        "-mx-2 flex min-h-touch items-center gap-4 rounded-sm border-t px-2 py-3 transition-colors duration-300 ease-out first:border-t-0",
        dark ? "border-white/10" : "border-ink/[.06]",
        onClick && (dark ? "cursor-pointer hover:bg-white/[.05]" : "cursor-pointer hover:bg-surface"),
        muted && "opacity-55",
      )}
    >
      {lead}
      <div className="min-w-0 flex-1">
        <div className="text-h2">{title}</div>
        {meta && <div className={clsx("mt-0.5 truncate text-bodysm", dark ? "text-white/50" : "text-sub")}>{meta}</div>}
      </div>
      {actions && (
        <div className="ml-auto flex shrink-0 items-center gap-2" onClick={(e) => e.stopPropagation()}>
          {actions}
        </div>
      )}
    </div>
  );
}

/* ============================================================
   IconTile — a 24px icon in a soft well
   ============================================================ */

/**
 * An icon well is FURNITURE FOR THE GLYPH, not decoration.
 *
 * `neutral` is the default and it holds on any light card, tinted or not — the
 * same soft grey on lemon as on white, so a card is identified by its icon rather
 * than by a second colour competing with the one the card already has.
 *
 * `lemon` is the single exception: the progress card's circle, which predates all
 * of this and is part of that card's identity.
 */
export type TileTone = "neutral" | "onTint" | "onDark" | "lemon";

const tileTone: Record<TileTone, string> = {
  neutral: "bg-surface text-ink",   // the default — white cards AND tinted ones
  onTint: "bg-ink/[.07] text-ink",  // a flat ink wash; iPad tiles use it
  onDark: "bg-white/10 text-white", // on the near-black backdrop
  lemon: "bg-lemon text-ink",       // the progress card's circle, and only that
};

/**
 * ROUND, like every other icon well in the app.
 *
 * This was `rounded-sm` and it was the only one: the progress card's icon, the
 * mic, ActionButton, the calendar's arrows and every Avatar are all `rounded-pill`.
 * One squared-off tile among them read as a different species of thing — and the
 * nested-radius rule (§3) that `rounded-sm` was reaching for governs boxes inside
 * boxes, not a 40px well holding a 20px glyph.
 *
 * Circle is the app's icon language. This is the component that speaks it, so it
 * changes here — which also updates the ~20 IconTiles on the iPad, deliberately.
 */
export function IconTile({ name, tone = "neutral", size = "md" }: {
  name: IconName; tone?: TileTone;
  /** md 40/20 — cards and sheet headers. sm 32/16 — LIST ROWS, whose type is a
   *  step smaller; a full-size well beside card-size text reads as a badge
   *  shouting over its own label. Same 1:2 glyph-to-well ratio at both sizes. */
  size?: "md" | "sm";
}) {
  return (
    <span className={clsx(
      "grid shrink-0 place-items-center rounded-pill",
      size === "sm" ? "h-8 w-8" : "h-10 w-10",
      tileTone[tone],
    )}>
      <Icon name={name} size={size === "sm" ? 16 : 20} />
    </span>
  );
}

/* ============================================================
   Date Badge — the dark rounded square (11 / Fri)
   ============================================================ */

/**
 * A vertical stadium — taller than it is wide, with fully round ends. NOT a circle.
 * It STRETCHES to the full height of the card, with the date centred inside.
 * (Its row must be items-stretch.)
 */
export function DateBadge({ day, weekday }: { day: number | string; weekday: string }) {
  return (
    <span className="grid min-h-[58px] w-[44px] shrink-0 select-none place-content-center place-items-center gap-[2px] self-stretch rounded-pill bg-ink text-white">
      {/* The badge is a compact STAMP, not running text: the numeral has to lead and
          the weekday has to sit under it. At the 14px meta size the weekday would
          almost equal the numeral and the badge's internal hierarchy would collapse,
          so this is a deliberate, documented exception to the one-meta-size rule. */}
      <span className="text-[18px] font-medium leading-none tabular-nums">{day}</span>
      <span className="text-[12px] font-normal leading-none text-white/70">{weekday}</span>
    </span>
  );
}

/* ============================================================
   TitleBlock — THE title component. Eyebrow · Title · Subtext.

   It has exactly TWO size variants and TWO tones. The eyebrow and the subtext are
   IDENTICAL in both sizes — only the title changes. That is the whole point: the
   eyebrow and subtext are supporting parts and stay put, so the size variant reads
   as one idea getting louder, not as a different component.

     page  — a screen header.  Title = h1 (28)
     card  — inside a card.    Title = h2 (18)

   Tone is about the surface underneath, not the meaning:
     onLight — on a white/lemon/lavender card
     onDark  — on the near-black app backdrop

   Everything that shows this trio uses this. It was hand-rolled in six places and
   had already drifted: the header's subtext was `text-body` (16px) against the
   card's `text-caption` (14px), and one eyebrow carried `tracking-wide` instead of
   the 0.08em everything else uses.
   ============================================================ */

export type TitleSize = "page" | "card";
export type TitleTone = "onLight" | "onDark";

const eyebrowTone: Record<TitleTone, string> = {
  onLight: "text-sub/75",
  onDark: "text-white/45",
};
const subTone: Record<TitleTone, string> = {
  onLight: "text-sub",
  onDark: "text-white/55",
};

/** The eyebrow on its own — for a group heading with no title under it. */
export function Eyebrow({ tone = "onLight", className, children }: {
  tone?: TitleTone; className?: string; children: ReactNode;
}) {
  return (
    <div className={clsx("text-caption uppercase tracking-[0.08em]", eyebrowTone[tone], className)}>
      {children}
    </div>
  );
}

export function TitleBlock({
  eyebrow, title, subtext, size = "card", tone = "onLight", muted, oneLine, wrap, className,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  subtext?: ReactNode;
  size?: TitleSize;
  tone?: TitleTone;
  /** A done task: struck through and dimmed. */
  muted?: boolean;
  /** A prose title (a full sentence, not a label) is allowed to WRAP instead of
   *  clipping — the default single-line truncate is for card/row titles. */
  wrap?: boolean;
  /**
   * LIST ROWS set this: eyebrow and subtext each hold to ONE line, clipping
   * rather than wrapping — a row's rhythm is its height, and one long source
   * name must not make one card taller than its neighbours. Summary cards
   * (e.g. presence, where the subtext is real prose) leave it off and wrap.
   */
  oneLine?: boolean;
  className?: string;
}) {
  return (
    <div className={clsx("min-w-0", className)}>
      {eyebrow && <Eyebrow tone={tone} className={oneLine ? "truncate" : undefined}>{eyebrow}</Eyebrow>}
      <div
        className={clsx(
          "mt-hair",
          wrap ? "text-balance" : "truncate",
          size === "page" ? "font-tight text-h1" : "text-h2",
          muted && "text-sub line-through",
        )}
      >
        {title}
      </div>
      {subtext && (
        <div
          className={clsx(
            "mt-hair flex items-center gap-1.5 text-caption",
            oneLine ? "flex-nowrap overflow-hidden whitespace-nowrap" : "flex-wrap",
            subTone[tone],
          )}
        >
          {subtext}
        </div>
      )}
    </div>
  );
}

/* ============================================================
   Avatar — 32px small, per spec
   ============================================================ */

/** Snap to the 2px grid — round(32 * 0.4) = 13 would be odd, and drag a 19.5px line-height with it. */
const even = (n: number) => Math.round(n / 2) * 2;

export function Avatar({ member, size = 32 }: { member?: Member; size?: number }) {
  if (!member) {
    return (
      <span
        style={{ width: size, height: size }}
        className="inline-flex shrink-0 items-center justify-center rounded-pill border-[2px] border-dashed border-sub/50 text-sub"
      >
        ?
      </span>
    );
  }
  // A custom photo, once set in Settings, stands in for the illustrated face
  // everywhere — same round frame and ring so nothing else has to know.
  if (member.photo) {
    return (
      <span
        title={member.name}
        style={{ width: size, height: size }}
        className="inline-flex shrink-0 overflow-hidden rounded-pill ring-[2px] ring-inset ring-white/25"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={member.photo} alt={member.name} className="h-full w-full object-cover" />
      </span>
    );
  }
  // An illustrated, animated face — drawn from the member's id, so it's stable.
  // A pet has no face; it keeps the coloured initial.
  if (member.kind === "pet") {
    return (
      <span
        style={{ width: size, height: size, background: member.color, fontSize: even(size * 0.4), lineHeight: 1 }}
        className="inline-flex shrink-0 items-center justify-center rounded-pill font-medium text-white ring-[2px] ring-inset ring-white/25"
      >
        {member.name[0]}
      </span>
    );
  }
  return (
    <span
      title={member.name}
      style={{ width: size, height: size }}
      className="inline-flex shrink-0 overflow-hidden rounded-pill ring-[2px] ring-inset ring-white/25"
    >
      <Face id={member.id} size={size} />
    </span>
  );
}

/** Overlapping avatar stack, as in the mockups. */
export function AvatarStack({
  members, ringClass = "ring-card", size = 32,
}: { members: Member[]; ringClass?: string; size?: number }) {
  return (
    <span className="flex -space-x-2">
      {members.map((m) => (
        <span key={m.id} className={clsx("rounded-pill ring-2", ringClass)}>
          <Avatar member={m} size={size} />
        </span>
      ))}
    </span>
  );
}

/* ============================================================
   Pills
   ============================================================ */

export type PillTone = "tag" | "light" | "lemon" | "lavender" | "dark";

const pillTone: Record<PillTone, string> = {
  tag: "bg-ink/[.05] text-sub",
  light: "bg-card text-ink shadow-e1",
  lemon: "bg-lemon text-ink",
  lavender: "bg-lavender text-ink",
  // `tag`'s counterpart on a dark surface (a wash card, the ink backdrop) —
  // ink-on-ink tags disappear there.
  dark: "bg-white/10 text-white/80",
};

export function Pill({ tone = "tag", children }: { tone?: PillTone; children: ReactNode }) {
  return (
    <span className={clsx("inline-flex h-7 items-center gap-1 whitespace-nowrap rounded-pill px-2.5 text-caption font-medium", pillTone[tone])}>
      {children}
    </span>
  );
}

/**
 * "High ↗" — plain TEXT in red, never a chip. A pill here carried its own
 * height (28px) and pushed the card taller than its neighbours; urgency should
 * be a whisper, not a slab.
 */
export function PriorityPill({ priority }: { priority: Priority }) {
  if (priority !== "high") return null;
  return (
    <span className="inline-flex items-center gap-0.5 font-medium text-danger">
      High <Icon name="high" size={14} />
    </span>
  );
}

/**
 * Choice — THE selectable option chip. Assign-to, When, Priority: all the same
 * control, so all the same class. Anything that offers a pick uses this; nothing
 * hand-rolls its own chip.
 */
export function Choice({
  selected, onClick, className, children,
}: { selected: boolean; onClick: () => void; className?: string; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={selected}
      className={clsx(
        "flex h-touch items-center justify-center gap-2 rounded-pill border px-3.5",
        "text-bodysm font-medium transition-colors duration-300 ease-out",
        selected
          ? "border-ink bg-ink text-white"
          : "border-ink/[.08] bg-card text-sub hover:text-ink",
        className,
      )}
    >
      {children}
    </button>
  );
}

/** Every priority spelled out. For pickers/forms, where "no badge" is not an option. */
export const PRIORITY_LABEL: Record<Priority, string> = { low: "Low", med: "Medium", high: "High" };

/** Hashtag metadata, as on the primary card. */

/* ============================================================
   Check
   ============================================================ */

export function Check({ done, onClick, size = 24 }: { done: boolean; onClick: () => void; size?: number }) {
  return (
    <motion.button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      whileTap={press}
      aria-pressed={done}
      aria-label={done ? "Mark not done" : "Mark done"}
      style={{ width: size, height: size }}
      className={clsx(
        "relative shrink-0 rounded-pill border-2 transition-colors duration-300 ease-out",
        done ? "border-ink bg-ink" : "border-ink/20 hover:border-ink",
      )}
    >
      <AnimatePresence>
        {done && (
          <motion.span
            initial={{ scale: 0 }} animate={{ scale: 1 }} transition={spring}
            className="absolute inset-0 grid place-items-center text-lemon"
          >
            <Icon name="check" size={14} />
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );
}

/* ============================================================
   Buttons — 52px primary; 44px is the floor for any tap target
   ============================================================ */

export type BtnTone = "dark" | "lemon" | "light" | "outline" | "outlineDark" | "ghost";
export type BtnSize = "touch" | "lg";

const btnTone: Record<BtnTone, string> = {
  dark: "bg-ink text-white hover:bg-ink/90",
  lemon: "bg-lemon text-ink hover:brightness-95",
  /** WHITE — only legible OFF a white card (on a tint, or on the dark backdrop). */
  light: "bg-card text-ink shadow-e1 hover:shadow-e2",
  /** The secondary action ON a white card. `light` would be white-on-white. */
  outline: "border border-ink/20 bg-transparent text-ink hover:bg-ink/[.04]",
  /** `outline`'s dark twin — the secondary action ON a wash/ink surface, where
   *  ink text and ink borders both vanish. */
  outlineDark: "border border-white/25 bg-transparent text-white hover:bg-white/10",
  ghost: "bg-transparent text-sub hover:bg-ink/[.05] hover:text-ink",
};

const btnSize: Record<BtnSize, string> = {
  touch: "h-touch px-4 text-bodysm font-medium",
  lg: "h-ctl-lg px-6 text-body font-medium",
};

export function Button({
  tone = "dark", size = "touch", className, children, onClick, disabled,
}: {
  tone?: BtnTone; size?: BtnSize; className?: string; children: ReactNode;
  onClick?: () => void; disabled?: boolean;
}) {
  return (
    <motion.button
      whileTap={disabled ? undefined : press}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        "inline-flex shrink-0 items-center justify-center gap-2 rounded-pill transition-colors duration-300 ease-out",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink",
        btnTone[tone], btnSize[size],
        disabled && "cursor-not-allowed opacity-45",
        className,
      )}
    >
      {children}
    </motion.button>
  );
}

/** The circular action button (＋, share, arrow) from the mockups. */
export function ActionButton({
  name, label, onClick, tone = "dark", dot, ring = "ring-lemon",
}: {
  name: IconName; label: string; onClick?: () => void;
  tone?: "dark" | "light"; dot?: boolean; ring?: string;
}) {
  return (
    <motion.button
      whileTap={press}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      onClick={onClick}
      aria-label={label}
      className={clsx(
        "relative grid h-10 w-10 shrink-0 place-items-center rounded-pill transition-colors duration-300 ease-out",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink",
        tone === "dark" ? "bg-ink text-white" : "bg-card text-ink shadow-e1",
      )}
    >
      <Icon name={name} size={18} />
      {dot && <span className={clsx("absolute right-0 top-0 h-2.5 w-2.5 rounded-pill bg-danger ring-2", ring)} />}
    </motion.button>
  );
}

/* ============================================================
   Tab Toggle — Weekly / Monthly, lavender active
   ============================================================ */

export function TabToggle<T extends string>({
  options, value, onChange, layoutId = "tabToggle",
}: { options: readonly T[]; value: T; onChange: (v: T) => void; layoutId?: string }) {
  return (
    <div className="inline-flex rounded-pill bg-card p-1 shadow-e1">
      {options.map((o) => (
        <button
          key={o}
          onClick={() => onChange(o)}
          aria-pressed={value === o}
          className={clsx(
            // h-8 + the track's p-1 (4px top + 4px bottom) = 40px overall, matching
            // the 40px icon button it sits opposite.
            "relative h-8 rounded-pill px-4 text-caption font-medium transition-colors duration-300 ease-out",
            value === o ? "text-ink" : "text-sub hover:text-ink",
          )}
        >
          {value === o && (
            <motion.span
              layoutId={layoutId}
              className="absolute inset-0 rounded-pill bg-lavender"
              transition={spring}
            />
          )}
          <span className="relative">{o}</span>
        </button>
      ))}
    </div>
  );
}

/* ============================================================
   Sentence — the number lives inside plain language
   ============================================================ */

export function Sentence({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={clsx("font-tight text-h1", className)}>{children}</p>;
}

/** The emphasised part of a Sentence — Medium (500), one step above the 400 it sits in. */
export function Em({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={clsx("font-medium", className)}>{children}</span>;
}

/* ============================================================
   Sheet / Toast
   ============================================================ */

/**
 * A sheet with a FIXED head and foot.
 *
 * It used to be one scrolling box, so the grabber, the title and the primary
 * button all slid away — you'd lose the name of the thing you were doing and
 * have to scroll back down to commit it. The head and foot are furniture: they
 * belong to the sheet, not to its contents.
 *
 * `title` and `footer` are optional — sheets that don't pass them (task, assign,
 * activity) still render everything through `children` exactly as before.
 */
export function Sheet({
  open, onClose, variant, title, footer, scrollKey, children,
}: {
  open: boolean;
  onClose: () => void;
  variant: "phone" | "ipad";
  title?: ReactNode;
  footer?: ReactNode;
  /** When this changes, the scroll body jumps back to the top — so navigating
   *  from one sub-screen to another (Settings → Manage household) doesn't inherit
   *  the previous screen's scroll position. */
  scrollKey?: string | number;
  children: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => { scrollRef.current?.scrollTo({ top: 0 }); }, [scrollKey]);

  const phone = variant === "phone";
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 z-40 bg-ink/50 backdrop-blur-[2px]"
          />
          <motion.div
            role="dialog"
            // iPad: a gentle rise, NOT scale — and centring is done with
            // inset-x-0 + mx-auto, never -translate-x-1/2. Framer writes the
            // transform for the animation and would clobber a translate-based
            // centre, dropping the sheet's corner at mid-screen (that's the
            // "renders anywhere" bug). Margin-centring is transform-free, so
            // the two never fight.
            initial={phone ? { y: "100%" } : { opacity: 0, y: 20 }}
            animate={phone ? { y: 0 } : { opacity: 1, y: 0 }}
            exit={phone ? { y: "100%" } : { opacity: 0, y: 20 }}
            transition={spring}
            className={clsx(
              // flex column + overflow-hidden: only the MIDDLE scrolls.
              "absolute z-50 flex flex-col overflow-hidden bg-surface text-ink shadow-e3",
              phone
                ? "inset-x-0 bottom-0 max-h-[88%] rounded-t-card"
                // Centre-bottom of the view, ~60% wide — a wide panel that
                // sits on the floor, not a small box floating mid-canvas.
                : "inset-x-0 bottom-6 mx-auto max-h-[84%] w-[60%] rounded-card",
            )}
          >
            {/* The grabber rides the sheet's own edge — 12px, not 28. */}
            {phone && <div className="mx-auto mt-3 h-[4px] w-10 shrink-0 rounded-pill bg-ink/10" />}

            {title && (
              <h2 className={clsx("shrink-0 px-inner font-tight text-h1", phone ? "pt-4" : "pt-inner")}>
                {title}
              </h2>
            )}

            <div
              ref={scrollRef}
              className={clsx(
                "no-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain px-inner",
                title ? "pt-4" : phone ? "pt-2" : "pt-inner",
                footer ? "pb-4" : "pb-inner",
              )}
            >
              {children}
            </div>

            {/* Pinned. The commit is always one tap away, never scrolled off. */}
            {footer && (
              <div className="shrink-0 border-t border-ink/[.06] px-inner pb-inner pt-4">{footer}</div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export function Toast({
  message, who, onDone, onUndo,
}: { message: string | null; who?: Member; onDone: () => void; onUndo?: () => void }) {
  useEffect(() => {
    if (!message) return;
    // A reversible toast lingers a touch longer — undo needs a beat to be caught.
    const t = setTimeout(onDone, onUndo ? 4200 : 2400);
    return () => clearTimeout(t);
  }, [message, onDone, onUndo]);

  return (
    <AnimatePresence>
      {message && (
        <motion.div
          // Overshoot on the way in — a handoff is a small event, not a status line.
          initial={{ opacity: 0, y: 24, scale: 0.9, x: "-50%" }}
          animate={{ opacity: 1, y: 0, scale: 1, x: "-50%" }}
          exit={{ opacity: 0, y: 8, scale: 0.96, x: "-50%" }}
          transition={{ type: "spring", stiffness: 500, damping: 26 }}
          className={clsx(
            // whitespace-nowrap keeps the pill a pill; the max-width plus a
            // truncating text span keeps a long sentence ON the screen — nowrap
            // alone let "Told Leo and Ada — Maps would open…" run past the glass.
            "pointer-events-none absolute bottom-[110px] left-1/2 z-[60] flex w-max items-center gap-2.5",
            "max-w-[calc(100%-32px)] whitespace-nowrap rounded-pill bg-card text-bodysm font-medium text-ink shadow-e3",
            who ? "py-1.5 pl-1.5" : "h-touch pl-5",
            // The undo affordance rides inside the pill; trim the trailing pad so
            // the divider+button sit flush, else there's a dead gap after "Undo".
            onUndo ? "pr-1.5" : who ? "pr-5" : "pr-5",
          )}
        >
          {who && (
            <motion.span
              // `flex`, not the default inline: an inline wrapper sits on the text
              // baseline and drags a line-box's worth of leading in with it, which
              // pushed the pill 6px taller than the avatar it contains.
              className="flex"
              initial={{ scale: 0, rotate: -30 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 600, damping: 18, delay: 0.06 }}
            >
              <Avatar member={who} size={32} />
            </motion.span>
          )}
          <span className="min-w-0 truncate">{message}</span>
          {onUndo && (
            <button
              onClick={onUndo}
              // The pill is pointer-events-none so it never eats a tap meant for the
              // screen; the ONE interactive thing re-enables pointers on itself.
              className="pointer-events-auto ml-1 flex shrink-0 items-center gap-1 self-stretch rounded-pill bg-ink/[.06] px-3.5 font-semibold text-ink transition-colors hover:bg-ink/10 active:bg-ink/[.14]"
            >
              <Icon name="undo" size={14} />
              Undo
            </button>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}


/* ══════════════════════════════════════════════════════════════════
   DATE + TIME PICKERS

   Ours, not the browser's. `<input type="date">` pops OS chrome — Chrome's blue
   calendar, Safari's grey wheel — and CSS cannot reach inside it.

   They live here, not in a surface, because two surfaces need them now: the New
   Task sheet and the You tab's availability. A primitive used twice belongs in
   the component library.
   ══════════════════════════════════════════════════════════════════ */
/** A month, in our type and our colours. */
export function MiniCalendar({ value, onPick }: { value: string; onPick: (iso: string) => void }) {
  const selected = value || todayIso();
  const [month, setMonth] = useState(() => {
    const d = parseDate(selected);
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const daysIn = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  // Monday-first, like the rest of the app (see dates.ts startOfWeek).
  const lead = (first.getDay() + 6) % 7;
  const cells = [...Array(lead).fill(null), ...Array.from({ length: daysIn }, (_, i) => i + 1)];

  return (
    <div>
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
          aria-label="Previous month"
          className="grid h-8 w-8 place-items-center rounded-pill text-sub transition-colors hover:bg-surface hover:text-ink"
        >
          <Icon name="back" size={16} />
        </button>
        <b className="text-bodysm tabular-nums">
          {month.toLocaleDateString("en-GB", { month: "long", year: "numeric" })}
        </b>
        <button
          type="button"
          onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
          aria-label="Next month"
          className="grid h-8 w-8 place-items-center rounded-pill text-sub transition-colors hover:bg-surface hover:text-ink"
        >
          <Icon name="fwd" size={16} />
        </button>
      </div>

      <div className="mt-2 grid grid-cols-7 gap-0.5">
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
          <span key={i} className="grid h-6 place-items-center text-micro uppercase tracking-[.1em] text-sub">
            {d}
          </span>
        ))}
        {cells.map((day, i) => {
          if (day === null) return <span key={`x${i}`} />;
          const d = iso(new Date(month.getFullYear(), month.getMonth(), day));
          const isSel = d === selected;
          const isToday = d === todayIso();
          return (
            <button
              key={d}
              type="button"
              onClick={() => onPick(d)}
              className={clsx(
                "grid h-8 place-items-center rounded-pill text-caption tabular-nums transition-colors",
                isSel ? "bg-ink font-medium text-white"
                  : isToday ? "bg-lemon font-medium text-ink"
                    : "text-ink hover:bg-surface",
              )}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ── the time wheel ─────────────────────────────────────────────────────── */

const WHEEL_ITEM = 36; // px per row — on the 2px grid, and a comfortable target
const WHEEL_ROWS = 5; // odd, so there IS a middle row to select through
const WHEEL_H = WHEEL_ITEM * WHEEL_ROWS;
const WHEEL_PAD = (WHEEL_H - WHEEL_ITEM) / 2; // lets the first and last row reach the middle

/**
 * One scrollable column. Selection is a function of SCROLL POSITION — whatever
 * is under the band in the middle is the value — which is what makes it a wheel
 * rather than a list you happen to scroll.
 *
 * `scroll-snap` does the settling, so no inertia maths of our own.
 */
function WheelColumn({
  items, value, onChange, label,
}: { items: string[]; value: string; onChange: (v: string) => void; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const raf = useRef(0);
  /**
   * Has a HUMAN touched this wheel?
   *
   * Scroll events don't say who caused them, and the panel that holds this wheel
   * animates its height from 0 — so the browser clamps our sync to 0 and fires a
   * scroll, which reads as "user picked row 0". That silently set 1:00 AM on
   * every open. A wheel may only speak when someone turns it.
   */
  const touched = useRef(false);

  // Drive the scroll from the value — but ONLY when they disagree. Without this
  // guard the effect fights the user's own scroll: change -> effect -> scroll ->
  // change, and the wheel jitters under the finger.
  //
  // The rAF retry is for the open animation: at height 0 there is nothing to
  // scroll and the assignment is dropped, so we try again once it has size.
  useEffect(() => {
    const sync = () => {
      const el = ref.current;
      if (!el) return;
      const i = items.indexOf(value);
      if (i < 0 || Math.round(el.scrollTop / WHEEL_ITEM) === i) return;
      el.scrollTop = i * WHEEL_ITEM;
    };
    sync();
    const r1 = requestAnimationFrame(sync);
    const t = setTimeout(sync, 260); // after PickerPanel's height tween settles
    return () => { cancelAnimationFrame(r1); clearTimeout(t); };
  }, [items, value]);

  const onScroll = () => {
    if (!touched.current) return; // layout or sync, not a person
    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(() => {
      const el = ref.current;
      if (!el) return;
      const i = Math.max(0, Math.min(items.length - 1, Math.round(el.scrollTop / WHEEL_ITEM)));
      if (items[i] !== value) onChange(items[i]);
    });
  };

  const mark = () => { touched.current = true; };

  return (
    <div
      ref={ref}
      onScroll={onScroll}
      onPointerDown={mark}
      onTouchStart={mark}
      onWheel={mark}
      onKeyDown={mark}
      role="listbox"
      aria-label={label}
      tabIndex={0}
      className="no-scrollbar snap-y snap-mandatory overflow-y-auto overscroll-contain"
      style={{ height: WHEEL_H }}
    >
      <div style={{ height: WHEEL_PAD }} />
      {items.map((it) => (
        <button
          key={it}
          type="button"
          role="option"
          aria-selected={it === value}
          // Tap works too — a wheel you can only fling is hostile to a mouse.
          onClick={() => onChange(it)}
          className={clsx(
            "flex w-full snap-center items-center justify-center text-bodysm tabular-nums transition-colors",
            it === value ? "font-medium text-ink" : "text-sub",
          )}
          style={{ height: WHEEL_ITEM }}
        >
          {it}
        </button>
      ))}
      <div style={{ height: WHEEL_PAD }} />
    </div>
  );
}

const HOURS = Array.from({ length: 12 }, (_, i) => String(i + 1));
/** Five-minute steps. A household runs on "6:30", never "6:37", and 60 rows of
 *  scrolling to say so is a tax nobody pays willingly. */
const MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, "0"));
const MERIDIEM = ["AM", "PM"];

/** HH · MM · AM/PM — three wheels reading through one band. */
export function MiniClock({ value, onPick }: { value: string; onPick: (label: string) => void }) {
  const m = value.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  // No time yet? Start somewhere plausible, but DON'T emit — landing on the
  // picker must not silently set a time nobody chose. Scrolling commits.
  const h = m ? String(Number(m[1])) : "9";
  const min = m ? m[2] : "00";
  const ap = m ? m[3].toUpperCase() : "AM";
  const emit = (hh: string, mm: string, a: string) => onPick(`${hh}:${mm} ${a}`);

  return (
    <div className="relative">
      {/* The band IS the selection. It sits under the wheels so the live row
          reads as ink-on-surface rather than being covered by it. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 rounded-[14px] bg-surface"
        style={{ height: WHEEL_ITEM }}
      />
      <div className="relative mx-auto flex max-w-[240px] items-center">
        <div className="flex-1"><WheelColumn label="Hour" items={HOURS} value={h} onChange={(v) => emit(v, min, ap)} /></div>
        <span className="pb-0.5 text-bodysm font-medium text-sub">:</span>
        <div className="flex-1"><WheelColumn label="Minute" items={MINUTES} value={min} onChange={(v) => emit(h, v, ap)} /></div>
        <div className="flex-1"><WheelColumn label="AM or PM" items={MERIDIEM} value={ap} onChange={(v) => emit(h, min, v)} /></div>
      </div>
      {/* Hairlines top and bottom: the rows fade past them, so the wheel reads as
          a window onto a longer strip instead of a truncated list. */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-9 rounded-t-card bg-gradient-to-b from-card to-transparent" />
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-9 rounded-b-card bg-gradient-to-t from-card to-transparent" />
    </div>
  );
}

export function PickerChip({
  kind, open, onToggle, active, children,
}: {
  kind: "date" | "time";
  open: boolean;
  onToggle: () => void;
  active: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      // Height and rhythm match <Choice> — h-touch (44), not h-ctl (48); 4px
      // taller made the row lumpy.
      //
      // But the FILL deliberately doesn't. A Choice is a value you select; this
      // is a door that opens more. Outline-only, no fill, says "not one of the
      // options" — giving it Choice's white card made it masquerade as one.
      // Filled ink once it HOLDS a value, because then it is one.
      className={clsx(
        "flex h-touch items-center justify-center gap-2 rounded-pill border px-3.5",
        "text-bodysm font-medium transition-colors duration-300 ease-out",
        active || open ? "border-ink bg-ink text-white" : "border-ink/[.12] text-sub hover:border-ink/30",
      )}
    >
      <Icon name={kind === "date" ? "cal" : "clock"} size={14} />
      {children}
      <motion.span animate={{ rotate: open ? 180 : 0 }} transition={smooth} className="flex">
        <Icon name="chevDown" size={12} />
      </motion.span>
    </button>
  );
}

/** The inline panel both pickers open into — one place for the reveal. */
export function PickerPanel({ open, children }: { open: boolean; children: ReactNode }) {
  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={smooth}
          className="overflow-hidden"
        >
          <div className="mt-2 rounded-card border border-ink/[.06] bg-card p-3">{children}</div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
