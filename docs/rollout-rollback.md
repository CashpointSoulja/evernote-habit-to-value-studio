# Rollout and rollback

1. **Usability tests** of both journeys (discovery plan).
2. **Shadow instrumentation**: emit the contract events with no UI change. QA them against this tool's gates.
3. **Controlled experiment** at a small ramp with a pre-registered seed, n, windows and guardrails. Keep allocation fixed while traffic mix may shift, or stratify by source.
4. **Decision** with the rules in experiment-metrics-contract.md. SCALE means the next ramp step only.
5. **Monitor** the same guardrails at each step.

**Rollback triggers:** any guardrail regression, SRM, or an event-pipeline gap. Roll back to baseline immediately. Do not keep users in a worse flow to chase conversion.
