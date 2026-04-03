## 리뷰 결과

### 발견사항

**[INFO]** `parsePath`의 trailing dot 처리 불일치
- 위치: `resolve-nested-path.ts` `parsePath` 함수, `splitPathAndLeaf` JSDoc 주석
- 상세: `parsePath`는 빈 segment를 `continue`로 건너뜀 (`if (!part) continue`) — 따라서 `"body."` 입력 시 `["body"]`만 반환. 반면 `splitPathAndLeaf`의 JSDoc에는 `"body.data."` → never happens 라고 적혀있지만, 실제로 `splitPathAndLeaf("body.")` 테스트 케이스가 존재하고 `{ parentPath: "body", leafPrefix: "" }` 를 기대함. 두 함수 간 trailing dot 처리 계약이 암묵적으로 다름.
- 제안: JSDoc 주석을 수정하거나, `parsePath`에서 trailing dot 동작을 명시적으로 문서화

**[INFO]** `resolveNestedValue` 반환 타입 과도한 선언
- 위치: `resolve-nested-path.ts` L39 — `unknown | null`
- 상세: `unknown | null`은 `unknown`과 동일 (`null extends unknown`). 의미는 전달되지만 타입 정확도는 없음. 호출자 측 부작용은 없으나 타입 계약이 모호함.
- 제안: `unknown` 단독 또는 명시적 union 타입 사용

**[INFO]** `getNestedKeys`에서 배열의 첫 번째 요소만 사용
- 위치: `resolve-nested-path.ts` L78-86
- 상세: 배열이 heterogeneous할 경우 (요소마다 key가 다를 경우) 첫 번째 요소만 기준으로 key 목록을 반환. 현재 테스트는 homogeneous 배열만 검증. 이는 의도된 설계이나 autocomplete 시 일부 key가 누락될 수 있음.
- 제안: 현재 구현이 MVP 범위로 적절하다면 JSDoc에 명시적으로 "첫 번째 요소 기준" 동작을 기록

**[INFO]** `use-expression-suggestions.test.ts` — `renderHook` 환경 의존
- 위치: `use-expression-suggestions.test.ts` L19-22
- 상세: `renderHook`은 React 환경을 요구. 현재 테스트에는 wrapper 없이 호출되는데, `useExpressionSuggestions`이 내부적으로 다른 React context를 소비한다면 silently undefined가 될 수 있음. 테스트는 `defaultData`를 직접 주입하지만, hook 내부에서 context를 별도로 읽는 경우 부작용 가능.
- 제안: hook 구현에서 context 소비 경로를 확인하고, 필요 시 wrapper 추가

---

### 요약

세 파일 모두 순수 유틸리티 함수와 단위 테스트로 구성되어 있어 전역 상태 변경, 파일시스템 접근, 네트워크 호출, 환경 변수 읽기/쓰기 등의 실질적인 부작용은 없음. 공개 API 시그니처도 신규 추가이므로 기존 호출자에 대한 파괴적 변경 없음. 발견된 사항은 모두 문서 불일치 및 타입 명확성 수준의 경미한 이슈이며, 런타임 동작에는 영향 없음.

### 위험도

**LOW**