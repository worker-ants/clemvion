## Scope 리뷰

### 발견사항

- **[INFO]** `Condition` 인터페이스의 `field: string → field: unknown` 변경이 공유 유틸(`_shared/condition-eval.util.ts`)에 적용됨
  - 위치: `condition-eval.util.ts:38`
  - 상세: 이 변경은 Filter 핸들러뿐 아니라 동일 `Condition` 타입을 사용하는 if-else 등 다른 로직 노드에도 영향을 줌. `evaluateCondition`의 sentinel 분기(빈 문자열, `$item`, 비-문자열 → item 자체) 또한 모든 호출자에 적용됨. 계획 문서에는 if-else 등 다른 노드에 대한 언급 없음.
  - 제안: 실질적으로 backward-compatible하고 기존 동작을 깨뜨리지 않으므로 허용 가능하나, 의도적 공유 변경임을 커밋 메시지나 코멘트로 명시하면 이력 추적에 유리함.

- **[INFO]** `resolveIfExpression` 평가 실패 시 plan 문서(`→ undefined fallback`)와 구현(`return null`) 사이에 값 불일치
  - 위치: `filter.handler.ts:165` (resolveIfExpression catch 블록)
  - 상세: plan step 2는 "평가 실패 → `undefined`"라고 명시했으나 실제 구현은 `null` 반환. 비교 연산자(eq/neq/gt 등)에서 `null`과 `undefined`의 처리 결과가 다를 수 있음. `is_null` 연산자의 경우 `null`은 true, `undefined`도 true이므로 실용적으로는 동일하나, 엄격 비교 모드에서 `null === 1`은 false로 의도한 동작(unmatched)에 부합함.
  - 제안: plan 문서와의 용어 정합성을 위해 plan 또는 코드 중 하나를 정렬. 동작 자체는 `null` 반환이 오히려 더 명확.

- **[INFO]** `evalOne` 내 stub Condition 패턴
  - 위치: `filter.handler.ts:110-120`
  - 상세: `fieldValue`를 `item` 인자에, `field: ''`인 stub을 넘겨 sentinel 분기를 강제로 타는 간접 패턴. `evaluateCondition`의 시그니처를 변경하지 않기 위한 의도적 선택으로 보이며 scope 내 결정이나, 가독성 측면에서 약간의 cognitive overhead 발생.
  - 제안: 현 범위에서 수용 가능. 향후 `evaluateCondition`에 `fieldValue` 직접 수용 오버로드 추가를 고려할 수 있으나 이번 작업 범위 밖.

### 요약

6개 파일의 변경이 모두 plan 문서(`filter-conditions-expression-binding.md`)에 명시된 결정 B(per-item resolution)와 결정 C(item-self sentinel), 그리고 regex 캐시 재설계 범위 안에 있다. 불필요한 리팩토링, 무관한 파일 수정, 미사용 임포트, 의미 없는 포맷팅 변경은 발견되지 않았다. 유일한 잠재적 scope 이슈는 공유 `Condition` 인터페이스의 타입 확장이 Filter 외 다른 노드에 무언의 영향을 주는 점이나, 동작은 backward-compatible하고 의도적으로 설계된 것으로 판단된다.

### 위험도

**LOW**