# 정식 규약 준수 검토 — `spec/5-system/11-mcp-client.md`

## 검토 범위

- target: `spec/5-system/11-mcp-client.md` (impl-done, diff-base `origin/main`)
- 구현 diff: `codebase/backend/src/modules/mcp/**`, `codebase/backend/src/nodes/ai/ai-agent/**` (mcpDiagnostics call-phase errors[], TimeoutError 분류, 에러 메시지 redaction)
- 대조한 정식 규약: `spec/conventions/error-codes.md`, `spec/conventions/node-output.md`, `spec/conventions/spec-impl-evidence.md`, `spec/conventions/swagger.md`

## 발견사항

- **[INFO]** `McpDiagnosticError.code` 가 union 이 아닌 자유 `string`
  - target 위치: `spec/5-system/11-mcp-client.md` §6.2 (`errors[]` 필드 설명 및 구현 노트), 코드 대응: `codebase/backend/src/nodes/ai/ai-agent/tool-providers/mcp-diagnostics.ts` `McpDiagnosticError.code: string`
  - 위반 규약: `spec/conventions/error-codes.md` §1 "적용 범위" — "프로젝트 전체의 에러 코드 문자열에 적용된다 … `CAFE24_*`, `OAUTH_*` 등을 포함한다"는 의미 기반 명명 원칙의 정신은 유지되나, enum 강제(`ErrorCode` 대표 surface 처럼 컴파일 타임 체크)가 아니라 자유 문자열로 캐리됨
  - 상세: target 문서가 "외부 MCP 는 §8.2 vocabulary(UPPER_SNAKE_CASE), Internal Bridge(cafe24/makeshop) 는 자체 vocabulary(CAFE24_*/MAKESHOP_*)를 그대로 캐리하므로 union 이 아닌 자유 문자열"이라고 명시적으로 설계 근거를 밝히고 있어 CRITICAL/WARNING 수준의 위반은 아님. error-codes.md 본문도 §1에서 이 다중 도메인 혼재를 이미 전제하고 있어 상충은 없음 — 다만 두 vocabulary 가 한 필드에 공존한다는 점을 error-codes.md 쪽에서도 명시적으로 인지하도록 교차 링크하면 향후 checker 의 재탐지 비용을 줄일 수 있음
  - 제안: 필수 조치 아님. 여유 있을 때 `error-codes.md` §1 각주에 "`McpDiagnosticError.code` 필드는 외부/Internal Bridge 두 vocabulary 를 한 필드에 caary" 링크를 추가하는 정도의 INFO 성 개선

- **[INFO]** `mcp-diagnostics.ts` 파일 헤더 doc-comment 의 "call-phase errors[] 는 별도 follow-up" 서술이 이번 PR 반영 후 stale
  - target 위치: 코드 파일(`codebase/backend/src/nodes/ai/ai-agent/tool-providers/mcp-diagnostics.ts` 상단 모듈 doc-comment, diff 미포함 영역) — target spec 문서 자체는 아님
  - 위반 규약: 정식 규약 직접 위반은 아님 (코드 주석 정합성은 conventions 검토 범위 밖, `/ai-review` 코드 리뷰 영역)
  - 상세: target 문서 §6.2 는 이미 "2026-07-06 갱신"으로 call-phase `errors[]` 구현을 정확히 반영했으나, 같은 이름의 코드 파일 상단 주석은 여전히 "call-phase errors[] 누적은 별도 follow-up"이라고 서술 — spec 문서(SoT)는 최신인데 코드 주석만 뒤처짐
  - 제안: spec 문서는 문제 없음. 코드 주석 갱신은 `/ai-review` 트랙에서 다룰 사항으로 별도 이관 권장(본 검토 대상 아님, 참고용으로만 표기)

- **[INFO]** `spec/4-nodes/4-integration/5-makeshop.md` 와의 `code:` 소유 경계 확인
  - target 위치: target frontmatter `code:` (6개 파일 나열, `makeshop-mcp-tool-provider.ts` 미포함)
  - 위반 규약: 없음 — `spec/conventions/spec-impl-evidence.md` §2.1/§4 확인 결과 `code:` 글로브는 "≥1 파일 매치"만 가드 대상이며 전체 diff 파일의 완전한 열거를 요구하지 않음. `makeshop-mcp-tool-provider.ts` 는 `spec/4-nodes/4-integration/5-makeshop.md` 의 `code:` 가 이미 소유 (실측 확인) — 중복 소유 회피는 오히려 바람직한 패턴
  - 상세: 문제 없음, 확인 차 기록
  - 제안: 조치 불필요

## 검토 결론 (규약별)

1. **명명 규약**: `MCP_ERROR_CODES.TIMEOUT = 'MCP_TIMEOUT'` 신설이 `error-codes.md` §1 도메인 prefix(`MCP_*`) + UPPER_SNAKE_CASE 규약을 정확히 준수. `INVALID_TOOL_ARGUMENTS` prefix-less 예외도 이미 `error-codes.md` §1 각주에 정식 등재되어 있어 정합. `skipReason`(lower_snake_case) vs `errors[].code`(UPPER_SNAKE_CASE) 의 표기 분리도 `node-output.md` Principle 3.2 및 target §6.2 각주와 완전히 일치.
2. **출력 포맷 규약**: `meta.mcpDiagnostics` 구조(`attempted`/`serverCount`/`toolCalls`/`resourceReads`/`promptGets`/`serverSummaries[]`/`errors[]`), `McpDiagnosticError{integrationId, phase, code, message}` 신설 필드 모두 `node-output.md` Principle 2 (meta 는 실행 메트릭), Principle 3.2 (`code` UPPER_SNAKE_CASE, `message` 영문 원문) 와 부합. `IntegrationUsageLog.error.message` 2KB clamp + `sanitizeMcpErrorMessage` 의 redaction 로직 신설도 §8.3 표(message 2KB clamp)와 정합하며 오히려 시크릿 유출 방지를 강화하는 defense-in-depth로, 규약 위반 소지 없음.
3. **문서 구조 규약**: target 문서는 frontmatter(`id`/`status: partial`/`code:`/`pending_plans:`) + `## 1. 개요` + 본문(§2~§12) + `## Rationale` 구조를 정확히 유지. `pending_plans` 명시 파일(`plan/in-progress/spec-sync-mcp-client-gaps.md`) 실존 확인. `status: partial` 유지도 §3.3 capabilities 캐시 미구현 등 실제 Planned 잔여와 부합.
4. **API 문서 규약**: 이번 diff 는 Controller/DTO 변경이 없어 `swagger.md` 대상 범위 밖(N/A).
5. **금지 항목**: `error-codes.md` §2 (rename 은 breaking) 위반 없음 — 이번 변경은 신규 코드(`MCP_TIMEOUT` 분기 확장, `resources/list`/`prompts/list` phase 추가) 신설이지 기존 코드 rename 이 아님. `node-output.md` Principle 8 금지 패턴(이중 wrapping 등)도 해당 없음.

## 요약

이번 MCP client diagnostics 후속 변경(call-phase `errors[]` 누적, connect-timeout 을 별도 `TimeoutError` 로 분류해 `MCP_TIMEOUT` 코드로 승격, 에러 메시지 secret redaction)은 `spec/5-system/11-mcp-client.md` 본문·frontmatter 모두 `spec/conventions/error-codes.md`(의미 기반 명명·UPPER_SNAKE_CASE·prefix 규약)와 `spec/conventions/node-output.md`(meta/에러 컨트랙트 표준)를 정확히 준수하며 신설한다. frontmatter lifecycle(`partial` + `pending_plans` 실존)도 `spec-impl-evidence.md` 규약에 맞게 유지되었고, 다른 spec(`5-makeshop.md`)과의 `code:` 소유 경계도 깨끗하게 분리되어 있다. 발견된 사항은 모두 INFO 수준(자유 문자열 `code` 필드의 vocabulary 혼재를 target 문서가 이미 명시적으로 정당화, 코드 주석의 경미한 staleness)으로, 정식 규약을 직접 위반하는 CRITICAL/WARNING 요소는 없었다.

## 위험도

NONE
