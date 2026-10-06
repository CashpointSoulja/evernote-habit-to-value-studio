# Experiment and metrics contract

All metrics are **provisional hypotheses**, not Evernote KPIs. Defaults live in `DEFAULT_CONTRACT` in `public/engine.js`. The editable ones appear in analysis step 3 and are written into the memo.

| Item | Definition (default) |
|---|---|
| Randomisation unit | User |
| Assignment | `fnv1a(assignment_seed + "|" + user_id) % 100 < treatmentPercent` → `task_first`, otherwise `baseline`. The seed is `experiment:phase:percent` |
| Eligible user | Has an `assigned` row. Counted once, in the arm of the first assignment row (intent-to-treat) |
| Mature user | `assigned_at + max(repeat window, revenue window) ≤ data as-of` (the latest valid event time) |
| First value | `note_saved` and ≥ 1 `task_created` within 24 h of assignment |
| Repeat value (primary) | A `revisited` and a `task_completed` on the same later day, day 1 to < day 7 |
| Trial / paid | `trial_started` / `paid` within 14 days. Reported separately |
| Net revenue per eligible user | (Σ paid − Σ refunds within 14 days) ÷ mature eligible users. Synthetic XTS. Not LTV |
| Uncertainty | Wilson 95% for single rates. Normal-approximation 95% for differences |

## Gates (any failure → NO DECISION)
| Gate | Rule |
|---|---|
| schema | All 11 columns present |
| quality | Quarantined rows ≤ 5% |
| complete | Events from users with no assignment row ≤ 1% |
| events | All 9 event types present (missing revenue, refund or cancel data means guardrails cannot be read) |
| assignment | Hash conflicts ≤ 1% and crossover users ≤ 1% |
| srm | Per seed, χ² vs expected split ≤ 10.83 (1 df, α = 0.001) |
| maturity | Immature users ≤ 25% |
| sample | ≥ 150 mature users per arm |

## Guardrails (any failure → REJECT)
- Repeat value change > −1.0 pp
- Refunded users per eligible user change ≤ +1.0 pp
- Cancellation change ≤ +2.0 pp
- Net revenue per eligible user not lower than baseline, and no arm with negative total

## Decision
- **SCALE**: gates and guardrails pass, the primary metric's 95% lower bound > 0, and the fixed-mix difference > 0. This means the next ramp step only.
- **ITERATE**: acquisition-mix confounding detected on repeat value, trial or paid (mix distance ≥ 10%, and the fixed-mix effect reverses or is less than half the aggregate), or the primary effect does not clear zero.
- **REJECT**: a guardrail failed.
- **NO DECISION**: a gate failed. Every failed gate is listed.
