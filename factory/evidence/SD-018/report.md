# First offline reload: Origin variant mismatch

Base: main `aefd7fe22af379a86d44d0f2458b9d03566d5cab`. Date: 2026-10-13.

Production Vite preview on Chromium 153 reproduces an empty app on first offline
reload, also after match restart/rotation. All eleven JS/CSS files are already
present with valid types and nonempty bytes, yet the worker returns 503 for its
entry chunks and stylesheet. A prior worker-controlled online reload hides it.

Diagnostic: cached request headers are empty; the actual stylesheet/module
request includes Origin: http://127.0.0.1:4185; the response has Vary: Origin.
Strict Cache.match misses while ignoreVary matches the same precached bytes.
Google Fonts also fails offline, but the fatal failures are same-origin game
assets. This is observed on production preview, not a claim of inspecting the
undeployed Cloudflare host or an installed APK (whose worker is disabled).

The fallback now ignores Vary only when the request exactly matches a public
SHELL URL and the stored response varies only on Origin. It preserves other
variants and missing-asset 503 text/plain behavior. The worker fingerprint changes
with the fix, so existing worker updates are not hidden by the prior cache.

`npm run check`, 79 tests, production build and diff check pass. The regression
covers JS/CSS and rejects unlisted/private URLs, query variants, Cookie, mixed
Origin/Cookie and wildcard Vary. Browser matrix changes from first three failures
and warm-reload success to all four successes; the original no-warmup combined
control sequence also passes with Local/Tactician rivals and local duel roles.
Scripts/results and final CI links are in closing #24's dated 2026-10-13 evidence.

No rules, model, guide assets, APK origin, production deployment, credentials or
paid calls were changed. The shipped Android packaged origin disables this worker.
