# Android renderer recovery

Base: #19 (main `aefd7fe` plus its Back policy). Date: 2026-10-12.
PR: [#26](https://github.com/zaxiom13/swarm-doctrine/pull/26). Merge #19 first.

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
remain required. The 2026-10-13 closing journal will record the observed outcome.
