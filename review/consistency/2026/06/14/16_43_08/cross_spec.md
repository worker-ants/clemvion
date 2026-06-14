# Cross-Spec 일관성 검토 결과

검토 대상: `spec/5-system/14-external-interaction-api.md` (EIA spec)
구현 변경 범위: `interaction-token.service.ts` reconcileTerminalRevocations 추가 + `terminal-revoke-reconciler.service.ts` 신설 + `external-interaction.module.ts` 등록 (diff base: fc5d832b)

---

## 발견사항

### 1. INFO — `ExecutionToken` 엔티티가 `spec/1-data-model.md` 에 미등재

- **target 위치**: `spec/5-system/14-external-interaction-api.md §7.3` — `execution_token` 테이블 스키마 (`jti` PK · `execution_id` FK → `execution` ON DELETE CASCADE · `issued_at` · `exp_at` · `idx_execution_token_execution_id`) 정의
- **충돌 대상**: `/Volumes/project/private/clemvion/spec/1-data-model.md` — §2.x 엔티티 목록 (§2.1 User ~ §2.23 AgentMemory). `ExecutionToken` 엔티티 행 없음
- **상세**: `execution_token` 테이블은 EIA spec §7.3 과 `spec/data-flow/15-external-interaction.md §2.2` 에서 상세 스키마와 인덱스까지 정의되어 있으나 전체 엔티티 카탈로그인 `spec/1-data-model.md` 에는 §2.x 섹션이 없다. 데이터 모델 spec 이 execution_token 을 누락하면 DB 마이그레이션 리뷰·ERD·다른 팀원의 탐색에서 invisible 해진다 (직접 기능 충돌은 아님).
- **제안**: `spec/1-data-model.md` 에 `### 2.24 ExecutionToken` (또는 다음 빈 번호) 섹션을 추가해 EIA §7.3 의 스키마를 간략 요약하고 EIA §7.3 cross-link 제공. 상세 정의는 EIA SoT 유지.

---

### 2. INFO — `spec/0-overview.md §2.6 Redis` BullMQ 큐 목록에 `terminal-revoke-reconcile` 미등재

- **target 위치**: `terminal-revoke-reconciler.service.ts` — `TERMINAL_REVOKE_RECONCILE_QUEUE = 'terminal-revoke-reconcile'`, 분 단위 BullMQ repeatable scheduler
- **충돌 대상**: `/Volumes/project/private/clemvion/spec/0-overview.md §2.6 Data Layer` — Redis 설명: "`execution-run` intake / `execution-continuation` / `background-execution`" 큐만 열거
- **상세**: 아키텍처 개요의 Redis 큐 목록이 `notification-webhook` (pre-existing)과 함께 `terminal-revoke-reconcile` 도 열거하지 않는다. 직접 모순이 아니라 목록이 불완전한 수준이나, 신규 개발자가 Redis 큐 전체상을 파악할 때 두 큐가 보이지 않는다. `login-history-pruner` 도 같은 이유로 미열거.
- **제안**: `spec/0-overview.md §2.6` Redis 항목에 `notification-webhook` · `terminal-revoke-reconcile` · `login-history-pruner` 를 추가 언급하거나, 또는 "그 외 도메인별 스케줄러 큐 포함" 문구를 추가해 enumeration 이 전체가 아님을 명시.

---

### 3. INFO — `spec/data-flow/15-external-interaction.md` 코드 진입점 목록에 `terminal-revoke-reconciler.service.ts` 미등재

- **target 위치**: `codebase/backend/src/modules/external-interaction/terminal-revoke-reconciler.service.ts` (신설 파일)
- **충돌 대상**: `/Volumes/project/private/clemvion/spec/data-flow/15-external-interaction.md` Overview 코드 진입점 목록 (라인 26~34) — `terminal-revoke-reconciler.service.ts` 가 누락됨. §2.2 BullMQ 테이블에서는 올바르게 등재됨 (라인 249).
- **상세**: data-flow 문서 Overview 의 코드 파일 목록은 `interaction-token.service.ts`, `notification-fanout.service.ts` 등 기존 파일을 열거하나 이번에 신설된 `terminal-revoke-reconciler.service.ts` 가 빠져 있다. §2.2 표에는 정확히 등재되어 있어 실질 정보 누락보다는 Overview 와 §2.2 간 목록 불일치 수준.
- **제안**: `spec/data-flow/15-external-interaction.md` Overview 코드 진입점 목록에 `terminal-revoke-reconciler.service.ts` 한 줄 추가 (sweep scheduler 역할 설명 포함).

---

## 요약

이번 구현 변경(EIA-RL-06 terminal revoke at-least-once sweep — `reconcileTerminalRevocations` 메서드 + `TerminalRevokeReconcilerService` BullMQ repeatable scheduler)은 기존 spec 과 직접 모순되는 충돌이 없다. EIA spec §3.4/§7.3/§9.3/§Rationale R15 가 이미 reconciliation sweep 을 상세히 기술하고 있으며 `spec/data-flow/15-external-interaction.md §2.2` 도 `terminal-revoke-reconcile` 큐와 `TerminalRevokeReconcilerService` 를 정확하게 참조한다. 발견된 세 건은 모두 INFO 등급 — 엔티티 카탈로그(`1-data-model.md`)와 아키텍처 개요(`0-overview.md`)의 목록이 신규 엔티티·큐를 동기화하지 않은 명명 불일치·누락이며, 두 영역 중 하나가 작동 불가가 되는 수준의 모순은 없다.

## 위험도

LOW
