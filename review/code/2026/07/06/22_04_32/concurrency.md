# 동시성(Concurrency) 리뷰 결과

## 발견사항

- **[INFO]** 여러 MCP 서버의 병렬 `Promise.allSettled` open 시 공유 accumulator(`ctx.mcpDiagnostics`, 신규 `ctx.mcpDiagnosticErrors`)에 동기 push
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/tool-providers/mcp-tool-provider.ts` `buildTools()`(`refs.map(...)` → `Promise.allSettled`), `materializeServer()`, `openServer()` catch 블록(`pushMcpServerSummary`/`pushMcpDiagnosticError`)
  - 상세: 여러 `McpServerRefConfig` 가 `materializeServer` → `openServer` 로 동시 실행되며, 각자 완료 시점에 같은 배열에 `push` 한다. Node 단일 스레드 이벤트 루프에서 `Array.prototype.push` 는 `await` 경계 없이 동기적으로 실행되므로 데이터 레이스가 아니다. 신규로 추가된 `pushMcpDiagnosticError` 도 기존 `pushMcpServerSummary` 와 대칭적으로 동일한 동기 push 패턴을 따른다.
  - 제안: 현재는 안전. "accumulator 는 핸들러가 소유, provider 는 push 만" 계약이 코드 주석에 명시돼 있으나, 향후 provider 가 push 이전에 `await` 을 끼워 넣는 형태로 확장되면 order-dependent TOCTOU 가 생길 수 있음을 신규 provider 추가 체크리스트에 남겨둘 것을 권장(이미 plan 문서에 유사 취지 기록됨).

- **[INFO]** MCP 호출 카운터(`mcpDiagnosticsAcc.toolCalls++`/`resourceReads++`/`promptGets++`) 증가는 `Promise.all` resolve 이후 순차 루프에서만 발생 — lost-update 없음
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts` `executeProviderToolBatch()` (L913 `await Promise.all(toRun.map(...))`, L933 이후 `for (const { result, trace } of batchResults)` 루프 내 L942-945 카운터 증가)
  - 상세: 이번 diff 의 핵심 신규 로직인 `classifyMcpCall` 기반 카운터 집계는 병렬 실행(`Promise.all`)이 완전히 끝난 뒤 동기 루프 안에서만 카운터를 증가시킨다. 즉 "병렬 실행 → 배열 순서 보존 → 순차 집계"로 여러 tool 호출이 동시에 같은 카운터를 increment 해 갱신을 잃는 경합(lost update)이 없다. 실측 확인: `grep` 결과 `toolCalls++` 등은 모두 `for...of` 동기 루프 내부에만 존재.
  - 제안: 없음. 향후 리팩터링 시 카운터 증가를 `Promise.all` 내부(병렬 구간, `runProviderTool` 등)로 옮기지 않도록 주의.

- **[INFO]** `withTimeout`/`TimeoutError` 변경 — 타이머 정리·경쟁 조건 회귀 없음
  - 위치: `codebase/backend/src/common/utils/with-timeout.ts`
  - 상세: `setTimeout` reject 시 생성하던 익명 `Error` 를 명명된 `TimeoutError` 서브클래스로 교체했을 뿐, `clearTimeout` 위치와 resolve/reject 배타 처리(둘 다 `promise.then` 콜백 내부에서 `clearTimeout` 후 처리)는 변경되지 않았다. "타이머가 먼저 발화" vs "promise 가 먼저 resolve" 경쟁에서 후자가 이기면 `clearTimeout` 으로 정리하는 표준 패턴이 그대로 유지되며, 언더라잉 operation 자체는 취소되지 않는다는 기존 제약도 동일하다.
  - 제안: 없음. 회귀 없음.

- **[INFO]** `McpToolProvider.openServer` 에서 connect 실패 시 세션 close 는 fire-and-forget(`session.close().catch(() => undefined)`) — diagnostics push/재throw 시점에 close 미완료 가능하나 안전
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/tool-providers/mcp-tool-provider.ts` `openServer()` (connect 성공 후 tools/list 실패 분기 → `McpBuildPhaseError` 재포장 → outer catch 의 push+re-throw)
  - 상세: `session.close()` 를 await 하지 않고 diagnostics(`errors[]`, `serverSummaries`) push 및 re-throw 가 먼저 진행된다. 세션은 성공 경로에서만 `sessions`/`sessionsByExecution` map 에 등록되므로, 이 실패 경로에서는 애초에 map 미등록 상태 — 이후 `cleanup()` 이 같은 세션을 중복 close 할 경합도 없다. 의도된 best-effort 정리(주석에 명시)로 판단.
  - 제안: 없음.

- **[INFO]** `inflight` Map 기반 동시 open TOCTOU 방지 — 이번 diff 로 훼손되지 않음(회귀 확인)
  - 위치: `mcp-tool-provider.ts` `materializeServer()` 부근의 `inflight` 캐시, `.finally()` 정리
  - 상세: 이번 diff 는 `openServer` 내부의 에러 분류(phase+code)만 확장했고, 동일 `(executionId, integrationId)` 조합의 이중 open 을 막는 `inflight` Map dedup 및 `.finally()` 기반 정리 로직은 그대로 유지된다. 신규 `mcpDiagnosticErrors` 슬롯 도입이 이 불변식에 영향을 주지 않음을 확인.
  - 제안: 없음.

## 요약
이번 변경(`mcpDiagnostics` 를 `serverSummaries[]` 단일 배열에서 `attempted/serverCount/toolCalls/resourceReads/promptGets/serverSummaries/errors` 구조화 객체로 확장 + `withTimeout` 에 `TimeoutError` 도입 + build-phase granular error code 분류, commit `1a4124842`)은 동시성 관점에서 신규 위험을 도입하지 않는다. 여러 MCP 서버의 병렬 `Promise.allSettled` open 과 turn 내 tool 호출의 병렬 `Promise.all` 실행 모두 기존에 확립된 안전한 패턴 — 공유 accumulator 로의 push/카운터 증가는 항상 `await` 경계 밖(동기 구간)에서만 일어나고, 카운터 집계는 병렬 실행이 완전히 끝난 뒤 순차 루프에서 수행 — 을 그대로 따른다. `withTimeout` 의 타이머 정리 로직, `openServer` 의 fire-and-forget 세션 close, `inflight` map 기반 이중 open 방지 등 기존 동시성 안전장치도 훼손되지 않았다. 신규로 추가된 `mcpDiagnosticErrors` push 경로 역시 기존 `mcpDiagnostics`(serverSummaries) push 와 대칭적인 동기 패턴을 따르므로 레이스 컨디션이나 이중 카운팅 위험이 없다.

## 위험도
LOW
