# Plan 정합성 검토 결과

검토 모드: `--impl-done` (refactor 03 m-1 — backend 서비스 console.* → NestJS Logger 전환 + eslint no-console 가드)
검토 일시: 2026-06-26

---

## 발견사항

### [WARNING] planner 위임 spec 정정이 별도 추적 plan 에 등록되지 않음
- **target 위치**: 워크트리 로컬 `plan/in-progress/refactor/03-maintainability.md` §m-1 세 번째 항목 (`[ ] (planner 위임) spec 텍스트 stale console.warn 처방 정정`)
- **관련 plan**: `plan/in-progress/refactor/03-maintainability.md` §m-1 개선 방안 3번 "(별건) ai-agent spec §6.2.c.fallback 의 'console.warn' spec 원문은 planner 정정 위임"
- **상세**: 구현은 4개 spec 파일(`1-ai-agent.md §6.2.c.fallback`, `6-presentation/0-common.md`, `5-system/14-external-interaction-api.md`, `data-flow/1-audit.md`)의 `console.warn(...)` 처방이 이제 stale 임을 확인하고 planner 위임을 명시했다. 그러나 이 위임 항목은 `refactor/03-maintainability.md` §m-1 의 하위 체크박스로만 존재하고, 기존의 spec-sync 추적 plan(`spec-sync-structural-followups.md`, `spec-sync-external-interaction-api-gaps.md` 등) 어디에도 독립 항목으로 등록되지 않았다. 코드가 이미 Logger 로 전환된 상태에서 spec 원문만 stale 인 4건의 처방 정정이 플로팅 상태로 남는다.
- **제안**: PR 머지 후 planner 가 위임 4건을 적절한 spec-sync plan 또는 `spec-sync-structural-followups.md` 에 독립 항목으로 등재해야 한다. 현재 03-maintainability.md 의 하위 항목은 developer 완료 기준으로 m-1 을 닫으면 가시성을 잃을 위험이 있다.

### [INFO] audit-logs.service.ts 목록 항목 stale — 정상 처리됨
- **target 위치**: 워크트리 로컬 `plan/in-progress/refactor/03-maintainability.md` §m-1 완료 기록 (`~~audit-logs.service.ts:85~~ 는 이미 이전에 Logger 전환됨`)
- **관련 plan**: 동 문서 원안 `- [ ] 미착수` 에 `audit-logs.service.ts:85` 포함
- **상세**: 원안이 열거한 5개 대상 중 `audit-logs.service.ts:85` 는 이미 이전 커밋에서 Logger 전환이 완료되어 있었다. 구현 과정에서 stale 목록 항목으로 확인하고 완료 기록에 명시 제거했다. 별도 작업 불요.
- **제안**: INFO 수준 — 조치 불요. 목록 정정이 완료 기록에 이미 반영됨.

### [INFO] e2e 미실행 (Docker 레지스트리 아웃티지) — 계획 기록됨
- **target 위치**: 워크트리 로컬 `plan/in-progress/refactor/03-maintainability.md` §m-1 두 번째 항목 (`[ ] e2e 재실행 (레지스트리 회복 후)`)
- **관련 plan**: 동 문서 §m-1 검증 항목
- **상세**: Docker 레지스트리 아웃티지(`flyway/flyway:10-alpine` FROM resolve DeadlineExceeded)로 e2e 가 미실행 상태다. 변경은 로그 채널 교체(behavior-adjacent) + backend unit 7398 전건 PASS 이므로 e2e 회귀 위험은 낮고, 계획 항목으로 명시 추적 중이다.
- **제안**: INFO 수준 — 레지스트리 회복 후 e2e 를 실행하고 결과를 기록하면 닫힌다. 현재 plan 에 이미 `[ ]` 로 추적됨.

---

## 요약

m-1 구현(console.* → NestJS Logger + eslint no-console 가드)은 `plan/in-progress/refactor/03-maintainability.md` §m-1 이 정의한 범위(5곳 교체, scripts/instrumentation 예외, lint 룰 추가)를 충실히 이행했으며, 다른 진행 중 plan 과의 결정 충돌이나 미해결 선행 조건 위반은 없다. 유일한 주의 사항은 구현이 확인한 4개 spec 파일의 `console.warn` 처방 stale 이 planner 위임 항목으로 명시됐으나 spec-sync 추적 plan 에 독립 등재가 누락된 점이다 — developer 완료 후 해당 항목의 가시성이 떨어질 수 있어 WARNING 으로 분류한다. audit-logs stale 제거와 e2e 미실행은 각각 정상 처리된 내역과 환경 제약으로 INFO 수준이다.

## 위험도

LOW
