# 요구사항(Requirement) 리뷰 — refactor m-1: console.* → NestJS Logger + no-console 가드

## 발견사항

### [INFO] [SPEC-DRIFT] spec 본문의 `console.warn` 처방이 코드 변경 후 낡음
- 위치: `spec/4-nodes/3-ai/1-ai-agent.md:406`, `spec/4-nodes/6-presentation/0-common.md:407`
- 상세: 두 spec 본문이 각각 `console.warn('[processMultiTurnMessage] form submission without pendingFormToolCall — fallback to plain user message', ...)` 및 `console.warn('[processAiResumeTurn] unknown action.type', ...)` 를 구체적으로 처방한다. 코드는 NestJS Logger 전환이 완료된 상태이므로 이 처방은 낡았다. 커밋 메시지가 "planner spec-sync 위임(plan §m-1)" 으로 명시하고 있어 의도적 결정이다. 코드가 올바르고 spec 이 갱신 대기 중이다.
- 제안: 코드 유지 + spec 반영. 대상:
  - `spec/4-nodes/3-ai/1-ai-agent.md §6.2.c.fallback` — `console.warn(...)` → `logger.warn(...)` (또는 NestJS Logger 관용구)
  - `spec/4-nodes/6-presentation/0-common.md:407` — 표 행의 `console.warn(...)` → `logger.warn(...)` 또는 방법론 중립 표현으로 갱신
  - plan §m-1 에 이미 등재된 planner 위임 사항

### [INFO] node-handler spec 테스트 assertion 약화
- 위치: `/Volumes/project/private/clemvion/codebase/backend/src/nodes/core/node-handler.registry.spec.ts` — `expect.stringContaining('NodeHandlerRegistry')` → `expect.stringContaining('executionMetadata')`
- 상세: 실제 warn 메시지는 `(non-production) NodeHandlerRegistry.assertConsistency: N node type(s) registered without executionMetadata: [...]` 이므로 두 문자열 모두 포함된다. 변경 후에도 테스트는 통과하지만 `'NodeHandlerRegistry'` 를 그대로 유지하면 warn 발원 컨텍스트까지 검증할 수 있었다. `'executionMetadata'` 만 검증해도 기능 의미는 같으므로 버그 아님.
- 제안: 현 상태 유지 가능. 더 강건한 검증을 원할 경우 `'NodeHandlerRegistry'` 또는 두 문자열 모두 포함하는 assertion 으로 교체.

### [INFO] plan m-1 나열 파일과 실제 변경 대상의 차이
- 위치: `plan/in-progress/refactor/03-maintainability.md §m-1` vs 커밋
- 상세: plan m-1 은 `modules/audit-logs/audit-logs.service.ts:85` 를 미착수 목록에 포함했지만, 현재 파일은 이미 `private readonly logger = new Logger(AuditLogsService.name)` 가 존재하며 `console.*` 가 없다. 이전 커밋에서 별도 전환된 것으로 보인다. 기능 문제는 없으나 plan 문서의 미착수 목록이 stale 하다.
- 제안: plan §m-1 미착수 목록에서 `audit-logs.service.ts` 항목 제거 또는 완료 표시.

### [INFO] `§6.2 구조화 JSON 로그 형식`과 단순 문자열 warn 호출 간 해석 여지
- 위치: 변환된 warn 호출들 (예: `this.logger.warn('[mcp:test] ${code}: ${detail}')`)
- 상세: `spec/5-system/3-error-handling.md §6.2` 는 `{ timestamp, level, service, message, requestId, ... }` 형태의 구조화 JSON 을 로그 포맷으로 정의한다. 변환된 코드의 대부분 호출은 단순 문자열 인자를 전달한다. 단, `language-hint-defaults.ts` 의 경우 이미 `JSON.stringify({kind, message, migration_guide})` 구조화 호출이 존재한다. NestJS Logger 를 pino/winston 등 JSON transport 와 연결하면 출력 단에서 형식화되므로 caller 마다 JSON 객체를 전달할 필요가 없다는 해석도 유효하다. 코드베이스 전반의 기존 관행과 일치하며 이번 변경 전부터의 패턴이므로 이번 변경의 결함이 아님.
- 제안: 현 상태 유지. 향후 구조화 로그 일관화가 필요하다면 별도 backlog 로 추적.

---

## 요약

이번 변경은 `plan/in-progress/refactor/03-maintainability.md §m-1` 의 요구사항을 완전히 구현한다. 서비스 레이어의 `console.*` 5개 소재(main.ts + telegram-renderer + language-hint-defaults + mcp-test-connection + node-handler.registry)를 NestJS Logger 로 전환하고, pre-bootstrap / module-load IIFE 의 3건은 `eslint-disable-next-line no-console` 인라인 면제로 처리했다. eslint `no-console: error` 신규 규칙은 scripts/ · instrumentation.ts · 테스트 파일에 대한 override 를 포함하며, 재발 차단 의도에 부합한다. 테스트 spy 갱신 2건도 실제 로거 경로와 정합한다. spec 본문의 `console.warn` 처방 2곳은 SPEC-DRIFT 로 planner 위임이 커밋에 명시되어 있어 코드를 되돌릴 이유가 없다. CRITICAL 또는 WARNING 발견사항 없음.

---

## 위험도

NONE
