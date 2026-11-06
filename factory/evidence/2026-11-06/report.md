# 2026-11-06 Android tap-delivery evidence

## Baseline and queue

- Main `886b3f4`; Node 24.22.1; npm ci, check, 80 tests and build pass.
- Performance reference `08438a4` exists; no performance or balance claim was made.
- Open improvement heads: #20 `4193ba6`, #22 `acd0c36`, #23 `ab91651`,
  #26 `dd2f995`, #27 `159439b`; #24 remains the single closing PR.
- All six PRs are open and mergeable with no comments or reviews.

## Reproduced trigger

Native run [42130000675](https://github.com/zaxiom13/swarm-doctrine/actions/runs/42130000675)
reran unchanged production/test code at the prior card-only head. API 35 passed
InstalledRecoveryTest and save-before-process-stop, then failed the landscape
`Settings reopens with native choice` assertion during restore.

The target was not clipped or mis-mapped. Immediately before injection it was
fully visible, owned its center hit point, and mapped CSS center
`[447.19,252.46]` to Android screen `[1173,725]`. The browser then recorded:

- pointerdown on Settings;
- pointerup on Settings;
- no click;
- screen remained `main-menu`.

The preserved failure frame displays Chromium's text-selection handles and
Copy/Share/Select all/Read aloud toolbar on the Settings label. This matches the
earlier preserved failure and upgrades the issue from a one-off timeout to a
reproduced test-driver failure.

## Change

Head `dd2f995` keeps the same CSS-to-native coordinate calculation and platform
touchscreen input. It queues DOWN asynchronously, then synchronously delivers an
already-queued UP with a 50 ms event-time dwell before waiting for application
idle. This removes the blocking interval in which a loaded software renderer can
fire Chromium's long-press selection timer. Pointer diagnostics now record
`performance.now()` for DOWN, UP and click.

Production TypeScript, Android application code, permissions, WebView security,
timeouts and assertions are unchanged.

## Validation and artifacts

- Local #26: diff check, check, 82 tests, production build pass.
- Exact five-head integration: conflict-free; check, 85 tests, build pass.
- Exact web run: [42310791859](https://github.com/zaxiom13/swarm-doctrine/actions/runs/42310791859), pass; deploy skipped.
- Prior failing API 35 artifact [13463336847](https://github.com/zaxiom13/swarm-doctrine/actions/runs/42130000675/artifacts/13463336847): 16,473,537 bytes; SHA-256 `ccb9c19ca61b08b373a3c7f6abf3d616b66b1057f456c240ea864aa62a921b06`.
- Exact repaired native run: [42310791880](https://github.com/zaxiom13/swarm-doctrine/actions/runs/42310791880). API 35 passes InstalledRecoveryTest plus both process-persistence stages, including force-stop, replacement APK install without clear-data, landscape restore and persisted Settings reopen. Installed-smoke artifact [13547893996](https://github.com/zaxiom13/swarm-doctrine/actions/runs/42310791880/artifacts/13547893996): 15,425,929 bytes; SHA-256 `4c91b2bf1b63aa744f93d12c76588e8557f06173783fd1350bdaa484c3409113`.
- API 26 on that run still fails only at the known emulator graphics-pipe smoke stage; lint, APK/test-APK builds and renderer callback checks pass before it.

## Limitations

The finite API 35/WebView 124 emulator cannot prove all devices, providers,
menus, accessibility settings or physical input timing. API 26 remains blocked
by its independently localized emulator graphics pipe. Physical/current-vendor
API 26, audible audio, arbitrary cutout/navigation arrangements, schema/assets
migration and real Firebase/WebRTC were not tested. No deployment, merge,
auto-merge, production Firebase mutation or Play Store action occurred.
