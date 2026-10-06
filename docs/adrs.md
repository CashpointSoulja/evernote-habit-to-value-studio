# Architecture decision records

**ADR-001: Static assets on a Cloudflare Worker, no backend state.** Free tier, public, no data to protect. The Worker adds security headers and `/api/health`.

**ADR-002: One plain ES module engine shared by browser and tests.** `public/engine.js` has no dependencies, so the logic tested in Vitest is exactly the code that runs in the UI.

**ADR-003: Seed encodes the allocation (`exp:phase:percent`).** Lets each row be checked against a stable hash, supports ramps, and makes SRM per seed well-defined. Alternative rejected: a global 50/50 assumption, which would hide ramp confounding.

**ADR-004: Refund guardrail on the eligible-user denominator.** With 20–70 payers per arm, refunds per payer moved by 10+ pp from one or two events. This failed the healthy and Simpson fixtures for noise reasons. The eligible-user rate is consistent with ITT. The per-payer rate is still displayed.

**ADR-005: Decision precedence NO DECISION > REJECT > ITERATE > SCALE.** Data you cannot trust overrides everything. A harmful guardrail overrides a confounded or positive result.

**ADR-006: Simulated clock instead of real time or notifications.** It makes repeat value demonstrable in one sitting without sending anything.

**ADR-007: Deterministic fixtures from a seeded PRNG.** They can be reproduced and reviewed (`npm run fixtures`), and the tests pin their expected decisions.
