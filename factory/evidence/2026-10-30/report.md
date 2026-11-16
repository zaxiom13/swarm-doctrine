# 2026-10-30 evidence

Fresh main `886b3f4` on Node 24.22.1 passes npm ci, check, 80 tests and
production build; baseline commit `08438a4` exists. Head `ab09848` passes YAML,
shell syntax and diff checks, check, 80 tests and build locally. The five exact
improvement heads merge without conflict and pass check, 83 tests and production
build.

The head changes only Android CI configuration and evidence. API 26 requests
`-gpu software`; API 35 retains `-gpu swiftshader_indirect` as the control. The
Android Emulator documentation recommends software mode when graphics emulation
has compatibility problems and now marks `swiftshader_indirect` deprecated:
https://developer.android.com/studio/run/emulator-acceleration. Each installed
artifact records the requested GPU mode plus EGL/OpenGL properties. There is no
product-code, manifest, timeout, retry, permission, bridge or assertion change.

[Exact-head web run 41144417678](https://github.com/zaxiom13/swarm-doctrine/actions/runs/41144417678)
passes with deployment skipped. [Native run 41144417792](https://github.com/zaxiom13/swarm-doctrine/actions/runs/41144417792)
keeps the two API results independent.

API 35 passes the complete installed offline recovery/update path, including
portrait and landscape gameplay/menu touches, Rally/Freeze, Back, persisted
Continue/settings and process relaunch. Its [installed evidence artifact
13020084940](https://github.com/zaxiom13/swarm-doctrine/actions/runs/41144417792/artifacts/13020084940)
is 4,655,454 bytes with SHA-256
`e3127a528ce43ecc58cafc48c72c33af08e859a2652b8b3309d68711d730c640`.
It records requested `swiftshader_indirect`, `ro.hardware.egl=emulation` and
Google SwiftShader OpenGL ES 3.0.

API 26 remains bounded red after mounting the offline app under bundled Chrome
WebView 69. Its [installed evidence artifact
13020601131](https://github.com/zaxiom13/swarm-doctrine/actions/runs/41144417792/artifacts/13020601131)
is 203,441 bytes with SHA-256
`f3c12db9a02184efc9d58f783b2a3a6b439ec4e7051c410435590d7a666884c9`.
Although the run requested `software`, SurfaceFlinger still reports Google
SwiftShader OpenGL ES 3.0 and `ro.kernel.qemu.gles=1`. The preserved 42,408-byte
Java trace reproduces the prior boundary: the main/UI thread waits in
`ThreadedRenderer.nSyncAndDrawFrame`, while RenderThread waits in
`goldfish_pipe_read` through the QEMU OpenGL pipe. The separate requested mode
therefore did not avoid the emulator graphics-pipeline stall; this is not
evidence that production rendering should be weakened.

Local Android compilation/emulation was unavailable and is not claimed. A
software-rendered cloud emulator result cannot establish hardware-backed API 26
or all-device support. No performance, balance or production deployment
conclusion follows.
