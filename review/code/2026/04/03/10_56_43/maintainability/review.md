## 유지보수성 코드 리뷰

### 발견사항

---

**[INFO]** `MAX_DEPTH` 상수의 미사용 테스트 케이스
- 위치: `resolve-nested-path.ts:6`, `resolve-nested-path.test.ts`
- 상세: `MAX_DEPTH = 10`이 정의되어 있으나 이에 대한 테스트 케이스(깊이 10 초과 경로)가 없음. 경계값 테스트 누락.
- 제안: `resolveNestedValue` 테스트에 11단계 이상의 깊은 경로에 대한 케이스 추가.

---

**[INFO]** `resolveNestedValue` 반환 타입 표기의 의미론적 불명확성
- 위치: `resolve-nested-path.ts:42`
- 상세: `unknown | null`은 `unknown`이 이미 `null`을 포함하므로 실질적으로 `unknown`과 동일함. 의도를 명확히 전달하지 못함.
- 제안: `unknown` 또는 `unknown` + JSDoc으로 null 반환 조건 명시.

```ts
// 현재
): unknown | null {

// 개선
): unknown {  // Returns null when path cannot be resolved
```

---

**[INFO]** `parsePath`에서 단일 브래킷 표기만 지원
- 위치: `resolve-nested-path.ts:27-34`, `resolve-nested-path.test.ts`
- 상세: 정규식 `^([^[]+)\[(\d+)\]$`는 `items[0][1]` 같은 중첩 브래킷을 처리하지 못함. 테스트에도 이런 케이스 없음. 지원 범위가 JSDoc에 명시되지 않음.
- 제안: JSDoc에 지원 형식의 제약을 명시하거나, 중첩 브래킷 케이스 테스트를 추가하여 동작 정의.

---

**[INFO]** `getNestedKeys`에서 배열의 첫 번째 요소만 기준으로 키를 반환
- 위치: `resolve-nested-path.ts:75-83`
- 상세: 배열의 첫 번째 요소(index 0) 기준으로만 키를 추론함. 이종 요소 배열에서 불완전한 자동완성이 발생할 수 있음. JSDoc에 "first element"라고 명시되어 있지만 테스트에서 이종 배열 케이스가 없음.
- 제안: 이종 배열 동작에 대한 테스트 케이스 추가 또는 한계 명시.

---

**[INFO]** `use-expression-suggestions.test.ts`에서 커서 위치 매직 넘버
- 위치: `use-expression-suggestions.test.ts:47, 55, 63, 70...`
- 상세: `makeSuggestions("{{ $input.body. }}", 15, ...)` 형태에서 숫자 `15`가 문자열 내 위치를 가리키는 맥락 없이 등장함. 문자열이 수정되면 숫자도 함께 수정해야 하는 암묵적 의존성.
- 제안: 상수 또는 인라인 계산식으로 의도 명시:

```ts
const value = "{{ $input.body. }}";
const cursorPos = value.indexOf(". }}") + 1; // 점 직후
const { suggestions } = makeSuggestions(value, cursorPos, { ... });
```

---

**[INFO]** `splitPathAndLeaf` JSDoc의 부정확한 예시
- 위치: `resolve-nested-path.ts:88-90`
- 상세: `"body.data." → never happens (trailing dot stripped before calling)`이라는 주석이 있으나, 테스트에는 `splitPathAndLeaf("body.")` 케이스가 실제로 존재함. 모순.
- 제안: JSDoc 주석 수정:

```ts
// "body." → { parentPath: "body", leafPrefix: "" }
```

---

**[INFO]** `use-expression-suggestions.test.ts` helper `makeSuggestions`의 위치
- 위치: `use-expression-suggestions.test.ts:6-21`
- 상세: `makeSuggestions`는 유용한 테스트 유틸리티이나 단일 파일에만 존재함. 향후 유사한 테스트 파일이 생길 경우 중복 가능성 있음.
- 제안: 현재는 단일 파일이므로 유지해도 무방하나, 테스트 파일이 늘어날 경우 `test-utils`로 분리 고려.

---

### 요약

전반적으로 코드 구조, 네이밍, 함수 분리, JSDoc 작성이 잘 되어 있으며 유지보수성이 높은 편입니다. 주요 개선 포인트는 테스트 코드에서의 매직 넘버(커서 위치 하드코딩)로, 문자열 변경 시 위치값을 함께 수정해야 하는 암묵적 의존성을 만들어 테스트 유지보수 비용을 높입니다. 또한 `splitPathAndLeaf` JSDoc과 실제 테스트 케이스 간의 모순, `MAX_DEPTH` 경계값 테스트 누락, `unknown | null` 타입 표현의 의미론적 모호성 등 소소한 불일치가 있습니다. Critical/Warning 수준의 이슈는 없습니다.

### 위험도

**LOW**