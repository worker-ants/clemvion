## 발견사항

### **[WARNING]** `keyValueSchema` JSDoc의 `cookies` 참조가 실제 스키마와 불일치
- 위치: `http-request.schema.ts` JSDoc, `http-request.schema.spec.ts` describe 제목
- 상세: JSDoc에 "headers / queryParams / **cookies** 의 공용 entry"라고 명시되어 있고, 테스트의 describe 블록 제목도 동일하게 기술되어 있음. 그러나 `httpRequestNodeConfigSchema`에는 `cookies` 필드가 정의되어 있지 않음 — `headers`와 `queryParams`만 `keyValueSchema`를 사용함.
- 제안: `cookies`가 현재 미구현 상태라면 JSDoc에서 제거하거나 `// 예정: cookies` 형태로 미구현임을 명시. 이미 구현 예정이라면 plan 문서에 추적 항목으로 남겨야 함.

```ts
// 현재 (오해 소지 있음)
* `headers` / `queryParams` / `cookies` 의 공용 entry.

// 권장 (현재 구현 기준)
* `headers` / `queryParams` 의 공용 entry.
```

---

### **[INFO]** `keyValueSchema` JSDoc의 `carousel` 노드 참조 검증 필요
- 위치: `http-request.schema.ts` 7–11번째 줄
- 상세: "다른 노드 (form, carousel) 와 동일하게 `.passthrough()` 적용"이라고 명시되어 있음. `form`의 `optionSchema`는 이번 변경에서 확인됐지만, `carousel` 노드가 실제로 `.passthrough()`를 사용하는지 코드에서 확인되지 않음. 부정확한 참조라면 독자에게 잘못된 아키텍처 근거를 제공하게 됨.
- 제안: carousel 스키마를 실제로 확인 후 일치하면 유지, 불일치하면 해당 노드 이름을 제거.

---

### **[INFO]** `optionSchema` JSDoc의 `z.unknown default` 동작 설명이 기술적으로 정밀하지 않음
- 위치: `form.schema.ts` 8–11번째 줄
- 상세: "z.unknown 의 default 는 강제 변환을 하지 않음"이라는 설명은 맞지만, `z.unknown().default('')`에서 사용자가 `false`나 `0`을 넘기면 falsy 값이 보존되는 반면 `undefined`일 때만 `''`가 적용된다는 핵심 동작이 명시되어 있지 않음. 테스트는 이 동작을 올바르게 검증하고 있지만 JSDoc에는 부재.
- 제안 (선택적):
```ts
// `undefined` 일 때만 '' 로 대체; 명시적 false/0/null 은 그대로 통과.
value: z.unknown().default(''),
```

---

### **[INFO]** 테스트의 `as Record<string, unknown>` 이중 캐스트
- 위치: `http-request.schema.spec.ts` 15–16번째 줄, `form.schema.spec.ts` 49–50번째 줄
- 상세: passthrough 테스트에서 `parsed as Record<string, unknown>` 캐스트가 반복되는데, 이것이 `.passthrough()` 타입 시스템 제한(Zod 타입이 추가 필드를 반영하지 않음)임을 나타내는 주석이 없어 향후 독자가 "왜 캐스트하지?"라고 의문을 품을 수 있음.
- 제안 (선택적): 한 줄 주석으로 이유 명시.
```ts
// Zod passthrough()는 런타임에는 추가 필드를 보존하지만
// 타입 레벨에는 반영되지 않으므로 캐스트 필요
const extra = parsed as Record<string, unknown>;
```

---

## 요약

전반적으로 이번 변경의 문서화 품질은 양호하다. `optionSchema`와 `keyValueSchema` 모두 "왜 이 설계를 선택했는가"를 설명하는 JSDoc을 갖추었고, 테스트 describe 제목도 의도를 잘 표현한다. 주요 개선점은 `keyValueSchema` JSDoc에서 현재 미구현 상태인 `cookies` 필드를 언급하는 것으로, 이는 코드 독자와 향후 개발자에게 혼란을 줄 수 있다. `carousel` 참조 역시 실제 코드와의 일치 여부를 확인해 JSDoc 신뢰도를 유지하는 것이 바람직하다.

## 위험도

**LOW**