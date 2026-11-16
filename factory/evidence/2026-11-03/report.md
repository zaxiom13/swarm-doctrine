# 2026-11-03 evidence

## Trigger

The installed Android smoke rotated real gameplay and checked browser HUD bounds,
but did not compare the WebView's native window rectangle with Android system-bar
and display-cutout insets. Passing screenshots alone could not reject overlap or
double-insetting.

## Change

PR #26 head `8b71d48` adds one installed invariant after both landscape and
portrait rotation:

- read the decor view's root `WindowInsets`;
- combine system bars and display cutout on API 30+, with the legacy system-window
  inset path retained for API 26;
- require the fixture to expose at least one nonzero safe inset;
- require the WebView's left/top/right/bottom window bounds to equal the complete
  safe display rectangle exactly; and
- log decor size, safe insets, root padding and WebView bounds.

Exact equality rejects both content under bars/cutouts and duplicated safe padding.
No production behavior changed.

## Reproducible validation

Fresh main `886b3f4`, Node 24.22.1:

```sh
npm ci
npm run check
npm test
npm run build
```

Result: check passes, 80 tests pass, build passes. Baseline commit `08438a4`
exists locally.

PR #26 head:

```sh
git diff --check
npm ci
npm run check
npm test
npm run build
bash -n android/scripts/installed-smoke.sh
```

Result: check passes, 81 tests pass, build and shell syntax pass. The Java
instrumentation compiles in GitHub Actions because this runner has no Android SDK.
[Exact-head web run 41738720737](https://github.com/zaxiom13/swarm-doctrine/actions/runs/41738720737)
passes; deployment is skipped on the pull request.

Exact five-head integration:

```sh
git merge --no-edit origin/night/android-apk-assets \
  origin/night/world-spawn-invariant origin/night/net-conversion-flag \
  origin/night/android-renderer-recovery origin/night/offline-origin-variant
npm ci
npm run check
npm test
npm run build
```

Result: the exact heads merge without conflict; check passes, 84 tests pass and
the production build passes.

## Installed result

[Native run 41738720837](https://github.com/zaxiom13/swarm-doctrine/actions/runs/41738720837)
compiled lintDebug, the debug/test APKs and Robolectric tests successfully.

API 35 / WebView `124.0.6367.219` passes the complete installed offline,
Back/background, Rally/Freeze, renderer-recovery, saved Continue, update and
process-relaunch flow. The new measured geometry is:

| Orientation | Decor | Safe insets L/T/R/B | Frame padding | WebView bounds |
| --- | --- | --- | --- | --- |
| Landscape | 1920x1080 | 0 / 63 / 0 / 63 | 0 / 63 / 0 / 63 | 0 / 63 / 1920 / 1017 |
| Portrait | 1080x1920 | 0 / 63 / 0 / 63 | 0 / 63 / 0 / 63 | 0 / 63 / 1080 / 1857 |

The JUnit suite records one test, zero failures/errors/skips and 79.857 seconds.
[Artifact 13281165971](https://github.com/zaxiom13/swarm-doctrine/actions/runs/41738720837/artifacts/13281165971)
is 4,466,504 bytes with SHA-256
`3e973aaa12e34717aa5ae9bc533c2b724d646d0a3d18dc110fc12b1d10219228`.

API 26 / Chrome `69.0.3497.100` again reaches the packaged offline origin and
reports load progress 70, then stops servicing the scenario while RenderThread
repeats `eglCodecCommon` errors. The bounded job exits 124 before the new geometry
assertion, matching the existing independently localized emulator graphics stall.
[Artifact 13279553714](https://github.com/zaxiom13/swarm-doctrine/actions/runs/41738720837/artifacts/13279553714)
is 200,056 bytes with SHA-256
`2b6f3e59279be6ee918b47d4db9585920af6c2395cf506b70a61b04f85679a55`.
This is not called a minimum-device pass.

## Limitations

This is one finite emulator configuration per API, not proof for every device,
cutout shape or navigation mode. It does not cover audible output, physical/current
vendor API 26, all menus, low-memory writes, arbitrary schema migration or real
Firebase/WebRTC. No deployment, signing, permissions, bridge, mixed-content,
file-access, Firebase or billing configuration changed.
