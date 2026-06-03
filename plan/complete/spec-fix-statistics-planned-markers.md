---
worktree: spec-sync-impl-644d19
started: 2026-06-03
owner: resolution-applier
---
# Spec Fix Draft — statistics planned-marker removal

## 원본 발견사항

SUMMARY#W1: spec/2-navigation/7-statistics.md 에서 `periodCustom`, `customRangeStart`, `customRangeEnd`, `customRangeApply` 키를 "(미구현/Planned)"으로 표기하고 있으나, Wave-2 커스텀 범위 UI(`statistics/page.tsx` lines 518~550)가 이미 구현됐다.

SUMMARY#W2: spec/2-navigation/7-statistics.md 에서 `changeVsPrev` 키를 "(미구현/Planned)"으로 표기하고 있으나, 증감률 카드(`statistics/page.tsx` line 624)가 이미 구현됐다.

## 제안 변경

`spec/2-navigation/7-statistics.md` 에서 해당 기능들의 "(미구현/Planned)" 마커를 제거하고 구현 완료 상태로 업데이트한다.

구체적으로:
- 커스텀 날짜 범위 UI 관련 섹션의 "(미구현/Planned)" 또는 유사 미구현 표기 제거
- 전 기간 대비 증감률 카드 관련 섹션의 "(미구현/Planned)" 표기 제거
- 해당 기능들이 구현된 Wave/Phase 를 명시 (statistics/page.tsx 기준)

## 구현 증거

- `statistics/page.tsx:518` — `{t("statistics.periodCustom")}` 렌더링
- `statistics/page.tsx:527,538,550` — customRangeStart/End/Apply 소비
- `statistics/page.tsx:624` — `{t("statistics.changeVsPrev")}` 렌더링
- EN dict `en/statistics.ts:61-65` — 영문 번역 존재
