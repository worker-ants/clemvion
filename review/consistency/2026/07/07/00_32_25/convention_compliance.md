# 정식 규약 준수 검토 — `spec/5-system/11-mcp-client.md` (impl-done)

## 검토 범위
- target: `spec/5-system/11-mcp-client.md`
- 구현 diff: `codebase/backend/src/modules/mcp/**`, `codebase/backend/src/nodes/ai/ai-agent/**` (connect timeout 분류 + call-phase `mcpErrorDelta` 도입)
- 대조 규약: `spec/conventions/error-codes.md`, `spec/conventions/node-output.md`, `spec/conventions/spec-impl-evidence.md`, `spec/conventions/cafe24-api-metadata.md` (참조), `spec/conventions/swagger.md` (해당 없음 확인)

## 발견사항

없음 — CRITICAL/WARNING 급 위반을 발견하지 못했다. 확인한 항목은 다음과 같다.

- **frontmatter 스키마 (`spec-impl-evidence.md` §2)**: `id: mcp-client`, `status: partial`, `code:` 6개 경로 전부 워크트리 HEAD 에 실존(`git -C <worktree> cat-file -e HEAD:<path>` 로 확인), `pending_plans: plan/in-progress/spec-sync-mcp-client-gaps.md` 실존. 스키마·라이프사이클 규약(§3) 위반 없음.
- **에러 코드 명명 (`error-codes.md` §1/§2)**: 신규 도입된 것은 `mcpDiagnostics.errors[]` 의 **emit 지점 확장**(connect timeout 분류, call-phase delta 보고)이며 `MCP_TIMEOUT`/`MCP_TOOL_ERROR`/`MCP_CALL_FAILED`/`CAFE24_AUTH_FAILED` 등은 모두 origin/main 에 이미 존재하던 코드다(`git -C <worktree> show origin/main:codebase/backend/src/modules/mcp/mcp-error-codes.ts` 로 대조). 신규 코드 신설·rename 없음 — §2 안정성 정책과 충돌 없음. 값은 전부 `UPPER_SNAKE_CASE`.
- **`McpErrorPhase` vocabulary 확장(`resources/list`/`prompts/list` 추가)**: target 문서 §6.2 본문이 "call 단계(`tools/call`/`resources/read`/`prompts/get`/`resources/list`/`prompts/list`)" 로 이미 이 값들을 문서화하고 있어(2026-07-06 갱신 표기 확인) 코드(`mcp-diagnostics.ts` `McpErrorPhase` union, `mcp-tool-provider.ts` `META_PHASE` 매핑)와 spec 서술이 정합한다.
- **`McpDiagnosticError.code: string`(비-union)**: `node-output.md` Principle 3.2 는 노드 `output.error.code` 를 `UPPER_SNAKE_CASE` 로만 규정하고 타입 강제(enum vs string)는 규약 대상이 아니다. target 문서 §6.2 는 "외부 MCP 는 §8.2 vocabulary, Internal Bridge 는 `CAFE24_*`/`MAKESHOP_*` vocabulary 를 그대로 캐리하므로 union 이 아닌 자유 문자열" 이라고 명시적으로 근거를 남겼고 코드 주석도 동일 문구로 대응한다 — 의도된 설계이며 규약 위반이 아니다.
- **secret redaction 재사용 (`§8.3` 서술 vs `MCP_EXTRA_SECRET_PATTERNS`)**: target 문서 §8.3 "공용 `SECRET_LEAK_PATTERNS`(`shared/utils/sanitize-error-message`) + MCP 전용 URL-userinfo/bare-token 패턴" 서술이 실제 코드(`mcp-error-codes.ts` `redactMcpSecrets` — 공용 패턴 재사용 후 MCP 전용 패턴 추가 적용)와 정확히 일치. 파편화된 별도 SoT 를 새로 만들지 않아 secret-store 계열 규약 취지(SoT 집중)에도 부합.
- **문서 구조(Overview/본문/Rationale)**: target 은 "## 1. 개요" 로 시작해 CLAUDE.md 가 권장하는 "## Overview" 리터럴 헤딩과 다르지만, 이는 `spec/5-system/**` 영역 전체가 공유하는 기존 관행(`1-auth.md`, `5-expression-language.md`, `7-llm-client.md` 등 다수가 동일 패턴)이며 이번 diff 로 새로 도입된 이탈이 아니다. Rationale 섹션은 문서 말미에 정상 존재. 본 PR 범위의 신규 위반으로 보지 않음(INFO 조차 별도로 제기하지 않음 — 기존 영역 전반의 관행이라 이 PR 단독 지적은 signal 가치가 낮음).
- **API 문서 규약(`swagger.md`)**: 이번 diff 는 컨트롤러·DTO 계층 변경이 없다(서비스/프로바이더 내부 로직 + phase enum 확장 + 테스트만) — 해당 규약 적용 대상 아님.

## 요약

이번 PR 은 MCP connect timeout 을 별도 `TimeoutError` 로 분류해 `MCP_TIMEOUT` 으로 승격하고, call-phase(`tools/call` 등) 서버측 실패를 `AgentToolResult.mcpErrorDelta` 로 `mcpDiagnostics.errors[]` 에 누적하는 기능을 추가했다. 신규 에러 코드 신설이 없고(기존 vocabulary 의 emit 지점만 확장), phase enum 확장(`resources/list`/`prompts/list`)과 `McpDiagnosticError.code` 의 자유 문자열 설계 모두 target 문서 §6.2/§8.1/§8.2 본문에 사전에 근거와 함께 명시되어 있어 spec 서술과 구현이 정합한다. secret redaction 도 공용 SoT(`SECRET_LEAK_PATTERNS`)를 재사용하고 MCP 전용 패턴만 얇게 얹는 방식으로 `error-codes.md`/구조적 SoT 분리 원칙에 부합한다. frontmatter(`id`/`status`/`code`/`pending_plans`) 도 `spec-impl-evidence.md` 스키마를 정확히 따른다. 정식 규약 위반은 발견되지 않았다.

## 위험도

NONE
