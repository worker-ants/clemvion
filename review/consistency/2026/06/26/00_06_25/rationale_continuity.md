# Rationale 연속성 검토 결과

검토 범위: refactor 03 m-1 — backend 서비스 console.* → NestJS Logger 전환 + eslint no-console 가드
diff-base: origin/main

---

## 발견사항

- **[INFO]** spec §6.2 정합 — 구현이 합의된 원칙을 따름
  - target 위치: eslint.config.mjs `no-console: 'error'` + 5개 파일 Logger 교체
  - 과거 결정 출처: `spec/5-system/3-error-handling.md §6.2` 구조화 JSON 로그 형식 규정; `spec/conventions/chat-channel-adapter.md:84` "swallow (logger.warn)" 명문; `plan/in-progress/refactor/03-maintainability.md §m-1` "spec 대조: D(drift)" 판정 및 Option A 권장
  - 상세: 구현이 plan §m-1 Option A (Logger 교체 5곳 + eslint no-console 추가)를 그대로 따른다. `3-error-handling.md §6.2` 의 구조화 Logger 원칙, `chat-channel-adapter.md:84` 의 `logger.warn` 명문과 정렬된다. 기각된 대안(B: lint 룰 없이 교체만)은 재도입되지 않았다.
  - 제안: 없음 — 정합.

- **[INFO]** scripts/instrumentation/test 면제 — Rationale 부합
  - target 위치: eslint.config.mjs `files: ['src/scripts/**/*.ts', 'src/instrumentation.ts']` + test override `no-console: 'off'`
  - 과거 결정 출처: `plan/in-progress/refactor/03-maintainability.md §m-1` "scripts/·instrumentation.ts 예외"
  - 상세: plan §m-1 이 명시한 예외 범위(CLI 독립 스크립트, NestJS 부트스트랩 이전 OTel, 테스트)와 일치한다. 기각된 대안 없음.
  - 제안: 없음 — 정합.

- **[INFO]** code.handler inline disable — module-load 경로 정당 면제
  - target 위치: `codebase/backend/src/nodes/data/code/code.handler.ts` 3곳 `// eslint-disable-next-line no-console -- pre-bootstrap env 설정 검증`
  - 과거 결정 출처: `plan/in-progress/refactor/03-maintainability.md §m-1` "code.handler 등 module-load 경로는 inline `// eslint-disable-next-line no-console`"
  - 상세: plan §m-1 이 inline disable 을 명시 허용한 경로를 정확히 적용한다. 위반 아님.
  - 제안: 없음 — 정합.

- **[INFO]** audit-logs.service.ts 미전환 — stale 제거 처리, planner 위임 등록
  - target 위치: diff 에 `audit-logs.service.ts` 부재
  - 과거 결정 출처: `spec/data-flow/1-audit.md:23` "(`audit-logs.service.ts` 의 `console.warn`)" — 구현 사실로 기술; `plan/in-progress/refactor/03-maintainability.md §m-1` 목록에 `modules/audit-logs/audit-logs.service.ts:85` 포함
  - 상세: 구현 scope 설명("audit-logs stale 제거·planner spec-sync(...audit console.warn 처방 정정) 위임 등록")이 이를 명시적으로 처리했음을 나타낸다. `spec/data-flow/1-audit.md:23` 은 `console.warn` 을 현행 구현 사실로 서술한 문서이며, 이 표현을 Logger.warn 으로 정정하는 것은 planner 에 위임 등록된 spec-sync 작업이다.
  - 제안: planner spec-sync 위임이 이행될 때 `/Volumes/project/private/clemvion/spec/data-flow/1-audit.md:23` 의 `console.warn` 표현을 `Logger.warn` 으로 정정해야 한다. 현재 별도 plan 아이템으로 등록됨.

- **[INFO]** `spec/4-nodes/3-ai/1-ai-agent.md §6.2.c.fallback` console.warn 원문 잔류
  - target 위치: diff 에 ai-agent 핸들러 내 해당 console.warn 미전환
  - 과거 결정 출처: `/Volumes/project/private/clemvion/spec/4-nodes/3-ai/1-ai-agent.md:406` `console.warn('[processMultiTurnMessage] form submission without pendingFormToolCall — ...')` 명문; `plan/in-progress/refactor/03-maintainability.md §m-1:307` "ai-agent spec §6.2.c.fallback 의 'console.warn' spec 원문은 planner 정정 위임"
  - 상세: ai-agent spec 이 코드 구체적 표현(`console.warn(...)`)으로 진단 surface 를 명시하고 있으나, 본 구현은 해당 파일을 touch 하지 않는다. plan §m-1 이 이를 별건 planner 위임으로 분리했다. spec 원문의 `console.warn` 표현은 기각된 대안이 아니라 "spec 이 아직 정정되지 않은 구현 표현"이므로 CRITICAL 기각됨.
  - 제안: planner 가 `/Volumes/project/private/clemvion/spec/4-nodes/3-ai/1-ai-agent.md §6.2.c.fallback` 의 `console.warn(...)` 을 `logger.warn(...)` 동등 표현으로 정정해야 한다. 현재 위임 등록됨.

---

## 요약

refactor 03 m-1 구현은 `spec/5-system/3-error-handling.md §6.2` 구조화 Logger 원칙과 `spec/conventions/chat-channel-adapter.md:84` 의 `logger.warn` 명문에 정합한다. `plan/in-progress/refactor/03-maintainability.md §m-1` 의 Option A (Logger 교체 5곳 + eslint no-console 가드)를 그대로 이행했으며, 기각된 대안(B: lint 룰 없이 교체만)의 재도입이 없다. 면제 범위(scripts/instrumentation/test/code.handler inline)도 plan §m-1 이 명시한 경계 그대로다. audit-logs.service.ts 미전환과 ai-agent spec §6.2.c.fallback `console.warn` 원문 잔류는 모두 plan 이 명시적으로 planner spec-sync 위임으로 분리한 공개 후속 항목이며 Rationale 연속성 위반이 아니다. 기각된 결정의 재도입, 합의 원칙 위반, 무근거 번복은 발견되지 않았다.

---

## 위험도

NONE
