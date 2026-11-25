# Android WebView app

A small Java/AndroidX shell packages the Vite production build. It uses HTTPS
`WebViewAssetLoader` rather than `file://` URLs or a remote-only wrapper, so
first launch works offline and fetch/ES modules retain an origin. Official
guidance:
https://developer.android.com/develop/ui/views/layout/webapps/load-local-content

## Automatic CI releases (APK & AAB)

Every push/merge to `main` runs `.github/workflows/android.yml`, which builds,
verifies, and publishes **both** formats to the rolling `android-latest` GitHub
Release:

- **`swarm-doctrine.apk`** (and versioned `swarm-doctrine-<version>.apk`) for direct sideloading on Android devices.
- **`swarm-doctrine.aab`** (and versioned `swarm-doctrine-<version>.aab`) in Android App Bundle format.

Each build stamps a rising `versionCode` (`GITHUB_RUN_NUMBER`) and `versionName`
(`1.0.<run_number>`). By default, public builds fall back to Android debug
signing so PR checks and releases always succeed without credentials. To sign
releases with your own release or Play upload key, add these four repository
secrets:

- `ANDROID_KEYSTORE_BASE64`
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`

## Build locally

Use JDK 17, Gradle 8.9, Android SDK platform 35 / build-tools 35.0.0, Node >=22.18.
Run `npm ci` in the repository root, then:

```sh
gradle -p android lintRelease assembleRelease bundleRelease
```

Outputs:
- APK: `android/app/build/outputs/apk/release/app-release.apk`
- AAB: `android/app/build/outputs/bundle/release/app-release.aab`

For Play Store upload validation (fails if release signing env vars `SD_KEYSTORE*` are missing), pass `-PplayRelease=true`.
Set `ANDROID_HOME` or `android/local.properties` to your SDK path (do not commit it).

## Behaviour & lifecycle

The shell fits within system bars/cutouts and allows both orientations. Rotation
keeps the same WebView; offline matches pause in the background and require an
explicit Resume. Back cancels targeting/details, pauses offline matches, confirms
leaving online matches, resumes an already-paused match, dismisses dialogs through
their visible secondary action, returns from Pause Settings to the still-paused
arena before resuming, navigates menus, then exits from Home. A killed process
starts at Home; stored settings, records and Levels checkpoints survive. A live
match is not restored by WebView navigation state.

The web service worker is disabled on the packaged `appassets` origin: APK assets
already provide offline startup and must not be obscured by an older web cache.
The web-only localhost opponent proxy/connect page is unavailable in the APK.
Hard, Tactician and Local rivals need no proxy. Online play still needs internet
and the existing free Firebase configuration; no TURN relay is introduced.
Website and APK have separate DOM storage.
