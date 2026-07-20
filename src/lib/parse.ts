/**
 * "Water the plants tomorrow at 6pm" -> date, time, who.
 *
 * The fastest way to add a task is to not fill in a form. You say the sentence
 * you'd say out loud, and the fields fill themselves.
 *
 * Rules that keep this honest rather than magic:
 *   1. The TITLE IS NEVER REWRITTEN. What it understands comes back as chips, not
 *      as edits to your words. (`title` below is an internal working copy —
 *      callers show the user's own text.)
 *   2. It only claims what it's sure of. No date in the text means no guess —
 *      the form's default applies. (The old code guessed `+4 days` for any
 *      unrecognised word, which is how "Tonight" became next Tuesday.)
 *   3. It reads DANGER as well as convenience. See NEEDS_FULL.
 */
import { addDays, iso } from "./dates";
import type { AutoThen, AutoWhen, Priority, Role } from "./types";

export interface ParsedTask {
  /**
   * The task's NAME — the sentence with everything we understood lifted out of
   * it, tidied and sentence-cased. "Leo water plants tonight" -> "Water plants".
   *
   * This was briefly the raw text, because stripping used to LOSE the original
   * and you'd say one thing and find another on the card. The fix wasn't to stop
   * cleaning; it was to keep the receipt — callers store the raw input as
   * `Task.said`, so the interpretation stays auditable.
   */
  title: string;
  /** ISO date — only if the text actually named one. */
  due?: string;
  /** Time of day — only if the text actually named one. */
  when?: string;
  /** MemberId — only if the text actually named someone. */
  owner?: string;
  /** Only if the text actually said so ("urgent", "whenever"). */
  priority?: Priority;
  /** Minimum role — set when the words imply money, contracts, or danger. */
  requires?: Role;
  /** Money named in the text ("$64") — what makes the task a BILL. */
  amount?: number;
  /** The phrases consumed, in the user's own words. Shown back to them. */
  matched: string[];
}

/**
 * Words that mean an adult has to hold this.
 *
 * WHY THIS EXISTS: the balancer was nominating a 7-year-old for "pick alcohol",
 * because a half-typed sentence carries no `requires` and `canAssign` therefore
 * cleared everyone. The app was choosing WHO before it knew WHAT.
 *
 * This is a FLOOR, not a guarantee — no word list covers a language, and
 * "grab the vodka" will slip through. It only ever ADDS a constraint, never
 * removes one, so a miss is no worse than before and a hit is strictly safer.
 * The real safety net is upstream: suggestTaker refuses to volunteer a guided
 * member for work nobody has vetted (see store.ts).
 *
 * NOT consumed from the text — these are the task, not scheduling noise.
 */
const NEEDS_FULL = new RegExp(
  "\\b(" +
    [
      // money and contracts
      "bank", "mortgage", "insurance", "tax(es)?", "rent", "bills?", "invoice",
      "salary", "pension", "solicitor", "lawyer", "landlord",
      // regulated
      "alcohol", "wine", "beer", "spirits", "vodka", "whisk(e)?y", "booze",
      "prescription", "medicine", "pharmacy", "chemist", "cigarettes?",
      // hazard — height, current, blades. "Clean the gutters" was reaching a
      // ten-year-old because the list knew "ladder" but not the jobs that imply one.
      "bleach", "boiler", "gas", "chainsaw", "ladder", "power tools?", "chemicals?",
      "gutters?", "roof", "chimney", "electrical?", "wiring", "fuse box", "mains",
      // licensed
      "driv(e|ing)", "car service", "mot",
    ].join("|") +
    ")\\b",
  "i",
);

const DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

const MONTHS = ["january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december"];
/** Long forms first — alternation is first-match, so "jun" would shadow "june". */
const MON_RE = [...MONTHS, ...MONTHS.map((m) => m.slice(0, 3)), "sept"].join("|");
const monthIdx = (word: string) => {
  const s = word.toLowerCase();
  return MONTHS.findIndex((m) => m === s || m.slice(0, 3) === s.slice(0, 3));
};

/** A named calendar date. "July 23" said in December means NEXT July — a date
 *  you've already missed is never what someone meant by a new task. */
const onDate = (mi: number, day: number): string => {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const d = new Date(now.getFullYear(), mi, day);
  return iso(d < now ? new Date(now.getFullYear() + 1, mi, day) : d);
};

/** The next time this weekday comes round. Saying "friday" ON a Friday means
 *  today — "next friday" is how you say the other thing. */
const onNext = (target: number, next: boolean): string => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const delta = (target - d.getDay() + 7) % 7;
  return iso(addDays(d, delta + (next ? 7 : 0)));
};

const today = () => iso(new Date());

type Rule = { re: RegExp; apply: (m: RegExpMatchArray, out: ParsedTask) => void };

/**
 * A word-boundary match that refuses POSSESSIVES.
 *
 * `\btoday\b` happily matches inside "today's" — an apostrophe is a word
 * boundary — so "Read today's post" became "Read 's post", due today. The
 * lookahead is what makes a date word a date word and not someone's noun.
 */
const w = (body: string) => new RegExp(`\\b(?:${body})\\b(?!['’])`, "i");

/* ORDER MATTERS — longest phrase first, or "next week" is eaten by "week" and
   "this weekend" by "weekend". Each rule's match is removed before the next runs. */
const RULES: Rule[] = [
  // ── date + time in one word ──
  { re: w("tonight"), apply: (_m, o) => { o.due ??= today(); o.when ??= "Tonight"; } },

  // ── dates ──
  { re: w("day after tomorrow"), apply: (_m, o) => { o.due ??= iso(addDays(new Date(), 2)); } },
  { re: w("tomorrow|tmrw"), apply: (_m, o) => { o.due ??= iso(addDays(new Date(), 1)); } },
  { re: w("today"), apply: (_m, o) => { o.due ??= today(); } },

  // ── a named calendar date: "July 23rd", "23 July", "23rd of July" ──
  // Both forms require a NUMBER beside the month. Bare "may" must never be a
  // date — "water plants may be tomorrow" is not the 1st of May.
  { re: w(`(${MON_RE})\\s+(\\d{1,2})(st|nd|rd|th)?`), apply: (m, o) => {
      const mi = monthIdx(m[1]);
      if (mi >= 0) o.due ??= onDate(mi, Number(m[2]));
    } },
  { re: w(`(\\d{1,2})(st|nd|rd|th)?\\s+(of\\s+)?(${MON_RE})`), apply: (m, o) => {
      const mi = monthIdx(m[4]);
      if (mi >= 0) o.due ??= onDate(mi, Number(m[1]));
    } },

  { re: w("next week"), apply: (_m, o) => { o.due ??= onNext(1, false); } },
  { re: w("(this |next )?weekend"), apply: (m, o) => { o.due ??= onNext(6, /next/i.test(m[0])); } },
  {
    re: w(`(next )?(${DAYS.join("|")}|${DAYS.map((d) => d.slice(0, 3)).join("|")})`),
    apply: (m, o) => {
      const word = m[2].toLowerCase();
      const idx = DAYS.findIndex((d) => d === word || d.slice(0, 3) === word);
      if (idx >= 0) o.due ??= onNext(idx, !!m[1]);
    },
  },
  { re: w("in (\\d{1,2}) days?"), apply: (m, o) => { o.due ??= iso(addDays(new Date(), Number(m[1]))); } },

  // ── times ──
  //
  // Dots are not optional in the wild: people write "3 p.m.", "3:00 p.m", "3pm".
  // The old pattern only knew bare `am|pm`, so "pick up kids at 3:00 p.m" read as
  // having NO time — and, worse, left "at 3:00 p.m." sitting in the task's name,
  // because a phrase we don't understand is a phrase we can't lift out.
  //
  // Written by hand rather than through w(): that helper closes with `\b`, and a
  // match ending in "." has no word boundary after it, so "p.m." would never fit.
  // `(?!\w)` is the honest end here — it stops "3pm" matching inside "3pmx".
  {
    re: /\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*([ap])\.?m\.?(?!\w)/i,
    apply: (m, o) => {
      const h = Number(m[1]);
      if (h < 1 || h > 12) return;
      o.when ??= `${h}:${m[2] ?? "00"} ${m[3].toUpperCase()}M`;
    },
  },
  { re: w("noon"), apply: (_m, o) => { o.when ??= "12:00 PM"; } },
  { re: w("(this )?morning"), apply: (_m, o) => { o.when ??= "Morning"; } },
  { re: w("(this )?afternoon"), apply: (_m, o) => { o.when ??= "Afternoon"; } },
  { re: w("(this )?evening"), apply: (_m, o) => { o.when ??= "Evening"; } },

  // ── urgency, as people actually say it ──
  { re: w("urgent|asap|important|high priority"), apply: (_m, o) => { o.priority ??= "high"; } },
  { re: w("low priority|whenever|no rush|sometime"), apply: (_m, o) => { o.priority ??= "low"; } },
];

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * WHO — built from the household's real members, so the app's own knowledge does
 * the reading.
 *
 * POSITION is what separates an instruction from a mention:
 *
 *   "Leo water plants"  -> FOR Leo   (name first: you're addressing him)
 *   "Call Leo"          -> about Leo (name in object position: he's the subject)
 *   "Water Leo's plants"-> about Leo (possessive)
 *
 * So a leading name counts, and a name anywhere else needs an explicit marker
 * ("for Leo", "get Leo to", "Leo should"). Getting this wrong in either
 * direction is bad — miss it and the user retypes; over-claim it and you quietly
 * hand someone else's job to a child.
 */
const peopleRules = (people: { id: string; name: string }[]): Rule[] =>
  people.flatMap((p) => {
    const n = esc(p.name);
    const take = (_m: RegExpMatchArray, o: ParsedTask) => { o.owner ??= p.id; };
    return [
      { re: w(`(get|ask|remind) ${n} to`), apply: take },
      { re: w(`${n} (should|needs to|has to|can|will)`), apply: take },
      { re: w(`(for|with) ${n}`), apply: take },
      // Leading name + at least one more word. `^` is the whole rule: without it
      // this is just a bare name, which is the mention case above.
      { re: new RegExp(`^\\s*${n}\\b(?!['’])(?=\\s+\\S)`, "i"), apply: take },
    ];
  });

export function parseTask(input: string, people: { id: string; name: string }[] = []): ParsedTask {
  const out: ParsedTask = { title: input, matched: [] };

  // MONEY first, outside the rules loop (its engine only consumes words that
  // set due/when/owner/priority). "$64" makes this a bill: the amount rides
  // the task, and money always needs an adult to hold it.
  const money = out.title.match(/\$\s?(\d+(?:\.\d{1,2})?)/);
  if (money) {
    out.amount = Number(money[1]);
    out.requires = "full";
    out.matched.push(money[0].trim());
    out.title = out.title.replace(money[0], " ");
  }

  // People first: "get Leo to" must be consumed before "to" can confuse anything.
  const rules = [...peopleRules(people), ...RULES];

  for (const { re, apply } of rules) {
    const m = out.title.match(re);
    if (!m) continue;
    const before = `${out.due}|${out.when}|${out.owner}|${out.priority}`;
    apply(m, out);
    // Only consume the words if they actually told us something new. Otherwise
    // "today" in "today's post" would vanish from a title for no reason.
    if (`${out.due}|${out.when}|${out.owner}|${out.priority}` === before) continue;
    out.matched.push(m[0].trim());
    out.title = out.title.replace(m[0], " ");
  }

  // Danger is read from the ORIGINAL text, and never consumed: "alcohol" is what
  // the task IS, not scheduling noise to strip. Scanning the original also means
  // a word already eaten by another rule can still raise the gate.
  if (NEEDS_FULL.test(input)) out.requires ??= "full";

  out.title = tidy(out.title);
  return out;
}

/**
 * CAN SOMEONE ELSE DO THIS? — the one question that used to be a type picker
 * ("Task" vs "Event") the person had to answer themselves. They shouldn't have
 * to know the app keeps two shapes of thing internally; they should just say
 * what needs doing, and the app should know a dentist appointment can't be
 * handed off the way watering the plants can.
 *
 * Two honest signals, both about PRESENCE rather than effort: some things need
 * a specific body in a specific chair (medical, personal grooming, a booked
 * slot with a name attached), and some things are made of a plan shared with
 * someone in particular ("with Marco") — you can't send a substitute to your
 * own plans. Everything else defaults to flexible, because most household
 * work — trash, plants, groceries, laundry — genuinely doesn't care who does
 * it. Wrong guesses are a tap away to fix, never a blocker.
 */
const PERSONAL_COMMITMENT = /\b(dentist|doctor|dr\.?\s|physician|appointment|check-?up|therapy|therapist|counsell?ing|haircut|salon|barber|manicure|pedicure|interview|exam|surgery|hearing|court date|graduation|wedding|funeral|rehearsal|lesson|flight|game|match|recital)\b/i;
const SHARED_PLAN = /\bwith\s+[A-Z][\w'’-]*/;

export function inferFixed(title: string): boolean {
  return PERSONAL_COMMITMENT.test(title) || SHARED_PLAN.test(title);
}

/**
 * Lifting words out of the middle of a sentence leaves debris at the ends:
 * "water the plants on July 23rd" -> "water the plants on", and
 * "water plants may be tomorrow" -> "water plants may be". Both are the app
 * putting broken English on a card.
 *
 * So sweep dangling connectives off BOTH ends, repeatedly — one pass leaves
 * "may be" as "may". Then sentence-case: capitalise the first letter only, never
 * the rest, or every proper noun in the household gets flattened.
 */
// `every`/`each` join the list so "water plants every friday" -> "Water plants"
// once the weekday is lifted: the recurrence word is scheduling, not the name.
const DANGLING = /^(?:on|at|by|to|for|with|this|the|a|an|and|or|is|are|was|be|may|will|in|every|each)\b/i;

function tidy(s: string): string {
  let w = s.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  // Trailing debris is the common case; leading happens after a name is lifted.
  while (w.length && DANGLING.test(w[w.length - 1])) w.pop();
  while (w.length && DANGLING.test(w[0])) w.shift();
  const t = w.join(" ");
  return t ? t[0].toUpperCase() + t.slice(1) : "";
}

/* ─────────────────────── automations ─────────────────────── */

/** What we understood of "what should the house do by itself". */
export interface ParsedAutomation {
  when?: AutoWhen;
  then?: AutoThen;
  /** A weekly rule with no spoken time — we assumed 6:00 PM; the sheet says so. */
  assumedTime?: boolean;
  /** A nudge with nobody named — the one blank we refuse to guess. */
  needsWho?: boolean;
}

const AUTO_DAYS: [RegExp, string][] = [
  [/\bmon(?:day)?s?\b/, "Monday"], [/\btues?(?:day)?s?\b/, "Tuesday"], [/\bwed(?:nesday)?s?\b/, "Wednesday"],
  [/\bthu(?:rs?(?:day)?)?s?\b/, "Thursday"], [/\bfri(?:day)?s?\b/, "Friday"],
  [/\bsat(?:urday)?s?\b/, "Saturday"], [/\bsun(?:day)?s?\b/, "Sunday"],
];

/**
 * Read a rule out of a sentence — the automation counterpart of parseTask,
 * and the same bargain: the person says what they want in their own words,
 * the app does the sorting. "Nudge Sam every Tuesday at 8pm" arrives fully
 * built; "water the plants every friday" becomes a create-a-task rule with
 * the leftover words as the title.
 */
export function parseAutomation(
  input: string,
  people: { id: string; name: string }[] = [],
): ParsedAutomation {
  const text = ` ${input.toLowerCase()} `;
  const out: ParsedAutomation = {};
  if (!input.trim()) return out;

  /* WHEN — most specific first. "billing email" must win before "bill due". */
  const timeM = text.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/);
  const time = timeM ? `${Number(timeM[1])}:${timeM[2] ?? "00"} ${timeM[3].toUpperCase()}` : null;
  const dayHit = AUTO_DAYS.find(([re]) => re.test(text));
  if (/\brun(?:s|ning)?\s+(?:low|out)\b|\blow\s+on\b|\bout\s+of\b/.test(text)) {
    out.when = { kind: "low" };
  } else if (/\bevery\s*day\b|\bdaily\b|\beach\s+day\b/.test(text)) {
    // "everyday" (one word) and "every day" both mean daily — checked BEFORE
    // the weekday branch so "day" never half-matches a weekday rule.
    out.when = { kind: "daily", time: time ?? "6:00 PM" };
    out.assumedTime = !time;
  } else if (/\b(?:email|inbox|mail)\b/.test(text) && /\b(?:bill|invoice)/.test(text)) {
    out.when = { kind: "email" };
  } else if (/\bunclaimed\b|\bno\s*(?:body|one)\s+(?:takes|claims|picks)\b|\bunassigned\b/.test(text)) {
    out.when = { kind: "unclaimed" };
  } else if (/\bbills?\b/.test(text) && /\bdue\b|\bdays?\s+(?:out|before|late)\b/.test(text)) {
    out.when = { kind: "dueSoon" };
  } else if (dayHit) {
    out.when = { kind: "weekday", day: dayHit[1], time: time ?? "6:00 PM" };
    out.assumedTime = !time;
  }

  /* THEN — a named person + a nudge word beats everything else. */
  const person = people.find((p) => new RegExp(`\\b${p.name.toLowerCase()}\\b`).test(text));
  if (/\bnudge\b|\bremind\b|\bping\b/.test(text)) {
    out.then = { kind: "nudge", who: person?.id ?? "" };
    out.needsWho = !person;
  } else if (/\bshopping\b|\bshop\s+list\b/.test(text)) {
    out.then = { kind: "shop" };
  } else if (/\brebalance\b|\beven\s+(?:it|things)\s+out\b|\bbalance\s+the\b/.test(text)) {
    out.then = { kind: "rebalance" };
  } else if (/\b(?:file|log|track)\b[^.]*\bbill/.test(text) || (/\bbill/.test(text) && /\bfeed\b/.test(text))) {
    out.then = { kind: "bill" };
  } else {
    // The words that are LEFT are the task. Strip everything we understood —
    // the schedule phrase, the time, connectors — and if a title survives,
    // that's what the rule creates.
    const explicit = input.match(/\b(?:create|add|make)\s+a\s+task\s+(?:to\s+)?(.+)$/i);
    let rest = explicit ? explicit[1] : input;
    rest = rest
      .replace(/\b(?:every|each|on)\s+\w+days?\b/gi, " ")
      .replace(/\bevery\s*day\b|\bdaily\b|\beach\s+day\b/gi, " ")
      .replace(/\b(?:mon|tues?|wednes|thurs?|fri|satur|sun)days?\b/gi, " ")
      .replace(/\b\d{1,2}(?::\d{2})?\s*(?:am|pm)\b/gi, " ")
      .replace(/\b(?:when|if|then|at|automatically|auto)\b/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (rest && rest.split(" ").length >= 2) {
      out.then = { kind: "task", title: rest[0].toUpperCase() + rest.slice(1) };
    }
  }

  return out;
}
