# Test strategy and results

Run on 6 Oct 2026 against commit-local code. Node 22, Chrome 137.

## Automated (`npm test`, `npm run typecheck`)
`test/engine.test.ts`: **20 tests, all passing**. `tsc --noEmit`: **clean**.

| Required case | Covered by |
|---|---|
| Duplicate users / events | exact duplicate counted once. Conflicting `event_id` reuse quarantined. Duplicate assignment rows counted once |
| Variant crossover | crossover users kept in first arm, assignment gate fails |
| Assignment hash conflicts | conflict counted, gate fails above 1% |
| Malformed money / timestamps / currency | quarantined with reasons. Mixed currency quarantined |
| Zero denominators | `rate(0,0)` → null, rendered "n/a" |
| Negative net revenue | refunds > payments within a window → negative net, guardrail fails |
| Invalid refunds | refund without payment, or larger than paid → quarantined |
| Immature windows | immature users excluded. Maturity gate fails above 25% |
| Acquisition-mix confounding | `simpson.csv` → ITERATE, fixed mix opposite sign |
| Guardrail failure | `guardrail.csv` → REJECT |
| Biased / incomplete export | `biased.csv` → NO DECISION with 7 failed gates |
| SRM, low sample, orphans, pre-assignment events | dedicated tests |
| Memo export | contains contract, gates, decision, limitations. No p-value or ROI |

## Browser (Playwright against `wrangler dev`, desktop 1366×900 and mobile 390×844)
| Check | Result |
|---|---|
| Task-first path: job → edit → save → 3 lines to tasks → schedule day 2 → simulate → complete | First value and repeat value reached. Plan preview appears only after repeat value |
| Note and task persistence across reload | 3 tasks restored |
| Reset local data | 0 tasks. Job chooser shown again |
| Export (local JSON / events CSV / memo / quarantine) | downloads produced |
| Four seeded cohorts in the UI | SCALE / ITERATE / REJECT / NO DECISION |
| Console or page errors | none |
| Keyboard | skip link first. Arrow keys move tabs. Enter picks a job. Ctrl+S saves. Space ticks a line. Enter adds a task |
| Labels / alt / overflow on mobile | 0 unlabelled controls, 0 images without alt, no horizontal overflow, no buttons under 30px |
| Focus ring | 4px green halo |

**Found and fixed during testing:** on mobile, the task text and the note title were clipped (single-line inputs, grid min-width). They are now auto-sizing textareas with `minmax(0,1fr)` columns.

**Not tested:** screen-reader output with an actual screen reader, Safari/Firefox, and GitHub Pages hosting (not enabled yet).
