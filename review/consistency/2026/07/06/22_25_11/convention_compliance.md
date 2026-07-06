# 정식 규약 준수 검토 — spec/5-system/11-mcp-client.md

## 검토 모드
구현 완료 후 검토 (--impl-done, scope=spec/5-system/11-mcp-client.md, diff-base=origin/main)

## 발견사항

- **[INFO]** `errors[].code` 의 `string` 자유 타입 — `error-codes.md` §1 "적용 범위" 재확인 필요
  - target 위치: §6.2 진단 누적, §8.2 에러 코드 vocabulary
  - 위반 규약: `spec/conventions/error-codes.md` §1 (의미 기반 명명, `UPPER_SNAKE_CASE`) / §1 도메인 prefix 권장
  - 상세: `codebase/backend/src/nodes/ai/ai-agent/tool-providers/mcp-diagnostics.ts` 의 `McpDiagnosticError.code: string` 은 외부 MCP(`MCP_*`)와 Internal Bridge(`CAFE24_*` 등)의 이종 vocabulary 를 한 필드에 자유 문자열로 담는다. 두 vocabulary 모두 실제 값(`MCP_TIMEOUT`/`MCP_CONNECT_FAILED`/`MCP_LIST_FAILED`, `CAFE24_AUTH_FAILED`/`CAFE24_TRANSPORT_FAILED`/`CAFE24_CALL_FAILED`)은 `UPPER_SNAKE_CASE` + 도메인 prefix 규약을 잘 따르고 있어 CRITICAL 은 아니다. 다만 union 타입을 포기하고 `string` 으로 연 것은 `error-codes.md` 가 요구하는 "코드는 클라이언트가 의미로 분기하는 안정적 계약"이라는 전제와, 컴파일 타임에 오탈자를 잡지 못하게 하는 완화라 향후 신규 코드 도입 시 규율 이탈 리스크가 있다. 코드 주석(`mcp-diagnostics.ts` docblock)이 "union 이 아닌 자유 문자열" 임을 의도적으로 명시하고 있어 설계 의도는 분명하다.
  - 제안: 현행 유지 가능. 다만 향후 `code:` 값이 늘어나면 `MCP_ERROR_CODES[keyof...]` ∪ 각 Internal Bridge 자체 코드 union 으로 좁히는 것을 고려. 규약 갱신이 필요하다면 `error-codes.md` §1 에 "cross-vocabulary 필드는 자유 문자열 허용" 예외를 명시적으로 추가하는 편이 정합적.

- **[INFO]** target 문서에 명시적 `## Rationale` 섹션 부재
  - target 위치: 문서 전체 (`spec/5-system/11-mcp-client.md`, §1~§12 로 종결, Rationale 섹션 없음)
  - 위반 규약: CLAUDE.md "Spec 문서 3섹션 구성 (Overview / 본문 / Rationale) 권장"
  - 상세: `spec/5-system/*.md` 18개 중 15개가 `## Rationale` 섹션을 갖는 관행에 비해 본 문서는 없음. 다만 결정 배경(예: §3.2 "Production fail-closed 강제", §8.4 "자동 복구 미적용 이유", §6.2 구현 현황 노트)이 각 절 inline 으로 충분히 기술되어 있어 정보 자체는 누락되지 않았다. 이번 PR 은 §6.2 본문만 갱신했고 문서 구조 자체를 바꾸지 않았으므로 이번 변경이 신규로 야기한 문제는 아니다(기존부터 있던 구조).
  - 제안: 이번 PR 스코프에서 강제할 사안은 아님. 후속 spec 정리 시 산재한 배경 설명을 `## Rationale` 로 모으는 리팩토링을 고려.

## 요약

`spec/5-system/11-mcp-client.md` §6.2 의 `mcpDiagnostics` 구조화 승격과 이에 대응하는 구현(`mcp-diagnostics.ts`, `ai-turn-executor.ts`, `mcp-tool-provider.ts`)을 검토한 결과, 정식 규약 위반은 발견되지 않았다. 신규 에러 코드(`MCP_TIMEOUT`/`MCP_CONNECT_FAILED`/`MCP_LIST_FAILED`)는 `spec/conventions/error-codes.md` §1 의 `UPPER_SNAKE_CASE`·의미 기반 명명·도메인 prefix 원칙을 그대로 따르며, `mcp-error-codes.ts` 의 `MCP_ERROR_CODES` SoT 상수와 정확히 일치한다. `meta.mcpDiagnostics` 필드는 `node-output.md` Principle 2/8.2 (`meta` 는 실행 메트릭 전용, 카운터·요약 배열은 이 범주에 부합)와 정합하고, `skipReason`(lower_snake_case) vs `errors[].code`(UPPER_SNAKE_CASE) 의 표기 분리도 target 문서 §6.2 "명명 규칙 분리" 단락이 명시적으로 근거를 제공한다. spec frontmatter(`status: partial`, `code:`, `pending_plans:`)의 코드 경로는 모두 실존이 확인됐고, spec 문서 자체도 동일 PR 라인에서 코드와 함께 갱신되어 `spec-impl-evidence.md` 의 spec-구현 동기화 원칙에 부합한다. 발견된 두 건은 모두 INFO 수준으로, 설계 의도가 문서화되어 있거나 이번 변경 범위 밖의 기존 구조 이슈다.

## 위험도
LOW
