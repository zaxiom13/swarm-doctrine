# 2026-10-25 evidence

Run 40247079495 proves the corrected API 26 fixture reaches the installed app
offline. Debug APK artifact 12619450314 is 3,670,752 bytes (SHA-256
`923f978459463c06b73c39480fb31f573427963ae7f5815c8686d5471c98ef21`);
smoke artifact 12619745333 is 32,212 bytes (SHA-256
`23e5bedb4b860f78966136098d9cdc8388422293c0f597e1f0d263ff38fdb72f`).
Logs show Android 8 / Chrome WebView 69, no active network, then parse failures
before `window.game` mounted.

Run 40248085072 proves the compatibility bundle mounts and advances through the
API 35 control path, then preserves a final Settings failure with Chromium's
selection toolbar. Smoke artifact 12619762376 is 5,638,552 bytes; no digest is
claimed here because the complete value was not retained. Run 40248959499 passes
the same complete API 35 path after platform tap injection. API 26 was canceled
at the job limit; artifact 12620565574 is
18,589 bytes, SHA-256
`3ad47aa260e1928c98a0bdaa6c69233cbf5b3776301d6f288d016d1e6053855a`.
Its log still shows `Uncaught SyntaxError: Unexpected token .`; it is red
evidence, not a compatibility pass.
