---
worktree: telegram-guide-realign-6ad222
started: 2026-05-22
completed: 2026-05-29
owner: project-planner
---

# Spec Fix — isActive drawer 내 편집 여부 명확화

> ✅ 완료 (2026-05-29). 사용자 결정 Option B 를 `spec/2-navigation/2-trigger-list.md` 에 반영. 사전 일관성 검토 `review/consistency/2026/05/29/08_45_29/SUMMARY.md` (BLOCK: NO, 전 checker LOW).

## 원본 발견사항

SUMMARY INFO-7 (requirement.md): spec §2.3.1 매트릭스는 Overview 카드의 `isActive`를 `edit (토글 버튼)`으로 명시한다. 현재 구현에서 `isActive` 는 badge 로 read-only 표시만 되고 편집 토글 버튼이 없다. 단, spec §2.1 이 "⋮ 행 액션과 동등" 이라고도 설명하므로 목록 행 액션이 동일 기능을 제공한다면 drawer 안 toggle 없어도 spec 위반이 아닐 수 있다. reviewer 는 이를 "spec 회색지대" 로 분류했다. (출처: `review/code/2026/05/22/15_08_07/requirement.md`)

## 결정 (2026-05-29): Option B 채택

사용자 결정 — **Option B (drawer 내 toggle 미구현, ⋮ 행 액션으로 충분, spec 을 shipping 구현에 정렬)**.

근거: 구현이 이미 옵션 B 형태로 출시됨 — drawer (`trigger-detail-drawer.tsx:295`) 는 `isActive` 를 read-only Badge 로만 표시하고, 활성/비활성 전환은 목록 페이지 (`triggers/page.tsx:793`) 의 ⋮ 행 액션 "활성/비활성 토글" (→ `PATCH /triggers/:id { isActive }`) 로 동작. ai-review INFO-7 도 버그가 아닌 "spec 회색지대" 로 분류. §2.1 이 이미 "⋮ 행 액션과 동등" 을 명시하므로 drawer 내 toggle 부재는 spec 위반이 아니며, spec 텍스트만 현실에 맞춘다 (추가 구현 0).

### 적용 변경 (spec/2-navigation/2-trigger-list.md) — 완료

- [x] §2.3.1 `isActive` 행: `edit (토글 버튼)` → `read-only (배지)` + "전환은 §2.1 ⋮ 행 액션 사용" (Rationale R-4 / R-16).
- [x] Rationale **R-16** 신설 — drawer read-only 표시 + ⋮ 액션 단일 편집 경로 결정 근거 (Option A 기각 사유·§2.1 관계·정정 맥락 포함).
- [x] Rationale **R-4** 본문 보완 — "API 편집 경로 이원화" 와 "drawer UI 표현(R-16)" 두 축 구분 명시.

### 기각된 옵션 (참고)

- **Option A** — spec 현행 유지 + drawer inline toggle 신규 구현 developer plan. shipping 동작과 불일치라 추가 구현 부담 + reviewer 가 버그로 보지 않은 사안에 UI 작업 투입 불합리.

## 영향 범위

- `spec/2-navigation/2-trigger-list.md` §2.3.1 + Rationale R-4 / R-16 (완료).
- 구현 영향 없음 — drawer read-only 배지 + 목록 ⋮ 토글은 이미 shipping. (`trigger-drawer-tests.md` 의 isActive 케이스도 현 구현 = read-only 기준이라 재작성 불필요.)
