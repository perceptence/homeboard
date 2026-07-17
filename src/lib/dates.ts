/**
 * Dates, in one place.
 *
 * Everything in the household carries a `due` — an ISO `YYYY-MM-DD`. That string
 * is the single source of truth: sorting, grouping and the date badge all read it.
 * There is no second "horizon" field to drift out of step with it.
 *
 * NB: these read the LOCAL clock, so server and browser can disagree across a
 * timezone. Anything rendering one must carry `suppressHydrationWarning`.
 */

export type TimeOfDay = "Morning" | "Afternoon" | "Evening";
export type Period = "Week" | "Month" | "Quarter" | "Year";

/* ---------------------------------------------------------------- greeting */

export function timeOfDay(d: Date = new Date()): TimeOfDay {
  const h = d.getHours();
  if (h < 12) return "Morning";
  if (h < 17) return "Afternoon";
  return "Evening";
}

/** "Good morning" — the greeting line. */
export const greeting = (d: Date = new Date()) => `Good ${timeOfDay(d).toLowerCase()}`;

/* ------------------------------------------------------------------ basics */

const fmt = (d: Date, o: Intl.DateTimeFormatOptions) => d.toLocaleDateString("en-GB", o);

/** A `YYYY-MM-DD` key in LOCAL time. `toISOString()` would shift it by the offset. */
export function iso(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Parse `YYYY-MM-DD` as a LOCAL midnight — `new Date(str)` parses it as UTC. */
export function parse(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

export const todayIso = () => iso(new Date());
export const isToday = (due: string) => due === todayIso();
export const isPast = (due: string) => due < todayIso();

/** "Thursday, 16 July" — the Today header's eyebrow. */
export const today = (d: Date = new Date()) =>
  fmt(d, { weekday: "long", day: "numeric", month: "long" });

/* ------------------------------------------------------------------ badges */

/** What the date badge shows: `16` over `Thu`. */
export function badge(due: string) {
  const d = parse(due);
  return { day: d.getDate(), weekday: fmt(d, { weekday: "short" }) };
}

/** Human "when" for a due date — relative near, absolute far. */
export function relative(due: string): string {
  const days = Math.round((parse(due).getTime() - parse(todayIso()).getTime()) / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days === -1) return "Yesterday";
  if (days < 0) return `${-days} days ago`;
  if (days < 7) return fmt(parse(due), { weekday: "long" });
  return fmt(parse(due), { day: "numeric", month: "short" });
}

/**
 * `relative()` for the MIDDLE of a sentence.
 *
 * "You're away until Monday" is right; "until monday" is not — a weekday is a
 * proper noun. But "until Today" is equally wrong. So only the three relative
 * words lowercase; weekdays and dates keep their capital.
 */
export const relativeInline = (due: string): string => {
  const r = relative(due);
  return /^(Today|Tomorrow|Yesterday)$/.test(r) ? r.toLowerCase() : r;
};

/* ----------------------------------------------------------------- periods */

/** Weeks start MONDAY. getDay() is Sunday-first, so it has to be rotated. */
export function startOfWeek(d: Date) {
  const x = new Date(d);
  x.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  x.setHours(0, 0, 0, 0);
  return x;
}

/** The half-open span [from, to) a period covers, anchored on a date. */
export function periodRange(scope: Period, anchor: Date = new Date()) {
  if (scope === "Week") {
    const from = startOfWeek(anchor);
    return { from, to: addDays(from, 7) };
  }
  if (scope === "Month") {
    const from = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    return { from, to: new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1) };
  }
  if (scope === "Quarter") {
    const q = Math.floor(anchor.getMonth() / 3) * 3;
    return { from: new Date(anchor.getFullYear(), q, 1), to: new Date(anchor.getFullYear(), q + 3, 1) };
  }
  return { from: new Date(anchor.getFullYear(), 0, 1), to: new Date(anchor.getFullYear() + 1, 0, 1) };
}

/** "13 – 19 July" · "July 2026" · "Jul – Sept 2026" · "2026" */
export function periodLabel(scope: Period, anchor: Date = new Date()): string {
  const { from, to } = periodRange(scope, anchor);
  const last = addDays(to, -1);

  if (scope === "Week") {
    // Only name the month twice when the week actually straddles two.
    const straddles = from.getMonth() !== last.getMonth();
    const a = straddles ? fmt(from, { day: "numeric", month: "short" }) : fmt(from, { day: "numeric" });
    return `${a} – ${fmt(last, { day: "numeric", month: "long" })}`;
  }
  if (scope === "Month") return fmt(from, { month: "long", year: "numeric" });
  if (scope === "Quarter") return `${fmt(from, { month: "short" })} – ${fmt(last, { month: "short", year: "numeric" })}`;
  return String(from.getFullYear());
}

export const inRange = (due: string, r: { from: Date; to: Date }) =>
  due >= iso(r.from) && due < iso(r.to);

/** Step one period forward or back. Always measured from the period's OWN start —
 *  `setMonth(+1)` on the 31st lands in the month after next. */
export function shiftPeriod(scope: Period, anchor: Date, dir: -1 | 1): Date {
  const { from } = periodRange(scope, anchor);
  if (scope === "Week") return addDays(from, dir * 7);
  if (scope === "Month") return new Date(from.getFullYear(), from.getMonth() + dir, 1);
  if (scope === "Quarter") return new Date(from.getFullYear(), from.getMonth() + dir * 3, 1);
  return new Date(from.getFullYear() + dir, 0, 1);
}

/** Is this period the one we're actually in? Drives the "Today" reset affordance. */
export const isCurrentPeriod = (scope: Period, anchor: Date) =>
  inRange(todayIso(), periodRange(scope, anchor));

/* ---------------------------------------------------------------- grouping */

/** `2026-07` — sortable, and unique across years (unlike a month name). */
export const monthKey = (due: string) => due.slice(0, 7);
export const monthLabel = (key: string) =>
  fmt(parse(`${key}-01`), { month: "long", year: "numeric" });

/** The Monday of that date's week — sortable, unique. */
export const weekKey = (due: string) => iso(startOfWeek(parse(due)));

/** Has this group's period already finished? Drives collapsing the past away. */
export function groupIsPast(key: string): boolean {
  if (key.length === 7) {
    // "2026-07" — past once the whole month is behind us.
    const d = parse(`${key}-01`);
    return iso(new Date(d.getFullYear(), d.getMonth() + 1, 0)) < todayIso();
  }
  // "2026-07-06" — a week key; past once its Sunday is behind us.
  return iso(addDays(parse(key), 6)) < todayIso();
}

/** "This week" · "Next week" · "13 – 19 July" */
export function weekLabel(key: string): string {
  const mine = startOfWeek(parse(key));
  const now = startOfWeek(new Date());
  const weeks = Math.round((mine.getTime() - now.getTime()) / (7 * 86_400_000));
  if (weeks === 0) return "This week";
  if (weeks === 1) return "Next week";
  if (weeks === -1) return "Last week";
  return periodLabel("Week", mine);
}

/* ── epoch helpers, for the activity feed ─────────────────────────────────
   Everything above speaks ISO dates; activity speaks MOMENTS. */

/** "just now" · "5m ago" · "3h ago" · "Tuesday" · "3 Jul" */
export const ago = (at: number): string => {
  const sec = Math.round((Date.now() - at) / 1000);
  if (sec < 60) return "just now";
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  return dayLabel(at);
};

/** Which diary page a moment belongs to. */
export const dayLabel = (at: number): string => {
  const d = new Date(at);
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate());
  const diff = Math.round((+day(new Date()) - +day(d)) / 86_400_000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff < 7) return fmt(d, { weekday: "long" });
  return fmt(d, { day: "numeric", month: "short" });
};

/**
 * A clock time, always with AM/PM. The app displayed times two ways — tasks
 * carried "3:15 PM", events carried a bare "8:00" — so half the surface said the
 * meridiem and half didn't. This is the single normaliser at every display site.
 *
 *   "8:00"      -> "8:00 PM"   (bare: household hours — see below)
 *   "3:15 PM"   -> "3:15 PM"   (already marked; case tidied)
 *   "Morning"   -> "Morning"   (not a clock time; untouched)
 *
 * For a BARE time the meridiem is a guess, and a guess is worse than a wrong
 * label people can fix: seeded events carry their own AM/PM (see seed.ts) so
 * this heuristic only ever runs on times a person typed. 7am–6pm reads as the
 * daytime it almost always is; the rest fills in the obvious side.
 */
export const clockLabel = (t: string): string => {
  const m = t.match(/^\s*(\d{1,2}):(\d{2})\s*(AM|PM)?\s*$/i);
  if (!m) return t;
  const h = Number(m[1]);
  if (m[3]) return `${h}:${m[2]} ${m[3].toUpperCase()}`;
  const pm = h === 12 || (h >= 1 && h <= 6);
  return `${h}:${m[2]} ${pm ? "PM" : "AM"}`;
};
