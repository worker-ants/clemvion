### 발견사항

---

**[WARNING] `computeFieldValue(undefined, item, ctx)` 가 `item` 이 아닌 `undefined` 를 반환**
- 위치: `filter.handler.ts` `computeFieldValue` 메서드 (마지막 `return field` 분기)
- 상세: `field === '' || field === '$item'` 은 sentinel 처리하지만 `field === undefined` (조건 객체에 `field` 키가 없는 경우) 는 `return field` 분기로 떨어져 `undefined` 를 반환한다. `validate` 는 missing field 를 허용하고 "item-self sentinel 로 동작한다"고 명시하지만, `execute` 경로에서 실제 동작은 다르다. 스칼라 배열에서 `{ operator: 'eq', value: 1 }` (field 없음) 조건은 모든 item 이 unmatched 가 된다.
- 제안:
  ```ts
  if (field === undefined || field === null || field === '' || field === '$item') return item;
  ```
  그리고 다음 실행 테스트를 추가해야 한다:
  ```ts
  it('should treat undefined field as item-self sentinel during execution', async () => {
    const result = await execFilter({}, {
      inputField: [1, 2, 3],
      conditions: [{ operator: 'eq', value: 2 }], // field 키 없음
      combineMode: 'and',
    });
    expect(result.output.match).toEqual([2]);
  });
  ```

---

**[WARNING] `$itemIndex` 바인딩이 테스트되지 않음**
- 위치: `filter.handler.ts:100` `itemCtx = { ...baseCtx, $item: item, $itemIndex: index }`
- 상세: 구현이 `$itemIndex` 를 context 에 bind 하지만, 이를 실제로 사용하는 expression 테스트가 전혀 없다. `$itemIndex` 가 0-based 인지, 올바른 값을 갖는지 검증 불가.
- 제안:
  ```ts
  it('should expose $itemIndex in expression context', async () => {
    const result = await execFilter({}, {
      inputField: ['a', 'b', 'c'],
      conditions: [{ field: '{{ $itemIndex }}', operator: 'eq', value: '{{ 1 }}' }],
      combineMode: 'and',
    });
    expect(result.output.match).toEqual(['b']);
  });
  ```

---

**[WARNING] `combineMode: 'or'` + per-item 표현식 조합 미검증**
- 위치: `filter.handler.spec.ts` "per-item expression resolution and item-self sentinel" describe 블록
- 상세: 새로 추가된 describe 블록의 8개 케이스 모두 `combineMode: 'and'` (기본값) 를 사용한다. `evalOne` 이 `conditions.some(evalOne)` 경로에서도 올바르게 동작하는지 검증이 없다.
- 제안: OR 모드 + 다중 per-item 조건 테스트 추가:
  ```ts
  it('should evaluate per-item expressions with combineMode "or"', async () => {
    const data = [{ a: 1, b: 10 }, { a: 5, b: 1 }];
    const result = await execFilter({}, {
      inputField: data,
      conditions: [
        { field: '{{ $item.a }}', operator: 'gt', value: 3 },
        { field: '{{ $item.b }}', operator: 'gt', value: 5 },
      ],
      combineMode: 'or',
    });
    // { a:1, b:10 } → b>5 passes; { a:5, b:1 } → a>3 passes
    expect(result.output.match).toHaveLength(2);
  });
  ```

---

**[WARNING] 동적 regex 패턴 표현식(`value: '{{ $item.pattern }}'`) 미검증**
- 위치: `filter.handler.spec.ts` regex 관련 테스트, `filter.handler.ts:getRegex`
- 상세: regex 캐시가 per-item resolved pattern 을 key 로 메모이즈하도록 설계되어 있지만 (각 item 마다 다른 pattern 문자열이 올 수 있음을 지원), 실제로 item 마다 다른 regex 패턴이 resolve 되는 케이스 테스트가 없다. 현재 추가된 regex 테스트는 literal `'^[AC]'` (상수 값) 만 사용한다.
- 제안:
  ```ts
  it('should support per-item dynamic regex pattern', async () => {
    const data = [{ name: 'Alice', pat: '^Al' }, { name: 'Bob', pat: '^Bo' }];
    const result = await execFilter({}, {
      inputField: data,
      conditions: [{ field: '{{ $item.name }}', operator: 'regex', value: '{{ $item.pat }}' }],
      combineMode: 'and',
    });
    expect(result.output.match).toEqual(data); // 둘 다 각자 패턴에 매치
  });
  ```

---

**[WARNING] `condition-eval.util.ts` 변경에 대한 직접 단위 테스트 없음**
- 위치: `condition-eval.util.ts` — `Condition.field: unknown` 변경 및 `evaluateCondition` 내 sentinel 분기
- 상세: `evaluateCondition` 의 새 sentinel 로직(`typeof path !== 'string'`, `path === ''`, `path === '$item'`)은 `filter.handler.spec.ts` 를 통한 간접 검증만 존재한다. 다른 노드(`if-else` 등)도 이 util 을 사용하므로, util 자체에 대한 독립 단위 테스트가 있다면 회귀를 더 빠르게 감지할 수 있다.
- 제안: `condition-eval.util.spec.ts` 에 `evaluateCondition` 직접 호출 테스트 추가 (또는 기존 파일이 있다면 sentinel case 추가).

---

**[WARNING] `context.expressionContext` 와 workflow 변수 접근 미검증**
- 위치: `filter.handler.ts:90` `const baseCtx = (context.expressionContext ?? {}) as EngineContext`
- 상세: 모든 테스트의 `context` 는 `expressionContext` 없이 구성된다 (`baseCtx = {}`). 실제 런타임에서는 `$input`, `$vars` 등의 workflow 변수가 `expressionContext` 에 담겨있다. `$item` 바인딩이 `baseCtx` 를 스프레드한 뒤 override 되므로 기존 변수들이 유지되는지 검증이 없다.
- 제안:
  ```ts
  it('should inherit workflow context variables in per-item expressions', async () => {
    const ctxWithVars = { ...context, expressionContext: { threshold: 15 } };
    const result = await handler.execute(
      {}, { inputField: [10, 20], conditions: [{ field: '$item', operator: 'gt', value: '{{ threshold }}' }], combineMode: 'and' },
      ctxWithVars,
    ) as FilterResult;
    expect(result.output.match).toEqual([20]);
  });
  ```

---

**[INFO] regex 길이 경계값 `MAX_REGEX_LENGTH` (= 200) 정확히 테스트 안 됨**
- 위치: `filter.handler.spec.ts` "should reject regex patterns exceeding max length" (201자 사용)
- 상세: 201자는 거부, 200자는 허용이어야 하는데 200자 boundary 테스트가 없다. off-by-one 이 `>` vs `>=` 실수로 바뀐다면 현 테스트로는 감지 불가.
- 제안: `'a'.repeat(200)` (허용) + `'a'.repeat(201)` (거부) 양쪽을 모두 검증.

---

**[INFO] `is_type`, `is_null`, `is_empty` 연산자의 per-item field expression 조합 미검증**
- 위치: `filter.handler.spec.ts` per-item describe 블록
- 상세: 새 per-item 테스트들은 `eq`, `gt`, `regex` 연산자만 다룬다. `is_type: 'number'`, `is_empty`, `is_null` 과 `{{ $item.someField }}` 조합이 없다.
- 제안: 최소 `is_type` + 표현식 필드 테스트 1건 추가.

---

### 요약

테스트 전반의 품질은 높다. 기존 operator 전체 커버리지, strictComparison, regex 경계값, 에러 격리, beforeEach 기반 상태 초기화 등이 잘 갖춰져 있고, 새로운 per-item expression 케이스들도 핵심 시나리오(#1~#9)를 실제 spec 참조와 함께 명확히 서술한다. 다만 **`computeFieldValue`의 `undefined` field 처리 버그가 실행 경로에서 미검증 상태**로 남아 있어, `validate` 가 허용한 "missing field = item-self sentinel" 계약이 `execute` 에서 지켜지지 않는다. 추가로 `$itemIndex` 바인딩, `combineMode: 'or'` + 표현식 조합, 동적 regex 패턴이 아직 검증되지 않았으며, `condition-eval.util.ts` 의 새로운 sentinel 분기는 간접 테스트에만 의존하고 있다.

### 위험도

**MEDIUM** — 핵심 기능(per-item gt/eq/regex)은 테스트 커버되지만, `undefined` field sentinel 불일치 버그가 존재하며 validate/execute 계약 위반으로 실사용에서 silent failure 를 유발할 수 있다.