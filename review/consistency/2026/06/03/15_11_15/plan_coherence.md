<!-- STATUS: OK -->

# Plan 정합성 검토 결과

**검토 대상**: `plan/in-progress/spec-draft-workspace-settings-api.md`
**검토 모드**: spec draft (--spec)
**검토 일시**: 2026-06-03

---

## 발견사항

### [INFO] spec-sync-user-profile-gaps.md 가 동일 파일(`spec/2-navigation/9-user-profile.md`) 추적 중 — worktree stale, 내용 비충돌
- target 위치: target 문서 `## Phase: Spec 갱신` — `spec/2-navigation/9-user-profile.md` §4·§4.2·§6.1 수정 예정
- 관련 plan: `plan/in-progress/spec-sync-user-profile-gaps.md` (worktree: `spec-sync-audit`)
- 상세: `spec-sync-user-profile-gaps.md` 는 동일 파일을 추적하나, 내용은 완전히 다른 영역(아바타 업로드 엔드포인트·알림 설정·테마 OS 옵션·슬러그 URL 라우팅)다. target plan 의 §4 "임베드 허용 도메인" 섹션 추가·§4.2 역할 매트릭스 inline 명시·§6.1 API 표 신규 행과 겹치는 항목 없음. 또한 `spec-sync-audit` worktree branch 의 PR #440 이 이미 MERGED 되어 worktree 는 stale 상태.
- 제안: 조치 불요. stale worktree 정리 후 남은 `spec-sync-user-profile-gaps.md` 미완 항목(avatar upload 등)이 실제 작업 재개 시 `9-user-profile.md` 를 수정할 때 target plan 의 §4·§6.1 변경과 merge conflict 가 없는지 확인 권장(내용 영역이 달라 충돌 없을 것으로 판단).

### [INFO] spec-sync-data-flow-12-workspace-gaps.md 가 동일 파일(`spec/data-flow/12-workspace.md`) 추적 중 — worktree stale, 내용 비충돌
- target 위치: target 문서 `## Phase: Spec 갱신` — `spec/data-flow/12-workspace.md` §1.7 신설
- 관련 plan: `plan/in-progress/spec-sync-data-flow-12-workspace-gaps.md` (worktree: `spec-sync-audit`)
- 상세: `spec-sync-data-flow-12-workspace-gaps.md` 의 미구현 항목은 §1.5(워크스페이스 전환 플로우), JWT 클레임 명명, DB UNIQUE 제약, audit 적재 범위다. target plan 이 추가할 §1.7(워크스페이스 설정 변경 sequenceDiagram)과 완전히 다른 섹션이며 내용 충돌 없음. `spec-sync-audit` PR #440 MERGED → worktree stale.
- 제안: 조치 불요.

### [INFO] 후속 plan 갱신 권장 — `spec/5-system/3-error-handling.md §1.2` ADMIN_REQUIRED 등재
- target 위치: target 문서 `## Phase: Spec 갱신` 마지막 항목
- 관련 plan: `plan/in-progress/spec-sync-structural-followups.md` (worktree: `spec-sync-audit`) §C — developer 코드 갭 추적
- 상세: target plan 은 `spec/5-system/3-error-handling.md §1.2` 에 `ADMIN_REQUIRED(403)` 를 정식 등재하려 한다. `spec-sync-structural-followups.md §C` 는 error-handling 관련 코드 갭을 다수 추적하나 `ADMIN_REQUIRED` 항목은 포함되지 않아 직접 충돌은 없다. 단, target 이 §1.2 를 수정할 때 §C 항목과 동일 섹션을 건드릴 가능성이 있으므로 합산 편집 시 §C 내용을 확인 권장.
- 제안: target plan 수정 시 `spec-sync-structural-followups.md §C` 의 `3-error-handling.md` 관련 항목(있으면)과 내용 정합 확인. 현재는 항목 없어 조치 불요.

### [INFO] channel-web-chat-followups.md 가 `spec/7-channel-web-chat/4-security.md` 를 참조 — worktree stale, 내용 비충돌
- target 위치: target 문서 `## Phase: Spec 갱신` — `spec/7-channel-web-chat/4-security.md §2·§3` cross-ref 추가
- 관련 plan: `plan/in-progress/channel-web-chat-followups.md` (worktree: `channel-web-chat-followups-1feff2`, PR #414 MERGED)
- 상세: `channel-web-chat-followups.md` 는 `4-security.md` §3·§4 를 참조하나 모든 관련 항목이 완료(✅) 또는 보류(⏸) 확정 상태이며, 해당 worktree 는 PR #414 MERGED 로 stale. target plan 이 추가할 cross-ref(기존 "워크스페이스 설정/사용자 명시 설정 필요" 문구에 `/workspace/settings` 개요 탭 + `PATCH /:id/settings` cross-ref)는 내용 추가이며 기존 완료 항목과 충돌 없음.
- 제안: 조치 불요.

### [WARNING] `spec-draft-workspace-settings-api.md` 의 후속 구현 plan 부재 — 개발자가 착수할 구현 plan 이 없음
- target 위치: target 문서 전체 (spec draft plan 이며 구현 phase 없음)
- 관련 plan: 없음 (현재 `in-progress/` 에 대응 구현 plan 없음)
- 상세: target 은 spec 변경만 다루는 draft plan 으로, 구현(`PATCH /api/workspaces/:id/settings` 엔드포인트, UI "임베드 허용 도메인" 섹션, 검증 로직)을 다룰 후속 developer plan 이 아직 없다. spec 변경 완료 후 구현이 orphan 상태가 될 위험.
- 제안: spec draft 완료 직후 `plan/in-progress/impl-workspace-settings-api.md` 등 구현 plan 을 신설하거나, 본 plan 에 "## Phase: 구현 (착수 전 spec 확정 선행)" 섹션을 추가해 developer 에게 위임 경로를 명시한다. CLAUDE.md "Plan must include spec updates" 피드백 역방향(구현 plan 이 spec phase 포함)과 대칭으로, spec draft plan 도 구현 위임 추적을 포함하는 것이 권장.

---

## Stale 으로 skip 한 worktree (의무)

worktree 충돌 후보 중 stale 판정으로 CRITICAL 분류에서 제외된 항목:

| worktree | branch | step 1 | step 2 |
|---|---|---|---|
| `spec-sync-audit` | `claude/spec-sync-audit` | ACTIVE (Step 1) | PR #440 MERGED → stale |
| `channel-web-chat-followups-1feff2` | `claude/channel-web-chat-followups-1feff2` | ACTIVE (Step 1) | PR #414 MERGED → stale |
| `spec-frontmatter-status-migration-027c17` | `claude/spec-frontmatter-status-migration-027c17` | ACTIVE (Step 1) | PR #356 MERGED → stale |
| `fix-presentation-tool-default-dcecc3` | `claude/fix-presentation-tool-default-dcecc3` | ACTIVE (Step 1) | PR #438 MERGED → stale |
| `code-node-sandbox-979a97` | `claude/code-node-sandbox-979a97` | ACTIVE (Step 1) | PR #434 MERGED → stale |
| `conventions-code-data-9b32d5` | `claude/conventions-code-data-9b32d5` | ACTIVE (Step 1) | PR #433 MERGED → stale |
| `plan-grooming-2ec306` | `claude/plan-grooming-2ec306` | ACTIVE (Step 1) | PR #440 MERGED → stale (동일 PR 포함 확인 필요) |
| `spec-drift-resolve-efb608` | `claude/spec-drift-resolve-efb608` | ACTIVE (Step 1) | PR #432 MERGED → stale |
| `system-status-recent-failed-86831b` | `claude/system-status-recent-failed-86831b` | ACTIVE (Step 1) | PR #435 MERGED → stale |

위 worktree 들이 git worktree list 에 여전히 등록된 상태라면 `./cleanup-worktree-all.sh --yes --force` 실행 권장.

**참고**: `feat-web-chat-demo` (branch `claude/workspace-allowed-origins-settings`) — Step 1 ancestor 체크 결과 STALE (branch HEAD = main HEAD, 신규 commit 없음), Step 2 PR 없음, Step 3 보수적 ACTIVE 처리. 이는 target plan 의 자체 worktree로 현재 작업 중인 분기이며 stale 대상 아님.

---

## 요약

`plan/in-progress/spec-draft-workspace-settings-api.md` 는 plan 정합성 관점에서 심각한 충돌 없이 안전하다. 동일 spec 파일(`spec/2-navigation/9-user-profile.md`, `spec/data-flow/12-workspace.md`, `spec/7-channel-web-chat/4-security.md`)을 추적하는 타 plan 들이 존재하나 모두 stale worktree(PR MERGED)에 속하며 내용 영역도 비충돌이다. 미해결 결정은 모두 사용자 confirm(2026-06-03)으로 처리되어 있고, 다른 plan 의 TBD 결정을 일방적으로 우회하는 사례도 발견되지 않았다. WARNING 1건(구현 plan 부재)은 작업 차단이 아니라 후속 추적 보완 권장 수준이다. worktree 충돌 후보 9건 전부 stale 판정으로 CRITICAL 분류에서 제외, active worktree 경합 0건.

---

## 위험도

LOW
