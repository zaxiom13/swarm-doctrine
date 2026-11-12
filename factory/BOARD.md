# Swarm Doctrine board

Updated 2026-11-11. Android remains a committed priority. Five improvement slots
are occupied after #19 merged: #20/#22/#23/#26/#27. Maintain these before adding
another batch. Merged code and archive/browser checks do not establish native
installed-device readiness.

## In review

| Card | Outcome | PR | Actual state and evidence |
| --- | --- | --- | --- |
| SD-012 | Verify the generated web tree exactly matches debug APK assets | [#20](https://github.com/zaxiom13/swarm-doctrine/pull/20) | Unchanged `4193ba6`; 10-19 check/80 tests/build and current-head web/Android CI remain green, not a new native run. All nine shared-verifier ZIP fixtures and actual lintDebug/verifyDebugApk passed. [Verified APK](https://github.com/zaxiom13/swarm-doctrine/actions/runs/38821195864/artifacts/12013980056). Card/report in its branch. |
| SD-015 | Guard fleet spawn clearance over seeded aspect ratios | [#22](https://github.com/zaxiom13/swarm-doctrine/pull/22) | Unchanged `acd0c36`; 10-19 check/81 tests/build pass; current-head 10-14 web/Android CI remains green. Runtime TerrainField reach covers 2,048 seeds x eight aspects. No overlap bug was found. [Card](cards/SD-015.md). |
| SD-014 | Clear stale conversion flashes on reused online guest ships | [#23](https://github.com/zaxiom13/swarm-doctrine/pull/23) | Unchanged `ab91651`; 10-19 check/81 tests/build pass; current-head 10-14 web/Android CI remains green. Frozen two-frame regression and both local-duel roles pass again. [Card](cards/SD-014.md). Real transport remains untested. |
| SD-017 | Recover from a crashed or reclaimed Android WebView renderer | [#26](https://github.com/zaxiom13/swarm-doctrine/pull/26) | Code `e91b3a1`, evidence `c38ec86`. The installed test now proves a successful native Freeze enters cooldown, rejects re-aiming while cooling, becomes ready again on the same charge, and then arms/cancels through real Android taps. Production input, rules and cooldown timing are unchanged. Exact API 35/WebView 124 passes native Freeze, portrait/landscape menus and Settings, safe areas, background/audio, renderer recovery, process force-stop, replacement install and Continue. API 26 retains its independent emulator graphics stall. [Evidence](evidence/2026-11-11/report.md). |
| SD-018 | First offline reload reuses a safe public Origin variant | [#27](https://github.com/zaxiom13/swarm-doctrine/pull/27) | Unchanged `159439b`; 10-19 check/81 tests/build pass; current-head 10-14 web/Android CI remains green. Exact public URL and Origin-only Vary guard; fresh four-case offline matrix passes. [Card](https://github.com/zaxiom13/swarm-doctrine/blob/night/offline-origin-variant/factory/cards/SD-018.md). |

Main is `886b3f4`, which merged #19. All five PRs target main with no
pending stack dependencies. Local merges were conflict-free. All five
merge automatically together and pass
check/85 tests/build again on 2026-11-11 with exact heads `4193ba6`, `acd0c36`,
`ab91651`, `e91b3a1` and `159439b`. [Current evidence](evidence/2026-11-11/report.md).
Fresh current-main check/80 tests/build and #26 check/82 tests/build pass. The exact #26 web workflows
pass. The API 35 persisted-Settings reopen failure reproduced on two unchanged runs:
the control received DOWN/UP but no click while Chromium displayed text selection.
Head `dd2f995` removes the blocking gap in the instrumentation path; exact native run
42310791880 passes the full API 35 installed path, including both process-persistence
stages. API 26's post-mount stall reproduces with both
requested emulator GPU modes before the Activity UI-thread evaluation runnable
executes; do not call the minimum-provider gap closed until the full native
scenario passes.
The prior fixture failures and API 35 control results remain recorded rather than
erased.
The later documentation-triggered run 42312102445 reproduced a separate native
Freeze fixture miss: the arena pointer arrived correctly, but the test's lone
moving target was no longer guaranteed eligible. Head `79a6240` pins that
test-only victim while the native event crosses the renderer. Exact run
42424879489 passes the full API 35 path and records 68 eligible ships, 34 victims,
cooldown 10 and a live field. This remains fixture reliability work, not a
production Freeze or coordinate fix.
The later evidence-only run 42425613895 exposed a different test-target flaw:
the fixture ship's CSS point `[648.99,318.06]` was inside the landscape Freeze
button centred at `[683.19,317.19]`, so no canvas pointer or event was expected.
Head `acddc66` selects the unobstructed canvas centre and verifies its owner
before placing the dormant enemy through the inverse live renderer transform.
Exact native run 42719563217 passes the full API 35 path; the canvas pointer and
successful Freeze event are recorded before later lifecycle/recovery/update/
Settings stages also pass. API 26 remains red at its known graphics-pipe stage.
Head `e91b3a1` extends that installed path through the post-cast cooldown and
ready-again transition, then verifies a second native tap cancels aiming. Exact
run 43124011457 passes API 35/WebView 124 with 80 eligible ships, 40 victims,
cooldown 10 and `cooldown-re-aim` in installed artifact 13901743858. Its API 26
job reaches offline app progress 70 and again stalls in `goldfish_pipe_wait_event`;
artifact 13902152251 preserves that independent limitation.
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

1. Run #26's installed scenario on a physical/current-vendor API 26 device, then complete the API 26 and 35 installed matrix,
   and test airplane-mode first launch, portrait/landscape, cutouts/system bars,
   font scaling, edge touches, Back, Rally/Freeze through rotation, audio/background,
   abrupt process death and checkpoint persistence across APK updates. SDK/emulator/KVM
   remain unavailable locally; installed API 35 coverage passes. API 26/Chrome 69
   mounts the offline installed game with no console error, but stops servicing
   the first post-mount Activity UI-thread runnable. Current
   expanded touch/larger-font/no-network smoke and inspected gameplay/Settings captures pass,
   distinct from browser tests. Normal-save/whole-process force-stop/persisted
   Settings assertions pass. Focus/visible-state/frame diagnostics and inspected
   paired Settings images now establish correct initial portrait/landscape
   viewports on the finite API 35 configuration. Exact native safe-display bounds
   now additionally reject system-bar overlap and double-insetting in both
   orientations on that configuration; arbitrary cutout shapes and navigation
   modes remain unproved. The 11-04 first-run menu geometry and Back route pass in
   both orientations. The first menu PNG set retained the preceding presented
   frame and remains rejected; exact-head run 42128388089 passes the repaired
   frame-commit + PixelCopy path, and inspection confirms current, horizontally
   unclipped Home/Modes/Team images in both orientations. All 12 app-window and
   full-display files have distinct hashes. That job later failed the separate
   persisted-Settings reopen assertion after its save stage passed. That same
   failure reproduced again on run 42130000675: the correct control received
   DOWN/UP but no click while Chromium displayed text selection. Head `dd2f995`
   queues DOWN without an idle wait and injects the already-queued UP synchronously,
   so renderer scheduling cannot stretch the synthetic hold. This is test-driver
   reliability work, not evidence that production coordinates were defective;
   exact run 42310791880 passes the full API 35 path and publishes installed-smoke
   artifact 13547893996. The 10-18 landscape Sound failure is historical; 10-19's corrected
   settled/hit-owned native probe passes both Sound directions, Back/reopen and
   final Continue, with actual scrollTop=0 top captures. Next: installed API 26,
   other menus/cutouts, audible audio and changed-schema/asset migration,
   not an all-menu/all-device claim or guaranteed first-frame latency. The
   scheduler-stretched 50 ms test sleep was repaired with immediate DOWN/UP
   injection and an encoded 50 ms event interval; API 35/WebView 124 now passes
   the full update/rotation path. This is a test-driver repair, not evidence that
   production touch coordinates were defective. The 11-06 documentation follow-up
   then emitted a real `freeze-miss` because its lone zero-velocity fixture could
   resume flocking before the delayed native tap. Head `79a6240` briefly pins a
   test-only enemy at a live player-safe point and restores all state afterward;
   exact run 42424879489 passes with 68 eligible ships and 34 victims. Artifact
   13595311561 preserves the event and complete installed scenario. The 11-09
   evidence rerun then showed that a later live ship position could sit behind
   the landscape Freeze button. Head `acddc66` now requires a canvas-owned
   centre point before placing its fixture; run 42719563217 passes the full API
   35/WebView 124 path and artifact 13721050085 preserves the result. Head
   `e91b3a1` additionally proves cooldown rejection and ready-again arm/cancel
   through native taps; run 43124011457 and artifact 13901743858 preserve the
   API 35 result. Next: physical/current-vendor API 26, other menus/cutouts,
   audible audio and changed-schema/assets migration.
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
policy remain unchanged. [Latest journal](journal/2026-11-11.md).
