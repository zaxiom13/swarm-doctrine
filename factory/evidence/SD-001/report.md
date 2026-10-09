# Packaged Android WebView shell: evidence

Base: `2e10c82981c8c77e2f51c77205aca0e7ad3947e5`. Date: 2026-10-09.

No Android project existed. Added a Java/AndroidX WebView shell using WebViewAssetLoader at HTTPS /game/, a Vite asset build task and debug APK CI. No signing credentials or deployment. Native bars/cutouts remain outside the game viewport, rotation retains the WebView, Back forwards to game UI, and backgrounding clears controls/pauses offline matches. Process death returns Home while DOM storage retains checkpoints/records.

Native SDK, Gradle and emulator are unavailable locally. GitHub CI successfully ran `gradle -p android lintDebug assembleDebug` with JDK 17, Gradle 8.9 and SDK 35 at commit `2c62e48abbc86bd6df015cef9cec385a5b353ef1`. [Lint/build run](https://github.com/zaxiom13/swarm-doctrine/actions/runs/37929872110) and [debug APK artifact](https://github.com/zaxiom13/swarm-doctrine/actions/runs/37929872110/artifacts/11615672728) (3,667,736 bytes zipped). Packaged assets were exercised in Chromium, not an installed Android app. Device matrix remains required; PR is draft.

Reproduce unit checks: `npm ci && npm run check && npm test && npm run build`.

[Packaged asset browser results](packaged-results.json). Browser intercepts HTTPS appassets URLs and fulfills only APK asset files; all other requests are blocked. This tests the built web asset graph, not Java lifecycle or an installed APK.

Logs: [type checks](check.log), [tests](test.log), [build](build.log).

CI repairs: request `platform-tools` instead of obsolete SDK `tools`; align transitive Kotlin stdlib/JDK variants with Kotlin BOM 1.8.22. A follow-up lint run caught `android:windowLightNavigationBar` in the API 26 base style even though the attribute starts at API 27. Moving it to `values-v27` made `lintDebug` and `assembleDebug` pass. Native install/lifecycle, Back, insets and real Firebase/WebRTC checks remain unperformed.
