# Transparent analysis and statistical caveats

- **Synthetic.** Every number comes from seeded generators. Nothing describes real users.
- **Intervals are descriptive.** Wilson intervals for single rates and normal-approximation intervals for differences, at 95%. There is no multiple-comparison correction across the 7 metrics and 4 segment views. Only the primary metric drives SCALE.
- **No p-values are reported** except the SRM χ² threshold, which is a data-quality check, not an effect test.
- **Small payer counts.** Refund and paid metrics rest on dozens of payers. That is why the refund guardrail uses the eligible-user denominator (ADR-004).
- **Fixed-mix standardisation** reweights each arm's segment rates to the pooled source mix. It corrects for observed mix only, not for unobserved differences, and it excludes sources present in one arm (listed in the UI).
- **Mature window.** Users whose window is not complete are excluded. Data as-of is the latest valid event, which assumes the export was taken then.
- **Net revenue over 14 days is not LTV.** Later refunds and renewals are not observed.
- **Repeat value is a proxy.** Its link to retained paid use is a hypothesis.
- **Thresholds were chosen for a demo.** In production, sample size should come from a power calculation on real baseline rates.
