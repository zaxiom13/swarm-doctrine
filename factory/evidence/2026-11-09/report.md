# 2026-11-09 unobstructed native Freeze evidence

## Baseline and queue

- Main `886b3f4`; Node 24.22.1; npm ci, check, 80 tests and build pass.
- Performance reference `08438a4` exists; no performance or balance claim was made.
- Open improvement code heads: #20 `4193ba6`, #22 `acd0c36`, #23 `ab91651`,
  #26 `acddc66`, #27 `159439b`; #24 remains the single closing PR.
- All six PRs are open and mergeable with no comments or reviews.

## Reproduced trigger

The unchanged Android code reran at the documentation-only #26 head in
[42425613895](https://github.com/zaxiom13/swarm-doctrine/actions/runs/42425613895).
API 35 reached the landscape native Freeze probe with fixture id 160 still
present, but recorded no canvas pointer and no Freeze/miss event. Its native
touch log requested CSS `[648.99,318.06]`; the same run measured the 104 px
Freeze button centre at `[683.19,317.19]`. The points are 34 px apart, inside
the circular control, and the preserved full-display frame visibly shows the
target fleet behind that button.

This is evidence of a test-target flaw, not production coordinate damage:
Android consistently delivered the touch to the covering control and the canvas
correctly saw no pointer.

Failure artifact
[13595423424](https://github.com/zaxiom13/swarm-doctrine/actions/runs/42425613895/artifacts/13595423424):
13,873,980 bytes; SHA-256
`979e95a56146f58b1857abb462800e6961d964474dd767309472607d98e6248c`.

## Change

Code head `acddc66` chooses the canvas centre and requires
`document.elementFromPoint` to identify `game-canvas` before injecting input.
It inverts the current canvas/renderer transform for that exact CSS point and
places the dormant test rival at the resulting simulation coordinate. The
diagnostic object records hit owner, CSS/simulation coordinates, pointer and
emitted event.

Production TypeScript, Android application code, Freeze behavior, rules,
permissions, WebView security, storage and timeouts are unchanged.

## Validation and artifacts

- Local #26: diff check, check, 82 tests, production build pass.
- Exact five-head octopus integration: conflict-free; check, 85 tests, build pass.
- Exact web run:
  [42719563184](https://github.com/zaxiom13/swarm-doctrine/actions/runs/42719563184),
  pass; deploy skipped.
- Exact native run:
  [42719563217](https://github.com/zaxiom13/swarm-doctrine/actions/runs/42719563217).
  API 35 / WebView 124 passes the complete installed scenario. The recorded
  canvas pointer is `[365.71,181.71]`, CSS fixture `[366.10,182.10]`, simulation
  fixture `[723.96,360]`, target `game-canvas`; the emitted Freeze records the
  fixture present, one eligible rival, one victim, cooldown 10 and a live field.
- Later stages pass background/foreground audio/input cleanup, renderer crash
  recovery, saved process force-stop, versionCode 1→2 replacement install
  without clear-data, portrait/landscape Settings, restored state and Continue.
- Installed-smoke artifact
  [13721050085](https://github.com/zaxiom13/swarm-doctrine/actions/runs/42719563217/artifacts/13721050085):
  15,481,293 bytes; SHA-256
  `957f8e79c44218cfbfa1911f04a806e079c1fb422b4031c52bb8e586b7a0baea`.
- API 26 on the same run retains the independently localized emulator
  graphics-pipe stall after lint, APK/test-APK builds and renderer checks pass.

## Limitations

The finite API 35 emulator cannot prove all devices, providers, menus,
accessibility settings, navigation modes, cutouts, physical input timing or
audible output. Physical/current-vendor API 26, changed-schema/assets migration,
Freeze cooldown/re-aim and real Firebase/WebRTC were not tested. No deployment,
merge, auto-merge, production Firebase mutation or Play Store action occurred.
