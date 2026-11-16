# Evidence report — 2026-11-14

## Scope

This run maintained Android recovery PR #26 instead of creating a sixth
improvement branch. Code `8be4705` proves a replacement APK serves changed
packaged static bytes while the existing process/update persistence contract
continues to pass. Evidence documentation is `2b7765c`; production behavior is
unchanged.

## Reproducible validation

| Target | Result |
| --- | --- |
| Main `886b3f4` | Node 24.22.1; `npm ci`; check; 80 tests; build pass |
| #26 code/docs | diff check; shell syntax; check; 82 tests; build pass |
| Web workflow 43652902032 | Pass; deployment skipped |
| Android workflow 43652902003, API 35/WebView 124.0.6367.219 | Pass: WebView reads v1 marker before save and v2 after replacement install; progress, portrait/landscape Settings, Continue and malformed-checkpoint recovery complete |
| Exact five-head integration | Conflict-free; check; 85 tests; build pass |

The integration heads were #20 `4193ba6`, #22 `acd0c36`, #23 `ab91651`, #26
`8be4705` and #27 `159439b`. The integration branch was not published. The
initial build.gradle marker approach conflicted with #20; the final smoke-script
fixture removes that overlap and introduces no stack dependency.

## Artifacts and limitation

- API 35 installed artifact 14137305975: 15,319,332 bytes; SHA-256
  `b1de702c39a659c09834e5c395ac43b9bc0fb52694f6f26889080b4e60440691`.
- API 26 diagnostic artifact 14136931864: 197,736 bytes; SHA-256
  `e22a5062c066b92ffd8665363103fb6910db67456f5a3a87ff30b3c2e3e3b4e0`.

API 26 passes build and callback gates, reaches the offline packaged origin on
Chrome WebView 69.0.3497.100, then repeats the known progress-70 emulator timeout
before the update stage. The finite API 35 result proves changed test-marker
delivery, not changed production JavaScript/schema migration, abrupt-write
safety, physical-device support, arbitrary cutouts, audible output or real
two-device transport.
