# 2026-10-26 evidence

#26 changes one production expression and its diagnostic harness. The terrain radius
calculation preserves the same random call, ranges and scale but prevents Vite
from emitting the Chrome-69-incompatible character sequence `?.`. Fresh branch
check, 80 tests and build pass; the production chunk scan finds zero `?.` tokens.
Fresh main check/80 tests/build pass. All five improvement heads merge without
conflict and the combined tree passes check/83 tests/build.

Web CI [40422027821](https://github.com/zaxiom13/swarm-doctrine/actions/runs/40422027821)
passes on the production-fix head with deployment skipped. API 35 / WebView
124.0.6367.219 passes the complete installed control in Android run 40422027973;
all 11 downloaded captures were inspected and are rendered, correctly oriented
and unclipped. Artifact 12698560775 is 4,371,878 bytes with SHA-256
`ffcb3b874af776f7ade023d5005095fee0f965153baa7951e7b141c0f13f999e`.

API 26 remained in first instrumentation much longer than the control, so head
`6d16cbd` bounds that command to four minutes and leaves time for the existing
exit trap plus always-upload step. It does not retry, skip or weaken the test.
Artifact 12699411869 is 18,275 bytes with SHA-256
`f8ef4af0283597de54f47a356057a4877841eadba8b48178d05530a3671221ca`.
Its connected-test log proves Chrome 69 still emitted `Unexpected token .` at
first launch. Built assets contained no `?.`, but three native lifecycle/Back
`evaluateJavascript` strings bypassed Vite and still used optional chaining/
nullish coalescing. Head `cb71a41` rewrites those guards with equivalent legacy
syntax. Exact-head web/native results are pending; until observed, minimum-provider
compatibility remains open rather than inferred from source or API 35.
