# 동시성(Concurrency) 리뷰 결과

## 발견사항

- **[INFO]** `Promise.allSettled` 로 병렬 open 되는 여러 MCP 서버가 같은 `ctx.mcpDiagnostics`/`ctx.mcpDiagnosticErrors` 배열에 동시 push
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/tool-providers/mcp-tool-provider.ts` `buildTools()` (L319-329, `refs.map(...)` → `Promise.allSettled`), `materializeServer()` (L562-591), `openServer()` catch 블록의 `pushMcpServerSummary`/`pushMcpDiagnosticError` (L850-872 부근)
  - 상세: 여러 `McpServerRefConfig` 를 동시에 `materializeServer` → `openServer` 로 병렬 실행하면서, 각 서버가 완료되는 시점에 `ctx.mcpDiagnostics`(serverSummaries)와 신규 `ctx.mcpDiagnosticErrors` 배열에 `push` 한다. Node 의 단일 스레드 이벤트 루프에서 `Array.prototype.push` 는 원자적 동기 연산이며, 여러 Promise 는 각자의 `await` 지점 사이에서만 인터리빙되므로 이 자체로 데이터 레이스는 아니다. `pushConnectedSummary` 의 dedup 로직(`ctx.mcpDiagnostics?.some(...)`)도 동기적으로 검사·삽입되어 안전하다.
  - 제안: 현재 구현은 안전하다. 다만 이 accumulator 들이 "핸들러가 소유·관리, provider 는 push 만" 이라는 계약(주석에 명시)에 의존하고 있으므로, 향후 provider 구현이 늘어나 accumulator 접근에 `await` 을 사이에 두는 형태(예: push 전에 비동기 조회)로 바뀌면 order-dependent 부작용(dedup 체크와 push 사이 TOCTOU)이 생길 수 있다는 점을 코드 주석에 이미 남겨두었으나, 신규 provider 추가 시 리뷰 체크리스트에 "accumulator push 는 await 없이 원자적으로" 명시해 두는 것을 권장.

- **[INFO]** MCP 호출 카운터(`mcpDiagnosticsAcc.toolCalls++` 등)는 `Promise.all` 병렬 실행 이후 순차 루프에서 증가 — 레이스 없음 (검증됨, 정상)
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts` `executeProviderToolBatch()` L913-946
  - 상세: 한 turn 의 tool 호출 묶음은 `Promise.all(toRun.map(...))` 로 병렬 실행되지만(L913), 결과를 소비하는 `for (const { result, trace } of batchResults)` 루프(L933)는 `Promise.all` resolve 이후 완전히 동기적으로 실행되며, `args.mcpDiagnosticsAcc.toolCalls++` 등 카운터 증가는 이 순차 루프 안에서만 일어난다. 즉 "병렬 실행 → 배열 순서 보존 → 순차 집계" 패턴이 정확히 지켜져, 여러 tool 호출이 동시에 같은 카운터를 increment 해 갱신이 유실되는 lost-update 문제가 없다.
  - 제안: 없음 (현재 패턴 유지 권장). 향후 리팩터링 시 카운터 증가 로직을 `runProviderTool` 내부(병렬 실행 구간)로 이동시키지 않도록 주의.

- **[INFO]** `withTimeout` / `TimeoutError` 리팩터 — 타이머 정리·경쟁 없음
  - 위치: `codebase/backend/src/common/utils/with-timeout.ts`
  - 상세: 기존 `setTimeout` reject 시 생성하던 익명 `Error` 를 명명된 `TimeoutError` 서브클래스로 교체한 것뿐이며, `clearTimeout` 위치·resolve/reject 배타 처리(둘 다 `promise.then` 콜백 안에서 `clearTimeout` 후 처리)는 변경되지 않았다. 여전히 "timer fires first" 와 "promise resolves first" 사이의 경쟁에서 후자가 `clearTimeout` 을 호출해 정리하는 표준 패턴을 유지하며, 언더라잉 operation 이 취소되지 않는다는 기존 제약(주석에 명시)도 동일하게 유지된다. 동시성 관점에서 회귀 없음.
  - 제안: 없음.

- **[INFO]** `openServer` 의 connect 실패 시 이중 분류(McpBuildPhaseError) 로직 — 세션 close 와 에러 재분류의 순서 정합성
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/tool-providers/mcp-tool-provider.ts` L648-762 부근 (connect try/catch → tools/list try/catch → 세션 close → outer catch 의 push+re-throw)
  - 상세: connect 성공 후 tools/list 가 실패하면 `session.close().catch(() => undefined)` (fire-and-forget, best-effort) 후 `McpBuildPhaseError` 로 재포장해 throw 하고, 바깥 catch 에서 `skipped` summary + `errors[]` entry 를 push 한다. `session.close()` 는 await 되지 않으므로 diagnostics push/재throw 시점에는 close 가 아직 진행 중일 수 있다 — 이는 "베스트에포트 정리이며 실패해도 원본 에러를 막지 않는다" 는 주석의 의도적 설계이고, 세션이 이미 `sessions` map 에 등록되지 않은 상태(등록은 성공 경로에서만)이므로 이후 `cleanup()` 이 중복으로 같은 세션을 close 할 경합도 없다.
  - 제안: 없음 (의도된 fire-and-forget, 문제 없음).

- **[INFO]** `inflight` 캐시를 통한 TOCTOU 방지 — 기존 로직 재확인, 이번 diff 로 인한 변경 없음
  - 위치: `mcp-tool-provider.ts` L279-291, `materializeServer()` L576-583
  - 상세: 이번 diff 는 `openServer` 내부의 에러 분류 로직만 확장했고, 동시 `buildTools` 호출 간 동일 `(executionId, integrationId)` 의 이중 open 을 막는 `inflight` Map 기반 dedup 은 그대로 유지된다. `.finally()` 로 inflight 항목이 성공/실패 무관하게 정리되어 메모리 누수도 없다. 신규 변경이 이 불변식을 깨지 않음을 확인.
  - 제안: 없음.

## 요약
이번 변경은 MCP 진단(`mcpDiagnostics`) 구조를 `serverSummaries[]` 단일 배열에서 `attempted/serverCount/toolCalls/resourceReads/promptGets/serverSummaries/errors` 구조화 객체로 확장하고, `withTimeout` 에 `TimeoutError` 타입을 추가한 것이 핵심이다. 동시성 관점에서 우려되는 지점(여러 MCP 서버의 병렬 `Promise.allSettled` open, turn 내 tool 호출의 병렬 `Promise.all` 실행)은 모두 기존에 확립된 안전한 패턴 — 공유 accumulator 로의 동기적 `push`/증가는 `await` 경계 밖에서만 일어나고, 카운터 집계는 병렬 실행이 완전히 끝난 뒤 순차 루프에서 수행된다 — 을 그대로 따르고 있어 신규 레이스 컨디션이나 이중 카운팅 위험은 발견되지 않았다. `inflight` map 기반 TOCTOU 방지, `sessionsByExecution` 의 executionId 스코핑, `cleanup()` 의 원자적 map 삭제 등 기존 동시성 안전장치도 이번 diff 로 훼손되지 않았다. 전반적으로 위험도는 낮다.

## 위험도
LOW
