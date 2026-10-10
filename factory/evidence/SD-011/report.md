# Make Android Back deterministic: evidence

Base: `8024139186972632f153826cd89097990402dc52`. Date: 2026-10-09.

The native shell previously duplicated part of the UI state machine in a JavaScript string. When the pause dialog was already open, Android Back skipped the `playing` branch and called menu navigation, quitting the match. Dialog and coach states were also absent from that policy.

`UIManager.handleBack()` now owns the ordered behavior and returns whether it consumed Back. The Android callback only invokes that method. Back dismisses an invite, details, coach or Freeze aim first; resumes an already-paused match; uses each non-pause dialog's visible secondary exit; pauses a running match; navigates menus; and lets the Activity finish only from Home.

Validation: `npm run check && npm test && npm run build` (78 tests). Focused unit coverage proves details → Freeze aim → pause → resume → native exit. Chromium 153 at 390×844 then 844×390 exercised the same public handler during a running match: all transitions passed, rotation produced no visible-control overflow and there were no page errors. This is browser evidence for the web policy, not an installed-device Back-key claim.

## 2026-10-10 repair

A new regression failed against this PR's previous head: pause → Settings → Back
left Settings visible while gameplay resumed. The handler now routes the visible
menu before acting on retained game overlays. First Back returns to the paused
arena; second Back resumes.

`npm run check`, all 79 tests and `npm run build` pass. Chromium 153.0.8010.0
at 390×844, 844×390 and 1280×720 verifies this sequence, rotation during the
match, visible game-button bounds and zero page errors. Results: [browser.json](browser.json).
Native Back/system bars/device lifecycle remain unperformed.
