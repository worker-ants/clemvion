## 발견사항

---

**[WARNING] Loop 테스트의 비결정적 타이밍 패턴**
- 위치: `execution-engine.service.spec.ts` — Loop 테스트 5건 전체
- 상세: Loop 테스트는 `await new Promise((r) => setTimeout(r, 200))`을 사용하는 반면, 같은 PR에 추가된 Parallel 표현식 테스트는 `await flushPromises()`를 사용한다. `setTimeout(r, 200)`은 CI 환경이 느릴 경우 간헐적으로 실패할 수 있다. 같은 파일 내 일관성도 깨진다.
- 제안: 신규 Loop 테스트를 `await flushPromises()`로 통일한다.

---

**[WARNING] Mock `parallelHandler`가 실제 `ParallelHandler`의 `rawConfig` 접근 패턴과 다름**
- 위치: `execution-engine.service.spec.ts` — Parallel expression 테스트
- 상세: 테스트 내 커스텀 핸들러가 `context.rawConfig ?? config`로 echo config를 구성하는데, 실제 `ParallelHandler`는 `context.rawConfig`를 직접 사용한다. 엔진의 `rawConfig` 주입 타이밍이 바뀌거나 `rawConfig`가 `undefined`인 경로가 생겨도 이 테스트에서는 감지되지 않는다.
- 제안: 테스트 주석에 "핸들러 로직이 아닌 엔진의 `engineResolvedConfigCache` 분기를 검증하는 테스트임"을 명시하여 향후 유지보수 시 혼동을 방지한다.

---

**[INFO] `fail()` 글로벌 의존 — Jest 27+ 환경에서 잠재적 문제**
- 위치: `coerce-container-param.spec.ts` — `error message includes node type, field name...` 테스트
- 상세: Jest 27+에서는 `fail()`이 글로벌에서 제거됐다. 함수가 정상적으로 throw하는 한 `catch` 블록에서 assertions를 통과하므로 평상 시에는 문제없지만, 구현이 바뀌어 throw하지 않게 되면 `ReferenceError: fail is not defined`라는 혼동스러운 오류가 나온다.
- 제안: `expect.assertions(3)` 패턴이나 `.toThrow(/pattern/)` 체이닝으로 교체한다.

```ts
// Before
try {
  coerceContainerNumber('{{$var.n}}', 'branchCount', 'parallel');
  fail('expected to throw');
} catch (e) { ... }

// After
expect(() =>
  coerceContainerNumber('{{$var.n}}', 'branchCount', 'parallel')
).toThrow(expect.objectContaining({
  message: expect.stringMatching(/parallel.*branchCount.*\{\{\$var\.n\}\}/),
}));
```

---

**[INFO] `-Infinity` 케이스 누락**
- 위치: `coerce-container-param.spec.ts` — `throws for NaN / Infinity` 테스트
- 상세: `Infinity`는 테스트하지만 `-Infinity`는 없다. `-Infinity`도 `Number.isFinite()` 검사를 통과하지 못하고 throw해야 하지만 명시적으로 문서화되지 않았다.
- 제안: `expect(() => coerceContainerNumber(-Infinity, 'count', 'loop')).toThrow(/not a finite number/)` 추가.

---

**[INFO] ForEach `errorPolicy: 'continue'` 회귀 테스트 없음**
- 위치: `execution-engine.service.spec.ts`
- 상세: `skip`은 e2e 회귀 테스트가 추가됐지만 `continue`는 없다. 두 정책 모두 반복을 계속하지만 동작 방식이 미묘하게 다르다. Map 노드에서의 `errorPolicy`도 테스트되지 않는다.
- 제안: `errorPolicy: 'continue'`로 동일한 시나리오를 검증하는 테스트 추가.

---

**[INFO] `setEngineResolvedConfig` 내 방어 분기가 실행되지 않음**
- 위치: `execution-context.service.ts:53-55` / `execution-context.service.spec.ts`
- 상세: `createContext`에서 항상 `engineResolvedConfigCache: {}`로 초기화하므로 `if (!context.engineResolvedConfigCache)` 분기는 일반 경로에서 도달 불가다. 역직렬화된 레거시 컨텍스트에 대한 방어 코드이지만 그에 해당하는 테스트가 없어 실제로 작동하는지 검증되지 않는다.
- 제안: 코드에 `// for deserialized legacy contexts` 주석을 추가하거나, `engineResolvedConfigCache` 없이 직접 생성한 컨텍스트 객체로 호출 시 guard가 동작함을 검증하는 테스트 1건을 추가한다.

---

**[INFO] `branchCount` 클램핑 경계값 표현식 테스트 없음**
- 위치: `execution-engine.service.spec.ts` — Parallel expression 테스트
- 상세: `'{{4}}'` → 4 분기는 검증하지만, `'{{1}}'` → clamp to 2 또는 `'{{20}}'` → clamp to 16인 경우는 검증하지 않는다. 클램핑 로직이 표현식 평가 경로에서도 올바르게 동작하는지 확인되지 않는다.
- 제안: 클램핑 경계를 커버하는 케이스(예: `branchCount: '{{1}}'` → `branchHandler` 2회 호출) 추가.

---

**[INFO] `coerceContainerBoolean`의 대소문자 구분 계약 미문서화**
- 위치: `coerce-container-param.spec.ts`
- 상세: `"true"` / `"false"` (소문자 한정)만 파싱하고 `"TRUE"`, `"True"` 등은 throw한다. 이는 의도된 설계지만 테스트로 명시되지 않아, 향후 개발자가 암묵적 truthy 처리를 기대할 수 있다.
- 제안: `expect(() => coerceContainerBoolean('TRUE', 'waitAll', 'parallel', false)).toThrow(/not a boolean/)` 추가.

---

**[INFO] `coerceContainerNumberOptional(0, ...)` 명시적 테스트 없음**
- 위치: `coerce-container-param.spec.ts`
- 상세: `0`은 유효한 숫자이지만 falsy라 `null`/`undefined` 분기로 잘못 처리될 수 있다는 우려가 있다. `coerceContainerNumberOptional(0, ...)` → `0` 반환이 올바른 동작이지만 명시적으로 검증되지 않는다.
- 제안: `expect(coerceContainerNumberOptional(0, 'count', 'loop')).toBe(0)` 추가.

---

## 요약

전반적으로 테스트 커버리지는 높고 구조적으로 잘 설계되어 있다. `coerce-container-param` 유닛 테스트는 주요 입력 클래스를 폭넓게 커버하고, `execution-context.service.spec.ts`는 새 캐시 슬롯의 모든 상태 전이를 검증한다. e2e 회귀 테스트는 원래 버그(`{{3}}` → NaN, `{{4}}` → branchCount 2 fallback)를 정확히 재현하고 수정을 확인한다. 주요 우려 사항은 Loop 테스트에서 `setTimeout(200)` 대신 `flushPromises()`를 사용하지 않아 CI에서 간헐적으로 실패할 수 있다는 점이며, 나머지는 `-Infinity`, `continue` errorPolicy, 브랜치 클램핑 등 낮은 위험의 경계값 테스트 누락이다.

## 위험도

**LOW**