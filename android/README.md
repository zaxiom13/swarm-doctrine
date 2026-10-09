# Android WebView app (first milestone)

A small Java/AndroidX shell packages the Vite production build. It uses HTTPS
WebViewAssetLoader rather than file URLs or a remote-only wrapper, so first
launch can work offline and fetch/ES modules retain an origin. No native bridge
or billing services are added. Official guidance:
https://developer.android.com/develop/ui/views/layout/webapps/load-local-content

## Build a debug APK

Use JDK 17, Gradle 8.9, Android SDK platform 35/build tools 35.0.0, Node >=22.18.
Run `npm ci` in the repository root, then `gradle -p android verifyDebugApk`.
The preBuild task regenerates web assets at base `/game/` and packages them.
The verification task also opens the APK and checks its offline-critical files,
generated JavaScript/CSS and local index/manifest references.
APK: `android/app/build/outputs/apk/debug/app-debug.apk`.
Set ANDROID_HOME or android/local.properties to your SDK path (do not commit it).
Open android/ in Android Studio if preferred. The Android debug CI workflow
also builds and uploads an APK; it does not publish or deploy.

The shell fits within system bars/cutouts and allows both orientations. Rotation
keeps the same WebView; offline matches pause in the background and require an
explicit Resume. Back cancels targeting/details, pauses offline matches, confirms
leaving online matches, navigates menus, then exits from Home. A killed process
starts at Home; stored settings, records and Levels checkpoints survive. A live
match is not restored by WebView navigation state.

The web service worker is disabled on the packaged appassets origin: APK assets
already provide offline startup and must not be obscured by an older web cache.
The web-only localhost opponent proxy/connect page is unavailable in the APK.
Hard, Tactician and Local rivals need no proxy. Online play still needs internet
and the existing free Firebase configuration; no TURN relay is introduced.
Website and APK have separate DOM storage. An APK update needs a new build and
versionCode; it does not silently fetch new game code from the website.

## Device verification still required

This milestone is not a claim of Play Store readiness. On API 26 and 35+ with
current WebView, verify first launch in airplane mode, all offline modes/rivals,
portrait/landscape rotation during Rally/Freeze, cutouts/gesture navigation,
Back from every menu/overlay, background/foreground audio, process recreation,
checkpoint/records persistence across restart/update and real two-device online
duels. Record device/API/WebView versions. Native SDK/emulator is unavailable in
the initial authoring environment; browser validation does not substitute for it.
