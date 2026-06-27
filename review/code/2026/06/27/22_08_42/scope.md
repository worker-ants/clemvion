# 변경 범위(Scope) 리뷰 결과

**리뷰 대상**: `webchat-widget-refactor` PR (worktree: `webchat-widget-refactor-ff484f`)
**리뷰 일시**: 2026-06-27

---

## 선언된 작업 범위

`plan/in-progress/webchat-widget-refactor.md` 에 선언된 이 PR 의 작업:
- B2/B5: `isTextInputSurface(pending)` 헬퍼 추출 (텍스트표면 판정 3중 중복 제거)
- B6: `TERMINAL_EVENTS` 배열 파생 (handleEiaEvent 문자열 3중 비교 제거)
- B3: `clearRefreshTimer` + `teardownSession` 헬퍼 추출 (handleEiaEvent·newChat·mount cleanup 중복 제거)
- B4: `start()` check-then-set 확인·유지 (변경 없음)
- C: 테스트 보강 (ended Composer 미렌더·C1 buttons/form 폐기·ended 재open reducer·ERROR→ended reducer·fake-timer refresh)

---

## 발견사항

### [INFO] `installControllableSse` 헬퍼 함수 추출 — 범위 내 정당한 테스트 인프라 리팩터
- 위치: `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts`
- 상세: `installControllableSse` 헬퍼가 새로 추출됐으며, 기존 C1 flush 테스트 내부에 있던 인라인 코드를 재사용 가능한 함수로 분리했다. 추출의 결과로 기존 C1 ai_conversation 테스트가 인라인 구현을 그대로 유지한 반면 새 C1 buttons 폐기 테스트(`installControllableSse`)와 fake-timer refresh 테스트는 각자 별도 fetch mock 를 사용한다. 테스트 보강(C) 목표 달성을 위한 인프라 준비이며 선언 범위 내 변동이다.

### [INFO] `web-chat-quality-backlog.md` 의 §A.1 설명 텍스트 수정 — 일관성 검토 follow-up 의 계획된 반영
- 위치: `plan/in-progress/web-chat-quality-backlog.md` §A.1
- 상세: consistency-check W-3 권고에 따라 spec_impact 항목 설명에 `2-sdk.md §3 (resetSession)` 참조를 추가했다. `review/consistency/2026/06/27/21_51_31/SUMMARY.md` 의 "W-3 은 plan 갱신만 본 PR 에서 반영" 명시와 정합하며 계획된 변경이다.

### [INFO] `review/consistency/2026/06/27/21_51_31/` 산출 파일들 (SUMMARY.md 등 5개 checker md + meta.json + _retry_state.json) — 표준 pre-impl consistency-check 산출
- 위치: `review/consistency/2026/06/27/21_51_31/`
- 상세: developer SKILL 규약에서 "구현 착수 직전 `consistency-check --impl-prep` 의무"로 요구되는 산출물이다. 이 파일들은 `review/consistency/**` 경로에 저장되는 정상 산출물이며, 코드베이스 변경과는 별개의 필수 절차 산출물이다.

### [INFO] `plan/in-progress/webchat-widget-refactor.md` 신규 생성 — 표준 plan 파일
- 위치: `plan/in-progress/webchat-widget-refactor.md`
- 상세: worktree `webchat-widget-refactor-ff484f` 에 대응하는 plan 파일로 CLAUDE.md 규약(`plan/in-progress/` + frontmatter `worktree` 명시)을 준수한다. 작업 목록과 scoping 결정이 선언적으로 기재돼 있으며 추가 내용 없음.

---

## 요약

총 10개 코드·문서 파일 변경이 분석됐다. 코드 변경 4개 파일(`widget-state.ts`, `widget-state.test.ts`, `panel.tsx`, `panel.test.tsx`, `use-widget.ts`, `use-widget-eager-start.test.ts` — 실질적으로 6개)은 모두 plan §B·§C 에 선언된 작업(헬퍼 추출·테스트 보강) 범위 내에 있다. 불필요한 리팩토링·기능 확장·무관한 파일 수정이 없으며, 포맷팅 전용 변경·주석 추가·불필요한 임포트 정리도 관찰되지 않는다. 임포트 변경(`isTextInputSurface` 추가)은 헬퍼 추출의 직접 결과이며 정당하다. `use-widget.ts` 의 `TERMINAL_EVENTS` 상수 및 `clearRefreshTimer`·`teardownSession` 추출은 동작을 변경하지 않는 behavior-preserving 리팩터다. consistency-check 산출물과 plan 파일은 CLAUDE.md 규약에 따른 필수 절차 산출물이다.

## 위험도

NONE
