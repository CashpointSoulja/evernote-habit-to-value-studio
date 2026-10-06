# Discovery, interviews and validation plan

**No research has been done. Nothing here is a finding.**

## Questions
1. What do new users try to do in their first session? Is "turn meeting notes into actions" a frequent first job?
2. Do users who create a task in session one come back more often than users who do not, after controlling for acquisition source?
3. Does a job prompt add friction for people who mainly want archival capture?

## Methods
| Method | Sample | Output | Falsifies the hypothesis if… |
|---|---|---|---|
| Interviews with returning and non-returning new users (consented, recruited via an approved panel) | 8–12 per group | First-session job map | Few users name action extraction as a job |
| Unmoderated usability test of the two preview journeys | 10 per journey | Task success, time, stated friction | The job step lowers completion or users skip it |
| Retrospective analysis (approved analytics only) | Historic cohorts | Task-in-session-1 vs day-2–7 return, by source | No association once source mix is held constant |
| Shadow instrumentation | Production, no UI change | Event QA against the contract | Events cannot be captured reliably |
| Controlled experiment | Pre-registered n | Decision via this tool's rules | Guardrails fail or the fixed-mix effect ≤ 0 |

## Interview guide (draft)
- "Tell me about the last time you took notes in a meeting. What happened to them afterwards?"
- "Show me how you found something you needed from those notes later."
- Avoid leading questions about tasks or templates until the end.

## Ethics
Consent, no recordings without permission, no personal data in this repo, and compensation according to panel policy.
