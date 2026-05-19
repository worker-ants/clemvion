# 성능(Performance) 리뷰

## 발견사항

- **[INFO]** `matchesRequired` — `Array.isArray` + `includes` 분기의 복잡도는 O(n) (whitelist 크기 기준)
  - 위치: `codebase/frontend/src/components/editor/settings-panel/auto-form/visibility.ts` — `matchesRequired` 함수 (신규 추가 라인 916–921)
  - 상세: whitelist(`equals` 가 배열인 경우) 에 대해 `Array.prototype.includes` 를 사용한다. 현재 실제 사용처(`switch.switchValue`)는 배열 크기가 `['value']` 1개이므로 사실상 O(1)이다. 일반적으로도 `requiredWhen` whitelist 는 mode enum 값 수 이하로 한정되므로 실용상 문제없다. 다만, 이 함수는 React 렌더링 사이클 내 form 필드마다 호출될 가능성이 있다. 필드 수 × 렌더링 빈도를 감안해도 배열 크기가 크지 않아 누적 오버헤드는 무시 가능 수준이다.
  - 제안: 현재 설계로 충분하다. whitelist 항목이 5개를 초과하는 케이스가 생기면 `Set` 으로 전환해 `O(1)` 조회를 보장하는 것을 고려할 수 있다.

- **[INFO]** `uiMeta` 헬퍼 — 테스트마다 `z.toJSONSchema(schema)` 전체 직렬화 반복 호출
  - 위치: `codebase/backend/src/nodes/logic/logic-ui-required.spec.ts` — `uiMeta` 함수 (431–434 라인)
  - 상세: `it.each` 루프의 10개 케이스와 별도 `it` 케이스마다 `z.toJSONSchema(schema)` 가 매번 호출된다. 스키마 직렬화는 idempotent 하므로 중복 연산이다. 테스트 파일이므로 프로덕션 런타임 성능에는 무관하지만, 동일 스키마를 여러 키에 대해 반복 직렬화하면 테스트 실행 시간에 미세하게 영향을 줄 수 있다.
  - 제안: 지금 규모(10개 케이스)에서는 허용 범위이다. 향후 케이스가 30개 이상으로 늘어날 경우 스키마별로 직렬화 결과를 `beforeAll` 에서 캐싱하거나, `uiMeta` 에 `Map` 기반 메모이제이션을 추가하는 것을 검토한다.

- **[INFO]** 타입 단순화로 `matchesVisible` 내 dead branch 발생 가능성 없음 — 확인
  - 위치: `codebase/frontend/src/components/editor/settings-panel/auto-form/visibility.ts` — `matchesVisible` 함수 (964–969 라인)
  - 상세: 기존 `matches` 함수가 `matchesVisible` 로 이름이 바뀌었고 로직은 그대로다. `requiredWhen` 은 단일 shape `{ field, equals }` 로 축소되어 `matchesRequired` 로 완전히 분리되었으므로, `matchesVisible` 안에 `requiredWhen` 관련 오분기가 유입될 여지가 없다. 두 함수의 책임이 명확히 분리된 것은 향후 `visibleWhen` 확장 시 `matchesRequired` 에 영향을 주지 않는 구조적 장점이다.
  - 제안: 현행 유지.

## 요약

이번 변경은 `requiredWhen` DSL을 3-shape 유니온(`equals` | `notEquals` | `oneOf`)에서 단일 shape `{ field, equals }` (스칼라 또는 배열 화이트리스트)로 통일한 타입 정리 PR이다. 성능 관점에서 신규 도입된 `matchesRequired` 함수는 `Array.isArray` + `includes` 분기로 실용상 O(1)에 가까운 연산을 수행하며, 실제 whitelist 크기가 enum 값 수에 한정되는 특성상 렌더링 경로 내 누적 오버헤드가 발생하지 않는다. 테스트 파일의 반복 직렬화 패턴은 규모가 작아 무시 가능 수준이다. 전반적으로 성능 위험도가 없는 변경으로 판단된다.

## 위험도

NONE
