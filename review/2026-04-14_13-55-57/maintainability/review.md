## 유지보수성 코드 리뷰

### 발견사항

---

**[WARNING]** `apply-operation.ts`의 `DATE_UNITS` 상수 중복
- 위치: `apply-operation.ts:13-19`, `types/transform.ts` 말미
- 상세: `DATE_UNITS` 배열이 두 파일에 각각 독립적으로 정의되어 있음. 타입과 값이 분리된 상태로 중복 관리되면 추후 단위 추가 시 한쪽만 수정하는 실수 가능
- 제안: `apply-operation.ts`의 `DATE_UNITS`를 제거하고 `@/types/transform`에서 import하여 단일 소스 유지

---

**[WARNING]** `index.tsx`의 렌더링 중 사이드이펙트(queueMicrotask setState)
- 위치: `index.tsx:89-96`
- 상세: 렌더 함수 본문에서 `queueMicrotask`로 `setIdState`를 호출하는 패턴은 React의 렌더링 모델과 어긋남. 렌더마다 조건부로 실행되어 추론이 어렵고, `ids`/`nextCounter`가 렌더 중 변이되어(`let` 재할당) 동시성 모드에서 문제를 일으킬 수 있음
- 제안: `useEffect`로 동기화 로직을 이관하거나, `useMemo`로 ids를 operations에서 파생시키고 별도 id 맵(Map)으로 안정성 관리

---

**[WARNING]** `chip-input.tsx`의 쉼표 입력 처리 로직 중복
- 위치: `chip-input.tsx:36-47`
- 상세: `onChange` 핸들러 내부에서 쉼표 처리 시 `v.slice(0, -1)`을 두 번 호출하고 `draft` 상태와 `values`를 모두 별도로 처리함. `setDraft(v.slice(0, -1))`이 실제로는 이후 `setDraft("")`로 덮어쓰여져 불필요한 호출이 됨
- 제안: 쉼표 처리를 `commit()`과 동일한 흐름으로 통합 (`pending`을 구해 commit 후 `setDraft("")`)

```tsx
// 현재: setDraft를 두 번 호출
setDraft(v.slice(0, -1));   // 이 호출은 아래에 덮어써짐
const pending = v.slice(0, -1).trim();
if (pending && !values.includes(pending)) {
  onChange([...values, pending]);
  setDraft("");              // 실제로 적용되는 값
}

// 제안: draft 상태를 한 번만 설정
const pending = v.slice(0, -1).trim();
if (pending && !values.includes(pending)) {
  onChange([...values, pending]);
}
setDraft("");
```

---

**[WARNING]** `apply-operation.ts`의 `evaluateCondition` 함수 과도한 길이
- 위치: `apply-operation.ts:114-170`
- 상세: `switch` 케이스가 15개로 단일 함수가 너무 많은 책임을 가짐. 순환 복잡도(CC ≈ 16)가 높아 테스트 케이스 누락 시 회귀 위험이 큼
- 제안: 비교 연산자군(`eq/neq/gt/gte/lt/lte`), 문자열 연산자군(`contains/starts_with/ends_with`), 타입 검사군(`is_empty/is_null/is_type`)으로 헬퍼 분리

---

**[INFO]** `ops.tsx`의 `ObjectPickFields`와 `ObjectOmitFields` 구조 중복
- 위치: `ops.tsx:285-323`
- 상세: 두 컴포넌트가 `Target Object Path` + `ChipInput`으로 완전히 동일한 구조를 가짐. placeholder 텍스트만 다름
- 제안: 공통 컴포넌트(`ObjectKeyFields`)로 추출하고 `label`/`placeholder` prop으로 차별화. 단, 현재 분량이 작으므로 Info 수준

---

**[INFO]** `operation-card.tsx`의 인라인 타입 단언
- 위치: `operation-card.tsx:72`
- 상세: `e.target.value as TransformOperationType` 타입 단언이 런타임 검증 없이 사용됨. `select`의 options가 `TRANSFORM_OPERATION_TYPES`에서 생성되므로 실제 위험은 낮지만, 향후 외부에서 값이 주입될 경우 silent failure 가능
- 제안: 현재 구조상 큰 위험 없음. 다만 `handleTypeChange` 내부에서 유효 타입 확인을 추가하면 방어적 설계 완성

---

**[INFO]** `defaults.ts`의 `object_pick`/`object_omit` `field` 처리 비일관성
- 위치: `defaults.ts:42-49`
- 상세: `field: preservedField || undefined` 패턴은 `preservedField`가 `""` 일 때 `undefined`가 되어 타입상 올바르나, 다른 케이스의 `field: preservedField` (빈 문자열)과 다른 처리를 함. 이 차이가 명시적이지 않음
- 제안: 주석 또는 헬퍼 함수(`toOptionalField`)로 의도를 명시

---

**[INFO]** `preview.tsx`의 `key={i}` 사용
- 위치: `preview.tsx:83`
- 상세: `steps.map((step, i) => <JsonCard key={i} .../>)` — operations 수/순서 변경 시 DOM 재사용이 올바르지 않을 수 있음. `key={step.op.type + i}`와 같이 더 안정적인 키 사용 권장
- 제안: `key={`${i}-${step.op.type}`}`

---

### 요약

전반적으로 코드 구조는 잘 설계되어 있으며, 타입 시스템 활용(`OpPropsOf<T>` 제네릭), 책임 분리(types/defaults/ops/apply-operation), 불변성 유지(`structuredClone`) 측면에서 높은 품질을 보인다. 가장 주목할 이슈는 `index.tsx`의 렌더 중 `queueMicrotask` + 변수 재할당 패턴으로, 이는 React 동시성 모드와 충돌 가능성이 있어 리팩토링이 필요하다. 그 외 `DATE_UNITS` 중복 정의와 `chip-input.tsx`의 상태 처리 중복은 실수 유발 가능성이 있는 Warning 수준이며, 나머지는 향후 확장 시 고려할 Info 수준의 사항이다.

### 위험도

**MEDIUM**