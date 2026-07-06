# 부작용(Side Effect) 리뷰 결과

## 발견사항

- **[INFO]** `withTimeout` 이 이제 `Error` 대신 `TimeoutError` 서브클래스로 reject
  - 위치: `codebase/backend/src/common/utils/with-timeout.ts`
  - 상세: `common/utils/with-timeout.ts` 는 `McpToolProvider` 뿐 아니라 `mcp-test-connection.service.ts` 도 공유해서 쓰는 유틸이다. 두 소비자 모두 `err instanceof Error` 로만 분기하고 `err.message` 포맷은 그대로(`"${label} timed out after ${ms}ms"`) 유지되므로 기존 호출자에 회귀는 없다(`TimeoutError extends Error`). 다만 `McpClientService` 등 아직 이 클래스를 소비하지 않는 다른 곳은 새 분류 정보(`instanceof TimeoutError`)를 활용하지 못한 채 남는다 — 이미 plan/RESOLUTION 에 follow-up 으로 기록됨(INFO 5).
  - 제안: 별도 조치 불필요, 현재 하위호환 확인됨. 후속 PR 추적만 유지.

- **[INFO]** `meta.mcpServerSummaries` → `meta.mcpDiagnostics` 필드명 변경 (공개 output 스키마)
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts` (`buildMcpDiagnosticsMeta`, executeSingleTurn/executeMultiTurn 의 meta 조립부)
  - 상세: 이 메타 필드는 노드 실행 결과로 프런트/외부에 emit 되는 공개 표면이다. `grep -rn mcpServerSummaries codebase/`(backend+frontend) 결과 0건으로, 기존 소비자가 없어 실질적 breaking 영향은 없는 것으로 확인된다. 다만 이 필드가 이미 프로덕션에 배포되어 실행 이력에 남아있는 과거 레코드(`mcpServerSummaries` 키를 가진 채 저장된 실행 로그/DB JSON)가 있다면, 그 과거 데이터를 읽는 조회 경로가 있는지는 코드 grep 만으로는 확인 불가 — 신규 코드는 새 키만 쓰므로 과거 저장된 실행 기록의 표시 형식이 달라질 수 있다.
  - 제안: 과거 실행 로그를 그대로 재노출하는 조회/재생(replay) 경로가 있는지 한 번 더 확인 권장. 없다면 조치 불필요.

- **[INFO]** `ProviderBuildCtx` 인터페이스에 `mcpDiagnosticErrors?: McpDiagnosticError[]` 필드 추가
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/tool-providers/agent-tool-provider.interface.ts`
  - 상세: 선택적(optional) 필드 추가이므로 기존 `AgentToolProvider` 구현체(`kb-tool-provider`, `cafe24-mcp-tool-provider`, `makeshop-mcp-tool-provider`, `render-tool-provider`)는 컴파일 영향 없이 그대로 무시(no-op) 가능. 실제로 이번 diff 에서 이 4개 provider 는 변경되지 않았고 `McpToolProvider` 만 신규 필드를 소비한다 — 순수 additive 변경으로 시그니처 파괴 없음.
  - 제안: 없음. cafe24/makeshop MCP provider 가 향후 자체 실패를 `errors[]` 로 표면화하려면 동일 패턴을 따르면 된다(현재는 의도적으로 범위 밖).

- **[INFO]** `pushMcpServerSummary` 시그니처는 유지되었으나 내부 의미가 "raw array" → "accumulator 소유 sub-array" 로 미묘하게 전환
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/tool-providers/mcp-diagnostics.ts`, `ai-turn-executor.ts` (`buildTools` 호출부: `mcpDiagnostics: mcpDiagnostics?.serverSummaries, mcpDiagnosticErrors: mcpDiagnostics?.errors`)
  - 상세: `pushMcpServerSummary(acc: McpServerSummary[] | undefined, entry)` 함수 시그니처 자체는 변경되지 않았다(호출자 영향 없음). `AiTurnExecutor.buildTools` 가 `McpDiagnosticsAccumulator` 를 받아 `serverSummaries`/`errors` 서브필드를 분해해 provider ctx 로 넘기는 방식으로 바뀌었는데, 이 분해·재조립은 해당 private 메서드 내부에 국한되어 외부에 노출되지 않는다.
  - 제안: 없음. 의도된 설계(핸들러가 accumulator 소유, provider 는 sub-array 만 받아 push).

- **[INFO]** 신규 `errors[].message` 가 원시 에러 문자열을 새로운 사용자 대면 meta 표면으로 노출
  - 위치: `mcp-tool-provider.ts` `openServer()` catch 블록 (`sanitizeMcpErrorMessage(err)` → `ctx.mcpDiagnosticErrors` push), `codebase/backend/src/modules/mcp/mcp-error-codes.ts` `sanitizeMcpErrorMessage`
  - 상세: `sanitizeMcpErrorMessage` 는 제어문자 제거 + 길이 clamp 만 수행하고 시크릿/URL/토큰 패턴 redaction 은 없다. 기존에는 이 원시 메시지가 로그·`Integration.last_error`(DB, 내부 전용) 로만 흘렀는데, 이번 변경으로 동일 문자열이 `meta.mcpDiagnostics.errors[].message` 를 통해 실행 결과 meta(사용자/프런트가 조회 가능한 표면)로도 노출 범위가 확대된다. 실제 자격증명 유출 코드 경로는 발견되지 않았으나, MCP 서버 URL/내부 호스트명 등이 에러 메시지에 포함될 경우 정보 노출 표면이 넓어진 것은 사실이다. 이미 SUMMARY.md INFO#1 로 식별되어 `task_fa96e218` 로 후속 이관됨.
  - 제안: 이미 후속 조치로 등록됨 — 별도 추가 조치 불필요. redaction 강화는 별도 PR.

- **[INFO]** `finalizeMcpDiagnostics` 의 `attempted` 판정 부작용 없음, 순수 함수
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/tool-providers/mcp-diagnostics.ts`
  - 상세: `createMcpDiagnosticsAccumulator`/`pushMcpServerSummary`/`pushMcpDiagnosticError`/`classifyMcpCall`/`finalizeMcpDiagnostics` 모두 인자로 받은 객체만 변경하거나 새 객체를 반환하는 순수 함수 — 전역 상태, 모듈 스코프 변수, 파일시스템, 네트워크, 환경변수 접근이 없다.
  - 제안: 없음.

- **[INFO]** 환경 변수 읽기는 기존 그대로(신규 도입 없음)
  - 위치: `mcp-tool-provider.ts` L58-60 (`MCP_CALL_TIMEOUT_MS`/`MCP_LIST_TIMEOUT_MS`/`MCP_CONNECT_TIMEOUT_MS` — diff 컨텍스트에 노출되었을 뿐 미변경)
  - 상세: 본 변경은 이 상수들을 새로 만들거나 수정하지 않는다. 신규 환경 변수 도입 없음.
  - 제안: 없음.

- **[INFO]** 네트워크 호출 경로 변경 없음
  - 상세: `openServer` 의 connect/list 호출 순서·재시도·타임아웃 값은 그대로이며, 실패를 분류해 진단 객체로 감싸는 로직만 추가되었다. 신규 외부 서비스 호출 없음.
  - 제안: 없음.

## 요약

이번 변경은 `mcpDiagnostics` 를 단일 배열에서 구조화 객체로 승격하고 build-phase 실패를 granular 코드로 분류하는 순수 추가적(additive) 리팩터로, 함수 시그니처는 대부분 유지되거나(예: `pushMcpServerSummary`) private 메서드 내부(`AiTurnExecutor.buildTools`, `buildMcpDiagnosticsMeta`)에 국한되어 외부 호출자에 영향이 없다. `ProviderBuildCtx` 인터페이스 확장은 선택적 필드라 기존 4개 tool provider 구현체는 무변경으로 컴파일된다. `withTimeout` 이 `Error` 서브클래스(`TimeoutError`)를 던지도록 바뀌었지만 message 포맷 불변 + `instanceof Error` 하위호환이 유지되어 공유 소비자(`mcp-test-connection.service.ts`)에도 회귀가 없음을 코드로 확인했다. `meta.mcpServerSummaries` → `meta.mcpDiagnostics` 필드명 변경은 grep 상 현재 소비자가 없어 즉각적 breaking 영향은 없으나, 과거에 저장된 실행 이력을 그대로 재노출하는 경로가 있는지는 별도 확인이 필요하다. 유일하게 실질적인 부작용 확대는 `sanitizeMcpErrorMessage` 의 redaction 미비로 원시 에러 문자열의 노출 표면이 내부 로그/DB 에서 사용자 대면 meta 로 넓어진 점인데, 이는 이미 팀이 INFO 로 식별하고 후속 task 로 이관한 상태다.

## 위험도
LOW
