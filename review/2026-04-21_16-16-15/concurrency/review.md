### 발견사항

---

**[WARNING] `sendMessage`의 TOCTOU 경쟁 조건 — 신규 세션 생성 경로**
- 위치: `frontend/src/lib/stores/assistant-store.ts`, `sendMessage` 함수
- 상세: `isStreaming` 가드를 동기적으로 확인한 뒤, `sessionId`가 없을 때 `await assistantApi.createSession()`을 호출한다. 이 `await`에서 이벤트 루프에 제어권이 반환되므로, 첫 메시지 전송 중에 두 번째 `sendMessage` 호출이 들어오면 두 호출 모두 가드를 통과한다. `isStreaming: true` 설정이 세션 생성 이후에 이루어지기 때문이다. 결과적으로 세션이 중복 생성되고 두 개의 스트림이 동시에 열릴 수 있다.
- 제안: 세션 존재 여부와 무관하게, 가드 직후 동기 구간에서 즉시 `isStreaming: true`를 설정한다.
  ```typescript
  const state = get();
  if (state.isStreaming) return;
  set({ isStreaming: true, error: null }); // 가드 직후 즉시 선점
  // 이후 세션 생성 await ...
  ```

---

**[WARNING] Zustand 상태 직접 변이 — `handleSseEvent` 및 `approveActivePlan`**
- 위치: `assistant-store.ts`, `handleSseEvent` 내 plan step 갱신 / `approveActivePlan`
- 상세:
  1. `handleSseEvent`의 plan step 업데이트:
     ```typescript
     for (const other of [...s.messages].reverse()) {
       if (other.plan) {
         other.plan.steps = other.plan.steps.map(...); // 원본 plan 객체 직접 변이
         break;
       }
     }
     ```
     `[...s.messages]`는 배열의 얕은 복사본이지만, `other`는 원본 상태 내의 객체를 가리킨다. `other.plan.steps =` 할당은 Zustand store 내부 상태를 직접 변이시킨다.
  2. `approveActivePlan`:
     ```typescript
     plan.plan.approved = true; // Zustand 상태 객체 직접 변이
     ```
     이후 `set()`으로 새 객체를 만들지만, 변이가 먼저 일어나 React의 불변성 가정을 깨며 인접 렌더 사이클에서 stale reference 문제가 생긴다.
- 제안: 두 곳 모두 `set()` 콜백 내에서 스프레드로 새 객체를 생성하도록 수정. `handleSseEvent`의 step 갱신은 `set()` 내 `s.messages.map()` 체인으로 통합한다.

---

**[WARNING] `appendMessage`의 비원자 DB 연산**
- 위치: `backend/src/modules/workflow-assistant/workflow-assistant-session.service.ts`, `appendMessage`
- 상세: 세 개의 별도 DB 호출이 트랜잭션 없이 순차 실행된다.
  ```typescript
  await this.messageRepo.save(msg);          // (1)
  await this.sessionRepo.update(sessionId, {...}); // (2)
  await this.sessionRepo.increment(..., 'messageCount', 1); // (3)
  ```
  한 세션에서 두 메시지가 동시에 저장될 경우(예: 사용자 메시지와 어시스턴트 응답이 겹치는 경우), (2)의 `lastInteractionAt`이 더 이른 타임스탬프로 덮어써질 수 있고, (3)의 `increment`는 PostgreSQL 레벨에서는 원자적이지만 (1)→(2)→(3) 전체가 원자적이지 않아 부분 실패 시 카운트가 실제 행 수와 불일치하게 된다.
- 제안: TypeORM의 `DataSource.transaction()` 또는 `@Transactional()` 데코레이터로 세 연산을 하나의 트랜잭션으로 묶는다.

---

**[INFO] `chatStream` `finally`에서의 fire-and-forget 사용 로그**
- 위치: `backend/src/modules/llm/llm.service.ts`, `chatStream` finally 블록
- 상세: `void this.usageLogService.record(...)` 형태로 로깅을 비동기 발사 후 망각한다. 프로세스 종료 시 로그가 유실되고, 내부 오류가 무음으로 삼켜진다.
- 제안: 로그 실패를 에러로 전파할 필요는 없으나, 최소한 `.catch(err => this.logger.warn(...))` 체이닝으로 관찰 가능성을 확보한다.

---

**[INFO] `sendMessage` 비-abort 오류 경로에서 중복 `set()` 호출**
- 위치: `assistant-store.ts`, `sendMessage` 함수
- 상세: abort가 아닌 예외 발생 시 catch 블록 안에서 `set({ isStreaming: false, ... })`를 호출하고 `return` 없이 빠져나오면, try/catch 이후의 `set({ isStreaming: false, ... })`와 `refreshSessions()`가 추가로 실행된다. 기능 오류는 없으나 의도치 않은 동작(오류 발생 시 세션 리프레시 등)이 유발된다.
- 제안: catch 블록 비-abort 분기에 명시적 `return`을 추가하거나, 에러 경로와 정상 경로의 finally 처리를 통합한다.

---

### 요약

전반적인 스트리밍 파이프라인(LLM 클라이언트 → 서비스 → SSE 컨트롤러)은 `AbortSignal` 전파, `AsyncIterable` 체이닝, keepalive 인터벌 정리 등을 올바르게 구현하고 있다. 주요 위험은 두 군데에 집중된다: 프론트엔드 `assistant-store`의 신규 세션 생성 경로에서 `isStreaming` 가드 선점이 늦어 발생하는 TOCTOU와, plan step 상태 갱신 및 plan 승인 시 Zustand 상태를 직접 변이시키는 패턴이다. 백엔드에서는 `appendMessage`의 비트랜잭션 다중 DB 호출이 동시 메시지 삽입 시 카운터 불일치를 야기할 수 있다. JavaScript의 단일 스레드 특성상 데드락 위험은 없으나, 비동기 경계에서의 TOCTOU와 불변성 위반은 실제 버그로 이어질 수 있다.

### 위험도

**MEDIUM**