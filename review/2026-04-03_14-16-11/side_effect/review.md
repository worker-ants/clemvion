## 발견사항

### 백엔드

- **[INFO]** `ExecutionEventType` 열거형에 `EXECUTION_RESUMED` 값 추가
  - 위치: `websocket.service.ts`
  - 상세: 기존 enum에 새 값을 추가하는 것은 하위 호환성이 유지됩니다. 기존 switch문이 exhaustive하지 않으면 새 값은 기본 처리(또는 무처리)됩니다.
  - 제안: 프론트엔드/다른 소비자에서 이 enum을 switch로 처리하는 곳에 `EXECUTION_RESUMED` 케이스가 추가되었는지 확인

- **[INFO]** `waitForFormSubmission`에서 `EXECUTION_STARTED` → `EXECUTION_RESUMED` 이벤트 교체
  - 위치: `execution-engine.service.ts:458-467`
  - 상세: 이전에는 폼 재개 시 `execution.started` 이벤트를 발화했으나, 이제 `execution.resumed`를 발화합니다. 이는 **의도된** 시맨틱 수정으로, 기존 `execution.started` 핸들러가 폼 재개 시 실행 상태를 초기화하는 부작용을 방지하는 올바른 변경입니다.
  - 제안: 없음

---

### 프론트엔드

- **[WARNING]** `handleExecutionStarted` 내부에서 `useExecutionStore.getState()` 직접 호출 (훅 외부 접근)
  - 위치: `use-execution-events.ts` — `handleExecutionStarted` callback 내
  - 상세: `useCallback` 클로저 안에서 `useExecutionStore.getState()`를 호출하는 것은 Zustand의 허용된 패턴이지만, 이 guard 로직(`currentStatus === "waiting_for_input"`인 경우 `resumeFromForm()` 호출)이 **이제 dead code**가 되었습니다. 백엔드가 더 이상 폼 재개 시 `execution.started`를 발화하지 않고 `execution.resumed`를 발화하므로, 이 분기는 실제로 도달되지 않습니다.
  - 제안: `handleExecutionStarted`에서 guard 분기를 제거하여 코드를 단순화. 불필요한 `useExecutionStore.getState()` 호출과 `resumeFromForm` 의존성도 함께 제거 가능

```ts
// 불필요해진 guard 코드
const { status: currentStatus } = useExecutionStore.getState();
if (currentStatus === "waiting_for_input") {
  resumeFromForm();
  return;
}
```

- **[INFO]** `handleExecutionResumed` 추가로 새 이벤트 리스너 등록
  - 위치: `use-execution-events.ts:287, 434`
  - 상세: `client.on`과 `client.off` 모두 대칭적으로 처리되어 메모리 누수 위험 없음. `useEffect` 의존성 배열에도 정상 포함됨.
  - 제안: 없음

- **[INFO]** `resumeFromForm` 의존성이 `useEffect` 의존성 배열에 누락
  - 위치: `use-execution-events.ts` — `useEffect` 의존성 배열 (마지막 부분)
  - 상세: `handleExecutionResumed`는 의존성 배열에 포함되었으나, `resumeFromForm` 자체는 포함되지 않았습니다. 다만 Zustand store의 액션은 참조가 안정적(stable)이므로 실제 문제는 발생하지 않습니다.
  - 제안: 명시성을 위해 `resumeFromForm`도 의존성 배열에 추가 고려

---

## 요약

변경의 핵심은 폼 재개 시 `execution.started` 대신 `execution.resumed` 이벤트를 사용함으로써 프론트엔드 상태가 불필요하게 초기화되는 기존 부작용을 제거하는 것입니다. 백엔드 변경은 안전하며 하위 호환성을 유지합니다. 가장 주목할 점은 프론트엔드의 `handleExecutionStarted` 내 guard 코드가 이제 dead code가 되었다는 것으로, 제거하지 않으면 코드 혼란을 야기할 수 있습니다. 이벤트 리스너 등록/해제는 대칭적으로 처리되어 메모리 누수 위험은 없습니다.

## 위험도

**LOW** — 의미적으로 올바른 변경이나, dead code 정리 필요