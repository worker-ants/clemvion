### 발견사항

**[WARNING] `resolveString`에서 mixed text + expression 처리 버그 — 테스트 미흡**
- 위치: `expression-resolver.service.ts:resolveString`
- 상세: `FULL_EXPRESSION_PATTERN`이 매치될 때 `result`를 반환하고, 매치 안 될 때도 `result`를 그대로 반환함. 즉 mixed text (`"Hello {{ $input.name }}"`)에서 `evaluate()`가 전체 문자열을 어떻게 처리하느냐에 달려 있는데, `evaluate()`가 mixed 포맷을 지원하는지 spec에만 있고 테스트에 mixed + type 보존 케이스가 없음.
- 제안: `"Count is {{ $input.count }}"` → `"Count is 5"` 케이스에서 실제로 string concatenation이 일어나는지 테스트에 `typeof result.message === 'string'` 확인 추가 필요 (현재 spec에는 있지만 assertion이 없음)

```ts
// 현재 스펙에는 있지만 실제 assertion 누락
it('returns string for mixed text + expression', () => {
  const config = { message: 'Count is {{ $input.count }}' };
  const result = service.resolveConfig(config, baseContext);
  expect(result.message).toBe('Count is 5');
  expect(typeof result.message).toBe('string'); // ← 이 라인 없음
});
```

---

**[WARNING] `buildExpressionContext`에서 `$execution.mode`가 항상 `'manual'` 하드코딩 — 테스트 누락**
- 위치: `expression-resolver.service.ts:43`, `expression-resolver.service.spec.ts`
- 상세: `executionContext`에 `mode` 필드가 없어 항상 `'manual'`이 반환됨. 스케줄/webhook 실행 시 `$execution.mode`가 틀림. `startedAt`도 항상 `new Date()`로 새로 생성해서 실행 컨텍스트의 실제 시작 시각과 다름.
- 제안: `ExecutionContext`에 `mode`와 `startedAt` 필드 추가, 또는 테스트에서 `mode !== 'manual'` 케이스 커버 필요

---

**[WARNING] `ExpressionInput` — `multiline` 모드에서 highlight overlay 없음, 관련 테스트 없음**
- 위치: `expression-input.tsx:160-163`
- 상세: `hasExpression && !multiline` 조건으로 multiline textarea에는 highlight가 렌더링되지 않음. 이 의도적 결정이 테스트로 명시되지 않아 나중에 실수로 조건 제거 시 회귀 발생.
- 제안: `expression-input.test.tsx`에 아래 테스트 추가
```tsx
it('does not render highlight overlay in multiline mode', () => {
  render(<ExpressionInput label="Body" value="{{ $input.name }}" onChange={onChange} multiline />);
  expect(document.querySelector('[aria-hidden="true"]')).toBeNull();
});
```

---

**[WARNING] `getExpressionToken` — `i - 1` 접근 시 경계값 버그 위험, 테스트 없음**
- 위치: `use-expression-suggestions.ts:46-47`
- 상세: `i === 0`일 때 `value[i - 1]` = `value[-1]` = `undefined`. `undefined === "}"` 는 false이므로 실제로 crash는 안 나지만 의도치 않은 동작 가능. `value = "{{ expr"` 처럼 맨 앞에 `{{`가 있는 케이스.
- 제안: `getExpressionToken`을 단독 함수로 추출하여 유닛 테스트 추가 필요:
```ts
describe('getExpressionToken', () => {
  it('handles {{ at start of string', () => { ... });
  it('handles nested braces', () => { ... });
  it('returns null when cursor outside expression', () => { ... });
});
```

---

**[WARNING] `ExpressionResolverService` — MAX_DEPTH 도달 시 `obj` 원본 반환 (표현식 미해석)**
- 위치: `expression-resolver.service.ts:72`
- 상세: depth > 10 이면 해당 레벨 전체를 표현식 해석 없이 원본으로 반환. 이 동작에 대한 테스트 없음.
- 제안:
```ts
it('stops resolving at max depth without error', () => {
  // 11단계 중첩 객체 생성 후 resolveConfig 호출
  // → 최대 깊이 이상은 원본 값 그대로 반환되는지 검증
});
```

---

**[INFO] `websocket.gateway.spec.ts` — 타입 캐스팅 제거로 오히려 타입 안전성 저하**
- 위치: `websocket.gateway.spec.ts:202`
- 상세: `module.get(ExecutionEngineService)` 반환 타입은 `ExecutionEngineService`인데 `continueExecution`이 mock이므로 타입 에러 발생 가능. 이전 코드가 의도적으로 `jest.Mock`으로 캐스팅했음.
- 제안: `as unknown as { continueExecution: jest.Mock }` 캐스팅 유지하거나 `jest.mocked()` 사용 권장

---

**[INFO] `expression-input.test.tsx` — autocomplete 선택 동작 테스트 없음**
- 위치: `expression-input.test.tsx`
- 상세: `handleSelect` 로직(토큰 교체, 커서 이동)과 `handleNavigate`(방향키 탐색)에 대한 테스트 전무. 자동완성의 핵심 기능임.
- 제안: `fireEvent.change` → `{{ $` 입력 후 suggestion 렌더링 및 선택 흐름 테스트 추가

---

**[INFO] `use-expression-suggestions.ts` — 유닛 테스트 파일 없음**
- 위치: `frontend/src/components/editor/expression/`
- 상세: `useExpressionSuggestions`와 `useExpressionContext` 훅에 대한 테스트 파일이 없음. 복잡한 token 파싱 로직이 있음에도 직접 테스트되지 않음.
- 제안: `__tests__/use-expression-suggestions.test.ts` 파일 추가하여 토큰 파싱 케이스들 커버

---

**[INFO] `expression-exclusions.ts` — 테스트 없음**
- 위치: `backend/src/modules/execution-engine/expression/expression-exclusions.ts`
- 상세: 단순 상수이지만, `pdf` 등 다른 핸들러 추가 시 누락 방지를 위한 테스트가 있으면 좋음. `expression-resolver.service.spec.ts`에서 간접 커버는 됨 (기존 code/template 케이스).

---

### 요약

전반적으로 핵심 로직(`ExpressionResolverService`)에 대한 백엔드 유닛 테스트는 잘 구성되어 있으며, 주요 경로(타입 보존, 재귀, 제외 규칙, $node 참조)를 충분히 커버한다. 다만 `resolveString`의 mixed-text 처리에서 타입 assertion이 누락되어 있고, `$execution.mode`/`startedAt` 하드코딩으로 인한 동작 오류가 테스트에 드러나지 않는 것이 주요 위험이다. 프론트엔드 `ExpressionInput` 테스트는 렌더링/validation 기본 케이스만 다루고 자동완성 핵심 기능(토큰 교체, 키보드 탐색)과 `use-expression-suggestions` 훅 자체에 대한 테스트가 없어 회귀 위험이 있다. `getExpressionToken`의 경계값 버그는 실제 crash로 이어지진 않지만 테스트를 통해 의도를 명시할 필요가 있다.

### 위험도

**MEDIUM**