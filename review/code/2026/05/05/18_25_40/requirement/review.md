### 발견사항

---

**[WARNING] `computeFieldValue`에서 `undefined` field가 item-self sentinel로 처리되지 않음**
- 위치: `filter.handler.ts:144` — `computeFieldValue`
- 상세: `field === '' || field === '$item'` 분기만 존재. `{ operator: 'eq', value: 1 }` 처럼 `field` 프로퍼티가 아예 없는 조건(undefined)은 어떤 분기도 타지 않고 `return field`(= `return undefined`)로 떨어짐. 그 결과 `evaluateCondition(undefined, {field:'',...})` → `fieldValue = undefined`가 되어, 모든 `eq/gt/...` 비교가 false가 됨 → 전 항목 unmatched.
- **반면** `condition-eval.util.ts:72`의 sentinel은 `typeof path !== 'string'`로 undefined를 올바르게 잡아 `item`을 반환함. 두 진입로 간 동작 불일치.
- **검증 테스트는 통과하지만 실행 테스트가 없음** — `filter.handler.spec.ts` 내 `'should accept missing field as item-self sentinel'`은 `validate()`만 검사하고 `execute()`는 검사하지 않음.
- 제안:
  ```typescript
  if (field === undefined || field === '' || field === '$item') return item;
  ```

---

**[WARNING] plan 문서가 미갱신 상태로 `in-progress/`에 잔류**
- 위치: `plan/in-progress/node-features/filter-conditions-expression-binding.md`
- 상세: 구현·테스트가 완료된 것처럼 보이는데도 체크리스트 항목 전체가 `[ ]`(미완) 상태. CLAUDE.md 규약상 모든 항목 완료 시 `git mv`로 `plan/complete/`로 이동해야 함. 현재 상태는 plan 라이프사이클 위반.
- 제안: 완료된 항목 체크 후 `plan/complete/node-features/`로 이동.

---

**[INFO] `resolveIfExpression` 실패 시 `null` 반환 — plan 문서와 불일치**
- 위치: `filter.handler.ts:166`
- 상세: plan 문서는 "평가 실패 → `undefined` fallback"이라고 명시하지만, 구현은 `null`을 반환. 주석에 "mirrors TableHandler precedent"라고 설명되어 있으나, plan 문서와 코드 간 명시적 불일치.
- 제안: plan 문서 수정("→ `null` fallback") 또는 향후 혼동 방지를 위해 주석에 plan 차이 명시.

---

**[INFO] `context.expressionContext` — `ExecutionContext` 인터페이스 미선언 가능성**
- 위치: `filter.handler.ts:68`
- 상세: `(context.expressionContext ?? {}) as EngineContext` — `ExecutionContext` 인터페이스에 `expressionContext` 프로퍼티가 없으면 TypeScript는 통과하지만 런타임에서 항상 `{}` fallback이 발생하여 `$variables` 등 외부 컨텍스트를 무시하게 됨. 사일런트 디그레이드.
- 제안: `ExecutionContext` 인터페이스에 `expressionContext?: EngineContext` 선언 여부 확인.

---

**[INFO] `undefined` field execute 테스트 누락**
- 위치: `filter.handler.spec.ts`
- 상세: `field`가 아예 없는 조건(`{ operator: 'eq', value: 1 }`)에 대해 validate 테스트만 있고, execute로 실제 스칼라 배열 필터링 결과를 검증하는 테스트가 없음. 위 WARNING과 직결.
- 제안:
  ```typescript
  it('should compare item itself when field is absent', async () => {
    const result = await execFilter({}, {
      inputField: [1, 2, 3],
      conditions: [{ operator: 'gt', value: 1 }],
      combineMode: 'and',
    });
    expect(result.output.match).toEqual([2, 3]);
  });
  ```

---

### 요약

핵심 기능(per-item `$item` 바인딩, 스칼라 배열 sentinel, 표현식 평가 실패 흡수, regex 캐시 재설계)은 스펙(`spec line 367, 405`) 요건을 충실히 구현하고 있으며 테스트 커버리지도 양호하다. 다만 가장 중요한 리스크는 **`field` 미지정(undefined) 시의 동작 불일치**로, 유효성 검사는 sentinel로 허용하지만 실행 경로(`computeFieldValue`)는 `item`이 아닌 `undefined`를 반환해 전 항목이 unmatched 처리된다. `condition-eval.util.ts`의 sentinel 로직과 `filter.handler.ts`의 `computeFieldValue`가 `undefined` 처리를 다르게 다루는 점이 근본 원인이며, 이에 대한 실행 테스트가 없어 표면화되지 않았다.

### 위험도

**MEDIUM**