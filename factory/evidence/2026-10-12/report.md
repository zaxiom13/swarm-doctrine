# 2026-10-12 validation

Main `aefd7fe22af379a86d44d0f2458b9d03566d5cab` merged #25. Node 24.19,
fresh `npm ci`, check, 78 tests and production build pass. No pre-existing
check/test/build failure. `08438a4` is available; no standalone matched speed or
balance comparison was measured. npm's proxy-setting warning is non-fatal.

Four retained PRs were synchronized with this main without local merge conflicts.
Each independently passed check/test/build and web/Android CI:

| PR | Head | Web tests | Web CI | Android CI |
| --- | --- | --- | --- | --- |
| #19 | `fcb353a` | 80 | [38319171941](https://github.com/zaxiom13/swarm-doctrine/actions/runs/38319171941) | [38319171958](https://github.com/zaxiom13/swarm-doctrine/actions/runs/38319171958) |
| #20 | `cd85a08` | 78 | [38319201253](https://github.com/zaxiom13/swarm-doctrine/actions/runs/38319201253) | [38319201240](https://github.com/zaxiom13/swarm-doctrine/actions/runs/38319201240) |
| #22 | `bc06487` | 79 | [38319268917](https://github.com/zaxiom13/swarm-doctrine/actions/runs/38319268917) | [38319268914](https://github.com/zaxiom13/swarm-doctrine/actions/runs/38319268914) |
| #23 | `c1efc12` | 79 | [38319233140](https://github.com/zaxiom13/swarm-doctrine/actions/runs/38319233140) | [38319233154](https://github.com/zaxiom13/swarm-doctrine/actions/runs/38319233154) |
| #26 | `9bc23eb` | 80 | [38319616466](https://github.com/zaxiom13/swarm-doctrine/actions/runs/38319616466) | [38319616521](https://github.com/zaxiom13/swarm-doctrine/actions/runs/38319616521) |

#26 is stacked on #19: merge #19 first. Its API 26/35 Robolectric suite proves
the inherited unhandled callback, crash/memory-kill cleanup, explicit fresh Home,
secure replacement settings and Back/pause/resume without a renderer. Android
lint and assembly also pass. Robolectric shadows do not run Chromium or prove
physical/emulated renderer kills, storage persistence, orientation or audio.

Debug artifacts (zip digests, not APK signing fingerprints):

- #20 exact-set `lintDebug verifyDebugApk`: [11778630087](https://github.com/zaxiom13/swarm-doctrine/actions/runs/38319201240/artifacts/11778630087),
  3,669,144 bytes, SHA-256 `a903f04cbd0c8b627f20d09e2889c8e926e2a71cf5d7a098fc4329cb481f9c7e`.
- #26 callback-tested shell: [11778455553](https://github.com/zaxiom13/swarm-doctrine/actions/runs/38319616521/artifacts/11778455553),
  3,670,747 bytes, SHA-256 `ae3f97780d5557b71c28048f94d599bb6673e6cb3f8260418eaa2d120095a5da`.
  This branch does not include #20's verifier; do not call this artifact archive-verified.

After preserving #19's native callback and separating #26's callback test step
from #20's packaging step, all five merge automatically into main. Combined
check/82 tests/build pass. No integration branch was published or deployed.

## Reproducible browser exercise

[browser.cjs](browser.cjs) and [browser.json](browser.json), Chromium 153.0.8010.0
on the combined production build:

- 390x844, 844x390 and 1280x720: Back from Pause Settings, Escape consumption,
  rotation during held Rally, edge pointer input, touch Freeze aim, pause/restart,
  and zero visible game-button overflow. These are browser viewport checks.
- Two tabs in the same storage partition with `?net=local`: each takes host and
  guest roles, receives snapshots, sends Rally/Freeze, clears guest/host Rally on
  rotation, stays finite, awards disconnect victory and cleans up for a rematch.
  BroadcastChannel does not cross isolated browser profiles; Firebase/WebRTC is
  not exercised.
- A fresh worker context: install online, reload under worker control, disable
  network, cold reload; both trained Local and Tactician rivals start and remain
  finite. The combined control context also passes with an explicit online
  worker-controlled reload before disabling network. Missing JS returns 503
  text/plain rather than HTML.

Reproduce after `npm ci && npm run build`:

```sh
PLAYWRIGHT_MODULE=/path/to/playwright CHROMIUM_PATH=/path/to/chromium \
  node factory/evidence/2026-10-12/browser.cjs
```

Set `SWARM_ROOT` to the combined worktree if running the script from the closing
board branch. That branch itself has no unmerged game fixes. Browser results
were written only after the full exercise passed.

An earlier cold-offline reload after the combined control sequence timed out
before mounting the game (empty body, worker controller present, no page error).
Removing request routing did not resolve it. A fresh worker-context diagnostic
and the isolated cold-start check above passed, as did the combined sequence
after an explicit worker-controlled online reload. Set both
`OFFLINE_AFTER_CONTROLS=1 SKIP_CONTROLLED_WARMUP=1` to retain the initial sequence
for further investigation; this report does not
claim its initial timeout is resolved or label it a shipped bug without isolating
the cause. Installed APK offline launch is separately untested.

Local SDK/Gradle/adb/emulator/KVM remain absent. Real Android lifecycle/Back/system
bars/rotation/audio/process recreation and real two-device networking remain
outstanding. No rules, guide, balance or trained-policy change was made. No
Cloudflare deployment credentials are available through this session; previously
inspected main run 38035800992 skipped deploy. No Worker, PR preview, production
Firebase mutation, paid call, signing-key change or Play Store action occurred.
