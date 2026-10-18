# Android renderer recovery

Initial base: #19 (main `aefd7fe` plus its Back policy). Date: 2026-10-12.
PR: [#26](https://github.com/zaxiom13/swarm-doctrine/pull/26). #19 merged on
2026-10-14; this PR now targets main `886b3f4` with no outstanding stack dependency.

The shipped shell has no `onRenderProcessGone` override. Its inherited callback
returns false for both crash and memory-kill cases, which Android documents as
terminating the host app. This is a documented callback gap, not a claim that
a physical device crash was reproduced:
https://developer.android.com/develop/ui/views/layout/webapps/handle-termination.

The handler now returns true, removes/destroys the lost WebView and clears the
Activity reference. A scrollable native message offers Return to Home. Only
that action creates a new securely configured packaged WebView; the live match
is lost, while DOM storage is never cleared. Pause/resume/Back are safe without
a renderer and stale asynchronous Back results cannot finish a replacement.

`npm run check`, 78 web tests on the initial independent head, production build
and `git diff --check` pass. The stacked head passes 80 web tests; final code CI
and artifact reconciliation is in closing #24.
`gradle -p android testDebugUnitTest lintDebug assembleDebug` is the CI gate.
Robolectric API 26/35 tests cover the inherited callback, crash cleanup/retry,
background memory-kill recovery, secure replacement settings and Back/lifecycle
with a missing WebView. Initial Android
[38319050261](https://github.com/zaxiom13/swarm-doctrine/actions/runs/38319050261)
passed `testDebugUnitTest lintDebug assembleDebug` at `0bbaf63`; web
[38319050252](https://github.com/zaxiom13/swarm-doctrine/actions/runs/38319050252)
also passed. This proves the callbacks on shadow WebViews, not installed rendering.

Robolectric uses shadow WebViews; no real Chromium renderer, installed APK,
native system-bar/orientation/audio/persistence or online transport behavior was
measured. Local SDK/Gradle/adb/emulator/KVM remain absent. A manual debug-device
renderer kill and saved Continue round-trip are still required; instructions
are in android/README.md. No paid service, bridge, permission grant, signing key,
deployment or Play Store publication.

## 2026-10-13 installed smoke attempt

Added an AndroidX instrumentation test and a bounded API 35 x86_64 Pixel 2
emulator step to the existing free Ubuntu job. It checks packaged launch under
airplane mode, native Back dispatch, background/foreground, actual edge touch
and both orientations, real renderer crash and fresh retry, saved Levels Continue
and Activity recreation. Test reports, screenshots and API/WebView logs are
collected while the emulator is alive, including on test failure. No new PR slot,
paid runner, new app permission, native bridge or signing credential is used.

Compilation/installed results are pending; do not treat the test's assertions as
executed evidence. Activity recreation is not system process death, and the
headless emulator disables audible output. API 26 and physical-device checks
remain required. The 2026-10-13 closing journal records the observed outcome.

## 2026-10-14 current-main and touch coverage

The installed run [38479187864](https://github.com/zaxiom13/swarm-doctrine/actions/runs/38479187864)
at `24caeb6` actually passed on API 35 / WebView 124.0.6367.219, airplane=1 and no
active default network. XML reports one test, zero failures/errors/skips. Native
portrait/landscape/recovery PNGs were downloaded and inspected.
[Evidence](https://github.com/zaxiom13/swarm-doctrine/actions/runs/38479187864/artifacts/11856512746).
The initial pending statements above describe the first attempt, not the final result.

After #19 merged, synchronized/retargeted to main. Extended the installed test
using real MotionEvent injection for Freeze's button-then-arena-tap path, Back
and rotation cancelling aim without spending the charge, and backgrounding
cancelling held Rally before explicit Resume. CSS-to-native point conversion
uses the current WebView dimensions after rotation. A ready-charge fixture reads
the shared rules; production balance is unchanged. Script sets and records 1.3
font scale; assertions check visible HUD bounds in both orientations. No app
permission, native bridge, credentials or paid runner is added. Fresh native
outcomes are pending until CI completes, recorded in the closing dated journal.

First expanded attempt 38646295810 failed the Back/Freeze playing-state check.
Its actual capture shows a normal Conquest defeat after 16 simulated seconds,
not a paused match or proven Back defect. The longer functional fixture now uses
Zen's intentional no-game-over behavior and a test-only rival away from HUD
buttons for native aim. No gameplay implementation or rules were changed to make
the assertion pass. Failure artifact 11933107110 is retained; new outcome pending.

Second run 38647284443 passed the expanded installed assertions (API 35,
WebView 124.0.6367.219, fontScale=1.3; XML one test/zero failures). Downloaded
PNG shows Wi-Fi enabled despite airplane mode; the early pre-Gradle connectivity
dump cannot prove connectivity at actual launch. Thus this run proves the touch,
lifecycle, recovery and font fixture, not strict no-network startup. Added
test-only shell checks that disable Wi-Fi/data and assert no active default
network before/after first mount and renderer retry. No app permission added.
Fresh strict-offline result must be observed, not inferred from airplane=1.

Strict run 38648282353 logged no default network before first launch and after
game mount, then Android rejected the first native edge touch after background/
resume because it did not target the app-owned window. Added a bounded readiness
wait for the existing Activity/WebView to own focus and have laid-out dimensions
before sending touches. Instrumentation's UID restriction remains intact; no
broader/system-window injection or permission escalation. Runtime failures also
capture diagnostics before rethrowing. Retained artifact 11933248808; next result
must be observed rather than claiming the incomplete run passed.

Run 38649076923 at 9be3f8f passes all assertions, including no default network
before/after first mount and renderer retry, API 35 / WebView 124.0.6367.219,
fontScale=1.3; one test/zero failures. Artifact 11934690853 logs this directly.
Its downloaded portrait/recovery PNGs retain an earlier compositor frame despite
logical layout/recovery readiness, so they are not accepted as finished visual
proof. Capture now waits for WebView visual state or two native frames, then
idle/presentation, within a bounded wait. Fresh stable-image outcome pending.

## 2026-10-15: whole-process persistence

The stable `81e877d` run 38650144487 subsequently passed all expanded assertions
and its three intended-phase PNGs were downloaded/inspected (dated 2026-10-14
report in #24). The previous pending text above is chronological, not the final
status.

New staged tests save a deterministic checkpoint, settings and best-record
fixture through the game's normal functions, background normally, then finish
the first instrumentation invocation. The script launches the ordinary app,
requires a live package PID, force-stops it externally, and requires no PID to
remain. A second instrumentation process launches with no intervening reinstall
or data clear. It checks offline Home (no live match restoration), all checkpoint
fields, record, loaded runtime audio preferences and rendered saved settings,
Settings in portrait/landscape, and Continue. Stage runner output must explicitly
report one test passed; a zero shell status alone is not accepted. Each stage is
bounded to three minutes within the existing free job's twenty-minute limit.

This is normal-save/background plus process stop/relaunch, not low-memory death
during an unfinished write, reboot/task restoration or APK update. Fixtures do
not earn a score or complete sectors. New installed results require fresh CI;
current-main check/80 tests/build and shell syntax pass locally. No production
runtime/rules, native permissions or bridge changed. The closing dated report
will record actual CI/artifacts and limitations.

## 2026-10-16: Settings presentation diagnostics

The prior 6971d4a process stages passed in run 38822187818, but image inspection
rejected blank portrait/retained portrait-width landscape Settings captures.
This follow-up does not assume a shipped layout defect. Hidden Settings inputs
remain in the DOM; saved control values do not prove that their Screen is visible.
The test now requires visible current-size Settings/heading bounds, loaded fonts,
settled page animations and native app-window focus. It records CSS/native geometry,
waits for a frame submitted after WebView visual readiness, and preserves a raw
PixelCopy of the app-window bounds beside the existing full-display screenshot.
No offscreen redraw, production style override, favorable-frame retry or new
permission is used. API 26-28's next-draw fallback is weaker, not claimed equivalent.

Contracts: Android's postVisualStateCallback describes readiness for the next
draw, not current display presentation. registerFrameCommitCallback describes a
submitted hardware frame, also not necessarily yet visible; PixelCopy reads the
window surface's queued buffer. See official links in android/README.md. These
sources motivate diagnostics, not proof of the captured outcome. New installed
results/paired image review must be observed in the dated #24 journal.

Local current-main check/80 tests/build pass. No runtime/rules/security-policy
change; existing renderer/lifecycle/process tests remain. One fresh native attempt
is budgeted for this investigation rather than repeatedly changing the app to
obtain favorable evidence.

## 2026-10-18: native Settings interaction

Prior e2bc185 run 38824179090 passed and its seven PNGs were inspected in #24.
It established initial Settings viewports, not native bottom scrolling. A prior
attempt to extend this test remained unpublished after a subscription approval
limit; workspace cleanup removed that scratch checkout. Reconstructed from the
recorded source changes on the unchanged remote head, not claimed recovered CI.

Restore-stage tests inject bounded Android gutter drags using fresh WebView
screen bounds. Both bottom actions must fit; raw app-window/full-display images
preserve the actual buffers. Sound touches toggle false→true in portrait and
true→false in landscape, checking UI/runtime/storage. Native Back returns Home;
touching the actual Home Settings control reopens the choice. Checkpoint/record
fixtures remain intact, then Continue restores the fields. No JS scrolling or
clicking, destructive Reset/Clear action, production CSS override or permission.

Local SDK/Gradle/adb/KVM are absent. Check/test/build and shell syntax can run
locally; native compilation, execution and image review need a new free CI run.
The dated #24 journal records observed outcomes and any failed attempt. This is
coverage of existing UI, not a reproduced layout bug, audible-audio proof,
all-menu/device support or APK-update persistence.
