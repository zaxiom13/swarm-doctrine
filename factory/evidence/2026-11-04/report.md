# 2026-11-04 Android menu and Back evidence

## Baseline and queue

- Main: `886b3f4`; Node 24.22.1; npm ci, check, 80 tests and build pass.
- Performance reference `08438a4` exists; no performance or balance claim was made.
- Open improvement heads: #20 `4193ba6`, #22 `acd0c36`, #23 `ab91651`,
  #26 `6b580e6`, #27 `159439b`; #24 remains the single closing PR.
- No review comments. All six PRs are open and mergeable.

## Trigger and before/after

The new installed probe uses real Android taps through Home → Modes → Levels →
Team at `font_scale=1.3` in both orientations, rejects horizontal clipping, and
uses native Back twice.

Before the production fix, run 41938820748 measured no horizontal clipping but
Back returned Team → Home, skipping Modes. The cause was the Team-specific branch
in `UIManager.back()` calling `quitToMenu()` instead of honoring its history
target. Head `d5857d6` removes that special case and adds a focused web regression.

Exact-head run 41940235785 records:

| Orientation | Screen | CSS viewport | Screen scroll/client | Controls | Horizontally clipped |
| --- | --- | --- | --- | ---: | --- |
| Portrait | Home | 412x684 | 412x684 / 412x684 | 4 | none |
| Portrait | Modes | 412x684 | 412x807 / 412x684 | 6 | none |
| Portrait | Team | 412x684 | 412x884 / 412x684 | 7 | none |
| Landscape | Home | 732x364 | 732x364 / 732x364 | 4 | none |
| Landscape | Modes | 732x364 | 732x620 / 732x364 | 6 | none |
| Landscape | Team | 732x364 | 732x568 / 732x364 | 7 | none |

The log contains `PASS native Home/Modes/Levels/Team/Back menu path` for portrait
and landscape and then passes recovery, offline Continue, Rally/Freeze, rotation,
safe-area and Activity recreation. Attempt 1 later failed the separate persisted-
Settings reopen step. The unchanged API 35 job rerun passed InstalledRecoveryTest,
save-before-stop (52.953s), versionCode 1 → 2 replacement, and restore-after-stop
(61.596s). This identifies the earlier late Settings failure as non-reproduced;
it is not erased.

## Validation and artifacts

- #26 local: diff check, check, 82 tests and production build pass.
- Web exact `d5857d6`: [run 41940235718](https://github.com/zaxiom13/swarm-doctrine/actions/runs/41940235718), pass; deploy skipped.
- Native exact `d5857d6`: [run 41940235785](https://github.com/zaxiom13/swarm-doctrine/actions/runs/41940235785). Overall red only because API 26 remains the known bounded emulator graphics failure; unchanged API 35 rerun job 126962579868 passes.
- Successful API 35 artifact [13377270638](https://github.com/zaxiom13/swarm-doctrine/actions/runs/41940235785/artifacts/13377270638): 9,984,423 bytes; SHA-256 `791b8182496796e3ba02e989e5e4be22334f255561792be58238d888d4a99c85`.
- Initial API 35 artifact 13376032283: 9,751,079 bytes; SHA-256 `1ccc91babc8198e95a10ab571b7a2b17e895f97b2c9745194bc726c20f0f8aa7`.
- API 26 artifact 13376218119: 190,766 bytes; SHA-256 `1d9618f5e91fdf91f05d7a7b41371348bf39bb7490e2f0e75cff4293ca8bd502`.
- Capture-repair web exact `6b580e6`: [run 42128388163](https://github.com/zaxiom13/swarm-doctrine/actions/runs/42128388163), pass; deploy skipped.
- Capture-repair native exact `6b580e6`: [run 42128388089](https://github.com/zaxiom13/swarm-doctrine/actions/runs/42128388089). API 35 InstalledRecoveryTest passes the repaired menu capture/Back path; save-before-process-stop also passes, then restore fails the separate intermittent `Settings reopens with native choice` assertion. API 26 remains the known emulator graphics failure.
- Exact-head API 35 artifact [13462955602](https://github.com/zaxiom13/swarm-doctrine/actions/runs/42128388089/artifacts/13462955602): 16,333,091 bytes; SHA-256 `6ade582de812196ebdaba9651a3cbea3b97ceb70698c1aad706c319c2f58bdbd`.
- Exact five-head integration: conflict-free; check, 85 tests, build pass.

The first new menu PNG set is not accepted as visual proof. Although current DOM
geometry and Back assertions passed, sequential full-display captures lagged one
presented frame; landscape Team was byte-identical to Modes. Head `6b580e6`
routes those six captures through the existing frame-commit + PixelCopy helper
and keeps app-window/full-display buffers separate. Exact-head InstalledRecoveryTest
passes that path. The 12 resulting portrait/landscape Home, Modes and Team
app-window/full-display files all have distinct SHA-256 hashes; visual inspection
confirms each file contains its current screen and no horizontal clipping. Long
Modes/Team grids remain vertically scrollable by design. The later restore-stage
Settings failure keeps the workflow red and is reported separately rather than
being used to reject the earlier installed menu assertions.

## Limitations

The measurements cover one API 35 / WebView 124 emulator and six first-run menu
states, not all Android devices, WebViews, menus, cutout/navigation arrangements
or accessibility configurations. Vertical scrolling is intentional and was not
treated as clipping. API 26 remains blocked by its independently localized
emulator graphics pipe. Physical/current-vendor API 26, audible audio, arbitrary
schema/assets migration and real Firebase/WebRTC were not tested. No deployment,
merge, auto-merge, production Firebase mutation or Play Store action occurred.
