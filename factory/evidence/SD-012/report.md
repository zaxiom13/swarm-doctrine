# Verify packaged Android assets: evidence

Base: `8024139186972632f153826cd89097990402dc52`. Date: 2026-10-09.

The Android workflow built and uploaded an APK but did not inspect the archive. A successful build could therefore publish an installable shell whose generated index, hashed JavaScript/CSS, manifest icons or offline policy were missing.

`verifyDebugApk` depends on `assembleDebug`, opens the actual APK and checks offline-critical files. It also follows every local `src`/`href` in `index.html`, requires packaged JavaScript and CSS, and follows every web-manifest icon. CI and the documented local command now use this verification task.

Web validation: `npm run check && npm test && npm run build` (77 tests), plus a `/game/` production build whose index references resolve in the generated asset directory. [Android CI run 38001763485](https://github.com/zaxiom13/swarm-doctrine/actions/runs/38001763485) passed `gradle -p android lintDebug verifyDebugApk` and uploaded [artifact 11649252408](https://github.com/zaxiom13/swarm-doctrine/actions/runs/38001763485/artifacts/11649252408) (3,668,868-byte zip; SHA-256 `1853d2e82e955a683c7511a6e7871b93ccf786a7ac4451d91b318ed4beac0c42`; expires 2027-01-07).

This authoring environment has JDK 17 but no Gradle or Android SDK. Passing archive inspection proves packaging, not installation or offline launch on a device.

## 2026-10-10 strengthening

The initial verifier followed only index and manifest references. It could miss a
lazy import or search worker dropped from the APK. It now compares every generated
web asset with its APK entry byte for byte, rejecting omissions and stale content.
This is additional archive coverage, not a reproduced installed-app failure.
Native verification is delegated to the existing `lintDebug verifyDebugApk` CI;
local Gradle/SDK/device execution remains unavailable.

Expanded verifier passed [Android CI 38091872069](https://github.com/zaxiom13/swarm-doctrine/actions/runs/38091872069)
on code commit `1b55b1d6e972d290e4704263bc44ed6322afd003`: `lintDebug verifyDebugApk`.
[Debug APK artifact](https://github.com/zaxiom13/swarm-doctrine/actions/runs/38091872069/artifacts/11684382210)
is 3,669,082 bytes zipped; SHA-256 `50dde33cb270b35aae8ba53881fecc1371489722a73b101379df03386bc50ea7`;
expires 2027-01-08. Web CI 38091872070 also passed.
