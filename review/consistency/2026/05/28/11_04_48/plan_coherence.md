# Plan 정합성 검토 결과

검토 모드: `--impl-prep`
Target: `spec/conventions/cafe24-api-metadata.md`
검토 일시: 2026-05-28

---

## 발견사항

### [WARNING] 선행 PR 미머지 상태에서 §7.5 수정 — 메인 브랜치 기준 사전 조건 미해소

- **target 위치**: `spec/conventions/cafe24-api-metadata.md §7.5` (worktree diff 기준 409–428번 줄, 책임 분리 표 갱신 + Rationale 신설)
- **관련 plan**: `plan/in-progress/cafe24-mcp-label-i18n.md` 의 Phase 1 — spec 갱신 (§7.5 갱신 항목)
- **상세**: `§7.5 "Catalog key 형식 — 활동 로그 api_label"` 은 현재 `main` 브랜치의 `spec/conventions/cafe24-api-metadata.md` 에 존재하지 않는다. 해당 §7.5 는 부모 PR (`claude/integration-activity-api-label-ed0a6e`, PR #338) 이 신설했으며 해당 PR 은 현재 OPEN 상태다. `cafe24-mcp-label-i18n` 계획의 `parent_branch` 가 이를 명시하고 있어 개발 중 §7.5 는 접근 가능하지만, 본 PR 이 `main` 에 직접 머지되거나 rebase 되려면 PR #338 이 먼저 머지되어야 한다. PR #338 이 리뷰 또는 수정 사이클로 지연되면 본 PR 의 spec 변경도 함께 블로킹된다. plan 의 "의존성·리스크" 절에 이 의존 관계가 명시되어 있지 않다.
- **제안**: `cafe24-mcp-label-i18n.md` 에 "의존성·리스크" 절을 추가하거나 Phase 1 앞에 "PR #338 (`integration-activity-api-label`) 머지 완료" 를 선행 조건으로 명시. 머지 순서가 보장되어야 rebase 시 §7.5 merge conflict 가 발생하지 않음.

---

### [WARNING] 미해결 결정(fallback 정책)이 target spec 변경에 반영되지 않음

- **target 위치**: `spec/conventions/cafe24-api-metadata.md §7.5` 책임 분리 표 및 신규 Rationale `"backend label 필드 제거 — frontend i18n dict 단일 SoT (2026-05-28)"`
- **관련 plan**: `plan/in-progress/cafe24-mcp-label-i18n.md` §"미해결 결정 사항" — "frontend dict lookup miss 시 fallback 정책 (catalog key vs op.id vs 영문 자동 변환) — 본 PR 안에서 결정"
- **상세**: plan 의 "확정된 설계 결정" 절에 `frontend dict lookup 실패 시 fallback: catalog key 자체 그대로 노출` 이라는 결정이 기록되어 있다. 그러나 현재 worktree 의 spec 변경(diff) 에서 이 fallback 정책이 `cafe24-api-metadata.md` 의 어느 절에도 명시되지 않았다 — §7.5 의 책임 분리 표, "왜 이 분리가 필요한가" 단락, Rationale 모두 fallback 동작을 생략하고 있다. spec 이 SoT 이므로 구현자가 `integration-configs.tsx` 의 fallback 처리를 코딩할 때 plan 문서만 보면 되지만, spec 에 없으면 이후 리뷰어/유지보수자가 fallback 결정의 근거를 찾을 수 없고 `integration-configs.tsx` 의 fallback 코드가 "임의 구현" 처럼 보일 위험이 있다.
- **제안**: `spec/conventions/cafe24-api-metadata.md §7.5` 의 "노드 에디터 operation 드롭다운 노출" 행 또는 "왜 이 분리가 필요한가" 단락에 1줄을 추가: `frontend dict lookup miss (cafe24Catalog.<key> 미등록) 시 fallback 은 labelKey 자체 (`cafe24.<resource>.<operation>`)를 노출한다 — dict 누락을 즉시 식별 가능하게 하기 위함.` Rationale 의 "결정" 항목에도 동일 내용을 포함.

---

### [INFO] 부모 PR 의 worktree (`integration-activity-api-label-ed0a6e`) 가 동일 파일을 보유 — 의도된 stacked PR 구조

- **target 위치**: `spec/conventions/cafe24-api-metadata.md` 전체 (cafe24-mcp-label-i18n 의 diff 기반)
- **관련 plan**: `plan/in-progress/cafe24-mcp-label-i18n.md` frontmatter `parent_branch: claude/integration-activity-api-label-ed0a6e`
- **상세**: 활성 worktree `integration-activity-api-label-ed0a6e` (PR #338 OPEN) 이 동일 파일 `spec/conventions/cafe24-api-metadata.md` 를 수정한 상태다. 이는 `cafe24-mcp-label-i18n` 의 `parent_branch` 필드로 의도된 stacked PR 이므로 비의도적 경합이 아니다. 단, PR #338 에서 §7.5 가 추가로 변경되면 이 worktree 의 diff 와 충돌이 생길 수 있으므로 PR #338 의 리뷰 사이클 중 §7.5 가 수정되면 이 worktree 도 rebase 해야 한다.
- **제안**: CRITICAL 아님. PR #338 이 최종 형태로 승인된 후 본 PR 을 rebase 해 §7.5 충돌 없음을 확인.

---

### [INFO] plan 내부 일관성 — "deprecate 명시" vs "완전 제거" 표현 불일치

- **target 위치**: `plan/in-progress/cafe24-mcp-label-i18n.md` §변경 범위 > Spec 항목 (line 29) vs §확정된 설계 결정 (line 61)
- **관련 plan**: 동일 문서 내부
- **상세**: §변경 범위에 `§7.5 … Cafe24OperationMetadata.label 의 deprecate 명시` 라고 적혀 있고, §2 항목에도 `label 필드 제거 (또는 deprecated 마크)` 라고 양자택일 표현이 남아 있다. 그러나 §확정된 설계 결정에서는 `backend Cafe24OperationMetadata.label 필드 완전 제거 (deprecate 가 아님 — 실 소비처가 명확)` 라고 확정했다. 두 표현이 같은 plan 문서 안에서 모순된다. 실제 worktree 의 spec diff 는 "완전 제거" 방향으로 구현되어 있으므로 spec 과의 불일치는 없으나, plan 문서 §변경 범위 의 `deprecate` 표현이 혼란을 줄 수 있다.
- **제안**: `cafe24-mcp-label-i18n.md` §변경 범위 Spec 항목을 `§2 의 metadata 형식 정의에서 label 필드 완전 제거 (deprecated 마크가 아님 — §확정된 설계 결정 참고)` 로 수정.

---

## Stale 으로 skip 한 worktree (의무 — 0건이어도 명시)

worktree 충돌 후보:

1. `integration-activity-api-label-ed0a6e` (branch `claude/integration-activity-api-label-ed0a6e`) — Step 1 ancestor: ACTIVE (exit 1, HEAD 가 main 에 없음). Step 2 PR #338 state: OPEN → active. 의도된 부모 PR 이므로 CRITICAL 아님, INFO 로 보고.

2. `cafe24-backlog-residual-batch` (worktree frontmatter 에 명시, branch `cafe24-backlog-residual-batch`) — 로컬 브랜치 미존재, 원격 브랜치 미존재, worktree 디렉토리 미존재, PR 없음. 실질 worktree 없음 — 충돌 후보에서 제외. cleanup 불요 (이미 존재하지 않음).

stale 판정으로 skip 된 worktree: **0건**. 위의 후보 2건은 각각 active (의도된 stacked PR) 와 미존재(worktree 없음)로 처리됨.

---

## 요약

`spec/conventions/cafe24-api-metadata.md` 에 대한 `cafe24-mcp-label-i18n` plan 의 변경은 의미적으로 올바른 방향이며 미해결 결정(완전 제거)과 충돌하지 않는다. 단, 두 가지 보완이 필요하다. (1) plan 에 PR #338 (`integration-activity-api-label`) 선행 머지 의존성이 명시되어 있지 않아 머지 순서가 보장되지 않으면 §7.5 rebase conflict 가 발생할 수 있다. (2) 확정된 dict lookup miss fallback 정책이 plan 에는 있으나 target spec 에 반영되지 않아 spec 이 불완전하다. worktree 충돌 후보 2건 중 stale skip 0건 — 부모 PR active 1건(의도된 stacked 구조, INFO), 미존재 branch 1건(실질 worktree 없음).

---

## 위험도

**LOW** — 구조적 blocking 없음. 선행 PR 의존이 plan 에 미명시된 점과 spec 의 fallback 정책 누락이 개선 대상이나, 실제 구현 블로킹 요인은 아님.
