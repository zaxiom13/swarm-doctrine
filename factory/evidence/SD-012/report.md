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

## 2026-10-11 strengthening

The verifier now checks the reverse direction too: every `assets/` file in the
APK must exist in the freshly generated web tree. This prevents an incremental
or misconfigured package from retaining an obsolete hashed chunk even when all
current files are present and byte-identical. CI evidence is recorded after the
expanded task runs; this remains archive evidence, not an installed update test.

The exact-set verifier passed [Android CI 38180354394](https://github.com/zaxiom13/swarm-doctrine/actions/runs/38180354394)
on code commit `c4ea3de40b099b75083d6677e1dec7bf02214c02`. The
[debug APK artifact](https://github.com/zaxiom13/swarm-doctrine/actions/runs/38180354394/artifacts/11717785558)
is 3,669,086 bytes zipped with SHA-256
`b0245701ec43d664c5d707a8f6fa974c19ca765756e20b20cda98fc801408c1d`
and expires 2027-01-09. Web CI 38180354390 also passed.

## 2026-10-12 main synchronization

Merged main `aefd7fe` (including merged #25) into this working branch without
conflicts. Independent `npm run check`, `npm test` (78 tests) and
`npm run build` pass. This preserves the original PR outcome while refreshing
its merge base and evidence; no new gameplay change was made.

## 2026-10-15 verifier regression fixtures

The real archive verifier is factored into one closure, called by both
`verifyDebugApk` and `verifyAssetVerifier`. Nine tiny synthetic ZIPs require an
exact match to pass and eight deliberate corruptions to fail with the expected
diagnostic: missing lazy chunk/worker, altered policy, obsolete chunk, missing
required policy, broken index/manifest paths and no CSS reference. Synthetic
icons/model contents are deliberately minimal; they test packaging checks, not
image/model decoding. `verifyDebugApk` depends on the fixture task, so CI cannot
skip the negative regressions. No installed failure was inferred or game code
changed. Reproduce: `gradle -p android lintDebug verifyDebugApk`.

Node 24.19/current-main check/80 tests/build pass. Local SDK/Gradle are absent;
the dated closing journal records the observed CI result, not assumed success.
