# 2026-10-22 evidence

Main `886b3f4` passes fresh npm ci, check, 80 tests and production build on Node
24.19. #26 `b739a74` passes the same web gate plus shell syntax/diff checks.
The five occupied branches merge automatically and pass check, 83 tests and
production build. No balance/performance claim follows from functional tests.

[Web CI 39865011333](https://github.com/zaxiom13/swarm-doctrine/actions/runs/39865011333)
passes with pull-request deployment skipped. Android diagnostics run
[39865011331](https://github.com/zaxiom13/swarm-doctrine/actions/runs/39865011331)
passes lint/APK/callback tests and the original installed recovery smoke. Its
update path saves at versionCode 1, externally force-stops without clear-data,
installs versionCode 2 with `adb install -r`, restores state, and passes native
Settings scrolling plus Sound touches in both orientations. It then reproduces
the final landscape Home Settings failure before Continue.

The trace proves the calculated native point is the Settings center and both
pointerdown/pointerup target Settings, but no click follows. The inspected
1920x1080 failure frame shows Chromium text-selection handles and the contextual
Copy/Share/Select all/Read aloud toolbar, localizing this to a scheduler-stretched
synthetic long press rather than bad rotation coordinates. Artifact
[12463796934](https://github.com/zaxiom13/swarm-doctrine/actions/runs/39865011331/artifacts/12463796934)
is 5,525,309 bytes, SHA-256
`f878c9f1b149bf3da64a5a83246da5a286d144ccc467c31c2f570f3623a3c333`.
It contains 12 PNGs, stage logs, package dumps and Android test reports. This red
run does not prove production input is broken or that the later driver fix works.
