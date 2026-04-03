### 발견사항

- **[WARNING]** `handleExecutionStarted` 내 `waiting_for_input` 가드가 도달 불가능한 데드 코드로 전락
  - 위치: `frontend/src/lib/websocket/use-execution-events.ts`, `handleExecutionStarted` 콜백
  - 상세: 이번 변경으로 백엔드는 폼 재개 시 `execution.started` 대신 `execution.resumed`를 emit하도록 수정되었다. 따라서 `handleExecutionStarted` 내의 아래 가드는 실제로 실행될 수 없는 dead branch가 됨:
    ```ts
    const { status: currentStatus } = useExecutionStore.getState();
    if (currentStatus === "waiting_for_input") {
      resumeFromForm();
      return;
    }
    ```
  - 제안: 해당 guard block 및 `resumeFromForm` 의존성을 `handleExecutionStarted`에서 제거하여 의도를 명확히 할 것

- **[WARNING]** 폴링(REST)과 WebSocket 이벤트의 이중 경로로 인한 `resumeFromForm` 중복 호출 가능성
  - 위치: `use-execution-events.ts`, `pollExecutionStatus` 함수 및 `handleExecutionResumed` 콜백
  - 상세: 폼 재개 직후 실행 상태가 `WAITING_FOR_INPUT → RUNNING`으로 전환되는 시점에, 폴링이 `running` 상태를 감지하는 경로와 WebSocket `execution.resumed` 이벤트 도착 경로가 거의 동시에 실행될 수 있다. 현재 `pollExecutionStatus`에는 `resumed` 전환을 감지해 `resumeFromForm()`을 명시적으로 호출하는 로직이 없지만, 상태가 `running`으로 바뀐 후 다음 폴링 사이클에서 불일치가 발생할 수 있음. `resumeFromForm`의 멱등성(idempotency)에 전적으로 의존하는 구조.
  - 제안: `resumeFromForm` 스토어 액션이 이미 `running` 상태일 때 재호출해도 부작용이 없는지 명시적으로 검증할 것. 또는 폴링 경로에서 `waiting_for_input → running` 전환을 감지했을 때 `resumeFromForm()`을 호출하는 명시적 경로를 추가할 것

- **[INFO]** 타임아웃 핸들러와 `cancelWaitingExecution` 간의 논리적 경쟁
  - 위치: `execution-engine.service.ts`, `waitForFormSubmission` 내 `setTimeout` 콜백
  - 상세: `cancelWaitingExecution`이 `pendingContinuations`에서 항목을 삭제하고 reject한 뒤, 기존 타임아웃 콜백이 나중에 실행된다. 타임아웃 콜백은 `has()` 체크 후 항목이 없으면 아무것도 하지 않으므로 동작 상 안전하다. Node.js 이벤트 루프 단일 스레드 모델 덕분에 실제 race는 발생하지 않지만, 타임아웃 ID를 저장해 `clearTimeout`으로 명시적으로 정리하지 않아 불필요한 콜백이 대기열에 남는다.
  - 제안: `setTimeout` 반환값을 저장하고, `continueExecution` / `cancelWaitingExecution` 호출 시 해당 타이머를 명시적으로 `clearTimeout` 처리할 것

- **[INFO]** `pendingContinuations` Map의 스레드 안전성
  - 위치: `execution-engine.service.ts`, `pendingContinuations`
  - 상세: Node.js는 단일 이벤트 루프 기반이므로 Map에 대한 get/delete/set 연산은 원자적으로 실행됨. 현재 구현의 check-then-act 패턴(`has` → `delete` → `reject`)은 Node.js 환경에서 안전하다. 단, 클러스터(Cluster) 모드나 다중 프로세스 환경으로 확장 시 이 가정이 깨질 수 있음.

---

### 요약

이번 변경의 핵심은 폼 재개 시 `execution.started` 대신 `execution.resumed` 이벤트를 emit하도록 의미론적으로 분리한 것으로, 방향성 자체는 올바르다. 백엔드는 Node.js 단일 스레드 모델 덕분에 `pendingContinuations` 처리에서 실제 경쟁 조건은 발생하지 않는다. 다만 프론트엔드에서 이전 가드 코드(`handleExecutionStarted`의 `waiting_for_input` 분기)가 제거되지 않고 데드 코드로 남아 혼란을 유발하며, REST 폴링과 WebSocket 이벤트 이중 경로에서의 `resumeFromForm` 중복 호출 가능성은 스토어 멱등성 보장 여부에 따라 실질적인 상태 불일치로 이어질 수 있다.

### 위험도

**LOW**