## 부작용 코드 리뷰 결과

### 발견사항

---

**[WARNING] `index.tsx` — render 중 `queueMicrotask` setState 호출**
- 위치: `index.tsx`, `ids.length !== operations.length` 분기
- 상세: render 함수 본문에서 직접 `queueMicrotask(() => setIdState(...))` 를 호출합니다. 이는 React 18의 automatic batching 환경에서도 매 렌더마다 마이크로태스크를 큐에 쌓고, 조건 분기가 정확하게 동작한다는 보장이 없는 상황에서 무한 렌더 루프 위험이 잠재합니다. `prev.ids.length === operations.length` 가드가 있지만, operations가 빠르게 연속 변경되는 경우 stale closure로 인해 의도치 않은 상태 덮어쓰기가 발생할 수 있습니다.
- 제안: `useEffect(() => { setIdState(...) }, [operations.length])` 패턴으로 교체하거나, ids 동기화 로직 전체를 reducer로 통합하세요.

---

**[WARNING] `index.tsx` — `nextCounter` 클로저 캡처 불일치 (`addOperation` / `duplicateOperation`)**
- 위치: `addOperation`, `duplicateOperation` 함수
- 상세: `nextCounter`는 render 중 조건부로 `++` 증가되는 `let` 변수입니다. `addOperation`에서 `counter = nextCounter + 1`로 커밋하고, `duplicateOperation`에서 `nextCounter + 1`을 쓰는데, 두 함수가 모두 render 시점의 `nextCounter`를 캡처합니다. React의 비동기 렌더 환경(Concurrent Mode)에서는 동일한 `nextCounter` 값을 두 번 사용해 ID 충돌이 발생할 수 있습니다.
- 제안: counter를 `useRef`로 관리하거나 `uuid`/`crypto.randomUUID()`를 사용해 안정적인 고유 ID를 생성하세요.

---

**[WARNING] `apply-operation.ts` — `object_omit` (field 있는 경우) 원본 내부 객체를 직접 변형**
- 위치: `applyOperation` → `case "object_omit"` (field 있는 경우)
- 상세: `structuredClone(input)`으로 `data`를 복사하지만, `getNested(data, op.field)`로 가져온 `target`은 `data` 내부의 참조입니다. 이후 `delete src[key]`로 직접 삭제하는 방식은 shallow reference이므로 실제로 `data` 내부를 수정합니다. 현재는 `data`가 clone이므로 원본 `input`은 보호되지만, `src`가 `data`의 내부 참조라는 점에서 논리적 일관성이 없습니다(`object_pick`과 달리 새 객체를 만들지 않음). 향후 코드 변경 시 원본 변형 버그 유발 가능성이 높습니다.
- 제안: `object_pick`처럼 새 객체를 만들어 `setNested`로 교체하는 방식으로 통일하세요.

```ts
const result: Record<string, unknown> = {};
for (const key of Object.keys(src)) {
  if (!op.keys.includes(key)) result[key] = src[key];
}
setNested(data, op.field, result);
```

---

**[WARNING] `chip-input.tsx` — 쉼표 처리 시 이중 상태 업데이트**
- 위치: `onChange` 핸들러, `v.endsWith(",")` 분기
- 상세: `setDraft(v.slice(0, -1))`를 먼저 호출한 뒤 조건이 충족되면 `onChange([...values, pending])` + `setDraft("")`를 다시 호출합니다. 즉 한 이벤트에서 `setDraft`가 두 번 호출되고, 조건 불충족 시(빈 값 또는 중복)에는 `setDraft`가 쉼표 제거 상태로 남습니다. `pending`이 이미 존재하는 값일 때 사용자가 타이핑한 텍스트가 중간 상태로 남아 UX 혼란을 야기합니다.
- 제안: 첫 번째 `setDraft(v.slice(0, -1))`를 제거하고, 중복/공백 여부와 관계없이 최종적으로 한 번만 `setDraft("")`를 호출하도록 정리하세요.

---

**[INFO] `apply-operation.ts` — `DATE_UNITS` 중복 선언**
- 위치: `apply-operation.ts:13-20`, `types/transform.ts` 말미
- 상세: `DATE_UNITS` 배열이 `types/transform.ts`에 export로 존재함에도 `apply-operation.ts`에 동일 배열을 로컬로 재선언합니다. 단순 중복이지만 향후 단위 추가 시 한 쪽만 수정되어 동작 불일치가 발생할 수 있습니다.
- 제안: `apply-operation.ts`에서 `import { DATE_UNITS } from "@/types/transform"`으로 교체하고 로컬 선언 제거.

---

**[INFO] `preview.tsx` — `applyOperations` 에러 시 빈 배열 반환으로 부분 결과 소실**
- 위치: `steps` useMemo, `catch` 블록
- 상세: 연산 체인 중간에서 예외가 발생하면 전체 `steps`가 빈 배열로 대체됩니다. 사용자 입장에서는 어느 단계에서 오류가 났는지 알 수 없습니다.
- 제안: 개별 operation마다 try-catch를 감싸거나, 오류 step을 `{ op, error: string }` 형태로 포함해 UI에 표시하는 방식을 권장합니다.

---

### 요약

전반적으로 불변성 보호(`structuredClone`) 및 prototype pollution 방어(`BLOCKED_KEYS`)가 잘 적용되어 있어 외부 상태 오염 위험은 낮습니다. 그러나 `index.tsx`의 render-body `queueMicrotask` 패턴과 `let nextCounter` 클로저 캡처 방식은 React Concurrent Mode 환경에서 ID 충돌 또는 무한 렌더 루프의 잠재적 원인이 됩니다. `object_omit`의 내부 객체 직접 변형과 `chip-input`의 이중 `setDraft` 호출도 의도치 않은 상태 부작용으로 이어질 수 있어 수정이 권장됩니다.

### 위험도

**MEDIUM**