# API 계약(API Contract) 리뷰

## 범위 확인

본 변경은 MCP client 의 connect-phase timeout 분류, 에러 메시지 시크릿 redaction, 그리고 AI Agent `meta.mcpDiagnostics.errors[]` 의 call-phase(`tools/call`/`resources/read`/`prompts/get` 등) 확장이다. REST 컨트롤러·DTO·라우트 정의 변경은 없다(변경 파일 23개 중 컨트롤러 파일 없음). 유일하게 외부에 노출되는 표면은 다음 둘이다.

1. `McpTestConnectionService.test()` 의 반환 값 — 기존 `POST /api/integrations/*/test`(preview-test, §9) 응답 바디 `{ success, code, message }` 의 `code` 유니온에 `MCP_TIMEOUT` 이 신규 추가됨.
2. AI Agent 노드 실행 `meta.mcpDiagnostics.errors[]` — 기존 `McpErrorPhase` 유니온에 `resources/list`/`prompts/list` 추가, `AgentToolResult.mcpErrorDelta` 신규 optional 필드로 call-phase 실패도 `errors[]` 에 합류.

## 발견사항

- **[INFO]** `TestConnectionResult.code` 유니온에 `MCP_TIMEOUT` 추가 — 하위 호환 방식 확인
  - 위치: `codebase/backend/src/modules/mcp/mcp-test-connection.service.ts:44-48` (`McpFailureCode` 유니온), `mcp-client.service.ts:45-71` (connect timeout 판별)
  - 상세: 기존에는 connect timeout 이 `MCP_CONNECT_FAILED` 로 뭉뚱그려 응답됐고, 이제 `MCP_TIMEOUT` 으로 분리된다. 이는 API 응답의 `code` 필드 값이 **기존 케이스 일부에서 바뀌는 것**(동일 실패 상황이 과거엔 `MCP_CONNECT_FAILED`, 지금은 `MCP_TIMEOUT`)이므로 엄밀히는 "새 값 추가"보다 "일부 케이스의 반환 값 변경"에 가깝다. 다만 (a) HTTP 200 + `{success:false, code, message}` 라는 응답 envelope 자체는 그대로이고, (b) UI 가 `code` 를 특정 문자열로 하드코딩 분기하지 않고 제네릭하게 렌더한다고 가정할 경우 실무 영향은 낮다. 프론트가 `MCP_CONNECT_FAILED` 를 특정 분기(예: "URL/credential 재확인" 안내)로 처리하고 있었다면 timeout 케이스가 그 분기에서 빠지게 되어 UX 회귀 가능성이 있다.
  - 제안: 프론트엔드가 `code === 'MCP_CONNECT_FAILED'` 를 하드코딩 분기하는 지점이 있는지 확인하고, 있다면 `MCP_TIMEOUT` 도 동일 UX 분기에 포함시키는 프론트 대응을 짝지어 배포. spec `11-mcp-client.md` §9 는 이미 갱신되어 있어 문서 정합성은 양호.

- **[INFO]** `McpErrorPhase` / `McpFailureCode` 유니온 확장은 순수 additive
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/tool-providers/mcp-diagnostics.ts:57-63`, `agent-tool-provider.interface.ts:1280-1287`(`mcpErrorDelta` optional 필드)
  - 상세: `meta.mcpDiagnostics.errors[]` 는 spec §6.2 에 "항상 존재(`[]` 포함)" 로 이미 계약돼 있던 안정 shape 이며, 이번 변경은 (a) 기존에 채워지지 않던 call-phase 실패가 이제 채워지고, (b) `phase` 유니온에 `resources/list`/`prompts/list` 두 값이 추가된 것뿐이다. 필드 추가·선택적 신규 배열 원소이므로 기존 컨슈머(소비하지 않는 코드)에 breaking 영향 없음. 다만 `errors[]` 를 소비해 UI 배지 등을 렌더하는 프론트가 있다면, 이전엔 발생하지 않던 `phase: 'tools/call'` 원소가 처음으로 나타나므로 프론트 매핑 테이블에 해당 phase 값이 없으면 "Unknown phase" 같은 폴백이 필요할 수 있다.
  - 제안: 프론트의 `mcpDiagnostics.errors[].phase` 매핑(있다면)이 `tools/call`/`resources/read`/`prompts/get`/`resources/list`/`prompts/list` 5종을 모두 다루는지 확인. 없으면 렌더 시 unknown phase 에 대한 안전한 기본 표시 확인.

- **[INFO]** 에러 코드 vocabulary 는 `string` 자유형(union 아님) — 계약 안정성은 문서화된 설계
  - 위치: `mcp-diagnostics.ts:1826-1831` (`McpDiagnosticError.code: string`)
  - 상세: Internal Bridge(Cafe24/MakeShop)는 `CAFE24_*`/`MAKESHOP_*` 코드를, 외부 MCP 는 `MCP_*` 코드를 그대로 실어 나르므로 `code` 필드가 union 이 아닌 `string`이다. 이는 프론트가 코드 값으로 정교한 분기를 할 수 없게 만들지만, spec Rationale 에 의도적 설계로 명시돼 있고(§6.2 "진단 스키마 분리" 절), client-side 실패(`INVALID_TOOL_ARGUMENTS`, `*_MISSING_FIELDS`)는 의도적으로 `errors[]` 에서 제외한다는 경계도 spec/error-codes.md 에 정합되게 기록됨 — 계약 관점에서 결함이 아니라 확인된 설계.
  - 제안: 해당 없음 (정보 확인용).

- **[INFO]** 시크릿 redaction 강화 — 에러 응답 payload 보안 개선, 응답 shape 불변
  - 위치: `codebase/backend/src/modules/mcp/mcp-error-codes.ts:453-501` (`redactMcpSecrets`, `sanitizeMcpErrorMessage`)
  - 상세: `message` 필드의 값(문자열 내용)만 추가로 마스킹되며, 응답 스키마(필드 이름/타입)에는 영향 없음. 정규식 기반 마스킹이라 일부 falsenegative(예: 비표준 헤더명, base64 인코딩된 토큰 등)가 이론상 남을 수 있으나, 이는 defense-in-depth 성격이고 계약 관점의 문제는 아님.
  - 제안: 해당 없음.

- **[INFO]** `preview-test` 엔드포인트(§9)의 기존 이원화된 에러 처리 재확인
  - 위치: spec `11-mcp-client.md` diff 하단 — "`preview-test` 는 HTTP 200 + body.success=false", "credential rotate 경로는 `INTEGRATION_TEST_FAILED` HTTP 400" 두 경로 병존.
  - 상세: 이번 변경 자체가 이 이원화를 새로 만든 것은 아니며 기존 설계에 `MCP_TIMEOUT` 값만 얹었다. 다만 HTTP 200 으로 실패를 표현하는 패턴은 REST 관례상 이례적이라는 점은 계속 유의사항으로 남는다(과거부터 존재하던 설계라 이번 diff 의 지적 대상은 아님).
  - 제안: 해당 없음(기존 설계 확인차 기록).

인증/인가, 페이지네이션, URL/경로 설계 관점은 이번 변경에 해당 대상 코드가 없어 평가 대상 없음.

## 요약

이번 변경 세트는 REST 컨트롤러·DTO·라우트를 건드리지 않는 내부 진단/에러-분류 로직 확장으로, API 계약 관점에서는 (1) MCP 연결 테스트 응답의 `code` 유니온에 `MCP_TIMEOUT` 이 추가되어 일부 케이스에서 기존 `MCP_CONNECT_FAILED` 대신 반환되고, (2) AI Agent 노드의 `meta.mcpDiagnostics.errors[]` 가 call-phase 실패까지 포괄하도록 추가 원소/phase 값을 갖게 된다. 두 변경 모두 응답 envelope(필드 구조)은 그대로 유지한 채 값 공간만 확장하는 형태이며, spec(`spec/5-system/11-mcp-client.md`, `spec/conventions/error-codes.md`)이 함께 갱신되어 문서 정합성도 양호하다. 유일한 잠재 리스크는 프론트가 `MCP_CONNECT_FAILED` 또는 `errors[].phase` 값을 하드코딩 분기하고 있을 경우 신규 값 처리 누락으로 인한 사소한 UX 회귀 가능성이며, breaking change 로 볼 정도의 계약 위반은 아니다.

## 위험도

LOW
