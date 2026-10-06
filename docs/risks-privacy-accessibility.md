# Risks, privacy and accessibility

## Risks
| Risk | Mitigation |
|---|---|
| Mistaken for an official Evernote or Bending Spoons product | Persistent context strip, footer, brand guide labels, page metadata |
| Numbers read as real results | "Synthetic" on every surface. XTS test currency. Memo limitations |
| Pushy upgrade pattern | Plan preview only after repeat value (task-first). Equal-weight "Not now". Price shown in full. No purchase path |
| Over-trusting a lift | Gates, guardrails and fixed-mix checks block SCALE |

## Privacy
- No server storage. The Worker serves static files and `/api/health`. CSP sets `connect-src 'self'`.
- State lives in localStorage. The UI says it is not durable, not shared and not secure.
- Uploaded CSVs are parsed in the browser and never sent anywhere.
- No analytics, trackers or cookies. Google Fonts is the only third-party request, and it is used for typefaces only.

## Accessibility (implemented)
- Skip link, landmarks, ARIA tabs with arrow/Home/End keys, a radio group for the job chooser.
- Visible 4px green focus halo. Text contrast ≥ 4.5:1 (green text uses #005611).
- Status messages through an `aria-live` region. The confounding warning uses `role=alert`.
- Decisions are shown as words and reasons, never colour alone. Bars are decorative (`aria-hidden`), and the table carries the data.
- 40px+ targets. Single column under 760px. Respects `prefers-reduced-motion`.
