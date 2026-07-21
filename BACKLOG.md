# Backlog

Gaps identified in the whole-app review (2026-07-20), to revisit. The three
**In progress** items were judged the highest-leverage starting set; everything
under **Deferred** is real but either foundational (needs infra), a larger design
surface, or lower ROI for a portfolio build right now.

## Done (since the review)

- [x] **Reduced-motion** — `MotionConfig reducedMotion="user"` wired across the UI.
- [x] **Conflict detection** (Anticipator / Conflict Resolver) — same-person time
  clashes + work stranded on someone away, each with a resolve action (cover /
  reschedule).
- [x] **Task + event CRUD, full.** `+ Add` is one composer that infers task vs
  event; every task and event is editable (same composer, pre-filled) and
  deletable with undo.
- [x] **Adjacent wins not on the original list:** cover-while-away confirmation,
  reschedule flow (notify in-household / draft-to-copy for outside), unified
  add flow, hand-off scoped to today + overdue with expandable detail, add
  defaults to the adder.
- [x] **Comms on items** — threaded comments on any task/event (author = the
  viewer, logged to Activity). @mentions/reactions left as follow-ups.
- [x] **Calendar import (mock connect)** — Google/Apple connect flow drops a
  canned batch of provider-badged events; idempotent, disconnect-with-undo.
  A *real* inbox/OAuth source is still deferred (see Integrations).
- [x] **Full-domain phone search** — a header search on every phone tab, the
  iPad's `searchAll` across all domains + people, tapping through to sheets.
- [x] **Trends over time** — `weeklyTrend` + a bar chart, 8 weeks household +
  per-person; fixed the mislabeled all-time "Last 30 days" figure.

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
- [ ] **@mentions / reactions on comments** — the thread ships; nudging a
  specific person from it (and lightweight reactions) is the follow-up.

### Integrations
- [ ] **Real email-for-bills + real calendar sync.** The "bills from email"
  automation and the calendar connect are both mocks (UI-ready, canned data);
  a genuine inbox/OAuth source behind them is future work.

### Polish / a11y
- [ ] **VoiceOver labeling + Dynamic Type audit.** Reduced-motion is done; the
  rest of the a11y pass is separate.

### Ambient / glanceability
- [ ] **Standby / ambient mode** for the always-on family iPad; **home-screen
  widgets** for phones — the natural surface for a household app. (Confirmed
  not buildable as a *real* OS widget in this web stack; the iPad standby view
  is buildable and deferred by choice this round.)
