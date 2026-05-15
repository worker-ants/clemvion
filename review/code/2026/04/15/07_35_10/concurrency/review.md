## 발견사항

- **[WARNING]** `pendingContinuations` 무한 대기 — 취소 누락 시 메모리 누수 위험
  - 위치: `execution-engine.service.ts` — `waitForFormSubmission`, `waitForButtonInteraction`, `waitForAiConversation` 내 `new Promise(...)` 블록
  - 상세: 이전에는 내부 setTimeout이 최대 30분 후 자동으로 `pendingContinuations.delete(executionId)`를 호출하고 reject 또는 resolve로 Promise를 종결시켰다. 변경 후에는 외부 cancel만이 유일한 종결 수단이다. 클라이언트가 WebSocket을 끊거나 서버가 취소 이벤트를 누락하면, `resolve`/`reject` 클로저를 담은 Map 엔트리가 프로세스 재시작 전까지 영구적으로 남는다. 대기 중인 Node.js Promise 자체는 GC되지 않으며, 대화 turn마다 누적되는 경우 장기 운영 환경에서 메모리 압박으로 이어질 수 있다.
  - 제안: 취소 처리 경로에서 `pendingContinuations.get(executionId)?.reject(new ExecutionCancelledError())`가 반드시 호출됨을 보장하거나, WebSocket 연결 종료 이벤트(`disconnect` handler)에서 대기 중인 executionId를 자동으로 reject하는 안전망을 추가하세요.

---

- **[INFO]** `timeoutHandle` 조건부 검사 개선 — 올바른 변경
  - 위치: `execution-engine.service.ts:664` — `finally` 블록
  - 상세: 기존 `clearTimeout(timeoutHandle!)` 비-null 단언은 `timeoutMs === 0` 경로가 추가되면서 undefined 값을 전달할 수 있었다. `if (timeoutHandle) clearTimeout(timeoutHandle)`로 수정한 것은 정확하다.
  - 제안: 없음 (올바른 수정).

---

- **[INFO]** WS 이벤트 emit → `pendingContinuations.set` 순서 — Node.js 단일 스레드로 안전
  - 위치: `execution-engine.service.ts` — 버튼/폼 대기 직전 `emitExecutionEvent` 후 `new Promise(...)` 생성
  - 상세: WS 이벤트가 emit된 후 Promise 생성자가 실행되어 `pendingContinuations.set`이 호출된다. 빠른 클라이언트가 응답을 보내도, Node.js 이벤트 루프의 단일 스레드 특성상 현재 동기 실행 컨텍스트가 완전히 끝나기 전에 WebSocket 수신 핸들러가 실행될 수 없다. 따라서 set이 완료된 후에야 click 핸들러가 실행된다.
  - 제안: 없음. 단, 이 불변성이 NestJS WebSocket Gateway가 별도 Worker Thread를 사용하도록 설정된 경우에는 깨질 수 있으므로, 해당 가정을 코드 주석으로 명시하면 좋다.

---

- **[INFO]** `pendingContinuations` 덮어쓰기 위험 — 기존 이슈, 타임아웃 제거로 영향 확대
  - 위치: 모든 `pendingContinuations.set(executionId, ...)` 호출부
  - 상세: 동일 executionId로 두 번 대기에 진입하면 첫 번째 Promise가 영구적으로 미결 상태가 된다. 이전에는 타임아웃이 첫 번째 Promise를 자동 종결했으나, 변경 후에는 무한 누수가 된다. 실제로 이 경로가 발생할 수 있는지 검토가 필요하다.
  - 제안: `pendingContinuations.set` 호출 전 기존 엔트리를 확인하고 존재하면 reject로 방어 처리하는 것을 고려하세요.

---

## 요약

변경의 핵심은 여러 대기 지점(버튼, 폼, AI 대화 턴)의 내부 setTimeout 기반 타임아웃을 제거하고 외부 cancel에만 의존하는 구조로 전환한 것이다. Node.js 단일 스레드 모델 안에서 비동기 패턴 자체는 올바르게 구현되어 있으며, `Promise.race` 조건부 스킵과 `clearTimeout` 방어 처리 등 세부 수정도 정확하다. 가장 주목할 동시성 위험은 `pendingContinuations` Map의 수명 관리다. 타임아웃이 최후 안전망 역할을 했으나 제거된 지금, 취소 처리 경로의 신뢰성이 메모리 누수 여부를 전적으로 결정한다. 취소 핸들러가 항상 pending 항목을 reject하고 삭제함을 확인하거나, WebSocket disconnect 이벤트에서 자동 cleanup을 추가하는 것이 권장된다.

## 위험도

**LOW**