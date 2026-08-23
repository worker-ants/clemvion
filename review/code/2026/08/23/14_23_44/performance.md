# 성능(Performance) 코드 리뷰 — masking-gate-consolidation

## 검토 범위 메모

실제 코드 변경은 3개 TS 파일뿐이다 (`background-runs.service.ts` · `executions.service.ts` ·
`redact-stored-error.ts`). 나머지 파일(4~14)은 `plan/**`·`review/consistency/**`·
`spec/conventions/egress-masking.md` 로 문서/산출물이라 성능 관점 대상이 아니다.

이 변경은 `inputData`/`outputData`/`error` 세 컬럼을 마스킹하던 4곳의 손으로 반복된 호출을
두 헬퍼(`redactStoredFieldsForResponse`, `redactNodeExecutionRow`)로 **기계적으로 추출**한
순수 리팩터다. 각 호출부의 로직·호출 횟수·쿼리 형태는 diff 전후로 동일하며, 마스킹의
알고리즘 복잡도(호출당 `deepRedactSecrets` 1회)도 변하지 않는다.

## 발견사항

- **[INFO]** 마스킹 스프레드 도입으로 호출당 소형 중간 객체 1개가 추가로 할당된다
  - 위치: `codebase/backend/src/shared/utils/redact-stored-error.ts:97` (`redactStoredFieldsForResponse` 함수 시그니처)
  - 상세: 종전엔 `inputData: redactStoredDataForResponse(...)` 처럼 상위 리터럴에 직접
    프로퍼티를 대입했지만, 이제는 `redactStoredFieldsForResponse(row)` 가 `{ inputData, outputData, error }`
    중간 객체를 만들고 호출부가 `...redactStoredFieldsForResponse(row)` 로 그걸 다시 펼친다.
    호출당 짧은 수명의 객체가 하나 더 생기지만, 실제 마스킹 연산(`deepRedactSecrets` 호출 3회)은
    그대로이고 호출부는 응답 1건(`toExecutionDto`/`toResponseExecution`)당 또는 페이지당 최대
    `NODE_EXECUTIONS_MAX_LIMIT`(200, `background-runs.service.ts:24`) 행으로 유계라 무시할
    수준이다.
  - 제안: 조치 불요(가독성·중복 제거 이득이 이 정도 오버헤드를 압도).

- **[INFO]** `redactNodeExecutionRow` 는 이미 존재하던 copy-on-change 참조 보존 최적화를
  그대로 계승 — 리팩터가 성능 특성을 퇴행시키지 않음을 확인
  - 위치: `codebase/backend/src/shared/utils/redact-stored-error.ts:144` (`redactNodeExecutionRow`),
    호출부 `codebase/backend/src/modules/executions/executions.service.ts:704`
  - 상세: `findById` 의 `nodeExecutions` 조회(`executions.service.ts` 626~735행 부근, `manager.find(NodeExecution, ...)`)
    에는 `take` 상한이 없다(코드 주석이 이를 명시적으로 인지하고 있음, "대규모 ForEach 실행에서
    행 수만큼" 언급). `redactNodeExecutionRow` 는 세 컬럼 모두 무변화면 원본 참조를 그대로
    반환해, 마스킹 대상이 없는 절대다수 행에서 `{ ...row, ... }` shallow-copy 를 회피한다.
    이 특성은 리팩터 이전 인라인 코드(`maskIfPresent` 삼중 호출 + 참조 비교)와 동일하며,
    추출 과정에서 퇴행하지 않았다. 다만 이 unbounded 조회 자체는 이번 diff 가 만든 것이
    아니라 기존 설계(및 기존 성능 리뷰 `17_12_34` W1)이므로 새 발견으로 등재하지 않는다.
  - 제안: 조치 불요 — 리팩터 검증 목적의 참고 기록.

- **[INFO]** 신규 `redactNodeExecutionRow` 제네릭(`<T extends {...}>`)은 런타임 비용 없음
  - 위치: `codebase/backend/src/shared/utils/redact-stored-error.ts:144-159`
  - 상세: 제네릭 타입 파라미터는 컴파일 타임에 소거되므로 함수 호출 오버헤드에 변화가 없다.
    (참고: 같은 파일 내부의 `maskIfPresent` 는 의도적으로 비-제네릭으로 유지한다는 docstring
    설명이 있고 그 설계는 유지됨.)
  - 제안: 조치 불요.

## 검증한 항목 (문제 없음)

- `background-runs.service.ts` `toNodeExecutionDto`: `redactStoredFieldsForResponse(row)` 는
  `buildPage` 의 `.map()` 안에서 페이지당 최대 `limit`(기본 50, 상한 200) 행으로 유계.
- `executions.service.ts` `getChain`: `rows.map((e) => this.toResponseExecution(e))` 는
  `RERUN_CHAIN_DEPTH_LIMIT`(32) 로 사실상 유계인 체인 조회 결과에 대해서만 동작 — 리팩터 전과
  동일한 호출 패턴.
  `toResponseExecution`/`toExecutionDto`/`stop` 경로 모두 실행 1건당 헬퍼 1회 호출로, N+1 이나
  반복문 내 추가 DB/외부 호출을 유발하지 않는다.
- `computeChainDepth`(재귀 CTE), `verifyBackgroundRunOwnership`/`verifyExecutionAccess`(단일
  raw select), `Promise.all` 병렬화(`getBackgroundRun`, `findById`) 등 이 diff 가 손대지 않은
  주변 쿼리 전략은 기존 그대로이며 diff 자체와 무관.

## 요약

이번 변경은 4곳에 흩어져 있던 동일한 3필드 마스킹 호출을 두 개의 공유 헬퍼로 통합한 순수
리팩터로, 알고리즘 복잡도·쿼리 횟수·블로킹 I/O 패턴 어느 것도 바꾸지 않는다. 유일한 실질
차이는 호출당 소형 중간 객체 하나가 늘어난 것인데, 응답 1건 또는 최대 200행/32체인 수준으로
유계된 경로에서만 발생해 성능에 미치는 영향은 무시할 수준이다. 기존에 이미 인지되고
문서화된 `findById` nodeExecutions 조회의 unbounded 특성과 그에 대한 copy-on-change 방어는
리팩터 과정에서 퇴행 없이 그대로 보존됐다.

## 위험도

NONE
