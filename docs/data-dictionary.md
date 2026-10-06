# CSV / event schema and data dictionary

Header (exact): `event_id,user_id,variant,assignment_seed,acquisition_source,event_type,occurred_at,amount,currency,note_id,task_id`

| Field | Type | Rule |
|---|---|---|
| event_id | string | Required. Unique. An exact duplicate row is counted once. A reused ID with different content is quarantined |
| user_id | string | Required. Users are defined only by `assigned` rows |
| variant | enum | `baseline` or `task_first` |
| assignment_seed | string | `experiment:phase:percent`, percent 1–99 |
| acquisition_source | token | `^[a-z][a-z0-9_]*$` (e.g. organic_search, paid_social, app_store, referral) |
| event_type | enum | assigned, note_saved, task_created, revisited, task_completed, trial_started, paid, refunded, cancelled |
| occurred_at | ISO 8601 | With Z or offset, e.g. `2026-08-03T09:04:00Z` |
| amount | decimal | Required and > 0 with ≤ 2 decimals for paid and refunded. Empty or 0 otherwise |
| currency | ISO 4217 | Required for money events. One currency per cohort. Fixtures use XTS |
| note_id | string | Required for note_saved |
| task_id | string | Required for task_created and task_completed |

## Cross-row rules
- An event before the user's assignment is quarantined.
- An event for a user with no assignment row is quarantined and counted as an orphan (completeness gate).
- A refund with no prior payment, or larger than the user's remaining paid amount, is quarantined.
- A `task_completed` for a task never created is quarantined.
- A user seen with both variants is a crossover. They stay in their first arm (ITT) and are counted in the assignment gate.
- A recorded variant that disagrees with the hash is an assignment conflict.

## Seeded fixtures (`public/fixtures`, regenerate with `npm run fixtures`)
| File | Built to show | Expected decision |
|---|---|---|
| healthy.csv | Repeat-value gain in every source, plus 6 dirty rows | SCALE |
| simpson.csv | 20% ramp in paid-social-heavy days, then 80% ramp in organic/referral-heavy days. Small negative within-source effect | ITERATE (aggregate +6.2 pp, fixed mix −2.3 pp) |
| guardrail.csv | Trial and paid up. Refunds, cancellations and repeat value worse | REJECT |
| biased.csv | Recent cohort, refunds missing from the export, dropped baseline assignments, crossover | NO DECISION (7 gates) |
