"use client";

import clsx from "clsx";
import { useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Icon, type IconName } from "@/components/Icons";
import { SAFE_TOP } from "@/components/DeviceFrame";
import { EventCard, MaintCard, TaskCard } from "@/components/TaskCard";
import { ActionButton, Avatar, Button, Card, Choice, Em, Eyebrow, IconTile, MiniCalendar, MiniClock, PickerPanel, Pill, Sentence, TabToggle, TitleBlock } from "@/components/ui";
import { listItem, listStagger, press, smooth, spring } from "@/lib/motion";
import {
  addDays, greeting, inRange, isCurrentPeriod, iso, isToday, monthKey, monthLabel, parse,
  periodLabel, groupIsPast, periodRange, relative, relativeInline, shiftPeriod, startOfWeek, timeMinutes, today, todayIso, weekKey, weekLabel, type Period,
} from "@/lib/dates";
import { awayOn, currentMember, holder, pendingFor, shoppingList, useHousehold } from "@/lib/store";
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
        // overflow-x-clip: the Today pager slides whole day-columns through ±104%
        // of their width — clip (not hidden) discards that overflow without
        // creating a second scroll axis.
        className="no-scrollbar relative min-h-0 flex-1 overflow-y-auto overflow-x-clip overscroll-contain"
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
            {/* The You header IS the identity — portrait + household/name — so it
                fills the same band every other tab's title fills (no empty top
                gap), and the body below leads straight into the standing. */}
            {route === "you" && (
              // pl-1.5 seats the avatar on the SAME column as the body cards.
              // Name over household — the role moves into the standing card below.
              <div className="flex items-center gap-3 pl-1.5">
                <Avatar member={me} size={56} />
                <TitleBlock size="page" tone="onDark" title={me.name} subtext={s.householdName} />
              </div>
            )}
          </div>
          <div className="flex shrink-0 items-center">
            {/* The gear rides the YOU header — that tab is your dashboard, and
                account/profile/settings live one tap away behind it, off the
                dashboard rather than cluttering it. Personal chrome, on the
                personal tab. */}
            {route === "you" && (
              <button
                onClick={() => s.openSheet({ type: "settings" })}
                aria-label="Settings"
                className="grid h-touch w-touch place-items-center rounded-pill text-white/70 transition-colors hover:text-white"
              >
                <Icon name="gear" size={24} />
              </button>
            )}
            {/* Just the bell. The shopping cart used to sit here and it was
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
  /** The day the strip is pointed at — drives everything below the greeting.
   *  Starts on today; tapping the ruler moves it. */
  const [sel, setSel] = useState<string>(() => todayIso());
  /**
   * Which way the page TRAVELS when the day changes: +1 forward in time (new
   * day slides in from the right), -1 backward. ISO strings compare in date
   * order, so the sign falls straight out of a string comparison. Every door —
   * ruler tap, swipe — goes through goDay so the slide always knows its
   * direction.
   */
  const [dir, setDir] = useState(0);
  const goDay = (next: string) => {
    if (next === sel) return;
    setDir(next > sel ? 1 : -1);
    setSel(next);
  };
  const s = useHousehold();
  const meId = currentMember(s);
  const me = s.members[meId];
  const selDate = parse(sel);
  const onSel = isToday(sel);
  /** Both lists are for the SELECTED day and sorted by when they happen — so an
   *  8 PM bin night never sits above a 3:15 pickup. */
  const mine = s.tasks
    .filter((t) => holder(t) === meId && !t.done && t.due === sel)
    .sort((a, b) => timeMinutes(a.when) - timeMinutes(b.when));
  const events = s.events
    .filter((e) => e.who === meId && e.due === sel)
    .sort((a, b) => timeMinutes(a.time) - timeMinutes(b.time));

  /**
   * THE TWO-HOUR HORIZON. The page's order is urgency, not species: whatever is
   * ON you inside the next two hours (tasks and events alike, overdue included —
   * a 3:15 pickup at 4 o'clock is MORE pressing, not less) sits directly under
   * the hero, before the house-keeping cards. Everything further out waits below
   * the progress card. Only today has a "next two hours"; on other days it all
   * reads as later.
   */
  const nowMin = (() => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); })();
  const cards = [
    ...mine.map((t) => ({ key: `t${t.id}`, at: timeMinutes(t.when), el: <TaskCard task={t} /> })),
    ...events.map((e) => ({ key: `e${e.id}`, at: timeMinutes(e.time), el: <EventCard event={e} /> })),
  ].sort((a, b) => a.at - b.at);
  const soon = onSel ? cards.filter((c) => c.at >= 0 && c.at <= nowMin + 120) : [];
  const later = cards.filter((c) => !soon.includes(c));

  /** Which days hold something for me — the ruler's presence dots. Across the
   *  whole range, not just this week. Cheap: a walk over two small arrays. */
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

  const highCount = mine.filter((t) => t.priority === "high").length;
  // "for today" on today; "for Saturday" on a day you've scrolled to.
  const dayWord = onSel ? "today" : selDate.toLocaleDateString("en-GB", { weekday: "long" });

  /**
   * SWIPE ANYWHERE to page through days: left → tomorrow, right → yesterday,
   * strip and page in lockstep because both are just `sel`.
   *
   * Two hard-won rules in here:
   *  - COMMIT ON MOVE, not on pointerup. On touch, the instant the browser
   *    claims the gesture for scrolling it fires pointercancel and the up you
   *    were waiting for never arrives — an edge-swipe judged at pointerup
   *    simply doesn't fire on a phone. (That, plus only listening to a 28px
   *    edge strip, is why v1 "didn't move days".) `touch-pan-y` keeps the
   *    browser to vertical scrolling so horizontal moves stay ours to read.
   *  - A gesture that wanders >48px vertically is a scroll and is disqualified
   *    for good; one that runs 56px horizontally first is a page-turn, once.
   *    Taps never travel that far, so cards and buttons are unaffected.
   * The day ruler opts out (data-swipe-exempt): it has its own horizontal
   * scroll, and paging the day underneath it mid-drag would be chaos.
   */
  const swipe = useRef<{ x: number; y: number; spent: boolean } | null>(null);
  const onSwipeDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("[data-swipe-exempt]")) { swipe.current = null; return; }
    swipe.current = { x: e.clientX, y: e.clientY, spent: false };
  };
  const onSwipeMove = (e: React.PointerEvent) => {
    const g = swipe.current;
    if (!g || g.spent) return;
    const dx = e.clientX - g.x, dy = e.clientY - g.y;
    if (Math.abs(dy) > 48) { swipe.current = null; return; } // it's a scroll
    if (Math.abs(dx) >= 56) {
      g.spent = true; // one page-turn per gesture
      goDay(iso(addDays(selDate, dx < 0 ? 1 : -1)));
    }
  };
  const onSwipeEnd = () => { swipe.current = null; };

  return (
    // A real box (not `contents`) so the gesture has a surface; reproduces the
    // parent's column-and-gap so the cards sit exactly as before.
    <div
      className="relative flex touch-pan-y flex-col gap-tile"
      onPointerDown={onSwipeDown}
      onPointerMove={onSwipeMove}
      onPointerUp={onSwipeEnd}
      onPointerCancel={onSwipeEnd}
    >
      {/* THE DAY RULER — scroll it, tap a day, and the page below repaints for
          that day. The date it points at lives in `sel`. It sits OUTSIDE the
          pager below: the ruler is the map, the page is the territory — the map
          glides its highlight while the territory slides whole. */}
      <motion.div variants={listItem}>
        <DateStrip selected={sel} busy={busy} onPick={(d) => goDay(iso(d))} />
      </motion.div>

      {/* THE PAGER. One column of cards per day, keyed by the day, so changing
          `sel` mounts the new day's column and retires the old one — and the
          retirement is a SLIDE: the whole view exits the way you pushed it and
          the next day arrives from the opposite wing, like turning a page.
          `popLayout` lifts the leaving column out of flow (else the two stack
          vertically for a frame); `initial={false}` keeps the first mount
          still. The strip above doesn't move — anchors don't travel. */}
      <AnimatePresence initial={false} custom={dir} mode="popLayout">
      <motion.div
        key={sel}
        custom={dir}
        variants={DAY_PAGE}
        initial="enter"
        animate="center"
        exit="exit"
        transition={{ duration: 0.34, ease: [0.32, 0.72, 0, 1] }}
        className="flex flex-col gap-tile"
      >
      {/* PRIMARY CARD (lemon) — the day, said out loud */}
      <div>
        <Card tone="lemon">
          <div className="flex items-center">
            {/* The date used to sit here ("17 Fri") — but the ruler above now says
                which day this is, and saying it twice was just noise. The glyph is
                the SAME one the Today tab wears in the nav — this card is that
                tab's headline, so they share a mark. `onTint` is the well built
                for tinted cards: a flat ink wash that reads dark-on-light on
                lemon, where the white `neutral` well goes muddy. */}
            <IconTile name="feed" tone="onTint" />
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
                {/* The timeframe always breaks to its own line — the count is the
                    first thing read, the day the second. Not left to wrap. */}
                <span className="block">for {dayWord}</span>
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
            /* A DOOR, not a label: the app's one urgent signal should take you
               to the urgent thing. Opens the day's first high task — with more
               than one, the earliest is where you'd start anyway. */
            <button
              onClick={() => {
                const hot = mine.find((t) => t.priority === "high");
                if (hot) s.openSheet({ type: "task", id: hot.id });
              }}
              className="mt-3 flex items-center gap-1 text-caption font-medium text-danger"
            >
              <Icon name="high" size={14} /> {highCount} {highCount === 1 ? "is" : "are"} high
            </button>
          )}
        </Card>
      </div>

      {/* WITHIN THE NEXT TWO HOURS — the pressing things ride directly under the
          hero, ahead of the house-keeping cards. One thing, one card. */}
      {soon.map((c) => (
        <div key={c.key}>{c.el}</div>
      ))}

      {/* THE SHARED LIST (mint) — the one collective thing on a personal phone.
          It was a cart in the header crowding the greeting; a thing everyone
          shares shouldn't hide in a corner of personal chrome. As a card it can
          say what's on it, and tapping opens the full list. Mint (not lavender)
          so it doesn't twin with the progress card two rows down. */}
      <div>
        <Card tone="mint" onClick={() => s.openSheet({ type: "shop" })}>
          {/* SAME SHAPE AS 'YOUR PROGRESS' — line one is the icon tile with a
              status chip riding the far end; line two is the eyebrow/figure pair
              with an affordance on the right. Consistency across the two summary
              cards, so the phone reads as one system. */}
          <div className="flex items-center">
            <IconTile name="cart" tone="lemon" />
            {/* The house-flagged items get a word — an item nobody remembers
                adding otherwise reads as a glitch. Rides the far end, where the
                progress card keeps its toggle. */}
            {shopLow > 0 && <span className="ml-auto"><Pill tone="light">{shopLow} running low</Pill></span>}
          </div>
          <div className="mt-6 flex items-end gap-4">
            <div className="min-w-0 flex-1">
              <Eyebrow>Shared list</Eyebrow>
              <Sentence className="mt-0.5">
                {shopOpen ? <><Em>{shopOpen}</Em> to get</> : "All bought"}
              </Sentence>
            </div>
            {/* An UP-chevron, not an arrow: the list opens as a sheet rising from
                the bottom of this same screen. A forward arrow promised a page
                somewhere else; this says "lifts open, right here". */}
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-pill bg-ink text-white">
              <Icon name="chevUp" size={18} />
            </span>
          </div>
        </Card>
      </div>

      {/* PROGRESS CARD (lavender) */}
      <div>
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
      </div>

      {/* THE REST OF THE DAY — everything past the two-hour horizon (and the
          whole day, when you're reading a day that isn't today). */}
      {later.map((c) => (
        <div key={c.key}>{c.el}</div>
      ))}
      </motion.div>
      </AnimatePresence>
    </div>
  );
}

/**
 * The day-pager's travel. Direction rides in as `custom` (+1 = forward in
 * time): the new day enters from the wing you pushed toward and the old one
 * leaves through the opposite — 104% so a page fully clears its own width
 * (plus a breath) before the corner radius could peek back in.
 */
const DAY_PAGE = {
  enter: (d: number) => ({ x: d >= 0 ? "104%" : "-104%" }),
  center: { x: "0%" },
  exit: (d: number) => ({ x: d >= 0 ? "-104%" : "104%" }),
};

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
 * THE DAY RULER — on Today, right under the greeting. Scroll it through the
 * weeks; tap a day to REPAINT Today for that day (its tasks, its events, its
 * count) — it doesn't jump you to Ahead, it drives the page you're on.
 *
 * Two selection states, kept distinct on purpose:
 *   today          — lemon FILLED. The app's fixed "you are here", always.
 *   a day you PICK  — lemon STROKE. Today keeps its fill; the day you're reading
 *                     wears a ring, so "where I am" and "what I'm looking at"
 *                     never collapse into one ambiguous highlight.
 * Any day holding something for you carries a dot.
 */
function DateStrip({ selected, onPick, busy }: { selected: string; onPick: (d: Date) => void; busy: Set<string> }) {
  const todayStr = todayIso();
  // A week back to five weeks on: enough to wander without it feeling endless.
  const start = addDays(startOfWeek(new Date()), -7);
  const days = Array.from({ length: 42 }, (_, i) => addDays(start, i));
  const scroller = useRef<HTMLDivElement>(null);
  const selRef = useRef<HTMLButtonElement>(null);
  const firstCentre = useRef(true);
  /**
   * THE DAY YOU'RE READING SITS DEAD CENTRE. Wherever the selection moves — a
   * tap, an edge swipe — the strip glides so that day is the strip's midpoint.
   * Instant on mount (no opening cinematics), smooth after.
   *
   * Measured from RECTS, not offsetLeft: offsetLeft answers to the nearest
   * POSITIONED ancestor (the page wrapper), while scrolling answers to this
   * box — the strip's -mx bleed sits between the two, so the offset route
   * centred 4px short and the day sat just right of centre, always. Rects
   * give the visible error directly; dividing by the frame's scale converts
   * it back to scroll units, and the correction is exact by construction.
   */
  useLayoutEffect(() => {
    const c = scroller.current, t = selRef.current;
    if (!c || !t) return;
    const cr = c.getBoundingClientRect(), tr = t.getBoundingClientRect();
    const scale = cr.width / c.clientWidth || 1;
    const delta = (tr.left + tr.width / 2) - (cr.left + cr.width / 2);
    c.scrollTo({ left: c.scrollLeft + delta / scale, behavior: firstCentre.current ? "auto" : "smooth" });
    firstCentre.current = false;
  }, [selected]);
  return (
    // -mx-screen px-screen: bleed to the body's own gutter so the row scrolls
    // edge to edge under the greeting.
    <div ref={scroller} data-swipe-exempt className="no-scrollbar -mx-screen flex gap-2 overflow-x-auto overscroll-x-contain px-screen pb-0.5">
      {days.map((d) => {
        const di = iso(d);
        const isToday = di === todayStr;
        const isSel = di === selected;
        const has = busy.has(di);
        return (
          <button
            key={di}
            ref={isSel ? selRef : undefined}
            onClick={() => onPick(d)}
            aria-label={d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
            aria-current={isToday ? "date" : isSel ? "true" : undefined}
            className={clsx(
              "grid h-[60px] w-[46px] shrink-0 place-content-center place-items-center gap-1 rounded-[16px] transition-colors",
              isToday ? "bg-lemon text-ink"
                : isSel ? "bg-white/[.07] text-white ring-2 ring-inset ring-lemon"
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

/** The state, in the person's own voice — the "Where you are" card's title. */
const PRESENCE_TITLE: Record<Presence, string> = {
  here: "You’re around",
  wfh: "You’re home today",
  out: "You’re out today",
  away: "You’re away",
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

  const mine = pendingFor(s, meId);

  /** Which of the three standing stats is expanded below the toggle. */
  const [lens, setLens] = useState<"carrying" | "after" | "rhythms">("carrying");

  /* --- where you are --- */
  const av = me.availability ?? { presence: "here" as Presence };
  const presence = av.presence;
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

  // What Sam looks after, each tagged with WHERE it came from — a domain of work
  // ("Area") or a physical space — so the Looks-after list can name its own
  // provenance on the right, the way Carrying names a time and Rhythms a cadence.
  const patch = [
    ...(me.responsibility?.domains ?? []).map((name) => ({ name, kind: "Area" })),
    ...(me.responsibility?.spaces ?? []).map((name) => ({ name, kind: "Space" })),
  ];

  /* THE YOU TAB — no enclosing card. Identity and standing lay directly on the
     ink; only Presence — the one thing you actually SET here — gets its own
     gray card, so the control reads as a control and the readout as a readout. */
  const rhythms = s.tasks.filter((t) => t.owner === meId && t.recurring);
  const openMine = s.tasks.filter((t) => t.owner === meId && !t.done);
  const effect = PRESENCE_EFFECT[presence](av.to);
  /** Short labels for the segmented control — the effect line carries the
   *  meaning, so the chips don't have to spell it out. */
  const SEG: Record<Presence, string> = { here: "Here", wfh: "Home", out: "Out", away: "Away" };
  /** The three stats are LENSES, not bare numbers: each opens its own detail in
   *  one shared area below, so every stat earns its detail — not just Rhythms. */
  const LENSES = [
    { key: "carrying" as const, n: mine, label: "Carrying" },
    { key: "after" as const, n: patch.length, label: "Looks after" },
    { key: "rhythms" as const, n: rhythms.length, label: "Rhythms" },
  ];

  return (
    <>
      {/* STANDING — its own card now. Sam's role heads it (moved out of the
          header), then the three lenses over one shared detail area. */}
      <motion.div variants={listItem}>
        <div className="rounded-card border border-white/10 bg-white/[.06] p-inner">
        <IconTile name="key" tone="onDark" />
        <TitleBlock className="mt-6" tone="onDark" eyebrow="Your standing" title={ROLE_LABEL[me.role]} />
        <div className="mt-5 flex gap-1 rounded-md bg-white/[.05] p-1">
          {LENSES.map((l) => {
            const on = lens === l.key;
            return (
              <button
                key={l.key}
                onClick={() => setLens(l.key)}
                aria-pressed={on}
                className={clsx(
                  "flex-1 rounded-sm py-2.5 text-center transition-colors",
                  on ? "bg-white/[.10]" : "hover:bg-white/[.04]",
                )}
              >
                <div className="font-tight text-[22px] leading-none tabular-nums text-white">{l.n}</div>
                <div className={clsx("mt-1 text-micro uppercase tracking-[.05em]", on ? "text-white/70" : "text-white/45")}>
                  {l.label}
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-3">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={lens} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.16 }}>
              {lens === "carrying" && (
                openMine.length ? (
                  <div>
                    {openMine.map((t) => (
                      <div key={t.id} className="flex items-center justify-between gap-3 py-1.5">
                        <span className="min-w-0 truncate text-bodysm text-white/85">{t.title}</span>
                        <span className="shrink-0 text-caption text-white/45">{t.when || relative(t.due)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="py-1.5 text-bodysm text-white/50">Nothing on you right now.</p>
                )
              )}
              {lens === "after" && (
                patch.length ? (
                  <div>
                    {patch.map((p) => (
                      <div key={p.name} className="flex items-center justify-between gap-3 py-1.5">
                        <span className="min-w-0 truncate text-bodysm text-white/85">{p.name}</span>
                        <span className="shrink-0 text-caption text-white/45">{p.kind}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="py-1.5 text-bodysm text-white/50">No standing areas yet.</p>
                )
              )}
              {lens === "rhythms" && (
                rhythms.length ? (
                  <div>
                    {rhythms.map((r) => (
                      <div key={r.id} className="flex items-center justify-between gap-3 py-1.5">
                        <span className="min-w-0 truncate text-bodysm text-white/85">{r.title}</span>
                        <span className="shrink-0 text-caption text-white/45">{r.recurring}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="py-1.5 text-bodysm text-white/50">No routines yet.</p>
                )
              )}
            </motion.div>
          </AnimatePresence>
        </div>
        </div>
      </motion.div>

      {/* WHERE YOU ARE — the one gray card: presence is the thing you SET here.
          Follows the house icon → title → data pattern; the pin tile is neutral
          (onDark) so the ONE lemon can be the active state. */}
      <motion.div variants={listItem}>
        <div className="rounded-card border border-white/10 bg-white/[.06] p-inner">
          <IconTile name="pin" tone="onDark" />
          <TitleBlock className="mt-6" tone="onDark" eyebrow="Where you are" title={PRESENCE_TITLE[presence]} />
          <p className="mt-2 text-bodysm text-white/70">{effect}</p>

          {needsCover.length > 0 && (
            <Button tone="light" className="mt-3" onClick={() => s.coverAway(meId)}>
              <Icon name="handoff" size={14} />
              Find cover for {needsCover.length === 1 ? "it" : `all ${needsCover.length}`}
            </Button>
          )}

          {/* The 4-way selector. Its active state is the composition's ONE lemon. */}
          <div className="mt-4 flex gap-1 rounded-pill bg-white/[.08] p-1">
            {PRESENCE_CHOICES.map(({ key }) => {
              const on = presence === key;
              return (
                <button
                  key={key}
                  onClick={() => s.setPresence(meId, key, key === "away" ? { from: av.from, to: av.to } : undefined)}
                  aria-pressed={on}
                  className={clsx(
                    "flex-1 rounded-pill py-2.5 text-bodysm font-medium transition-colors",
                    on ? "bg-lemon text-ink" : "text-white/60 hover:text-white/90",
                  )}
                >
                  {SEG[key]}
                </button>
              );
            })}
          </div>

          {/* Away needs a return date. It opens into a LIGHT picker so the calendar
              stays legible over the dark card — a popover, not a restyle. */}
          {presence === "away" && (
            <div className="mt-2">
              <button
                onClick={() => setDateOpen((v) => !v)}
                aria-expanded={dateOpen}
                className={clsx(
                  "flex h-touch items-center gap-2 rounded-pill border px-3.5 text-bodysm font-medium transition-colors",
                  av.to || dateOpen ? "border-white/25 bg-white/10 text-white" : "border-white/20 text-white/65 hover:text-white",
                )}
              >
                <Icon name="cal" size={14} />
                {av.to ? `Back ${relative(av.to)}` : "Until when?"}
                <motion.span animate={{ rotate: dateOpen ? 180 : 0 }} transition={smooth} className="flex">
                  <Icon name="chevDown" size={12} />
                </motion.span>
              </button>
              <PickerPanel open={dateOpen}>
                <MiniCalendar
                  value={av.to ?? todayIso()}
                  onPick={(v) => { s.setPresence(meId, "away", { from: av.from, to: v }); setDateOpen(false); }}
                />
              </PickerPanel>
            </div>
          )}

          {/* QUIET HOURS — separate from presence: a window, not a state. */}
          <div className="mt-5 flex items-center justify-between gap-3 border-t border-white/[.12] pt-4">
            <div className="min-w-0">
              <div className="text-bodysm font-medium text-white">Quiet hours</div>
              <div className="mt-hair text-caption text-white/55">
                {av.quiet ? `${to12(av.quiet.from)} – ${to12(av.quiet.to)}` : "Reminders can reach you any time"}
              </div>
            </div>
            <button
              onClick={() => setQuietOpen((v) => !v)}
              aria-expanded={quietOpen}
              className={clsx(
                "flex h-touch shrink-0 items-center gap-2 rounded-pill border px-3.5 text-bodysm font-medium transition-colors",
                av.quiet || quietOpen ? "border-white/25 bg-white/10 text-white" : "border-white/20 text-white/65 hover:text-white",
              )}
            >
              <Icon name="clock" size={14} />
              {av.quiet ? "Change" : "Set"}
              <motion.span animate={{ rotate: quietOpen ? 180 : 0 }} transition={smooth} className="flex">
                <Icon name="chevDown" size={12} />
              </motion.span>
            </button>
          </div>
          <PickerPanel open={quietOpen}>
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
    </>
  );
}

/** "Meals and Bills" · "Meals, Bills and Laundry" — a list a person would say. */
const listOf = (xs: string[]) =>
  xs.length <= 1 ? xs[0] ?? "" : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`;

const ownerName = (s: ReturnType<typeof useHousehold.getState>) =>
  Object.values(s.members).find((m) => m.role === "owner")?.name ?? "the owner";
