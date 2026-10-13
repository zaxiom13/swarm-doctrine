# 2026-10-13 validation

Main remains `aefd7fe22af379a86d44d0f2458b9d03566d5cab`. Node 24.19, fresh
npm ci, check, 78 tests and build pass. No pre-existing web check/test/build
failure. No AGENTS/nightly procedure was added. The existing five improvements
remain open; one independent startup fix was added as a recorded budget exception.

## Offline failure and fix (#27)

[Before](offline-before.json), [after](offline.json),
[independent branch](offline-independent.json), [repro script](offline.cjs):
Chromium 153 at 390x844 initial viewport, same production preview port/assets.
First visit, match restart and rotation/restart all failed immediate cold-offline
reload before the patch; only an online worker-controlled reload avoided it.
All four cases now pass, and the independent main-based fix passes first reload.

All eleven JS/CSS files were cached with nonempty bytes and correct types. The
actual request carried Origin, while the precached request headers were empty;
the response varied on Origin. A temporary diagnostic built worker proved strict
match missed and ignoreVary matched. The diagnostic was rebuilt away and never
committed. Production preview returned 503 for its stored entry chunks/CSS.

#27 accepts only exact public SHELL URLs whose cached response varies solely on
Origin. Unlisted/private URLs, query variants, Cookie, mixed Origin/Cookie and
wildcard Vary retain strict matching; missing assets still return 503 text/plain.
Check/79 tests/build pass independently. Web
[38477803320](https://github.com/zaxiom13/swarm-doctrine/actions/runs/38477803320)
and Android [38477803273](https://github.com/zaxiom13/swarm-doctrine/actions/runs/38477803273)
pass at `d149536`. No deployment was inspected or changed; this is observed
production-preview behavior. The APK disables the worker on its packaged origin.

[Full exercise](browser.cjs), [results](browser.json): after the fix, the original
combined context passes with OFFLINE_AFTER_CONTROLS=1 SKIP_CONTROLLED_WARMUP=1.
Cold offline Local/Tactician rivals start and remain finite. Back/Escape, held
Rally through rotation, edge pointer, Freeze aim, pause/restart and game control
bounds pass at 390x844, 844x390 and 1280x720. Both BroadcastChannel duel roles
pass snapshots, rotation release, Freeze, disconnect victory and rematch cleanup.
These are two same-partition tabs, not Firebase/WebRTC or Android WebView.

## Installed Android smoke (#26)

Added an AndroidX instrumentation test to the existing bounded free Ubuntu job:
API 35 x86_64, Pixel 2 profile, google_apis image, KVM and software rendering.
The test enables airplane mode before first launch and records API/WebView,
native screenshots and filtered logs. Its intended checks include native Back
dispatch, background/foreground, edge touch, portrait/landscape, real renderer
crash, explicit Home retry, saved Levels Continue and Activity recreation.
The debug-only crash URL is never exposed to app navigation. No app permission,
bridge, larger/paid runner, signing credential or production service was added.

First attempt [38476549480](https://github.com/zaxiom13/swarm-doctrine/actions/runs/38476549480)
failed its early readiness callback. [Failure artifact](https://github.com/zaxiom13/swarm-doctrine/actions/runs/38476549480/artifacts/11853922801).
Second [38477541400](https://github.com/zaxiom13/swarm-doctrine/actions/runs/38477541400)
mounted the game under airplane=1 on API 35 / com.google.android.webview
124.0.6367.219, then its next callback exceeded five seconds; no later orientation
or recovery assertion executed. [Second artifact](https://github.com/zaxiom13/swarm-doctrine/actions/runs/38477541400/artifacts/11855640547).
Compilation, lint, APK assembly and Robolectric callback tests passed in both.
The final attempt at `78c151f` permits bounded bootstrap polling and a 30-second
functional callback wait while keeping the overall 20-minute job bound.
Its installed outcome is pending until the final CI sweep.

This is not a performance SLA. Activity recreation is not system process death.
The headless emulator disables audible output. Installed API 26, physical devices,
actual system Back gesture variants, system process death, APK update persistence,
large font/cutout matrices and real two-device networking remain outstanding.

## Integration and speed draw

All six improvements merge automatically; combined check/83 tests/build pass.
No rules/guide/model/balance change. The four unchanged PRs retain their previous
green CI at #19 `fcb353a`, #20 `cd85a08`, #22 `bc06487`, #23 `c1efc12`.
Fresh #26 web check/80 tests/build is green; installed status is separate above.

Existing `tests/performance.test.ts` comparison with actual commit `08438a4`:
same seeded positions/velocities, 1280x720, median of three 90-tick batches after
warmup, Node 24.19, no real canvas. Original and current builds use their own
rule/config implementations, so this is the existing pre-rewrite diagnostic,
not identical-rules or installed-frame-rate evidence and not a speedup from this run.

| Ships | Current | Pre-rewrite | Ratio |
| --- | --- | --- | --- |
| 160 | 8.1 ms | 28.6 ms | 3.51x |
| 320 | 23.1 ms | 96.4 ms | 4.18x |

Reproduce with `npm exec vitest run tests/performance.test.ts -- --reporter=verbose --disableConsoleIntercept`.
No baseline was overwritten. Cloudflare authentication/deployment secrets are
not available in this session; Worker/PR previews remain pending. No merge,
auto-merge, main/master push, deployment, paid call, production Firebase mutation
or Play Store publishing occurred.
