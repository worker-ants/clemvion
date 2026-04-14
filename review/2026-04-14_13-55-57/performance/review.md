## 성능 코드 리뷰

### 발견사항

---

**[WARNING]** `applyOperation`에서 매 호출마다 `structuredClone` 수행
- 위치: `apply-operation.ts` — `applyOperation` 함수 첫 줄
- 상세: `applyOperations` 체인 실행 시 각 operation마다 전체 객체를 deep clone합니다. N개의 operation이 있을 때 N번의 전체 복사가 발생하며, 큰 데이터셋에서 병목이 됩니다. 특히 Preview 패널처럼 사용자 입력마다 재계산되는 경우 누적 비용이 큽니다.
- 제안: `applyOperations` 내부에서는 최초 1회만 clone하고, `applyOperation`은 이미 복사된 객체를 mutate하는 내부 함수와 외부용 clone 버전으로 분리하세요.

```ts
// 내부에서만 사용하는 mutating 버전
function applyOperationMut(data: Record<string, unknown>, op: TransformOperation): void { ... }

// 공개 API는 한 번만 clone
export function applyOperation(input, op) {
  const data = structuredClone(input);
  applyOperationMut(data, op);
  return data;
}

export function applyOperations(input, ops) {
  let current = structuredClone(input); // 최초 1회만
  return ops.map(op => {
    applyOperationMut(current, op);
    steps.push({ op, result: current });
    current = structuredClone(current); // 다음 단계용
  });
}
```

---

**[WARNING]** Preview가 키 입력마다 `applyOperations` 재계산
- 위치: `preview.tsx` — `steps` useMemo
- 상세: `operations` 배열이 참조가 아닌 내용이 바뀔 때마다 모든 step을 처음부터 재계산합니다. 특히 textarea의 `sampleText`가 바뀔 때마다 JSON parse + 전체 operation 체인 재실행이 동시에 발생합니다.
- 제안: `parsedSample`과 `steps` 계산 사이에 debounce를 적용하세요 (textarea 입력 시). 또는 `sampleText` 변경은 디바운스, operation 변경은 즉시 반영으로 분리하세요.

---

**[WARNING]** `OperationCard`에서 `TRANSFORM_OPERATION_TYPES.find()` 매 렌더마다 실행
- 위치: `operation-card.tsx:45` — `const meta = TRANSFORM_OPERATION_TYPES.find(...)`
- 상세: `TRANSFORM_OPERATION_TYPES`는 상수 배열이지만, `find`를 매 렌더마다 실행합니다. 카드가 많을수록 누적됩니다.
- 제안: 상수 배열을 Map으로 전환하거나, 모듈 상단에서 lookup 객체를 미리 생성하세요.

```ts
// types/transform.ts에 추가
export const TRANSFORM_OP_META = Object.fromEntries(
  TRANSFORM_OPERATION_TYPES.map(t => [t.value, t])
);

// operation-card.tsx
const meta = TRANSFORM_OP_META[op.type]; // O(1)
```

---

**[WARNING]** `index.tsx`에서 `queueMicrotask` + 렌더 중 mutation 패턴
- 위치: `index.tsx:88-97` — ids 길이 불일치 시 microtask로 `setIdState` 호출
- 상세: 렌더 중 `queueMicrotask`로 setState를 예약하면 한 번의 상호작용에 최소 2번 렌더가 보장됩니다. operations 수가 자주 바뀌는 경우(add/remove 빈번) 불필요한 재렌더가 발생합니다.
- 제안: ids와 operations를 함께 관리하거나, `useReducer`로 통합하여 단일 dispatch로 상태를 동기화하세요. 렌더 중 setState 예약은 React 권장 패턴이 아닙니다.

---

**[WARNING]** `index.tsx`에서 인라인 화살표 함수로 인한 불필요한 자식 재렌더
- 위치: `index.tsx:160-168` — `operations.map`에서 `onChange`, `onRemove`, `onDuplicate`를 인라인으로 전달
- 상세: 매 렌더마다 새 함수 참조가 생성되어 `OperationCard`가 항상 재렌더됩니다. `OperationCard`가 `memo`로 감싸져 있지 않으면 operation 하나를 수정할 때 전체 카드 목록이 재렌더됩니다.
- 제안: `OperationCard`를 `React.memo`로 감싸고, 핸들러를 `useCallback`으로 안정화하세요. 또는 `updateOperation(i, next)` 패턴 대신 id 기반 업데이트로 전환하세요.

---

**[INFO]** `ChipInput`에서 `values.includes()` 중복 탐색
- 위치: `chip-input.tsx:18, 33`
- 상세: `commit`과 comma 처리 핸들러 양쪽에서 각각 `values.includes()`를 호출합니다. 값이 많을 경우 O(n) 탐색이 중복 발생합니다. 실용적 규모(수십 개 chip)에서는 무시 가능하나, Set을 사용하면 개선됩니다.
- 제안: `const valueSet = useMemo(() => new Set(values), [values])`로 캐싱 후 `valueSet.has()`를 사용하세요.

---

**[INFO]** `apply-operation.ts`의 `parsePath`에서 정규식을 매 호출마다 컴파일
- 위치: `apply-operation.ts:17` — `/\[(\w+)\]/g`
- 상세: `parsePath`는 path 문자열마다 호출되며, 내부에서 정규식 리터럴이 사용됩니다. JS 엔진이 대부분 캐싱하지만, 명시적으로 모듈 스코프에서 상수로 선언하면 의도가 명확해집니다.
- 제안: `const BRACKET_RE = /\[(\w+)\]/g` 를 모듈 상단에 선언하세요.

---

**[INFO]** `DateOpFields`에서 `unitOptions`를 매 렌더마다 재생성
- 위치: `ops.tsx` — `DateOpFields` 내 `const unitOptions = DATE_UNITS.map(...)`
- 상세: `DATE_UNITS`는 상수인데 `.map()`으로 렌더마다 새 배열을 생성합니다.
- 제안: 컴포넌트 외부 상수로 추출하세요: `const DATE_UNIT_OPTIONS = DATE_UNITS.map(u => ({ value: u, label: u }))`.

---

### 요약

전반적으로 코드 구조는 명확하며 보안 처리(`BLOCKED_KEYS`)도 적절합니다. 성능 관점의 핵심 문제는 **`applyOperation`의 `structuredClone` 비용**으로, N개 operation 체인에서 N번 전체 복사가 발생하여 Preview 패널의 실시간 계산에서 병목이 될 수 있습니다. 그 외에 렌더 최적화(인라인 핸들러, 매 렌더 lookup) 개선이 필요합니다. `queueMicrotask` 내 `setState` 패턴은 예측 불가능한 이중 렌더를 유발하므로 상태 통합으로 해결하는 것이 권장됩니다.

### 위험도

**MEDIUM**