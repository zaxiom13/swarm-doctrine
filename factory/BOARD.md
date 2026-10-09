# Swarm Doctrine board

Updated 2026-10-09. Android is a continuing priority until native device evidence supports it. An open PR is not a shipped feature. Five improvement slots are occupied; the next run should maintain these before creating overlapping work.

## In review

| Card | Outcome | PR | Status and evidence |
| --- | --- | --- | --- |
| SD-001 | Offline packaged Android WebView shell and debug build | [#16](https://github.com/zaxiom13/swarm-doctrine/pull/16) | Draft; web checks, Android lint and native debug APK CI pass; device checks outstanding. [APK artifact](https://github.com/zaxiom13/swarm-doctrine/actions/runs/37929872110/artifacts/11615672728). Lint found and fixed an API 26 theme compatibility error. Evidence in PR branch: `factory/evidence/SD-001/`. |
| SD-002 | Clear held controls on rotation/background, including online guest release | [#13](https://github.com/zaxiom13/swarm-doctrine/pull/13) | Open; web CI passes; 68 tests plus browser touch/rotation and two-context local duel exercises. Evidence: `factory/evidence/SD-002/`. |
| SD-003 | Home actions fit short landscape phones | [#17](https://github.com/zaxiom13/swarm-doctrine/pull/17) | Open; five Home viewport measurements plus a 45-state menu/HUD/dialog matrix with no horizontal overflow, out-of-bounds controls or HUD collisions. Evidence: `factory/evidence/SD-003/`. |
| SD-004 | Validate an entire duel snapshot before guest mutation | [#14](https://github.com/zaxiom13/swarm-doctrine/pull/14) | Open; web CI passes; 74 tests, malformed-frame regression cases, existing valid-frame coverage. Evidence: `factory/evidence/SD-004/`. |
| SD-005 | Precache production chunks; missing assets never return HTML | [#15](https://github.com/zaxiom13/swarm-doctrine/pull/15) | Open; web CI passes; 67 tests, cold offline browser reload and first-start offline rivals. Evidence: `factory/evidence/SD-005/`. |

All five independently target main at `2e10c82981c8c77e2f51c77205aca0e7ad3947e5`. None depends on a Light the Path setup PR. Their combined local integration passes check/test/build (77 tests); the integration branch is not published. This board PR contains documentation only and may be merged independently.

## Next, in order

1. **SD-006: Native verification of SD-001.** Install the lint-clean debug APK on API 26 and 35+ (when tools are available), record device/API/WebView versions, verify airplane-mode first launch, safe areas/system bars, rotation, Back, pause/resume/audio, process recreation and checkpoint persistence. Keep #16 draft until native evidence exists; repair its existing branch rather than duplicate the shell.
2. **SD-007: Full gameplay layout matrix.** Measure HUD, Settings, Levels, pause/result menus and Freeze touch aiming in portrait/landscape, narrow usable viewports and font scaling. Home bounds are measured; broader excellent layout is still a goal, not a completed claim.
3. **SD-008: Real Android online lifecycle.** Two devices using the existing Firebase/WebRTC configuration; exercise both roles, background/foreground, disconnect and rematch. Current two-context `?net=local` results do not verify Firebase, WebRTC or native background behavior.
4. **SD-009: Offline update and recovery.** Exercise a version A to B service-worker update, missing/corrupt checkpoint recovery, and installed APK update persistence. Cold web offline startup is covered in #15; update migration is not.
5. **SD-010: Measured speed work.** Capture matched seed/workload performance at 160/320 ships against `08438a4` before choosing quadtree/allocation/canvas/worker changes. Baseline exists; no performance comparison was run tonight.

Remaining audit candidates (unproven): guest input bounds, keyboard focus, deterministic Levels retries/spawn areas, release-to-recruit understanding and recruitment feedback. Interactive lessons remain hidden. Rules, simulation ownership and trained offline policy remain unchanged.

Journal: [2026-10-09](journal/2026-10-09.md).
