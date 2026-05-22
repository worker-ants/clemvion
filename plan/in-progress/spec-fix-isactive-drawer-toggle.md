---
worktree: trigger-drawer-cleanup-f6a707
started: 2026-05-22
owner: project-planner
source: ai-review INFO-7 / review/code/2026/05/22/15_08_07/requirement.md
---

# Spec Fix Draft — isActive drawer 내 편집 여부 명확화

## 원본 발견사항

SUMMARY INFO-7 (requirement.md): spec §2.3.1 매트릭스는 Overview 카드의 `isActive`를 `edit (토글 버튼)`으로 명시한다. 현재 구현에서 `isActive` 는 badge 로 read-only 표시만 되고 편집 토글 버튼이 없다. 단, spec §2.1 이 "⋮ 행 액션과 동등" 이라고도 설명하므로 목록 행 액션이 동일 기능을 제공한다면 drawer 안 toggle 없어도 spec 위반이 아닐 수 있다. reviewer 는 이를 "spec 회색지대" 로 분류했다.

## 제안 변경

다음 중 하나를 `project-planner` 가 결정:

**Option A — drawer 내 toggle 구현 예정 (plan 신설)**
- `spec/2-navigation/2-trigger-list.md` §2.3.1 `isActive` 행 현행 유지
- `plan/in-progress/trigger-drawer-isactive-toggle.md` 신규 작성, developer 에 할당

**Option B — drawer 내 toggle 미구현 (⋮ 행 액션으로 충분, spec 갱신)**
- `spec/2-navigation/2-trigger-list.md` §2.3.1 `isActive` 행 변경:
  - 현행: `edit (토글 버튼)`
  - 변경안: `read-only (배지) — 편집은 목록 ⋮ 행 액션 "활성/비활성 토글" 사용`
- Rationale 절에 결정 근거 추가

## 영향 범위

- `spec/2-navigation/2-trigger-list.md` §2.3.1
- (Option A 선택 시) 신규 plan + codebase 구현
