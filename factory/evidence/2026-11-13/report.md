# Evidence report — 2026-11-13

## Scope

This run maintained Android recovery PR #26 instead of creating a sixth
improvement branch. Code `9789396` exercises a truncated real checkpoint after
the installed process-stop and same-source APK update path. Evidence
documentation is `6b9dd5c`; production behavior is unchanged.

## Reproducible validation

| Target | Result |
| --- | --- |
| Main `886b3f4` | Node 24.22.1; `npm ci`; check; 80 tests; build pass |
| #26 code/docs | diff check; check; 82 tests; build pass |
| Web workflow 43529366165 | Pass; deployment skipped |
| Android workflow 43529366271, API 35/WebView 124.0.6367.219 | Pass: offline malformed-checkpoint relaunch returns Home, no checkpoint/Continue, independent record preserved; recovery/update/persistence suite completes |
| Exact five-head integration | Conflict-free; check; 85 tests; build pass |

The integration heads were #20 `4193ba6`, #22 `acd0c36`, #23 `ab91651`, #26
`9789396` and #27 `159439b`. The integration branch was not published.

## Artifacts and limitation

- API 35 installed artifact 14087565824: 15,174,391 bytes; SHA-256
  `a30a165265c2191a0518541d859441ae6ab72e820ba6dc0a0f1251bbeab12cc8`.
- API 26 diagnostic artifact 14087442530: 199,722 bytes; SHA-256
  `2db25fbc804d248a40347bb61b0d7bd0224f385d6269a061b925267058ff284c`.

The first API 26 job had a broad dependency-resolution outage before compile.
One unchanged retry passed lint, both APK builds and renderer callbacks, reached
the offline packaged origin on Chrome WebView 69.0.3497.100, then repeated the
known progress-70 emulator timeout. It does not complete the installed scenario,
so this run does not claim API 26 support, arbitrary corrupted-schema recovery,
abrupt-write safety or installed-app equivalence across devices.
