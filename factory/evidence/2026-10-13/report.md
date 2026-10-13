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
Bounded bootstrap polling and a 30-second functional callback wait, within the
20-minute job bound, passed at `78c151f` (Android run 38478243992). Its assertion
report passed but screenshots were lost when AGP uninstalled the tested APK.
Test-only screenshot collection now uses app-owned MediaStore images on API 29+;
no app permission was added. Final head `24caeb6` passes web
[38479187774](https://github.com/zaxiom13/swarm-doctrine/actions/runs/38479187774)
and Android [38479187864](https://github.com/zaxiom13/swarm-doctrine/actions/runs/38479187864).

[Installed evidence](https://github.com/zaxiom13/swarm-doctrine/actions/runs/38479187864/artifacts/11856512746)
contains XML, logs, connectivity and portrait/landscape/recovery screenshots.
ZIP: 2,159,149 bytes, SHA-256
`4533635bedfec45e6892089cd3e855932928a906cf8cd42e335fa9714557d283`;
retained until 2026-11-12. XML: one test, zero failures/errors/skips, testcase
47.381 seconds. Logs record API 35, WebView 124.0.6367.219, airplane=1, actual
renderer crash (code 11) and PASS for all listed checks. Before launch the active
default network was none. The saved level-3/seed-424242 checkpoint survives
renderer retry and Activity recreation. Screenshots were downloaded and visually
inspected: portrait 1080x1920, landscape 1920x1080, readable recovery message/button,
HUD and recovery controls clear of the visible system bars in this configuration.
Debug APK [11856857168](https://github.com/zaxiom13/swarm-doctrine/actions/runs/38479187864/artifacts/11856857168)
is available. This run still logs a tile-memory warning in software rendering;
functional success is not a claim of smooth device frame rate.

This is not a performance SLA. Activity recreation is not system process death.
The headless emulator disables audible output. Installed API 26, physical devices,
actual system Back gesture variants, system process death, APK update persistence,
large font/cutout matrices and real two-device networking remain outstanding.

## Integration and speed draw

All six improvements merge automatically; combined check/83 tests/build pass.
No rules/guide/model/balance change. The four unchanged PRs retain their previous
green CI at #19 `fcb353a`, #20 `cd85a08`, #22 `bc06487`, #23 `c1efc12`.
Fresh #26 web check/80 tests/build and installed API 35 smoke are green above.

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
