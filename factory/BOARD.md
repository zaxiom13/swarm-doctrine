# Swarm Doctrine board

Updated 2026-10-11. Android remains a committed priority. Five improvement slots
remain occupied. Maintain these before adding
another batch. Merged code and archive/browser checks do not establish native
installed-device readiness.

## In review

| Card | Outcome | PR | Actual state and evidence |
| --- | --- | --- | --- |
| SD-011 | One Android Back policy; Pause Settings returns to the paused arena before resuming | [#19](https://github.com/zaxiom13/swarm-doctrine/pull/19) | Open, clean, mergeable. Web and Android CI pass at `30767cd`. Check/79 tests/build and portrait/landscape/desktop Back sequence. Card/report in its branch. |
| SD-012 | Verify the generated web tree exactly matches debug APK assets | [#20](https://github.com/zaxiom13/swarm-doctrine/pull/20) | Open, clean, mergeable. Exact-set `lintDebug verifyDebugApk` passes at `c4ea3de`; [verified APK](https://github.com/zaxiom13/swarm-doctrine/actions/runs/38180354394/artifacts/11717785558). Final evidence head `3e91270` also has green web/Android CI. Card/report in its branch. |
| SD-015 | Guard fleet spawn clearance over seeded aspect ratios | [#22](https://github.com/zaxiom13/swarm-doctrine/pull/22) | Open, clean, mergeable at `9046fce`; web/Android CI pass. The invariant now reads runtime `TerrainField.reach`, avoiding a duplicated black-hole constant. No overlap bug was found. [Card](cards/SD-015.md). |
| SD-014 | Clear stale conversion flashes on reused online guest ships | [#23](https://github.com/zaxiom13/swarm-doctrine/pull/23) | Open, clean, mergeable at `1908944`; web/Android CI pass. Regression now keeps the reused ship frozen across both frames. [Card](cards/SD-014.md). Real transport remains untested. |
| SD-016 | Escape closes one UI state at a time and works on focused dialog buttons | [#25](https://github.com/zaxiom13/swarm-doctrine/pull/25) | New, open, clean, mergeable. Final web/Android CI pass at `5366865`. Check/78 tests/build, browser document-event regression at 390×844, 844×390 and 1280×720. Card/report/repro script in its branch. |

No stack dependencies. All target main, still `cb7758e`. Combined local integration
merges automatically and passes check/82 tests/build. The committed #25 browser
exercise passes portrait/landscape/desktop dismissal, pause/resume and visible
control bounds. Prior touch, rotation, 45-state layout and cold-offline evidence
remains applicable because tonight changed only archive/test fidelity.
[Current evidence](evidence/2026-10-11/report.md).
No GitHub PR was merged, auto-merged or deployed by this run.

## Merged

| Card | Result | PR |
| --- | --- | --- |
| SD-001 | Packaged Android WebView shell and debug build | [#16](https://github.com/zaxiom13/swarm-doctrine/pull/16) |
| SD-002 | Clear held input on rotation/background, including online guest release | [#13](https://github.com/zaxiom13/swarm-doctrine/pull/13) |
| SD-003 | Home actions fit short landscape phones | [#17](https://github.com/zaxiom13/swarm-doctrine/pull/17) |
| SD-004 | Validate complete snapshots before guest mutation | [#14](https://github.com/zaxiom13/swarm-doctrine/pull/14) |
| SD-005 | Precache built chunks; missing assets never receive HTML fallback | [#15](https://github.com/zaxiom13/swarm-doctrine/pull/15) |
| SD-013 | Levels Continue preserves AI/passive rival choice | [#21](https://github.com/zaxiom13/swarm-doctrine/pull/21) |

Closing PR #18 merged. Closing PR [#24](https://github.com/zaxiom13/swarm-doctrine/pull/24)
now contains both the prior evening close and this run's journal/reconciliation,
so there is no duplicate board PR. Individual code cards live with their PRs;
this table reconciles their latest actual states.

## Next, in order

1. Install the verified debug APK on API 26 and 35+, record API/WebView/device versions,
   and test airplane-mode first launch, portrait/landscape, cutouts/system bars,
   font scaling, edge touches, Back, Rally/Freeze through rotation, audio/background,
   process recreation and checkpoint persistence across APK updates. SDK/emulator/KVM
   remain unavailable here; CI builds and browser tests are separate evidence.
2. Exercise real two-device Firebase/WebRTC lifecycle for both roles, including
   rotation, background, disconnect and rematch. Local/protocol tests cannot prove this.
3. Finish Cloudflare Worker/PR previews when authenticated Cloudflare access and
   repository deployment secrets are available. Main run
   [38035800992](https://github.com/zaxiom13/swarm-doctrine/actions/runs/38035800992)
   skipped deployment; this run did not deploy or modify credentials. Keep free configuration.
4. Test service-worker version A → B and APK update recovery, corrupted-checkpoint UX,
   and larger-font adaptive layouts in WebView.
5. Measure matched 160/320-ship workloads against `08438a4` before selecting speed work.

Interactive lessons remain hidden. Rules, shared Simulation/Commander and trained
policy remain unchanged. [Latest journal](journal/2026-10-11.md).
