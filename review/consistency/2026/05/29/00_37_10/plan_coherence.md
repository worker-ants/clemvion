---
검토 모드: --impl-prep
scope: spec/2-navigation/6-config.md
검토 일시: 2026-05-29
검토자: plan-coherence-checker
---

# Plan 정합성 검토 결과

## 발견사항

### [INFO] `auth-config-webhook-wiring.md` Phase 0 체크박스 stale — 실제 작업은 이미 완료

- **target 위치**: `spec/2-navigation/6-config.md` 전체 (Part A hmac/basic_auth UI, §A.4 Reveal 흐름, §3 reveal API, Rationale R-2)
- **관련 plan**: `plan/in-progress/auth-config-webhook-wiring.md` Phase 0 체크박스 (라인 18-25) 전부 `[ ]` 미체크 상태
- **상세**: `plan/in-progress/auth-config-webhook-wiring.md` 의 Phase 0 목록 (7개 spec 파일 + consistency-check) 이 모두 미완료 표기이지만, 실제로는 commit `dbc6a4b1` / PR #341 (MERGED) 로 이미 main 에 반영됐다. `spec/2-navigation/6-config.md` 를 포함한 7개 spec 파일 전체가 Phase 0 에서 기술한 내용대로 갱신된 상태다. plan 문서가 현실을 반영하지 못한 stale 상태.
- **제안**: `auth-config-webhook-wiring.md` Phase 0 체크박스를 `[x]` 로 갱신하고, 전체 구현 완료 여부를 확인해 plan 을 `plan/complete/` 로 이동하거나 잔여 Phase 상태를 정확히 반영할 것. 단, 본 `impl-prep` 검토의 차단 사유는 아님 — 현재 target 문서(`6-config.md`) 는 이미 최신 상태.

---

### [INFO] `spec-draft-auth-config-webhook-wiring.md` 계속 in-progress 상태

- **target 위치**: 해당 없음 (target 문서를 직접 변경하는 plan 아님)
- **관련 plan**: `plan/in-progress/spec-draft-auth-config-webhook-wiring.md`
- **상세**: 본 draft plan 은 `spec/2-navigation/6-config.md` §4 의 변경안을 상세 기술하고 있으며, 그 내용이 현재 `6-config.md` 에 이미 반영됐다 (PR #341 MERGED). Draft 역할은 종결됐으나 plan 파일이 `in-progress/` 에 잔존.
- **제안**: `spec-draft-auth-config-webhook-wiring.md` 를 `plan/complete/` 로 `git mv` 권장. 차단 사유 아님.

---

### [INFO] `auth-config-webhook-followups.md` — `6-config.md` frontmatter 격상 항목 미처리 가능성

- **target 위치**: `spec/2-navigation/6-config.md` frontmatter (`status: spec-only`, `code: []`)
- **관련 plan**: `plan/in-progress/auth-config-webhook-followups.md` §3 "spec frontmatter: 본 PR 에서 `12-webhook.md`·`6-config.md` 를 `implemented` 격상 시 본 갭이 `partial` 사유가 될 수 있음"
- **상세**: 현재 `6-config.md` frontmatter 는 `status: spec-only, code: []` 로 유지 중 (`spec-draft-auth-config-webhook-wiring.md §2.9` 에서 "Phase 6 종료 전까지는 `spec-only` 유지" 로 예정). `auth-config-webhook-followups.md` 는 구현 완료 후 frontmatter 격상 + AuthConfig CRUD audit 기록 누락 (`§1`) 을 후속 작업으로 등재. `6-config.md` 를 impl-prep scope 로 삼아 구현을 진행한다면 Phase 6 완료 후 frontmatter 갱신 의무가 발생할 수 있다. 현재 `llm-model-select-followup-refactor` 워크트리의 작업은 `codebase/frontend` LLM config 컴포넌트 리팩토링이며 `6-config.md` 를 직접 수정하지 않으므로 이 항목은 해당 plan 에서 별도 추적 중인 사항이다.
- **제안**: 현재 impl-prep 에서 차단 사유 없음. `auth-config-webhook-followups.md` 가 AuthConfig audit + frontmatter 격상을 추적하고 있음을 인지하고 진행.

---

## Stale 으로 skip 한 worktree (의무 — 0건이어도 명시)

worktree 충돌 후보 분석 결과:

| 대상 | 판정 경로 | 결과 |
|------|-----------|------|
| `chat-channel-form-native-modal-c021b9` | Step 1: `git merge-base --is-ancestor` → STALE (ancestor) | skip |
| `docs-mobile-sidebar-complete-8659c2` | Step 1: ACTIVE → Step 2: PR `MERGED` | skip |
| `eia-jti-tracking-7e68c5` | Step 1: STALE (ancestor) | skip |
| `triggers-auth-column-a80393` | Step 1: ACTIVE (3 commits ahead of main) → Step 2: PR empty (no PR) | ACTIVE — 분석 대상 |
| `llm-model-select-followup-refactor-4a3d96` | 현재 작업 워크트리 | 검토 대상 외 |

Stale skip 목록:
- `chat-channel-form-native-modal-c021b9` (branch `claude/chat-channel-form-native-modal-c021b9`) — Step 1 ancestor (STALE)
- `docs-mobile-sidebar-complete-8659c2` (branch `claude/docs-mobile-sidebar-complete-8659c2`) — Step 2 PR #344 MERGED
- `eia-jti-tracking-7e68c5` (branch `claude/eia-jti-tracking-7e68c5`) — Step 1 ancestor (STALE)

이 3개 worktree 는 활성으로 남아있을 이유가 없다. `./cleanup-worktree-all.sh --yes --force` 실행 권장.

**active worktree 분석 — `triggers-auth-column-a80393`**:

이 워크트리는 `spec/2-navigation/2-trigger-list.md` 와 `codebase/frontend/src/app/(main)/triggers/**` 를 수정한다. `spec/2-navigation/6-config.md` 는 이 워크트리가 변경하는 파일 목록에 포함되지 않는다 (git diff 확인 완료). 따라서 target 문서(`6-config.md`) 와의 worktree 충돌 없음.

---

## 요약

`spec/2-navigation/6-config.md` 는 이미 PR #341 (MERGED, commit `dbc6a4b1`) 을 통해 `auth-config-webhook-wiring` Phase 0 명세대로 갱신됐다 — HMAC type, Basic Auth UI, 마스킹·Reveal 흐름(§A.4), reveal API, Rationale R-2 모두 반영 완료. 현재 진행 중인 plan 중 이 파일을 동시에 수정하는 active worktree 는 없으며, 미해결 결정이나 선행 조건 미충족도 없다. 발견된 3건 모두 INFO 수준 — plan 문서 stale 정리 권고이며 impl-prep 차단 사유 없음. worktree 충돌 후보 4건 중 stale 3건 skip, active 1건(`triggers-auth-column`) 분석 — target 파일 비침범 확인.

## 위험도

NONE
