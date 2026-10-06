# User stories and acceptance criteria

1. **As a new user, I pick "Turn meeting notes into next actions"** and a synthetic meeting note opens. *AC:* the other jobs open a blank note and say they are out of scope.
2. **As a new user, I edit the note and save it.** *AC:* a `note_saved` event is logged with simulated time. Ctrl/⌘+S works. The state survives a reload.
3. **As a new user, I tick lines and turn them into tasks.** *AC:* one task per line, linked to its line number. The note text is unchanged. Tasks are editable and deletable. Tasks under 3 words are flagged as not counting toward first value.
4. **As a new user, I schedule and simulate a revisit.** *AC:* the select only offers later days. The cue says it is simulated. No notification is ever sent.
5. **As a new user, I complete a task on the revisit day.** *AC:* repeat value shows as reached. Only then does the task-first plan preview appear. It says nothing is purchased, and "Not now" has the same weight as the other button.
6. **As a growth manager, I import a CSV.** *AC:* counts, quarantined rows with reasons, and duplicates counted once are shown before any result.
7. **As a growth manager, I lock a contract and analyse.** *AC:* gates, n, rates, pp differences, intervals and net revenue per eligible user are shown.
8. **As a growth manager, I segment by source.** *AC:* segment k/n, arm mix, aggregate vs fixed-mix, and a warning when they disagree.
9. **As a growth manager, I get a decision with reasons and export a memo.** *AC:* the memo includes the contract, gates, results, guardrails, segments, quarantine, decision and limitations.
10. **As anyone, I reset or export local data.** *AC:* reset clears both journeys and the analysis. Export gives JSON (state) and CSV (event log).
