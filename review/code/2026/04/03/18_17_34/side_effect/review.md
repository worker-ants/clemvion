## 부작용(Side Effect) 코드 리뷰

### 발견사항

---

**[INFO]** `not_contains` 연산자의 비대칭 기본값 동작
- 위치: `filter.handler.ts` — `evaluateCondition` 내 `not_contains` case
- 상세: `contains`는 필드 또는 비교값이 string이 아닐 때 `false`를 반환하지만, `not_contains`는 동일 상황에서 `true`를 반환합니다. 비교 불가능한 타입의 아이템이 `not_contains` 조건을 통과(match)하는 의도치 않은 필터링 부작용이 발생합니다.
- 제안: 타입 불일치 시 `false` 반환으로 통일하거나, 이 동작이 의도된 것이라면 테스트로 명시

```typescript
case 'not_contains':
  return typeof fieldValue === 'string' && typeof compareValue === 'string'
    ? !fieldValue.includes(compareValue)
    : false; // contains와 대칭
```

---

**[INFO]** `regex` 연산자의 매 실행마다 `RegExp` 객체 생성
- 위치: `filter.handler.ts` — `evaluateCondition` 내 `regex` case
- 상세: 대규모 배열 필터링 시, 동일한 정규식 패턴으로 아이템마다 `new RegExp(...)` 호출이 반복됩니다. 성능 부작용이 있으나, 현재 아키텍처상 캐싱 없이 매번 생성됩니다. 기능적 부작용은 없지만 잠재적 성능 저하 요소입니다.
- 제안: `execute` 메서드 진입 시점에 조건별 `RegExp`를 사전 컴파일하여 전달

---

**[INFO]** `is_empty` 테스트의 `undefined` 필드 처리 미검증
- 위치: `filter.handler.spec.ts` — `is_empty` 테스트
- 상세: 테스트는 `null`과 빈 배열만 검증합니다. 구현은 `undefined`(필드 자체가 없는 경우)도 `is_empty === true`로 처리하지만, 이에 대한 테스트 케이스가 없습니다. `is_null`과의 의미론적 구분이 테스트에서 불명확합니다.
- 제안: `is_empty`에서 undefined 처리 케이스 테스트 추가

---

**[INFO]** `is_not_empty` — 빈 문자열(`''`) 처리 테스트 누락
- 위치: `filter.handler.spec.ts` — `is_not_empty` 테스트
- 상세: 구현은 `fieldValue !== ''`을 체크하지만 테스트는 빈 문자열 케이스를 다루지 않아 경계 동작 보장 없음
- 제안: `{ name: '' }` 케이스를 `is_empty`/`is_not_empty` 테스트에 추가

---

### 요약

`FilterHandler`는 전역 상태 변경, 파일시스템 접근, 네트워크 호출, 환경 변수 접근이 전혀 없으며, 입력 배열을 원본 변경 없이 새 배열에 분류하는 순수한 함수적 구현입니다. 공개 인터페이스(`NodeHandler`)를 올바르게 구현하고 있어 기존 호출자에 대한 호환성 파괴도 없습니다. 주요 부작용 위험은 `not_contains`의 타입 불일치 시 비대칭 `true` 반환으로, 비교 불가능한 타입의 아이템이 의도치 않게 match 결과에 포함될 수 있습니다. 나머지는 테스트 커버리지 보완이 권장되는 INFO 수준 사항입니다.

### 위험도

**LOW**