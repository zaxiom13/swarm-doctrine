# 2026-10-24 evidence

This run converted #26's installed smoke into an API 26/35 matrix and preserved
all failures. Runs 40139615198, 40140064641, 40245907767, 40246319386 and
40246681665 failed during API 26 radio fixture setup before APK installation;
they are infrastructure diagnostics, not app compatibility results.

Artifacts 12618956908 (802 bytes, SHA-256
`c14b8744cc04953601cf752124023fb244a7b691c4a96ef0dc429dde24b0683d`),
12618937782 (1,015 bytes, SHA-256
`f6fa1cf69f22574b6ea6e7cc0fbe06e6a37adbaa33409e950f6575428ff16c0b`)
and 12619270513 (1,030 bytes, SHA-256
`bc06c75a174c87dc02b7a2eb6906f94b60f66b4e4fc3944d9912f537b5ca1c42`)
preserve the localized markers. The last confirms `wifi_on=1`, proving the
postcondition guard did not mask a failed legacy command.

Fresh main and #26 check/80 tests/build passed. All five improvement heads
merged without conflict and passed check/83 tests/build. These local/web gates
do not establish installed Android compatibility.
