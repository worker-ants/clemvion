# Plan 정합성 검토 결과

검토 모드: 구현 완료 후 검토 (--impl-done, scope=spec/5-system/, diff-base=origin/main)
대상 worktree: `security-fixes-0f9165` (branch `claude/security-fixes-0f9165`)
변경 파일: `spec/5-system/1-auth.md`, `spec/1-data-model.md`, `spec/data-flow/1-audit.md`, `spec/data-flow/15-external-interaction.md`

---

## 발견사항

### [CRITICAL] spec/5-system/1-auth.md 및 spec/1-data-model.md 동시 편집 — unified-model-mgmt-5af7ee 와 경합

- **target 위치**: `spec/5-system/1-auth.md` §3.2 권한 매트릭스·§4.1 감사 로그 액션 / `spec/1-data-model.md` §2.1 User 표·§2.11 KnowledgeBase 표
- **관련 plan**: `plan/in-progress/unified-model-management.md` (worktree `unified-model-mgmt-5af7ee`)
- **상세**:
  - `security-fixes-0f9165` 가 `spec/5-system/1-auth.md` 에서 Rate Limit 행 확정 + §1.5.D Rationale 추가를 커밋함.
  - `unified-model-mgmt-5af7ee` 는 동일 파일(`spec/5-system/1-auth.md`)을 **동시에 편집 중** — §3.2 권한 매트릭스의 `LLM Config / Rerank Config` 행을 `Model Config` 로 통합하고, §4.1 감사 로그 액션을 `model_config.*` 로 교체하는 변경을 포함한다.
  - `spec/1-data-model.md` 도 양쪽 모두 변경 중: security-fixes 는 §2.1 User 표에 9개 필드를 추가했고, unified-model-mgmt 는 §2.11 KnowledgeBase 표의 `embedding_llm_config_id` 제거·`embedding_model_config_id` 신설·`extraction_llm_config_id` FK 재정의 등을 변경 중이다.
  - 두 worktree 가 서로 다른 섹션을 손대므로 텍스트 충돌은 없을 수 있으나, **병렬 PR merge 시 어느 쪽이 먼저 merge 되느냐에 따라 상대방이 이미 변경된 컨텍스트 위에 옛 형태를 덮어쓸 위험**이 있다. 특히 `1-auth.md §3.2` 에서 security-fixes 가 삽입한 `Rate Limit` 행 context 영역과 unified-model-mgmt 가 삭제·교체한 `LLM Config`/`Rerank Config` 행은 같은 표 내 인접 행이다.
  - `unified-model-mgmt-5af7ee` 의 stale 판정: Step 1(git ancestor) ACTIVE, Step 2(GitHub PR) — PR 없음(empty), Step 3 fallback → **active 로 처리**.
- **제안**: 두 worktree 의 merge 순서를 직렬화하거나, 먼저 merge 될 쪽이 나머지 파일의 최신 상태를 rebase 후 충돌 점검. `security-fixes-0f9165` 가 이미 /ai-review + resolution 단계에 있고 unified-model-mgmt 는 planner 단계이므로, security-fixes 를 먼저 merge 하고 unified-model-mgmt 가 rebase 하는 순서가 자연스럽다.

---

### [WARNING] security-fixes-audit-guard-secret-rotation.md — 체크리스트 미완 항목 추적 필요

- **target 위치**: `plan/in-progress/security-fixes-audit-guard-secret-rotation.md` 체크리스트 §마지막 2행
- **관련 plan**: 동일 파일 (`/ai-review + resolution`, `/consistency-check --impl-done` 미완료)
- **상세**: plan 내 체크리스트에 `/ai-review + resolution` 과 `/consistency-check --impl-done spec/5-system/` 두 항목이 `[ ]` 미완 상태다. 본 일관성 검토(`--impl-done`)가 실행 중이므로 후자는 현재 진행 중이지만, `/ai-review` 는 별도로 완료되어야 한다.
- **제안**: `/ai-review` 완료 후 plan 체크박스를 `[x]` 로 갱신하고 `plan/complete/` 로 이동할 것.

---

### [WARNING] spec-sync-auth-gaps.md (worktree: spec-sync-audit) — LDAP/SAML 추적 plan 이 spec/5-system/1-auth.md 와 중복 등록됨

- **target 위치**: `spec/5-system/1-auth.md` frontmatter `pending_plans: [plan/in-progress/auth-config-webhook-followups.md, plan/in-progress/spec-sync-auth-gaps.md]`
- **관련 plan**: `plan/in-progress/spec-sync-auth-gaps.md` (worktree 필드 `spec-sync-audit` — 해당 이름의 local branch/worktree 없음)
- **상세**: `spec-sync-auth-gaps.md` 는 worktree 필드에 `spec-sync-audit` 를 기재하고 있으나 실제로 해당 이름의 worktree 는 존재하지 않는다. `spec-sync-audit-998544` 는 MERGED(PR #516, squash merge)로 stale 처리. `spec-sync-audit` 라는 이름의 branch 도 없다. 이 plan 은 LDAP/SAML 미구현 2항목만 추적하며 worktree 없이 backlog 상태인 것으로 보인다.
- **제안**: `spec-sync-auth-gaps.md` 의 `worktree:` 필드를 `(unstarted)` 로 수정하거나, 이미 완료된 `spec-sync-audit` 감사와 연관된 항목들을 재점검해 실제 남은 미구현 항목만 유지할 것.

---

### [WARNING] auth-config-webhook-followups.md — spec/5-system/1-auth.md §5 POST /auth-configs/:id/reveal 행 추가 미반영

- **target 위치**: `spec/5-system/1-auth.md §5 API 엔드포인트` 표
- **관련 plan**: `plan/in-progress/auth-config-webhook-followups.md` §3 spec 보완 항목 1번
- **상세**: `auth-config-webhook-followups.md §3` 에 "§5 API 엔드포인트 표에 `POST /api/auth-configs/:id/reveal` 행 추가" 가 project-planner 에게 위임된 미완 항목으로 남아 있다. security-fixes-0f9165 는 `spec/5-system/1-auth.md` 를 이미 편집하고 있으므로, 해당 항목을 이번 commit 에 포함시킬 수 있었으나 포함되지 않았다. target 변경이 이 후속 항목을 무효화하지는 않지만, 같은 파일을 편집하는 김에 일괄 반영할 수 있는 기회를 놓쳤다.
- **제안**: `auth-config-webhook-followups.md §3` 의 해당 항목을 별도 project-planner 작업으로 진행하거나, 현재 worktree 가 merge 되기 전에 포함시킬지 결정.

---

### [INFO] security-backlog-invitation-token-hash.md — 미해결 결정(초대 토큰 해시 전환 여부) 신규 생성 확인

- **target 위치**: `plan/in-progress/security-backlog-invitation-token-hash.md` (신규 생성)
- **관련 plan**: `plan/in-progress/security-fixes-audit-guard-secret-rotation.md` → ai-review W-1 에서 분리
- **상세**: security-fixes 가 `spec/5-system/1-auth.md §1.5.D` Rationale 에서 초대 토큰 raw 저장 유지 결정을 명시하고, 별도 backlog plan `security-backlog-invitation-token-hash.md` 를 생성해 해시 전환 검토를 후속으로 분리했다. 이는 미해결 결정을 일방적으로 확정하지 않고 "현 상태 유지 + 백로그 기록" 패턴으로 올바르게 처리된 사례다. 충돌 없음.
- **제안**: 추가 조치 불요. 이 backlog 항목은 사용자와의 합의 후 착수하는 것이 맞다.

---

## Stale 으로 skip 한 worktree (의무 — 0건이어도 명시)

worktree 충돌 후보 중 stale 판정으로 skip 된 항목:

- `spec-sync-audit-998544` (branch `claude/spec-sync-audit-998544`) — Step 1: ACTIVE (ancestor 아님, squash merge), Step 2: PR #516 MERGED → **stale**. `spec/5-system/1-auth.md`, `spec/1-data-model.md` 등 다수 spec 파일을 포함했으나 이미 merge 완료.
- `trigger-schedule-sync-f88604` (branch `claude/trigger-schedule-sync-f88604`) — Step 1: ACTIVE, Step 2: PR #519 MERGED → **stale**. `spec/1-data-model.md` 를 포함했으나 이미 merge 완료.

두 worktree 가 활성으로 남아 있을 이유가 없다. `./cleanup-worktree-all.sh --yes --force` 실행 권장.

---

## 요약

`security-fixes-0f9165` 의 `spec/5-system/` 변경은 대부분 기존 plan 계약을 올바르게 이행하고 있다. 미해결 결정(`invitation_already_accepted` 에러코드, register body email 명시 등)은 일방 결정 없이 백로그로 분리 처리됐다. 주요 위험은 **active worktree `unified-model-mgmt-5af7ee` 와의 `spec/5-system/1-auth.md`·`spec/1-data-model.md` 동시 편집 경합** — 두 worktree 가 같은 파일의 인접 섹션을 손대고 있어 merge 순서 직렬화가 필요하다. worktree 충돌 후보 4건 중 stale 2건 skip, active 2건(`security-fixes-0f9165`·`unified-model-mgmt-5af7ee`) 분석.

## 위험도

**MEDIUM**

(CRITICAL은 active worktree 경합이지만, 두 worktree 가 동일 파일 내 서로 다른 섹션을 편집하므로 텍스트 충돌 가능성은 낮고 merge 순서 조율로 해소 가능함. 그러나 조율 없이 양쪽이 동시 PR을 열면 한 쪽이 상대방 변경을 덮어쓸 실질적 위험이 있어 MEDIUM으로 판정.)
