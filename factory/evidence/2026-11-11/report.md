# Evidence report — 2026-11-11

## Scope

This run maintained Android recovery PR #26 rather than creating a sixth
improvement branch. Code `e91b3a1` adds installed instrumentation for the native
Freeze cooldown, ready-again, arm and cancel sequence. Evidence documentation is
`c38ec86`. Production game and Android app behavior are unchanged.

## Reproducible validation

| Target | Result |
| --- | --- |
| Main `886b3f4` | Node 24.22.1; `npm ci`; check; 80 tests; build pass |
| #26 code `e91b3a1` | check; 82 tests; build pass |
| Web workflow 43124010888 | Pass; deployment skipped |
| Android workflow 43124011457, API 35/WebView 124 | Pass: native Freeze records 80 eligible, 40 victims, cooldown 10 and `cooldown-re-aim`; renderer recovery, process recreation, replacement install, both Settings orientations and Continue also pass |
| Exact five-head integration | Conflict-free; check; 85 tests; build pass |

The integration heads were #20 `4193ba6`, #22 `acd0c36`, #23 `ab91651`, #26
`e91b3a1` and #27 `159439b`. The integration branch was not published.

## Artifacts and limitation

- API 35 installed artifact 13901743858: 15,201,039 bytes; SHA-256
  `b702789795994f4a4158f47f494370d2d71769515b4371deda6521c5b18ac023`.
- API 26 diagnostic artifact 13902152251: 190,341 bytes; SHA-256
  `4ac54f800e14dc6724767ca5b475ef272b8e307242f8835e00440f6ca1ceb421`.

API 26/WebView 69 reaches offline app progress 70 and then blocks in the known
emulator graphics pipe. It does not complete the installed scenario, so this run
does not claim API 26 support or installed-app equivalence across devices.
