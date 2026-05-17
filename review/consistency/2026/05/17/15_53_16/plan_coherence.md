### 발견사항

- **[WARNING]** W-48 미해결 결정과 target endpoint 설계 충돌 가능성
  - target 위치: `plan/in-progress/spec-draft-notification-dismiss.md` §4.2 "Endpoint" — `DELETE /notifications/:id`, `DELETE /notifications` 신규 endpoint 정의
  - 관련 plan: `plan/in-progress/20260516-full-review/RESOLUTION.md` §의사결정 보류 W-44/W-47/W-48 항목; `plan/in-progress/20260516-full-review/api-contract.md` W-48
  - 상세: 20260516-full-review 는 W-48 로 `PATCH /notifications/:id/read` 의 API 패턴(spec §12.1 상태 토글 패턴 위반)을 "호환성·spec 동시 갱신 필요"로 의사결정 보류 중이다. target 은 dismiss 용으로 `DELETE /notifications/:id` 와 `DELETE /notifications` 를 신설하는데, 두 endpoint 는 실제로는 soft delete(UPDATE `dismissed_at`)를 HTTP `DELETE` 로 표현한다. HTTP 동사 선택(soft-delete 를 `DELETE` 로 노출)이 API 패턴 결정의 일환임에도 W-48 의 API 패턴 미결 상태에서 독립적으로 확정되고 있다. 직접 충돌은 아니나, W-48 처리 시 API 패턴 규칙이 변경되면 새로 추가된 dismiss endpoint 도 재검토 대상이 될 수 있다.
  - 제안: target plan 의 §4.2 Endpoint 에 "W-48 API 패턴 결정 이후 재검토 여지 있음" 주석을 추가하거나, 20260516-full-review RESOLUTION.md 의 W-48 보류 항목에 "dismiss endpoint 설계도 동일 패턴 검토 대상에 포함" 메모를 추가한다.

- **[WARNING]** `spec/1-data-model.md` §3 인덱스 표의 partial index 변경이 full-review W-63 와 중복 영역 접촉
  - target 위치: `plan/in-progress/spec-draft-notification-dismiss.md` 변경안 #2 §2-B — `(user_id, is_read, created_at DESC)` 인덱스를 `WHERE dismissed_at IS NULL` partial index 로 갱신
  - 관련 plan: `plan/in-progress/20260516-full-review/database.md` W-63 (notification 인덱스 추가 제안); `plan/in-progress/20260516-full-review/RESOLUTION.md` W-63 처리 완료 항목 — `V053__notification_workspace_type_resource_idx.{sql,conf}` 신규 마이그레이션 추가
  - 상세: full-review-fixes-a1b2c3 worktree 가 `spec/1-data-model.md §3` 의 notification 인덱스 전략 표를 직접 수정했는지는 확인되지 않으나, V053 마이그레이션(workspace_type_resource 인덱스)은 이미 `backend/migrations/` 에 존재한다. target 의 변경안 #2-B 는 동일 표(`spec/1-data-model.md §3`)의 `(user_id, is_read, created_at DESC)` 행을 partial index 정의로 갱신한다. 두 worktree 가 동일 spec 파일의 동일 섹션(§3 인덱스 전략 표)을 동시에 수정 중일 경우 merge 시 conflict 위험이 있다. full-review-fixes-a1b2c3 worktree 가 아직 PR merge 전이라면 특히 주의가 필요하다.
  - 제안: full-review-fixes-a1b2c3 의 PR 머지 상태를 확인한 후, target spec 변경을 착수한다. 이미 머지됐다면 문제 없음; 미머지라면 직렬화(full-review-fixes PR 먼저 머지 후 notification-actions-8806b6 진행)를 권장한다.

- **[WARNING]** `spec/2-navigation/_layout.md` 의 동시 수정 가능성 — spec-overview-ui-patterns-followup
  - target 위치: `plan/in-progress/spec-draft-notification-dismiss.md` 변경안 #3 — `spec/2-navigation/_layout.md §3.1` 알림 벨 아이콘 항목에 dismiss 동작 설명 추가
  - 관련 plan: `plan/in-progress/spec-overview-ui-patterns-followup-2026-05-16.md` — `spec/2-navigation/_layout.md` 에 "Inline Alert" 패턴 정의 추가를 계획 중 (worktree: TBD, 아직 착수 전)
  - 상세: spec-overview-ui-patterns-followup 는 `spec/2-navigation/_layout.md` (또는 `spec/0-overview.md §3.4`) 에 Inline Alert 패턴 정의 추가를 계획한다. target 도 동일 파일 §3.1 을 수정한다. spec-overview-ui-patterns-followup 의 worktree 가 아직 TBD(미착수)이므로 현재 직접 충돌은 없으나, 착수 시 동일 파일을 동시 수정하는 경합이 발생할 수 있다.
  - 제안: spec-overview-ui-patterns-followup plan 의 frontmatter worktree 가 TBD 이므로 현재는 경합 위험이 낮다. 단, target 의 `plan/in-progress/` 에 "spec-overview-ui-patterns-followup 착수 전 _layout.md 를 동시 수정하지 않도록" 메모를 추가하거나, spec-overview-ui-patterns-followup 착수 시 이 사실을 consistency-check 에서 검출할 수 있도록 frontmatter worktree 를 조기에 확정한다.

- **[WARNING]** `spec/2-navigation/4-integration.md §11.2` 가 "§11 전체 재구성 중" plan 과 충돌 가능
  - target 위치: `plan/in-progress/spec-draft-notification-dismiss.md` 변경안 #4 — `spec/2-navigation/4-integration.md §11.2` 에 24h 중복 방지 ↔ dismissed_at 관계 주석 추가
  - 관련 plan: `plan/in-progress/spec-update-cafe24-test-connection.md` — `prod-rereview-fix-a7c93f` worktree 가 `spec/2-navigation/4-integration.md §11 전체 재구성 중` 임을 명시
  - 상세: spec-update-cafe24-test-connection.md 가 참조하는 `prod-rereview-fix-a7c93f` worktree 가 `spec/2-navigation/4-integration.md §11` 을 재구성 중이라면, target 의 §11.2 한 줄 추가와 충돌할 수 있다. 해당 worktree(`prod-rereview-fix-a7c93f`)는 현재 `ls /Volumes/project/private/clemvion/.claude/worktrees/` 목록에 존재하지 않아 이미 머지됐거나 삭제된 것으로 추정되나, 머지 완료 여부를 확인하지 않은 상태에서 착수하면 드리프트 위험이 있다.
  - 제안: `prod-rereview-fix-a7c93f` 브랜치의 PR 머지 상태를 git log 또는 gh pr list 로 확인한다. 머지 완료 확인 후 target 변경안 #4 를 진행한다.

- **[INFO]** migration 번호 "V0NN" 플레이스홀더 — 이미 V052/V053/V054 사용됨
  - target 위치: `plan/in-progress/spec-draft-notification-dismiss.md` 변경안 #1-B — "마이그레이션 번호 (V0NN) 는 developer 단계에서 채운다"
  - 관련 plan: `plan/in-progress/20260516-full-review/RESOLUTION.md` C-9(V052), W-63(V053) 처리 완료; `backend/migrations/` 에 V054 까지 존재
  - 상세: target 이 "가장 큰 번호 +1 로 채운다" 는 지침을 제시하고 있고, 현재 최신 번호는 V054 이므로 신규 migration 은 V055 이 된다. 이는 정확한 지침이며 충돌 없음. 다만 developer phase 착수 전 다른 worktree 에서 V055 를 선점할 수 있으므로 developer 가 착수 직전 재확인하도록 plan 에 명기하면 좋다.
  - 제안: target plan 의 마이그레이션 번호 지침에 "착수 직전 `backend/migrations/` 디렉토리의 실제 최신 번호를 재확인 후 채울 것" 문구를 추가한다.

- **[INFO]** cafe24-backlog-residual §A-1 의 notification 프론트엔드 작업과 target 의 frontend 작업 영역 중복 가능성
  - target 위치: `plan/in-progress/spec-draft-notification-dismiss.md` 영향 점검 — `frontend/src/components/layout/sidebar.tsx` popover UX 전반 개편 (developer phase)
  - 관련 plan: `plan/in-progress/cafe24-backlog-residual.md §A-1` — `frontend/src/components/notifications/*` 영역의 type-specific 핸들링 추가 (worktree: TBD)
  - 상세: cafe24-backlog-residual §A-1 과 target 모두 frontend notification 컴포넌트를 수정한다. §A-1 은 `type-specific` 렌더링 분기, target 은 dismiss 액션 UX 추가를 다루므로 범위가 다르지만 동일 파일을 동시에 수정하면 merge conflict 가능성이 있다. 두 plan 의 worktree 가 모두 TBD 이거나 미착수 상태이므로 현재 직접 충돌은 없다.
  - 제안: 두 frontend 작업이 동일 worktree 에서 순차 처리되거나, 착수 순서를 명시적으로 직렬화하도록 plan 간 상호 링크를 추가한다.

---

### 요약

target(`spec-draft-notification-dismiss.md`)은 자체적으로 잘 구조화된 draft 이며, 미해결 결정을 일방적으로 우회하는 CRITICAL 충돌은 발견되지 않았다. 다만 20260516-full-review 의 W-48(API 패턴 미결) 이 `DELETE` 동사 선택과 접점을 가지고, full-review-fixes-a1b2c3 worktree 의 `spec/1-data-model.md §3` 수정과 target 의 동일 섹션 갱신이 중복 접촉하며, spec-update-cafe24-test-connection 이 참조한 `§11 전체 재구성` worktree(`prod-rereview-fix-a7c93f`)의 머지 완료 여부가 불확실한 상태에서 target 이 동일 섹션(§11.2)을 수정한다는 점이 WARNING 으로 확인됐다. spec-overview-ui-patterns-followup 과의 `_layout.md` 동시 수정 가능성도 착수 시점에 따라 경합이 될 수 있다. 전반적으로 spec 반영 전에 full-review-fixes-a1b2c3 PR 및 prod-rereview-fix-a7c93f PR 의 머지 완료 여부를 먼저 확인하는 직렬화가 권장된다.

### 위험도

MEDIUM
