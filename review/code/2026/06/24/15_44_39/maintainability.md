# 유지보수성(Maintainability) 리뷰 결과

리뷰 대상 커밋: `ecd70dd` — M-4 park-진입 dispatch 를 ParkEntryDispatch registry 로 추출

---

## 발견사항

### [INFO] `dispatchParkEntry` 반환 타입이 실제 계약을 완전히 표현하지 않음
- 위치: `execution-engine.service.ts` — `dispatchParkEntry` 시그니처 (diff 라인 198–211)
- 상세: 선언된 반환 타입은 `Promise<ProcessTurnResult>` 이지만 핸들러가 없을 때 `undefined` 를 반환한다. `ProcessTurnResult` 가 `undefined` 를 포함하는 타입이라면 문제 없으나, 호출측 세 곳이 모두 `=== PARK_RELEASED` 비교로 처리하므로 계약상 `undefined` 반환은 "park 분기 없음" 이라는 의미적으로 중요한 결과다. JSDoc 에 "`undefined` = park 진입 분기 없음" 을 명시해 두었으나 시그니처 레벨에서 `Promise<ProcessTurnResult | undefined>` 또는 명시적 sentinel 타입으로 표현하면 타입 체커가 누락 핸들 케이스를 감지할 수 있다.
- 제안: 반환 타입을 `Promise<ProcessTurnResult | undefined>` 로 명시하거나, `ProcessTurnResult` 의 정의에 `undefined` 가 포함되어 있음을 JSDoc 에 cross-reference 로 연결한다. 현재 상태는 런타임 안전이지만 타입 정보의 표현력이 낮다.

### [INFO] `parkEntryRegistry` getter JSDoc 에 "신규 blocking 타입 추가 방법" 은 `park-entry-dispatch.ts` 에도 중복 설명됨
- 위치: `execution-engine.service.ts` — `parkEntryRegistry` getter 주석 (diff 라인 153–158) / `park-entry-dispatch.ts` — `ParkEntryDispatch` 인터페이스 주석
- 상세: "신규 blocking 노드 타입은 `park-entry-dispatch.ts` 의 factory 에 항목 1줄 추가"라는 가이드가 service getter 주석에 있고, `park-entry-dispatch.ts` 의 `ParkEntryDispatch` 인터페이스 주석에도 동일한 의미의 설명이 있다. 확장 방법에 대한 단일 진실 원칙을 위해 factory 파일을 SoT 로 두고 service 주석은 참조만 하는 방향이 낫다. 현재 중복 수준은 경미하다.
- 제안: service getter JSDoc 에서 확장 방법 설명을 제거하고 `park-entry-dispatch.ts` 로의 참조만 남긴다. 또는 두 주석을 현재처럼 유지하되 향후 변경 시 양쪽을 모두 갱신해야 함을 인지한다.

### [INFO] 테스트에서 인덱스 기반 배열 접근으로 순서 변경 취약성 존재
- 위치: `park-entry-dispatch.spec.ts` 라인 1272(`buildParkEntryRegistry(deps)[1]`), 1288(`buildParkEntryRegistry(deps)[2]`)
- 상세: "buttons" 항목을 `[1]`, "ai_conversation" 항목을 `[2]` 로 직접 인덱싱한다. 이는 순서 테스트를 별도로 수행하는 `it('orders entries...')` 와 분리되어 있어 순서가 변경될 경우 해당 테스트들이 잘못된 항목을 검증하게 된다. `kind` 필드로 찾아서 검증하면 순서와 무관하게 각 항목의 selector 술어를 독립적으로 검증할 수 있다.
- 제안: `buildParkEntryRegistry(deps).find(h => h.kind === 'buttons')` 패턴으로 교체하여 인덱스 하드코딩 제거. 단, 순서 자체는 별도 테스트가 이미 커버하고 있어 현재 구조도 의도를 읽을 수 있다.

---

## 요약

M-4 리팩터링은 세 곳에 분산되어 있던 form/buttons/ai park-진입 분기 중복을 `ParkEntryDispatch` registry 패턴으로 일원화하는 behavior-preserving 추출이다. `park-entry-dispatch.ts` 의 factory 분리, 인터페이스 설계, JSDoc 품질, 테스트 커버리지 모두 기존 `resume-turn-dispatch` 대칭 패턴을 충실히 따르고 있어 전반적으로 유지보수성이 높다. 발견된 사항들은 타입 정확성(반환 타입의 `undefined` 표현), 주석 중복(경미), 테스트의 인덱스 하드코딩(경미) 수준이며, 이 중 어느 것도 동작 또는 유지보수에 즉각적인 위험을 초래하지 않는다. 특히 `dispatchParkEntry` 의 `undefined` 반환이 타입 시그니처와 실제 동작 간 작은 간극을 만든다는 점이 향후 소비 코드 작성 시 혼동 소지가 있으므로 타입 명시화를 권장한다.

---

## 위험도

NONE
