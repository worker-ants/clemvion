### 발견사항

- **[INFO]** `mcp-diagnostics.ts`의 `McpErrorPhase` 유니온에 `resources/list`/`prompts/list` 추가
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/tool-providers/mcp-diagnostics.ts:57-63`
  - 상세: `plan/in-progress/mcp-client-diagnostics-followups.md` ①항이 "`McpErrorPhase` 에 `resources/list`/`prompts/list` 추가"를 명시적으로 범위에 포함하고 있고, `mcp-tool-provider.ts` 의 `META_PHASE` 매핑 테이블·`it.each` 4종 테스트·spec §8.1/§8.2 갱신까지 서로 정확히 대응한다. 계획된 타입 확장이며 스코프 이탈이 아니다.
  - 제안: 조치 불필요.

- **[INFO]** `AgentToolResult.mcpErrorDelta` 신규 optional 필드 + provider 4곳(McpToolProvider 2 사이트, Cafe24, Makeshop) delta 생성 로직
  - 위치: `agent-tool-provider.interface.ts:119-128`, `mcp-tool-provider.ts`, `cafe24-mcp-tool-provider.ts:516-533/567-575`, `makeshop-mcp-tool-provider.ts:516-533/565-573`, `ai-turn-executor.ts:943-948`
  - 상세: 기존 `ragDiagnosticsDelta` 패턴을 그대로 답습해 call-phase(`tools/call`/`resources/read`/`prompts/get`/`resources/list`/`prompts/list`) 서버측 실패를 `errors[]` 로 누적하는 계획 ①항의 핵심 구현이다. client-side 실패(`INVALID_TOOL_ARGUMENTS`, `*_MISSING_FIELDS` 등)는 의도적으로 delta 를 set 하지 않는 경계도 plan·spec·테스트가 모두 일치되게 지킨다. 요청 범위를 넘는 추가 기능 없음.
  - 제안: 조치 불필요. (참고: provider 4곳 중복 로직은 여러 리뷰 라운드에서 maintainability INFO 로 이미 식별·follow-up 백로그 처리됨 — scope 관점 문제 아님.)

- **[INFO]** `mcp-error-codes.ts` 의 `redactMcpSecrets`/`sanitizeMcpErrorMessage` secret redaction 추가
  - 위치: `codebase/backend/src/modules/mcp/mcp-error-codes.ts:280-349`, 신규 `mcp-error-codes.spec.ts`
  - 상세: plan ②항(task_fa96e218, 에러 메시지 redaction)이 명시한 "3 sink(errors[].message/IntegrationUsageLog.error/last_error) 동일 적용"과 정확히 일치한다. 공용 `SECRET_LEAK_PATTERNS`(`shared/utils/sanitize-error-message`)를 재사용하고 MCP 전용 패턴(URL userinfo, bare `token=`)만 로컬 추가해 SoT 파편화를 피한 점도 계획 의도(주석에 "secret-redaction SoT 파편화 방지" 명시)와 부합한다.
  - 제안: 조치 불필요.

- **[INFO]** `spec/conventions/error-codes.md` 의 `INVALID_TOOL_ARGUMENTS` prefix-exception 등재
  - 위치: `spec/conventions/error-codes.md:45-51`
  - 상세: plan ③항(task_947e443e)이 "rename 대신 범용 코드로 예외 등재"를 정확히 지시하고 있고, 코드 상수 자체는 변경되지 않았다(breaking rename 회피). spec 문서만 갱신되어 코드-스펙 정합을 맞춘 순수 문서 변경.
  - 제안: 조치 불필요.

- **[INFO]** `McpTestConnectionService`/`McpClientService` 의 `TimeoutError` 도입과 `MCP_TIMEOUT` 코드 소비
  - 위치: `mcp-client.service.ts:145-171`, `mcp-test-connection.service.ts:44-48/102-112/138-145`
  - 상세: plan ④항이 명시한 "connect/list 타임아웃을 `MCP_TIMEOUT` 로 분류, `McpFailureCode` 유니온 확장"과 정확히 일치. `connectInner` 의 `timedOut` 플래그 도입은 이 분류를 가능케 하는 최소 변경이며 무관한 리팩토링이 섞여 있지 않다.
  - 제안: 조치 불필요.

- **[INFO]** `review/**`, `plan/in-progress/**` 산출물 다수 신규 생성 (파일 17-47)
  - 위치: `plan/in-progress/mcp-client-diagnostics-followups.md`, `review/code/2026/07/06/{23_20_02,23_40_32}/**`, `review/consistency/2026/07/06/{22_43_22,23_20_02,23_40_32}/**`
  - 상세: 모두 CLAUDE.md 가 강제하는 표준 워크플로 산출물(구현 후 `/ai-review`+fix, `--impl-prep`/`--impl-done` consistency-check)이며 규정 위치(`review/code/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/`, `review/consistency/...`, `plan/in-progress/<name>.md`)에 정확히 저장되어 있다. 프로덕션 코드나 무관한 영역을 건드리지 않는다. 다만 이번 review 대상 diff 자체가 "리뷰의 리뷰"(선행 라운드 SUMMARY/RESOLUTION/agent 산출물까지 diff 에 포함)라는 점은 이례적이나, 이는 워크플로 이력 보존 목적의 정규 산출물이지 스코프 이탈이 아니다.
  - 제안: 조치 불필요 — 스코프 문제 아님.

- **[INFO]** 이번 diff(파일 1-16, 48-49)는 4개 계획 항목(①~④)과 1:1 대응, 계획에 없는 파일/영역 수정 없음
  - 상세: 변경된 프로덕션+테스트 코드 파일 16개, spec 파일 2개 전부가 plan 문서의 "범위 (4종)" 절에 사전 명시된 항목으로 추적 가능하다. 무관한 모듈(예: DB 마이그레이션, 컨트롤러, 프론트엔드, 다른 노드 타입) 수정은 없다. 순수 포맷팅/공백 변경, 불필요한 주석 삭제, 미사용 임포트 추가와 같은 비관련 변경도 발견되지 않았다 — import 추가(`TimeoutError`, `SECRET_LEAK_PATTERNS`, `McpDiagnosticError`)는 모두 실제 사용처가 있다.
  - 제안: 조치 불필요.

### 요약
전체 변경 세트(코드 16개 + spec 2개 + plan/review 워크플로 산출물 31개, 총 49개 파일)는 `plan/in-progress/mcp-client-diagnostics-followups.md` 에 사전 명시된 4개 후속 항목(① call-phase errors[] 누적, ② 에러 메시지 secret redaction, ③ spec Rationale + INVALID_TOOL_ARGUMENTS prefix 예외 등재, ④ connect/test-connection TimeoutError 소비)과 정확히 1:1 대응하며, 계획에 없는 리팩토링·기능 확장·무관한 파일 수정·의미 없는 포맷팅 변경은 발견되지 않았다. `McpErrorPhase` 유니온 확장, `mcpErrorDelta` 신규 필드, redaction 함수 등 모든 파생 변경도 4개 항목 중 하나로 명확히 추적 가능하고, 이전 리뷰 라운드에서 follow-up 백로그로 이연된 항목(헬퍼 추출, options 객체 리팩터, 5xx 엣지케이스 테스트)은 이번 diff 에 섞이지 않아 스코프 절제가 잘 지켜졌다. `review/`, `plan/` 산출물은 프로젝트 표준 워크플로가 강제하는 정규 산출물로 규정 위치에 정확히 저장되어 스코프 이탈로 볼 수 없다.

### 위험도
NONE

STATUS=success ISSUES=0
