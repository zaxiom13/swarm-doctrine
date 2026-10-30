# 2026-10-16 validation

Main `886b3f4db5650a6bcc4b2f628a51686e6c1da5cb` is unchanged. Fresh Node 24.19
npm ci/check/80 tests/build pass; check reports zero errors/warnings. No baseline
failure, new matched performance/balance result, model change or guide change.

## Native presentation investigation

[#26](https://github.com/zaxiom13/swarm-doctrine/pull/26) current `e2bc185`:
independent check/80 tests/build pass; [web CI 38824179084](https://github.com/zaxiom13/swarm-doctrine/actions/runs/38824179084)
passes. [Android CI 38824179090](https://github.com/zaxiom13/swarm-doctrine/actions/runs/38824179090)
also passes; installed results/paired image inspection follow below. Previous `6971d4a` functional process result remains historical;
its blank/retained Settings PNGs were explicitly rejected, not relabeled clean.

The follow-up requires actual visible Settings at current viewport size, heading
bounds, loaded fonts and completed page animations, plus native window focus.
After WebView visual readiness it waits for a submitted hardware frame, records
CSS/native geometry and captures the real window buffer via PixelCopy alongside
the full native display. No offscreen redraw or retries until a favorable image.
API 26-28 use a weaker next-draw fallback; no equivalence/installed-26 claim.

Primary contracts (read before implementation):

- [WebView visual callback](https://developer.android.com/reference/android/webkit/WebView#postVisualStateCallback(long,%20android.webkit.WebView.VisualStateCallback)) describes readiness for a subsequent draw, not current presentation.
- [Frame commit](https://developer.android.com/reference/android/view/ViewTreeObserver#registerFrameCommitCallback(java.lang.Runnable)) describes submission to the swap chain, not necessarily visibility on the display; hardware-only, API 29+.
- [PixelCopy](https://developer.android.com/reference/android/view/PixelCopy) copies queued window-surface pixels. Window-copy and full-display results must be inspected separately.

These contracts motivate diagnostics, not proof of this run's app behavior.
No production game/native security/navigation/permission change. Fresh installed
result and raw paired captures must be observed before closing this gap.

### Observed installed result

The single new native attempt passes lint/build, API 26/35 Robolectric callbacks,
the original installed smoke (XML one test, zero failures/errors/skips, 65.625s)
and both separate persistence stages (`OK (1 test)` each). API 35 / model
sdk_gphone64_x86_64 / WebView 124.0.6367.219 / fontScale=1.3. Ordinary app PID
4353 was externally stopped, no package PID remained, restore PID 4466.
No-default-network checks pass at actual launch/retry/save/relaunch/Continue;
checkpoint fields, record and loaded preferences remain correct. Test timing is
not a performance comparison or FPS claim.

[Downloaded native artifact](https://github.com/zaxiom13/swarm-doctrine/actions/runs/38824179090/artifacts/12015295441):
3,275,062-byte ZIP, verified SHA-256
`0adb796d9ec1cc7e48dd2ed813bec30151036578a38e03e5307577bfcdf85702`,
expires 2026-11-14. XML, stage output, geometry/focus/frame logs and all seven PNGs
were inspected. [Extracted evidence log](native-presentation-ci.log).

Paired Settings images now show the intended current-width Settings, not a blank
or retained portrait frame. App-window images: portrait 1080x1794 at native bounds
(0,63)-(1080,1857), landscape 1920x954 at (0,63)-(1920,1017). Full-display images
are 1080x1920/1920x1080 and preserve system bars. Heading/visible controls are
readable and in the usable viewport at this configuration; longer settings use
vertical scrolling, not a claim that every row fits at once. Initial native
viewport only: bottom settings/scroll gestures, other menus, cutouts and broader
font/device combinations still need native checks. Gameplay portrait/landscape
and native recovery captures also show the intended states with readable controls.

Logs show CSS document.hasFocus=false before the native readiness wait, then
focused=true/attached=true and hardware=true/frameCommit=true at window capture.
Together with the corrected paired images this supports a readiness/capture-race
interpretation, but does not isolate one universal cause of the old frames.
No production rendering fix was made or invented. Prior rejected captures remain
historical evidence; this run establishes a usable finite capture set, not
all-device presentation or first-frame latency assurance.

[Debug APK](https://github.com/zaxiom13/swarm-doctrine/actions/runs/38824179090/artifacts/12014531061):
3,670,751-byte ZIP, API SHA-256
`19e05335977e4150f499710806c881fcdf5190064632b70db62deb9b48dec243`.
This #26 build does not include #20's separate archive verifier. No signing key
committed or Play Store publication. API 26-28 fallback remains unperformed/weaker.

## Integration and browser regressions

All five PR heads merge automatically from main; check/83 tests/build pass.
Combined tree `4e7ae087fd9f43e227f356a80be213b0adfb3095` is a local unpublished
integration tree, reproducible by merging #20/#22/#23/#27/#26. An initial merge
from an older tree-equivalent local history produced local add/add/docs conflicts;
discarded its test output and aborted only that owned merge. Fresh main-based
merge is conflict-free. No GitHub merge or main push.

Fresh [controls/duels script](browser.cjs), [offline script](offline.cjs),
[Freeze script](freeze.cjs) run against production Vite preview; their adjacent
JSON files record the actual results. Run after npm ci/check/test/build, set
SWARM_ROOT to a combined worktree, PLAYWRIGHT_MODULE to Playwright and
CHROMIUM_PATH to Chromium; browser.cjs additionally uses OFFLINE_AFTER_CONTROLS=1
SKIP_CONTROLLED_WARMUP=1. Different local ports allow independent execution.

Chromium 153.0.8010.0: 390x844, 844x390 and 1280x720 controls/HUD bounds,
Back/Pause Settings, Escape, held-Rally rotation/release, edge input and restart
pass. Separate ready-charge/test-rival Freeze button/arena and Back/rotation
cancellation pass in both phone orientations. Cold offline Local/Tactician remain
finite; missing JS returns 503 text/plain; no controlled-online warmup. All four
first-visit/restart/rotation offline cases pass. Both local host/guest roles,
snapshots, rotation release, Freeze input, disconnect victory and rematch cleanup
pass with zero page errors. Same-partition BroadcastChannel, not real networking
or Android WebView proof. These suites do not certify native Settings pixels.

[Settings probe](settings.cjs)/[results](settings.json) additionally use real
Home navigation, sound toggle, page reload and Done/return to Home. At 390x844,
844x390, 320x568, 568x320 and 1280x720 the visible/settled viewport and heading
checks pass, saved choice stays selected and the bottom action can be scrolled
fully into view. Clear progress is inspected, never activated. Zero page errors.
The first probe timed out on an assumed exact text-only Done accessible name;
the arrow-style PageHead is now selected by its scoped control. Final probe
passes; no app defect inferred from that selector mistake. Still browser/DOM,
not native window/compositor evidence.

#20 `4193ba6`, #22 `acd0c36`, #23 `ab91651`, #27 `159439b` are unchanged since
the immediately preceding close. Their green current-head CI remains valid
history, not new native runs. #20's nine verifier fixtures/real APK comparison
and #26's normal-save/whole-process restart were already measured in that close;
no repeated CI batch is needed just to rename the date.

## Limits

Finite emulator/browser matrix, not all-device or smooth-FPS assurance. Local
SDK/Gradle/adb/KVM absent; use existing free CI, no larger/paid runner. Inspected
native Settings initial viewports do not certify every menu/scroll state. Physical/
API 26 installed/current WebView, audio, system gesture variants, abrupt write-
time kills, APK updates, broad cutouts/fonts and real Firebase/WebRTC remain gaps.
No deployment or Cloudflare preview activation; no authenticated account setup
available in this run, and repository secrets were not read/assumed missing.
