---
worktree: refactor-04-spec-audit-conventions-a3f58f (branch claude/refactor-04-spec-audit-conventions-a3f58f)
started: 2026-06-14
owner: project-planner
status: complete
spec_impact:
  - spec/conventions/audit-actions.md
  - spec/5-system/1-auth.md
  - spec/1-data-model.md
  - spec/2-navigation/13-user-guide.md
  - spec/data-flow/1-audit.md
---

# refactor 04 후속 — 감사 액션 명명 규약 통합 (A-2) + spec 정합 보정 (B-1) + user-guide IA (W2)

출처: refactor 04 후속 트랙. PR #578 `/consistency-check --impl-done`(23_09_52) deferred + PR #579 `/ai-review`(23_39_46) W2 SPEC-DRIFT. 사용자 결정(2026-06-14): **A-2 = conventions/audit-actions.md 신설** (§4.1 예외 추가 대안 기각).

## 작업 (전부 spec/plan 문서 — planner)

- [x] **A-2** `spec/conventions/audit-actions.md` 신설 — 전 도메인 감사 액션 명명·시제 3분류(과거분사 기본 / CRUD 현재형 예외 / 도메인 고유 동사) SoT. `workspace.transfer_ownership` 을 §2.3 도메인 고유 동사로 분류해 미분류 갭 해소. `## Rationale` 포함.
  - [x] `1-auth.md §4.1` 의 inline 명명 규약 문단 → conventions/audit-actions.md 참조로 슬림화 (§4.1 은 액션 카탈로그·workspace 귀속·읽기측 계약만 소유).
  - [x] `1-auth.md §Rationale 4.1.A` 에 transfer_ownership 분류 근거 + SoT 링크 추가.
  - [x] `data-flow/1-audit.md §1.1` 역참조 링크 추가.
  - [x] `model_config` 감사 액션 토큰 `set-default` → `set_default` 정규화 (언더스코어 구분자 규약, 미구현이라 코드 의존 없음). API 라우트 `/api/model-configs/:id/set-default` 는 REST kebab 관례라 불변.
- [x] **B-1** `1-data-model.md §2.18 AuditLog`: `ip_address` `String` → `String?` (엔티티 `nullable:true` 정합). action 예시 `workflow.create`/`trigger.update`(현재형 오기) → 실제 구현 액션으로 교체.
- [x] **B-1** `1-auth.md §Rationale 4.1.B` 보강: ① WebAuthn 추가 credential 등록도 `user.2fa_enabled`(`details.firstCredential=false`) ② OAuth-only 사용자 마지막 2FA 비활성화 대안 인증 경로는 별개 결정 사안(현재 차단 로직 없음).
- [x] **W2** (PR #579 ai-review SPEC-DRIFT) `2-navigation/13-user-guide.md §2` IA 트리 `07-workspace-and-team/` 블록 — 누락된 `security-2fa`·`system-status` + 신규 `password-and-sessions` 전부 등재 (실제 페이지 order 1~4 정합).

## 사전 일관성
- [x] `/consistency-check --spec`(00_02_42, **BLOCK: NO**) — Critical 0. Warning 3(W-1 ## Rationale 부재·§2 혼용규칙 모순 / W-2 set-default 하이픈 / W-3 plan 메모) + INFO 8. W-1·W-2 본 PR 에서 fix, INFO I-1~I-4 반영. W-3 은 본 plan 파일로 닫음(master plan 은 PR #579 가 동시 편집 중이라 충돌 회피).

## 연계
- master: `refactor-04-followup-pwchange-userip.md` (PR #578·#579). 본 PR 이 그 "남은 planner 트랙"(A-2·B-1·W2)을 해소. master plan 의 해당 항목은 #579/본 PR 머지 후 reconcile.
- 후속 별도: **A-1** execution-engine typed-error 체계 — 사용자 결정 "planner 설계 초안 먼저" → `execution-engine-typed-errors.md` 에 옵션 분석 append 예정.
