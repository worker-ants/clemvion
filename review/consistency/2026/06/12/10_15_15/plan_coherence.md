## 발견사항

- **[INFO]** `auth-config-webhook-followups.md §3` — `POST /api/auth-configs/:id/reveal` 행 §5 미등재 상태 유지
  - target 위치: `spec/5-system/1-auth.md §5 API 엔드포인트` 표 (변경 없음)
  - 관련 plan: `plan/in-progress/auth-config-webhook-followups.md §3` (spec 보완 항목 — "§5 API 엔드포인트 표에 `POST /api/auth-configs/:id/reveal` 행 추가")
  - 상세: target 이 §4.1 감사 액션·prose 보강에 집중하는 가운데, §3 미완 항목(reveal 엔드포인트 §5 등재)은 target 변경 범위에 포함되지 않아 여전히 미해소. target 이 이 항목과 직접 충돌하지는 않으나 같은 spec 파일(`1-auth.md`)을 편집하는 동안 §3 잔여 TODO 를 함께 처리할 기회를 놓칠 수 있다.
  - 제안: target 을 머지한 뒤, `auth-config-webhook-followups.md §3` 를 별도로 처리하거나 동일 PR 에서 §5 표에 reveal 행을 추가한다.

- **[INFO]** `auth-config-webhook-followups.md §1` — §1 완료 반영 후 plan 에 `spec-audit-action-prose` worktree 연결 누락
  - target 위치: `spec/5-system/1-auth.md §4.1` Planned 표 인증 감사 액션 행 (`user.password_changed` 등)
  - 관련 plan: `plan/in-progress/auth-config-webhook-followups.md §1` (§1 체크리스트 완료, 2026-06-11)
  - 상세: §1 은 "Planned→구현됨 이동" 항목에서 `auth_config.create/update/delete/regenerate` 를 구현됨으로 이동시켰다. target 은 별도로 인증 감사 Planned 행의 action 명명 (`password_change` → `user.password_changed` 등) 을 확정한다. 두 변경은 §4.1 의 서로 다른 행을 다루므로 직접 충돌은 없다. 단, spec frontmatter `pending_plans` 에 `auth-config-webhook-followups.md` 가 여전히 등재돼 있으며 §2~4 미착수 잔여가 있어 `partial` 유지가 올바른 상태다.
  - 제안: 충돌 없음 — 진행 가능. target 머지 후 `pending_plans` 에서 `auth-config-webhook-followups.md` 제거 시점은 §2~4 까지 완료된 후여야 한다.

- **[WARNING]** `spec/2-navigation/4-integration.md` — active worktree `pr4b-kb-embedding-retire` 와 동일 파일 편집 경합
  - target 위치: `spec/2-navigation/4-integration.md §14.3` (감사 로그 산문 보강 — integration.updated 추가 + reauthorized 분기 설명)
  - 관련 plan: `plan/in-progress/unified-model-management.md` (PR4b, worktree `pr4b-kb-embedding-retire`)
  - 상세: `pr4b-kb-embedding-retire` 는 `spec/2-navigation/4-integration.md` 를 이미 편집 중이다 (diff 확인: `DB_HOST_BLOCKED`·`HTTP_BLOCKED` 행 제거). target 도 같은 파일의 §14.3 을 수정한다. 두 변경은 같은 파일의 다른 위치를 건드리므로 merge conflict 가능성이 있다. `pr4b-kb-embedding-retire` 는 Step 2 PR 상태 조회에서 결과가 비어 (open PR 없음, MERGED/CLOSED 아님) — Step 3 fallback 으로 active 처리.
  - 제안: `pr4b-kb-embedding-retire` worktree 의 진행 상태를 확인한다. PR 이 아직 열려있지 않고 local 커밋만 있다면 두 작업의 병렬 진행 전 `spec/2-navigation/4-integration.md` 변경 영역이 겹치는지 확인해 충돌을 선제 조율한다. 겹치지 않는 위치임이 확인되면 진행 가능.

## Stale 으로 skip 한 worktree (의무 — 0건이어도 명시)

`spec/2-navigation/4-integration.md` 와 동시에 편집하는 worktree 후보 4건 중 3건 stale 판정으로 skip, 1건 active 처리:

- `audit-sot-hygiene-8fc5f1` (branch `claude/audit-sot-hygiene-8fc5f1`) — Step 2 PR #? state MERGED
- `errcode-wiring-92dc2c` (branch `claude/errcode-wiring-92dc2c`) — Step 2 PR state MERGED
- `spec-errcode-catalog-a09758` (branch `claude/spec-errcode-catalog-a09758`) — Step 2 PR state MERGED

이 3개 worktree 는 해당 branch 의 PR 이 이미 MERGED 상태(squash merge) 이므로 실질적으로 stale. `./cleanup-worktree-all.sh --yes --force` 실행으로 정리 권장.

- `pr4b-kb-embedding-retire` (branch `claude/pr4b-kb-embedding-retire`) — Step 1 not ancestor / Step 2 결과 empty (PR 없음) → Step 3 fallback, active 로 처리. "stale 판정 cascade Step 1/2 모두 음성. active 로 처리 — 실제 stale 이면 cleanup-worktree-all.sh 실행 후 재검토 권장."

## 요약

target (`spec/5-system/1-auth.md`) 의 변경 내용(§4.1 Planned 인증 감사 액션 dot-prefix 확정 + 닫힌 enum 경고 prose 추가 + Rationale 4.1.A 신설)은 `plan/in-progress/auth-config-webhook-followups.md` 및 `spec-sync-auth-gaps.md` 의 미해결 결정과 직접 충돌하지 않는다. `auth-config-webhook-followups.md §1` 에서 이미 완료된 구현(Planned→구현됨 이동)과도 같은 §4.1 의 별개 행을 다뤄 정합하다. 주요 주의 사항은 `spec/2-navigation/4-integration.md` 를 target 과 `pr4b-kb-embedding-retire` 두 worktree 가 동시에 편집 중이라는 점이며, 변경 위치가 다르지만 merge conflict 가능성이 있어 WARNING 으로 분류했다. worktree 충돌 후보 4건 중 stale 3건 skip, active 1건(`pr4b-kb-embedding-retire`) 분석.

## 위험도

LOW
