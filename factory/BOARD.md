# Swarm Doctrine board

Updated 2026-10-23. Android remains a committed priority. Five improvement slots
are occupied after #19 merged: #20/#22/#23/#26/#27. Maintain these before adding
another batch. Merged code and archive/browser checks do not establish native
installed-device readiness.

## In review

| Card | Outcome | PR | Actual state and evidence |
| --- | --- | --- | --- |
| SD-012 | Verify the generated web tree exactly matches debug APK assets | [#20](https://github.com/zaxiom13/swarm-doctrine/pull/20) | Unchanged `4193ba6`; 10-19 check/80 tests/build and current-head web/Android CI remain green, not a new native run. All nine shared-verifier ZIP fixtures and actual lintDebug/verifyDebugApk passed. [Verified APK](https://github.com/zaxiom13/swarm-doctrine/actions/runs/38821195864/artifacts/12013980056). Card/report in its branch. |
| SD-015 | Guard fleet spawn clearance over seeded aspect ratios | [#22](https://github.com/zaxiom13/swarm-doctrine/pull/22) | Unchanged `acd0c36`; 10-19 check/81 tests/build pass; current-head 10-14 web/Android CI remains green. Runtime TerrainField reach covers 2,048 seeds x eight aspects. No overlap bug was found. [Card](cards/SD-015.md). |
| SD-014 | Clear stale conversion flashes on reused online guest ships | [#23](https://github.com/zaxiom13/swarm-doctrine/pull/23) | Unchanged `ab91651`; 10-19 check/81 tests/build pass; current-head 10-14 web/Android CI remains green. Frozen two-frame regression and both local-duel roles pass again. [Card](cards/SD-014.md). Real transport remains untested. |
| SD-017 | Recover from a crashed or reclaimed Android WebView renderer | [#26](https://github.com/zaxiom13/swarm-doctrine/pull/26) | `5dfd889`: diagnostic evidence localized the final landscape failure to a scheduler-stretched synthetic long press, not incorrect coordinates. Immediate injection with a 50 ms event-time interval passes the full API 35/WebView 124 offline recovery and v1 -> `adb install -r` v2 persistence path, including portrait/landscape native Settings/Sound/Back/reopen and Continue. Eleven captures inspected; web/native CI green. Ready for review on this finite matrix. [Evidence](evidence/2026-10-23/report.md). |
| SD-018 | First offline reload reuses a safe public Origin variant | [#27](https://github.com/zaxiom13/swarm-doctrine/pull/27) | Unchanged `159439b`; 10-19 check/81 tests/build pass; current-head 10-14 web/Android CI remains green. Exact public URL and Origin-only Vary guard; fresh four-case offline matrix passes. [Card](https://github.com/zaxiom13/swarm-doctrine/blob/night/offline-origin-variant/factory/cards/SD-018.md). |

Main is `886b3f4`, which merged #19. All five PRs target main with no
pending stack dependencies. Local merges were conflict-free. All five
merge automatically together and pass
check/83 tests/build again on 2026-10-23. Browser evidence covers three viewports, both local-duel
roles and the previously failing immediate cold-offline path without warmup.
[Current evidence](evidence/2026-10-23/report.md). Fresh current-main and #26
check/test/build pass. 2026-10-20 browser controls/offline/Freeze/Settings and
both local-duel roles passed with zero page errors. #26 update install and saved
state now pass through both orientations and final Continue; the prior red runs
and their test-driver diagnosis remain recorded rather than erased.
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
| SD-011 | One Android Back policy; Pause Settings returns to the still-paused arena | [#19](https://github.com/zaxiom13/swarm-doctrine/pull/19) |

Closing PR #18 merged. Closing PR [#24](https://github.com/zaxiom13/swarm-doctrine/pull/24)
now contains the prior closes and this run's journal/reconciliation,
so there is no duplicate board PR. Individual code cards live with their PRs;
this table reconciles their latest actual states.

## Next, in order

1. Install the verified debug APK on API 26 and 35+, record API/WebView/device versions,
   and test airplane-mode first launch, portrait/landscape, cutouts/system bars,
   font scaling, edge touches, Back, Rally/Freeze through rotation, audio/background,
   abrupt process death and checkpoint persistence across APK updates. SDK/emulator/KVM
   remain unavailable locally; prior installed API 35 coverage passed. Current
   expanded touch/larger-font/no-network smoke and inspected captures now pass,
   distinct from browser tests. Normal-save/whole-process force-stop/persisted
   Settings assertions pass. Focus/visible-state/frame diagnostics and inspected
   paired Settings images now establish correct initial portrait/landscape
   viewports on the finite API 35 configuration. Prior blank/retained PNGs remain
   rejected. The 10-18 landscape Sound failure is historical; 10-19's corrected
   settled/hit-owned native probe passes both Sound directions, Back/reopen and
   final Continue, with actual scrollTop=0 top captures. Next: installed API 26,
   other menus/Freeze cooldown/cutouts, audible audio and changed-schema/asset migration,
   not an all-menu/all-device claim or guaranteed first-frame latency. The
   scheduler-stretched 50 ms test sleep was repaired with immediate DOWN/UP
   injection and an encoded 50 ms event interval; API 35/WebView 124 now passes
   the full update/rotation path. This is a test-driver repair, not evidence that
   production touch coordinates were defective.
2. Exercise real two-device Firebase/WebRTC lifecycle for both roles, including
   rotation, background, disconnect and rematch. Local/protocol tests cannot prove this.
3. Finish Cloudflare Worker/PR previews when authenticated Cloudflare access and
   repository deployment secrets are available. Main run
   [38035800992](https://github.com/zaxiom13/swarm-doctrine/actions/runs/38035800992)
   skipped deployment; this run did not deploy or modify credentials. Keep free configuration.
4. Test service-worker version A → B and APK update recovery, corrupted-checkpoint UX,
   and larger-font adaptive layouts in WebView.
5. Existing seeded 160/320-ship pre-rewrite comparison was measured on 2026-10-13;
   real canvas/worker/frame costs still need device measurements before tuning.

Interactive lessons remain hidden. Rules, shared Simulation/Commander and trained
policy remain unchanged. [Latest journal](journal/2026-10-23.md).
