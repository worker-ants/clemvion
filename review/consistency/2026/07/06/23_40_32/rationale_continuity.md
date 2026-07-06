### 발견사항

- **[INFO]** `mcp-error-codes.ts` 의 secret redaction 로직이 target 의 Rationale/본문 어디에도 문서화되지 않음
  - target 위치: `spec/5-system/11-mcp-client.md` §8.2 (에러 코드 vocabulary), §8.3 (`IntegrationUsageLog` — `message` 는 2KB 로 clamp)
  - 과거 결정 출처: 없음 (신규 diff 내 신규 함수 — `codebase/backend/src/modules/mcp/mcp-error-codes.ts` 의 `redactMcpSecrets`/`sanitizeMcpErrorMessage`). 기존 §8.3 은 "`message` 는 2KB 로 clamp" 만 계약으로 명시했었음
  - 상세: diff 는 `sanitizeMcpErrorMessage` (DB 저장·`logger.warn` 양쪽에서 사용되는 공용 sanitizer) 에 URL userinfo·Bearer 토큰·`Authorization`/`X-Api-Key` 헤더·labelled query/kv 시크릿을 마스킹하는 `redactMcpSecrets` 를 추가했다. 이는 §8.3 의 기존 clamp 계약을 위반하지 않고 강화(redact→clamp 순서, 코드 주석에 "clamp 경계에서 토큰 반쯤 노출 방지"까지 고려)하는 defense-in-depth 라 Rationale 관점의 상충(기각된 대안 재도입/원칙 위반)은 없다. 다만 target 문서 §8.2/§8.3 그 어디에도 "에러 메시지에서 credential-shaped span 을 redact 한다" 는 사실이 반영되어 있지 않아, 향후 이 문서만 읽는 사람은 `IntegrationUsageLog.error.message`/`mcpDiagnostics.errors[].message` 에 시크릿이 그대로 실릴 수 있다고 오해할 수 있다.
  - 제안: §8.3 의 "`message` 는 2KB 로 clamp" 문구 옆에 "credential-shaped span(Bearer 토큰·URL userinfo·labelled query/kv 시크릿)은 redact 후 clamp" 한 줄을 추가하거나, §8.2 도입부에 SoT 참조(`mcp-error-codes.ts` `sanitizeMcpErrorMessage`)를 붙여 코드 주석의 "spec-sync mcp-client 후속(task_fa96e218)" 근거를 spec 쪽에서도 추적 가능하게 한다. CRITICAL/WARNING 아님 — 상충이 아니라 보완 누락.

- **[INFO]** target 자체의 Rationale 신설·"Planned" 해제가 모범적으로 이루어짐 (참고용 확인)
  - target 위치: `spec/5-system/11-mcp-client.md` §6.2, §8.1, §8.2, §9, `## Rationale`(신규 항 "timeout 을 별도 `TimeoutError` 로 분류")
  - 과거 결정 출처: 동일 문서의 구 §6.2 "잔여(Planned): call 단계 errors[] 누적은 별도 follow-up", 구 §8.2 `MCP_TIMEOUT` 행의 "call 단계 타임아웃은 아직 MCP_CALL_FAILED 로 흡수"
  - 상세: diff 는 (a) call-phase(`mcpErrorDelta`) 의 `errors[]` 누적을 구현하고 "Planned" 표기를 해제, (b) connect 단계 timeout 을 `TimeoutError` 서브클래스로 분류해 `MCP_TIMEOUT` 을 모든 phase 에서 surface, 두 가지 모두를 위해 새 Rationale 항목("timeout 을 별도 `TimeoutError` 로 분류 (§4.4 / §8.2)")을 함께 추가했다. 이는 "결정의 무근거 번복" 이 아니라 CLAUDE.md 의 "Rebase rearms/spec-sync" 관례와 동일하게 **기능 완성에 따른 문서 동기화 + 근거 기록**의 정석 패턴이다 (참고: `spec/2-navigation/3-schedule.md` Rationale "sort/order 쿼리 반영 — Planned 표기 해제" 와 동일 유형).
  - 제안: 없음 (정합 확인용 INFO — 조치 불필요)

### 요약
target(`spec/5-system/11-mcp-client.md`)의 이번 변경은 과거 Rationale 에서 기각된 대안을 재도입하거나 합의 원칙을 위반하는 사례가 발견되지 않았다. Connect timeout 을 `TimeoutError` 로 분류하는 방식은 기존 §8.2 의 "connect+initialize 통합 실패는 MCP_CONNECT_FAILED 로 흡수" 원칙을 깨지 않고 timeout 만 예외적으로 분리하는 구조로 구현되어 있으며, 이를 설명하는 새 Rationale 항목("timeout 을 별도 TimeoutError 로 분류")이 diff 와 함께 신설되어 "결정 번복 시 근거 미기재" 문제도 없다. call-phase `errors[]` 누적 구현 역시 구 "Planned" 표기를 정합하게 해제한 code-sync 패턴으로, 다른 spec(`3-schedule.md`)의 선례와 동일한 모범 사례다. 유일한 보완 지점은 신규 도입된 secret redaction(`redactMcpSecrets`)이 §8.2/§8.3 어디에도 문서화되지 않은 점으로, 이는 상충이 아니라 spec 커버리지 누락(INFO)이다.

### 위험도
LOW
