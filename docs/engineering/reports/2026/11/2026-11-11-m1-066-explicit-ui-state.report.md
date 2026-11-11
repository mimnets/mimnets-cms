# m1-066 — Implicit state machines: survey, and two made explicit

| | |
|---|---|
| **Task** | m1-066 |
| **Date** | 2026-11-11 |
| **Scope** | Find the implicit state machines in the site; fix the ones whose scattered state causes wrong behaviour; leave the rest, with reasons |
| **Prompt** | [2026-11-11-m1-066-explicit-ui-state.prompt.md](../../../prompts/2026/11/2026-11-11-m1-066-explicit-ui-state.prompt.md) |
| **Branch / commits** | `fix/m1-066-explicit-ui-state`, from `origin/main` (`102a9a6`); one commit (D-GIT-69) |

Checks marked agent-executed were run by the agent. They are not human approval.

## Survey

| Where | States | Verdict |
|---|---|---|
| Contact form submit (`modules/@apostrophecms/form-widget/ui/src/index.js`) | idle, sending, sent; plus "no answer within 30 s" | **Changed.** State was spread over a busy attribute, spinner class, button `disabled`, thank-you and hidden classes. Fault: after a timeout the visitor could retry; if the first request then succeeded late and the retry failed (for example 429), an error appeared next to the thank-you message |
| Slideshow autoplay (`modules/assurer-slideshow-widget/ui/src/index.js`) | running, paused by pointer, paused by focus | **Changed.** One timer for two pause reasons. Fault: with keyboard focus inside, moving the pointer out restarted autoplay (WCAG 2.2.2 risk) |
| Main menu (`modules/asset/ui/src/nav.js`) | menu open/closed, at most one submenu open | Kept. `aria-expanded` is already the single source of state, readable by assistive tech, tests and agents |
| Gallery lightbox (`modules/assurer-gallery-widget/ui/src/index.js`) | closed, open at image *n* | Kept. The native `<dialog>` holds open/closed; `current` is the only other state |
| Form notification (`modules/assurer-forms/index.js`) | pending, sent, failed, disabled; attempts | Kept. Already an explicit, documented, stored status with a bounded retry task and tests |
| Installer and entrypoints (`docker/staging/*.sh`) | install steps 0 to 9 | Not touched: production install path, outside this task's approval |
| Draft/published, submission keys | Apostrophe core and documented server logic | Not touched |

## Changes

| File | Change |
|---|---|
| `modules/@apostrophecms/form-widget/ui/src/index.js` | One `state` (`idle`, `sending`, `sent`) and one `setState()` that owns every visible effect (busy attribute kept for upstream compatibility, spinner, button). `sent` is final: later answers and submits are ignored. The state is shown as `data-assurer-form-state` on the wrapper for styles, tests and agents. Messages and server contract unchanged |
| `modules/assurer-slideshow-widget/ui/src/index.js` | Autoplay runs only while no hold is active (`pointer`, `focus`). Focus moving between the slideshow's own controls keeps the hold |

## Results (agent-executed)

| Check | Result |
|---|---|
| `npm run lint` | PASS |
| `npm run test:unit` | PASS, 101/101 |
| `npm run test:smoke` | PASS, 18/18 |
| `npm run test:workflow` | PASS, 15/15 |
| `npm run test:persistence` | PASS, 7/7 |
| `npm run test:forms` | PASS, 56/56, 4 skipped (retention deletion needs a disposable database) |

## Browser checks (Chrome, localhost:3000, logged out, 1440 px; agent-executed)

| Check | Result | Steps and actual result |
|---|---|---|
| Form starts idle | PASS | Wrapper shows `data-assurer-form-state="idle"` on load |
| Rejected submission | PASS | Fill token blanked through the console to force a server rejection, fields typed, Send clicked: state `idle`, button enabled, guard message shown, typed values kept |
| Accepted submission | PASS | Page reloaded, fields typed, Send clicked: `sending` with button disabled straight after the click, then `sent`, thank-you shown, form hidden, no error |
| `sent` is final | PASS | A further submit event after `sent`: no new request (1 before, 1 after), state stays `sent` |
| Slideshow holds with focus inside | PASS | Dot clicked (focus inside), pointer moved off: 0 slide changes in 14 s |
| Slideshow resumes | PASS | Focus moved out by clicking the page margin: 1 slide change within 8 s |
| Console errors | PASS | None |
| Late success after a 30 s timeout | NOT TESTED | Needs a delayed server answer; covered by reading the code only |
| Tablet and mobile layouts | NOT TESTED | No layout or template change |
| Editor (non-admin) checks | NOT TESTED | Public-facing scripts only; edit mode still blocks submission before any state change |

## Left over

- One test submission ("m1-066 Browser Test", `m1-066@example.test`) is stored in the local
  development database's form submissions. No hard delete was done (project rule); it can be
  removed with the retention task when the owner wants.
