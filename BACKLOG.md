# Backlog

Gaps identified in the whole-app review (2026-07-20), to revisit. The three
**In progress** items were judged the highest-leverage starting set; everything
under **Deferred** is real but either foundational (needs infra), a larger design
surface, or lower ROI for a portfolio build right now.

## In progress (this pass)

- [ ] **Reduced-motion** — honor `prefers-reduced-motion` across the framer-heavy
  UI (`MotionConfig reducedMotion="user"`). Cheap credibility/a11y win.
- [ ] **Conflict detection** (Kernel: Anticipator / Conflict Resolver) — surface
  same-person time overlaps and work assigned to someone who's away, with a
  resolve action. The product-thesis differentiator; currently unbuilt.
- [ ] **Event create + delete** — close the most obvious CRUD holes. (`+ Add`
  only makes tasks today; `EventSheet` is view-only; no delete on anything.)

## Deferred — revisit

### Foundational
- [ ] **Real sync / backend / accounts.** The two "devices" share one
  localStorage store; nothing syncs between actual devices. This is the
  foundation for a genuinely "complete" multi-device experience.
- [ ] **Async notification layer.** Notifications are toasts + the activity feed
  only — no real push, so a kid's phone doesn't buzz when assigned. Quiet hours
  are modeled but gate nothing (no delivery layer to gate).

### Kernel processes still missing
- [ ] **Scheduler** — suggest *when* to do a task / find a free slot. "When" is
  free text a human types; nothing proposes a time.

### CRUD / editing depth
- [ ] **Recurring edit: this vs. all occurrences.** Needs a real recurrence
  engine (rule + materialized instances + exceptions); `recurring` is a string
  label today. Deliberately split out of the create/delete pass.

### Coordination
- [ ] **Comms on items** — comments, person-to-person nudges, reactions,
  lightweight notes on a task/event. Households coordinate by talking; the app
  has handoff but no back-and-forth.

### Integrations
- [ ] **Calendar import** (Google/Apple) and a **real email-for-bills** source.
  The "bills from email" automation is UI-ready with no inbox behind it.

### Polish / a11y
- [ ] **VoiceOver labeling + Dynamic Type audit.** Reduced-motion is being wired
  now; the rest of the a11y pass is separate.
- [ ] **Full-domain search on phone.** Phone search is scoped to Ahead
  (tasks+events); the iPad's `searchAll` spans every domain.

### Ambient / glanceability
- [ ] **Standby / ambient mode** for the always-on family iPad; **home-screen
  widgets** for phones — the natural surface for a household app (out of reach
  in this stack, but part of the "complete experience" picture).

### Insights
- [ ] **Trends over time** — the app computes a 30-day finish rate and
  contribution, but no history/trajectory that would make it feel like it *knows*
  the household over months.
