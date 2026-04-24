## 발견사항

### **[WARNING]** abort 경로에서 stall-recovery 버블 streaming 미확정

- **위치**: `frontend/src/lib/stores/assistant-store.ts` catch 블록 abort 분기
- **상세**: `applyAutoResumeEvent`로 생성된 새 버블은 `assistantId`가 아닌 새 `nextId`를 가진다. abort 시 catch 블록이 `return;`으로 조기 종료해 안전망 `set(m.streaming → false)` 스캔이 실행되지 않으므로, 마지막 stall-recovery 버블이 `streaming: true` 상태로 남는다.
  ```typescript
  if (abort.signal.aborted) {
    set({ isStreaming: false, streamingMessageId: null, ... });
    return; // 안전망 set() 미실행 → 새 버블 streaming: true 잔류
  }
  ```
- **제안**: abort 분기 내에서도 `m.streaming ? {...m, streaming: false} : m` 스캔을 포함하거나, `set({ isStreaming: false, ... })` 대신 아래 안전망 블록으로 통합 처리:
  ```typescript
  set((s) => ({
    messages: s.messages.map((m) => m.streaming ? {...m, streaming: false} : m),
    isStreaming: false, streamingMessageId: null, abortController: null,
  }));
  return;
  ```

---

### **[WARNING]** `STALL_MAX_ATTEMPTS` 프론트 상수가 백엔드 `MAX_STALL_ROUNDS`와 수동 동기화 필요

- **위치**: `frontend/src/lib/stores/assistant-store.ts:67`, `hydrateMessage`
- **상세**: `STALL_MAX_ATTEMPTS = 2`는 백엔드 `MAX_STALL_ROUNDS`의 복사본으로 명시되어 있다. rehydrate 시 서버가 `autoResumeAttempt=1`만 리턴해도 `max`를 이 상수로 채우므로, 백엔드 값이 바뀌면 divider가 "1/3"이 아닌 "1/2"로 표시된다. 코드 주석이 경고하고 있으나 코드 리뷰·배포 프로세스 외에 강제 수단이 없다.
- **제안**: 단기적으로는 수용 가능하나, 서버 응답의 `auto_resume` SSE 이벤트에 `max` 필드가 이미 포함되어 있으므로 rehydrate 시에도 서버가 `autoResumeMax`를 응답 필드로 내려주면 상수 의존을 제거할 수 있다 (스펙 확장 고려).

---

### **[WARNING]** stall 복구 라운드에서 새 `propose_plan` 발행 시 plan 유실

- **위치**: `backend/src/modules/workflow-assistant/workflow-assistant-stream.service.ts` 중간 row persist 블록
- **상세**: 중간 row persist 후 `planPersisted = true`가 세팅된다. 이후 복구 라운드에서 LLM이 새 `propose_plan`을 발행해 `planForTurn`이 교체되더라도, 최종 persist는 `planPersisted ? null : planForTurn` → `null`을 저장한다. 새 plan이 DB에 기록되지 않아 세션 rehydrate 시 plan card가 누락된다.
  ```typescript
  if (planForTurn) planPersisted = true; // 복구 라운드의 새 plan도 차단
  ```
- **제안**: `planPersisted` 플래그를 plan ID 기반으로 추적하거나, 복구 라운드에서 `planForTurn`이 교체될 경우 플래그를 리셋하는 로직 추가. 단, 이 시나리오는 stall 중 새 plan 제안이라 실제 발생 빈도는 낮다.

---

### **[INFO]** max-stall 테스트에서 최종 row `autoResumeReason` 미검증

- **위치**: `workflow-assistant-stream.service.spec.ts` "gives up after MAX_STALL_ROUNDS" 테스트
- **상세**: `persistCalls[2].autoResumed === true`와 `autoResumeAttempt === 2`는 검증하나, `autoResumeReason === 'stall_pending_steps'`는 검증하지 않는다. 단일 이유 한 종류라 현재는 문제없지만 향후 reason 추가 시 회귀 포착이 늦어질 수 있다.
- **제안**: `expect(persistCalls[2].autoResumeReason).toBe('stall_pending_steps')` 추가.

---

### **[INFO]** `auto_resume` SSE 예시 위치가 spec flow 순서와 맞지 않음

- **위치**: `spec/3-workflow-editor/4-ai-assistant.md` §5 SSE 예시 블록
- **상세**: `auto_resume` 이벤트 예시가 `tool_call` 뒤에 배치되어 있는데, 실제 구현에서 `auto_resume`은 중간 row persist 완료 후 yield된다. 정상적인 stall 시나리오에서는 tool_call 없이 text + stop → `auto_resume` 순서이므로, 예시가 혼동을 줄 수 있다.
- **제안**: 예시를 tool_call 없는 stall 시나리오로 수정하거나, 주석으로 "text-only stall 이후 발행" 명시.

---

## 요약

요구사항(spec §10) 관점에서 핵심 기능—서버의 stall 경계 row 분리 persist, `auto_resume` SSE 발행, 프론트의 버블 분리 렌더, rehydrate 시 divider 복원—은 완전히 구현되어 있고 정상/max-stall/no-stall 3가지 시나리오의 테스트 커버리지도 충분하다. 다만 **abort 경로에서 마지막 stall-recovery 버블이 `streaming: true`로 잔류하는 버그**와 **복구 라운드 중 신규 plan 발행 시 DB 미저장 edge case**가 요구사항의 "세션 복원" 보장을 부분적으로 위반한다. `STALL_MAX_ATTEMPTS` 수동 동기화는 유지보수 리스크로 관리 필요.

## 위험도

**MEDIUM** — 주 기능은 동작하나, abort 경로의 streaming 미확정과 복구 중 plan 유실 edge case가 프로덕션에서 재현 가능하다.