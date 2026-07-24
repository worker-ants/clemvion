# 유지보수성(Maintainability) 리뷰 — output-shape.ts / output-shape.test.ts / output-shape-comment-followups.md

## 범위 확인

`output-shape.ts` 는 이번 diff 전체에서 **non-comment 변경 0줄**(JSDoc 재작성만) — 실행 로직 무변경이
plan/RESOLUTION 서술과 실측(`git diff` non-comment 비교)상 일치한다. `output-shape.test.ts` 는 기존
comment 재정리 + 신규 `it()` 2건 추가, `plan/in-progress/output-shape-comment-followups.md` 는 신규
plan 문서, 나머지(`review/code/2026/07/23/14_19_49/**`)는 이전 라운드 리뷰 산출물(자동 생성 보고서)이라
전형적 코드 유지보수성 기준(가독성/네이밍/함수 길이 등)의 대상이 아니다 — 별도 코멘트 없음.

## 발견사항

- **[INFO]** JSDoc 에 마크다운 헤더(`##`)·blockquote(`>`) 최초 도입 — 파일 내 기존 comment 스타일과 형식 이질
  - 위치: `codebase/frontend/src/components/editor/run-results/output-shape.ts:407-451` (`isConversationOutput` JSDoc)
  - 상세: 같은 파일의 다른 JSDoc(`unwrapNodeOutput`, `extractIeSnapshot`, `AiMetadata` 등)은 평문 + 불릿 리스트만 쓰는데, 이번에 재작성된 `isConversationOutput` JSDoc 만 `## 방어적 유지` 헤딩과 `> **근거의 SoT 는...**` blockquote 를 쓴다. 내용 조직화 자체는 좋으나 파일 내 comment 포맷 컨벤션이 함수마다 갈라졌다.
  - 제안: 이미 plan 항목 3·이전 라운드 SUMMARY INFO 6 에서 "의도된 확장, 스코프 이탈 아님"으로 합의됐고 실질적 해악(가독성 저하)도 없어 조치 불요 — 후속으로 나머지 함수 JSDoc 을 손댈 기회가 오면 같은 포맷으로 통일할지만 검토.

- **[INFO]** 신규 테스트 2건의 "고립 조건" 주석이 기존 6개 테스트와 동일한 장문 불릿 스타일을 그대로 반복
  - 위치: `codebase/frontend/src/components/editor/run-results/__tests__/output-shape.test.ts:61-95, 97-127`
  - 상세: `it.each` 테이블화가 이미 plan 문서에서 실측(4% 절감)으로 NO-GO 처리됐고, 반복되는 불릿 목록은 각 fixture 가 어떤 분기를 격리하는지 1:1로 명시하기 위한 의도된 verbosity다. 새 코드가 기존 파일의 확립된 패턴을 그대로 따른 것이라 새로운 문제는 아니다.
  - 제안: 없음 — 이미 plan 문서 §4 에 근거가 기록돼 있어 반복 지적하지 않음.

## 이전 라운드(14_19_49) INFO 반영 확인

- INFO 1(테스트 주석의 소스 줄번호 하드코딩, `output-shape.ts:202`) — 이번 diff 의 신규 테스트 주석에서
  줄번호가 제거되고 `typeof endReason === "string"` conjunct·`ReadonlySet<string>` 같은 코드 앵커
  기준 서술로 대체됨을 확인(`output-shape.test.ts:66-71`). 반영됨.
- INFO 2(mutation 실측 서술이 테스트 주석·plan 양쪽에 중복, JSDoc 의 "근거는 한 곳에만" 원칙과 자기모순) —
  신규 테스트 주석이 "어떤 변형이 어느 테스트를 red 로 만드는지의 실측 표는 plan 문서 `output-shape-comment-followups.md`
  §mutation 실측 이 SoT" 로 위임하고 표를 옮겨 적지 않음을 확인(`output-shape.test.ts:72-75`). plan 문서
  포인터가 폴더 경로가 아닌 파일명 기준이라 `in-progress/` → `complete/` 이동에도 안전. 반영됨.
- 이 두 항목 모두 실제 diff 에서 관측 가능한 형태로 정정돼 있어 재지적하지 않는다.

## 요약

이번 diff 는 `output-shape.ts` 실행 로직을 건드리지 않고 JSDoc 재작성 + 테스트 fixture 2건 추가 +
plan 문서 신설에 그친다. 신규 테스트는 파일에 이미 확립된 명명·주석 컨벤션(동사로 시작하는 `it()` 설명,
"(내부적으로 …)" 각주로 변수명 결합 완화, 고립 조건 불릿 목록)을 정확히 따르고, 이전 라운드에서 지적된
줄번호 하드코딩·근거 중복 문제도 이번 diff 안에서 해소된 상태로 확인된다. JSDoc 의 마크다운 헤더/blockquote
도입은 파일 내 포맷이 함수별로 약간 갈라지는 경미한 일관성 이슈이나, 이미 별도 라운드에서 의도된 결정으로
합의됐고 가독성을 해치지 않아 차단 사유가 아니다. 유지보수성 관점에서 신규 Critical/Warning 없음.

## 위험도

NONE
