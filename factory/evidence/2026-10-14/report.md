# 2026-10-14 validation

Current main `886b3f4db5650a6bcc4b2f628a51686e6c1da5cb` merged #19. Fresh npm ci,
Node 24.19, check (zero errors/warnings), 80 tests and production build pass.
No pre-existing check/test/build failure. Performance baseline `08438a4` exists;
no new matched performance/balance experiment was measured or baseline replaced.

All five occupied improvement slots were synchronized with main using REST
fast-forward branch updates with expected-head leases and an additional main
parent. Local merges were conflict-free; initial get_pr_info mergeability flags
were inconsistent with the fresh open-PR listing and actual local merges, so no
code conflict was invented. #26 was retargeted from #19's branch to main after
#19 merged; no remaining stack dependency. No new improvement PR was opened.

| PR | Current head | Local web tests | Web CI | Android CI |
| --- | --- | --- | --- | --- |
| #20 | `3d509e5` | 80 | [38646277653](https://github.com/zaxiom13/swarm-doctrine/actions/runs/38646277653) | [38646277860](https://github.com/zaxiom13/swarm-doctrine/actions/runs/38646277860) |
| #22 | `acd0c36` | 81 | [38646310847](https://github.com/zaxiom13/swarm-doctrine/actions/runs/38646310847) | [38646310906](https://github.com/zaxiom13/swarm-doctrine/actions/runs/38646310906) |
| #23 | `ab91651` | 81 | [38646305006](https://github.com/zaxiom13/swarm-doctrine/actions/runs/38646305006) | [38646304968](https://github.com/zaxiom13/swarm-doctrine/actions/runs/38646304968) |
| #26 | `81e877d` | 80 | [38650144503](https://github.com/zaxiom13/swarm-doctrine/actions/runs/38650144503) | [38650144487](https://github.com/zaxiom13/swarm-doctrine/actions/runs/38650144487) |
| #27 | `159439b` | 81 | [38646281676](https://github.com/zaxiom13/swarm-doctrine/actions/runs/38646281676) | [38646281689](https://github.com/zaxiom13/swarm-doctrine/actions/runs/38646281689) |

Web/Android CI passes on all five final heads. #20 lintDebug verifyDebugApk passes, proving
its current-main APK matches the generated asset tree exactly. #22/#23/#27
Android CI also passes. #26's final observed installed result is recorded below.
Verified #20 APK [11931794360](https://github.com/zaxiom13/swarm-doctrine/actions/runs/38646277860/artifacts/11931794360):
3,669,133-byte ZIP, SHA-256
`8358b8880584696e11095b583c80aec34f2a86313c8d6e2afa2c6317fa77fd73`.

## Installed touch/lifecycle coverage

#26 extends its existing API 35 instrumentation with real MotionEvent injection
for Freeze button then arena tap, Back/rotation aim cancellation without spending
charge, held Rally cancellation through backgrounding before explicit Resume,
visible HUD bounds in portrait/landscape, and recorded/asserted fontScale=1.3.
Native point conversion uses current CSS viewport and WebView dimensions after
rotation. The ready-charge fixture reads shared rules; production rules and
controls are unchanged. Existing actual renderer crash/retry, secure offline
origin, saved Continue and Activity recreation checks remain.

The previous 2026-10-13 installed API 35 / WebView 124.0.6367.219 pass and
inspected PNGs remain valid for that old head, not proof of new assertions.
The chronology below records failed/incomplete attempts separately from the
final observed pass. Local SDK/Gradle/adb/KVM remain absent; free Ubuntu CI is the native tool.

The first extended installed test at `35045fa` failed its playing-state assertion
after Back while Freeze was armed. Its downloaded native capture shows the
Conquest match had ended normally in defeat at 16 simulated seconds during the
longer functional test. This is not evidence of a Back pause defect. fontScale=1.3
was logged; portrait/landscape HUD bounds executed before the later failure.
[Failure artifact](https://github.com/zaxiom13/swarm-doctrine/actions/runs/38646295810/artifacts/11933107110),
2,400,976 bytes, SHA-256
`1fb8655db3038226e5ab408777dab57d813dd59af5854778c3284140bb92705f`.
Retained until 2026-11-13. Second head `3b2bc3d` changes only the functional
fixture to Zen (intentionally no game over) and adds a test rival away from HUD
buttons; native taps still exercise the real Freeze path. No rules/gameplay
implementation changed to satisfy the test. Fresh installed outcome pending.

Second [38647284443](https://github.com/zaxiom13/swarm-doctrine/actions/runs/38647284443)
at `3b2bc3d` passed: XML one test, zero failures/errors/skips, testcase 108.229s;
API 35 / WebView 124.0.6367.219, fontScale=1.3, native Freeze button/arena cast,
Back/rotation cancellation, held-Rally background cancellation, HUD bounds,
actual renderer crash/retry and Continue/Activity recreation. PNGs downloaded
and inspected; recovery text/button readable and controls clear of system bars.
[Artifact](https://github.com/zaxiom13/swarm-doctrine/actions/runs/38647284443/artifacts/11932014915):
2,311,920-byte ZIP, SHA-256
`29819e064e534376f23462a3c05dea15561c711a71bd023a49b48186f7bc79cd`.

Evidence review found Wi-Fi enabled in those PNGs despite airplane=1. The earlier
connectivity dump showed no default network before Gradle, but that is not proof
at actual launch. Do not count this second pass as strict no-network startup.
Head `aebcc65` adds test-only shell disable/checks at first launch and renderer
retry, asserting no active default network both before and after game mount.
No app permission or production implementation added. Fresh strict-offline CI is
pending; software-renderer tile-memory warnings also prevent a smooth-FPS claim.

Strict run [38648282353](https://github.com/zaxiom13/swarm-doctrine/actions/runs/38648282353)
at `aebcc65` proves no default network before first launch and after game mount
from the downloaded logs, then failed native input targeting after resume:
Android rejected a touch not routed to the app-owned window. This is an
instrumentation-window readiness failure, not an established gameplay defect.
[Artifact](https://github.com/zaxiom13/swarm-doctrine/actions/runs/38648282353/artifacts/11933248808):
113,328 bytes, SHA-256
`27041a86a52d651b6a0064143ac726340fcb06a87dbac8037534096c23fc0900`.
Final attempt `9be3f8f` waits for Activity/WebView window focus and positive
laid-out dimensions before native touches, retaining app-UID input restrictions.
It also captures runtime failure diagnostics before rethrowing. Final outcome
pending; no input into system/other-app windows or permission escalation.

Run [38649076923](https://github.com/zaxiom13/swarm-doctrine/actions/runs/38649076923)
at `9be3f8f` passes all assertions: one test, zero failures/errors/skips, testcase
67.661s. Downloaded logs record no active default network before first launch,
after first game mount, before renderer retry and after retry mount. API 35,
WebView 124.0.6367.219, fontScale=1.3 and every native control/recovery assertion
pass. [Artifact](https://github.com/zaxiom13/swarm-doctrine/actions/runs/38649076923/artifacts/11934690853):
2,747,998-byte ZIP, SHA-256
`541118903b747f47724d9b27dd6410d228f8a909a21812eb301f2e569668c33a`.

Image review rejects that run's portrait/recovery PNGs as finished visual proof:
they retain an earlier landscape/game compositor frame even though logical
layout and recovery assertions passed. Current `81e877d` waits for WebView
visual-state readiness or two native frames, then idle/presentation before
capture. This is a bounded test-capture correction, not a production game change
or latency SLA. Its fresh result follows.

## Final installed result

Head `81e877d` passes web and Android CI above, including lint/build, API 26/35
Robolectric callbacks and the real installed smoke. Downloaded XML reports one
test, zero failures/errors/skips, testcase 85.532 seconds. API 35 x86_64 / model
sdk_gphone64_x86_64 / WebView 124.0.6367.219 / fontScale=1.3. Logs confirm no active
default network at all four actual first-launch/renderer-retry points, three
SNAPSHOT visualState=true markers, real renderer crash and the complete PASS.
[Final native evidence](https://github.com/zaxiom13/swarm-doctrine/actions/runs/38650144487/artifacts/11934308202):
2,112,217-byte ZIP, SHA-256
`b0df1da61529744364a2d956850bcaabafd52d0efa1c921407b80b5f1bdd82e3`,
expires 2026-11-13. Portrait 1080x1920, landscape 1920x1080 and recovery PNGs were
downloaded and visually inspected: intended states, HUD controls within usable
space, readable recovery message/button at 1.3 font scale, clear of system bars.
This finite capture set does not cover every overlay, cooldown label or menu.
[Debug APK](https://github.com/zaxiom13/swarm-doctrine/actions/runs/38650144487/artifacts/11934711657):
3,670,751-byte ZIP, SHA-256
`40fb4b9fae815385cdf21fd5d25141c317ea50413e87a7267f0a6d603f1d0b8e`.
#26 alone does not include #20's archive verifier, so this artifact is not called
archive-verified. Software-renderer tile-memory warnings persist; no FPS claim.

## Combined browser/offline exercise

All five merge automatically into current main; check/83 tests/build pass.
[Browser script](browser.cjs), [results](browser.json), [offline script](offline.cjs),
[offline matrix](offline.json): Chromium 153.0.8010.0, production Vite preview.
390x844, 844x390 and 1280x720 pass Back/Pause Settings, Escape, held Rally
rotation/release, edge pointer, touch aim, pause/restart and visible HUD bounds.
Cold offline Local and Tactician start/remain finite without online-controlled
warmup. Missing JS remains 503 text/plain. Both local-duel roles pass snapshots,
rotation release, Freeze input, disconnect victory and rematch cleanup with no
page errors. These are two same-partition BroadcastChannel tabs, not real
Firebase/WebRTC, separate profiles or Android WebView.

[Freeze-only script](freeze.cjs), [results](freeze.json) separately exercise
actual browser Freeze button then arena tap, Back/rotation cancellation, and
the Zen/test-rival fixture at both phone orientations. Both pass, no page errors;
browser success does not prove Android connectivity/font-scale/lifecycle.

Separate first-visit, match-restart, rotation/restart and rotation/warm-reload
offline matrix: all four pass. Before running, cached Chromium was found truncated
to 52,131,328 bytes and segfaulted before any page load. Re-extracted the existing
package using its existing scratch helper; restored 209,022,176-byte executable,
then both suites passed. This is a validation-tool failure, not a shipped crash.

Reproduce after npm ci/check/test/build in the combined worktree:

```sh
SWARM_ROOT=/path/to/combined PLAYWRIGHT_MODULE=/path/to/playwright \
  CHROMIUM_PATH=/path/to/chromium OFFLINE_AFTER_CONTROLS=1 \
  SKIP_CONTROLLED_WARMUP=1 node factory/evidence/2026-10-14/browser.cjs
SWARM_ROOT=/path/to/combined PLAYWRIGHT_MODULE=/path/to/playwright \
  CHROMIUM_PATH=/path/to/chromium node factory/evidence/2026-10-14/offline.cjs
```

Finite matrix only. API 26 installed with current WebView, physical devices,
audible audio, actual system Back gesture variants, system process death,
APK update persistence, broad cutout/font-scale/device matrices and real
Firebase/WebRTC remain gaps. Activity recreation is not process death.
Cloudflare authenticated account access/deployment secrets remain unavailable;
current workflow explicitly skips deployment on PRs and supplies no preview site.
No merge/auto-merge, main/master push, deployment, paid service/call/runner,
credential extraction, production Firebase mutation or Play Store publication.
