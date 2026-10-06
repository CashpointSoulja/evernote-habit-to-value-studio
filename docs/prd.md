# PRD: Evernote Habit-to-Value Studio
6 Oct 2026 · Independent concept by Ayo Ahmed · Synthetic data

## Problem and role
The Bending Spoons Growth manager role covers understanding, analysis, ideas, experiments and scaling winners ([posting](https://jobs.bendingspoons.com/positions/66ba2d6da8ca8044583802ff)). Evernote is an official portfolio product ([bendingspoons.com](https://bendingspoons.com/)). Notes, templates and tasks are established Evernote features. **Hypothesis:** a job-led note-to-task first session may give new users a stronger reason to return before any monetisation prompt. No internal data or interviews show that the current onboarding has a defect, and this document does not claim one.

## Users / JTBD
- **New note user**: turn meeting notes into concrete next actions and find them again when needed.
- **Growth manager**: tell real incremental repeat utility and economics apart from headline conversion and acquisition mix.
- **Product, design, engineering**: inspect the proposed journey and its event contract before anything is built.

## Working scope (v1)
An interactive, original synthetic meeting note. Selected lines become editable tasks, then a simulated revisit, then cohort experiment analysis and an evidence export. **Not** a production task system, a general analytics suite, an Evernote clone, a live billing tool or an AI note-taker.

## Acceptance criteria and where each is met
| # | Criterion | Implementation | Test |
|---|---|---|---|
| 1 | CSV validates IDs, variants, timestamps, source, conversion, money and refunds. Invalid rows are quarantined and duplicates counted once | `validate`, `buildCohort` in `public/engine.js`. Step 2 lists every quarantined row with its reason | `test/engine.test.ts` › validation |
| 2 | Edit note, create and complete tasks. Local state persists honestly and reset works. Nothing sends | `public/app.js` preview, localStorage notice, Reset, Export | browser smoke (test-strategy-results.md) |
| 3 | Stable user assignment, ITT denominator, sample/window/guardrails shown before analysis | Step 3 "Pre-registered contract", applied by "Lock contract and analyse" | assignment tests |
| 4 | First-value and repeat-value definitions are editable, labelled hypotheses | Contract form, tab 3, sidebar labels | outcome tests |
| 5 | n, rates, absolute differences, mature windows, net revenue per eligible user, synthetic prices | Step 4 table. Currency XTS (ISO 4217 test code) | scenario tests |
| 6 | Acquisition-mix reversal with segments, fixed-mix comparison and a warning | `simpson.csv`, step 5 | Simpson test |
| 7 | Conversion up, refunds up, repeat value down → reject. Low n, bad assignment or incomplete cohort → no decision | `guardrail.csv`, `biased.csv` | scenario tests |
| 8 | Memo with contract, evidence, gates, decision and limitations. No fabricated ROI or p-value | `memo()`, Export evidence memo | memo test |

## Justified changes from the supplied PRD
1. **Refund guardrail denominator.** The guardrail uses refunded users per *eligible* user, not per payer. Payer counts are small (20–70 per arm), so a per-payer rate swung by 10+ pp on one or two refunds and produced false REJECTs. The per-payer rate is still shown for context. See ADR-004.
2. **Assignment seed format** `experiment:phase:treatmentPercent`. This makes stable assignment checkable from the row alone, and it lets a ramp (20% → 80%) be represented honestly. The Simpson scenario uses exactly that ramp. See ADR-003.
3. **Synthetic currency XTS.** XTS is the ISO code reserved for testing, so no amount can be mistaken for an Evernote price.
4. **Upgrade preview timing differs by journey.** Baseline shows it after the first save. Task-first shows it only after repeat value. This makes "repeat utility before monetisation" visible as the actual difference between the journeys.

## Metrics / event contract
See [experiment-metrics-contract.md](experiment-metrics-contract.md) and [data-dictionary.md](data-dictionary.md).

## Sources
See [sources-role-map.md](sources-role-map.md).
