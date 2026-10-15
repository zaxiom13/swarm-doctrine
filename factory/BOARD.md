# Swarm Doctrine board

Updated 2026-10-16. Android remains a committed priority. Five improvement slots
are occupied after #19 merged: #20/#22/#23/#26/#27. Maintain these before adding
another batch. Merged code and archive/browser checks do not establish native
installed-device readiness.

## In review

| Card | Outcome | PR | Actual state and evidence |
| --- | --- | --- | --- |
| SD-012 | Verify the generated web tree exactly matches debug APK assets | [#20](https://github.com/zaxiom13/swarm-doctrine/pull/20) | Unchanged `4193ba6`; 10-15 check/80 tests/build and current-head web/Android CI remain green, not a new native run. All nine shared-verifier ZIP fixtures and actual lintDebug/verifyDebugApk passed. [Verified APK](https://github.com/zaxiom13/swarm-doctrine/actions/runs/38821195864/artifacts/12013980056). Card/report in its branch. |
| SD-015 | Guard fleet spawn clearance over seeded aspect ratios | [#22](https://github.com/zaxiom13/swarm-doctrine/pull/22) | Unchanged `acd0c36`; 10-15 check/81 tests/build pass; current-head 10-14 web/Android CI remains green. Runtime TerrainField reach covers 2,048 seeds x eight aspects. No overlap bug was found. [Card](cards/SD-015.md). |
| SD-014 | Clear stale conversion flashes on reused online guest ships | [#23](https://github.com/zaxiom13/swarm-doctrine/pull/23) | Unchanged `ab91651`; 10-15 check/81 tests/build pass; current-head 10-14 web/Android CI remains green. Frozen two-frame regression and both local-duel roles pass again. [Card](cards/SD-014.md). Real transport remains untested. |
| SD-017 | Recover from a crashed or reclaimed Android WebView renderer | [#26](https://github.com/zaxiom13/swarm-doctrine/pull/26) | `e2bc185` check/80 tests/build and fresh web/Android CI pass. Installed API 35 / WebView 124 / fontScale=1.3: original touch/rotation/recovery and process persistence pass; paired app-window/full-display Settings now show correct readable portrait/landscape states. Seven PNGs/logs/XML inspected. Prior rejected images retained, no invented production fix/all-device claim. [Evidence](https://github.com/zaxiom13/swarm-doctrine/actions/runs/38824179090/artifacts/12015295441), [card](https://github.com/zaxiom13/swarm-doctrine/blob/night/android-renderer-recovery/factory/cards/SD-017.md). |
| SD-018 | First offline reload reuses a safe public Origin variant | [#27](https://github.com/zaxiom13/swarm-doctrine/pull/27) | Unchanged `159439b`; 10-15 check/81 tests/build pass; current-head 10-14 web/Android CI remains green. Exact public URL and Origin-only Vary guard; fresh four-case offline matrix passes. [Card](https://github.com/zaxiom13/swarm-doctrine/blob/night/offline-origin-variant/factory/cards/SD-018.md). |

Main is `886b3f4`, which merged #19. All five PRs now target main with no
pending stack dependencies. Local merges were conflict-free. All five
merge automatically together and pass
check/83 tests/build. Browser evidence covers three viewports, both local-duel
roles and the previously failing immediate cold-offline path without warmup.
[Current evidence](evidence/2026-10-16/report.md).
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
   rejected. Next: native bottom scrolling/other menus/Freeze cooldown/cutouts,
   not an all-menu/all-device claim or guaranteed first-frame latency.
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
policy remain unchanged. [Latest journal](journal/2026-10-16.md).
