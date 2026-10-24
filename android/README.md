# Android WebView app (first milestone)

A small Java/AndroidX shell packages the Vite production build. It uses HTTPS
WebViewAssetLoader rather than file URLs or a remote-only wrapper, so first
launch can work offline and fetch/ES modules retain an origin. No native bridge
or billing services are added. Official guidance:
https://developer.android.com/develop/ui/views/layout/webapps/load-local-content

## Build a debug APK

Use JDK 17, Gradle 8.9, Android SDK platform 35/build tools 35.0.0, Node >=22.18.
Run `npm ci` in the repository root, then `gradle -p android assembleDebug`.
The preBuild task regenerates web assets at base `/game/` and packages them.
APK: `android/app/build/outputs/apk/debug/app-debug.apk`.
Set ANDROID_HOME or android/local.properties to your SDK path (do not commit it).
Open android/ in Android Studio if preferred. The Android debug CI workflow
also builds and uploads an APK; it does not publish or deploy.

The shell fits within system bars/cutouts and allows both orientations. Rotation
keeps the same WebView; offline matches pause in the background and require an
explicit Resume. Back cancels targeting/details, pauses offline matches, confirms
leaving online matches, resumes an already-paused match, dismisses dialogs through
their visible secondary action, returns from Pause Settings to the still-paused
arena before resuming, navigates menus, then exits from Home. A killed process
starts at Home; stored settings, records and Levels checkpoints survive. A live
match is not restored by WebView navigation state.

The web service worker is disabled on the packaged appassets origin: APK assets
already provide offline startup and must not be obscured by an older web cache.
The web-only localhost opponent proxy/connect page is unavailable in the APK.
Hard, Tactician and Local rivals need no proxy. Online play still needs internet
and the existing free Firebase configuration; no TURN relay is introduced.
Website and APK have separate DOM storage. An APK update needs a new build and
versionCode; it does not silently fetch new game code from the website.

The installed CI smoke builds the normal versionCode 1 APK, saves settings,
records and a Levels checkpoint through the app, externally force-stops it, then
builds versionCode 2 from the same source and performs `adb install -r`. The
second instrumentation process must recover all saved state and Continue with
network disabled. This proves Android update-install data continuity for the
tested build/configuration; it does not prove arbitrary future schema migrations.

## Device verification still required

### Installed renderer smoke

The debug workflow additionally attempts API 26 and API 35 x86_64 Pixel 2
emulator runs on existing Ubuntu runners (20-minute bound per matrix job, no
larger/paid runner). API 26 is the declared minimum; API 35 remains the current
regression control. Artifacts are named by API so concurrent jobs cannot collide.
The script selects `InstalledRecoveryTest` with Gradle's instrumentation class
argument (the staged process tests must not run in an arbitrary order), and
launches the packaged app after
airplane mode and Wi-Fi/mobile data have been disabled, records API/WebView
versions, and exercises native Back dispatch, background/foreground, an edge
touch held through portrait/landscape rotation, real `chrome://crash` renderer
termination, explicit retry, saved Levels Continue and Activity recreation.
The crash URL is used only by this debug instrumentation test, never exposed in
the app's navigation. The workflow collects test reports, native screenshots and
filtered logs before terminating the emulator. These are two finite emulator
configurations; successful results do not prove physical devices, current vendor
WebViews, audible output, low-memory kills during writes or real Firebase/WebRTC.

Run locally with the documented SDK/build tools and a booted API 26 or 35 emulator:
`gradle -p android assembleDebugAndroidTest`, then
`bash android/scripts/installed-smoke.sh` from the repo root. The script enables
airplane mode and leaves it enabled on that test emulator. No signing credentials
or production account is needed. The script sets font_scale=1.3 and leaves that
test-emulator setting in place. The 2026-10-13 API 35 / WebView 124.0.6367.219 run
passed (38479187864); its report and portrait/landscape/recovery screenshots were
inspected. This run additionally checks native Freeze button/arena tap, aim
cancellation through Back/rotation, held Rally cancellation on backgrounding and
visible HUD bounds with the larger-font fixture. Fresh CI
results are recorded in the dated factory journal; audible audio and updates are
not covered.

### Whole-process persistence smoke

The same script additionally installs the debug/test APKs once, runs
`ProcessPersistenceTest#saveBeforeProcessStop`, launches the ordinary app and
records its live package PID, then calls `adb shell am force-stop` and requires
that no package PID remains. A separate instrumentation invocation runs
`ProcessPersistenceTest#restoreAfterProcessStop` without reinstalling or clearing
data. It checks offline Home startup, the saved sector/team/seed/enemy choice,
best record, loaded audio/settings controls, portrait/landscape Settings and
Continue. Fixture values are saved through the game's normal save functions;
the test does not pretend to earn a score or complete sectors. Stage stdout,
PID/stop evidence, settings PNGs and filtered logs are uploaded with the native
artifact. A zero shell exit alone is insufficient: both stages must report
`OK (1 test)` with no runner failure/crash.

The restore stage also uses actual Android vertical drags in the menu gutter,
not JavaScript scrolling, to reach both bottom Settings actions in portrait and
landscape. It captures those viewports without pressing Reset settings or Clear
progress. A real Sound touch must update the checkbox, runtime flag and stored
preference; native Back returns Home and an actual Home Settings tap reopens the
choice. Portrait enables Sound, landscape restores it to disabled. Progress and
records must remain intact before Continue. Gestures use current usable WebView
bounds after rotation. This is finite menu coverage, not audible output or every
menu/device. Fresh results belong in the dated journal, not inferred from code.

Native menu readiness requires a stationary viewport/target and ownership of the
actual center tap point via elementFromPoint, not just a rectangle inside the
viewport. Sticky headings can cover otherwise in-bounds controls. Top captures
require the Settings root at scrollTop <= 1 after real native drags. Sound checks
log before/after geometry, center hit, checkbox/runtime/storage values, retaining
failure screenshots rather than silently retrying taps or weakening assertions.

This closes a different gap from Activity recreation or a renderer crash. It
tests ordinary save/background followed by whole-process force-stop/relaunch,
not a low-memory kill during an unfinished write, task restoration, a reboot,
an APK update or transfer between website/APK storage. New assertions require
an observed CI pass; adding the test alone is not installed-app proof.

The 2026-10-15 process test passed, but its new Settings display captures were
blank/retained frames and are not accepted as layout proof. The follow-up waits
for an actually visible Settings screen, loaded fonts, finished page animations,
current viewport/heading bounds and an app-owned focused window. After WebView's
visual callback, it waits for a submitted native frame (API 29+ hardware rendering)
and saves a PixelCopy of the app-window WebView bounds alongside the full native
display capture. API 26-28 use a weaker next-draw fallback, not equivalent proof.
Both are actual captured buffers, not offscreen re-renderings or favorable-frame
retries. Geometry/focus/frame diagnostics distinguish window content from display
presentation; only inspected fresh results establish what was actually captured.
Official contracts: https://developer.android.com/reference/android/webkit/WebView#postVisualStateCallback(long,%20android.webkit.WebView.VisualStateCallback),
https://developer.android.com/reference/android/view/ViewTreeObserver#registerFrameCommitCallback(java.lang.Runnable),
https://developer.android.com/reference/android/view/PixelCopy.

If Android reclaims or crashes the WebView renderer, the shell removes and destroys
that instance, then offers **Return to Home**. It creates a fresh packaged WebView
only after that tap, avoiding automatic crash/reload loops. Stored progress stays
in DOM storage; the lost live match cannot be recovered. Back exits from this
recovery screen, and background/foreground remains safe while no WebView exists.
This follows https://developer.android.com/develop/ui/views/layout/webapps/handle-termination.

`gradle -p android testDebugUnitTest` exercises the inherited unhandled callback,
crash and memory-kill recovery, explicit retry, secure settings and null-renderer
lifecycle/Back on Robolectric API 26 and 35 shadows. The Android CI job also runs
these tests. These are native callback tests, not a real renderer kill.
On a debug device, use the inspected WebView's `chrome://crash` in DevTools (not
as an app link), then check recovery, Home, saved Continue and audio. Also kill
the renderer under background memory pressure and check foreground recovery.

This milestone is not a claim of Play Store readiness. On API 26 and 35+ with
current WebView, verify first launch in airplane mode, all offline modes/rivals,
portrait/landscape rotation during Rally/Freeze, cutouts/gesture navigation,
Back from every menu/overlay, background/foreground audio, process recreation,
checkpoint/records persistence across restart/update and real two-device online
duels. Record device/API/WebView versions. Native SDK/emulator is unavailable in
the initial authoring environment; browser validation does not substitute for it.
