# 2026-10-23 evidence

#26 `5dfd889` contains the test-driver-only MotionEvent timing repair. Its web CI
[40036906317](https://github.com/zaxiom13/swarm-doctrine/actions/runs/40036906317)
passes with deployment skipped. All five improvement heads merge automatically;
the combined tree passes Svelte check, 83 tests and production build. No balance
or performance claim follows from these functional checks.

Installed Android run
[40036906282](https://github.com/zaxiom13/swarm-doctrine/actions/runs/40036906282)
passes lint, APK assembly, callback tests, original installed recovery and the
two-process update smoke on API 35 / WebView 124.0.6367.219 at font scale 1.3.
It records versionCode 1 save, external force-stop/no clear-data, versionCode 2
`adb install -r`, restored settings/checkpoint/record, native Settings scrolling,
Sound/Back/reopen in portrait and landscape, and final Continue. Both Home
Settings traces contain pointerdown, pointerup and click at the measured control.

Artifact
[12537254206](https://github.com/zaxiom13/swarm-doctrine/actions/runs/40036906282/artifacts/12537254206)
is 4,703,031 bytes, SHA-256
`45075f168b63eae9246df2574ff48e38e356fe2b8282f4013503185f7903859a`.
It contains 11 PNGs plus logs, package dumps and test reports. All 11 captures
were inspected: portrait/landscape gameplay, recovery, initial Settings and
bottom actions are rendered, correctly oriented and unclipped; no selection
toolbar remains. This finite emulator result does not establish physical/API 26,
current WebView, audible audio, cutouts or arbitrary migration compatibility.
