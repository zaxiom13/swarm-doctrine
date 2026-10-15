#!/usr/bin/env bash
set -euo pipefail

mkdir -p android/app/build/smoke-evidence
collect_evidence() {
    # Collect while the emulator is still alive, including after a failed test.
    adb logcat -d -s SwarmSmoke:I chromium:E AndroidRuntime:E > android/app/build/smoke-evidence/logcat.txt || true
    adb pull /sdcard/Android/data/com.zaxiom.swarmdoctrine/files/smoke android/app/build/smoke-evidence/ || true
    adb pull /sdcard/Pictures/SwarmSmoke android/app/build/smoke-evidence/ || true
}
trap collect_evidence EXIT

adb shell cmd connectivity airplane-mode enable
adb shell svc wifi disable
adb shell svc data disable
adb shell settings put system font_scale 1.3
adb shell settings get system font_scale > android/app/build/smoke-evidence/font-scale.txt
adb shell dumpsys connectivity > android/app/build/smoke-evidence/connectivity-before-launch.txt
gradle -p android connectedDebugAndroidTest \
    -Pandroid.testInstrumentationRunnerArguments.class=com.zaxiom.swarmdoctrine.InstalledRecoveryTest

# AGP uninstalls its test APKs. Install once for the staged persistence check;
# nothing may clear storage or reinstall between save and restore.
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
adb install -r android/app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk
run_persistence_stage() {
    local stage="$1"
    local output="android/app/build/smoke-evidence/process-${stage}.txt"
    timeout 180s adb shell am instrument -w -r \
        -e class "com.zaxiom.swarmdoctrine.ProcessPersistenceTest#${stage}" \
        com.zaxiom.swarmdoctrine.test/androidx.test.runner.AndroidJUnitRunner | tee "$output"
    # am instrument can return a zero shell exit status on assertion failure.
    # Require the runner's one-test success and reject reported failure/crash.
    rg -q '^OK \(1 test\)' "$output"
    if rg -q 'FAILURES!!!|INSTRUMENTATION_FAILED|shortMsg=|Process crashed' "$output"; then return 1; fi
}
run_persistence_stage saveBeforeProcessStop

# Launch the ordinary app (not only ActivityScenario.recreate), prove its
# package process is alive, then stop the package from outside that process.
adb shell am start -W -n com.zaxiom.swarmdoctrine/.MainActivity \
    > android/app/build/smoke-evidence/process-launch.txt
app_pid_before_stop="$(adb shell pidof com.zaxiom.swarmdoctrine | tr -d '\r')"
test -n "$app_pid_before_stop"
echo "Running app PID before force-stop: $app_pid_before_stop" | tee android/app/build/smoke-evidence/process-stop.txt
adb shell am force-stop com.zaxiom.swarmdoctrine
app_pid_after_stop="$(adb shell pidof com.zaxiom.swarmdoctrine 2>/dev/null | tr -d '\r' || true)"
test -z "$app_pid_after_stop"
echo 'PASS no app process remains after package force-stop; no clear-data/reinstall' | tee -a android/app/build/smoke-evidence/process-stop.txt
run_persistence_stage restoreAfterProcessStop
