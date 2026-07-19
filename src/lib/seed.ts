import type {
  Automation, HouseEvent, InventoryItem, MaintItem, Member, MemberId, ShopItem, Task,
} from "./types";
import { addDays, iso } from "./dates";

/**
 * Dates are seeded RELATIVE to now, then materialised to ISO — so the demo is
 * always alive. Hardcoding "2026-07-13" means the app looks abandoned tomorrow.
 */
const d = (offset: number) => iso(addDays(new Date(), offset));

/** Epoch ms N days back — for `completedAt`, so the You tab's "this week"
 *  contribution reflects a real, recent history at demo start (not a cold zero). */
const doneAgo = (days: number) => Date.now() - days * 86_400_000;

/**
 * A clock label N minutes from NOW — for demo events that must land inside the
 * "next two hours" horizon whatever the wall clock says when the app seeds.
 * (Near midnight it can cross into tomorrow's numbers while dated today; a
 * demo-seed quirk we accept.)
 */
const tAt = (mins: number) => {
  const dt = new Date(Date.now() + mins * 60_000);
  let h = dt.getHours();
  const m = String(dt.getMinutes()).padStart(2, "0");
  const ap = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${m} ${ap}`;
};

/**
 * IDENTITY and ROLE are set independently here, on purpose — the seed is the
 * model's first proof. Leo is 10 and `limited`, not because he's 10 but because
 * the household decided it; his age exists only so the minAge gate can check
 * whether he can use the oven. Nothing reads "kid".
 */
export const seedMembers: Record<MemberId, Member> = {
  maya: {
    id: "maya", name: "Maya", email: "maya@rivera.home", kind: "person", role: "owner", color: "var(--m-maya)",
    responsibility: { domains: ["Meals", "Bills"], spaces: ["Kitchen"] },
  },
  sam: {
    id: "sam", name: "Sam", email: "sam@rivera.home", kind: "person", role: "full", color: "var(--m-sam)",
    responsibility: { domains: ["Home maintenance"], spaces: ["Garden", "Garage"] },
  },
  leo: {
    id: "leo", name: "Leo", kind: "person", role: "limited", age: 10, color: "var(--m-leo)",
    responsibility: { domains: ["Pets"], spaces: ["Leo's room"] },
  },
  ada: {
    id: "ada", name: "Ada", kind: "person", role: "guided", age: 7, stars: 5, color: "var(--m-ada)",
    responsibility: { domains: [], spaces: ["Ada's room"] },
  },
  juno: { id: "juno", name: "Juno", kind: "pet", role: "guided", color: "var(--m-juno)" },
};

export const seedTasks: Task[] = [
  /* ONE trash entry. It used to exist twice — this task AND a "Trash night"
     calendar event — which read as being asked to do the job twice. One thing,
     both provenances in the eyebrow. */
  /* "Auto", not "Automation" — with two provenances in one eyebrow the long
     word pushed the line to a second row, and an eyebrow is a label, not a
     paragraph. */
  { id: 1, title: "Take out the trash", owner: "sam", when: "8:00 PM", due: d(0), done: false, priority: "med", recurring: "Weekly", minAge: 8, source: "Auto · Calendar" },
  { id: 2, title: "Pick dinner & cook", owner: "maya", when: "6:30 PM", due: d(0), done: false, priority: "med", requires: "full", source: "Meals" },
  { id: 3, title: "Water the plants", owner: "leo", when: "After school", due: d(0), done: false, priority: "low", recurring: "Every 3 days", minAge: 5, source: "Home care" },
  /* THE canonical journey-with-an-audience: the kids are WAITING at school.
     "On my way" notifies them, the live trip runs on their phones, and Sam gets
     Maps — he's the one driving. `waiting` is what earns the button. */
  { id: 4, title: "Pick up the kids", owner: "sam", when: "3:15 PM", due: d(0), done: false, priority: "high", requires: "full", source: "Calendar", journey: true, where: "School", waiting: ["leo", "ada"], icon: "kid" },
  { id: 5, title: "Mow the lawn", owner: null, suggest: "sam", when: "Morning", due: d(2), done: false, priority: "low", recurring: "Seasonal", requires: "full", source: "Home maintenance" },
  { id: 6, title: "Fold the laundry", owner: "maya", when: "Morning", due: d(0), done: true, completedAt: doneAgo(0), priority: "low", minAge: 6, source: "Laundry" },
  { id: 7, title: "Set the table", owner: "ada", when: "6:00 PM", due: d(0), done: true, completedAt: doneAgo(0), priority: "low", minAge: 4, source: "Meals" },
  /* Sam's recent history — done this week, so the You tab's contribution and
     "lighter/heavier" read off a real past, not a cold start. Home maintenance
     is his patch, so that's where his effort shows. */
  { id: 20, title: "Sweep the garage", owner: "sam", when: "Morning", due: d(-1), done: true, completedAt: doneAgo(1), priority: "low", source: "Home maintenance" },
  { id: 21, title: "Change the porch bulb", owner: "sam", when: "Evening", due: d(-2), done: true, completedAt: doneAgo(2), priority: "low", source: "Home maintenance" },
  { id: 22, title: "Refill the water softener", owner: "sam", when: "Morning", due: d(-4), done: true, completedAt: doneAgo(4), priority: "low", source: "Home maintenance" },
  { id: 8, title: "Replace HVAC filter", owner: "sam", when: "Morning", due: d(4), done: false, priority: "med", recurring: "Quarterly", requires: "full", source: "Home maintenance" },
  { id: 9, title: "Vacuum living room", owner: "leo", when: "Afternoon", due: d(2), done: false, priority: "low", recurring: "Weekly", minAge: 8, source: "Cleaning" },
  { id: 10, title: "Homework check", owner: "maya", when: "7:30 PM", due: d(0), done: false, priority: "med", requires: "full", source: "Kids" },

  /* The rest of the year. A home isn't only the next four days — without these the
     Month/Quarter/Year views would be grouping a single month. */
  { id: 11, title: "Car service", owner: "sam", when: "Morning", due: d(26), done: false, priority: "med", recurring: "Yearly", requires: "full", source: "Home maintenance" },
  { id: 12, title: "Renew home insurance", owner: "maya", when: "Any time", due: d(52), done: false, priority: "high", recurring: "Yearly", requires: "full", source: "Bills" },
  { id: 13, title: "Deep clean the oven", owner: "maya", when: "Weekend", due: d(68), done: false, priority: "low", recurring: "Twice a year", minAge: 14, source: "Cleaning" },
  { id: 14, title: "Service the boiler", owner: "sam", when: "Morning", due: d(104), done: false, priority: "med", recurring: "Yearly", requires: "full", source: "Home maintenance" },
  { id: 15, title: "Sweep the chimney", owner: "sam", when: "Any time", due: d(137), done: false, priority: "med", recurring: "Yearly", requires: "full", source: "Home maintenance" },
  { id: 16, title: "Leo's parents evening", owner: "maya", when: "6:00 PM", due: d(196), done: false, priority: "med", requires: "full", source: "Kids" },

  /* BILL-TASKS. The Bill object died — a bill is a task wearing money (amount,
     and usually a payUrl + "Email · provider" source, filed by the "Bills from
     email" automation). They land on whoever owns the "Bills" domain (Maya).
     Rent is the counter-example: a hand-set standing order, no email, no link.
     example.com hosts are deliberate — demo links that go nowhere real. */
  { id: 30, title: "Pay the electric bill", owner: "maya", when: "Any time", due: d(-2), done: false, priority: "high", requires: "full", source: "Email · Pacific Power", amount: 142, payUrl: "https://pay.pacificpower.example.com" },
  { id: 31, title: "Pay for internet", owner: "maya", when: "Any time", due: d(4), done: false, priority: "med", requires: "full", source: "Email · Speedline", amount: 79, payUrl: "https://my.speedline.example.com/billing" },
  { id: 32, title: "Pay home insurance", owner: "maya", when: "Any time", due: d(10), done: false, priority: "med", requires: "full", source: "Email · Hearth & Home", amount: 168, payUrl: "https://portal.hearthhome.example.com/pay" },
  { id: 33, title: "Pay the water bill", owner: "maya", when: "Any time", due: d(-15), done: true, completedAt: doneAgo(15), priority: "med", requires: "full", source: "Email · City Water", amount: 64 },
  { id: 34, title: "Rent", owner: "maya", when: "Any time", due: d(14), done: false, priority: "high", recurring: "Monthly", requires: "full", source: "Bills", amount: 2400 },
];

export const seedShopping: ShopItem[] = [
  /* `by` = whose want this is. The house's own asks arrive via `low` instead —
     two kinds of wanter, each with its own mark. */
  { id: "s3", title: "Bananas", category: "Groceries", low: false, done: false, by: "leo" },
  { id: "s4", title: "Chicken thighs", category: "Groceries", low: false, done: false, note: "for tonight", by: "maya" },
  /* Age-gated: the till will refuse this to Leo, so the app does too — he can
     see it (and add things like it); ticking it off is for the adults. */
  { id: "s7", title: "Wine for the Kims", category: "Groceries", low: false, done: false, minAge: 18, by: "maya" },
  { id: "s5", title: "Paper towels", category: "Supplies", low: false, done: false, by: "sam" },
  { id: "s6", title: "Coffee", category: "Groceries", low: false, done: true, by: "maya" },
];


export const seedInventory: InventoryItem[] = [
  { id: "i1", title: "Oat milk", location: "Fridge", quantity: "Almost out", status: "low" },
  { id: "i2", title: "Dish soap", location: "Under sink", quantity: "Low", status: "low" },
  { id: "i3", title: "Dog food", location: "Pantry", quantity: "2 days", status: "low" },
  { id: "i4", title: "Rice", location: "Pantry", quantity: "3 kg", status: "ok" },
  { id: "i5", title: "Ibuprofen", location: "Medicine", quantity: "1 box", status: "expiring" },
];

export const seedMaint: MaintItem[] = [
  { id: "m1", title: "Smoke alarm test", asset: "Safety", due: d(-6), status: "over", cadence: "Monthly" },
  { id: "m2", title: "HVAC filter", asset: "HVAC", due: d(4), status: "due", cadence: "Quarterly" },
  { id: "m3", title: "Clean gutters", asset: "Roof", due: d(74), status: "season", cadence: "Twice a year" },
  { id: "m4", title: "Descale dishwasher", asset: "Kitchen", due: d(38), status: "up", cadence: "Every 3 mo" },
];

/**
 * `journey` = somewhere you GO (a heading, a map). But "On my way" needs MORE
 * than a journey — it needs `waiting`: someone in the household at the far end
 * to hear it. Padel with Marco is a journey, but Marco isn't in the app; a
 * parcel locker cares about nothing. Neither gets the button — announcing a
 * trip to nobody is theatre. `icon` is what the notification shows in place of
 * the tasked person's own face.
 *
 * No trash here, no pickup here — both are TASKS (jobs someone holds), not
 * calendar entries; duplicating them across the two lists asked Sam to do the
 * same job twice.
 */
export const seedEvents: HouseEvent[] = [
  { id: "e1", due: d(0), title: "Dentist", time: "4:00 PM", who: "leo", journey: true, where: "The dental clinic", icon: "tooth" },
  /* Seeded RELATIVE to now (tAt) so they always sit inside the two-hour
     horizon — the demo's "soon" band has something to show whenever it runs. */
  { id: "e10", due: d(0), title: "Padel with Marco", time: tAt(70), who: "sam", journey: true, where: "The club", icon: "heart" },
  { id: "e11", due: d(0), title: "Parcel at the locker", time: tAt(110), who: "sam", journey: true, where: "The locker", icon: "box" },
  { id: "e12", due: d(0), title: "Yoga", time: tAt(80), who: "maya", journey: true, where: "The studio", icon: "yoga" },
  { id: "e3", due: d(1), title: "WFH", time: "all day", who: "sam", recurring: "Every Mon", icon: "house" },
  { id: "e4", due: d(2), title: "Recital", time: "5:30 PM", who: "ada", journey: true, where: "The auditorium", icon: "music" },
  { id: "e5", due: d(3), title: "Grocery run", time: "10:00 AM", who: "maya", recurring: "Weekly", journey: true, where: "The market", icon: "cart" },
  { id: "e6", due: d(5), title: "Guests — the Kims", time: "6:00 PM", who: "maya", icon: "party" },
  { id: "e7", due: d(33), title: "Ada's birthday", time: "all day", who: "ada", recurring: "Yearly", icon: "gift" },
  { id: "e8", due: d(61), title: "School term starts", time: "8:30 AM", who: "leo", icon: "grad" },
];

export const seedAutomations: Automation[] = [
  // The rule behind the bills' "Email · …" badges — the monthly entries write
  // themselves. UI-ready: the story is told here and worn by the bills; the
  // real inbox connection is future work.
  { id: "a6", title: "Bills from email", description: "Reads billing emails — adds the bill, its due date, and where to pay", on: true },
  { id: "a1", title: "Auto-add low items", description: "When something runs low, add it to shopping", on: true },
  { id: "a2", title: "Trash reminder", description: "Nudge Sam every Tuesday at 8pm", on: true },
  { id: "a3", title: "Weekly rebalance", description: "Even out the workload each Sunday", on: true },
  { id: "a4", title: "Bill alerts", description: "Warn 3 days before a non-autopay bill", on: true },
  { id: "a5", title: "Guest mode", description: "Prep when an event is tagged guests", on: false },
];
