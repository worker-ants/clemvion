# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 수준의 직접 차단 사유 없음 (Plan Coherence 의 CRITICAL 항목은 merge 순서 조율로 해소 가능한 경합 위험이며, spec 내용 자체의 모순은 아님)

## 전체 위험도
**MEDIUM** — active worktree 간 동일 파일 동시 편집 경합 존재. spec 내용 모순·식별자 충돌·규약 위반은 없음.

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| — | — | Critical 수준 위배 없음 | — | — | — |

> Plan Coherence 가 CRITICAL 로 분류한 `unified-model-mgmt-5af7ee` 경합은 동일 파일 내 서로 다른 섹션을 편집하는 것으로 텍스트 충돌 가능성은 낮다. merge 순서 직렬화(security-fixes 먼저, unified-model-mgmt 가 rebase)로 해소 가능하므로 BLOCK 사유로 격상하지 않는다.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| W-1 | Plan Coherence | `spec/5-system/1-auth.md`·`spec/1-data-model.md` 를 `unified-model-mgmt-5af7ee` 와 동시 편집 중 — merge 순서 미조율 시 상대방 변경 덮어쓰기 위험 | `spec/5-system/1-auth.md §3.2`·`§4.1`, `spec/1-data-model.md §2.1`·`§2.11` | `plan/in-progress/unified-model-management.md` (worktree `unified-model-mgmt-5af7ee`) | security-fixes 를 먼저 merge 하고 unified-model-mgmt 가 rebase 후 충돌 점검. 동시 PR open 금지. |
| W-2 | Plan Coherence | `spec-sync-auth-gaps.md` 의 `worktree:` 필드가 존재하지 않는 `spec-sync-audit` 를 가리킴 | `plan/in-progress/spec-sync-auth-gaps.md` frontmatter `worktree` 필드 | `spec/5-system/1-auth.md` frontmatter `pending_plans` 목록 | `worktree:` 필드를 `(unstarted)` 로 수정하고 실제 남은 미구현 항목(LDAP/SAML) 재점검. |
| W-3 | Plan Coherence | `auth-config-webhook-followups.md §3` 의 `POST /api/auth-configs/:id/reveal` 행 추가 미반영 — 같은 파일 편집 중 일괄 처리 기회 놓침 | `spec/5-system/1-auth.md §5 API 엔드포인트` 표 | `plan/in-progress/auth-config-webhook-followups.md §3` | 별도 project-planner 작업으로 진행하거나 현재 worktree merge 전에 포함 여부 결정. |
| W-4 | Plan Coherence | plan 체크리스트 `/ai-review` 항목 미완 상태 | `plan/in-progress/security-fixes-audit-guard-secret-rotation.md` 체크리스트 | — | `/ai-review` 완료 후 체크박스 갱신 및 `plan/complete/` 로 이동. |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| I-1 | Rationale Continuity | Rate Limit 스코프 변경(워크스페이스·invited_by 단위 → 글로벌) 의 폐기 근거 Rationale 미기록 | `spec/5-system/1-auth.md §Rationale` | `§1.5.E` 항목 추가: "워크스페이스·invited_by 단위 안 채택 — 구현 복잡도 대비 이득이 작고 INVITATION_THROTTLE 값과 일치." |
| I-2 | Rationale Continuity | `spec/1-data-model.md §Rationale` 에 User 표 동기화 근거 미기록 | `spec/1-data-model.md §Rationale` | "User 표 §2.1 보강 (2026-06-10 spec-sync) — auth spec 에 정의된 필드를 data model SoT 에 반영" 한 줄 추가 (선택). |
| I-3 | Convention Compliance | `1-auth.md §Rationale` 에서 신규 `§1.5.D` 항목이 `§2.3.A` 뒤에 위치 — 번호 역순 | `spec/5-system/1-auth.md §Rationale` 끝 (라인 538) | `§1.5.D` 를 `§1.5.C` 와 `§1.4.A` 사이로 이동해 §1.5.* 연속 배치 (규약 강제 아님 — 선택). |
| I-4 | Convention Compliance | `§1.5.4` 인라인 blockquote 의 SoT 링크가 `error-codes.md §1` 을 잘못 참조 | `spec/5-system/1-auth.md §1.5.4` (라인 260) | `[error-codes.md §1]` → `[error-codes.md §3]` (historical-artifact 레지스트리)로 교정. |
| I-5 | Convention Compliance | `11-mcp-client.md` 에 `## Rationale` 섹션 부재 | `spec/5-system/11-mcp-client.md` | 문서 말미에 `## Rationale` 추가, §2.2 stdio 미지원·§3.1 service_type 등 분산된 근거를 집약 (이번 diff 외 기존 문서). |
| I-6 | Convention Compliance | `10-graph-rag.md` 의 `## Overview` 와 `## 1. 개요` 이중 구조 — 번호 체계 중첩 | `spec/5-system/10-graph-rag.md` | `## Overview` 를 단락 요약으로 축소하거나 하위 항목을 본문으로 이동 (이번 diff 외 기존 문서). |
| I-7 | Cross-Spec | `spec/1-data-model.md` 에 `workspace_invitation` 엔티티 미정의 (SoT 는 `data-flow/12-workspace.md §2.1`) | `spec/1-data-model.md` | 향후 `workspace_invitation` 엔티티 항목 추가 시 일관성 향상 — 현재 diff 내 blocking 없음. |
| I-8 | Plan Coherence | stale worktree 2건(`spec-sync-audit-998544`, `trigger-schedule-sync-f88604`) 정리 미완 | `.claude/worktrees/` | `./cleanup-worktree-all.sh --yes --force` 실행 권장. |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | NONE | Rate Limit 확정값·초대 토큰 raw 저장 Rationale 모두 기존 data-flow spec 과 일치. `WorkspaceInvitation` 엔티티 미정의는 diff 이전부터의 공백. |
| Rationale Continuity | LOW | Rate Limit 스코프 변경(글로벌 채택) 근거 미기록 1건(INFO). 나머지 변경은 기존 원칙 준수 또는 올바른 예외 처리. |
| Convention Compliance | NONE | 이번 diff 내 규약 직접 위반 없음. Rationale 항목 역순, SoT 링크 오류, 타 파일 구조 불일치 4건 모두 INFO. |
| Plan Coherence | MEDIUM | `unified-model-mgmt-5af7ee` 와의 동일 파일 경합(CRITICAL 분류, merge 순서 조율로 해소 가능). plan 체크리스트 미완·worktree 필드 오류 WARNING 2건. |
| Naming Collision | NONE | 신규 식별자 4종(Rationale 1.5.D, User 필드 11개, userId 필터, INVITATION_THROTTLE 참조) 모두 충돌 없음. |

## 권장 조치사항

1. **(W-1, merge 전 필수)** `unified-model-mgmt-5af7ee` PR 을 `security-fixes` 보다 먼저 열지 말 것. security-fixes 를 먼저 merge 한 뒤 unified-model-mgmt 가 rebase + 인접 섹션 충돌 점검.
2. **(W-2)** `plan/in-progress/spec-sync-auth-gaps.md` 의 `worktree:` 필드를 `(unstarted)` 로 수정.
3. **(W-3)** `auth-config-webhook-followups.md §3` 의 `POST /api/auth-configs/:id/reveal` 항목 처리 방향 결정 (이번 worktree 포함 or 별도 작업).
4. **(W-4)** `/ai-review` 완료 후 plan 체크박스 갱신 및 `plan/complete/` 이동.
5. **(I-1, 선택)** `spec/5-system/1-auth.md §Rationale` 에 `§1.5.E` 추가 — Rate Limit 글로벌 스코프 채택 근거.
6. **(I-4)** `spec/5-system/1-auth.md §1.5.4` 라인 260 의 `[error-codes.md §1]` 링크를 `[error-codes.md §3]` 으로 교정.
7. **(I-8)** stale worktree 2건 정리: `./cleanup-worktree-all.sh --yes --force`.