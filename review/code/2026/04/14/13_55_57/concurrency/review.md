## 리뷰 결과: 동시성(Concurrency)

---

### 발견사항

**[WARNING]** `queueMicrotask` 내 stale closure — `nextCounter` 덮어쓰기 위험
- **위치**: `index.tsx` — `TransformConfig` 컴포넌트, 렌더 본문 내 `queueMicrotask` 블록
- **상세**:
  ```ts
  // 렌더 중 nextCounter가 증가한 뒤, 마이크로태스크가 큐에 등록됨
  queueMicrotask(() => {
    setIdState((prev) =>
      prev.ids.length === operations.length
        ? prev
        : { ids: resized, counter: nextCounter }, // ← 렌더 시점의 nextCounter 캡처
    );
  });
  ```
  마이크로태스크가 실행되기 전에 사용자가 "Add Operation" 또는 "Duplicate"를 클릭하면, `addOperation` / `duplicateOperation`은 렌더 시점의 `nextCounter`를 기반으로 `commit()`을 호출하여 `setIdState`를 먼저 업데이트합니다. 이후 큐에 남아있던 마이크로태스크가 실행되며, 이미 증가된 `counter` 위에 이전 값인 `nextCounter`를 다시 덮어씁니다. 결과적으로 다음 작업에서 ID 충돌(`op-N` 중복)이 발생할 수 있습니다.

- **제안**: 렌더 중 `queueMicrotask`로 상태를 동기화하는 패턴 자체를 제거하고, `useEffect`로 이동하거나 `idState`를 `operations` 길이에 의존하는 파생 상태로 관리하지 말고 `commit()`에서만 단일 경로로 갱신합니다:
  ```ts
  useEffect(() => {
    setIdState((prev) => {
      if (prev.ids.length === operations.length) return prev;
      let counter = prev.counter;
      const ids = operations.map((_, i) => prev.ids[i] ?? `op-${counter++}`);
      return { ids, counter };
    });
  }, [operations.length]);
  ```

---

**[INFO]** 렌더 함수 내 `nextCounter++` 부수효과 (React strict mode에서 이중 실행)
- **위치**: `index.tsx` — 렌더 본문 `if (ids.length !== operations.length)` 블록
- **상세**: React의 Strict Mode는 렌더 함수를 두 번 호출하여 순수성을 검증합니다. `nextCounter++`는 로컬 변수이므로 실제 state를 오염시키지는 않지만, `queueMicrotask`가 두 번 등록되어 의도치 않은 상태 덮어쓰기가 발생할 수 있습니다.
- **제안**: 렌더 본문에서 모든 부수효과(`queueMicrotask` 포함)를 제거하고 `useEffect`로 이동합니다.

---

**[INFO]** `commit()`에서 `setIdState`와 `onChange` 분리 호출
- **위치**: `index.tsx` — `commit` 함수
- **상세**:
  ```ts
  const commit = (next, nextIds, counter = nextCounter) => {
    setIdState({ ids: nextIds, counter }); // 내부 state
    onChange({ ...config, operations: next }); // 부모 state
  };
  ```
  React 18의 자동 배칭(automatic batching) 덕분에 이벤트 핸들러 내에서는 두 업데이트가 함께 배칭됩니다. 그러나 `queueMicrotask`나 `setTimeout` 내에서 호출되면 배칭이 보장되지 않아 중간 렌더가 발생할 수 있습니다. `flushSync` 또는 단일 상태 소스로 통합하는 것이 더 안전합니다.
- **제안**: 중요도는 낮으나, ID 상태를 부모(config)와 함께 관리하거나, `ReactDOM.flushSync` 없이 두 상태를 하나의 reducer로 묶는 것을 고려합니다.

---

### 요약

이 코드셋은 JavaScript 단일 스레드 모델 위에서 동작하므로 전통적인 멀티스레드 경쟁 조건이나 데드락은 존재하지 않습니다. 그러나 `TransformConfig`(index.tsx)에서 렌더 중 `queueMicrotask`를 사용해 `idState`를 동기화하는 패턴이 React의 상태 업데이트 타이밍과 충돌하여, 빠른 연속 조작 시 `nextCounter`가 이전 값으로 롤백되는 실질적인 경쟁 조건을 만들어냅니다. 나머지 파일들(`apply-operation.ts`, 각 ops 컴포넌트, 타입 정의)은 순수 함수이거나 단방향 데이터 흐름을 따르므로 동시성 관련 문제가 없습니다.

### 위험도
**LOW** (단일 스레드 환경이나, 빠른 사용자 인터랙션에서 ID 충돌로 인한 UI 이상이 간헐적으로 재현될 수 있음)