## 성능 코드 리뷰

### 발견사항

**[INFO] `parsePath` 내 정규식 반복 컴파일**
- 위치: `resolve-nested-path.ts` — `parsePath` 함수 내 루프
- 상세: `/^([^[]+)\[(\d+)\]$/` 정규식이 루프 내에서 매번 `part.match()`를 통해 평가됨. JS 엔진이 리터럴 정규식을 내부적으로 캐싱하므로 실질적 오버헤드는 미미하나, 명시적 상수로 분리하면 의도가 명확해짐.
- 제안: 모듈 스코프 상수로 추출 (`const BRACKET_RE = /^([^[]+)\[(\d+)\]$/`)

**[INFO] `resolveNestedValue` 내 정규식 반복 평가**
- 위치: `resolve-nested-path.ts` — `resolveNestedValue` 루프 내 `segment.match(/^\[(\d+)\]$/)`
- 상세: 경로 세그먼트마다 정규식 매칭 수행. 경로 깊이가 MAX_DEPTH(10)로 제한되어 있어 절대적 성능 영향은 낮지만, 위와 동일하게 상수 분리가 권장됨.
- 제안: `const INDEX_RE = /^\[(\d+)\]$/` 모듈 상수로 추출

**[INFO] `getNestedKeys`의 `Object.keys` + `map` 체인**
- 위치: `resolve-nested-path.ts` — `getNestedKeys` 함수
- 상세: `Object.keys(obj).map(...)` 패턴은 중간 배열을 한 번 생성함. 실제 데이터는 API 응답 샘플 객체이므로 키 수가 수십 개 이하일 것으로 예상되어 현실적 성능 영향은 없음.
- 제안: 현 구조 유지. 만약 수백 개 이상 키를 다룰 가능성이 생기면 단일 `reduce`로 대체 가능.

**[INFO] 테스트 내 `describe` 스코프 공유 객체의 불변성**
- 위치: `resolve-nested-path.test.ts`, `use-expression-suggestions.test.ts` — `describe` 블록 내 `const sample`, `const inputSample`
- 상세: 테스트 간 공유되는 객체 참조가 변이(mutation)될 경우 테스트 오염 발생 가능. 현재 구현 함수들은 입력을 변경하지 않으므로 실제 문제는 없으나, 방어적으로 `Object.freeze` 또는 `beforeEach` 내 복사본 생성을 고려할 수 있음.
- 제안: 현 수준에서 허용 가능. 필요시 `Object.freeze(sample)` 적용.

**[INFO] `useExpressionSuggestions` 훅의 메모이제이션 불확실성**
- 위치: `use-expression-suggestions.test.ts` — `renderHook` 호출
- 상세: 테스트에서 `renderHook`을 매 케이스마다 새로 생성하므로 훅 내부 `useMemo`/`useCallback` 최적화가 테스트에서는 동작하지 않음. 훅 구현체에 메모이제이션이 없다면 `value`, `cursorPos` 변경 시 매 렌더마다 완전 재계산이 일어남.
- 제안: 훅 구현에서 `useMemo`로 suggestions 계산 결과를 캐싱하고 있는지 확인 권장. 테스트 자체에는 수정 불필요.

---

### 요약

대상 코드는 자동완성 제안을 위한 경량 유틸리티로, MAX_DEPTH=10 제한과 소규모 샘플 데이터를 전제하고 있어 성능상 실질적 위험은 없음. 주요 관찰 사항은 모두 INFO 수준으로, 루프 내 정규식 리터럴을 모듈 상수로 추출하는 소규모 정리와 훅 레이어에서의 `useMemo` 적용 여부 확인이 권장됨. 알고리즘 복잡도는 O(depth)로 적절하며, 메모리 할당·I/O·N+1 쿼리 등의 중대 이슈는 발견되지 않음.

### 위험도

**LOW**