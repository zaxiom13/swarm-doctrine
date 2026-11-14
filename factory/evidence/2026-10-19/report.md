# 2026-10-19 evidence

Main `886b3f4`; #26 `c9fabe3`, local/REST tree
`c3de90b5d832be58c3fb478bb4927f89392aa697`. All five improvement branches merge
automatically; combined tree `9c490b49c4f65c4bd47c06d7596100c6a73f87a0`.
Node 24.19: fresh npm ci/check/80 tests/build on main and #26; combined
npm ci/check/83 tests/build; shell syntax/diff checks pass. No baseline failure.
Unchanged #20 `4193ba6` independently passes fresh npm ci/check/80 tests/build;
#22 `acd0c36`, #23 `ab91651`, #27 `159439b` each pass fresh npm ci/check/81
tests/build. Earlier current-head CI remains historical, not new native runs.

## Native

[Android CI 39338519309](https://github.com/zaxiom13/swarm-doctrine/actions/runs/39338519309)
and [web CI 39338519286](https://github.com/zaxiom13/swarm-doctrine/actions/runs/39338519286)
target `c9fabe3`; both pass. One fresh native attempt, no rerun. lintDebug,
assembleDebug, API 26/35 Robolectric callbacks, instrumentation compilation and
the API 35 installed smoke/save/restore stages pass. No local SDK/Gradle/adb/KVM,
paid runner or changed workflow limit.

[Native artifact 12228212893](https://github.com/zaxiom13/swarm-doctrine/actions/runs/39338519309/artifacts/12228212893):
downloaded ZIP 4,362,979 bytes, SHA256
`84baea7f783b6a4a5720c878bec6ff2955c7dfcdfddd6103a1036f10619c081d`,
expires 2026-11-18. Inspected its XML, logs and all eleven PNGs (four Settings
app-window crops, four paired full-display captures, portrait/landscape gameplay
and renderer recovery). API 35, sdk_gphone64_x86_64/google_apis, existing Pixel 2
profile, WebView com.google.android.webview 124.0.6367.219, fontScale 1.3.
Original installed XML: one test, zero failures/errors/skips, suite 73.627 seconds.
Separate save stage: OK (1 test), 51.875 seconds; restore: OK (1 test), 48.806 seconds.

The original native edge/Rally/rotation/Freeze/Back/background/explicit Resume,
renderer crash/retry and Continue/recreation checks pass. Durable Freeze event
records 17 victims/34 eligible with a field and cooldown 10 at emission; this
does not identify the exact cause of the older unrecorded failure. No-default-
network assertions pass at launch, game mount, renderer retry, save, relaunch and
after final Continue. Ordinary app PID 4243 was externally package-force-stopped;
no app PID remained, then restore instrumentation PID 4350 ran without reinstall
or clear-data between save and restore.

- Portrait: actual Settings root scrollTop 0 (zero up-drags); usable window
  1080x1794 at Rect(0,63-1080,1857), full display 1080x1920. Two down-drags reach
  bottom scroll 758.09521484375; one up-drag reaches Sound scroll 356.19049072265625.
  Sound rect x321.19049/y109.24405/54x32 in CSS viewport 412x684; center hit
  INPUT#setting-sound owns the point. Checkbox/runtime/stored false -> true.
- Landscape: actual root scrollTop 0 after two up-drags; usable window 1920x954
  at Rect(0,63-1920,1017), full display 1920x1080. Four down-drags reach bottom
  scroll 741.7142944335938; three up-drags reach Sound scroll 111.61904907226562.
  Rect x611.08929/y277.92264/54x32 in viewport 732x364; center hit
  INPUT#setting-sound owns the point. Checkbox/runtime/stored true -> false.

Both orientations pass native Back/Home/reopen with intact saved record/checkpoint;
final Continue restores expected level/team/seed/enemies. Top captures show actual
page-top Match content, not the prior retained Audio viewport. Both bottom actions
are readable/reachable and were not activated. Sticky headings still cover some
upper scrolled text: this is not an all-label/all-scroll-position layout claim.
No offscreen redraw, CSS override or favorable-frame screenshot retries were used.
Actual raw CI/input excerpts are retained in native-ci.log.

[Debug APK artifact 12227836676](https://github.com/zaxiom13/swarm-doctrine/actions/runs/39338519309/artifacts/12227836676)
has API-reported ZIP size 3,670,745 and digest
`c31237abd7630de55ed254265686e4dafed949ae0eabd3a6f0810ab220fbb2ca`,
expires 2027-01-17. That APK ZIP was not separately downloaded/byte-verified here;
#26 does not include #20's archive verifier. Not Play Store or all-device readiness.

Trigger: prior native landscape Sound tap failed after real scrolling; its helper
accepted in-viewport bounds despite a sticky header and called a retained scrolled
Audio viewport a top capture. Require stationary geometry/scroll, intended target
ownership of its center hit, native root scroll to origin and before/after Sound
diagnostics. No runtime Sound/CSS fix or weakened preference assertion.
Previous failures/artifacts and their unresolved exact causes remain in 10-18.

Reproduce on disposable emulator using android/README.md tool versions:
`npm ci`, `gradle -p android assembleDebugAndroidTest`, then
`bash android/scripts/installed-smoke.sh`. Leaves airplane mode/font_scale=1.3.
Success on one API/WebView/font configuration cannot prove all devices; API 26-28
capture fallback remains weaker/unperformed, not equivalent to API 35.

## Fresh browser results

Chromium 153.0.8010.0. The existing binary had been truncated to 76,306,432 bytes;
re-extracted installed @sparticuz/chromium 153.0.0 to owned scratch, complete binary
209,022,176 bytes. No package's insecure web-security/content flags are used:
Playwright defaults plus --no-sandbox, no production security change.

- `browser.json`: 390x844, 844x390 and 1280x720 controls, held-Rally rotation,
  Pause/Settings/Back/Escape, Freeze/restart/HUD bounds; cold-offline Local and
  Tactician with no controlled-online warmup, finite motion, missing JS 503/plain;
  both local duel roles, guest release/Freeze, disconnect/rematch cleanup. No errors.
- `offline.json`: all four first-visit/restart/rotation cold-reload cases have
  passed:true and no errors, inspected rather than inferred from exit status.
- `freeze.json`: button→arena cast and Back/rotation cancellation in both phone
  orientations; controlled shared-Simulation advance proves field expiry can
  precede a later observation while the real emitted event is retained.
- `settings.json`: real Home Settings/toggle/reload, five viewport bounds/scroll
  reachability (including 320x568/568x320), Done returns Home; no errors.
- `settings-hit-test.json`: at 732x364, the old in-bounds predicate accepts an
  occluded control and a real tap leaves it unchanged. Corrected predicate rejects
  it, then accepts an unobscured point and an actual tap updates checkbox/runtime/
  stored preference. No CSS override or direct preference mutation; controlled
  browser scroll fixtures only, not native gestures or the old failure's exact
  font/scroll reproduction. Native checks retain real Android drag/tap injection.

To avoid duplicating unchanged scripts, copy browser.cjs/offline.cjs/freeze.cjs/
settings.cjs from ../2026-10-18/ into a temporary directory and run there with
SWARM_ROOT pointing to the combined checkout, PLAYWRIGHT_MODULE to Playwright and
CHROMIUM_PATH to the binary. Run browser.cjs with OFFLINE_AFTER_CONTROLS=1 and
SKIP_CONTROLLED_WARMUP=1. The other three need no extra switches. Fresh outputs
are the JSONs in this directory; source scripts are byte-identical to 10-18.
New settings-hit-test.cjs runs here with the same environment.

Browser uses production Vite preview, not deployed Cloudflare or Android. Local
multiplayer is two same-partition BroadcastChannel tabs, not real Firebase/WebRTC.
No rules/model/balance/guide change or new performance measurement is claimed.
