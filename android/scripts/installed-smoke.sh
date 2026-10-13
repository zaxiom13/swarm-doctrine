#!/usr/bin/env bash
set -euo pipefail

mkdir -p android/app/build/smoke-evidence
collect_evidence() {
    # Collect while the emulator is still alive, including after a failed test.
    adb logcat -d -s SwarmSmoke:I chromium:E AndroidRuntime:E > android/app/build/smoke-evidence/logcat.txt || true
    adb pull /sdcard/Android/data/com.zaxiom.swarmdoctrine/files/smoke android/app/build/smoke-evidence/ || true
}
trap collect_evidence EXIT

adb shell cmd connectivity airplane-mode enable
adb shell svc wifi disable
adb shell svc data disable
adb shell dumpsys connectivity > android/app/build/smoke-evidence/connectivity-before-launch.txt
gradle -p android connectedDebugAndroidTest
