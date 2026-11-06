# 2026-10-29 evidence

Fresh main `886b3f4` on Node 24.22.1 passes npm ci, check, 80 tests and
production build; baseline commit `08438a4` exists. Heads `474b130` and
`6139eef` pass shell syntax/diff checks, check, 80 tests and build locally. Exact
[web run 40972826055](https://github.com/zaxiom13/swarm-doctrine/actions/runs/40972826055)
passes with deployment skipped. The five exact improvement heads merge without
conflict and pass check, 83 tests and production build.

The heads change only the installed-test failure evidence. When the existing
240-second connected-test bound returns status 124, the script identifies the
app PID, sends SIGQUIT, waits two seconds, captures full threadtime logcat and
returns the original status. There is no product-code, timeout, retry,
permission, bridge or assertion change.

[Native run 40971642613](https://github.com/zaxiom13/swarm-doctrine/actions/runs/40971642613)
retains the first capture attempt. API 26 artifact 12940637842 is 187,397 bytes
with SHA-256
`58df9140cee00e20d1907f6b4a42e9da305565fc596f214517b04ddabb9ac31e`.
It proves the app received signal 3 at 23:21:33, but Android 8's signal catcher
reported `Permission denied` while opening `/data/anr/traces.txt`; the included
1,133,557-byte full logcat is therefore a failed capture, not a Java stack.
Follow-up `6139eef` uses the fixture's existing root ADB to pre-create a writable
legacy trace target and pulls it after SIGQUIT. In
[native run 40972825996](https://github.com/zaxiom13/swarm-doctrine/actions/runs/40972825996),
API 26 artifact 12942085457 is 206,729 bytes with SHA-256
`7e6dad5596a888be29e8067f3f7ca277ba9c5c49cc4759e5e0554e37ebc37dc1`.
Its 44,068-byte Java trace captures the main thread waiting in
`ThreadedRenderer.nSyncAndDrawFrame`; Android RenderThread and Chrome's
in-process GPU thread both wait in `goldfish_pipe_read` through the emulator's
GLES/QEMU pipe. The game had mounted and the first post-mount JS request had
been dispatched. This localizes the stop to the finite API 26 emulator graphics
pipeline, not the game JS, WebView evaluation callback or input mapping. It is
not proof that all API 26 devices work or fail.

The same run's API 35 artifact 12942060753 is 5,551,473 bytes with SHA-256
`071c2326fdd75eda1ee8615bebc0be2e298dae49f1b43e6ba42686810f8c9ef1`.
Its connected offline lifecycle/input/renderer-recovery scenario passes in
88.535 seconds. The later update-persistence scenario restores state and reaches
the final landscape Settings reopen, but that probe times out once after
120.774 seconds. Because today's timeout-only script is inactive on this path
and prior exact API 35 runs pass, the one failed API 35 job was rerun once. Job
123797612201 passes the full installed scenario. Its artifact 12941583963 is
4,415,250 bytes with SHA-256
`556f67fac61784721ab930ddccb165a005a3bc440853814684a2a00967d496a8`.
The initial failure and successful retry both remain evidence; the retry does
not alter the still-red API 26 conclusion.

Local Android compilation/emulation was unavailable and is not claimed. No
performance, balance, minimum-provider or all-device conclusion follows.
