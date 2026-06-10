---
worktree: (unstarted)
started: 2026-06-10
owner: developer
---

# ai-review 이월 fix 4건 (2026-06-10 trigger-schedule-sync 리뷰 도출, 사용자 결정: 전부 plan 이관)

출처: [`review/code/2026/06/10/17_09_35/SUMMARY.md`](../../review/code/2026/06/10/17_09_35/SUMMARY.md). 모두 본 PR(trigger-schedule 동기화) 범위 밖 기존 코드 이슈 — 행동 변경이 민감하거나 마이그레이션이 필요해 독립 리뷰 대상.

- [ ] **C3 (보안)**: `promoteRotatedNotificationSecrets` 가 v2 평문을 `config.notification.signing.secret` 에 승격하면서 기존 `signing.secretRef` 를 제거하지 않음 — `resolveSigningSecret` 은 secretRef 우선이라 승격 후에도 구 secret 으로 서명 지속 (rotation 무효). 승격 시 secretRef 제거 또는 우선순위 역전 중 결정 필요.
- [ ] **W1 (보안)**: trigger `endpoint_path` 가 클라이언트 생성(`crypto.randomUUID()`) + 서버 UUID 형식 미강제 — 예측 가능 값 직접 지정 가능. 서버 강제 발급 또는 DTO `@IsUUID(4)` 검증. (data-flow/10-triggers.md §Rationale 에 현황 기술됨)
- [ ] **W4 (DB)**: `llm_config_workspace_default_unique` partial UNIQUE index 가 entity `@Index` 선언만 있고 SQL 마이그레이션 미생성 (rerank_config 의 V081 패턴과 비대칭) — 동시 요청 경합 시 중복 default 허용. 마이그레이션 추가.
- [ ] **W7 (데이터 위생)**: `WorkspaceInvitationsService.pruneExpired` 프로덕션 호출자 없음 — 만료 초대 row 영구 잔존. `login-history-pruner` 패턴 BullMQ 연결 또는 기회적 purge.
