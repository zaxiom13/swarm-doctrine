# Packaged Android WebView shell: evidence

Base: `2e10c82981c8c77e2f51c77205aca0e7ad3947e5`. Date: 2026-10-09.

No Android project existed. Added a Java/AndroidX WebView shell using WebViewAssetLoader at HTTPS /game/, a Vite asset build task and debug APK CI. No signing credentials or deployment. Native bars/cutouts remain outside the game viewport, rotation retains the WebView, Back forwards to game UI, and backgrounding clears controls/pauses offline matches. Process death returns Home while DOM storage retains checkpoints/records.

Native SDK, Gradle and emulator are unavailable locally. GitHub CI successfully ran `gradle -p android assembleDebug` with JDK 17, Gradle 8.9 and SDK 35 at commit `8b87c7abdbbd0a7e27a4fc1a4c74d9978c88b992`. [Build and debug APK artifact](https://github.com/zaxiom13/swarm-doctrine/actions/runs/37928687833/artifacts/11615486550) (3,667,714 bytes zipped). Packaged assets were exercised in Chromium, not an installed Android app. Device matrix remains required; PR is draft.

Reproduce unit checks: `npm ci && npm run check && npm test && npm run build`.

[Packaged asset browser results](packaged-results.json). Browser intercepts HTTPS appassets URLs and fulfills only APK asset files; all other requests are blocked. This tests the built web asset graph, not Java lifecycle or an installed APK.

Logs: [type checks](check.log), [tests](test.log), [build](build.log).

CI repairs: request `platform-tools` instead of obsolete SDK `tools`; align transitive Kotlin stdlib/JDK variants with Kotlin BOM 1.8.22. Java compilation and APK packaging then passed. Native install/lifecycle, Back, insets and real Firebase/WebRTC checks remain unperformed.
