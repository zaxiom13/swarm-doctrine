# Escape event ownership: evidence

2026-10-10. Base `cb7758ee40e6884cc31ed740f46f593ef4df92fc`.

Browser reproduction on main: open Conquest, open Details, remove button focus,
press Escape. Details closed **and** the match paused. Both App's document handler
and InputHandler acted on the same event. Once the pause dialog focused Resume,
another Escape was ignored because all button key events were skipped.

After: UIManager reports whether it consumed Escape, App prevents the consumed
event, and InputHandler respects that ownership. Escape remains available while
buttons have focus; text fields and other button gameplay shortcuts retain ownership.
One Escape closes Details, the next pauses, the next resumes.

Validation: `npm run check`, `npm test` (78/78), `npm run build`; focused regression
covers consumed/unconsumed Escape, button focus and retained button Space handling.
Chromium 153.0.8010.0 exercises real document events at 390×844, rotates the same
match to 844×390, then 1280×720. All three transitions pass at each viewport;
visible game buttons fit; no page errors. [Results](browser.json).

Reproduce the browser check after `npm ci && npm run build`: install Playwright
in a disposable directory and use `PLAYWRIGHT_MODULE=/path/to/playwright` plus
`CHROMIUM_PATH=/path/to/chromium` with `node factory/evidence/SD-016/browser.cjs`.
`CHROMIUM_ARGS` can supply a JSON argument array for a container-specific browser.
The script starts and closes Vite preview itself.

No rules/guide/balance changes, so no policy replacement or guide regeneration.
This verifies the web event path, not an installed Android keyboard or Back key.
