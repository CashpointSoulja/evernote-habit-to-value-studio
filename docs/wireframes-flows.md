# Wireframes and flows

## Preview (desktop ≥ 1020px)
```
┌ context strip: Bending Spoons logotype · independent concept · synthetic · not affiliated ┐
│ Habit-to-Value Studio                       [1 Preview] [2 Analysis] [3 Contract]        │
├──────────────────────────────────────────────────────────────────────────────────────────┤
│ (Baseline)(Task-first)     [Simulated day N]           [Export local] [Reset local]      │
│ local-state notice                                                                        │
│ [job chooser: meeting | idea | web]   (task-first only, before the first save)            │
│ [cue banner after a simulated revisit]                                                    │
│ ┌sidebar──────┐┌editor──────────────────────┐┌tasks─────────────────────┐               │
│ │Notes/Tasks  ││Title                       ││☐ task (from line 3)      │               │
│ │metrics ✓    ││Body                        ││+ add task                │               │
│ │             ││[Save]                      ││Next session: [day ▾]     │               │
│ │             ││☐ line … [Turn into tasks]  ││[Schedule][Simulate]      │               │
│ └─────────────┘└────────────────────────────┘│Plan preview (after RV)   │               │
│ ▸ Session event log                           └──────────────────────────┘               │
│ Baseline vs task-first comparison                                                        │
```
Under 1020px the tasks column moves below. Under 760px everything is one column and the sidebar becomes a counter row.

## Analysis flow
`Import (fixture | upload) → Validate (counts, quarantine) → Contract (editable, locked on run) → Gates + outcomes → Segments (metric ▾, fixed mix, warning) → Guardrails + decision → Export memo / quarantine CSV`

## Decision tree
```
schema ok? ─no→ NO DECISION
gates pass? ─no→ NO DECISION (list every failed gate)
guardrails pass? ─no→ REJECT
mix confounding? ─yes→ ITERATE
primary lower bound > 0 and fixed-mix > 0? ─yes→ SCALE (next ramp step) ─no→ ITERATE
```
