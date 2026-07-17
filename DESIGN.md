# Homeboard — Design Guidelines

Transcribed from the **master prompt**. Every value here is binding.
If a value isn't in this document, it doesn't go in the code.

---

## 0. The user model — four things, never mixed

> **"Mom", "Dad", "Kid" and "Roommate" are RELATIONSHIPS. Relationships must NEVER
> determine permissions.** They describe how people feel about each other; they are
> not an access model, and every home they get wrong is a real one: the teenager who
> runs the family budget, the grandparent who lives with you and shouldn't be locked
> out, the au pair who needs the school run but not the bank account.

The model separates four independent things. Nothing may collapse them:

| | Question | Where it lives |
|---|---|---|
| **Household type** | How does this home *work*? | `HouseholdAxes` — `money`, `dependents` |
| **Identity** | Who *is* this? | `Member.kind` (`person`/`pet`), `name`, `age` |
| **Role** | What may they *do*? | `Member.role` — `owner`/`full`/`limited`/`guided` |
| **Responsibility** | What do they *look after*? | `Responsibility` — `domains` (what) + `spaces` (where) |

> ⚠️ **ROLE IS ASSIGNED, NEVER DERIVED.** No code may write `age < 18 ? "limited" : "full"`,
> or infer access from a relationship, a preset, or list position (`i === 0 ? owner`).
> `setRole` is the only path a role changes by. A 15-year-old may hold `full`; a
> 40-year-old may be `guided` after an illness.

> ⚠️ **Age is a CAPABILITY datum, never a permission.** Its only legal use is the
> `minAge` gate on a task (sharp, hot, heavy). It is optional, and an unknown age
> never blocks anyone — refusing to let someone take the bins out because they didn't
> share a birthday is hostile.

> ⚠️ **A task carries TWO gates, and they answer different questions.**
> `requires` = AUTHORITY (money, contracts — a minimum role).
> `minAge` = CAPABILITY (can they physically/safely do it).
> The old single `adultOnly` flag did both jobs and got both wrong: it locked out the
> 16-year-old trusted with the shopping card and let in any adult houseguest.

> ⚠️ **A preset is a SHORTCUT, not a category.** `PRESETS` (family/couple/roommates/solo)
> only sets `axes` and suggests a starting cast. **Nothing in the app may branch on the
> preset** — surfaces read the axes. That's what lets a home match no preset (co-parents:
> split money *and* dependents) and still be first-class, and lets a couple who has a
> baby flip one axis instead of migrating type.

> **Say what the WORK needs, never what the PERSON is.** "This one stays with the
> grown-ups" → "Involves money, contracts or risk". "Age 7 · Junior" → "A simpler view".
> The same sentence has to read right whether the person is 7 or 70.

**Roles are said in family language, and ONE STRING CANNOT DO THREE JOBS.** "Owner / Full
access / Limited / Guided" was an IAM console in a home app — and "Limited" quietly told a
teenager the app thought less of them. Four tables, because these are four different
sentences:

| table | job | example |
|---|---|---|
| `ROLE_LABEL` | a noun, under "Your access" or beside a name | "Shares the running" |
| `ROLE_HINT` | the detail — **pronoun-free**, it's read both about you and about others | "Everything except the household's own settings" |
| `ROLE_SET` | a verb, for "Sam now ___" | "shares the running" |
| `ROLE_NEEDS` | what the **work** needs — never the person's tier | "money, contracts or risk" |

> ⚠️ `requires: "full"` is **accountability, not access**: money, contracts, alcohol,
> prescriptions, bleach, the boiler, a chainsaw, driving (`NEEDS_FULL` in parse.ts). So a
> blocked row says "Involves money, contracts or risk" — about the job. Reusing the role
> label here is what produced "The only one with full access who's free" in a handoff:
> vocabulary from an admin console, answering a question nobody asked.
>
> A suggestion's reason must never cite a role at all.

### Say the kind thing — it's usually the true one

Being *about the work* is necessary and not sufficient. **Where a sentence sits changes
what it says.** "Involves money, contracts or safety" is a neutral fact about a task —
but greyed out under a ten-year-old's name it reads *Leo can't be trusted with money*.

These roles exist so that somebody **doesn't have to** carry the boiler and the insurance
renewal. That's not a shortfall in the person, it's the entire point — so:

| where | never | instead |
|---|---|---|
| blocked — authority (`requires`) | "Needs full access" · "Involves money, contracts or safety" | **"Not Leo's to worry about"** |
| blocked — capability (`minAge`) | "Ages 14+" | **"Not Leo's yet — ages 14+"** |
| the one candidate | "The only one with full access who's free" · "The only one free who can take it" | **"The right hands for this"** |

**One voice, two tails.** Both blocked lines open identically — they're the same kind of
sentence and a reader shouldn't change gear between two rows of one list. ("Ages 14+" sat
next to "Not Leo's to worry about" and read like a film rating had wandered in.) The
*endings* differ because the gates genuinely do: `minAge` is **temporary** — Leo will be
14, the gate lifts by itself, so it says "yet" and names the day. `requires` is
**assigned** — it may never be theirs, and promising "yet" would be the app making an
offer the owner never made. Not yet and not yours are not the same promise.

Both bad versions lead with an *absence* — of permission, or of anyone else. Nobody wants
a job handed over by an app that opens with "well, there's no one else". "The right hands"
isn't a dressed-up constraint: they genuinely can hold it and are genuinely free, which is
all the app knows. That no rival existed is not a fact about them and doesn't belong in a
line about them.

### An icon well is furniture for the glyph

**`neutral` — the soft grey — is the default, and it holds on any light card, tinted or
not.** The same well on lemon as on white. A card is identified by its *icon*, not by a
second colour arguing with the one the card already has; the tint is the card's job, and
a well that joins in makes the card louder without making it clearer.

| card | icon well |
|---|---|
| white · lemon | `tone="neutral"` — soft grey |
| lavender — Your progress | `tone="lemon"` — the one exception, and part of that card's identity |
| near-black backdrop | `tone="onDark"` |

The glyph stays `ink` throughout, so legibility never rests on the fill.

> Two wrong answers preceded this, both instructive. `onTint` (a flat ink wash) is what
> you reach for when you *haven't decided* — it's a shrug, not a choice. And a
> lavender-on-lemon "the tints trade places" reciprocal was a rule that sounded elegant
> and bought nothing: cleverness in the system, cost on the screen.

### Icons are round, and they lead

**Every icon well in this app is `rounded-pill`** — the progress card's, the mic,
ActionButton, the calendar's arrows, every Avatar. `IconTile` was `rounded-sm` and was
the only square thing among them, which made it read as a different species. The
nested-radius rule (§3) governs boxes inside boxes; it has nothing to say about a 40px
well holding a 20px glyph.

**The icon leads the row; the text sits to its right.** Stacking the glyph above the
title opens every card with 40px of nothing, and the row shape is what the progress card
already used.

> A qualifier belongs with the thing it qualifies. "1 is high" is a clause of "you have 2
> tasks for today" — it sat pinned to the card's bottom behind a rule, which put the one
> urgent signal as far from the count as the card allowed and dressed it as a footnote.

### Metadata is not texture

The Today hero card carried "Today · Yearly · Twice a year" under a headline reading
"You have 2 tasks for today" — **and the two disagreed.** The headline counted today's
tasks; the tags were built from every open task, unfiltered. "Twice a year" was the oven,
due in 68 days. "Yearly" was the insurance renewal, due in 52. A card about today,
quietly describing next quarter.

No version of it was worth keeping: scoped to today it would read "Today", restating the
sentence directly above it. It looked like information and answered no question anyone
has. `highCount` stayed — it's drawn from the same list the headline counts, and "1 is
high" is the one thing there that changes what you do next. When nothing's high the
footer doesn't exist, rather than standing there empty.

> **Ask of any derived label: whose question does this answer, and is it drawn from the
> same set as the sentence it sits under?** If the answer to either is fuzzy, it's
> decoration wearing a data costume.

### One way to say "a label on a thing"

**`<Pill tone="tag">`. There are no hashtags.** The Today hero card had the app's only
`#tag` — one use against eleven pills — and the `#` was damaging its own content: to make
one, the label had to be lowercased and space-stripped, so **"Twice a year" reached the
screen as "#twiceayear"**. A format that mangles what it holds in order to fit isn't a
format, it's a costume. (The `Tags` component is deleted, not just unused — a second way
to say the same thing is a thing someone will reach for.)

### Show the move before you make it

**The Balancer moves someone else's work.** "Even it out" used to do that on tap and
report it in a toast that's gone in three seconds: you couldn't see what would change
before it changed, or what had changed after. That's a lot of authority for one button.

`previewRebalance()` decides; `rebalance()` applies; the confirm sheet shows the decision.
**One function, so the sheet cannot promise a move the store then makes differently** —
and the card's verdict asks it too, rather than re-deriving the rule.

> ⚠️ **Never re-derive a rule the engine already owns.** The load card hand-copied
> `most - least >= 2` and it was wrong twice: `least` is the seven-year-old at 0, whom the
> role floor bars from nearly everything — so the gap was *permanently* ≥2 and "Fairly
> shared right now" could never appear. And on a tie (Sam 5, Maya 5) it told Sam that Maya
> "has the most". `previewRebalance` has neither flaw because it only counts people who
> could actually take the work. Ask the engine; don't paraphrase it.

> ⚠️ **Kind words in alarm paint still read as an alarm.** Those blocked rows were
> `text-danger`. Nothing has gone wrong when a child isn't offered the insurance renewal —
> that's the app working. Red is for "High ↗" only (§2). The row is already dimmed; that's
> the whole signal it needs.

A label that works as a badge does not automatically work as an eyebrow: "GUIDED / Ada"
read fine, "A SIMPLER VIEW / Ada" is not a thing you can say about a person. The phone's
You header now carries the **household name** — which was the truer eyebrow anyway, since
Your access states the role in full two cards down.

### 0b. Availability — a fifth thing, and it is NOT a permission

`Member.availability` says **where someone is**. It is a *signal* the Balancer scores,
never a gate: `canAssign` does not read it. Anyone may set their own, including `guided`
— where you are is a fact about your life, not an authority you have to earn.

Four states. **"Working today" is deliberately not one of them** — everyone is working
today; it's `here` with extra words.

| | means | what the app does |
|---|---|---|
| `here` | the default | nothing — and so the card says nothing |
| `wfh` | home all day | **a positive.** First pick for anything around the house |
| `out` | gone till tonight | daytime work skips them; evenings still find them |
| `away` | gone for days (`from`/`to`) | nothing new lands inside the span |

> ⚠️ **`wfh` is a GAIN, not an excuse.** Every other app treats availability as
> "don't bother me". Being home makes you **more** useful for home work, not less.
> This is the thesis of the feature and the scoring must keep proving it.

**Calibration is load-bearing.** Load scores 2/task. Availability is a fact the person
*told us*, where load is only a proxy — so it must **outweigh** the proxy: `wfh` is −4
(two tasks' worth), `out` is +6. Shipped once at −2/+3 and it was wrong in a way that
looked fine: `wfh` couldn't beat a one-task gap, and `out` produced a *tie*, so the app
said "either of them could take it" about someone who wasn't home.

A presence picker that only says "Out" is a status badge. The card leads with the
**consequence** — "daytime jobs will go to someone else" — because that's the reason to
touch it.

### 0c. Cover — `owner` is the truth, `coveredBy` is the fact

`away` stops NEW work landing on you. It says nothing about the five tasks you already
had, which sit there being due while you're in Spain. `coveredBy` closes that.

> ⚠️ **Never implement cover by reassigning `owner`.** It's the obvious move and it
> corrupts the app: `recall()` learns precedent by tallying `owner` across tasks sharing
> a `source`, so covering one week's Meals permanently teaches the household that *Sam*
> cooks — and nothing restores it. `owner` = whose job it is. `coveredBy` = who's doing
> it this once. Cover expires by clearing one field; the truth was never touched.

**`holder(t)` — `coveredBy ?? owner` — is the ONLY answer to "who is doing this".** Load,
"my tasks", the card avatar, the Balancer, stars: all `holder`. Precedent alone reads
`owner`. Getting these backwards is the bug the field exists to make thinkable.

Two things this cost, both worth writing down:

- **"How much work does X have" was written FOUR times** — `pendingFor` existed and three
  surfaces re-implemented it inline. Cover would have shipped half-broken: counted on the
  You tab, invisible on the iPad. One definition, four callers.
- **`suggestTaker` must see its own previous picks.** Placing N tasks in a loop against
  the same starting state returns the same least-loaded person N times — "covered 5
  tasks" meaning "dumped all five on Sam". Accumulate into the working array.

> ⚠️ **Cover must be VISIBLE.** A card showing Sam's avatar with nothing saying the job is
> Maya's is a lie of omission — it's a reassignment with extra steps. Every covered card
> carries "Covering for Maya".

**Say when nobody can.** "Covered 2. 1 nobody can take." beats a cheerful "Done" that
strands work on someone who's abroad. The second is a surprise on Friday night.

---

## 1. Core visual direction

Modern, minimal, premium. Rounded corners **everywhere**. Soft pastel gradient behind the
device; the app screen itself is near-black. Bold typography with strong hierarchy. Clean and
spacious, with excellent white space. Subtle shadows and elevation. Friendly and approachable,
yet professional. iOS-inspired but more contemporary.

---

## 2. Colour

| Token | Hex | Use |
|---|---|---|
| `ink` | `#0E0E10` | Primary — **and the app screen backdrop** |
| `lavender` | `#C9C8F0` | Progress card / secondary tint |
| `lemon` | `#F4FF7A` | **Primary card** — the day's hero |
| `card` | `#FFFFFF` | Secondary card |
| `surface` | `#F5F4F8` | light neutral fill *inside* light cards |
| `accent` | `#D1D0F5` | |
| `progress` | `#C7C6F0` | |
| `sub` | `#686B78` | Text Secondary |
| `danger` | `#E5484D` | the **"High ↗"** label only — never a filled slab |

**Room gradient** (behind the device): `#C9C8F0 → #F5F4F8`.

> **Four card tones, each with ONE meaning — not a palette to decorate with:**
> Primary (lemon = the day's hero), Secondary (white = individual items), Progress
> (lavender = your reflection), Shared (mint = the household's collective list).
> **DO NOT** use bright, saturated colour, and **DO NOT** add a fifth tone to make
> something "pop" — a tone is a meaning, not a highlighter.

> ⚠️ **Mint is "ours", the way lemon/lavender are "yours".** A member's phone is
> almost entirely personal — your day, your tasks, your progress. The shopping list
> is the one thing everyone shares, so it gets the one tone that isn't yours. Pitched
> at the lavender's lightness (`#C4E8D3` vs `#C9C8F0`) so the two read as siblings on
> one screen, never as a jarring new brand colour. It is NOT "green because
> groceries" — reserve it for genuinely shared/household surfaces.

> ⚠️ **Glass over a SCROLLING list must read its backdrop and invert.** The floating
> nav is `bg-white/10` over the feed — so it sits on ink at the top and on a white card
> a moment later, and white text goes to **1:1 contrast** and disappears. Tinting the
> glass dark until white always works is NOT the fix: it deletes the material to dodge
> the problem, and a translucent panel that ignores its backdrop is a grey box.
>
> `useBackdropTone` samples what's actually painted behind the panel and the contents
> invert — ink over a light card, white over ink. Same move the iOS status bar makes
> over a scrolling page. Three things are load-bearing:
> - **Sample a GRID, not a point.** The nav is wider than the 8px gap between cards; a
>   lone centre probe that lands in a gap reads "ink" while 95% of the bar sits on white.
> - **Walk up to the nearest element that actually PAINTS.** `background: transparent`
>   is the default, so the element under the cursor usually isn't the one you can see.
> - **The selected fill inverts too.** A white pill on a white card is exactly as
>   invisible as white text on it.
>
> This applies to panels over VARIABLE content only. The iPad sidebar uses the same
> light glass and is correct — it's a grid column pinned over `bg-ink`, so its backdrop
> never changes. Match on the failure condition, not on the CSS.

> ⚠️ **A panel that reads as opaque must BE opaque.** `z-index` orders; it does not
> paint. The sticky header only *looked* black by inheriting the backdrop, so cards
> scrolled straight through it — it carries `bg-ink` explicitly.
>
> The status bar had the same fault — and "make it a transparent overlay" was the WRONG
> fix that fuelled the entire hairline saga below. A transparent status bar means the
> top 48px of the screen is opaque only if the app's sticky header paints there
> perfectly; any misalignment (scale rasterisation, sticky paint offset, scroll physics)
> let the white card scrolled under the header peek out as a hairline — which was then
> misdiagnosed as a frame problem six times. The status bar is now an **opaque ink band
> in `DeviceFrame`** that bleeds 12px ABOVE the screen's clip edge, so its only real
> edge is the bottom — landing on the header's own ink (`SAFE_TOP + 16`), ink on ink,
> invisible at any scale. Cards cannot paint in the top band, full stop.
>
> The app must NOT pad its own top to reserve it. That just moves the boundary: the
> scroller's clip edge lands at y=48, fractional again (122.56), and a card bleeds
> through the crack. The **scroller runs the full height of the screen** and the
> **sticky header carries the safe area** (`pt = SAFE_TOP + 16`) — so the header is
> continuous ink from the top of the screen and there is no boundary at all.
> **Delete the seam; don't seal it.**
>
> The same trap bit a third time, in `PhoneFrame` itself: the bezel was
> `box-shadow: 0 0 0 9px`, which paints **outside** the element box while the background
> is clipped **to** it. Two separately rasterised layers meeting at one fractional
> coordinate — and the crack between them showed the **page** through the top of the
> frame, because every layer behind the phone is transparent. The bezel is now a real
> **`border`** in the body's own colour: backgrounds paint *under* borders
> (`background-clip: border-box`), so there is one continuous fill and no second edge.
>
> **The rule behind all three: two abutting opaque things will leak. Make it one thing.**
> Diagnose it by painting whatever sits *behind* a lurid colour — if the hairline turns
> magenta, you know exactly which layer is showing through, and `elementFromPoint` will
> not tell you (it reports what's hit-testable, not what's painted).

> ⚠️ **A scaled frame must land on WHOLE DEVICE PIXELS.** The last hairline was not a
> leak between layers at all — it was the frame's own outline being asked to sit
> *between* two pixels. `PhoneFrame` scales by whatever fraction fits, so its edge landed
> at e.g. `y = 172.664`; the browser can't paint ⅔ of a pixel, so it painted a blend of
> the frame's near-black and the page behind it. That row reads as a **bright line along
> the straight top edge**, stopping at the corners (a curve spreads its antialiasing over
> many pixels; a straight edge concentrates it into one hard row). The drop shadow is
> offset downward, so it hid the same effect at the bottom — the top was the only edge
> exposed.
>
> `fit()` now snaps the scale so the painted height is a whole number of device pixels,
> then measures and nudges so the top-left corner starts on one. **Both** are needed: an
> integer size starting on a fraction is still fractional at the far end.
>
> Only the OUTER edge matters — that's the only place a near-black meets a bright colour.
> The bezel's inner edge stays fractional and is invisible, because both sides of it are
> near-black. Restacking and recolouring cannot fix this class of bug; only alignment can.
>
> **THE PHONE FRAME LIVES IN `DeviceFrame.tsx`, ON THE TABLET'S PATTERN. There is no
> `PhoneFrame` component — do not recreate one.** The standalone frame went through SIX
> generations of sub-pixel hairline fixes (scale snapping, translate nudges, borders,
> cover rings, grid-tuned padding, a native-px rewrite), each verified in the preview
> and each still broken in the user's own browser. It was removed at the user's order.
>
> Both frames now share one technique in one file: logical-size box, **padding bezel
> with one continuous background**, `transform: scale()` **capped at 1**. The cap is
> load-bearing twice over — chrome never upscales past its logical size, and at desktop
> sizes the phone renders at scale 1: no transform, no fractional rasterisation,
> nothing to blend. The tablet frame rendered flawlessly in every environment for the
> whole saga; the phone now stands on the same code path.
>
> Dead ends, tried and measured, in order: bezel as box-shadow ring (crack between two
> abutting paints); bezel as border (browser quantises border-width in CSS space —
> 8.88px silently became 8.5px); a cover-ring overlay (clipped by `overflow: hidden` at
> the exact fractional edge it was covering); grid-tuned padding inside the scaled
> subtree; a native-px frame with only the app scaled (correct in the preview,
> unverifiable in the wild). If the hairline ever returns, reach for the scale cap and
> the shared pattern — not for arithmetic.
>
> **Post-mortem: it was TWO bugs stacked at the same coordinate**, which is why every
> single-cause fix "worked" and failed at once.
>
> 1. **The loud one** (the user diagnosed it): task cards peeking between the app's
>    sticky header and the then-transparent status bar. Cured by the opaque,
>    over-extended status-bar band — see §2 above.
> 2. **The quiet one underneath**: the frame's own outline landing between two device
>    pixels. Cured by `useFit`'s device-grid snap — see above.
>
> Fixing #2 alone left #1's thick white line, so the snap looked useless and was ripped
> out twice. Fixing #1 alone left #2's thin grey line ("significantly thinner but still
> doing it"). Both are needed.
>
> Three lessons, paid for at length: **an artifact at a boundary is not necessarily FROM
> that boundary** — enumerate every layer that can paint there before fixing any of
> them. **A partial improvement is evidence of a co-located second cause, not of a
> failed fix** — "thinner" meant one of two was solved. And the user's eyes on a real
> Retina display beat the preview's downsampled screenshots every time: when they say
> it's still there, it's still there.
>
> ⚠️ **To SEE a one-device-pixel artifact, make the screenshot device-pixel accurate.**
> The preview renders a Retina viewport and downsamples it to an ~800px image, averaging
> the row out of existence — four "verified fixed" claims died here, each one a clean
> screenshot of a bug that was still there. At dpr 2, **a 400px-wide viewport outputs 800px
> = exactly 1 screenshot pixel per device pixel**, and the line is plainly visible. Prove a
> fix by A/B at that size: force a raw fractional `scale()` to make the line appear, then
> restore the snapping and watch it go.
>
> Back it with numbers too — `rect.top * devicePixelRatio` must be whole **across many
> window sizes**. A single size can land on an integer by luck and prove nothing.
>
> ⚠️ **HMR silently fails to apply edits to this file.** Twice, measurements described the
> OLD `fit()` while the new one sat on disk. Hard-reload before believing any measurement.

> ⚠️ **Measure layout with `offsetTop`, not `getBoundingClientRect()`,** anywhere a
> framer entrance animation is running. Rects include transforms, so for ~300ms every
> card is a moving target and any scroll computed from one lands wherever the card
> happened to be mid-flight. `offsetTop` ignores transforms.

> ⚠️ Shadow tokens are `e1/e2/e3`, *not* `card`/`raised`. A shadow named `card` collides with
> the **colour** named `card`, and Tailwind silently resolves `shadow-card` to
> *shadow-colour: white* — which paints a white halo around every card on the black backdrop.

---

## 3. Typography — Poppins

One family, **Poppins** (Google Fonts), for everything. `font-tight` is kept as the
*display role*, but it resolves to Poppins too — Poppins ships no condensed cut.

**Weight FALLS as size RISES.** The big display sizes are **Regular (400)** — heavy display type
reads as urgency, and a home is unhurried. 500 is reserved for the small stuff (h2, labels,
buttons), where it buys legibility. Nothing anywhere goes above 500.
`<Em>` — the emphasised phrase inside a sentence — is **Medium (500)**, one step above the 400
it sits in. It carries the whole phrase ("3 tasks"), not just the digit, and on a percentage it
takes the number but not the sign ("33%"). **Nothing in the app goes above 500.**

| Token | Weight | Size | Line height | Tracking |
|---|---|---|---|---|
| `display` | **Regular (400)** | 36px | 1.18 | −1.2% |
| `h1` | **Regular (400)** | 28px | 1.25 | −1% |
| `h2` | Medium (500) | 16px | 1.4 | −0.2% |
| `body` | Regular (400) | 15px | 1.55 | 0 |
| `bodysm` | Regular (400) | 14px | 1.5 | 0 |  ← **controls only** (buttons, chips, inputs)
| `caption` | Regular (400) | 14px | 1.45 | 0 |  ← **ALL meta text**
| `micro` | Regular (400) | 12px | 16px | 0 |  ← **whisper cues ONLY** — never meta text

> **Exception — the Date Badge.** Its numeral is 17px and its weekday 12px. It is a compact
> *stamp*, not running text: at the 14px meta size the weekday would nearly equal the numeral
> and the badge's internal hierarchy would collapse. This is the only exception.

> **One size for every piece of meta text.** Eyebrows, card subtitles, `#hashtags`, the date
> chip, "Current tasks", stat labels — all `caption`. If it is not the thing itself but a note
> *about* the thing, it is `caption`. `bodysm` is reserved for controls.
>
> `micro` sits BELOW the meta tier and must not erode it: it is for whisper-level cues that
> talk about the *interface* ("EARLIER"), never about the household's things. If a label
> describes a task, event, person or amount, `caption` is its floor.

> Poppins is **static, not variable**: every weight used must be listed in the `next/font`
> loader (`400, 500, 600`) or the browser synthesizes a fake one.
> It is geometric — modest x-height, tall ascenders — so it needs **more leading** than
> Inter did, and it breaks up under tight tracking. Negative tracking is roughly halved.

**Numbers live inside a sentence** — *"You have **3** tasks for today"* — never as an orphaned
stat with a caption beneath it. `<Sentence>` + `<Em>` exist for exactly this.

---

## 4. The 2px grid

**Every dimension in the app is an even number of pixels.** Sizes, spacing, radii, line-heights,
icon sizes, control heights. No halves, no odd numbers.

| | px |
|---|---|
| Base unit | **2** |
| Page gutter | 4 |
| Gap between cards | 8 |
| Card padding | 16 |
| Element spacing inside a card | 16 |
| Inner padding (large containers) | 24 |
| Section spacing | 32 |
| Card radius | 24 · (sm 12 · md 16) |
| Icon size | 24 (20 in tiles, 18 in action buttons) |
| Icon stroke | 1.5 — a line weight, see below |
| Avatar | 32 |
| Button height | 52 · **min touch target 44** |

**Line-heights are px, not ratios.** A ratio silently yields fractional pixels — `28 x 1.25 = 35`
— which is how halves crept in. Every leading is an even px value.

> ⚠️ **Arbitrary sizes leak.** `text-[14px]` sets font-size but NOT line-height, so the font's own
> 1.5 default returns and gives you 21px. Use the tokens; they carry even leading.

### The two things that are NOT on the grid, deliberately

1. **`letter-spacing`** is in `em`. It's a ratio, not a dimension — it must scale with the type.
2. **Hairlines**: `border-top: 1px` on dividers, and the 1.5 icon stroke. These are *strokes*, not
   layout. 1px is the thinnest renderable line; 2px is a rule, not a hairline.

`PhoneFrame` is excluded — it models real iPhone hardware (55px screen radius), not our grid.

---

## 5. Components

- **Primary Card** (lemon) · **Secondary Card** (white) · **Progress Card** (lavender)
- **Pill Badge — High** → white chip, red text, ↗ arrow. *Medium shows no badge at all.*
- **Date Badge** → dark **vertical stadium** (44×58, fully round ends — *not* a circle, *not* a
  square), top-aligned in its row. `13` over `Thu`.
- **The standard card format.** Every task and event on a white card uses these three parts,
  in this order — no exceptions:
  | Part | Says | Example |
  |---|---|---|
  | **Eyebrow** | where it came **from** (the domain that raised it) | `HOME MAINTENANCE` |
  | **Title** | what it **is** | Replace HVAC filter |
  | **Subtitle** | **when** + frequency | In 4 days ⟳ Quarterly |
- **Ahead — scope, zoom, travel.** Week · Month · Quarter · Year, all sorted by date.
  **Group one rung BELOW the scope** — grouping a month by month is one group, which is
  no grouping at all:
  | scope | groups by |
  |---|---|
  | Week | *flat* — 7 days reads fine as a list |
  | Month | **week** (Last week · This week · Next week) |
  | Quarter · Year | **month** |

  A group heading is a **door**: tapping it narrows the screen onto that period. It uses
  the `focus` icon (brackets), never a caret — a caret promises navigation, and this
  goes nowhere; it changes the lens on the list you're already reading.

  **Travel**: `‹ PERIOD ›` in the header steps one period; **swiping the list** does the
  same. A **Today** chip appears only once you've left the current period. Changing scope
  always re-centres on today.

  **The period label IS the scope control.** "July 2026" already names the scope *and*
  the period, so a separate tab row was saying half of it twice. Tapping it opens a
  picker where each option carries its own period — "Month · July 2026", "Quarter ·
  Jul – Sept 2026" — which tabs could never show. `‹ ›` flank it; swipe does the same.

  **"There's more above" is a whisper.** One dim chevron on the header's lower edge,
  no text, no pill — and it only exists while you're actually scrolled past something.
  Tapping it walks up rather than jumping, so you see what you passed. (A top fade is
  the usual answer and is wrong here: an ink gradient over a white card renders as a
  grey smear, not a fade.)

  **Start where the user IS — by scroll position, not by hiding.** The view parks the
  current group flush under the sticky header. The past isn't behind a button; it's
  simply *above* you, the way it is in a diary — scroll up and there it is. No CTA, no
  state, and the gesture you'd already try is the answer. Past groups stay dimmed.

  **Search is opt-in, and lives in the STICKY header** — above the list, pinned. In the
  list it would sit above the current group, which the view scrolls past on open, so
  tapping search would appear to do nothing. Its icon sits beside the bell and becomes ✕
  when open. Closing **clears the query** — a hidden filter still filtering is a trap.

  **Search transcends the period.** Looking for "boiler" inside the week you happen to
  be on would find nothing and teach the user the search is broken. Search ignores scope
  and anchor, spans all time, and groups by month. While searching the period stepper
  disappears and the header reads "N matches · all time" — it must never say "this
  month" over an all-time list.

  > ⚠️ The scroll container MUST be a `motion.div` with **`layoutScroll`**. Framer measures
  > `layoutId` in VIEWPORT space, so zooming while scrolled made the toggle's lilac pill
  > fly in from off-screen. This is not optional polish.
- **ONE task, ONE card.** Tasks and events are never grouped into a shared box — the card *is*
  the task. No list-inside-a-card.
- **Action Button** → circular, dark (＋) or light (share)
- **Tab Toggle** → Weekly / Monthly, lavender active pill
- **Tags** → `#hashtag` metadata, muted
- **Tab bar** → black, four tabs, a **white rounded-square** marks the active one

---

## 6. Micro-interactions

- Transitions: **300ms ease-out**
- Button press: **scale 0.95**
- Card hover: subtle lift (**y −2px**)
- Entrance motion fires on **navigation only** — never on a data mutation, or the whole screen
  flashes on every tap.

---

## 7. Do NOT

Sharp corners · bright, saturated colours · cluttered layouts · heavy shadows · complex
patterns · small touch targets · inconsistent spacing · poor contrast ·
**emoji as functional icons** (lucide only; emoji belong in human copy).

> ⚠️ **Lemon is never a warning.** It's the day's hero (§2) — the app's affirmative
> tone. "You're carrying the most" got a lemon card once and it read as *good news*
> about an imbalance. This app has **no alert slab by design**: `danger` is a label,
> never a fill. State the problem in the sentence and offer the verb in a dark button.

> ⚠️ **Every scroller gets `overscroll-contain`.** Without it, hitting the end of the
> phone's inner list chains the scroll to the page and rubber-bands the whole device
> frame — which reads as the header "bouncing". The frame is furniture; it must never
> move. This bites the wheel pickers twice over, where scroll position *is* a value.

### Say it once

The tab is a column of cards and the reader pays for every line. A card must not
restate what an adjacent control already says:

- **Your load** opened with a display numeral, a 28px sentence, and a bar chart — three
  statements of "5". The bar was the only one carrying information.
- **Where you are** opened with "You're home today" directly above a chip row whose
  selected chip said `Home today`. The Sentence went; the chips stayed; the line under
  them now says the thing the chips *can't* — what the app will do about it.

The test: cover the prose. If the control still tells you the state, the prose was
decoration — spend those pixels on the consequence instead.

### State first, controls folded

**The app's one disclosure pattern: say what's true, then hide the machinery behind
`Adjust ⌄`.** The New Task sheet established it — one line of readback, chips folded
away "to correct a wrong guess, not to be filled in" — and **Where you are** now uses
the identical control, words, and chevron. Two disclosures that behaved differently
would be two things to learn.

Reach for it when a control's *resting* state is more useful than the control itself.
Presence is set once a day at most and often not at all, so four chips and a
quiet-hours row were 130px of permanently-open machinery. A picker that's open when
you're not using it isn't availability — it's furniture. (128px collapsed, 257 open.)

> ⚠️ **Folding controls away must never fold INFORMATION away.** A collapsed
> "You're away / nothing new lands on you" hides the one fact anyone wants: *until
> when?* — because the date's control went behind the fold with everything else. So
> the subtext absorbs it: "Back Monday. Nothing new lands on you." Before folding a
> control, ask what its *value* was telling people, and re-home that value first.
>
> This bit twice: quiet hours went behind the same fold, so a summary that said
> nothing about them left you opening a panel to check whether they were still on.
> The summary now carries them — **but only when set.** "No quiet hours" is a null
> fact, and a summary listing the settings you *haven't* touched is an inventory.

### No charts on the phone. Show the people; say the verdict.

**This is a home, and a seven-year-old has an account.** Your load went through two
rejected attempts, and they were the same mistake in different ink:

1. **A stacked bar with a legend.** The legend is the tell — it's a lookup table you must
   consult before the picture means anything. Swatch → name → share of a shared bar.
2. **Rows of dots.** Still a bar chart, just with gaps: marks on a shared baseline,
   ranked. "It's a tally, not a chart" was a story I told myself about a chart.

Both asked a child to read an encoding, and both turned the household into a
**leaderboard where Ada comes last with nothing**. A home does not rank its people.

The answer is the app's own language: **everyone's face, and the number of things they're
holding.** The number IS the count — no encoding to undo, no axis, no proportion, no
legend. `Avatar`/`Face` is what the persona switcher and every task card already use; the
load card was the one place that turned people into coloured rectangles.

> ⚠️ **Reading a chart IS mental load.** This app exists to absorb it. So the VERDICT goes
> in the subtext as a sentence — "Fairly shared right now", "Sam has the most right now" —
> because the Balancer already knows the answer (same `most - least >= 2` that gates "Even
> it out"). Drawing shapes and leaving the reader to compare them hands the work back.

**You are the headline; the house is the reference.** A flat row of four gave your number
the same weight as Leo's — on a card called *Your* load, reached from a tab called *You*.
Your face and count sit large on the left; everyone else stacks small to the right behind
a hairline. That hairline is what makes them read as "everyone else" instead of three more
list entries.

> ⚠️ **A bare number never says what it counts.** "6" above "Maya 5" could be points,
> stars, or days — the card never once said *tasks*. Name the unit **once**, on the hero
> stat ("6 tasks"); the column beside it inherits the unit by sitting in the same object.
>
> And once the block carries the count *and* the unit, the title can't repeat them:
> "5 things on your plate" over a block reading "5 tasks" says five twice and names the
> unit twice. The count is the block's job; the **verdict** is the title's.

Match the avatar to the stat stack so they read as one object — and **measure it**: the
arithmetic said 58 (34px numeral + 4 + 20px label), the DOM said 72, because a
baseline-aligned caption drags the numeral's line box up to its own line-height.

> ⚠️ **Never name the lightest person.** "More than anyone else — Ada has 0" points at the
> one member who *can't* help: the lightest is almost always the youngest, and the role
> floor means `rebalance()` wouldn't move that work to her either. It reads as "why isn't
> the seven-year-old doing more" — unkind, and factually wrong. State the imbalance; don't
> point at a child.

**The test: could a child point at it and read it without a key?** If it needs a legend, an
axis, or a percentage, it's a business dashboard — and the app has none of those anywhere
else. It speaks in people, sentences and pills.

The iPad's Insights screen is the deliberate exception: an owner-facing analytics surface
no kid opens, and "insights" is the one place a chart is the honest answer.

**White is not "task".** It's `card` — Secondary, the default surface; `TaskCard` is
white only because it passes no tone at all. Tasks read as tasks because of the dark
DateBadge stadium and the Done button, not the fill. So a settings-ish surface (the
You tab) using white cards is correct, and inventing a fourth tone to separate them
would cost the three-tone rule for a distinction the structure already makes.
