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
  addDays, greeting, inRange, iso, isToday, monthKey, monthLabel, parse,
  groupIsPast, periodRange, relative, relativeInline, startOfWeek, timeMinutes, today, todayIso,
} from "@/lib/dates";
import { awayOn, currentMember, doers, holder, pendingFor, previewRebalance, shoppingList, useHousehold } from "@/lib/store";
import { useBackdropTone } from "@/lib/useBackdropTone";
import type { HouseEvent, MaintItem, MemberId, PhoneRoute, Presence, Task } from "@/lib/types";
import { ROLE_HINT, ROLE_LABEL } from "@/lib/types";

/**
 * Three tabs on ONE axis: what's happening -> the household -> me.
 *
 * Feed absorbed Today AND Ahead: they answered the same question at two zoom
 * levels, and the seam was arbitrary — tonight's dinner on one tab, tomorrow's
 * dentist a tab away. One feed opens on now and scrolls into later.
 */
const NAV: { route: PhoneRoute; icon: IconName; label: string }[] = [
  { route: "feed", icon: "feed", label: "Feed" },
  { route: "house", icon: "people", label: "House" },
  { route: "you", icon: "user", label: "You" },
];

export function PhoneShell() {
  const s = useHousehold();
  const meId = currentMember(s);
  const me = s.members[meId];
  const route = s.phoneRoute;
  const [navOpen, setNavOpen] = useState(false);
  // Owned here, not in PhoneLater: the header holds the field, the list filters
  // by it. Whoever renders both has to hold it.
  const [query, setQuery] = useState("");
  const scroller = useRef<HTMLDivElement>(null);
  const later = laterFor(s, meId, query);

  // The nav is glass over a moving list — it has to look at what it's sitting on.
  // Re-sampled on scroll inside the hook; these deps catch the changes scroll
  // can't see (a new route's content, the bar blooming to a new width).
  const navRef = useRef<HTMLElement>(null);
  const onLight = useBackdropTone(navRef, [route, navOpen, s.navTick]) === "light";

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
        onScroll={() => {
          if (navOpen) setNavOpen(false);
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
          className="relative sticky top-0 z-20 bg-ink px-5 pb-4"
        >
          <div className="flex items-start justify-between">
          {/* Eyebrow + Title — the same pair every card uses, and it says something
              different on every screen. The greeting is TODAY's alone: elsewhere it
              was a warm line that told you nothing about where you were. */}
          {/* ONE component, page size, dark tone — the same trio the cards use. */}
          <div suppressHydrationWarning className="min-w-0">
            {/* The Feed greets — it opens on NOW. While a search is live the
                subtext reports the matches; the greeting stays, because you
                haven't gone anywhere. */}
            {route === "feed" && (
              <TitleBlock
                size="page" tone="onDark"
                eyebrow={today()}
                title={`${greeting()}, ${me.name}`}
                subtext={later.searching
                  ? `${later.count} ${later.count === 1 ? "match" : "matches"} · all time`
                  : undefined}
              />
            )}
            {/* The Household header is the house speaking as itself: its name,
                and how much it's carrying between everyone. */}
            {route === "house" && (
              <TitleBlock
                size="page" tone="onDark"
                eyebrow="The household"
                title={s.householdName}
                subtext={`${doers(s).length} people · ${s.tasks.filter((t) => !t.done).length} things between them`}
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
            {/* The household view grew into its own TAB — no door in the
                chrome; it sits in the nav beside Today/Ahead/You. */}
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
          {route === "feed" && (
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

        </header>

        <motion.div
          key={s.navTick}
          variants={listStagger}
          initial="hidden"
          animate="show"
          className="flex flex-col gap-tile px-screen pb-[140px] pt-1"
        >
          {/* NOW, then LATER — one scroll. A live search replaces the whole
              body with its matches: results are the answer, not an appendix
              under today's cards. */}
          {route === "feed" && !later.searching && <PhoneToday />}
          {route === "feed" && <PhoneLater groups={later.groups} count={later.count} searching={later.searching} query={query} />}
          {route === "house" && <PhoneHouse />}
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
                // Open = four labelled items in one 393px pill: the tighter
                // padding is what lets the fourth fit. Collapsed keeps the
                // roomier hit area.
                className={clsx(
                  "relative flex h-[52px] items-center gap-1.5 rounded-[16px]",
                  navOpen ? "px-[10px]" : "px-[14px]",
                )}
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

/** Where someone is, said the way a fridge note would. `away` names its
 *  horizon when it knows one. */
const WHERE: Record<Presence, (to?: string) => string> = {
  here: () => "Around",
  wfh: () => "Home today",
  out: () => "Out today",
  away: (to) => (to ? `Away until ${relativeInline(to)}` : "Away"),
};

/** Focus ring for raw controls on the ink backdrop — outline-ink vanishes out
 *  here, so the ring borrows the app's one accent. */
const FOCUS_DARK = "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lemon";

/**
 * THE HOUSEHOLD TAB — a PEOPLE-FIRST living board: the family iPad, for homes
 * that don't have one.
 *
 * The house speaks first (one composed sentence — its pulse), then its people:
 * a card per person wearing where they are, what they're carrying, their
 * colour. Tap a person and their actual day opens beneath the grid — the
 * PhoneYou lens pattern, scaled to the whole cast. A live school run surfaces
 * as it happens. The balance is drawn, not scored: one bar, everyone's share
 * in their own colour, with the fix one tap away. Everything answers a tap.
 */
function PhoneHouse() {
  const s = useHousehold();
  const people = doers(s);
  const board = people
    .map((m) => ({ m, items: s.tasks.filter((t) => t.owner === m.id && !t.done) }))
    .sort((a, b) => b.items.length - a.items.length);
  const totalOpen = board.reduce((n, b) => n + b.items.length, 0);
  const weekAgo = Date.now() - 7 * 86_400_000;
  const doneWeek = s.tasks.filter((t) => t.done && t.completedAt && t.completedAt >= weekAgo).length;
  const move = previewRebalance(s);
  const shopOpen = shoppingList(s).filter((i) => !i.done).length;
  const low = s.inventory.filter((i) => i.status === "low").length;

  /** One person's day at a time, under the grid — the lens pattern. */
  const [selId, setSelId] = useState<MemberId | null>(null);
  const sel = selId ? board.find((b) => b.m.id === selId) : null;
  const selEvents = selId
    ? s.events.filter((e) => e.who === selId && isToday(e.due) && !e.done)
    : [];

  /* THE PULSE — the house saying how it is, composed from what it knows.
     The count is EVERYTHING open, not just what's on someone — unclaimed work
     is still the house's, and the clause names it when nothing juicier (a
     person being away) has the slot. */
  const allOpen = s.tasks.filter((t) => !t.done).length;
  const unclaimed = s.tasks.filter((t) => !t.done && !t.owner).length;
  const awayBit = (() => {
    const x = people
      .map((m) => ({ m, p: m.availability?.presence ?? ("here" as Presence) }))
      .find((v) => v.p !== "here");
    if (x) return x.p === "wfh" ? `${x.m.name} is home` : x.p === "out" ? `${x.m.name} is out` : `${x.m.name} is away`;
    if (unclaimed) return unclaimed === 1 ? "one needs an owner" : `${unclaimed} need an owner`;
    return null;
  })();

  /* A live journey, front and centre while it runs. */
  const trip = s.island?.phase === "journey" ? s.island : null;
  const tripTask = trip?.taskId != null ? s.tasks.find((t) => t.id === trip.taskId) : null;
  const traveler = tripTask?.owner ? s.members[tripTask.owner] : null;

  return (
    <>
      {/* The pulse: one sentence, page voice, straight on the ink. */}
      <motion.div variants={listItem} className="px-1.5 pb-2 pt-1">
        <Sentence className="max-w-[17ch] text-balance text-white">
          {allOpen
            ? <>The house is carrying <Em>{allOpen} things</Em>{awayBit && <> — {awayBit}</>}.</>
            : <>All caught up{awayBit && <> — {awayBit}</>}.</>}
        </Sentence>
      </motion.div>

      {/* A run in motion — mint, the household's OURS colour. */}
      {trip && traveler && (
        <motion.div variants={listItem}>
          <div className="flex items-center gap-3 rounded-card bg-mint p-card-pad text-ink shadow-e2">
            <Avatar member={traveler} size={38} />
            <div className="min-w-0 flex-1">
              <div className="text-bodysm font-medium">{traveler.name} is on the way</div>
              <div suppressHydrationWarning className="text-caption text-sub">
                {trip.where ?? "Out"}{trip.etaAt ? ` · arriving ${new Date(trip.etaAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : ""}
              </div>
            </div>
            {/* Alive, quietly. */}
            <span aria-hidden className="h-2.5 w-2.5 shrink-0 animate-pulse rounded-pill bg-ink" />
          </div>
        </motion.div>
      )}

      {/* THE PEOPLE — a card each: where they are, what they carry, their
          colour. Tap = their day opens below. */}
      <motion.div variants={listItem} className="grid grid-cols-2 gap-tile">
        {board.map(({ m, items }) => {
          const av = m.availability;
          const on = selId === m.id;
          return (
            <button
              key={m.id}
              onClick={() => setSelId(on ? null : m.id)}
              aria-pressed={on}
              className={clsx(
                "rounded-card bg-card p-card-pad text-left text-ink shadow-e2 transition-shadow hover:shadow-e3",
                FOCUS_DARK,
                on && "ring-2 ring-inset ring-ink",
              )}
            >
              <div className="flex items-start justify-between">
                <Avatar member={m} size={44} />
                <span className="font-tight text-[24px] leading-none tabular-nums">{items.length}</span>
              </div>
              <div className="mt-3 text-h2">{m.name}</div>
              <div className="text-caption text-sub">{WHERE[av?.presence ?? "here"](av?.to)}</div>
              <div className="mt-2.5 h-1.5 overflow-hidden rounded-pill bg-ink/[.06]">
                <div
                  className="h-full rounded-pill transition-all"
                  style={{ width: `${totalOpen ? Math.round((items.length / Math.max(1, board[0].items.length)) * 100) : 0}%`, background: m.color }}
                />
              </div>
            </button>
          );
        })}
      </motion.div>

      {/* The selected person's day — one at a time, the lens's reading area. */}
      <AnimatePresence initial={false}>
        {sel && (
          <motion.div
            key={sel.m.id}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={smooth}
            className="overflow-hidden"
          >
            <div className="rounded-card bg-card p-card-pad text-ink shadow-e2">
              <Eyebrow>{sel.m.name}&rsquo;s day</Eyebrow>
              <div className="mt-1 flex flex-col">
                {[...sel.items.map((t) => ({
                  key: `t${t.id}`, title: t.title, when: t.when || "Any time",
                  amount: t.amount, open: () => s.openSheet({ type: "task" as const, id: t.id }),
                })), ...selEvents.map((e) => ({
                  key: `e${e.id}`, title: e.title, when: e.time,
                  amount: undefined as number | undefined, open: () => s.openSheet({ type: "event" as const, id: e.id }),
                }))].map((r) => (
                  <button
                    key={r.key}
                    onClick={r.open}
                    className="-mx-2 flex items-center justify-between gap-3 rounded-sm px-2 py-2 text-left transition-colors hover:bg-surface"
                  >
                    <span className="min-w-0 truncate text-bodysm font-medium">
                      {r.title}{typeof r.amount === "number" && <span className="text-sub"> · ${r.amount}</span>}
                    </span>
                    <span className="shrink-0 text-caption text-sub">{r.when}</span>
                  </button>
                ))}
                {sel.items.length === 0 && selEvents.length === 0 && (
                  <p className="py-2 text-bodysm text-sub">Nothing on {sel.m.name} right now — lucky them.</p>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* THE BALANCE — drawn, not scored: everyone's share of the load in
          their own colour, and the fix right there when it's lopsided. */}
      <motion.div variants={listItem}>
        <div className="rounded-card bg-card p-card-pad text-ink shadow-e2">
          <div className="flex items-baseline justify-between">
            <Eyebrow>The balance</Eyebrow>
            <span className="text-caption text-sub">{doneWeek} done this week</span>
          </div>
          <div className="mt-3 flex h-3 gap-hair overflow-hidden rounded-pill">
            {totalOpen === 0 ? (
              <div className="h-full w-full rounded-pill bg-ink/[.06]" />
            ) : (
              board.filter((b) => b.items.length > 0).map((b) => (
                <div
                  key={b.m.id}
                  className="h-full rounded-pill"
                  style={{ flexGrow: b.items.length, background: b.m.color }}
                />
              ))
            )}
          </div>
          <div className="mt-2 truncate text-caption text-sub">
            {board.filter((b) => b.items.length > 0).map((b) => `${b.m.name} ${b.items.length}`).join(" · ") || "Nobody's carrying anything"}
          </div>
          {move && (
            <Button tone="dark" className="mt-3.5 w-full" onClick={() => s.openSheet({ type: "rebalance" })}>
              <Icon name="scale" size={15} /> Even it out
            </Button>
          )}
        </div>
      </motion.div>

      {/* THE DAY — the house's next few things, whoever they belong to. */}
      <UpNextAcrossHouse />

      {/* THE SHARED THINGS — doors to what the whole house owns together. */}
      <motion.div variants={listItem}>
        <Eyebrow tone="onDark" className="mb-2 mt-2 px-1.5">Shared</Eyebrow>
        <div className="grid grid-cols-2 gap-tile">
          <Card tone="mint" onClick={() => s.openSheet({ type: "shop" })}>
            <IconTile name="cart" />
            <div className="mt-5 font-tight text-[24px] leading-none tabular-nums">{shopOpen}</div>
            <div className="mt-1 text-caption text-sub">to get · Shopping</div>
          </Card>
          <Card tone="lavender" onClick={() => s.openSheet({ type: "stock" })}>
            <IconTile name="box" />
            <div className="mt-5 font-tight text-[24px] leading-none tabular-nums">{low}</div>
            <div className="mt-1 text-caption text-sub">running low · In the house</div>
          </Card>
        </div>
      </motion.div>
    </>
  );
}

/** The house's next few things, whoever they belong to — tasks and events in
 *  one shape, each able to reopen its own sheet. */
function UpNextAcrossHouse() {
  const s = useHousehold();
  const upNext = [
    ...s.tasks.filter((t) => !t.done).map((t) => ({
      key: `t${t.id}`, title: t.title, when: t.when, who: t.owner,
      open: () => s.openSheet({ type: "task" as const, id: t.id }),
    })),
    ...s.events.filter((e) => !e.done).map((e) => ({
      key: `e${e.id}`, title: e.title, when: e.time, who: e.who,
      open: () => s.openSheet({ type: "event" as const, id: e.id }),
    })),
  ]
    .sort((a, b) => (a.when || "").localeCompare(b.when || ""))
    .slice(0, 5);

  if (upNext.length === 0) return null;
  return (
    <motion.div variants={listItem}>
      <Eyebrow tone="onDark" className="mb-2 mt-2 px-1.5">Up next, across the house</Eyebrow>
      <div className="divide-y divide-ink/[.06] overflow-hidden rounded-card bg-card text-ink shadow-e2">
        {upNext.map((item) => (
          <button
            key={item.key}
            onClick={item.open}
            className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-surface"
          >
            <Avatar member={item.who ? s.members[item.who] : undefined} size={26} />
            <span className="min-w-0 flex-1 truncate text-bodysm font-medium">{item.title}</span>
            <span className="shrink-0 text-caption text-sub">{item.when || "Any time"}</span>
          </button>
        ))}
      </div>
    </motion.div>
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
 * LATER — everything past today, merged and grouped: the Feed's lower half.
 *
 * Everything is merged into ONE dated list and sorted by `due`, because that's
 * the question this half answers: what's coming, in order. The bands read like
 * a planner — anything still open from earlier, then Tomorrow, This week, Next
 * week, then months. No period stepper: the scroll IS the navigation, and a
 * search (which spans ALL time — it's a question about the household, not the
 * horizon you're scrolled to) is the jump-to-anywhere.
 *
 * Pulled out of the component: the shell's header reports the match count and
 * the page renders the rows — two copies of this maths would drift.
 */
function laterFor(
  s: ReturnType<typeof useHousehold.getState>,
  meId: string,
  query: string,
) {
  const q = query.trim().toLowerCase();
  const searching = q.length > 0;
  const todayStr = todayIso();
  const tomorrow = iso(addDays(new Date(), 1));
  const thisWeekEnd = iso(addDays(startOfWeek(new Date()), 6));
  const nextWeekEnd = iso(addDays(startOfWeek(new Date()), 13));

  // Browsing shows what's AHEAD (today itself lives in the cards above) plus
  // anything undone that slipped past — overdue work must not vanish into a
  // tab that no longer exists.
  const keep = (due: string, done?: boolean) =>
    searching || due >= tomorrow || (!done && due < todayStr);
  const hit = (text: string) => !searching || text.toLowerCase().includes(q);

  const items: Item[] = [
    ...s.tasks
      .filter((t) => holder(t) === meId && keep(t.due, t.done) && hit(`${t.title} ${t.source ?? ""} ${t.recurring ?? ""}`))
      .map((task): Item => ({ kind: "task", due: task.due, task })),
    ...s.events
      .filter((e) => e.who === meId && keep(e.due, true) && hit(`${e.title} ${e.recurring ?? ""}`))
      .map((event): Item => ({ kind: "event", due: event.due, event })),
    ...s.maint
      .filter((m) => keep(m.due, m.status !== "over") && hit(`${m.title} ${m.asset} ${m.cadence}`))
      .map((item): Item => ({ kind: "maint", due: item.due, item })),
  ].sort((a, b) => a.due.localeCompare(b.due) || Number(isDone(a)) - Number(isDone(b)));

  // Search results span all time, so they group by month; browsing gets the
  // planner bands.
  const bandOf = (i: Item): { key: string; label: string } => {
    if (searching) return { key: monthKey(i.due), label: monthLabel(monthKey(i.due)) };
    if (i.due < todayStr) return { key: "over", label: "Still open from earlier" };
    if (i.due === tomorrow) return { key: "tomorrow", label: "Tomorrow" };
    if (i.due <= thisWeekEnd) return { key: "week", label: "This week" };
    if (i.due <= nextWeekEnd) return { key: "next", label: "Next week" };
    return { key: monthKey(i.due), label: monthLabel(monthKey(i.due)) };
  };

  const groups = [...new Map(items.map((i) => [bandOf(i).key, bandOf(i)])).values()]
    .map((band) => ({
      ...band,
      items: items.filter((i) => bandOf(i).key === band.key),
      past: searching && groupIsPast(band.key),
    }))
    // By each band's earliest item, not by key — month keys and band names
    // don't share an alphabet.
    .sort((a, b) => a.items[0].due.localeCompare(b.items[0].due));

  return { groups, searching, count: items.filter((i) => !isDone(i)).length };
}

const isDone = (i: Item) => i.kind === "task" && i.task.done;

function PhoneLater({ groups, count, searching, query }: {
  groups: ReturnType<typeof laterFor>["groups"];
  count: number;
  searching: boolean;
  query: string;
}) {
  return (
    <>
      {groups.map((g) => (
        <div key={g.key} className="flex flex-col gap-tile">
          {/* A heading is a LABEL here, not a door — with the period lens gone
              there's no second screen to open; the band under it is the thing. */}
          <motion.div variants={listItem} className="flex items-center gap-2 px-4 pb-1 pt-3">
            <Eyebrow tone="onDark" className={clsx(g.past && "text-white/25")}>{g.label}</Eyebrow>
            <span className="text-caption text-white/30">{g.items.length}</span>
          </motion.div>
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
              {searching ? `Nothing matches “${query.trim()}”` : "Nothing on the horizon — enjoy!"}
            </p>
          </Card>
        </motion.div>
      )}
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

  /* THE YOU TAB — no enclosing card. Identity and standing lay directly on the
     ink; only Presence — the one thing you actually SET here — gets its own
     gray card, so the control reads as a control and the readout as a readout. */
  const rhythms = s.tasks.filter((t) => t.owner === meId && t.recurring);
  const openMine = s.tasks.filter((t) => t.owner === meId && !t.done);
  const effect = PRESENCE_EFFECT[presence](av.to);

  // "Looking after" — the categories the member's open tasks actually fall into
  // right now, grouped by where each comes from (the source's first segment) and
  // named (a Calendar run, an Automation). ONLY categories that hold tasks show,
  // so the loads sum to Carrying with nothing padded. Heaviest first.
  const SOURCE_LABEL: Record<string, string> = { Auto: "Automation" };
  const openByArea = new Map<string, number>();
  for (const t of openMine) {
    const k = (t.source ?? "").split("·")[0].trim() || "Other";
    openByArea.set(k, (openByArea.get(k) ?? 0) + 1);
  }
  const patch = [...openByArea.entries()]
    .map(([k, load]) => ({ name: SOURCE_LABEL[k] ?? k, load }))
    .sort((a, b) => b.load - a.load);
  /** Short labels for the segmented control — the effect line carries the
   *  meaning, so the chips don't have to spell it out. */
  const SEG: Record<Presence, string> = { here: "Here", wfh: "Home", out: "Out", away: "Away" };
  /** The three stats are LENSES, not bare numbers: each opens its own detail in
   *  one shared area below, so every stat earns its detail — not just Rhythms. */
  const LENSES = [
    { key: "carrying" as const, n: mine, label: "Carrying" },
    { key: "after" as const, n: patch.length, label: "Looking after" },
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
                        <span className="shrink-0 text-caption text-white/45">
                          {p.load} {p.load === 1 ? "task" : "tasks"}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="py-1.5 text-bodysm text-white/50">Nothing on you right now.</p>
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
