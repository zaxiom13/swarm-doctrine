# 2026-10-27 evidence

Run [40424519680](https://github.com/zaxiom13/swarm-doctrine/actions/runs/40424519680)
on #26 `cb71a41` passes API 35 and fails the bounded API 26 job. API 35 artifact
12698748691 is 4,545,380 bytes with SHA-256
`40cfbbed3eae49e66135abc69f45655402c1971f8f4f38aff8eb4945b040365d`.
It covers offline launch/recovery, Back/background/rotation/Rally/Freeze, v1 save,
external force-stop, v2 replace install without clear-data, restored state,
portrait/landscape Settings/Sound/Back/reopen and Continue.

API 26 artifact 12698579668 is 18,945 bytes with SHA-256
`a8bec6d120fc73f7da622e007f6921e3a35a60fd3a18984fef63dc36a7261477`.
Its log records Android 8, Chrome WebView 69, airplane mode, no active network,
first launch and page progress 70. It contains no prior `Unexpected token .`,
showing the syntax repairs changed the observed failure, but the game still does
not mount before the four-minute bound. The generated XML reports no completed
assertion failure because the outer `timeout` terminates the stuck instrumentation;
it is red evidence, not a pass.

Head `8ff09d6` preserves debug console errors under `SwarmWeb`. Exact-head
[run 40603936078](https://github.com/zaxiom13/swarm-doctrine/actions/runs/40603936078)
passes API 35 and fails the bounded API 26 job. API 35 artifact 12780357237 is
4,422,166 bytes with SHA-256
`0331d3cf42acc549231427e082ff1b288a1c605c824746686002280e892b1b5d`.
API 26 artifact 12779917642 is 17,791 bytes with SHA-256
`5c970affdc5fd9de564c5cf44d464afe36eac0cc27db0c0eaa58c1afc40ea5c4`.
It records Android 8 / Chrome WebView 69, offline first launch, progress 80 and
`first game mounted`, with no `SwarmWeb` console error. The instrumentation then
stops advancing until the four-minute bound; its generated XML has no completed
assertion failure and is red evidence, not a pass.

Fresh main and branch check/80 tests/build pass locally; the exact web workflow
passes. All five improvement heads merge cleanly and pass check/83 tests/build.
No performance, balance, minimum-provider or all-device claim follows.
