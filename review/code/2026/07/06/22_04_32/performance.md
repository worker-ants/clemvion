# 성능(Performance) 리뷰 결과

## 발견사항

- **[INFO]** `classifyMcpCall` — O(1) 문자열 검사, batch 당 호출 비용 무시 가능
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/tool-providers/mcp-diagnostics.ts` `classifyMcpCall()` (`startsWith` + `indexOf` + `slice`), 호출부 `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts` `executeProviderToolBatch()` L913-946 `for (const { result, trace } of batchResults)` 루프 내부
  - 상세: tool_call 1건당 문자열 prefix 검사 1회 + `indexOf`/`slice` 각 1회로 O(name.length), 실제로는 도구 이름 길이가 짧아 사실상 O(1). 이 분류는 이미 `Promise.all` 로 병렬 실행되고 resolve 된 `batchResults` 를 순회하는 기존 루프에 끼워 넣은 것이라 신규 순회나 신규 비동기 대기가 추가되지 않았다. 배치 크기는 LLM 한 턴의 tool_calls 개수(통상 한 자릿수)로 상한이 있어 문제 없음.
  - 제안: 조치 불필요.

- **[INFO]** `finalizeMcpDiagnostics` — O(n) (n = serverSummaries 길이), 실행당 1회
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/tool-providers/mcp-diagnostics.ts` `finalizeMcpDiagnostics()` (`acc.serverSummaries.filter((s) => s.status === 'connected').length`)
  - 상세: `mcpServers[]` 설정 항목 수(보통 한 자릿수)에 비례하는 단순 filter. 노드 실행당(single-turn 1회 / multi-turn 은 turn 당 1회) 딱 1회만 호출되므로 반복 호출로 인한 누적 비용 없음. 메모리도 참조만 복사(`serverSummaries: acc.serverSummaries`)해 배열을 재할당하지 않는다.
  - 제안: 조치 불필요.

- **[INFO]** `McpDiagnosticsAccumulator` 도입 — 턴/노드 실행 단위로 신규 객체 1개, GC 부담 미미
  - 위치: `ai-turn-executor.ts` `createMcpDiagnosticsAccumulator()` 호출부 (single-turn 1곳, multi-turn turn loop 내 1곳)
  - 상세: 기존 `McpServerSummary[]` 배열 1개 대신 5개 필드(2 배열 + 3 카운터)를 가진 plain object 1개를 turn/실행마다 생성한다. multi-turn 은 매 turn 마다 새로 생성 — 기존에도 매 turn `mcpDiagnosticsAcc: McpServerSummary[] = []` 로 배열을 새로 만들던 패턴과 동일한 lifecycle 이라 할당 규모가 유의미하게 늘지 않는다(필드 5개 추가 정도).
  - 제안: 조치 불필요.

- **[INFO]** `TimeoutError` 서브클래스 도입 — 예외 처리 경로에 새 `instanceof` 체크만 추가, 핫패스 영향 없음
  - 위치: `codebase/backend/src/common/utils/with-timeout.ts`, `codebase/backend/src/nodes/ai/ai-agent/tool-providers/mcp-tool-provider.ts` `openServer()` 의 `err instanceof TimeoutError` 분기
  - 상세: 익명 `Error` 생성을 named subclass 생성으로 바꾼 것뿐이라 런타임 비용 차이는 없다. `instanceof` 판정은 실패(에러) 경로에서만 실행되며 정상 경로(대부분의 호출)에는 영향 없음.
  - 제안: 조치 불필요.

- **[INFO]** `openServer` 의 에러 재포장(`McpBuildPhaseError`) — 실패 경로에서만 객체 1개 추가 생성
  - 위치: `mcp-tool-provider.ts` `openServer()` connect/list try-catch 블록
  - 상세: 정상(성공) 경로에는 어떤 추가 객체도 생성되지 않는다. 실패 시에만 `McpBuildPhaseError` 래핑 객체 1개가 추가로 생성되는데, 이는 이미 예외적 상황(네트워크/타임아웃 실패)이라 성능 critical path 가 아니다.
  - 제안: 조치 불필요.

- **[INFO]** N+1/블로킹 I/O 관점 — 본 diff 는 신규 DB/네트워크 호출을 추가하지 않음
  - 위치: 전체 diff
  - 상세: 이번 변경은 (1) 기존에 이미 존재하던 `withTimeout` 감싼 `connect`/`listTools` 호출의 에러를 분류만 다르게 하는 것, (2) 이미 계산된 tool 이름 문자열을 분류해 카운터를 증가시키는 것으로, 반복문 내 신규 DB 쿼리나 외부 API 호출을 추가하지 않는다. 병렬 open(`Promise.allSettled`)·병렬 tool 실행(`Promise.all`) 구조도 기존 그대로 유지된다.
  - 제안: 조치 불필요.

## 요약
이번 변경은 MCP 진단 메타(`mcpDiagnostics`)를 단일 배열에서 구조화 객체로 승격하고 build-phase 실패를 granular 코드로 분류하는 리팩터로, 추가된 연산은 모두 O(1)~O(작은 배열 길이) 수준이며 기존 병렬 처리(`Promise.allSettled`/`Promise.all`) 구조나 반복문 순회 횟수를 변경하지 않는다. 신규 DB/외부 API 호출, 블로킹 I/O, 캐싱 필요 지점, 메모리 누수 가능성은 발견되지 않았으며, 노드 실행/turn 단위로 생성되는 accumulator 객체 1개 추가도 무시 가능한 수준이다.

## 위험도
NONE
