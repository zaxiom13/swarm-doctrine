# Verify packaged Android assets: evidence

Base: `8024139186972632f153826cd89097990402dc52`. Date: 2026-10-09.

The Android workflow built and uploaded an APK but did not inspect the archive. A successful build could therefore publish an installable shell whose generated index, hashed JavaScript/CSS, manifest icons or offline policy were missing.

`verifyDebugApk` depends on `assembleDebug`, opens the actual APK and checks offline-critical files. It also follows every local `src`/`href` in `index.html`, requires packaged JavaScript and CSS, and follows every web-manifest icon. CI and the documented local command now use this verification task.

Web validation: `npm run check && npm test && npm run build` (77 tests), plus a `/game/` production build whose index references resolve in the generated asset directory. Native Gradle/APK validation is delegated to the Android CI job because this authoring environment has JDK 17 but no Gradle or Android SDK. Passing CI is required before merge; this does not claim installation or offline launch on a device.
