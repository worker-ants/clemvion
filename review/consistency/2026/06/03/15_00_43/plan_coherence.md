# Plan 정합성 검토 결과

대상: `plan/in-progress/spec-draft-workspace-settings-api.md`
검토 모드: spec draft (--spec)
검토 시각: 2026-06-03

---

## 발견사항

### [INFO] `spec-sync-data-flow-12-workspace-gaps.md` 와의 영역 중복 — worktree는 stale

- **target 위치**: target 문서 "## 영향 spec" — `spec/data-flow/12-workspace.md` §1.x 신설
- **관련 plan**: `plan/in-progress/spec-sync-data-flow-12-workspace-gaps.md` (frontmatter `worktree: spec-sync-audit`)
- **상세**: `spec-sync-data-flow-12-workspace-gaps.md` 는 `spec/data-flow/12-workspace.md` 를 동일하게 손댄다. 그러나 해당 plan 의 worktree `spec-sync-audit`(branch `claude/spec-sync-audit`)는 Step 2 판정 결과 stale — PR #440 이 MERGED 상태. 따라서 worktree 경합 위험은 없다.
- **제안**: 조치 불필요. §"Stale 으로 skip 한 worktree" 항목에 기록됨. worktree cleanup 권장.

### [INFO] `spec/1-data-model.md` 동시 수정 후보 — node-cancellation-engine 워크트리, 비겹침 섹션

- **target 위치**: target 문서 "## 영향 spec" — `spec/1-data-model.md §2.2` (`interactionAllowedOrigins` 편집 경로 cross-ref)
- **관련 plan**: `plan/in-progress/node-cancellation-infrastructure.md` (worktree: `node-cancellation-engine-6bfcaa`)
- **상세**: `claude/node-cancellation-engine-6bfcaa` 가 `spec/1-data-model.md` 를 수정 중이지만, 변경 대상은 `NodeExecution.status` enum (§4.x NodeExecution 테이블) 이다. 타겟 plan 이 건드릴 §2.2 Workspace.settings 행과는 섹션이 다르다. 내용 충돌은 없으나 머지 시 diff 인접 여부에 따라 수동 rebase 가 필요할 수 있다.
- **제안**: 병합 순서 직렬화는 불필요하나, PR 선착 후 후착 쪽이 rebase 확인 권장.

### [INFO] 선행 `spec-sync-data-flow-12-workspace-gaps.md` 미해결 항목과의 관계 명시 누락

- **target 위치**: target 문서 전체
- **관련 plan**: `plan/in-progress/spec-sync-data-flow-12-workspace-gaps.md`
- **상세**: `spec-sync-data-flow-12-workspace-gaps.md` 는 `spec/data-flow/12-workspace.md` 에 대해 "워크스페이스 액션 audit 적재 범위", "워크스페이스 전환 플로우(§1.5)" 등 미구현 surface 를 추적 중이다. target plan 이 §1.x (settings-update 플로우)를 신설할 때 기존 "미구현 (Planned)" 표기가 있는 섹션들과의 관계(번호 충돌, 기존 표기 유지 여부)를 명시하지 않았다. 단, worktree 는 stale(PR #440 MERGED)이므로 경합 위험은 없으며 이미 main 에 포함된 상태다.
- **제안**: target plan 또는 구현 시 `spec/data-flow/12-workspace.md` 의 현재 §1.x 번호 체계를 확인하고 신설 절(settings-update flow)의 번호를 충돌 없이 배정할 것.

### [INFO] `channel-web-chat-followups.md` §3 soft 검증 완료와 target 의 관계

- **target 위치**: target 문서 "## 변경 내용 — UI" 및 영향 spec `spec/7-channel-web-chat/4-security.md §2/§3`
- **관련 plan**: `plan/in-progress/channel-web-chat-followups.md` §3 (✅ 완료, worktree: channel-web-chat-followups-1feff2 — stale 아님이지만 §3 자체는 완료됨)
- **상세**: `channel-web-chat-followups.md` §3 은 `interactionAllowedOrigins` 기반 embed-config 엔드포인트(`GET .../embed-config`)를 구현 완료로 표시한다. target plan 은 그 값을 편집하는 API/UI 를 추가한다. 두 plan 은 상호 보완적이고 충돌하지 않는다. 단, target 의 `spec/7-channel-web-chat/4-security.md §2/§3` 수정 시 "사용자가 명시 설정 필요" → "워크스페이스 설정 UI(PATCH /:id/settings) 경로" cross-ref 추가가 §3 구현 완료 설명과 일관돼야 한다.
- **제안**: target 의 spec 변경에서 `4-security.md §2.1` env 키 설명과 §3 soft 검증 설명의 "설정 경로" 문구를 신설 UI 링크로 업데이트하는 것을 명시할 것.

---

## Stale 으로 skip 한 worktree (의무)

worktree 충돌 후보 중 §worktree stale 판정으로 skip 된 항목:

| worktree | branch | Step 1 | Step 2 |
|---|---|---|---|
| `spec-sync-audit` | `claude/spec-sync-audit` | ACTIVE (ancestor 아님) | PR #440 MERGED → stale |
| `spec-drift-resolve-efb608` | `claude/spec-drift-resolve-efb608` | ACTIVE | PR #432 MERGED → stale |
| `code-node-sandbox-979a97` | `claude/code-node-sandbox-979a97` | ACTIVE | PR #434 MERGED → stale |
| `conventions-code-data-9b32d5` | `claude/conventions-code-data-9b32d5` | ACTIVE | PR #433 MERGED → stale |
| `fix-presentation-tool-default-dcecc3` | `claude/fix-presentation-tool-default-dcecc3` | ACTIVE | PR #438 MERGED → stale |
| `plan-grooming-2ec306` | `claude/plan-grooming-2ec306` | ACTIVE | PR #431 MERGED → stale |
| `system-status-recent-failed-86831b` | `claude/system-status-recent-failed-86831b` | ACTIVE | PR #435 MERGED → stale |

이 7개 worktree 는 모두 PR이 MERGED 상태이므로 `./cleanup-worktree-all.sh --yes --force` 실행 권장.

**target plan 의 `worktree: workspace-allowed-origins-settings` (`feat-web-chat-demo` 의 실제 branch `claude/workspace-allowed-origins-settings`)**: branch HEAD 가 main 과 동일 SHA(22869bc0) — 아직 신규 커밋 없음. stale 후보 아님. 신규 작업 워크트리로 정상.

---

## 요약

target plan(`spec-draft-workspace-settings-api.md`)은 사용자 confirm 결정(2026-06-03)이 기록된 상태로, 미해결 결정과의 충돌(§1), 선행 plan 미해소(§3), 후속 항목 누락(§4) 관련 CRITICAL/WARNING 발견사항은 없다. `spec/data-flow/12-workspace.md` 를 동시에 다루는 `spec-sync-data-flow-12-workspace-gaps.md` 의 worktree(`spec-sync-audit`)는 PR #440 MERGED 로 stale 판정되어 경합 위험 없음. `spec/1-data-model.md` 는 `node-cancellation-engine-6bfcaa` 가 비겹침 섹션을 수정 중이므로 병합 시 rebase 확인만 필요. worktree 충돌 후보 8건 중 7건이 stale(MERGED PR) 로 skip 처리, active 1건(`node-cancellation-engine-6bfcaa`)은 섹션 비겹침으로 INFO 처리.

---

## 위험도

LOW
