# 2026-10-15 validation

Main remains `886b3f4db5650a6bcc4b2f628a51686e6c1da5cb`. Node 24.19,
fresh npm ci, check (zero errors/warnings), 80 tests and build pass. No baseline
failure. Performance reference `08438a4` exists but no new matched performance/
balance measurement or baseline replacement was made.

## Changed Android branches

| PR | Head | Local checks | Fresh web CI | Fresh Android CI |
| --- | --- | --- | --- | --- |
| [#20](https://github.com/zaxiom13/swarm-doctrine/pull/20) | `4193ba6` | check/80 tests/build | [38821195994](https://github.com/zaxiom13/swarm-doctrine/actions/runs/38821195994), pass | [38821195864](https://github.com/zaxiom13/swarm-doctrine/actions/runs/38821195864), pass |
| [#26](https://github.com/zaxiom13/swarm-doctrine/pull/26) | `6971d4a` | check/80 tests/build; shell syntax | [38822187858](https://github.com/zaxiom13/swarm-doctrine/actions/runs/38822187858), pass | [38822187818](https://github.com/zaxiom13/swarm-doctrine/actions/runs/38822187818), pass; Settings visual evidence incomplete |

#20 adds nine small synthetic APK ZIP fixtures sharing the actual verifier:
exact accepted; missing lazy chunk/worker, altered policy, obsolete chunk,
missing mandatory policy, broken index/manifest references and missing CSS
reference rejected with their expected diagnostic. No invented app defect.
[Downloaded CI log excerpt](asset-verifier-ci.log) confirms all nine PASS
diagnostics followed by verifyDebugApk and BUILD SUCCESSFUL. Real lintDebug and
APK exact-set/byte comparison pass. [Verified debug APK](https://github.com/zaxiom13/swarm-doctrine/actions/runs/38821195864/artifacts/12013980056):
3,669,126-byte ZIP, API-reported SHA-256
`99a17938b0049e43a1a4155562aa035b087277ff3509012eff93333189f3e21d`,
expires 2027-01-13. Archive evidence is not installed-process proof.

#26's new process test invokes the real save functions for deterministic sector/
settings/record fixtures, backgrounds normally, then finishes that instrumentation
stage. The external script launches the ordinary app, requires a package PID,
force-stops the whole package, requires no PID remains and runs restore in a
second instrumentation process without intervening reinstall/data clear. It
requires offline Home startup, checkpoint fields, best record, loaded preferences,
Settings portrait/landscape PNGs and Continue. Runner output must explicitly
report one successful test for each bounded stage. Test creation/local web
checks are not installed-app evidence; native outcomes follow when observed.

This is normal-save/background plus force-stop, not a memory-pressure kill during
an incomplete write, reboot/task restoration or APK-update persistence. Fixture
scores/sectors are not earned gameplay outcomes. Production game, native security
settings, permissions and navigation remain unchanged by this update.

First native attempt [38821176095](https://github.com/zaxiom13/swarm-doctrine/actions/runs/38821176095)
at `a70edac` passed lint/build, callback tests, the existing installed smoke
(XML one test, zero failures/errors/skips, 151.655s) and the new save stage
(`OK (1 test)`). It then stopped with `rg: command not found` in the shell output
validator, before ordinary-app force-stop/restore. No process-persistence pass
is claimed from that incomplete run. [Retained artifact](https://github.com/zaxiom13/swarm-doctrine/actions/runs/38821176095/artifacts/12013501723):
2,184,927-byte ZIP, downloaded SHA-256
`5274a9d65bd60638886a19f28ab102ea4a73de8c1b6d143bc42c1f7a02571a91`.
Inspected XML, stage output and logs show API 35 / WebView 124.0.6367.219 /
fontScale=1.3 and no-network first launch/retry/save. This is a runner dependency
failure, not an app defect. `6971d4a` uses standard grep without installing a
new runner dependency; complete fresh native result must be observed.

### Final installed result and visual limitation

`6971d4a` passes the fresh web/Android jobs above: lint/build, API 26/35
Robolectric callbacks, real installed original smoke (XML one test, zero failures/
errors/skips, 90.658s), and both separate persistence stages (`OK (1 test)` each).
Downloaded logs show API 35 / sdk_gphone64_x86_64 / WebView 124.0.6367.219 /
fontScale=1.3. Save-stage PID was 4094, ordinary-app PID 4274; after external
force-stop no package PID remained, then restore instrumentation PID was 4385.
No reinstall/data clear occurred between save and restore. No-default-network
checks pass at actual first launch, renderer retry, persistence save, relaunch
and Continue. Checkpoint fields, record, runtime audio preferences, rendered
saved controls and Continue assertions all pass; no live match is restored.

[Final native evidence](https://github.com/zaxiom13/swarm-doctrine/actions/runs/38822187818/artifacts/12013897839):
2,323,565-byte ZIP, downloaded SHA-256
`0e45807f94183fe047426ba1dd2beaf76bb92a920ea0d87865164b68cfea9687`,
expires 2026-11-14. Inspected XML, both stage outputs, process-stop/PID proof,
filtered logs and all five PNGs. Gameplay portrait/landscape and native recovery
([process/log excerpt](native-process-ci.log))
captures show the intended states, HUD controls fit usable space and recovery is
readable. **Reject the new Settings PNGs as layout proof**: portrait is blank;
landscape retains a portrait-width Settings frame. Their visualState=true marker
and functional DOM/orientation checks do not prove presentation completion.
Capture timing versus an actual first-presented-frame problem is unresolved;
do not label this a proven app layout defect or a clean Settings visual pass.
Next run should reproduce with app-window/presentation readiness before claiming
native menu coverage. Stop at this qualified result rather than repeatedly
changing gameplay or running more CI just to obtain a favorable screenshot.

[Current debug APK](https://github.com/zaxiom13/swarm-doctrine/actions/runs/38822187818/artifacts/12013127463):
3,670,749-byte ZIP; API-reported SHA-256
`238969144858272f10bc01180ab7b53fc2ecce07c9cebbc35b2423d958dbe0cb`.
This separate #26 APK does not include #20's archive verifier. No audible-audio,
physical-device, all-menu/all-device or FPS assurance follows from these results.

## Integration and unchanged slots

All five merge automatically together into main; check/83 tests/build pass.
Local integration tree is `e666740a48b0d9fdb2eda39111a41da16522aa79`
(unpublished merge commit; reproduce by merging the five listed PR heads).
#22 `acd0c36`, #23 `ab91651`, #27 `159439b` remain unchanged, main-based and
mergeable. Their prior current-head CI is still green (dated 2026-10-14 report);
no pointless code push was made to relabel that evidence as fresh native testing.
Each unchanged branch also passed fresh npm ci/check/81 tests/build locally.
Fresh combined regression testing covers their interaction with these changes.

[Browser script](browser.cjs)/[results](browser.json), [offline script](offline.cjs)/
[results](offline.json), [Freeze script](freeze.cjs)/[results](freeze.json) use
Chromium 153.0.8010.0 against a production Vite preview of the combined tree.
390x844, 844x390 and 1280x720: Escape, Back/Pause Settings, held Rally rotation,
edge pointer/release, pause/restart and visible HUD bounds pass. Separate actual
Freeze button/arena tap and Back/rotation cancellation pass in both phone
orientations using a ready-charge/test-rival fixture. Cold offline Local and
Tactician play stays finite; no controlled online warmup, missing JS stays
503 text/plain. All four first-visit/restart/rotation offline cases pass. Both
host/guest roles, snapshots, Rally release, Freeze input, disconnect victory and
rematch cleanup pass with zero page errors. Same-partition BroadcastChannel tabs
are not Firebase/WebRTC, isolated profiles or installed Android proof.

Reproduce with npm ci/check/test/build in a combined worktree, then set SWARM_ROOT
to that directory, PLAYWRIGHT_MODULE to Playwright and CHROMIUM_PATH to Chromium.
Run browser.cjs with OFFLINE_AFTER_CONTROLS=1 SKIP_CONTROLLED_WARMUP=1; run
offline.cjs and freeze.cjs separately. Scripts use different local preview ports.
Cached local Chromium was truncated before execution; re-extracted the existing
package/helper (209,022,176-byte binary) before running. No shipped crash inferred.

## Boundaries and handoff

API 26 installed/current WebView, physical devices, audible audio, system Back
variants, abrupt kills during writes/APK updates, broad cutout/font matrices and
real Firebase/WebRTC remain unverified. Local SDK/Gradle/adb/KVM are unavailable;
native checks use the existing free CI runner, no paid upgrade. Cloudflare
authenticated setup remains unavailable; current PR workflow does not deploy
or give preview URLs. No repository secrets were read/assumed absent. No direct
main/master push, PR merge/auto-merge, deployment, Play Store action, paid call/
hosting/relay/runner, billing change or production Firebase mutation occurred.
