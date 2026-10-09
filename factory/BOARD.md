# Swarm Doctrine board

Updated 2026-10-09 after the evening run. Android remains a continuing priority until installed-device evidence supports it. An open PR is not a shipped feature. Five independent improvement slots are occupied; maintain these before creating overlapping work.

## In review

| Card | Outcome | PR | Status and evidence |
| --- | --- | --- | --- |
| SD-011 | Android Back follows one tested UI policy | [#19](https://github.com/zaxiom13/swarm-doctrine/pull/19) | Open and mergeable; web and Android CI pass. Browser portrait → landscape exercise closes transient UI, pauses, then resumes without visible-control overflow. Installed Back-key checks remain outstanding. |
| SD-012 | Inspect the actual debug APK for offline-critical assets | [#20](https://github.com/zaxiom13/swarm-doctrine/pull/20) | Open and mergeable; code commit passed web CI and `lintDebug verifyDebugApk`. [Verified APK artifact](https://github.com/zaxiom13/swarm-doctrine/actions/runs/38001763485/artifacts/11649252408). The follow-up commit only records this result. |
| SD-013 | Levels Continue preserves AI/passive rival choice | [#21](https://github.com/zaxiom13/swarm-doctrine/pull/21) | Open and mergeable; web and Android CI pass. Unit plus real page reload keep passive rivals passive while legacy saves default safely to AI. |
| SD-015 | Guard initial fleet clearance across seeded aspect ratios | [#22](https://github.com/zaxiom13/swarm-doctrine/pull/22) | Open and mergeable; web and Android CI pass. Test covers 2,048 seeds × 8 sizes; broader audit covered 100,000 × 10 with 17.87px worst margin. |
| SD-014 | Clear stale conversion flashes on reused online guest ships | [#23](https://github.com/zaxiom13/swarm-doctrine/pull/23) | Open and mergeable; web and Android CI pass. A two-frame regression verifies authoritative true → false state on the same object. Real Firebase/WebRTC remains untested. |

All five independently target main at `8024139186972632f153826cd89097990402dc52`; there are no stack dependencies. Evidence is in each branch under `factory/evidence/SD-xxx/`. No PR was merged or auto-merged by the night shift.

## Merged since the previous board

| Card | Merged result | PR |
| --- | --- | --- |
| SD-001 | Offline packaged Android WebView shell and debug build | [#16](https://github.com/zaxiom13/swarm-doctrine/pull/16) |
| SD-002 | Clear held controls on rotation/background, including online guest release | [#13](https://github.com/zaxiom13/swarm-doctrine/pull/13) |
| SD-003 | Home actions fit short landscape phones | [#17](https://github.com/zaxiom13/swarm-doctrine/pull/17) |
| SD-004 | Validate an entire duel snapshot before guest mutation | [#14](https://github.com/zaxiom13/swarm-doctrine/pull/14) |
| SD-005 | Precache production chunks; missing assets never return HTML | [#15](https://github.com/zaxiom13/swarm-doctrine/pull/15) |

The previous closing board/journal PR [#18](https://github.com/zaxiom13/swarm-doctrine/pull/18) also merged. Main now includes the initial Android shell, but installed-device verification was not performed tonight.

## Next, in order

1. **Native API 26 and 35+ verification.** Install the verified debug APK; record device/API/WebView versions; exercise airplane-mode first launch, system bars/cutouts, font scale, Rally/Freeze through rotation, Back from every dialog/menu, background/foreground audio, process recreation and checkpoint persistence through update.
2. **Real Android online lifecycle.** Use two devices with existing Firebase/WebRTC configuration; exercise both roles, rotate/background each side, disconnect and rematch. Do not conflate `?net=local` with this evidence.
3. **Full adaptive-layout matrix.** Extend measured portrait/landscape coverage to Settings, Levels, all match overlays, gesture navigation/cutouts and larger font scales on a WebView.
4. **Offline update and recovery.** Exercise website service-worker version A → B and installed APK A → B persistence. Cold web startup and APK contents are covered; upgrade behavior is not.
5. **Measured speed work.** Capture matched 160/320-ship workloads against `08438a4` before changing quadtree, allocation, canvas or worker paths.

Remaining audits: keyboard focus; guest disconnect/rematch cleanup under real transport; corrupted-checkpoint removal UX; release-to-recruit understanding and recruitment feedback. Interactive lessons remain hidden. Rules, shared Simulation/Commander ownership and the trained offline policy remain unchanged.

Journal: [2026-10-09](journal/2026-10-09.md).
