# Evidence report — 2026-11-12

## Scope

This run maintained Android recovery PR #26 instead of creating a sixth
improvement branch. Code `296554d` proves an installed native Freeze charge
remains cooling and disarmed across landscape-to-portrait rotation, with safe
bounds/HUD fit and ready-again input rechecked in portrait. Evidence
documentation is `8a643f1`; production behavior is unchanged.

## Reproducible validation

| Target | Result |
| --- | --- |
| Main `886b3f4` | Node 24.22.1; `npm ci`; check; 80 tests; build pass |
| #26 code/docs | diff check; check; 82 tests; build pass |
| Web workflow 43329099491 | Pass; deployment skipped |
| Android workflow 43329099253, API 35/WebView 124 | Pass: cooling landscape Freeze survives portrait rotation disarmed; portrait safe bounds/HUD fit and ready-again arm/cancel pass; recovery/update/persistence suite completes |
| Exact five-head integration | Conflict-free; check; 85 tests; build pass |

The integration heads were #20 `4193ba6`, #22 `acd0c36`, #23 `ab91651`, #26
`296554d` and #27 `159439b`. The integration branch was not published.

## Artifacts and limitation

- API 35 installed artifact 13993289797: 15,226,182 bytes; SHA-256
  `96c0752b65ff1e0fb198a0874b6c41c781d33f7d18311245efb7c3974791be86`.
- API 26 diagnostic artifact 13993873145: 190,141 bytes; SHA-256
  `c97b76202f94256a8c97036d60f542e8c8b4ed8709e3a0a49743f0913a2d26c6`.

API 26 passes build and callback checks, then repeats the known emulator
graphics-pipe failure in the installed smoke. It does not complete the scenario,
so this run does not claim API 26 support or installed-app equivalence across
devices.
