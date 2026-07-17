"use client";

import clsx from "clsx";
import { useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Icon, type IconName } from "@/components/Icons";
import { SAFE_TOP } from "@/components/DeviceFrame";
import { EventCard, MaintCard, TaskCard } from "@/components/TaskCard";
import { ActionButton, Avatar, Button, Card, Check, Choice, Em, Eyebrow, IconTile, MiniCalendar, MiniClock, PickerChip, PickerPanel, Pill, Sentence, TabToggle, TitleBlock } from "@/components/ui";
import { listItem, listStagger, press, smooth, spring } from "@/lib/motion";
import {
  addDays, badge, greeting, inRange, isCurrentPeriod, iso, isToday, monthKey, monthLabel, parse,
  periodLabel, groupIsPast, periodRange, relative, relativeInline, shiftPeriod, startOfWeek, today, todayIso, weekKey, weekLabel, type Period,
} from "@/lib/dates";
import { awayOn, coveredFor, currentMember, doers, holder, pendingFor, previewRebalance, shoppingList, useHousehold } from "@/lib/store";
import { useBackdropTone } from "@/lib/useBackdropTone";
import type { HouseEvent, MaintItem, MemberId, PhoneRoute, Presence, Task } from "@/lib/types";
import { ROLE_HINT, ROLE_LABEL } from "@/lib/types";

/**
 * Three tabs on ONE axis: now -> later -> me. Today is a feed of what’s on;
 * Ahead is the calendar horizon; You is the person.
 */
const NAV: { route: PhoneRoute; icon: IconName; label: string }[] = [
  { route: "today", icon: "feed", label: "Today" },
  { route: "ahead", icon: "cal", label: "Ahead" },
  { route: "you", icon: "user", label: "You" },
];

export function PhoneShell() {
  const s = useHousehold();
  const meId = currentMember(s);
  const me = s.members[meId];
  const route = s.phoneRoute;
  const [navOpen, setNavOpen] = useState(false);
  // Owned here, not in PhoneAhead: the header reports the count, the page owns the
  // toggle. Whoever renders both has to hold it.
  //
  // `anchor` is what makes zoom possible: a scope alone says "a month", it can't
  // say WHICH month. Tapping a month heading sets both.
  const [scope, setScope] = useState<Scope>("Week");
  const [anchor, setAnchor] = useState<Date>(() => new Date());
  const [query, setQuery] = useState("");
  const [scopeOpen, setScopeOpen] = useState(false);
  const [scrolled, setScrolled] = useState(0);
  const scroller = useRef<HTMLDivElement>(null);
  // The tail spacer's height, measured — see parkAndSize. It exists ONLY so the current
  // group can reach the top of the viewport when the list is short; sized to exactly
  // that and no more, so there's no empty scroll past the content.
  const [tail, setTail] = useState(0);
  const ahead = aheadFor(s, meId, scope, anchor, query);

  // The nav is glass over a moving list — it has to look at what it's sitting on.
  // Re-sampled on scroll inside the hook; these deps catch the changes scroll
  // can't see (a new route's content, the bar blooming to a new width).
  const navRef = useRef<HTMLElement>(null);
  const onLight = useBackdropTone(navRef, [route, navOpen, s.navTick]) === "light";

  // Re-park whenever the lens changes — a new period is a new "where am I".
  useLayoutEffect(() => {
    if (route === "ahead") parkAndSize();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route, scope, +anchor, query]);

  /**
   * Park the view on the CURRENT group, and size the tail spacer to make that possible —
   * without leaving any dead scroll below.
   *
   * The past isn't hidden — it's simply above you, the way it is in a diary. Scroll up
   * and there it is. That replaces the "Show 1 earlier week" control entirely: no
   * button, no state, and the gesture you'd already try is the answer.
   *
   * THE PHANTOM SCROLL. Parking the current group at the top needs room below it to
   * scroll INTO — on a short list there isn't any, so a fixed 40vh spacer used to be
   * pinned to the end. But 40vh is almost always too much: on Week (nothing to park) it
   * was 336px of scrolling into pure void. The spacer must be exactly `parkTarget +
   * viewport − whatever content already sits below`, floored at 0. When the content
   * below the current group is already a viewport tall, that's 0 and natural scrolling
   * does the job.
   */
  const parkAndSize = () => {
    const sc = scroller.current;
    if (!sc) return;
    const head = sc.querySelector<HTMLElement>("[data-header]")?.offsetHeight ?? 0;
    const el = sc.querySelector<HTMLElement>("[data-current]");

    // offsetTop / offsetHeight, NOT getBoundingClientRect().
    //
    // The list plays an entrance animation (listStagger translates each card in), so
    // for ~300ms every rect is a moving target — measuring one scrolled to wherever
    // the card happened to be mid-flight. offsetTop is layout geometry: it ignores
    // transforms entirely, so it's right on the first frame and needs no rAF.
    //
    // The header sits in normal flow above the groups, so a group's offsetTop already
    // includes it; subtracting the header's height lands the group just below it.
    const parkTarget = el ? Math.max(0, el.offsetTop - head) : 0;

    // Size the spacer from the CURRENT layout: its own offsetTop is where real content
    // ends (it's the last child), and anything below it (the list's bottom padding, to
    // clear the floating nav) is trailing. Both are independent of the spacer's own
    // height, so measuring while it's the old size is safe.
    const spacer = sc.querySelector<HTMLElement>("[data-tail]");
    const realBottom = spacer ? spacer.offsetTop : sc.scrollHeight;
    const trailingPad = spacer ? sc.scrollHeight - spacer.offsetTop - spacer.offsetHeight : 0;
    setTail(Math.max(0, parkTarget + sc.clientHeight - realBottom - trailingPad));

    // Scroll before the resize settles: parkTarget ≤ the current (larger) max, so it's
    // valid now, and once the spacer shrinks to make max === parkTarget the browser
    // keeps us exactly here.
    sc.scrollTo({ top: parkTarget });
  };

  const setScopeAt = (next: Scope) => {
    // Changing scope always re-centres on today; you meant "this month", not "the
    // month around whatever you happened to be reading".
    setScope(next);
    setAnchor(new Date());
  };
  /** Zoom a group: same data, tighter lens. A week group needs Week scope. */
  const zoomTo = (key: string) => {
    setAnchor(parse(key.length === 7 ? `${key}-01` : key));
    setScope(ahead.zoomScope);
  };
  /** Previous / next period. */
  const step = (dir: -1 | 1) => setAnchor((a) => shiftPeriod(scope, a, dir));

  return (
    <div className="absolute inset-0 flex min-h-0 flex-col bg-ink text-white">
      {/* iOS status bar — flanks the Dynamic Island, centred on ITS centreline.
          The island (see DeviceFrame) is top:14 h:34, so its centre is y=31:
          pt-14 + a 34px content box + items-center lands exactly there. */}
      {/* Scrolling while the nav is open just closes it — the content never freezes.
          (An invisible full-screen overlay would have caught the scroll gesture too,
          so there ISN'T one; the close is wired to the scroll container itself.) */}
      {/* `layoutScroll` is load-bearing, not decoration. Framer measures layoutId
          positions in VIEWPORT space — so zooming a group while scrolled down meant
          it measured the toggle's "before" position off-screen above, then animated
          the lilac pill in from the top corner. This tells it to account for scroll. */}
      <motion.div
        ref={scroller}
        layoutScroll
        onScroll={(e) => {
          if (navOpen) setNavOpen(false);
          setScrolled(e.currentTarget.scrollTop);
        }}
        onPointerDown={() => navOpen && setNavOpen(false)}
        // `relative` so the groups' offsetTop is measured from THIS box.
        className="no-scrollbar relative min-h-0 flex-1 overflow-y-auto overscroll-contain"
      >
        {/* The header is the only thing on the backdrop — it gets room to breathe.
            px-5 (20px) = the 4px page gutter + the cards' 16px padding, so the
            greeting's left edge lines up with every card title below it. The
            generous pb separates "the app talking to you" from "your things". */}
        {/* The header owns the safe area (pt = SAFE_TOP + 16), and the scroller runs the
            FULL height of the screen — no padded gap above it.
            
            That's what kills the hairline for good. Padding the app's top put the
            scroller's clip edge at y=48, and the frame is scaled to fit, so that edge
            landed on a fractional pixel (122.56): the browser rounded the clip one way
            and the background the other, and a card bled through the crack. With the
            scroller starting at 0 there is no boundary there to leak — the header is
            just continuous ink from the top of the screen down. Delete the seam, don't
            seal it. */}
        <header
          data-header
          style={{ paddingTop: SAFE_TOP + 16 }}
          className={clsx(
            "relative sticky top-0 z-20 bg-ink px-5",
            // On Ahead the cue band carries the bottom rhythm itself: 24px under the
            // search bar, 12px over the list, so proximity reads it as the LIST's
            // marker rather than the search bar's tail. Other routes keep the
            // standard 16px between the title block and the first card.
            route === "ahead" ? "pb-2" : "pb-4",
          )}
        >
          <div className="flex items-start justify-between">
          {/* Eyebrow + Title — the same pair every card uses, and it says something
              different on every screen. The greeting is TODAY's alone: elsewhere it
              was a warm line that told you nothing about where you were. */}
          {/* ONE component, page size, dark tone — the same trio the cards use. */}
          <div suppressHydrationWarning className="min-w-0">
            {route === "today" && (
              <TitleBlock size="page" tone="onDark" eyebrow={today()} title={`${greeting()}, ${me.name}`} />
            )}
            {route === "ahead" && (
              <TitleBlock
                size="page" tone="onDark"
                eyebrow={
                  // The period label IS the scope control — "July 2026" already names
                  // the scope AND the period, so a separate row of tabs was saying half
                  // of it twice. Prev/next flank it because it's what they change.
                  // While searching there IS no period, so it all goes away.
                  ahead.searching ? (
                    `Searching “${query.trim()}”`
                  ) : (
                    // -ml-1 cancels the 4px the icon sits inside its 24px tap target,
                    // so the CARET aligns with the W of the title — the box it lives in
                    // is invisible and shouldn't be what lines up.
                    <span className="-ml-1 flex items-center gap-0.5">
                      <Step dir={-1} onClick={() => step(-1)} />
                      <ScopePicker
                        scope={scope} anchor={anchor}
                        open={scopeOpen} setOpen={setScopeOpen}
                        onPick={setScopeAt}
                      />
                      <Step dir={1} onClick={() => step(1)} />
                      {!isCurrentPeriod(scope, anchor) && (
                        <button
                          onClick={() => setAnchor(new Date())}
                          className="ml-1 rounded-pill bg-white/10 px-2 py-0.5 text-caption normal-case tracking-normal text-white/70 transition-colors hover:bg-white/20 hover:text-white"
                        >
                          Today
                        </button>
                      )}
                    </span>
                  )
                }
                title="What’s ahead"
                subtext={
                  ahead.searching
                    ? `${ahead.count} ${ahead.count === 1 ? "match" : "matches"} · all time`
                    : `${ahead.count} ${ahead.count === 1 ? "thing" : "things"} this ${scope.toLowerCase()}`
                }
              />
            )}
            {route === "you" && (
              /* The HOUSEHOLD, not the role.
                 This was the role, back when roles were badge nouns — "GUIDED /
                 Ada" read as a label above a name. In family language they're
                 scope phrases, and "A SIMPLER VIEW / Ada" is not a thing you can
                 say about a person. It was a duplicate anyway: Your access, two
                 cards down, is where the role belongs and says it in full.
                 The home is the truer eyebrow — it's the one thing this screen
                 couldn't otherwise tell you, and on a real phone there's no
                 persona switcher above to say it. */
              <TitleBlock
                size="page" tone="onDark"
                eyebrow={s.householdName}
                title={me.name}
              />
            )}
          </div>
          <div className="flex shrink-0 items-center">
            {/* Just the bell now. The shopping cart used to sit here and it was
                crowding the greeting off the edge — a shared-list door doesn't
                belong in a row of personal chrome anyway. It's a card on Today
                now (see PhoneToday), which is where a thing everyone shares
                should announce itself. */}
            <button
              // Open ONLY — markRead moved into the sheet itself. Calling it here
              // burned the evidence before the sheet could render: `unread` is
              // the only record of where "new to you" ends, and it was zeroed a
              // frame before anything could read it.
              onClick={() => s.openSheet({ type: "activity" })}
              aria-label={s.unread ? `Activity, ${s.unread} unread` : "Activity"}
              className="relative grid h-touch w-touch place-items-center rounded-pill text-white"
            >
              <Icon name="bell" size={24} />
              {s.unread > 0 && (
                <span className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-pill bg-danger ring-2 ring-ink" />
              )}
            </button>
            </div>
          </div>

          {/* Always there, in the STICKY header. A toggle bought nothing: the field is
              one row, and hiding it behind a tap only made you ask "where's search?".
              It lives here rather than in the list because the list scrolls past the
              current group on open — it would have opened out of sight. */}
          {route === "ahead" && (
            <label className="mt-3 flex h-touch items-center gap-2 rounded-pill border border-white/10 bg-white/[.06] px-3.5 text-white/45 focus-within:border-white/25">
              <Icon name="search" size={16} className="shrink-0" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search tasks and events…"
                className="w-full bg-transparent text-bodysm text-white outline-none placeholder:text-white/30"
              />
              {query && (
                <button onClick={() => setQuery("")} aria-label="Clear search" className="shrink-0 hover:text-white">
                  <Icon name="x" size={14} />
                </button>
              )}
            </label>
          )}

          {/* "There's more above."
              A whisper, not a control — but a legible and HONEST one. Two states,
              and one of them is ALWAYS showing:

                scrolled past something ->  "^^ EARLIER"      (tap walks up)
                at the top              ->  "NOTHING EARLIER" (terminal, dimmer)

              It shows from the moment the lens PARKS — parking sets scrollTop, so a
              lens that opens mid-list announces its past immediately, before any
              user scroll.

              There used to be a third state — empty, when the lens couldn't scroll
              at all (Week, which fits whole) — on the theory that "nothing earlier"
              is noise where there's no elsewhere. Wrong twice over: it's TRUE on
              Week (the week starts there), and hiding it left the reserved row
              saying nothing, which reads as a rendering fault rather than restraint.
              A reserved row must always be earning its space.

              TWO things here are load-bearing:

              1. The row is ALWAYS reserved (fixed mt-6 h-4) and only its CONTENT
                 swaps, absolutely positioned. parkAndSize() measures
                 head.offsetHeight, so the header must never change size in response
                 to scroll state — that would shift the content, change the scroll,
                 and re-decide the cue. A feedback loop. The fixed row also IS the
                 spacing consistency: the search-bar-to-content gap is identical in
                 all three states.
              2. It lives INSIDE the header's ink, not below it: faded white on a
                 white card vanishes outright.

              The 24px above / 12px below is the GROUPING, and it is deliberate: the
              cue belongs to the LIST it describes, not to the search bar it happens
              to sit beneath. Proximity is the only thing saying so. */}
          {/* Both states are ALWAYS mounted and only their opacity moves. Mount/unmount
              (AnimatePresence) wedged here: scroll events interrupt exits mid-flight
              and the leaving label stuck around — two cues at once. Opacity on a
              permanent pair cannot wedge, and the hidden one is inert
              (pointer-events: none + aria-hidden). */}
          {route === "ahead" && (
            <div className="relative mt-6 h-4">
              <motion.button
                animate={{ opacity: scrolled > 4 ? 1 : 0 }}
                transition={smooth}
                aria-hidden={scrolled <= 4}
                tabIndex={scrolled > 4 ? 0 : -1}
                style={{ pointerEvents: scrolled > 4 ? "auto" : "none" }}
                onClick={() => scroller.current?.scrollBy({ top: -260, behavior: "smooth" })}
                className="absolute inset-x-0 top-0 mx-auto flex h-4 w-max items-center gap-1
                           text-white/40 transition-colors hover:text-white/75"
              >
                <Icon name="chevsUp" size={12} />
                <span className="text-micro uppercase leading-none tracking-[.14em]">Earlier</span>
              </motion.button>
              <motion.div
                animate={{ opacity: scrolled > 4 ? 0 : 1 }}
                transition={smooth}
                aria-hidden={scrolled > 4}
                className="pointer-events-none absolute inset-x-0 top-0 mx-auto flex h-4 w-max
                           items-center text-white/25"
              >
                <span className="text-micro uppercase leading-none tracking-[.14em]">Nothing earlier</span>
              </motion.div>
            </div>
          )}
        </header>

        <motion.div
          key={s.navTick}
          variants={listStagger}
          initial="hidden"
          animate="show"
          className="flex flex-col gap-tile px-screen pb-[140px] pt-1"
        >
          {route === "today" && <PhoneToday />}
          {route === "ahead" && (
            <PhoneAhead
              scope={scope} setScope={setScopeAt} zoom={zoomTo} step={step}
              query={query} setQuery={setQuery} tail={tail}
              {...ahead}
            />
          )}
          {route === "you" && <PhoneYou />}
        </motion.div>
      </motion.div>

      {/* FLOATING GLASS NAV.
          COLLAPSED — a single glass pill in the bottom-LEFT corner. Pure glass:
            no white fill, the icon sits straight on the blur.
          EXPANDED — blooms open, re-CENTRES on the screen, names every tab, and
            only THEN does the selected tab take a white fill (with the glass
            still visible behind it).
          The rail below is a full-width flex track: switching it from flex-start
          to center is what walks the bar from the corner to the middle. It has to
          be a layout change, not a transform — framer's `layout` drives the move
          with a transform of its own, and a -translate-x-1/2 would fight it. */}
      <div
        className={clsx(
          "pointer-events-none absolute inset-x-0 bottom-[26px] z-30 flex px-3",
          navOpen ? "justify-center" : "justify-start",
        )}
      >
        {/* THE GLASS STAYS GLASS — 10% white, exactly as designed. What changes is
            what's IN it.

            The nav floats over a scrolling list, so it has no fixed backdrop: ink
            at the top of the feed, a white card a moment later. Over white, white
            text hit 1:1 contrast and vanished. Tinting the glass dark until white
            always worked "fixed" that by deleting the material — a translucent
            panel that ignores its backdrop isn't glass, it's a grey box.

            So the panel READS its backdrop (useBackdropTone samples what's painted
            behind it) and inverts its contents: dark ink over a light card, white
            over ink. Same move the iOS status bar makes over a scrolling page. The
            colours tween over 300ms, so crossing a card edge cross-fades. */}
        <motion.nav
          ref={navRef}
          layout
          transition={spring}
          className={clsx(
            `pointer-events-auto flex items-center gap-1 overflow-hidden rounded-[22px]
             border bg-white/10 p-2 shadow-e3 backdrop-blur-xl backdrop-saturate-150`,
            onLight ? "border-ink/[.08]" : "border-white/15",
          )}
        >
          {(navOpen ? NAV : NAV.filter((n) => n.route === route)).map((n) => {
            const active = route === n.route;
            // The white fill belongs to the OPEN state only.
            const filled = navOpen && active;
            return (
              <motion.button
                key={n.route}
                layout
                whileTap={press}
                transition={spring}
                aria-label={n.label}
                aria-current={active ? "page" : undefined}
                aria-expanded={navOpen}
                onClick={() => {
                  if (!navOpen) return setNavOpen(true);
                  s.goPhone(n.route);
                  setNavOpen(false);
                }}
                className="relative flex h-[52px] items-center gap-2 rounded-[16px] px-[14px]"
              >
                {/* The selected fill inverts too — a WHITE pill on a white card is
                    just as invisible as white text on it. */}
                <AnimatePresence initial={false}>
                  {filled && (
                    <motion.span
                      layoutId="phoneTab"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={spring}
                      className={clsx(
                        "absolute inset-0 rounded-[16px] shadow-e1 transition-colors duration-300 ease-out",
                        onLight ? "bg-ink" : "bg-white",
                      )}
                    />
                  )}
                </AnimatePresence>

                <span className={clsx("relative shrink-0 transition-colors duration-300 ease-out",
                  filled
                    ? onLight ? "text-white" : "text-ink"
                    : active
                      ? onLight ? "text-ink" : "text-white"
                      : onLight ? "text-ink/45" : "text-white/50")}>
                  <Icon name={n.icon} size={22} />
                </span>

                {/* The label only exists while open — it grows from zero width, so the
                    bar expands rather than the text popping in. */}
                <AnimatePresence initial={false}>
                  {navOpen && (
                    <motion.span
                      initial={{ opacity: 0, width: 0 }}
                      animate={{ opacity: 1, width: "auto" }}
                      exit={{ opacity: 0, width: 0 }}
                      transition={smooth}
                      className={clsx(
                        "relative overflow-hidden whitespace-nowrap text-bodysm font-medium transition-colors duration-300 ease-out",
                        filled
                          ? onLight ? "text-white" : "text-ink"
                          : onLight ? "text-ink/55" : "text-white/60",
                      )}
                    >
                      {n.label}
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.button>
            );
          })}
        </motion.nav>
      </div>
    </div>
  );
}

const SPAN = ["Weekly", "Monthly"] as const;

/** The sentence has to agree with the number — nobody is "doing well" at 0%. */
function readProgress(pct: number): { text: React.ReactNode } {
  if (pct === 0) return { text: <>Nothing <Em>done</Em> yet</> };
  if (pct < 50) return { text: <>You&rsquo;ve made a <Em>start</Em></> };
  if (pct < 100) return { text: <>You are doing <Em>well</Em></> };
  return { text: <>You&rsquo;re <Em>all done</Em></> };
}

function PhoneToday() {
  const [span, setSpan] = useState<(typeof SPAN)[number]>("Weekly");
  const s = useHousehold();
  const meId = currentMember(s);
  const me = s.members[meId];
  const mine = s.tasks.filter((t) => holder(t) === meId && !t.done && isToday(t.due)).sort((a, b) => a.due.localeCompare(b.due));
  const events = s.events.filter((e) => e.who === meId && isToday(e.due));

  /** Which days this week hold something for me — the week ruler's presence dots.
   *  Cheap to build each render; a walk over two small arrays. */
  const busy = new Set<string>();
  for (const t of s.tasks) if (holder(t) === meId && !t.done) busy.add(t.due);
  for (const e of s.events) if (e.who === meId) busy.add(e.due);

  /** The shared list, summarised for the card. `low` items are the ones the
   *  house asked for (inventory ran out), worth calling out separately. */
  const shop = shoppingList(s);
  const shopOpen = shop.filter((i) => !i.done).length;
  const shopLow = shop.filter((i) => !i.done && i.low).length;

  /**
   * HONEST PROGRESS, at last. This card used to lie three ways at once: the
   * Weekly/Monthly toggle animated and changed nothing (`span` was read by no
   * calculation), "done" counted every task ever completed (no time filter
   * existed to apply), and the % divided across two different windows. Now both
   * numbers come from the SAME window the toggle names:
   *
   *   done = completedAt inside the span   (when it actually happened)
   *   open = due inside the span, not done (what the span still expects)
   */
  const range = periodRange(span === "Weekly" ? "Week" : "Month");
  const doneInSpan = s.tasks.filter(
    (t) => holder(t) === meId && t.done && t.completedAt && t.completedAt >= +range.from && t.completedAt < +range.to,
  ).length;
  const openInSpan = s.tasks.filter(
    (t) => holder(t) === meId && !t.done && inRange(t.due, range),
  ).length;
  const total = doneInSpan + openInSpan;
  const pct = total ? Math.round((doneInSpan / total) * 100) : 100;
  const progress = readProgress(pct);

  /**
   * The REAL date. `dayNum = 13; dayName = "Thu"` were hardcoded — a placeholder
   * that outlived its screenshot. The header above said "Thursday 16 July" and
   * every task card said "16 Thu" while this one insisted on the 13th: the app's
   * hero card, wrong about what day it is, three days adrift and drifting further.
   * `badge()` is what the task cards already use.
   */
  const d = badge(todayIso());
  const highCount = mine.filter((t) => t.priority === "high").length;

  return (
    <>
      {/* THE WEEK — a glance-strip right under the greeting. Tap any day to open
          Ahead on the week it belongs to. */}
      <motion.div variants={listItem}>
        <DateStrip busy={busy} onPick={() => s.goPhone("ahead")} />
      </motion.div>

      {/* PRIMARY CARD (lemon) — the day, said out loud */}
      <motion.div variants={listItem}>
        <Card tone="lemon">
          <div className="flex items-center">
            {/* `onTint`, not `neutral`. The grey well (#F5F4F8) is designed to sit
                on WHITE, where a hair of difference reads as recessed. On lemon it
                just goes pale and muddy — near-white on vivid yellow has nowhere to
                stand. `onTint` is the well built for tinted cards: a 7% ink wash, so
                the contrast is dark-on-light (the direction that always reads) and
                the dark glyph sits in it cleanly.
                Text steps 14 -> 16 and ink/55 -> ink/70: beside a 40px circle a
                caption reads as a stray label rather than the date this card is
                about. */}
            <div className="flex items-center gap-3">
              <IconTile name="cal" tone="onTint" />
              <span className="text-body font-medium text-ink/70">
                {d.day} {d.weekday}
              </span>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <ActionButton
                name="handoff" label="Hand off" tone="light"
                onClick={() => s.openSheet({ type: "handoff" })}
              />
              <ActionButton
                name="plus" label="Add a task"
                onClick={() =>
                  s.openSheet({ type: "newTask", draft: { title: "", owner: meId, when: "Today", priority: "med" } })
                }
              />
            </div>
          </div>

          <p className="mt-6 text-caption text-ink/55">Current tasks</p>
          <Sentence className="mt-1.5 !text-display">
            {mine.length === 0 ? (
              <>You&rsquo;re all <Em>caught up</Em></>
            ) : (
              <>
                You have <Em>{mine.length} {mine.length === 1 ? "task" : "tasks"}</Em>
                {/* "for today" always breaks to its own line — the count is the
                    first thing read, the timeframe the second. Not left to wrap. */}
                <span className="block">for today</span>
              </>
            )}
          </Sentence>

          {/* Right under the sentence it qualifies — no divider, no footer.
              ─────────────────────────────────────────────────────────────────
              "1 is high" is a clause OF "you have 2 tasks for today", not a
              separate fact about the card. Pinning it to the bottom behind a
              rule put the app's one urgent signal as far from the count as the
              card allowed, and dressed it as a footnote.

              (The cadence tags used to live down there — "Today · Yearly · Twice
              a year" under a headline about today, built from EVERY open task:
              "Twice a year" was the oven, due in 68 days. Deleted. With them gone
              the footer was a rule holding up one line.) */}
          {highCount > 0 && (
            <p className="mt-3 flex items-center gap-1 text-caption font-medium text-danger">
              <Icon name="high" size={14} /> {highCount} {highCount === 1 ? "is" : "are"} high
            </p>
          )}
        </Card>
      </motion.div>

      {/* THE SHARED LIST (mint) — the one collective thing on a personal phone.
          It was a cart in the header crowding the greeting; a thing everyone
          shares shouldn't hide in a corner of personal chrome. As a card it can
          say what's on it, and tapping opens the full list. Mint (not lavender)
          so it doesn't twin with the progress card two rows down. */}
      <motion.div variants={listItem}>
        <Card tone="mint" onClick={() => s.openSheet({ type: "shop" })}>
          <div className="flex items-center gap-3">
            <IconTile name="cart" tone="onTint" />
            <div className="min-w-0 flex-1">
              <Eyebrow>Shared list</Eyebrow>
              <div className="mt-hair text-h2">
                {shopOpen
                  ? `${shopOpen} to get`
                  : "All bought"}
              </div>
            </div>
            {/* The house-flagged items get a word — an item nobody remembers
                adding otherwise reads as a glitch. */}
            {shopLow > 0 && <Pill tone="light">{shopLow} running low</Pill>}
            <Icon name="fwd" size={20} className="shrink-0 text-ink/35" />
          </div>
        </Card>
      </motion.div>

      {/* ONE TASK, ONE CARD — never grouped into a shared box. */}
      {mine.map((t) => (
        <motion.div key={t.id} variants={listItem}>
          <TaskCard task={t} />
        </motion.div>
      ))}

      {/* PROGRESS CARD (lavender) */}
      <motion.div variants={listItem}>
        <Card tone="lavender">
          <div className="flex items-center">
            {/* The component, not a hand-rolled span. This well predates IconTile
                and was the same 40px circle built twice — which is how the two
                drifted apart (18px glyph here, 20px there). */}
            <IconTile name="trend" tone="lemon" />
            <span className="ml-auto">
              <TabToggle options={SPAN} value={span} onChange={setSpan} layoutId="phoneSpan" />
            </span>
          </div>
          <div className="mt-6 flex items-end gap-4">
            <div className="min-w-0 flex-1">
              <Eyebrow>Your progress</Eyebrow>
              <Sentence className="mt-0.5">{progress.text}</Sentence>
            </div>
            <span className="shrink-0 font-tight text-display leading-none tabular-nums"><Em>{pct}</Em>%</span>
          </div>
        </Card>
      </motion.div>

      {events.map((e) => (
        <motion.div key={e.id} variants={listItem}>
          <EventCard event={e} />
        </motion.div>
      ))}
    </>
  );
}

/**
 * The period label, doubling as the scope control.
 *
 * Each option carries its OWN period ("Month · July 2026"), which the old tab row
 * couldn't show — you had to switch to find out what you'd be looking at.
 */
function ScopePicker({
  scope, anchor, open, setOpen, onPick,
}: {
  scope: Scope; anchor: Date; open: boolean; setOpen: (v: boolean) => void;
  onPick: (s: Scope) => void;
}) {
  return (
    <span className="relative">
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-label="Change period"
        className="flex items-center gap-1 rounded-pill px-1.5 py-1 text-white/45 transition-colors hover:text-white"
      >
        <span className="tabular-nums">{periodLabel(scope, anchor)}</span>
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={smooth} className="flex">
          {/* Same size as the ‹ › steppers — they're all period controls. */}
          <Icon name="chevDown" size={16} />
        </motion.span>
      </button>

      <AnimatePresence>
        {open && (
          <>
            {/* Tap-away. Only mounted while open, so it never eats a stray tap. */}
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.96 }}
              transition={smooth}
              className="absolute left-0 top-full z-50 mt-1 w-max origin-top-left overflow-hidden
                         rounded-[18px] border border-white/15 bg-ink/95 p-1 shadow-e3 backdrop-blur-xl"
            >
              {SCOPE.map((sc) => (
                <button
                  key={sc}
                  onClick={() => { onPick(sc); setOpen(false); }}
                  className={clsx(
                    "flex w-full items-center gap-3 rounded-[14px] px-3 py-2 text-left normal-case tracking-normal transition-colors",
                    sc === scope ? "bg-white text-ink" : "text-white/70 hover:bg-white/10 hover:text-white",
                  )}
                >
                  <span className="text-bodysm font-medium">{sc}</span>
                  <span className={clsx("ml-auto text-caption tabular-nums", sc === scope ? "text-ink/50" : "text-white/35")}>
                    {periodLabel(sc, new Date())}
                  </span>
                </button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </span>
  );
}

/** A period stepper — 44px tap target, hairline chevron. */
function Step({ dir, onClick }: { dir: -1 | 1; onClick: () => void }) {
  return (
    <motion.button
      whileTap={press}
      onClick={onClick}
      aria-label={dir < 0 ? "Previous" : "Next"}
      className="grid h-touch w-6 shrink-0 place-items-center text-white/40 transition-colors hover:text-white"
    >
      <Icon name={dir < 0 ? "back" : "fwd"} size={16} />
    </motion.button>
  );
}

const SCOPE = ["Week", "Month", "Quarter", "Year"] as const;
type Scope = Period;

/**
 * THIS WEEK, at a glance — on Today, right under the greeting.
 *
 * The seven days of the current calendar week (Mon–Sun, matching the "13–19
 * July" period the rest of the app counts in — NOT a rolling fortnight, which
 * drifted out of step with that label). Today wears lemon; any day holding
 * something for you carries a dot. Tapping a day opens Ahead for the detail.
 *
 * It moved here from Ahead: a week ruler is a "what's my week" glance, which is
 * a Today question, not a navigation control buried in the Ahead header.
 */
function DateStrip({ onPick, busy }: { onPick: (d: Date) => void; busy: Set<string> }) {
  const todayStr = todayIso();
  const weekStart = startOfWeek(new Date());
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  return (
    // -mx-screen px-screen: bleed to the body's own gutter so the row sits edge
    // to edge under the greeting.
    <div className="no-scrollbar -mx-screen flex gap-2 overflow-x-auto overscroll-x-contain px-screen pb-0.5">
      {days.map((d) => {
        const di = iso(d);
        const isToday = di === todayStr;
        const has = busy.has(di);
        return (
          <button
            key={di}
            onClick={() => onPick(d)}
            aria-label={d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
            aria-current={isToday ? "date" : undefined}
            className={clsx(
              "grid h-[60px] flex-1 place-content-center place-items-center gap-1 rounded-[16px] transition-colors",
              isToday ? "bg-lemon text-ink"
                : "bg-white/[.07] text-white/80 hover:bg-white/[.12]",
            )}
          >
            <span className="text-[17px] font-semibold leading-none tabular-nums">{d.getDate()}</span>
            <span className="text-[10px] font-medium uppercase leading-none tracking-[0.06em] opacity-65">
              {d.toLocaleDateString("en-GB", { weekday: "short" })}
            </span>
            {/* Presence dot — ink on the lemon 'today', else lemon: the one spot of
                the app's colour on the strip. The strip sits on the dark app body. */}
            <span aria-hidden className={clsx("h-[3px] w-[3px] rounded-pill", has ? (isToday ? "bg-ink/45" : "bg-lemon") : "bg-transparent")} />
          </button>
        );
      })}
    </div>
  );
}

/** One row in the Ahead list — a task, an event or an upkeep item, all dated. */
type Item =
  | { kind: "task"; due: string; task: Task }
  | { kind: "event"; due: string; event: HouseEvent }
  | { kind: "maint"; due: string; item: MaintItem };

/**
 * What's on the horizon, at a given scope and anchor.
 *
 * Everything is merged into ONE dated list and sorted by `due`, because that's the
 * question the screen answers: what's coming, in order. Tasks/events/upkeep are
 * different kinds of thing but they share a timeline.
 *
 * Pulled out of the component: the shell's header reports the count and the page
 * renders the rows — two copies of this maths would drift.
 */
function aheadFor(
  s: ReturnType<typeof useHousehold.getState>,
  meId: string,
  scope: Scope,
  anchor: Date,
  query: string,
) {
  const q = query.trim().toLowerCase();
  const searching = q.length > 0;
  const range = periodRange(scope, anchor);

  // SEARCH IGNORES THE PERIOD. Looking for "boiler" inside the week you happen to be
  // on would find nothing and teach the user the search is broken. A search is a
  // question about the whole household, not about the lens you're holding.
  const keep = (due: string) => searching || inRange(due, range);
  const hit = (text: string) => !searching || text.toLowerCase().includes(q);

  const items: Item[] = [
    ...s.tasks
      .filter((t) => holder(t) === meId && keep(t.due) && hit(`${t.title} ${t.source ?? ""} ${t.recurring ?? ""}`))
      .map((task): Item => ({ kind: "task", due: task.due, task })),
    ...s.events
      .filter((e) => e.who === meId && keep(e.due) && hit(`${e.title} ${e.recurring ?? ""}`))
      .map((event): Item => ({ kind: "event", due: event.due, event })),
    // Upkeep is the whole household's, not one person's — it only shows up once
    // you're looking past the current week (or searching for it by name).
    ...(scope === "Week" && !searching
      ? []
      : s.maint
          .filter((m) => keep(m.due) && hit(`${m.title} ${m.asset} ${m.cadence}`))
          .map((item): Item => ({ kind: "maint", due: item.due, item }))),
  ].sort((a, b) => a.due.localeCompare(b.due) || Number(isDone(a)) - Number(isDone(b)));

  /**
   * Group at the rung BELOW the scope — grouping a month by month is one group,
   * which is no grouping at all.
   *   Week    -> flat (7 days reads fine as a list)
   *   Month   -> by WEEK
   *   Quarter -> by MONTH
   *   Year    -> by MONTH
   */
  // Search results span all time, so they always group by month regardless of scope.
  const by = searching ? "month" : scope === "Week" ? null : scope === "Month" ? "week" : "month";
  const keyOf = (due: string) => (by === "week" ? weekKey(due) : monthKey(due));

  const all = !by
    ? [{ key: "", label: "", items, past: false }]
    : [...new Set(items.map((i) => keyOf(i.due)))].sort().map((key) => ({
        key,
        label: by === "week" ? weekLabel(key) : monthLabel(key),
        items: items.filter((i) => keyOf(i.due) === key),
        past: groupIsPast(key),
      }));

  return {
    groups: all,
    searching,
    /** Zooming a group means "show me that period" — a week key needs Week scope. */
    zoomScope: (by === "week" ? "Week" : "Month") as Scope,
    count: items.filter((i) => !isDone(i)).length,
  };
}

const isDone = (i: Item) => i.kind === "task" && i.task.done;

type AheadProps = ReturnType<typeof aheadFor> & {
  scope: Scope;
  setScope: (s: Scope) => void;
  zoom: (key: string) => void;
  step: (dir: -1 | 1) => void;
  query: string;
  setQuery: (q: string) => void;
  /** Tail spacer height, measured by the shell so the current group can reach the top. */
  tail: number;
};

function PhoneAhead({ groups, count, zoom, step, query, searching, tail, zoomScope }: AheadProps) {
  // The first group that isn't behind us — the shell scrolls this to the top, so the
  // past sits above the fold instead of behind a button.
  const currentKey = groups.find((g) => !g.past)?.key ?? null;

  return (
    <>
      {/* Swipe left/right to step a period. `dragSnapToOrigin` puts the sheet back;
          we only read the gesture's DIRECTION, we never actually move the list.
          Disabled while searching — results aren't a period, so there's nowhere to go. */}
      <motion.div
        drag={searching ? false : "x"}
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.12}
        dragSnapToOrigin
        onDragEnd={(_, info) => {
          if (Math.abs(info.offset.x) > 60) step(info.offset.x < 0 ? 1 : -1);
        }}
        className="flex flex-col gap-tile"
      >
        {groups.map((g, gi) => (
          <div
            key={g.key}
            // The shell scrolls THIS one to the top on any lens change.
            data-current={g.key === currentKey ? "" : undefined}
            className="flex flex-col gap-tile"
          >
            {/* A group heading is a DOOR, not a label: tap it to narrow the whole
                screen onto that period. The affordance NAMES that — "Open week" /
                "Open month", from the scope it actually lands on. It used to be a
                bare `focus` glyph (corner brackets), which said something is
                tappable but never what it does; a door you can't read is a wall. */}
            {g.key && (
              <motion.button
                variants={listItem}
                onClick={() => zoom(g.key)}
                // px-4 + the list's 4px gutter = 20px, the same left edge as the page
                // title and every card's text. px-1 left it hanging 12px out.
                //
                // pt-3 pushes a heading clear of the PREVIOUS group's last card. The
                // first heading has no card above it — only the header, which already
                // sets the gap — so the padding there just doubled the distance to the
                // cue and made it read as the search bar's.
                className={clsx(
                  "group flex items-center gap-2 px-4 pb-1 text-left",
                  gi === 0 ? "pt-0" : "pt-3",
                )}
              >
                <Eyebrow tone="onDark" className={clsx(g.past && "text-white/25")}>{g.label}</Eyebrow>
                <span className="text-caption text-white/30">{g.items.length}</span>
                {/* Pushed right, so the label+count stay one unit and the action
                    reads as the row's verb rather than a third piece of metadata. */}
                <span className="ml-auto flex items-center gap-0.5 whitespace-nowrap text-micro
                                 uppercase tracking-[.14em] text-white/30 transition-colors
                                 group-hover:text-white/70">
                  Open {zoomScope.toLowerCase()}
                  <Icon name="fwd" size={12} />
                </span>
              </motion.button>
            )}
            {g.items.map((i) => (
              <motion.div
                key={`${i.kind}-${i.kind === "task" ? i.task.id : i.kind === "event" ? i.event.id : i.item.id}`}
                variants={listItem}
                // What's behind you is still there, just quieter.
                className={clsx(g.past && "opacity-60")}
              >
                {i.kind === "task" && <TaskCard task={i.task} />}
                {i.kind === "event" && <EventCard event={i.event} />}
                {i.kind === "maint" && <MaintCard item={i.item} />}
              </motion.div>
            ))}
          </div>
        ))}

        {count === 0 && (
          <motion.div variants={listItem}>
            <Card>
              <p className="py-10 text-center text-body text-sub">
                {searching ? `Nothing matches “${query.trim()}”` : "Nothing on — enjoy!"}
              </p>
            </Card>
          </motion.div>
        )}

        {/* Room for the current group to reach the top — measured by the shell, not a
            fixed 40vh. Zero when the content below already fills a viewport, so the list
            never scrolls past its last card into empty space. */}
        <div aria-hidden data-tail className="shrink-0" style={{ height: tail }} />
      </motion.div>
    </>
  );
}

/**
 * YOU — your load, and the levers on it.
 *
 * NOT a dashboard. The first cut of this tab was five read-only blocks — a
 * weekly percentage, a grid of mostly-empty dots, a patch you couldn't change —
 * and zero interactive elements. It answered "what should this SHOW" when the
 * real question is "what should it LET YOU DO".
 *
 * In a household, every argument is about load, and load is the one thing this
 * page can actually move. So it says where you stand COMPARATIVELY (a lone "38%"
 * is unjudgeable; "you have the most" is a fact you can act on) and puts the
 * verb right there.
 *
 * THE UNIT IS OPEN WORK, because that is the unit `rebalance()` moves. The old
 * page counted "this week" while the button acted on the backlog — the number
 * and the verb disagreed by construction.
 */
/* ─────────────────────── where you are ─────────────────────── */

/**
 * Four states, and "Working today" is deliberately not among them: everyone is
 * working today. It's `here` with extra words.
 *
 * Labels are SHORT so all four fit one 44px row. They were "Home today" / "Out
 * today", which wrapped to two rows and made the chips 40% of the card. The
 * caption below carries the meaning, so the chips don't have to.
 */
const PRESENCE_CHOICES: { key: Presence; label: string }[] = [
  { key: "here", label: "Here" },
  { key: "wfh", label: "Home today" },
  { key: "out", label: "Out" },
  { key: "away", label: "Away" },
];

/** The state, in the person's own voice — the card's 18px title.
 *  No date on the `away` line: the chip under it is the date's control and shows
 *  its own value ("Back Monday"), so saying it twice would be noise. */
const PRESENCE_TITLE: Record<Presence, string> = {
  here: "You’re around",
  wfh: "You’re home today",
  out: "You’re out today",
  away: "You’re away",
};

/**
 * What the app DOES about it — the reason to touch this card at all, and the
 * only line that survives the fold.
 *
 * `wfh` reads as a gain, not an excuse, and that's the whole argument of this
 * feature: every other app treats availability as "don't bother me", but being
 * home makes you MORE useful for home work, not less. suggestTaker scores it
 * accordingly (-4, two tasks' worth).
 *
 * `away` takes the return date because the date's control is now BEHIND the
 * fold — a collapsed "You're away / nothing new lands on you" would hide the one
 * fact anyone actually wants ("until when?"). Folding controls away must never
 * fold information away with them.
 *
 * Kept short so each stays on ONE line at the card's width (362px). Measured,
 * not estimated.
 */
const PRESENCE_EFFECT: Record<Presence, (to?: string) => string> = {
  here: () => "Work gets shared out as normal.",
  wfh: () => "Home all day, so you’re first pick for house jobs.",
  out: () => "Daytime jobs go to someone else.",
  away: (to) => to
    ? `Back ${relativeInline(to)}. Nothing new lands on you.`
    : "Nothing new lands on you.",
};

/** "22:00" -> "10:00 PM". The store keeps 24h because it sorts and compares;
 *  people read 12h. The seam belongs here, at the glass. */
const to12 = (hhmm: string): string => {
  const [h, m] = hhmm.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
};

/** "10:00 PM" -> "22:00". */
const to24 = (label: string): string => {
  const m = label.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!m) return "00:00";
  const h = (Number(m[1]) % 12) + (/pm/i.test(m[3]) ? 12 : 0);
  return `${String(h).padStart(2, "0")}:${m[2]}`;
};

function PhoneYou() {
  const s = useHousehold();
  const meId = currentMember(s);
  const me = s.members[meId];
  const people = doers(s);

  const load = (id: MemberId) => pendingFor(s, id);
  const board = people.map((m) => ({ m, n: load(m.id) })).sort((a, b) => b.n - a.n);
  const mine = load(meId);
  /** The rest of the house, still ordered heaviest-first — you're pulled out as
   *  the headline, so the board's ranking only has to hold for everyone else. */
  const others = board.filter(({ m }) => m.id !== meId);

  /**
   * THE APP'S JUDGEMENT — and it asks the BALANCER, rather than re-deriving it.
   *
   * This card used to compute its own fairness as `most - least >= 2` off the raw
   * board, and that was wrong twice over:
   *
   *  1. `least` is Ada, at 0 — a seven-year-old the role floor bars from almost
   *     everything. So the gap was permanently >= 2 and "Fairly shared right now"
   *     could essentially never appear: the card would insist, forever, that
   *     somebody had "the most", measured against a child who isn't allowed to
   *     help.
   *  2. On a tie (Sam 5, Maya 5) it named whichever sorted first — telling Sam
   *     that Maya "has the most" while he held exactly as much.
   *
   * `previewRebalance` has neither flaw: it only counts people who could
   * ACTUALLY take the work, and it's the same call the button and the confirm
   * sheet make. So the sentence, the button, and the sheet can never disagree —
   * if it says nothing is worth moving, the card says the house is level.
   */
  const move = previewRebalance(s);
  const headline =
    mine === 0 ? "You’re all clear"
    // Nobody to compare against — a solo home would otherwise be told its work
    // is "fairly shared", which is a strange thing to say to someone alone.
    : board.length < 2 ? "All yours"
    : !move ? "Fairly shared right now"
    // Never "— Ada has 0": the lightest person is almost always the youngest, and
    // naming them reads as "why isn't the seven-year-old doing more" — unkind,
    // and untrue, since rebalance wouldn't move it to her either.
    : move.from.id === meId ? "You’re carrying the most"
    : `${move.from.name} has the most right now`;

  /**
   * `rebalance()` moves work off the HEAVIEST person, and only when it can find a
   * taker who'd actually even things up. Both facts have to gate the button, or
   * it's a control that lies: offered when it would refuse, or offered on MY page
   * while it quietly takes work off Sam.
   *
   * Asking the Balancer beats re-deriving its rule — this was a hand-copy of
   * `most - least >= 2` that had drifted from the real precondition and measured
   * against people who couldn't take the work anyway.
   */
  const canEven = !!move && move.from.id === meId;

  /* --- where you are --- */
  const av = me.availability ?? { presence: "here" as Presence };
  const presence = av.presence;
  const [whereOpen, setWhereOpen] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);
  const [quietOpen, setQuietOpen] = useState(false);
  const [quietEdge, setQuietEdge] = useState<"from" | "to">("from");
  /** A default to EDIT, not to save. Nothing is stored until a wheel moves. */
  const quiet = av.quiet ?? { from: "22:00", to: "07:00" };

  /**
   * What a trip would strand. `away` stops NEW work landing on you — it says
   * nothing about the work you already had, which just sits there quietly being
   * due while you're in Spain. That gap is the whole of Phase 2.
   *
   * Only tasks INSIDE the span: being away Thursday has no bearing on something
   * due next Tuesday, and offering to hand that off too would be the app
   * overreaching on a fact it was given for a narrower purpose.
   */
  const needsCover = presence === "away"
    ? s.tasks.filter((t) => t.owner === meId && !t.done && !t.coveredBy && awayOn(me, t.due))
    : [];
  const covered = presence === "away" ? coveredFor(s, meId) : [];
  /** Distinct people, not tasks — two jobs on one person is one name. */
  const coverNames = [...new Set(covered.map((t) => s.members[t.coveredBy!]?.name ?? "Someone"))];

  const jobs = [...(me.responsibility?.domains ?? []), ...(me.responsibility?.spaces ?? [])];

  return (
    <>
      {/* 1 · YOUR LOAD — comparative, and with a verb.
          Compact on purpose: this card was ~300px and said "5" THREE times — a
          display numeral, a 28px sentence repeating it, and the bars saying it
          again — over an icon tile that carried no information. The bars ARE the
          insight; everything stacked above them was preamble. One line of voice,
          then the evidence, then the verb. */}
      {/* Always WHITE, never lemon. Lemon is the day's hero (DESIGN §2) — the
          app's affirmative tone — so painting the card with it when you're
          carrying too much said "great news!" about an imbalance. This app has
          no alert slab on purpose: `danger` is a label, never a fill. The
          sentence names the problem and the dark button offers the fix; that's
          the whole signal, and it doesn't need to shout in the day's colour. */}
      <motion.div variants={listItem}>
        <Card>
          {/* Icon LEADS, text sits to its right — the row shape the progress card
              already uses, and the one that reads as "a labelled thing" rather than
              a glyph parked above a paragraph. Stacking it made every card open with
              40px of nothing.
              `scale` is the same glyph as "Even it out": the card's subject and its
              verb, said once. */}
          <div className="flex items-start gap-3">
            <IconTile name="scale" />
            {/* No subtext: the stat block IS the detail, and it says its own unit.
                A third line here would only restate what the numbers already show. */}
            <TitleBlock eyebrow="Your load" title={headline} />
          </div>

          {/* THE HOUSE, AS PEOPLE. Not a chart of any kind.
              ─────────────────────────────────────────────────────────────────
              Two attempts died here and both were the same mistake wearing
              different ink. A stacked bar with a legend: you decode a swatch
              into a name into a share. Rows of dots: still a bar chart, just
              with gaps — marks on a shared baseline, ranked. Both asked a
              seven-year-old to read an encoding, and both made the household a
              leaderboard where Ada comes last with nothing.

              A home doesn't rank its people. It looks at them.

              So: everyone's face, and the number of things they're holding. The
              number IS the count — there's no encoding to undo, no axis, no
              proportion, no legend. Faces are the app's own identity language
              (the switcher, every task card); this card was the one place that
              turned people into coloured rectangles.

              The VERDICT lives in the subtext, not in the picture. This app's
              whole promise is absorbing the mental load — so it should say "that's
              more than anyone else" rather than draw four shapes and leave you to
              work it out. Reading a chart IS the mental load. */}
          {/* YOU, then everyone else. A flat row of four gave your number the
              same weight as Leo's, on a card called YOUR load reached from a tab
              called You — the house is context for your number, not a peer of
              it. So yours is the headline and the rest are the reference beside
              it, which is also the order the sentence above already reads in. */}
          <div className="mt-3 flex items-center gap-4">
            <div className="flex shrink-0 items-center gap-3">
              {/* MEASURED against the stack beside it, not estimated: the
                  numeral's line box is taller than its 34px because the
                  baseline-aligned "tasks" caption drags the row to its own
                  20px line-height. Arithmetic said 58; the DOM said 72. */}
              <Avatar member={me} size={72} />
              {/* Label ABOVE the value — the eyebrow→value grammar every other
                  block on this tab uses. "You" was hanging underneath as a
                  caption, which read as a footnote to the number rather than the
                  thing the number belongs to. Same <Eyebrow> the cards use, so
                  it can't drift from them. */}
              <div>
                <Eyebrow>You</Eyebrow>
                <div className="mt-0.5 flex items-baseline gap-1.5">
                  <span className="font-tight text-[34px] leading-none tabular-nums">{mine}</span>
                  {/* THE UNIT. Nothing on this card said what any of these
                      numbers counted — "6" over "Maya 5" could have been points,
                      stars, or days. Said once, on the hero; the column beside it
                      inherits the unit by sitting in the same object. */}
                  <span className="text-caption text-sub">{mine === 1 ? "task" : "tasks"}</span>
                </div>
              </div>
            </div>

            {/* The hairline does the comparing — it's what makes these READ as
                "everyone else" rather than as three more entries in a list. */}
            <div className="flex min-w-0 flex-1 flex-col gap-1.5 border-l border-ink/[.08] pl-4">
              {others.map(({ m, n }) => (
                <span key={m.id} className="flex items-center gap-2 text-caption">
                  <Avatar member={m} size={20} />
                  <span className="truncate text-sub">{m.name}</span>
                  {/* Same weight as the hero's numeral — same family, same 400,
                      full ink. They were text-ink/60, which made everyone else's
                      work look like faint reference data next to yours; the
                      SIZE carries the hierarchy, so the colour doesn't have to
                      whisper. A zero is a fact too, and gets to be as solid. */}
                  <span className="ml-auto shrink-0 font-tight text-[18px] leading-none tabular-nums text-ink">
                    {n}
                  </span>
                </span>
              ))}
            </div>
          </div>

          {mine > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {canEven && (
                <Button tone="dark" onClick={() => s.openSheet({ type: "rebalance" })}>
                  <Icon name="scale" size={14} /> Even it out
                </Button>
              )}
              <Button tone="outline" onClick={() => s.openSheet({ type: "handoff" })}>
                <Icon name="handoff" size={14} /> Hand one off
              </Button>
            </div>
          )}
        </Card>
      </motion.div>

      {/* 2 · WHERE YOU ARE — the one card on this tab that changes what the app
          DOES. Presence feeds suggestTaker directly, so every chip here moves
          real work: say you're home and the next delivery job finds you.

          STATE FIRST, CONTROLS FOLDED. This is the same shape as the New Task
          sheet: say what's true, then hide the machinery behind "Adjust". Four
          chips and a quiet-hours row were 130px of permanently-open controls for
          something you touch once a day at most — and on most days, not at all.
          A picker that's open when you're not using it isn't availability, it's
          furniture.

          What stays visible is what you'd actually want at a glance: the state,
          and what the app will do about it. */}
      <motion.div variants={listItem}>
        <Card>
          {/* Quiet hours belongs in the SUMMARY, not just behind the fold —
              same rule the away date already taught us: folding a control away
              must not fold its VALUE away. Someone who set quiet hours should
              never have to open a panel to find out whether they're still on.

              Only when it's SET. "No quiet hours" is a null fact, and a summary
              that lists the settings you haven't touched is an inventory, not a
              summary. Unset, the control behind Adjust is the only mention —
              which is the right weight for something nobody's chosen yet. */}
          <div className="flex items-start gap-3">
            <IconTile name="pin" />
          <TitleBlock
            eyebrow="Where you are"
            title={PRESENCE_TITLE[presence]}
            subtext={
              <>
                {/* "Nothing new lands on you" is true and, with five tasks due
                    inside the span, beside the point. Lead with the work that's
                    still yours — that's the thing you'd want to know before you
                    got on the plane. */}
                <span>
                  {presence === "away" && needsCover.length
                    ? `${av.to ? `Back ${relativeInline(av.to)}. ` : ""}${needsCover.length} ${needsCover.length === 1 ? "task" : "tasks"} still on you.`
                    : presence === "away" && covered.length
                      // The verb agrees with the NAMES, not the tasks. Two tasks
                      // covered by one person is still "Sam has it covered".
                      ? `${av.to ? `Back ${relativeInline(av.to)}. ` : ""}${listOf(coverNames)} ${coverNames.length === 1 ? "has" : "have"} it covered.`
                      : PRESENCE_EFFECT[presence](av.to)}
                </span>
                {/* No middot. The effect line is long enough to wrap, which
                    strands a separator alone at the end of a line — and the
                    glyph already marks where one fact ends and the next begins,
                    on one line or two. */}
                {av.quiet && (
                  <span className="flex items-center gap-1">
                    <Icon name="moon" size={12} className="shrink-0" />
                    Quiet {to12(av.quiet.from)} – {to12(av.quiet.to)}
                  </span>
                )}
              </>
            }
          />
          </div>

          {/* OUTSIDE the fold, deliberately. Everything else in this card is a
              setting you went looking for; this is the app telling you work will
              be stranded. That doesn't wait behind "Adjust" — same reasoning as
              "Even it out" on the load card: the verb sits with the problem. */}
          {needsCover.length > 0 && (
            <Button tone="dark" className="mt-3" onClick={() => s.coverAway(meId)}>
              <Icon name="handoff" size={14} />
              Find cover for {needsCover.length === 1 ? "it" : `all ${needsCover.length}`}
            </Button>
          )}

          {/* Same control, same words, same chevron as the New Task sheet's
              readback. Two disclosures that behave differently would be two
              things to learn. */}
          <button
            onClick={() => setWhereOpen((v) => !v)}
            aria-expanded={whereOpen}
            className="mt-2 flex items-center gap-1 text-caption font-medium text-sub transition-colors hover:text-ink"
          >
            {whereOpen ? "Done" : "Adjust"}
            <motion.span animate={{ rotate: whereOpen ? 180 : 0 }} transition={smooth} className="flex">
              <Icon name="chevDown" size={12} />
            </motion.span>
          </button>

          <AnimatePresence initial={false}>
            {whereOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={smooth}
                className="overflow-hidden"
              >
                <div className="mt-3 flex flex-wrap gap-2">
                  {PRESENCE_CHOICES.map(({ key, label }) => (
                    <Choice
                      key={key}
                      selected={presence === key}
                      // Re-picking `away` keeps the return date; picking anything else
                      // drops it — the store insists, and it's right to.
                      onClick={() => s.setPresence(meId, key, key === "away" ? { from: av.from, to: av.to } : undefined)}
                    >
                      {label}
                    </Choice>
                  ))}
                </div>

                {presence === "away" && (
                  <div className="mt-2">
                    <PickerChip kind="date" open={dateOpen} onToggle={() => setDateOpen((v) => !v)} active={!!av.to}>
                      {av.to ? `Back ${relative(av.to)}` : "Until when?"}
                    </PickerChip>
                    <PickerPanel open={dateOpen}>
                      <MiniCalendar
                        value={av.to ?? todayIso()}
                        onPick={(v) => { s.setPresence(meId, "away", { from: av.from, to: v }); setDateOpen(false); }}
                      />
                    </PickerPanel>
                  </div>
                )}

                {/* Quiet hours. Honest label: nothing consumes this yet — the app has
                    no push, and a toast is feedback for your own tap, which must never
                    be silenced. It's here because the household's answer to "don't wake
                    the kids" shouldn't have to wait for the notification plumbing.

                    It lives behind the same fold because it's the rarest control on the
                    tab: you set it once, ever. */}
                <div className="mt-4 border-t border-ink/[.06] pt-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-bodysm font-medium">Quiet hours</div>
                      <div className="mt-hair text-caption text-sub">
                        {av.quiet ? `${to12(av.quiet.from)} – ${to12(av.quiet.to)}` : "Reminders can reach you any time"}
                      </div>
                    </div>
                    <PickerChip kind="time" open={quietOpen} onToggle={() => setQuietOpen((v) => !v)} active={!!av.quiet}>
                      {av.quiet ? "Change" : "Set"}
                    </PickerChip>
                  </div>
                  <PickerPanel open={quietOpen}>
                    {/* One wheel, not two stacked — two clocks is 360px of panel for a
                        pair of numbers. The edge you're editing is a choice. */}
                    <div className="flex flex-wrap gap-2">
                      <Choice selected={quietEdge === "from"} onClick={() => setQuietEdge("from")}>From {to12(quiet.from)}</Choice>
                      <Choice selected={quietEdge === "to"} onClick={() => setQuietEdge("to")}>To {to12(quiet.to)}</Choice>
                    </div>
                    <div className="mt-2">
                      <MiniClock
                        value={to12(quiet[quietEdge])}
                        onPick={(v) => s.setQuietHours(meId, { ...quiet, [quietEdge]: to24(v) })}
                      />
                    </div>
                    {av.quiet && (
                      <button
                        onClick={() => { s.setQuietHours(meId, undefined); setQuietOpen(false); }}
                        className="mt-1 w-full py-2 text-caption text-sub transition-colors hover:text-ink"
                      >
                        Turn off quiet hours
                      </button>
                    )}
                  </PickerPanel>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </Card>
      </motion.div>

      {/* 3 · YOUR PATCH — the standing agreement. Today says what's on, Ahead
          says what's coming; only this says what's YOURS, with no tasks in it.
          Read-only for now: it's a household agreement, not a preference. */}
      <motion.div variants={listItem}>
        <Card>
          {/* The title truncates rather than wraps, and that's safe HERE
              specifically: the pills below name every domain in full, so a long
              patch loses nothing to the ellipsis. */}
          <div className="flex items-start gap-3">
            <IconTile name="grid" />
          <TitleBlock
            eyebrow="Your patch"
            title={jobs.length
              ? `You look after ${listOf(me.responsibility?.domains.length
                  ? me.responsibility.domains
                  : me.responsibility?.spaces ?? [])}`
              : "Nothing’s yours yet"}
            subtext={jobs.length ? undefined : `${ownerName(s)} can hand you a domain or a room.`}
          />
          </div>
          {jobs.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {jobs.map((j) => <Pill key={j} tone="tag">{j}</Pill>)}
            </div>
          )}
        </Card>
      </motion.div>

      {/* 4 · YOUR ACCESS — the role, in words. The header names it ("Limited");
          nothing anywhere said what it MEANT, so a limited member had no way to
          learn why money is invisible to them. */}
      <motion.div variants={listItem}>
        <Card>
          {/* No icon. A padlock next to "Limited" editorialises — it says being
              limited is a lock-out, when the role model's whole point is that it
              describes what someone LOOKS AFTER, not what they're shut out of.
              It also made this the only card on the tab whose eyebrow started
              40px from the left edge, so the column no longer lined up. */}
          <div className="flex items-start gap-3">
            <IconTile name="key" />
            <TitleBlock
              className="flex-1"
              eyebrow="Your access"
              title={ROLE_LABEL[me.role]}
              subtext={ROLE_HINT[me.role]}
            />
            {/* Stars belong to the guided surface — see the role model. */}
            {me.role === "guided" && (
              <span className="shrink-0 font-tight text-h1 tabular-nums text-star">★ {me.stars ?? 0}</span>
            )}
          </div>
          {me.role !== "owner" && (
            <p className="mt-3 border-t border-black/[.05] pt-3 text-caption text-sub">
              Only {ownerName(s)} can change this.
            </p>
          )}
        </Card>
      </motion.div>
    </>
  );
}

/** "Meals and Bills" · "Meals, Bills and Laundry" — a list a person would say. */
const listOf = (xs: string[]) =>
  xs.length <= 1 ? xs[0] ?? "" : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`;

const ownerName = (s: ReturnType<typeof useHousehold.getState>) =>
  Object.values(s.members).find((m) => m.role === "owner")?.name ?? "the owner";
