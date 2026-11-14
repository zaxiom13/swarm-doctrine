# 2026-11-01 evidence

Fresh main `886b3f4` on Node 24.22.1 passes npm ci, check, 80 tests and
production build; baseline commit `08438a4` exists. Head `ab56faf` passes the
focused audio regression, check, 81 tests, production build, shell syntax and
diff checks locally. The five exact improvement heads merge without conflict and
pass check, 84 tests and production build.

## Reproduced foreground-audio defect

Before the change, the focused regression backgrounds a running AudioContext,
then explicitly suspends it to model `game.pause()`. Returning visibility to the
foreground incorrectly changes the context from `suspended` to `running`, proving
that the visibility listener overrides the stronger match pause.

After the change, `AudioSystem` remembers only a running context suspended by
visibility as eligible for automatic foreground resume. Its public `suspend()`
clears that eligibility. The same regression keeps the explicitly paused context
suspended while preserving ordinary hide/show auto-resume. The installed API 35
test additionally asserts the real WebView context is suspended behind Pause and
running only after explicit Resume.

[Exact-head web run 41363431316](https://github.com/zaxiom13/swarm-doctrine/actions/runs/41363431316)
passes with deployment skipped. [Native run 41363431317](https://github.com/zaxiom13/swarm-doctrine/actions/runs/41363431317)
keeps the two API outcomes independent.

API 35 passes the complete installed offline recovery/update path, including the
new suspended-while-paused and running-after-explicit-Resume Web Audio assertions,
portrait/landscape gameplay and menu touches, Rally/Freeze, Back, persisted
Continue/settings and process relaunch. JUnit records one passing test in 83.58
seconds with zero failures. Its [installed evidence artifact
13106421039](https://github.com/zaxiom13/swarm-doctrine/actions/runs/41363431317/artifacts/13106421039)
is 4,614,184 bytes with SHA-256
`a869cabcc14f56a100b222e1d76211317c7ef2268ae0cb161d2f4d3ed21fda42`.

API 26 remains bounded red at its previously localized emulator
graphics-pipeline stall; it does not reach the new post-mount audio assertion.
Its [diagnostic artifact
13106770340](https://github.com/zaxiom13/swarm-doctrine/actions/runs/41363431317/artifacts/13106770340)
is 180,774 bytes with SHA-256
`63dde441c3a2b9ad231da9255ca6f790e1efac1f84a93d5fb2ec6907f8f32cf9`.
This independent known failure is not attributed to the audio change.

Local Android compilation/emulation was unavailable and is not claimed. A
silent context-state assertion is not proof of audible output or every OEM audio
route. No performance, balance or production-deployment conclusion follows.
