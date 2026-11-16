# 2026-10-10 validation

Main baseline `cb7758ee40e6884cc31ed740f46f593ef4df92fc`: Node 24.19,
`npm ci && npm run check && npm test && npm run build` passed (77 tests).
No pre-existing failures. npm's existing proxy-setting warning is non-fatal.

Combined local branch `night/2026-10-10-integration` merges #19, #20, #22, #23
and #25 into main without conflicts after moving the new Escape test away from
the pending Back test insertion point. `npm run check && npm test && npm run build`
passes (82 tests). No rules/policy changes or standalone speed comparison.

Chromium 153.0.8010.0 / Playwright, production Vite preview:

- [Controls](controls.json): Pause Settings → Back → paused arena → Back → playing,
  plus Details → Escape → playing → Escape → paused → Escape → playing,
  at 390×844, rotation to 844×390 and 1280×720; no game-button overflow/page errors.
- [Browser smoke](browser.json): Home action bounds at 390×844, 844×390,
  640×360, 568×320 and 1280×720; fixed 1280×720 arena retains world size while
  rotation clears Freeze aim/pointer ID; actual touchCancel releases Rally,
  touch Freeze aim/cast and pause/resume pass.
- [Layout summary](layout-summary.json): 45 menu/HUD/coach/details/pause/result
  states across five viewports; zero horizontal overflow or horizontal control
  out-of-bounds, no HUD-group collisions. Long pages/sheets intentionally scroll.
- Offline production check: register worker online, reload under its control,
  disable context network, cold reload; 58 cached resources include hashed chunks,
  worker and offline policy. Local and Tactician first starts stay finite; missing
  JS returns 503 text/plain rather than HTML.

Reproduce shared event regression with #25's committed
`factory/evidence/SD-016/browser.cjs` after `npm ci && npm run build`; it documents
Playwright/Chromium path variables. Reproduce offline checks with production
`npm run preview`, DevTools offline mode and the sequence above. The browser
smoke/matrix scripts reuse the prior run's scratch harness; compact result files
are committed here rather than duplicate large screenshots.

## GitHub CI

- #19 head `30767cd`: [web 38091932247](https://github.com/zaxiom13/swarm-doctrine/actions/runs/38091932247),
  [Android lint/build 38091932246](https://github.com/zaxiom13/swarm-doctrine/actions/runs/38091932246) pass.
- #20 code `1b55b1d`: [expanded APK verifier 38091872069](https://github.com/zaxiom13/swarm-doctrine/actions/runs/38091872069) passes.
  [Artifact 11684382210](https://github.com/zaxiom13/swarm-doctrine/actions/runs/38091872069/artifacts/11684382210):
  zip 3,669,082 bytes, SHA-256 `50dde33cb270b35aae8ba53881fecc1371489722a73b101379df03386bc50ea7`.
  Final evidence head `9ebb6c7` also passes [web 38092176817](https://github.com/zaxiom13/swarm-doctrine/actions/runs/38092176817)
  and [Android 38092176825](https://github.com/zaxiom13/swarm-doctrine/actions/runs/38092176825).
- #25 final head `5366865`: [web 38092135673](https://github.com/zaxiom13/swarm-doctrine/actions/runs/38092135673)
  and [Android lint/build 38092135723](https://github.com/zaxiom13/swarm-doctrine/actions/runs/38092135723) pass.
- Unchanged #22/#23 remain clean/mergeable with prior successful web/Android CI;
  their regressions are included in the 82-test integration run.

These are browser, logic, lint and archive checks. Local SDK/Gradle/adb/emulator/KVM
are absent. Installed API/WebView behavior, native Back/system bars/audio/process
recreation, airplane-mode APK launch, APK update persistence and real two-device
Firebase/WebRTC were not tested. No production deployment or Firebase mutation.
