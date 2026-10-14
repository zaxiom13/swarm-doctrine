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
