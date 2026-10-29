#!/usr/bin/env bash
set -euo pipefail

mkdir -p android/app/build/smoke-evidence
collect_evidence() {
    # Collect while the emulator is still alive, including after a failed test.
    adb logcat -d -s SwarmSmoke:I SwarmWeb:E chromium:E AndroidRuntime:E > android/app/build/smoke-evidence/logcat.txt || true
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

run_fixture_step_with_global() {
    local label="$1"
    local setting="$2"
    local expected="$3"
    shift 3
    local status=0
    echo "START ${label}" | tee -a "$fixture_log"
    "$@" || status=$?
    local observed
    observed="$(adb shell settings get global "$setting" | tr -d '\r')"
    if [[ "$observed" == "$expected" ]]; then
        echo "PASS ${label} command-status=${status} ${setting}=${observed}" \
            | tee -a "$fixture_log"
    else
        echo "FAIL ${label} command-status=${status} ${setting}=${observed}" \
            | tee -a "$fixture_log"
        return 1
    fi
}

device_api="$(adb shell getprop ro.build.version.sdk | tr -d '\r')"
if (( device_api >= 30 )); then
    run_fixture_step airplane-command adb shell cmd connectivity airplane-mode enable
else
    # `cmd connectivity airplane-mode` does not exist on API 26. The legacy
    # setting/broadcast and `svc wifi` path require the debuggable emulator's
    # root ADB shell. This changes only the CI fixture; the app still runs under
    # its ordinary package UID and permissions.
    run_fixture_step adb-root adb root
    run_fixture_step adb-root-wait adb wait-for-device
    run_fixture_step airplane-setting adb shell settings put global airplane_mode_on 1
    run_fixture_step airplane-broadcast adb shell am broadcast \
        -a android.intent.action.AIRPLANE_MODE --ez state true
fi
run_fixture_step_with_global wifi-disable wifi_on 0 adb shell svc wifi disable
run_fixture_step data-disable adb shell svc data disable
adb shell settings put system font_scale 1.3
adb shell settings get system font_scale > android/app/build/smoke-evidence/font-scale.txt
adb shell dumpsys connectivity > android/app/build/smoke-evidence/connectivity-before-launch.txt
smoke_status=0
timeout 240s gradle -p android connectedDebugAndroidTest \
    -Pandroid.testInstrumentationRunnerArguments.class=com.zaxiom.swarmdoctrine.InstalledRecoveryTest \
    || smoke_status=$?
if (( smoke_status == 124 )); then
    # Preserve the Java stacks at the exact bounded timeout. The API 26 fixture
    # runs with root ADB only for legacy radio setup, so SIGQUIT can reach the
    # ordinary app process without adding app permissions or a debug bridge.
    app_pid="$(adb shell pidof com.zaxiom.swarmdoctrine | tr -d '\r' || true)"
    if [[ -n "$app_pid" ]]; then
        echo "SIGQUIT app PID ${app_pid} after connected-test timeout" \
            | tee android/app/build/smoke-evidence/thread-dump.txt
        adb shell kill -3 "$app_pid" || true
        sleep 2
        adb logcat -d -v threadtime \
            > android/app/build/smoke-evidence/thread-dump-logcat.txt || true
    else
        echo 'No app process found after connected-test timeout' \
            | tee android/app/build/smoke-evidence/thread-dump.txt
    fi
fi
if (( smoke_status != 0 )); then exit "$smoke_status"; fi

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
