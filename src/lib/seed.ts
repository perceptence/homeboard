import type {
  Automation, Bill, HouseEvent, InventoryItem, MaintItem, Member, MemberId, ShopItem, Task,
} from "./types";
import { addDays, iso } from "./dates";

/**
 * Dates are seeded RELATIVE to now, then materialised to ISO — so the demo is
 * always alive. Hardcoding "2026-07-13" means the app looks abandoned tomorrow.
 */
const d = (offset: number) => iso(addDays(new Date(), offset));

/**
 * IDENTITY and ROLE are set independently here, on purpose — the seed is the
 * model's first proof. Leo is 10 and `limited`, not because he's 10 but because
 * the household decided it; his age exists only so the minAge gate can check
 * whether he can use the oven. Nothing reads "kid".
 */
export const seedMembers: Record<MemberId, Member> = {
  maya: {
    id: "maya", name: "Maya", kind: "person", role: "owner", color: "var(--m-maya)",
    responsibility: { domains: ["Meals", "Bills"], spaces: ["Kitchen"] },
  },
  sam: {
    id: "sam", name: "Sam", kind: "person", role: "full", color: "var(--m-sam)",
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
  { id: 1, title: "Take out the trash", owner: "sam", when: "Tonight", due: d(0), done: false, priority: "med", recurring: "Weekly", minAge: 8, source: "Automation" },
  { id: 2, title: "Pick dinner & cook", owner: "maya", when: "6:30 PM", due: d(0), done: false, priority: "med", requires: "full", source: "Meals" },
  { id: 3, title: "Water the plants", owner: "leo", when: "After school", due: d(0), done: false, priority: "low", recurring: "Every 3 days", minAge: 5, source: "Home care" },
  { id: 4, title: "Pick up the kids", owner: "sam", when: "3:15 PM", due: d(0), done: false, priority: "high", requires: "full", source: "Calendar" },
  { id: 5, title: "Mow the lawn", owner: null, suggest: "sam", when: "Morning", due: d(2), done: false, priority: "low", recurring: "Seasonal", requires: "full", source: "Home maintenance" },
  { id: 6, title: "Fold the laundry", owner: "maya", when: "Morning", due: d(0), done: true, priority: "low", minAge: 6, source: "Laundry" },
  { id: 7, title: "Set the table", owner: "ada", when: "6:00 PM", due: d(0), done: true, priority: "low", minAge: 4, source: "Meals" },
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
];

export const seedShopping: ShopItem[] = [
  { id: "s3", title: "Bananas", category: "Groceries", low: false, done: false },
  { id: "s4", title: "Chicken thighs", category: "Groceries", low: false, done: false, note: "for tonight" },
  { id: "s5", title: "Paper towels", category: "Supplies", low: false, done: false },
  { id: "s6", title: "Coffee", category: "Groceries", low: false, done: true },
];

export const seedBills: Bill[] = [
  { id: "b1", title: "Rent", amount: 2400, due: "Aug 1", status: "scheduled" },
  { id: "b2", title: "Electric", amount: 142, due: "Jul 16", status: "due" },
  { id: "b3", title: "Internet", amount: 79, due: "Jul 22", status: "upcoming" },
  { id: "b4", title: "Insurance", amount: 168, due: "Jul 28", status: "upcoming" },
  { id: "b5", title: "Water", amount: 64, due: "Jul 3", status: "paid" },
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

export const seedEvents: HouseEvent[] = [
  { id: "e1", due: d(0), title: "Dentist", time: "4:00 PM", who: "leo" },
  { id: "e2", due: d(0), title: "Trash night", time: "8:00 PM", who: "sam", recurring: "Weekly" },
  { id: "e3", due: d(1), title: "WFH", time: "all day", who: "sam", recurring: "Every Mon" },
  { id: "e4", due: d(2), title: "Recital", time: "5:30 PM", who: "ada" },
  { id: "e5", due: d(3), title: "Grocery run", time: "10:00 AM", who: "maya", recurring: "Weekly" },
  { id: "e6", due: d(5), title: "Guests — the Kims", time: "6:00 PM", who: "maya" },
  { id: "e7", due: d(33), title: "Ada's birthday", time: "all day", who: "ada", recurring: "Yearly" },
  { id: "e8", due: d(61), title: "School term starts", time: "8:30 AM", who: "leo" },
];

export const seedAutomations: Automation[] = [
  { id: "a1", title: "Auto-add low items", description: "When something runs low, add it to shopping", on: true },
  { id: "a2", title: "Trash reminder", description: "Nudge Sam every Tuesday at 8pm", on: true },
  { id: "a3", title: "Weekly rebalance", description: "Even out the workload each Sunday", on: true },
  { id: "a4", title: "Bill alerts", description: "Warn 3 days before a non-autopay bill", on: true },
  { id: "a5", title: "Guest mode", description: "Prep when an event is tagged guests", on: false },
];
