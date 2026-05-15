## 발견사항

### resolve-nested-path.test.ts

- **[INFO]** `parsePath` - 브라켓 표기법 엣지 케이스 미커버
  - 위치: `parsePath` describe 블록
  - 상세: `items[0][1]` (중첩 브라켓), `items[abc]` (비정수 인덱스), `[0].name` (선행 브라켓) 같은 비정상 입력 테스트 없음
  - 제안: 비정상/예외 패턴에 대한 `parsePath` 동작 명세 테스트 추가

- **[INFO]** `resolveNestedValue` - `MAX_DEPTH` 경계 테스트 없음
  - 위치: `resolveNestedValue` describe 블록
  - 상세: `MAX_DEPTH = 10`이 소스에 존재하지만, depth=10 경계 및 depth=11 초과 케이스를 검증하는 테스트가 없음
  - 제안:
    ```ts
    it("returns null for path exceeding max depth", () => {
      const deep = { a: { b: { c: { d: { e: { f: { g: { h: { i: { j: { k: "deep" } } } } } } } } } } };
      expect(resolveNestedValue(deep, "a.b.c.d.e.f.g.h.i.j.k")).toBeNull();
    });
    ```

- **[INFO]** `resolveNestedValue` - 숫자/불리언 등 비객체 루트 입력 미커버
  - 위치: `resolveNestedValue` describe 블록
  - 상세: 함수 시그니처는 `Record<string, unknown>`을 받지만, `value=0`, `value=false` 같은 falsy 정상값의 반환 동작이 테스트되지 않음 (`current ?? null` 로직에서 `0`, `false`, `""` 반환 시 `null`로 오판될 수 있음)
  - 제안:
    ```ts
    it("returns 0 for numeric field (not null)", () => {
      expect(resolveNestedValue({ count: 0 }, "count")).toBe(0);
    });
    it("returns false for boolean field (not null)", () => {
      expect(resolveNestedValue({ flag: false }, "flag")).toBe(false);
    });
    it("returns empty string (not null)", () => {
      expect(resolveNestedValue({ name: "" }, "name")).toBe("");
    });
    ```

- **[WARNING]** `current ?? null` — falsy 값 버그가 테스트로 발견되지 않음
  - 위치: `resolve-nested-path.ts:59`, `resolveNestedValue` 구현
  - 상세: `??`는 `null`/`undefined`만 걸러내므로 `0`, `false`, `""` 반환은 정상이지만, 현재 테스트 데이터에 이러한 케이스가 없어 잠재 회귀를 감지할 수 없음. 버그는 아니지만 테스트 부재가 실수를 `||`로 바꿀 경우 방어막이 없음
  - 제안: 위 INFO 항목의 falsy 값 테스트 추가

- **[INFO]** `getNestedKeys` - 혼합 배열(객체+원시) 미커버
  - 위치: `getNestedKeys` describe 블록
  - 상세: `[{id:1}, "string", 2]` 같이 첫 번째 요소가 객체지만 이후 요소가 원시인 배열, 또는 첫 번째 요소가 원시인 배열에 대한 동작 미검증
  - 제안: 첫 번째 요소가 원시인 배열(`primitiveArray`) 테스트는 있으나, 첫 요소가 객체이고 나머지가 원시인 혼합 배열 케이스 추가

- **[INFO]** `splitPathAndLeaf` - 브라켓이 포함된 경로 미커버
  - 위치: `splitPathAndLeaf` describe 블록
  - 상세: `items[0].name` 형태의 경로에서 `splitPathAndLeaf` 동작이 테스트되지 않음. 실제 사용 흐름에서 중요한 케이스
  - 제안:
    ```ts
    it("handles bracket in path", () => {
      expect(splitPathAndLeaf("items[0].name")).toEqual({
        parentPath: "items[0]",
        leafPrefix: "name",
      });
    });
    ```

---

### use-expression-suggestions.test.ts

- **[WARNING]** cursor position 검증의 신뢰성 부족 — 매직 넘버 의존
  - 위치: `tokenStart position for nested paths` describe 블록
  - 상세: `tokenStart`/`tokenEnd` 값이 주석으로만 설명된 오프셋 계산에 의존. 입력 문자열과 커서 위치가 변경되면 주석과 불일치할 수 있으며 실수를 유발하기 쉬움
  - 제안: 헬퍼 함수 또는 `indexOf`로 오프셋을 동적으로 계산하거나, 더 많은 위치 케이스를 추가하여 패턴을 검증

- **[INFO]** `$node` 중첩 제안 — `tokenStart`/`tokenEnd` 검증 없음
  - 위치: `$node nested suggestions` describe 블록
  - 상세: `$input`에 대한 tokenStart 테스트는 있지만 `$node["..."].output.field` 경로에서의 토큰 위치는 검증되지 않음
  - 제안: `$node` 경로에 대한 tokenStart/tokenEnd 케이스 추가

- **[INFO]** `variables`, `functionNames` 관련 중첩 동작 미검증
  - 위치: `makeSuggestions` 헬퍼
  - 상세: `defaultData`에 `variables`와 `functionNames`가 포함되지만, 이들이 중첩 경로 제안과 충돌하거나 혼재되는 케이스가 없음
  - 제안: 변수/함수 이름이 있는 상태에서 중첩 경로 제안이 올바르게 필터링되는지 검증

- **[INFO]** `isExpandable` 검증 범위 제한
  - 위치: `marks object fields as expandable` 테스트
  - 상세: `body`(object)와 `name`(string)만 검증, `items`(array)의 `isExpandable` 동작이 명세되지 않음
  - 제안: 배열 필드의 `isExpandable` 값 명시적 검증 추가

- **[INFO]** 빈 `inputSample`이지만 `inputFields`가 있는 케이스 미커버
  - 위치: `$input nested suggestions` describe 블록
  - 상세: `inputFields`와 `inputSample`이 불일치할 때(예: `inputFields`에는 있지만 `inputSample`에 없는 필드) 동작이 검증되지 않음

---

## 요약

`resolve-nested-path.test.ts`는 정상 경로와 주요 에러 케이스를 잘 커버하며 테스트 격리와 가독성이 우수하다. 다만 `0`, `false`, `""` 같은 falsy 정상값에 대한 테스트가 없어 `??` 연산자를 `||`로 실수 변경했을 때 감지가 불가능하며, `MAX_DEPTH` 경계 및 브라켓 포함 경로의 `splitPathAndLeaf` 케이스가 누락된 점은 보완이 필요하다. `use-expression-suggestions.test.ts`는 중첩 자동완성의 핵심 시나리오를 충실히 다루지만 `tokenStart` 검증이 매직 넘버 의존적이고 `$node` 경로의 위치 검증이 없다는 점에서 구조적 취약성이 있다. 전반적으로 기능 커버리지는 양호하지만 falsy 값 처리와 경계 조건 테스트 보강이 권장된다.

## 위험도

**LOW**