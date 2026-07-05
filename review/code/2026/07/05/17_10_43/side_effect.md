# 부작용(Side Effect) Review — dry-run badge fix 검증 (17_10_43)

## 초점

이전 라운드(16_49_52) side_effect WARNING — dry-run 배지가 execution-level fallback 을 상실해
`_dryRun` 마커 없는 비-effect 노드가 dry-run 실행에서도 배지 미표시 — 에 대한 조치를 검증한다.
조치는 공유 컴포넌트 `ResultDetail` (`result-detail.tsx`) 에 optional prop
`executionDryRun?: boolean`(기본 `false`) 을 추가하고, 배지 조건을
`executionDryRun || isDryRunOutput(result.outputData)` 로 확장, 실행 상세 페이지에서
`execution.dryRun === true` 를 재전달하는 방식이다.

## 검증한 내용

- `codebase/frontend/src/components/editor/run-results/result-detail.tsx:838-880` —
  `executionDryRun?: boolean` prop 을 인터페이스에 추가하고 함수 시그니처에서
  `executionDryRun = false` 기본값을 지정. 기존 필수 prop 순서·이름·타입은 전혀
  변경되지 않았다 (line 838 부근 삽입, 기존 prop 뒤 이어붙임 아님 — 실제로는
  `result` 바로 다음에 삽입됐으나 이는 named-prop 구조분해라 순서 무관, 호출자
  영향 없음).
- `result-detail.tsx:1174` — 배지 렌더 조건이 `isDryRunOutput(result.outputData)`
  단독에서 `(executionDryRun || isDryRunOutput(result.outputData))` 로 확장. `executionDryRun`
  기본값이 `false` 이므로 prop 미전달 시 이 표현식은 정확히 이전과 동일하게
  평가된다(순수 OR 확장, 다른 렌더 경로·상태·이펙트에 영향 없음).
- `codebase/frontend/src/components/editor/run-results/run-results-drawer.tsx:457-475` —
  에디터 소비처(`RunResultsDrawer`)의 `<ResultDetail ... />` 호출부를 확인. `executionDryRun`
  prop 을 전달하지 않는다 → 기본값 `false` 적용 → 기존 동작(마커 기반 배지만) 완전 보존.
  이 파일 자체는 diff 에 포함되지 않았고(본 리뷰 대상 diff 에 `run-results-drawer.tsx` 변경 없음),
  실제 저장소 상태를 grep 으로 재확인해 미전달임을 검증했다.
- `codebase/frontend/src/app/(main)/workflows/[id]/executions/[executionId]/page.tsx:457,632` —
  신규 소비처인 실행 상세 페이지가 `executionDryRun={execution.dryRun === true}` 를
  `NodeResultsTab` 에 넘기고, 이를 다시 `<ResultDetail executionDryRun={executionDryRun} .../>` 로
  전달. `execution.dryRun` 필드 자체는 이번 diff 로 새로 읽는 것이 아니라 기존 API 응답
  필드를 재사용(같은 페이지 내 다른 곳(`execution.dryRun &&` 배지, `item.dryRun` 등)에서도
  이미 읽고 있음) — 신규 네트워크 호출이나 신규 상태 소스 없음.
- `ResultDetail` 컴포넌트 내부에 남아있는 유일한 부수효과 지점인
  `useExecutionInteractionCommands(executionId)` 호출은 이번 diff 의 대상이 아니며
  (기존 아키텍처 리뷰에서도 확인된 이전 라운드부터의 구조), 이번 dry-run prop 추가와
  무관하게 그대로 유지된다 — 새 이벤트/콜백 경로가 추가되지 않았다.
- `toNodeResult()` 의 `startedAt`/`inputData` 매핑 추가(별도 CRITICAL 조치, 본 파일 범위
  밖이지만 동일 diff 내 포함)도 `NodeResult` 인터페이스(`execution-store.ts`)에 이미 존재하던
  optional 필드를 채우는 것뿐이라 인터페이스 변경이 아니다 — 다른 `NodeResult` 생산자
  (WS 이벤트, 스토어 병합 로직 등)에는 영향 없음.
- 유닛 테스트 실행 결과: `result-detail` + `execution-detail-waiting` 스위트 41개 전부
  통과 (dry-run 배지 회귀 테스트 포함, drawer 쪽 기본 동작 테스트도 간접 커버).
  `run-results-drawer` 전용 테스트 파일은 존재하지 않으나, drawer 호출부 자체가 prop
  미전달 그대로이므로 회귀 위험 없음.

## 발견사항

- **[INFO]** `executionDryRun` prop 이 optional 이지만 `undefined` 도 falsy 처리되어
  안전 — 명시적 `=== true` 비교 없이 `execution.dryRun === true` 로 페이지 단에서
  boolean 강제 변환 후 전달. 컴포넌트 쪽 기본값(`= false`)과 이중 방어가 되어 있어
  API 응답의 `dryRun` 필드가 `undefined`/`null` 인 과거 데이터에서도 배지가 실수로
  뜨지 않는다. 별도 조치 불필요.
- **[INFO]** 신규 prop 이 optional(`?:`) 이라 `ResultDetail` 을 사용하는 제3의 소비처가
  향후 생기더라도 컴파일 타임에 강제되지 않음 — 새 소비처가 dry-run 배지를 원한다면
  명시적으로 값을 전달해야 하고, 누락 시 조용히 `false` 로 fallback 된다. 지금 시점
  소비처가 2곳뿐이고 둘 다 검증됐으므로 문제는 아니나, 향후 세 번째 소비처 추가 시
  리뷰어가 유의할 지점.

## 요약

이번 변경은 공유 컴포넌트에 optional·기본값 `false` prop 하나를 추가하고 배지 렌더
조건을 순수 OR 확장한 것으로, 기존 필수 prop 계약·렌더 순서·상태 관리·이벤트 배선에
전혀 손을 대지 않았다. 유일한 기존 소비처인 에디터 `run-results-drawer.tsx` 는 diff
자체에 포함되지 않았고 실제로 `executionDryRun` 을 전달하지 않으므로 기본값 `false` 가
적용되어 동작이 100% 보존됨을 코드·grep·유닛 테스트(41개 통과) 세 경로로 교차 확인했다.
신규 소비처인 실행 상세 페이지는 이미 페이지 내에서 읽고 있던 `execution.dryRun` 필드를
재사용해 전달할 뿐 새로운 네트워크 호출이나 전역 상태 변경을 도입하지 않는다.
`toNodeResult()` 의 `startedAt`/`inputData` 필드 채움 역시 기존 optional 인터페이스
슬롯을 채우는 것뿐이라 인터페이스 변경으로 볼 수 없다. 부작용 관점에서 이번 조치는
안전하며 추가 우려 사항이 없다.

## 위험도

NONE
