# Swarm Doctrine board

Updated 2026-10-12. Android remains a committed priority. Five improvement slots
are occupied: four retained PRs and one new renderer-recovery PR. Maintain these before adding
another batch. Merged code and archive/browser checks do not establish native
installed-device readiness.

## In review

| Card | Outcome | PR | Actual state and evidence |
| --- | --- | --- | --- |
| SD-011 | One Android Back policy; Pause Settings returns to the paused arena before resuming | [#19](https://github.com/zaxiom13/swarm-doctrine/pull/19) | Open, synchronized with main at `fcb353a`; web/Android CI pass. Check/80 tests/build and current portrait/landscape/desktop exercise. Card/report in its branch. |
| SD-012 | Verify the generated web tree exactly matches debug APK assets | [#20](https://github.com/zaxiom13/swarm-doctrine/pull/20) | Open, synchronized at `cd85a08`; web/Android CI and `lintDebug verifyDebugApk` pass; [fresh verified APK](https://github.com/zaxiom13/swarm-doctrine/actions/runs/38319201240/artifacts/11778630087). Card/report in its branch. |
| SD-015 | Guard fleet spawn clearance over seeded aspect ratios | [#22](https://github.com/zaxiom13/swarm-doctrine/pull/22) | Open, synchronized at `bc06487`; web/Android CI pass. Runtime TerrainField reach covers 2,048 seeds x eight aspects. No overlap bug was found. [Card](cards/SD-015.md). |
| SD-014 | Clear stale conversion flashes on reused online guest ships | [#23](https://github.com/zaxiom13/swarm-doctrine/pull/23) | Open, synchronized at `c1efc12`; web/Android CI pass. Frozen two-frame regression and both local-duel roles pass. [Card](cards/SD-014.md). Real transport remains untested. |
| SD-017 | Recover from a crashed or reclaimed Android WebView renderer | [#26](https://github.com/zaxiom13/swarm-doctrine/pull/26) | New, stacked on #19: merge #19 first. Web/Android CI pass at `9bc23eb`, including API 26/35 Robolectric callback tests. Explicit fresh Home, safe null-renderer lifecycle, scrollable retry. [Card](https://github.com/zaxiom13/swarm-doctrine/blob/night/android-renderer-recovery/factory/cards/SD-017.md). Real renderer kill remains untested. |

Main is `aefd7fe`, which merged #25. Four retained PRs target main; #26 targets
#19's branch to preserve the shared Back policy. After separating its CI test
step from #20's packaging gate, all five merge automatically together and pass
check/82 tests/build. Current browser evidence covers controls/rotation at three
viewports and two local-duel role rounds.
[Current evidence](evidence/2026-10-12/report.md).
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
| SD-016 | Escape closes one state at a time and works on focused dialog buttons | [#25](https://github.com/zaxiom13/swarm-doctrine/pull/25) |

Closing PR #18 merged. Closing PR [#24](https://github.com/zaxiom13/swarm-doctrine/pull/24)
now contains the prior closes and this run's journal/reconciliation,
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
policy remain unchanged. [Latest journal](journal/2026-10-12.md).
