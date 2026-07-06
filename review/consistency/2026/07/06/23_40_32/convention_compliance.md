# 정식 규약 준수 검토 — spec/5-system/11-mcp-client.md (impl-done)

## 검토 범위
- target: `spec/5-system/11-mcp-client.md` (§4.4/§6.2/§7/§8.1/§8.2/§8.3/§9/Rationale)
- diff-base: `origin/main` — connect-phase `TimeoutError` 분류, call-phase `mcpErrorDelta` 누적(`McpToolProvider`/`Cafe24McpToolProvider`/`MakeshopMcpToolProvider`), `mcp-error-codes.ts` 의 `redactMcpSecrets`/`sanitizeMcpErrorMessage` 시크릿 마스킹 추가
- 대조: `spec/conventions/error-codes.md`, `spec/conventions/node-output.md`, `spec/conventions/spec-impl-evidence.md`, CLAUDE.md 문서 구조 규약

## 발견사항

- **[INFO]** `redactMcpSecrets` 시크릿 마스킹 동작이 spec 본문에 미문서화
  - target 위치: `spec/5-system/11-mcp-client.md §8.2`(에러 코드 vocabulary), `§8.3`(`IntegrationUsageLog.error` — `message` 는 2KB 로 clamp)
  - 위반 규약: 직접적인 conventions 위반은 아님. CLAUDE.md "정보 저장 위치" 원칙("기술 명세는 spec 본문") 및 `spec/conventions/spec-impl-evidence.md` 의 "spec 이 약속한 surface" 취지와 관련된 gap
  - 상세: `mcp-error-codes.ts` 에 신설된 `redactMcpSecrets`/`MCP_REDACTED_PLACEHOLDER`(URL userinfo, Bearer 토큰, Authorization/X-Api-Key 헤더, token/api_key/secret/password 쿼리 파라미터 마스킹)가 `sanitizeMcpErrorMessage` 파이프라인에 편입되어 `mcpDiagnostics.errors[].message` / `IntegrationUsageLog.error.message` / `Integration.last_error` 세 표면 모두에 적용된다. 그러나 target 문서 §8.2/§8.3 은 여전히 "제어문자 제거 + clamp" 만 언급하고 redaction 동작을 기술하지 않는다. 정식 규약 위반은 아니지만(에러 코드 vocabulary·명명 자체는 안 바뀜) 문서 구조 규약이 요구하는 "본문이 실제 구현 계약을 정의"하는 역할에 공백이 생김 — 이후 `error-codes.md`/`node-output.md` 의 `output.error.message` 계약을 참조하는 다른 spec 작성자가 redaction 존재를 알 길이 없음.
  - 제안: `project-planner` 위임으로 §8.2 또는 §8.3 에 1~2문장("`message` 는 URL userinfo/Bearer 토큰/Authorization 헤더/labelled query·kv 시크릿을 `[redacted]` 로 마스킹한 뒤 clamp 된다")을 추가 권장. Rationale 섹션에 defense-in-depth 근거(코드 주석에 이미 있음: "spec-sync mcp-client follow-up, task_fa96e218")를 옮겨 적으면 §Rationale 구조에도 부합.

- **[INFO]** `MCP_ERROR_CODES.TIMEOUT` 신규 코드의 §8.2 vocabulary 표 정합성은 이미 준수됨 (참고용 확인 결과, 발견사항 아님)
  - target 위치: `spec/5-system/11-mcp-client.md §8.2`
  - 확인: `MCP_TIMEOUT` 코드가 §8.2 표·§6.2 진단 구조·§9 연결 테스트 응답 코드 세트에 모두 정합되게 등장하며, 실제 `codebase/backend/src/modules/mcp/mcp-error-codes.ts` 의 `MCP_ERROR_CODES.TIMEOUT = 'MCP_TIMEOUT'` 과 명명 형식(`<DOMAIN>_<CONDITION>`, UPPER_SNAKE_CASE)이 `error-codes.md §1` 규약을 준수. `resources/list`/`prompts/list` phase 추가도 §6.2/§8.1 본문에 이미 반영되어 있어 코드-스펙 phase enum 정합.
  - 제안: 조치 불요 (정상 사례로만 기록).

- **[INFO]** `mcpErrorDelta` 필드 명명이 기존 delta 패턴과 일관
  - target 위치: 해당 없음(코드 레벨 확인)
  - 확인: `AgentToolResult.mcpErrorDelta`(신규) 가 기존 `ragSourcesDelta`/`ragDiagnosticsDelta` 와 동일한 `<domain><Concept>Delta` 접미사 명명 패턴을 따름(`agent-tool-provider.interface.ts`). `node-output.md` 가 이 필드에 대해 직접 규정하진 않으나 기존 관례와 정합적이라 위반 없음.
  - 제안: 조치 불요.

## 요약
이번 diff(connect-phase timeout 분류, call-phase `mcpErrorDelta` 누적, 에러 메시지 시크릿 redaction)는 `spec/conventions/error-codes.md`(에러 코드 명명·안정성), `spec/conventions/node-output.md`(`output.error` 계약), CLAUDE.md 문서 구조 규약(Overview/본문/Rationale, frontmatter) 어느 것도 직접 위반하지 않는다. `MCP_ERROR_CODES.TIMEOUT` 을 포함한 신규 에러 코드·phase vocabulary 는 이미 target 문서 §6.2/§8.1/§8.2 본문에 반영되어 코드와 정합하고, 신규 `mcpErrorDelta` 필드 명명도 기존 delta 패턴과 일관된다. 유일한 공백은 신설된 `redactMcpSecrets` 시크릿 마스킹 동작이 spec 본문(§8.2/§8.3)에 아직 기술되지 않은 점인데, 이는 정식 규약의 직접 위반이 아니라 spec-impl 정합성 보강이 필요한 INFO 수준의 문서화 공백이다.

## 위험도
LOW
