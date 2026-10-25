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

fixture_log="android/app/build/smoke-evidence/offline-fixture.txt"
run_fixture_step() {
    local label="$1"
    shift
    echo "START ${label}" | tee -a "$fixture_log"
    if "$@"; then
        echo "PASS ${label}" | tee -a "$fixture_log"
    else
        local status=$?
        echo "FAIL ${label} status=${status}" | tee -a "$fixture_log"
        return "$status"
    fi
}

device_api="$(adb shell getprop ro.build.version.sdk | tr -d '\r')"
if (( device_api >= 30 )); then
    run_fixture_step airplane-command adb shell cmd connectivity airplane-mode enable
else
    # `cmd connectivity airplane-mode` does not exist on API 26, and its shell
    # identity cannot send the protected AIRPLANE_MODE broadcast. Set the flag
    # directly; the test proves it, while the explicit radio shutdown below and
    # the in-app assertion prove that no default network remains.
    run_fixture_step airplane-setting adb shell settings put global airplane_mode_on 1
fi
run_fixture_step wifi-disable adb shell svc wifi disable
run_fixture_step data-disable adb shell svc data disable
adb shell settings put system font_scale 1.3
adb shell settings get system font_scale > android/app/build/smoke-evidence/font-scale.txt
adb shell dumpsys connectivity > android/app/build/smoke-evidence/connectivity-before-launch.txt
gradle -p android connectedDebugAndroidTest \
    -Pandroid.testInstrumentationRunnerArguments.class=com.zaxiom.swarmdoctrine.InstalledRecoveryTest

# AGP uninstalls its test APKs. Install version 1 for the staged persistence
# check. After saving, the script upgrades to version 2 with adb install -r;
# nothing may clear storage between the save and restore stages.
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
adb install -r android/app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk
adb shell dumpsys package com.zaxiom.swarmdoctrine \
    > android/app/build/smoke-evidence/package-version-1.txt
grep -m 1 'versionCode=' android/app/build/smoke-evidence/package-version-1.txt \
    | tee android/app/build/smoke-evidence/process-update.txt
grep -Eq 'versionCode=1([[:space:]]|$)' android/app/build/smoke-evidence/process-update.txt
run_persistence_stage() {
    local stage="$1"
    local output="android/app/build/smoke-evidence/process-${stage}.txt"
    timeout 180s adb shell am instrument -w -r \
        -e class "com.zaxiom.swarmdoctrine.ProcessPersistenceTest#${stage}" \
        com.zaxiom.swarmdoctrine.test/androidx.test.runner.AndroidJUnitRunner | tee "$output"
    # am instrument can return a zero shell exit status on assertion failure.
    # Require the runner's one-test success and reject reported failure/crash.
    # The GitHub runner does not guarantee ripgrep; use its standard grep.
    grep -Eq '^OK \(1 test\)' "$output"
    if grep -Eq 'FAILURES!!!|INSTRUMENTATION_FAILED|shortMsg=|Process crashed' "$output"; then return 1; fi
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
echo 'PASS no app process remains after package force-stop; no clear-data' | tee -a android/app/build/smoke-evidence/process-stop.txt

# Rebuild only the target APK with a higher package version, then use Android's
# actual replace/update operation. The same source isolates data continuity from
# app behavior changes; it is not a version-A-to-B migration compatibility claim.
gradle -p android assembleDebug \
    -PswarmVersionCode=2 -PswarmVersionName=0.1.1-smoke
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
adb shell dumpsys package com.zaxiom.swarmdoctrine \
    > android/app/build/smoke-evidence/package-version-2.txt
grep -m 1 'versionCode=' android/app/build/smoke-evidence/package-version-2.txt \
    | tee -a android/app/build/smoke-evidence/process-update.txt
grep -Eq 'versionCode=2([[:space:]]|$)' android/app/build/smoke-evidence/process-update.txt
echo 'PASS versionCode 1 -> 2 installed with -r and no clear-data' \
    | tee -a android/app/build/smoke-evidence/process-update.txt
run_persistence_stage restoreAfterProcessStop
