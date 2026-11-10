# Homeboard

**"Mom", "Dad", "Kid" and "Roommate" are relationships. They must never
determine permissions.**

A shared household board built on that one refusal. Relationships describe how
people feel about each other; they are not an access model, and every home
they get wrong is a real one — the teenager who runs the family budget, the
grandparent who lives with you and shouldn't be locked out, the au pair who
needs the school run but not the bank account.

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # 118 tests across 5 files
npm run typecheck
```

| Route | What it is |
|---|---|
| `/` | The board |
| `/case-study` | How it was designed, and the eight directions explored |

---

## The user model — four things, never mixed

Nothing in the codebase may collapse these into each other:

| | Question | Where it lives |
|---|---|---|
| **Household type** | How does this home *work*? | `HouseholdAxes` |
| **Identity** | Who *is* this? | `Member.kind`, `name`, `age` |
| **Role** | What may they *do*? | `Member.role` — `owner` / `full` / `limited` / `guided` |
| **Responsibility** | What do they *look after*? | `Responsibility` — domains and scope |

**Role is assigned, never derived.** No code may write
`age < 18 ? "limited" : "full"`, infer access from a relationship or a preset,
or take it from list position (`i === 0 ? owner`). `setRole` is the only path a
role changes by. A 15-year-old may hold `full`; a 40-year-old may be `guided`
after an illness.

## The design doc is binding

[DESIGN.md](DESIGN.md) is 40,000 characters and it is not a mood board. *"If a
value isn't in this document, it doesn't go in the code."* It decides tone with
the same care it decides spacing — "say the kind thing, it's usually the true
one" sits in the same file as the 2px grid and the rule that metadata is not
texture.

## The case study can't quietly go stale

The numbers that page prints — file counts, test counts, the size of this very
doc — are not typed by hand. `npm run facts` computes them from the working
tree into a generated module, and `tests/facts.test.ts` recomputes them and fails if
the file has drifted. A figure can't rot quietly, because the suite notices.

```
src/           app, components, model, case-study
app/           routes
design/        the visual direction work
scripts/       facts.mjs — repo numbers, generated
tests/         vitest
```

## Docs

- [DESIGN.md](DESIGN.md) — binding design guidelines, tone through to tokens
- [BACKLOG.md](BACKLOG.md) — what was deliberately deferred, and why

## Stack

Next.js 16 (App Router) · React 18 · TypeScript strict · Tailwind v3 ·
Framer Motion · Poppins · Vitest
