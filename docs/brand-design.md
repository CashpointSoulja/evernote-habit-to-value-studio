# Brand and design guide

Evernote Habit-to-Value Studio is an independent concept by Ayo Ahmed. It uses synthetic data and is not affiliated with, endorsed by, or connected to Evernote or Bending Spoons. Both brands and logos belong to their owners. They appear here only to identify the product being discussed and the role this audition is for.

This guide was written before any application code. Every value below was read from the public sites on 6 Oct 2026. Nothing was guessed from memory.

## 1. Two brands, two jobs

| | Evernote | Bending Spoons |
|---|---|---|
| Role in this prototype | Shapes the **functional preview**: the note editor, task list, sidebar and light workspace | Shows **who the audition is for**: header context strip, docs cover, and the closing frame of the video |
| Where it appears | Note/task preview (the main part of the app) | A thin context bar at the top, plus the footer |
| Logo source | `https://evernote.com/_next/static/media/evernote-logo.86b04f42.svg` (wordmark) and `https://evernote.com/images/evernote-logo-ios.png` (app icon) | `https://bendingspoons.com/_next/static/media/bsp-logotype.0a3.jbkx-aafu.svg` (logotype) |
| Local copy | `public/brand/evernote-logo.svg`, `public/brand/evernote-logo-inverted.svg`, `public/brand/evernote-app-icon.png` | `public/brand/bending-spoons-logotype.svg` |
| Must never look like | An official Evernote screen, login, or billing page | A Bending Spoons product or careers page |

Logos are used unaltered: no recolouring, stretching or merging. They always appear next to the label **"Independent concept · synthetic data · not affiliated"**. The Bending Spoons logotype is a white-filled SVG, so it is only placed on the dark ink background (`#141415`).

## 2. Evidence observed

### evernote.com (home and /templates)
- Hero copy: "Your second brain — Remember everything and tackle any project with your notes, tasks, and schedule all in one place."
- The feature list names **Templates**, **Notebooks & Spaces**, **Search**, **Tasks** and **Calendar** as existing features. This prototype does not present templates or tasks as new ideas.
- Type: `Inter` is the main UI face (28 declarations in the shipped CSS), and `Figtree` is the secondary display face.
- Colour tokens from the shipped CSS:
  - Brand green `primary-400`: `#00A82D` (rgb 0 168 45). Used for focus rings, borders and the main CTA.
  - Deep green `primary-600`: `#005611`.
  - Light green `primary-100`: `#E6F9E9`.
  - Accent lime: `#94E130`.
  - Warm page background `--color-bg-primary`: `#F9F6F2`. Secondary background: `#F4EEE5`.
  - Text: primary `#141414`, secondary `#262626`, tertiary `#4E4D4C`.
  - Card stroke `--color-stroke-cards`: `#E7E7E7`. Button stroke: `#A1A1A1`.
  - Secondary accents: blue `#4D64FF`, yellow `#F4C360`, purple `#A158EB`.
- Shape: 16px radius on cards, 4–10px on controls, pill (100px) on tags. Shadows are very soft warm-brown layers (`rgba(89,63,25,0.04)`).
- Focus: a 4px halo, `0 0 0 4px rgba(0,168,45,0.2)`.

### bendingspoons.com
- Title: "Bending Spoons | Impossible. Maybe." Hero: "We acquire and improve iconic products".
- The portfolio lists Evernote ("Acquired January 2023").
- Type: `Instrument Sans` (UI), `Instrument Serif` (editorial display), `Fragment Mono` (data/labels). Tight tracking (`-0.02em`).
- Colour: ink `#141415`, near-black `#252525`, grey `#5D5E63`, signature lime `#C7FF9F`, light surfaces `#F5F5F5` and `#F6F6F6`.

### Help-centre pages
`help.evernote.com` returned HTTP 403 to automated fetches, so no screenshots were taken from it. The task and template behaviour referenced in the docs relies on the public article titles and URLs in the spec, plus the evernote.com feature list. No private app content was copied.

## 3. Design tokens used in the app

```css
--en-green: #00A82D;       /* Evernote primary-400 */
--en-green-deep: #005611;  /* Evernote primary-600: text on light green */
--en-green-tint: #E6F9E9;  /* Evernote primary-100 */
--en-paper: #F9F6F2;       /* Evernote bg-primary */
--en-paper-2: #F4EEE5;     /* Evernote bg-secondary */
--en-ink: #141414;  --en-ink-2: #262626;  --en-ink-3: #4E4D4C;
--en-stroke: #E7E7E7;
--en-blue: #4D64FF;  --en-yellow: #F4C360;
--bs-ink: #141415;  --bs-lime: #C7FF9F;  --bs-grey: #5D5E63;  /* context strip only */
--danger: #B42318;         /* status colour (not from either brand), AA on white */
```

Fonts: Inter for the app, Instrument Serif for editorial headings in the analysis "memo" view, and a mono stack for data. They load from Google Fonts with system fallbacks, so the app works offline and with no third-party font. No font files are redistributed.

## 4. Layout

The note preview copies the *structure* of a desktop note app, not its pixels: a left sidebar (notebook and task list), a note list, an editor with a title and body lines, and a task panel. On screens under 760px wide, these become a single column with tabs. The internal growth analysis is a separate tab on the same warm paper background. It uses white cards with a 16px radius, not a dark dashboard.

## 5. Accessibility rules
- Text contrast is at least 4.5:1. `#00A82D` on white is about 3.2:1, so green is used only for large text, borders, icons and focus rings. Green text uses `#005611`.
- Every interactive element is reachable by keyboard, with the Evernote-style green halo as its visible focus state.
- Status is never shown by colour alone. Decisions show a word (SCALE / ITERATE / NO DECISION / REJECT) and the reason.
- Respects `prefers-reduced-motion`.

## 6. Labelling rules
- The persistent top strip reads: "Independent concept by Ayo Ahmed for the Bending Spoons Growth manager role · Synthetic data only · Not affiliated with Evernote or Bending Spoons."
- The upgrade preview says "Preview only. Nothing is purchased." It shows a synthetic price with the label "synthetic price, not an Evernote plan".
- The footer credits Ayo Ahmed as an independent concept only.

## 7. Visual guide
See `public/brand-guide.html` (served at `/brand-guide.html`). It shows logos with their source URLs, swatches, type specimens and component samples.
