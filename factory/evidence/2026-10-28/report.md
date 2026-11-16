# 2026-10-28 evidence

Fresh main `886b3f4` on Node 24.22.1 passes npm ci, check, 80 tests and production
build; baseline commit `08438a4` exists. Heads `e774f0d` and `76e2d8c` pass
diff/check, check, 80 tests and build locally. Exact
[web run 40786341326](https://github.com/zaxiom13/swarm-doctrine/actions/runs/40786341326)
passes. The five exact improvement heads merge without conflict and pass check,
83 tests and production build.

The two heads change only installed-test logging: bounded `PHASE` markers surround
the existing API 26/35 assertions, then required-JS markers distinguish dispatch,
UI-thread evaluation and callback. There is no product-code, timeout, retry,
permission, bridge or assertion change.

[Native run 40786341382](https://github.com/zaxiom13/swarm-doctrine/actions/runs/40786341382)
passes API 35 and fails the bounded API 26 job. API 35 artifact 12860175872 is
4,406,550 bytes with SHA-256
`0c7dd59003ac249846bbeb034c15f7bd608e51764d69df5f425bdb1e4fad50bd`.
API 26 artifact 12860560249 is 19,737 bytes with SHA-256
`553e707be1481fad482866b93f7302ca51b16b03383439f9089403b762f3c887`.
It records Android 8 / Chrome WebView 69, offline launch, page progress 80, first
game mount, `origin checks start` and `JS 5 dispatch`. It never records the
marker inside `scenario.onActivity`, so the activity UI thread did not service
the first post-mount evaluation runnable before the four-minute bound. There is
no completed assertion or `SwarmWeb` console error; this is red evidence, not a
minimum-provider pass. Existing provider-internal `TracingController` warnings
are not claimed as causal.

Local Android compilation/emulation was unavailable and is not claimed. No
performance, balance, minimum-provider or all-device conclusion follows.
