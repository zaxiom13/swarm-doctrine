# 2026-10-21 evidence

Main and #26 passed check/80 tests/build; all five heads merged automatically and
passed check/83 tests/build. Web runs 39685951557 and 39687460227 passed with PR
deployment skipped.

Android 39685951547 artifact
[12386762002](https://github.com/zaxiom13/swarm-doctrine/actions/runs/39685951547/artifacts/12386762002)
is 3,960,111 bytes, SHA-256
`26e2aae93b5f325cdb4be37a5f1a1e8fa6d3a5adda0dec09684063e518245de5`,
expires 2026-11-20. Original installed XML: one test, zero failures/errors/skips.
Separate save stage: OK (1 test). Restore logs record versionCode 1 then 2,
successful `adb install -r`, restored state, both Settings orientations and Sound
transitions, then one final landscape menu-tap failure before Continue. Eleven
PNG buffers were downloaded and inspected.

Follow-up 39687460219 repeats the same final failure after 50 ms dwell. Artifact
12387207880 is 4,445,998 bytes, SHA-256
`c8123274d061d9f42fdd248057d2f2a097e5385d2f6672eb37da141da4d420f0`,
expires 2026-11-20. Neither red run is represented as a full pass.

