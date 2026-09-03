# 문서화(Documentation) 리뷰

## 발견사항

- **[WARNING]** `stripComments` 삽입 위치로 `countCalls` 의 JSDoc 이 orphan 되어 `stripLiterals` 앞에 잘못 걸린다
  - 위치: `codebase/backend/src/common/__test-utils__/source-scan.ts:57-93` (전체 파일 컨텍스트 게이트 기준)
  - 상세: 이번 diff 는 `countCalls` 바로 위에 있던 기존 JSDoc(“주석을 제외하고 `<name>(` 또는 `<name><` 호출 수를 센다…”, 57~62줄)과 `export function countCalls`(90줄) 사이에 **새 함수 `stripLiterals` 와 그 자신의 JSDoc(63~82줄) 를 통째로 끼워 넣었다.** 그 결과 파일을 위에서 아래로 읽으면 다음 순서가 된다:
    1. `countCalls` 를 설명하는 JSDoc (57~62)
    2. `stripLiterals` 를 설명하는 JSDoc (63~82)
    3. `export function stripLiterals` 선언 (83~88)
    4. 빈 줄
    5. `export function countCalls` 선언 (90) — **바로 위에 아무 JSDoc 도 없다**

    즉 `countCalls` 를 설명하던 주석이 이제 `stripLiterals` 바로 위에 붙어 있어 **엉뚱한 함수를 설명하는 것처럼 보이고**, 정작 `countCalls` 는 문서가 없는 것처럼 보인다. IDE hover/TypeDoc 류 도구는 선언에 **가장 가까운** 앞쪽 JSDoc 블록을 그 선언의 문서로 채택하는 것이 일반적이므로, 이 배치에서는 `stripLiterals` 위에 두 개의 블록 주석이 연속으로 쌓여 있고 `countCalls` 는 문서가 붕 뜬 채로 남는다. 이 파일 자체가 “가드가 무엇을 어떻게 세는지의 단일 출처”라는 목적으로 극히 정교한 rationale 주석을 유지해 온 파일이라(각 함수마다 “왜 필요한가”/“한계” 절을 두는 관례), 이 orphan 은 그 관례와 대비된다.
  - 제안: `countCalls` 의 원래 JSDoc(57~62줄)을 `stripLiterals` 삽입 지점 **뒤**, 즉 `export function countCalls` 선언 바로 위(90줄 앞)로 옮긴다. `stripLiterals` 는 자신의 JSDoc(63~82줄)만 유지하면 된다.

## 요약

전반적으로 이번 diff 는 문서화 규율이 매우 높다 — 신규 공개 함수(`collectTsFiles`, `stripLiterals`, `widenedEntityFields`, `findStaleSpecCasts`)마다 “왜 필요한가”, “왜 오탐이 없나”, “한계” 절을 갖춘 JSDoc 을 달았고, 다섯 개 walker 사본을 하나로 합치며 각 축(`.spec.ts` 제외·`.d.ts` 제외·`node_modules`/`dist` skip·`sort()`)이 실제로 살아있는지 실측 표로 근거를 남겼다. plan 문서(`entity-nullable-column-type-mismatch.md`)도 완료 항목마다 실측·뮤테이션 검증 결과를 인용해 “확인 없이 완료라고 쓰지 않는다”는 이 저장소의 반복 교훈을 스스로 지키고 있다. 유일한 흠은 `source-scan.ts` 에서 `stripLiterals` 삽입 위치가 어긋나 `countCalls` 의 기존 JSDoc 을 orphan 시킨 것으로, 기능에는 영향이 없지만 이 파일이 표방하는 “주석이 곧 판단 기록”이라는 원칙과 어긋나는 실수다. README·CHANGELOG·API 문서는 이번 diff 범위(내부 테스트/가드 인프라 리팩터링 + plan 문서 갱신)에서 갱신이 필요한 대상이 아니다 — CHANGELOG 관례를 확인한 결과 API/동작 영향이 있는 변경만 기록하고 있고, 이 PR 은 그런 변경을 포함하지 않는다.

## 위험도

LOW
