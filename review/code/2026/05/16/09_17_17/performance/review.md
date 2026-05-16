# 성능(Performance) 리뷰

## 발견사항

- **[INFO]** `objectsEqual` 이 매 렌더마다 무조건 실행됨
  - 위치: `integration-configs.tsx` — `Cafe24Config` 함수 본체, `externalFields` 계산 직후 (렌더 경로)
  - 상세: `objectsEqual(externalFields, lastPropagated)` 는 컴포넌트가 렌더될 때마다 호출된다. `Object.keys` 를 두 번 호출하고 모든 키를 순회하므로 O(n) 이다. `config.fields` 의 키 수가 수십 개 이하인 일반적인 UI 사용 패턴에서는 실제 비용이 미미하지만, 이 비교 자체가 렌더 결과에 영향을 줄 `useState` setter 호출을 유발할 수 있는 분기 조건이라는 점에서 최적화 여지가 있다. `useMemo` 를 써서 `externalFields` 의 참조나 직렬화 결과가 실제로 달라졌을 때만 비교를 수행하면 렌더 비용을 줄일 수 있다.
  - 제안: `config.fields` 를 `useMemo` 로 안정화(stable reference)하거나, `objectsEqual` 호출을 `useEffect` + ref 패턴으로 이동해 렌더 함수 본체에서 제거하는 것을 고려한다. 단, 현재 React "derived-state update during render" 패턴 자체가 의도된 것이므로 변경 시에는 동일한 동작 보장이 전제되어야 한다.

- **[INFO]** `normalizeCafe24Fields` 가 매 외부 변경마다 두 번 호출될 수 있음
  - 위치: `integration-configs.tsx` — `objectsEqual` 분기 내부 (라인 352–354)
  - 상세: 외부 리셋(undo/redo) 발생 시 `normalizeCafe24Fields(externalFields)` 로 `nextRows` 를 만들고, 곧바로 `fieldRowsToObject(nextRows)` 로 다시 object 로 변환한다. `normalizeCafe24Fields` → `fieldRowsToObject` 의 왕복은 `externalFields` 를 그대로 `lastPropagated` 에 저장하면 생략 가능하다. `fieldRowsToObject(normalizeCafe24Fields(obj))` 의 결과는 `obj` 의 빈 키를 제거한 것과 동일하므로, `lastPropagated` 에는 `normalizeCafe24Fields` 를 거치지 않고 `externalFields` 자체(또는 빈 키 제거 결과)를 저장해도 된다.
  - 제안: `setLastPropagated(externalFields)` 처럼 변환 단계를 줄이는 것을 검토한다. 단, `normalizeCafe24Fields` 가 배열 형태의 `fields` 도 처리하는 코드 경로가 있으므로, 해당 경로에서의 동작 일관성을 먼저 확인한다.

- **[INFO]** `handleFieldRowsChange` 에서 `fieldRowsToObject` 가 두 번 실행될 가능성
  - 위치: `integration-configs.tsx` — `handleFieldRowsChange` 함수 (라인 357–364)
  - 상세: `handleFieldRowsChange` 는 `fieldRowsToObject(items)` 를 계산해 `obj` 를 만들고 이를 `setLastPropagated` 와 `onChange` 모두에 넘긴다. 이 자체는 1회 계산이므로 중복 없이 올바르다. 그러나 React의 Strict Mode 또는 Concurrent Mode 에서 같은 state setter 가 두 번 호출되는 경우 함수가 두 번 실행될 수 있다. `fieldRowsToObject` 는 순수 함수이므로 멱등성은 보장되지만, `items` 가 대규모일 경우 비용이 중복될 수 있다.
  - 제안: 현재 사용 규모(Cafe24 Fields 의 키 수)에서는 실질적 문제가 없다. 문제가 될 경우 `useCallback` 으로 함수를 메모이제이션하되, 의존 배열에 `config` 와 `onChange` 를 포함해야 한다.

- **[INFO]** 테스트 파일에서 `Array.from(row.querySelectorAll("button"))` 를 통한 DOM 순회
  - 위치: `cafe24-config.test.tsx` — "removes a row" 테스트, 라인 213–216
  - 상세: 테스트 코드에서 `querySelectorAll("button")` 로 모든 버튼을 수집한 후 마지막 요소를 선택하는 방식은 DOM 구조 변경에 취약하고, 버튼 수가 많을 경우 불필요한 노드를 모두 적재한다. 프로덕션 성능에는 영향 없지만 테스트 안정성 관점에서 `aria-label` 또는 `data-testid` 기반 쿼리가 권장된다.
  - 제안: 삭제 버튼에 `data-testid="remove-field-row"` 또는 `aria-label` 을 추가하고 테스트에서 해당 속성으로 직접 조회한다.

## 요약

이번 변경의 핵심인 `useState` 기반 로컬 편집 버퍼 도입은 성능 관점에서 전반적으로 적절하다. `objectsEqual` 이 매 렌더마다 실행된다는 점이 가장 주목할 부분이지만, Cafe24 Fields 의 실제 사용 패턴(키 수 수십 개 이하)에서 O(n) 선형 비교는 무시할 수준의 비용이다. 메모리 할당 측면에서도 `fieldRowsToObject` 와 `normalizeCafe24Fields` 가 각각 소규모 객체를 생성하는 데 그치며, N+1 호출·블로킹 I/O·대규모 데이터 적재 같은 구조적 성능 위협은 없다. 발견된 모든 항목이 INFO 수준이며 현 규모에서 실질적 성능 저하를 유발하지 않는다.

## 위험도

NONE
