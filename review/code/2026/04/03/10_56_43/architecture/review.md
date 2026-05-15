### 발견사항

- **[INFO]** `resolve-nested-path.ts`의 단일 책임 원칙 준수
  - 위치: `resolve-nested-path.ts` 전체
  - 상세: 경로 파싱(`parsePath`), 값 해석(`resolveNestedValue`), 키 열거(`getNestedKeys`), 경로 분리(`splitPathAndLeaf`)의 4가지 역할이 하나의 파일에 있으나, 모두 "중첩 경로 해석"이라는 단일 도메인에 속하며 응집도가 높음. 적절한 분리 수준.

- **[INFO]** `parsePath`의 제한적인 브래킷 표기 지원
  - 위치: `resolve-nested-path.ts:28-37`
  - 상세: `^([^[]+)\[(\d+)\]$` 패턴은 `items[0]` 형태만 처리하며, `items[0][1]` 같은 다차원 배열 또는 `items[key]` 같은 문자열 키 브래킷 접근은 처리하지 못함. 현재 사용 범위에서는 문제 없으나, 향후 확장 시 제약.
  - 제안: 주석에 지원 범위를 명시하거나, 범용 파서로 교체 시의 확장 지점을 문서화.

- **[INFO]** `getNestedKeys`의 배열 대표값 전략 명시 필요
  - 위치: `resolve-nested-path.ts:79-88`
  - 상세: 배열의 경우 항상 `[0]` 인덱스의 스키마를 사용. 이종 배열(heterogeneous array)에서는 첫 번째 원소가 전체 스키마를 대표하지 못할 수 있음. 현재 사용 컨텍스트(자동완성 힌트)에서는 허용 가능한 트레이드오프이나 설계 의도가 코드에 드러나지 않음.
  - 제안: 함수 JSDoc에 "배열은 첫 번째 원소의 스키마를 사용" 명시 (이미 일부 있으나 이종 배열 한계 미언급).

- **[INFO]** `MAX_DEPTH` 상수의 적용 범위 불일치
  - 위치: `resolve-nested-path.ts:6, 46`
  - 상세: `MAX_DEPTH`는 `resolveNestedValue`에만 적용되고 `getNestedKeys`는 내부적으로 `resolveNestedValue`를 호출하므로 간접 보호됨. 그러나 `parsePath`는 무제한 파싱 가능하며, 매우 긴 경로 문자열에 대한 입력 검증이 없음.
  - 제안: `parsePath`에도 길이 제한 가드 추가 고려, 또는 `MAX_DEPTH` 검사를 `parsePath` 반환 후로 통합.

- **[INFO]** 테스트에서 `splitPathAndLeaf("body.")` 케이스 처리
  - 위치: `resolve-nested-path.test.ts:165-171`
  - 상세: JSDoc 주석에서 `"body.data." → never happens (trailing dot stripped before calling)`라고 명시했으나, 테스트에서는 `splitPathAndLeaf("body.")` 케이스를 직접 검증함. 계약(contract)과 테스트가 불일치.
  - 제안: JSDoc 주석을 수정하거나, 해당 케이스가 실제로 발생 가능하다면 주석의 단언을 제거.

- **[INFO]** `use-expression-suggestions.test.ts`의 통합 수준 테스트
  - 위치: `use-expression-suggestions.test.ts` 전체
  - 상세: 훅의 내부 동작을 커서 위치 기반의 문자열 파싱부터 제안 필터링까지 end-to-end로 검증하는 구조. 유닛 테스트 성격과 통합 테스트 성격이 혼재하며, `makeSuggestions` 헬퍼가 커서 위치를 수동으로 계산해 넘기는 방식은 취약함 (문자열 변경 시 숫자를 직접 업데이트해야 함).
  - 제안: 커서 위치를 문자열 내 마커(`|` 등)로 표현하는 헬퍼 함수 패턴 도입 고려. 예: `"{{ $input.body.da| }}"`.

---

### 요약

`resolve-nested-path.ts`는 단일 도메인("중첩 경로 해석")에 집중된 순수 함수들로 구성되어 응집도가 높고 외부 의존성이 없는 깔끔한 유틸리티 모듈이다. 레이어 경계 위반이나 순환 의존성 없이 잘 분리되어 있으며, `getNestedKeys` → `resolveNestedValue` → `parsePath`의 계층적 호출 구조도 명확하다. 다만 브래킷 표기의 지원 범위 제한, 이종 배열 처리 전략의 암묵성, JSDoc 계약과 테스트 케이스 간 불일치, 통합 테스트에서 하드코딩된 커서 위치 등이 장기 유지보수에서 혼란을 줄 수 있는 소소한 설계 gap이다. 전반적으로 아키텍처 리스크는 낮다.

### 위험도

**LOW**