# 2026-10-18 evidence

Main `886b3f4`; first changed #26 `7e7b6eb`, then test-diagnostic follow-up
`216c7dd`, local tree `2fad2f782c9397a8d1610c5099289a8ba0f572ca` equals
REST tree. All five merge automatically; initial combined tree
`b2ca6750f5709812d3989d2a62cf99689613dfda`.
Final diagnostic follow-up combined tree
`0c8b520ec6f8ffaaf16056a369dd86061ee558bc` again passes check/83 tests/build.
Node 24.19: fresh npm ci/check/80 tests/build on main and #26; combined
npm ci/check/83 tests/build; shell syntax/diff checks pass. No baseline failure.
Unchanged #20 `4193ba6` independently passes fresh npm ci/check/80 tests/build;
#22 `acd0c36`, #23 `ab91651` and #27 `159439b` each pass 81 tests/check/build
after fresh npm ci. Their current-head historical CI remains green, not new
installed evidence. All owned worktrees are clean except the closing documents.

## Native

[Web CI 39170993940](https://github.com/zaxiom13/swarm-doctrine/actions/runs/39170993940)
passes; PR deployment is skipped.
[Android CI 39170993815](https://github.com/zaxiom13/swarm-doctrine/actions/runs/39170993815)
failed the pre-existing Freeze cast assertion before process/Settings stages.
Downloaded artifact [12153045567](https://github.com/zaxiom13/swarm-doctrine/actions/runs/39170993815/artifacts/12153045567),
3,219,806 bytes, SHA-256 fea3b20723c6e62c62ecb6fa8c0892cc86e8a6a6e2e9eba916af146b5fc0c2fe,
expires 2026-11-17. XML one test/one failure, 122.491s. Logs and all three PNGs
retained; failure image inspected: live Zen match and ready Freeze, not a crash.
Input/event history was not recorded, so cause is unresolved, not an app defect.
Follow-up records real successful emitted Freeze state and pointer diagnostics;
finite rule-derived cooldown protects the test rival from recruitment during
the native boundary. No direct casting call, runtime rules or permissions change.
[Second Android attempt 39171696118](https://github.com/zaxiom13/swarm-doctrine/actions/runs/39171696118)
and [web CI 39171696131](https://github.com/zaxiom13/swarm-doctrine/actions/runs/39171696131)
target `216c7dd`: web passes; Android fails in the new landscape Sound assertion.
No third native attempt was made. #26 is conflict-free but NOT ready to merge;
its native gate is red, despite the partial successes below.
Same existing Ubuntu runner/API 35 configuration and 20-minute job bound. No
local SDK/Gradle/adb/KVM; API 26-28 next-draw fallback remains unperformed.

Downloaded [second artifact 12152708496](https://github.com/zaxiom13/swarm-doctrine/actions/runs/39171696118/artifacts/12152708496),
4,409,984 bytes; verified SHA-256
235889b34d46995c4146fe6f54b3ca58a47a1f7ad1473572b926104dd6eb7b19,
expires 2026-11-17. Inspected logs/XML/stage outputs and all eleven PNGs:

- API 35 sdk_gphone64_x86_64 / Pixel 2 profile / WebView 124.0.6367.219 /
  fontScale=1.3. Original installed test passes, XML one test, zero failures/
  errors/skips, 58.552s. Native Freeze event records 10 victims/19 eligible,
  cooldown=10, field=true and an aiming pointer at emission. Real recovery,
  Back/rotation/background, no-network first mount/retry and original Continue
  assertions pass. Gameplay/recovery captures show their intended states.
- Save stage OK (1 test), 54.005s. Ordinary app PID 4563 externally force-stopped,
  no package PID remains, no clear-data/reinstall; restore PID 4681. Offline
  Home/checkpoint/record/runtime settings assertions pass before interaction.
- Portrait: two native down-drags reach bottom at scroll 758.095; both actions
  fit and paired captures show readable actions. One up-drag reaches Sound;
  real toggle/UI/runtime/storage, Back/Home/reopen and intact progress pass.
- Landscape: two down-drags reach bottom at scroll 741.714; paired captures show
  both readable actions. Two up-drags report Sound in bounds at scroll 321.524,
  but its native toggle/UI/runtime/storage predicate fails. Restore stage is
  one test/one failure, 81.432s. Landscape Back/reopen and final new-stage Continue
  are NOT reached, and the full process stage is NOT a pass.
- The landscape heading capture is a retained scrolled Audio viewport under a
  sticky header, not an initial/top-of-page capture. Native helper only checks
  heading/target rectangles within viewport; this does not establish hit testing
  or scrollTop=0. Do not claim all controls are unobscured from these bounds.

[Debug APK](https://github.com/zaxiom13/swarm-doctrine/actions/runs/39171696118/artifacts/12152179986):
3,670,747-byte ZIP, API digest
21106c95f0334e9f5afad46bdb3c790c4d139662c8c5fc3c820bc1728201b580,
expires 2027-01-16. This branch does NOT include #20's separate APK verifier;
do not call it archive-verified. Raw relevant excerpts are native-first-ci.log
and native-second-ci.log. Complete artifacts retain all failure evidence.

Reproduce with SDK/JDK/Gradle versions in android/README.md:
`npm ci`, `gradle -p android assembleDebugAndroidTest`,
`bash android/scripts/installed-smoke.sh`. Script enables airplane mode, disables
Wi-Fi/data and leaves the disposable test emulator at font_scale=1.3.

New test trigger: previous native Settings evidence covered only initial
portrait/landscape viewports. Actual gutter drags now must reach bottom controls,
Sound taps update UI/runtime/storage, Back returns Home, real Settings reopening
retains the choice, and progress/record/Continue remain intact after process stop.
Reset/Clear are inspected but never pressed. No production fix is claimed.

## Browser and incidents

Fresh Playwright download returned a truncated/non-ZIP archive on every built-in
retry. Packaged @sparticuz/chromium 153.0.0 installed successfully via npm; its
default extractor hit filesystem EINVAL on archive chown. Extracted the already
installed browser/fonts/SwiftShader into an owned scratch directory with tar-fs
chown:false (no ownership preservation needed, no permission escalation or app
change). Binary size 209,022,176 bytes. Scripts use Playwright's usual defaults
plus --no-sandbox, not the package's insecure-content/web-security flags.
These are tooling failures, not app defects. Chromium 153.0.8010.0 then passed:

- `browser.json`: portrait 390x844, landscape 844x390 and desktop 1280x720,
  edge-held Rally through rotation, Pause/Settings/Back/Escape, Freeze and restart,
  no HUD overflow. Cold offline Local/Tactician work without controlled-online
  warmup; finite positions, missing JS 503 text/plain. Both local duel roles,
  guest release/Freeze, disconnect victory and rematch cleanup; zero page errors.
- `offline.json`: first visit, match restart, rotation/restart and rotation/warm
  reload all mount successfully on cold offline reload, zero errors. Script
  exit alone is insufficient: inspected all four `passed:true` entries.
- `freeze.json`: real browser button→arena tap, Back/rotation cancel without
  charge, portrait/landscape, zero errors. Ready-charge/test-rival fixtures only.
  Controlled delayed observation advances shared Simulation past field expiry
  after the actual cast: live field gone, captured successful event retained.
  Demonstrates test sensitivity, not the native failure's unrecorded cause.
- `settings.json`: actual Home Settings navigation, Sound toggle/reload persists,
  five viewport heading/bottom-control bounds including 320x568/568x320 and
  desktop, Done returns Home, zero errors. Browser scrolling uses DOM helpers;
  it does not substitute for the new real-native-drag assertions.
- `settings-hit-test.json`: controlled 732x364 browser reproduction of the probe
  weakness. Move Sound under the existing sticky header without changing CSS;
  its entire rectangle is within viewport but elementFromPoint at its center is
  H2, not the input. A real tap leaves the choice unchanged. Zero page errors.
  This proves the bounding-only predicate is insufficient, not the exact native
  failure's root cause (native failure-state hit test was not recorded).

Next: make the native readiness predicate require the intended element to own
its tap point, wait for scrolling to settle, and require scrollTop=0 for captures
named top/initial. Log before/after input and hit-test state on failure. Then
rerun this finite native matrix; do not loosen the saved preference assertion or
change production CSS to compensate for an incorrectly aimed test touch.

Prior 2026-10-16 JSONs remain historical and unmodified.

Reproduce from this directory with `SWARM_ROOT` pointing to the combined checkout,
`PLAYWRIGHT_MODULE` pointing to Playwright and `CHROMIUM_PATH` to a working binary:
`OFFLINE_AFTER_CONTROLS=1 SKIP_CONTROLLED_WARMUP=1 node browser.cjs`,
`node offline.cjs`, `node freeze.cjs`, `node settings.cjs`,
`node settings-hit-test.cjs`.
Browser local multiplayer is two same-partition BroadcastChannel tabs, not real
Firebase/WebRTC. Production Vite preview is not Cloudflare or installed Android.
No performance/balance/model/guide change or new measurement is claimed.
