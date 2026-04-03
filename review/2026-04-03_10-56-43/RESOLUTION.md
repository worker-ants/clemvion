# Code Review Resolution

## WARNING 조치

### 1. falsy 값 테스트 추가
- `resolve-nested-path.test.ts`에 `0`, `false`, `""` falsy 값 보존 테스트 3건 추가
- `resolveNestedValue`가 `??` 연산자를 사용하여 falsy 값을 올바르게 반환하는 것을 검증

### 2. 커서 위치 매직 넘버 제거
- `use-expression-suggestions.test.ts`에 `cursorAfterExpr()` 헬퍼 함수 도입
- 모든 테스트에서 하드코딩된 커서 위치를 동적 계산으로 교체
- 표현식 문자열 변경 시 자동으로 올바른 위치 계산

## INFO 조치

### 3. splitPathAndLeaf JSDoc 수정
- `"body.data." → never happens` 주석을 실제 동작에 맞는 예시로 교체
- `"body." → { parentPath: "body", leafPrefix: "" }` 및 bracket 예시 추가

### 4. resolveNestedValue 반환 타입 정리
- `unknown | null` → `unknown`으로 단순화 (unknown이 null을 포함)
- null 반환 조건을 JSDoc에 명시

### 5. MAX_DEPTH 경계 테스트 추가
- 11단계 깊이 경로에서 `null` 반환을 검증하는 테스트 추가

### 6. 정규식 상수 추출
- `BRACKET_SEGMENT_RE`, `INDEX_SEGMENT_RE`를 모듈 스코프 상수로 분리
- 의도 명확화 및 JSDoc 주석 추가

### 7. bracket 경로 테스트 추가
- `splitPathAndLeaf("items[0].name")` 케이스 테스트 추가

### 8. 배열 isExpandable 테스트 추가
- 배열 필드의 `isExpandable: true` 동작 검증 테스트 추가

### 9. $node tokenStart 테스트 추가
- `$node` 중첩 경로에 대한 `tokenStart`/`tokenEnd` 위치 검증 테스트 추가

### 10. parsePath JSDoc 보강
- 단일 숫자 브래킷만 지원함을 명시하는 JSDoc 추가

### 11. 이종 배열 한계
- `getNestedKeys`의 배열 처리가 첫 번째 요소 기준인 것은 현재 설계상 의도된 동작이며, 실제 워크플로우 데이터에서 이종 배열은 발생하지 않으므로 JSDoc 주석으로 한계를 문서화하는 수준으로 유지

## 미조치 사유

### __proto__ / constructor 키 차단
- 읽기 전용 내부 데이터에 대한 자동완성이므로 실질 위험 없음 (JSON 직렬화된 실행 결과)
- 불필요한 방어 코드 추가보다 현재 수준이 적절

### Object.keys 너비 제한
- 자동완성 드롭다운에서 최대 20개만 표시되므로 UI 레벨에서 이미 제한됨
