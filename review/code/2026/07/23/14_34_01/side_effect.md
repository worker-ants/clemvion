# 부작용(Side Effect) 리뷰 — output-shape.ts / output-shape.test.ts / plan 문서 / 이전 리뷰 산출물

## 검증 방법

`git diff origin/main -- codebase/frontend/src/components/editor/run-results/output-shape.ts`
를 non-comment 라인만 걸러 재확인했다 — 변경된 모든 라인이 JSDoc 블록(`*` 로 시작) 안이며,
실행 코드(함수 본문·시그니처·export·import)는 **1줄도 바뀌지 않았다**. `isConversationOutput`
/ `unwrapNodeOutput` 등 기존 함수 시그니처·반환 타입·호출부(呼出部) 전부 무변경.

## 발견사항

- **[INFO]** `output-shape.ts` 는 순수 JSDoc 재작성 — 부작용 표면 0
  - 위치: `codebase/frontend/src/components/editor/run-results/output-shape.ts:111-152` (diff 상단), 이후 JSDoc 위치 재확인 시 라인 210~287 부근
  - 상세: 직접 `git diff` 로 non-comment 라인을 필터링해 확인한 결과 변경분 전부가 `*`(JSDoc 내부) 로 시작한다. `isConversationOutput`/`unwrapNodeOutput`/`extractIeSnapshot`/`extractAiMetadata` 등 어떤 함수의 시그니처·로직·반환 shape 도 바뀌지 않았고, 새 전역 변수·모듈 레벨 side effect(예: import 시점 실행되는 코드)도 도입되지 않았다. 3곳의 호출부(`result-detail.tsx:1006·1052`, `result-timeline.tsx:73`)는 이번 diff 로 영향받지 않는다.
  - 제안: 없음 (확인 완료).

- **[INFO]** `output-shape.test.ts` 신규 `it()` 2건은 격리된 로컬 fixture만 사용 — 공유 상태 없음
  - 위치: `codebase/frontend/src/components/editor/run-results/__tests__/output-shape.test.ts` "rejects result.messages when the endReason key is absent entirely", "detects a terminal whose endReason sits at output.endReason, not result.endReason"
  - 상세: 두 테스트 모두 함수 스코프 로컬 `raw` 객체를 만들어 순수 함수 `isConversationOutput(raw)` 를 호출하고 반환값만 assert 한다. `beforeEach`/`afterEach`/module-level mock/모듈 상태 변형이 관여하지 않으므로 테스트 실행 순서·병렬 실행에 대한 부작용이 없다.
  - 제안: 없음.

- **[INFO]** 신규 파일 생성은 프로젝트 관례에 따른 기대된 부작용
  - 위치: `plan/in-progress/output-shape-comment-followups.md` (신규), `review/code/2026/07/23/14_19_49/{SUMMARY,RESOLUTION,meta,_retry_state,documentation,maintainability,requirement,scope,security,side_effect,testing}.{md,json}` (신규)
  - 상세: 이번 diff 가 파일시스템에 만드는 유일한 부작용은 신규 파일 추가이며, 전부 CLAUDE.md 의 "정보 저장 위치" 규약(`plan/in-progress/**`, `review/code/**`)에 부합하는 산출물이다 — `plan/` 은 developer 가 작업 추적용으로, `review/code/**` 는 `/ai-review` 워크플로가 상시 남기는 리뷰 아카이브다(review/ 는 gitignore 대상 아님, 커밋 관례). 기존 파일을 덮어쓰거나 삭제하는 연산은 없다.
  - 제안: 없음 (예상된 부작용, 우발적 아님).

- **[INFO]** `endReason` fallback(`result?.endReason ?? output.endReason`) 자체는 이번 diff 의 산물이 아님
  - 위치: `output-shape.ts:491-493` (fallback 로직 — 이번 diff 로 텍스트 변경 없음)
  - 상세: plan 문서·RESOLUTION 이 서술하듯 이 fallback 로직은 사전 존재 코드이고 이번 diff 는 그 위 JSDoc 만 재작성했다. 신규 테스트 1건이 이 fallback 경로를 처음으로 고립시켰을 뿐 로직 자체엔 손대지 않았으므로, "동작이 바뀌었는가" 관점의 부작용은 없다.
  - 제안: 없음.

## 요약

이번 diff 는 `output-shape.ts` 의 JSDoc 전면 재작성(영어→한국어, 근거 SoT 명문화)과
`output-shape.test.ts` 의 주석 정리 + 신규 격리 테스트 2건 추가, 그리고 규약에 맞는 신규
plan/review 문서 생성으로 구성된다. `git diff` 를 non-comment 라인으로 직접 필터링해
`output-shape.ts` 의 실행 코드가 정확히 0줄 변경됐음을 확인했으므로 함수 시그니처·공개
인터페이스·전역 상태·환경 변수·네트워크 호출·이벤트/콜백 어느 축에서도 부작용이 없다.
신규 테스트는 순수 함수를 로컬 fixture 로 호출하는 격리 테스트라 공유 상태 부작용이 없고,
새로 생성되는 파일들은 모두 프로젝트 관례(plan 라이프사이클, 리뷰 산출물 커밋)가 명시적으로
기대하는 위치·형식에 부합한다.

## 위험도
NONE
