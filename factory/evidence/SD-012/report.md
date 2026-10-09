# Verify packaged Android assets: evidence

Base: `8024139186972632f153826cd89097990402dc52`. Date: 2026-10-09.

The Android workflow built and uploaded an APK but did not inspect the archive. A successful build could therefore publish an installable shell whose generated index, hashed JavaScript/CSS, manifest icons or offline policy were missing.

`verifyDebugApk` depends on `assembleDebug`, opens the actual APK and checks offline-critical files. It also follows every local `src`/`href` in `index.html`, requires packaged JavaScript and CSS, and follows every web-manifest icon. CI and the documented local command now use this verification task.

Web validation: `npm run check && npm test && npm run build` (77 tests), plus a `/game/` production build whose index references resolve in the generated asset directory. [Android CI run 38001763485](https://github.com/zaxiom13/swarm-doctrine/actions/runs/38001763485) passed `gradle -p android lintDebug verifyDebugApk` and uploaded [artifact 11649252408](https://github.com/zaxiom13/swarm-doctrine/actions/runs/38001763485/artifacts/11649252408) (3,668,868-byte zip; SHA-256 `1853d2e82e955a683c7511a6e7871b93ccf786a7ac4451d91b318ed4beac0c42`; expires 2027-01-07).

This authoring environment has JDK 17 but no Gradle or Android SDK. Passing archive inspection proves packaging, not installation or offline launch on a device.
