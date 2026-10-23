# 2026-10-11 validation

Main baseline `cb7758ee40e6884cc31ed740f46f593ef4df92fc`: Node 24.19,
fresh `npm ci`, `npm run check`, `npm test` (77 tests) and `npm run build`
passed. No pre-existing failures. Commit `08438a4` is present, but no standalone
matched performance or balance comparison was run. npm's existing proxy-setting
warning is non-fatal.

A local integration branch merged #19, #20, #22, #23 and #25 into main without
conflicts. `npm run check && npm test && npm run build` passed (82 tests). The
committed #25 browser exercise passed Details/Escape ownership, pause/resume and
visible game-control bounds under Chromium 153 at 390x844 portrait, 844x390
landscape and 1280x720 desktop. Reproduce it with
`factory/evidence/SD-016/browser.cjs` after installing dependencies and building.

Tonight's changes were narrow test/archive-strengthening work:

- #20 at code head `c4ea3de`: its APK verifier now rejects extra packaged web
  assets as well as missing or byte-mismatched assets. Independent check, 77
  tests and build pass. Web [38180354390](https://github.com/zaxiom13/swarm-doctrine/actions/runs/38180354390)
  and Android [38180354394](https://github.com/zaxiom13/swarm-doctrine/actions/runs/38180354394)
  pass, including `lintDebug verifyDebugApk`. [Artifact 11717785558](https://github.com/zaxiom13/swarm-doctrine/actions/runs/38180354394/artifacts/11717785558)
  is 3,669,086 bytes with SHA-256
  `b0245701ec43d664c5d707a8f6fa974c19ca765756e20b20cda98fc801408c1d`;
  it expires 2027-01-09. Final evidence-only head `3e91270` also passes web
  [38180560493](https://github.com/zaxiom13/swarm-doctrine/actions/runs/38180560493)
  and Android [38180560497](https://github.com/zaxiom13/swarm-doctrine/actions/runs/38180560497).
- #22 head `9046fce`: the 2,048-seed/eight-aspect spawn invariant now reads
  hazard reach through runtime `TerrainField.reach`, avoiding a duplicated
  black-hole multiplier. Independent check, 78 tests and build pass. Web
  [38180303896](https://github.com/zaxiom13/swarm-doctrine/actions/runs/38180303896)
  and Android [38180303902](https://github.com/zaxiom13/swarm-doctrine/actions/runs/38180303902)
  pass. The broader audit still found no generated overlap.
- #23 head `1908944`: the two-frame guest conversion regression now proves the
  reused ship remains frozen while the transient flag clears. Independent check,
  78 tests and build pass. Web [38180330944](https://github.com/zaxiom13/swarm-doctrine/actions/runs/38180330944)
  and Android [38180330935](https://github.com/zaxiom13/swarm-doctrine/actions/runs/38180330935)
  pass.

No source, rules, guide, balance or trained-policy change was made outside those
three existing branches. The previous broader touch, rotation, 45-state layout,
cold-offline and offline-rival evidence remains applicable because the runtime
code did not change tonight.

Local Android SDK, Gradle, adb, emulator and KVM remain unavailable. Installed
API/WebView lifecycle, native Back/system bars/audio/process recreation,
airplane-mode APK launch, APK update persistence and real two-device
Firebase/WebRTC were not tested. Main workflow
[38035800992](https://github.com/zaxiom13/swarm-doctrine/actions/runs/38035800992)
passed tests but skipped deployment; no Cloudflare credentials, deployment,
production Firebase mutation or Play Store action was performed.
