## 발견사항

- **[INFO]** `16-system-status-api.md` 구현 갭 callout 과 실제 코드 부분 해소 불일치
  - target 위치: `/Users/gehrig/.claude/jobs/323b33ee/tmp/cq_scope/16-system-status-api.md` §1 테이블 하단 구현 갭 callout — "코드의 `MONITORED_QUEUES` 에는 `makeshop-token-refresh` 와 `agent-memory-extraction` 이 아직 미등재"
  - 관련 plan: `plan/in-progress/spec-code-cross-audit-2026-06-10.md` — V-15 (큐 레지스트리) 항목을 `[x]` 해소로 표시
  - 상세: `spec-code-cross-audit-2026-06-10.md` 는 V-15 가 `integration-expiry-fixes` 브랜치에서 해소됐다고 표시한다. 실제로 현재 `system-status.constants.ts` 코드를 확인하면 `MAKESHOP_REFRESH_QUEUE` 는 이미 `MONITORED_QUEUES` 에 등재돼 있다 (line 70). 그러나 `agent-memory-extraction` 큐는 여전히 미등재 상태다. 한편 spec 갭 callout 은 두 큐 모두 미등재인 것처럼 표현하고 있어 실제 코드 상태와 일치하지 않는다. 또한 현재 worktree 가 `TERMINAL_REVOKE_RECONCILE_QUEUE` 를 `MONITORED_QUEUES` 에 추가한 상태이나 spec 의 §1 테이블에는 이 큐가 목록에 없다 (EIA 구현 이후 새로 추가된 큐). 이 정보들이 반영되지 않은 채 갭 callout 이 stale 상태로 남아 있다.
  - 제안: spec `16-system-status-api.md` §1 갭 callout 을 현재 코드 상태에 맞춰 갱신 권장 — (a) `makeshop-token-refresh` 는 이미 등재됐으므로 callout 에서 제거, (b) `agent-memory-extraction` 은 여전히 미등재이므로 유지, (c) `terminal-revoke-reconcile` 큐가 신규 추가됐으므로 §1 테이블과 갭 callout 에 반영. spec 변경은 project-planner 영역이므로 본 worktree 에서 직접 수정하지 않고 플래그로 남긴다.

- **[INFO]** `14-external-interaction-api.md` `pending_plans:` 의 `fix-webchat-sse-field-map.md` plan complete 이동 보류 중
  - target 위치: `/Users/gehrig/.claude/jobs/323b33ee/tmp/cq_scope/14-external-interaction-api.md` frontmatter `pending_plans:` — `plan/in-progress/fix-webchat-sse-field-map.md` 참조
  - 관련 plan: `plan/in-progress/fix-webchat-sse-field-map.md` — 체크리스트 마지막 항목 `[ ] plan complete 이동` 이 미완료로 남아 있음
  - 상세: `fix-webchat-sse-field-map.md` 의 구현 본체는 전부 완료(`[x]`)이고 "비차단 followup 잔여로 in-progress 유지" 라는 사유로 plan complete 이동이 보류 중이다. EIA spec frontmatter 의 `pending_plans:` 가 이 plan 을 참조하고 있어, plan 이 완전히 닫히지 않은 상태임이 보존 중이다. 이는 의도된 유보(비차단 followup 명시)이므로 충돌이 아니라 추적 메모 수준이다.
  - 제안: `fix-webchat-sse-field-map.md` 의 비차단 followup 처리 후 plan 을 complete 로 이동하면 EIA spec `pending_plans:` 에서 제거 가능. 현재 상태로 충돌은 없음.

## 요약

현재 worktree 의 변경 내용(EIA 코드 품질 — 상수 파일 분리, Swagger 데코레이터 교체, ephemeral secret 개선, 테스트 보강)은 모두 `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 및 `fix-webchat-sse-field-map.md` 의 미해결 결정과 충돌하지 않는다. spec 에서 "결정 필요"로 남겨둔 항목(backoff 배율, 분산 fan-out, rate-limit, currentNode/context 실값)에 대해 어떤 결정도 일방적으로 내리지 않았다. `system-status.constants.ts` 의 import 경로 변경은 내부 상수 분리 리팩토링이며 `MONITORED_QUEUES` 내용에 영향을 주지 않는다. 다만 spec `16-system-status-api.md` 의 구현 갭 callout 이 실제 코드 상태(makeshop 이미 등재, terminal-revoke 신규 추가, agent-memory 미등재)와 부분적으로 stale 한 점과, `fix-webchat-sse-field-map.md` 의 plan complete 이동이 보류 중인 점을 INFO 로 기록한다. 두 항목 모두 plan 정합성을 즉각 위협하는 수준은 아니다.

## 위험도

LOW
