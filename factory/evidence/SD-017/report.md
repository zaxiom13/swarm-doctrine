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
and `git diff --check` pass. The stacked head is revalidated below.
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
