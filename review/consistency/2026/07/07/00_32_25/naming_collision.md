# 신규 식별자 충돌 검토 — spec/5-system/11-mcp-client.md (--impl-done)

## 발견사항

- **[INFO]** `TimeoutError` 클래스명이 별도 패키지에도 이미 존재 (참고용, 신규 도입 아님)
  - target 신규 식별자: (신규 아님) `codebase/backend/src/common/utils/with-timeout.ts` 의 기존 `TimeoutError` 를 target diff 가 `mcp-client.service.ts`/`mcp-test-connection.service.ts`/`mcp-tool-provider.ts` 여러 곳에서 신규로 import·재사용
  - 기존 사용처: `codebase/packages/expression-engine/src/errors.ts:54` `export class TimeoutError extends ExpressionError` (표현식 엔진 전용, `name='ExpressionTimeoutError'`, `ErrorCode.EXPR_TIMEOUT` 매핑)
  - 상세: 두 `TimeoutError` 는 완전히 다른 패키지(`packages/expression-engine` vs `backend/src/common/utils`)에 독립적으로 존재하며 import 경로가 겹치지 않아 실질적 충돌(동일 스코프 내 이름 충돌)은 없다. 다만 이번 target 은 `with-timeout.ts` 의 `TimeoutError` 를 MCP 에러 분류의 핵심 판별자(`instanceof TimeoutError`)로 신규 채택했으므로, 향후 두 `TimeoutError` 가 같은 파일에서 동시에 import 될 경우(예: AI Agent 노드가 표현식 평가 + MCP 호출을 함께 다루는 지점) 별칭(alias) 처리가 필요해질 수 있다. 현재 diff 범위 내에서는 그런 동시 import 지점이 없음을 확인했다.
  - 제안: 조치 불요(현재 충돌 없음). 향후 두 `TimeoutError` 를 한 파일에서 함께 써야 할 경우 `import { TimeoutError as McpTimeoutError }` 형태의 별칭 컨벤션을 미리 spec Rationale 에 남겨두면 좋다.

- **[INFO]** `codeForStatus` private 메서드명 — 4개 클래스에서 동일 이름 재사용 (기존 컨벤션 확장)
  - target 신규 식별자: `Cafe24McpToolProvider.codeForStatus` / `MakeshopMcpToolProvider.codeForStatus` (target diff 가 이 두 provider 의 `mcpErrorDelta` 조립에 기존 `codeForStatus` 호출을 추가)
  - 기존 사용처: `codebase/backend/src/nodes/integration/cafe24/cafe24.handler.ts:457`, `codebase/backend/src/nodes/integration/makeshop/makeshop.handler.ts:424` 에 이미 동일 이름의 private 메서드 존재 (워크플로 노드 핸들러용)
  - 상세: 4개 클래스 모두 각자 스코프의 `private` 메서드이며 시그니처(`status: number => string`)와 의미(HTTP status → 서비스별 에러 코드 매핑)가 동일한 일관된 컨벤션이다. 충돌이 아니라 의도된 명명 통일로 판단된다.
  - 제안: 조치 불요. 오히려 바람직한 일관성.

- **[INFO]** 신규 파일 `mcp-error-codes.spec.ts` — 경로/명명 컨벤션 정합
  - target 신규 식별자: `codebase/backend/src/modules/mcp/mcp-error-codes.spec.ts` (신규 파일)
  - 기존 사용처: 없음 — 동일 디렉터리의 `mcp-client.service.ts`/`mcp-client.service.spec.ts`, `mcp-test-connection.service.ts`/`mcp-test-connection.service.spec.ts` 와 동일한 `<name>.ts` + `<name>.spec.ts` 페어링 컨벤션을 그대로 따른다.
  - 상세: 충돌 없음, 컨벤션 위반 없음.
  - 제안: 조치 불요.

## 요약

target 문서(`spec/5-system/11-mcp-client.md`)와 그 구현 diff 가 신규 도입하는 식별자 — `MCP_ERROR_CODES.TIMEOUT`('MCP_TIMEOUT'), `AgentToolResult.mcpErrorDelta`, `McpDiagnosticError` 타입, `McpErrorPhase` 확장값(`resources/list`/`prompts/list`), `redactMcpSecrets`/`MCP_EXTRA_SECRET_PATTERNS`, 로컬 상수 `META_PHASE` — 을 전수 검색한 결과 기존 코드베이스·spec 어디에서도 동일 이름이 다른 의미로 이미 쓰이고 있는 사례는 없었다. `MCP_ERROR_CODES` 는 `MCP_` prefix 로 네임스페이스가 분리되어 있고, `mcpErrorDelta`/`McpDiagnosticError` 는 기존 `ragDiagnosticsDelta`/`KbSearchDiagnostic` 패턴과 대칭으로 신설된 순수 신규 식별자다. 공용 `SECRET_LEAK_PATTERNS`(`shared/utils/sanitize-error-message.ts`)는 재사용(import)만 하고 있어 파편화나 재정의 충돌이 없다. 유일하게 참고할 사항은 `common/utils/with-timeout.ts` 의 `TimeoutError` 와 `packages/expression-engine` 의 `TimeoutError` 가 이름은 같으나 서로 다른 패키지에 독립적으로 존재한다는 점인데, 이는 이번 target 이 새로 만든 충돌이 아니라 기존부터 있던 상태이며 import 경로가 겹치지 않아 실질적 문제는 없다. 신규 spec 파일 경로·요구사항 ID·API endpoint·이벤트명 신설도 이번 diff 범위에는 없어 해당 관점에서 지적할 사항이 없다.

## 위험도

NONE
