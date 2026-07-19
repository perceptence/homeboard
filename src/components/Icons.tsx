"use client";

import {
  ArrowRight, BarChart3, BatteryFull, Bell, CalendarDays, Check, ChevronLeft, ChevronRight,
  Baby, CreditCard, ExternalLink, House, LayoutGrid, ListChecks, Mail, Package, PawPrint, Repeat,
  ArrowLeftRight, ArrowUpRight, ChevronDown, ChevronUp, ChevronsUp, Plus, Search, Settings, ShoppingCart, Signal, Sparkles, TrendingUp, User, Users, Wifi, Wrench, X, Zap,
  Clock, Heart, KeyRound, Lock, MapPin, Mic, Moon, Scale, Sun, LayoutList,
  Trash2, Sprout, Music2, GraduationCap, Gift, Car, Navigation, PartyPopper, Utensils, RotateCcw, Carrot, Flower2, Camera,
} from "lucide-react";

/**
 * THE ONE HAND-DRAWN GLYPH. Lucide ships no tooth, and a stethoscope on
 * "Dentist" said "medical" when the thing is dental. Drawn on lucide's own
 * grammar — 24×24 viewBox, stroke-only, round caps and joins, stroke width
 * passed through — so it sits in the set without reading as a stranger. This
 * is the documented exception to "imports only"; add a second one reluctantly.
 */
const Tooth = ({ size = 24, strokeWidth = 1.5, className }: {
  size?: number; strokeWidth?: number; className?: string;
}) => (
  <svg
    width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"
    className={className} aria-hidden
  >
    <path d="M12 5.6c-1.5-1.8-4-2.7-6-1.7C3.6 5.1 2.9 8 3.9 10.5c.9 2.3 1.5 4.7 1.8 7.1.1 1 .9 1.8 1.9 1.8 2.1 0 1.3-4.2 4.4-4.2s2.3 4.2 4.4 4.2c1 0 1.8-.8 1.9-1.8.3-2.4.9-4.8 1.8-7.1 1-2.5.3-5.4-2.1-6.6-2-1-4.5-.1-6 1.7Z" />
  </svg>
);

/**
 * One icon set, one weight. Hand-rolled SVG paths at hairline weights are a big
 * part of what makes a UI read as a wireframe — these are optically consistent.
 */
const MAP = {
  home: House,
  tasks: ListChecks,
  cart: ShoppingCart,
  cal: CalendarDays,
  house: House,
  people: Users,
  chart: BarChart3,
  grid: LayoutGrid,
  bell: Bell,
  search: Search,
  plus: Plus,
  user: User,
  x: X,
  check: Check,
  back: ChevronLeft,
  fwd: ChevronRight,
  bill: CreditCard,
  box: Package,
  wrench: Wrench,
  bolt: Zap,
  gear: Settings,
  spark: Sparkles,
  arrow: ArrowRight,
  signal: Signal,
  wifi: Wifi,
  battery: BatteryFull,
  repeat: Repeat,
  kid: Baby,
  pet: PawPrint,
  /** Hand a task to someone else — a TRANSFER, not a "share". */
  handoff: ArrowLeftRight,
  trend: TrendingUp,      // progress / "doing well" — NOT urgency
  high: ArrowUpRight,     // the "High ↗" label only
  out: ExternalLink,      // leaves the app — a provider's pay page
  mail: Mail,             // came from email — the bills automation's badge
  chevDown: ChevronDown,
  chevUp: ChevronUp,
  chevsUp: ChevronsUp,    // "more above" — stacked to read as depth, not a stepper
  mic: Mic,               // speak a task — the fast path into New Task
  clock: Clock,           // a time of day — NOT a reminder (that's the bell)
  // Quiet hours. Lucide has no `Zzz`, and hand-drawing one would break the one
  // rule this file exists to enforce (see above) — three hairline letterforms at
  // 12px are mush anyway, and letters-as-icon is typography wearing a costume.
  // The moon is the same idea in one legible silhouette: a night window, not a
  // mute switch. `BellOff` was the other candidate and says something narrower —
  // "alerts off" rather than "these are my sleeping hours".
  moon: Moon,
  /** Where you are. A pin is the only honest glyph for presence — `house` would
   *  be wrong three states out of four (out, away, and just "here"). */
  pin: MapPin,
  /**
   * Access, as something you HOLD.
   *
   * NOT `lock`. A padlock on "Your access" says you're shut out — it editorialises,
   * and it's the reason the icon was pulled from this card in the first place. A key
   * is the same subject with the opposite valence: what you've been given, not what
   * you're kept from. That distinction is the whole role model in one glyph.
   */
  key: KeyRound,
  sun: Sun,
  feed: LayoutList,
  lock: Lock,
  heart: Heart,
  scale: Scale,
  // Event glyphs — what a reminder is ABOUT, so the island can show the thing
  // instead of the tasked person's own face.
  trash: Trash2,
  plant: Sprout,
  music: Music2,
  grad: GraduationCap,
  gift: Gift,
  tooth: Tooth,            // the dentist — the thing itself, not "medicine" at large
  yoga: Flower2,           // yoga / stillness — a lotus, not a cardiogram
  party: PartyPopper,      // a celebration — birthdays, guests
  car: Car,                // a journey / "on my way"
  nav: Navigation,         // live trip heading — the collapsed journey glyph
  dine: Utensils,          // a meal — plates and cutlery, not a shopping cart
  undo: RotateCcw,         // take it back — un-doing a done
  veg: Carrot,             // the Groceries aisle — food, not the act of shopping
  camera: Camera,          // change your photo — the one editable-avatar affordance
} satisfies Record<string, IconGlyph>;

/** What every entry must accept — lucide icons do; so must any hand-drawn one.
 *  A bare call signature (not ComponentType) so lucide's forwardRef components
 *  fit without dragging their propTypes shapes into the comparison. */
type IconGlyph = (props: { size?: number; strokeWidth?: number; className?: string }) => React.ReactNode;

export type IconName = keyof typeof MAP;

/**
 * ONE stroke weight for the whole set — 1.5, and no `absoluteStrokeWidth`, so the
 * line thins proportionally on small icons instead of staying a heavy 2px.
 * Do NOT pass strokeWidth at the call site: that's how the set drifted to seven
 * different weights (2, 2.2, 2.4, 2.6, 3...) and started reading chunky.
 */
export function Icon({
  name, size = 24, strokeWidth = 1.5, className,
}: { name: IconName; size?: number; strokeWidth?: number; className?: string }) {
  const Glyph = MAP[name];
  return <Glyph size={size} strokeWidth={strokeWidth} className={className} />;
}
