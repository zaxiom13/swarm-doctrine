# Packaged Android WebView shell: evidence

Base: `2e10c82981c8c77e2f51c77205aca0e7ad3947e5`. Date: 2026-10-09.

No Android project existed. Added a Java/AndroidX WebView shell using WebViewAssetLoader at HTTPS /game/, a Vite asset build task and debug APK CI. No signing credentials or deployment. Native bars/cutouts remain outside the game viewport, rotation retains the WebView, Back forwards to game UI, and backgrounding clears controls/pauses offline matches. Process death returns Home while DOM storage retains checkpoints/records.

Native SDK, Gradle and emulator are unavailable locally. The Vite /game/ asset build passes; packaged assets were exercised in Chromium, not Android. Native build and device matrix remain required; PR is draft.

Reproduce unit checks: `npm ci && npm run check && npm test && npm run build`.

[Packaged asset browser results](packaged-results.json). Browser intercepts HTTPS appassets URLs and fulfills only APK asset files; all other requests are blocked. This tests the built web asset graph, not Java lifecycle or an installed APK.

Logs: [type checks](check.log), [tests](test.log), [build](build.log).
