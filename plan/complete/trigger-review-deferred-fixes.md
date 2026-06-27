---
worktree: trigger-review-w1-w7
started: 2026-06-10
owner: developer
---

# ai-review 이월 fix 4건 (2026-06-10 trigger-schedule-sync 리뷰 도출, 사용자 결정: 전부 plan 이관)

출처: [`review/code/2026/06/10/17_09_35/SUMMARY.md`](../../review/code/2026/06/10/17_09_35/SUMMARY.md). 모두 본 PR(trigger-schedule 동기화) 범위 밖 기존 코드 이슈 — 행동 변경이 민감하거나 마이그레이션이 필요해 독립 리뷰 대상.

- [x] **C3 (보안)** — ✅ 해소 (`promoteRotatedNotificationSecrets` 가 `signing.secretRef` 만 잔류시키고 평문 제거: `triggers.service.ts:446-471`): ~~`promoteRotatedNotificationSecrets` 가 v2 평문을 `config.notification.signing.secret` 에 승격하면서 기존 `signing.secretRef` 를 제거하지 않음~~ — `resolveSigningSecret` 은 secretRef 우선이라 승격 후에도 구 secret 으로 서명 지속 (rotation 무효). 승격 시 secretRef 제거 또는 우선순위 역전 중 결정 필요.
- [x] **W1 (보안)** — ✅ 2026-06-27: create/update DTO 의 `endpointPath` 를 `@IsUUID('4')` 로 서버 강제(frontend 는 이미 v4 발급). spec 동기(10-triggers §Rationale·12-webhook WH-MG-02/WH-SC-01 CSPRNG 명문화), e2e 생성기 UUID 정합, DTO 단위테스트 6건. ai-review MEDIUM(의도된 breaking) resolved.
- [x] **W4 (DB)** — ✅ 해소 via supersession: `llm_config` 가 `model_config` 로 통합(PR #541)되며 `V089__model_config_kind_default_unique.sql` 가 실 SQL partial unique(`WHERE is_default = true`)를 생성 — DB 레벨 경합 차단. (구 `llm_config_workspace_default_unique` entity `@Index` 는 소멸)
- [x] **W7 (데이터 위생)** — ✅ 2026-06-27: `WorkspaceInvitationsPrunerService` 신설(login-history-pruner 패턴, 매일 04:00 KST BullMQ repeatable) + 모듈 등록 + `MONITORED_QUEUES`·`0-overview §4` 큐 카탈로그·`12-workspace §1.2/§3.1/§4` 동기 + 단위테스트 6건.

> **본 plan 4항목 전부 완료** (C3·W1·W4·W7) → `plan/complete/` 이동 대상.
