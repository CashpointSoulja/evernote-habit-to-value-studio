# Evernote Habit-to-Value Studio

**Independent concept by Ayo Ahmed for the Bending Spoons Growth manager role.** It uses synthetic data only and is not affiliated with, endorsed by, or connected to Evernote or Bending Spoons. Their names and logos belong to their owners.

The app has two parts:

1. **A first-session habit preview.** Pick a job, edit an original synthetic meeting note in an Evernote-like editor, turn selected lines into tasks, schedule a *simulated* revisit, and complete a task on a later day. It shows a blank-note baseline and a task-first, job-led journey side by side.
2. **A growth decision.** Import a seeded cohort CSV, validate and deduplicate it, then pre-register a contract. The analysis covers first value, seven-day repeat value, trial and paid conversion, refunds, cancellations and net revenue per eligible user. Results are segmented by acquisition source. The decision is **SCALE / ITERATE / REJECT / NO DECISION**, and you can export an evidence memo.

Four seeded cohorts show the decision rules working:

| Cohort | Decision |
|---|---|
| Healthy test | SCALE (next ramp step only) |
| Acquisition-mix reversal (Simpson's paradox) | ITERATE: aggregate +6.2 pp, fixed mix −2.3 pp |
| Conversion up, refunds up | REJECT |
| Biased / incomplete export | NO DECISION, with all 7 failed gates named |

Everything runs in the browser. There are no accounts, reminders, billing, trackers or paid services. Local state is not durable, shared or secure, and Reset and Export are in the UI.

## Run
```bash
npm install
npm test          # unit and scenario tests
npm run typecheck
npm run dev       # http://127.0.0.1:8787
```

## Docs
Start at [docs/index.md](docs/index.md). The brand guide ([docs/brand-design.md](docs/brand-design.md)) was written and committed before the app.

## Licence
MIT for the code in this repository. The Evernote and Bending Spoons logos in `public/brand/` are trademarks of their owners and are not covered by this licence.
