## 발견사항

---

### **[WARNING]** `MAX_STALL_ROUNDS` / `STALL_MAX_ATTEMPTS` 상수 이중 유지
- **위치**: `backend/workflow-assistant-stream.service.ts` (내부 상수) ↔ `frontend/src/lib/stores/assistant-store.ts:70` (`const STALL_MAX_ATTEMPTS = 2`)
- **상세**: SSE `auto_resume` 이벤트에는 `max` 필드가 실려오므로 **실시간 스트리밍 경로**는 정확하다. 그러나 rehydrate 경로(`hydrateMessage`)는 DB에 `max`가 저장되지 않아 프론트 상수를 fallback으로 쓴다. 백엔드에서 `MAX_STALL_ROUNDS`를 3으로 올리면 기존 세션의 divider가 "1/2", "2/2"로 오표기되어 UX 일관성이 깨진다. 주석으로 sync 의무를 고지했으나 런타임 보장이 없다.
- **제안**: `GET /sessions/{id}` 응답에 `sessionConfig.stallMaxRounds` 같은 메타를 포함하거나, `autoResumeAttempt`와 함께 `autoResumeMax`를 DB 컬럼으로 persist해 rehydrate 시 상수에 의존하지 않도록.

---

### **[WARNING]** `'auto_resume_pending'` 매직 스트링 — 상수 미정의
- **위치**: `workflow-assistant-stream.service.ts` (stall 복구 블록) → `persistAssistantTurn` 호출부
- **상세**: `finishReason='auto_resume_pending'`은 "중간 row"를 표시하는 DB 마커로 쓰이지만, 문자열 리터럴이 서비스 코드에 직접 삽입되어 있다. entity 쪽이나 별도 상수 파일에 정의된 것이 없다. 오타나 향후 rename 시 DB에 이미 기록된 값과 불일치가 발생한다.
- **제안**: `export const FINISH_REASON_AUTO_RESUME_PENDING = 'auto_resume_pending'` 상수를 entity 파일 또는 shared constants 모듈에 선언 후 참조.

---

### **[WARNING]** 스트리밍 루프의 mutable 로컬 상태 누적
- **위치**: `workflow-assistant-stream.service.ts:325–350` (`streamMessage` 내)
- **상세**: 이번 변경으로 루프 내 상태 변수가 `assistantText`, `pendingToolCalls`, `planForTurn`, `planPersisted`, `consecutiveStallRounds`, `totalToolCallsThisTurn`, `toolCallsBudget`, `finishResolved`으로 늘었다. 특히 `planPersisted`와 `consecutiveStallRounds`의 인터랙션(`if (planForTurn) planPersisted = true`가 stall 경계마다 호출)은 두 변수를 동시에 고려해야 정확한 동작을 추론할 수 있다. 루프 상태가 암묵적 상태 기계로 발전하고 있어 추후 버그 진원지가 될 위험이 있다.
- **제안**: 단기적으로는 인접한 상태 변수들을 객체로 묶어 (`turnState = { assistantText, pendingToolCalls, planPersisted }`) 리셋 로직을 함수로 캡슐화. 장기적으로는 루프를 명시적 상태 기계(State Machine)로 리팩토링 고려.

---

### **[INFO]** `handleSseEvent` 밖에서 `auto_resume` 특수 처리 — 유지보수 경계 모호
- **위치**: `frontend/src/lib/stores/assistant-store.ts:339–351` (`sendMessage` 내 onEvent 콜백)
- **상세**: `AssistantSseEvent` union에 `auto_resume`이 포함되어 있으나, `handleSseEvent` 내부에서는 처리하지 않는다. `sendMessage`의 onEvent 콜백이 가로채는 구조다. 두 진입점의 책임 경계가 암묵적이라, 향후 다른 기여자가 `handleSseEvent`에 `auto_resume` 케이스를 추가하거나 이 분기를 놓치면 이중 처리 또는 누락이 생긴다.
- **제안**: `handleSseEvent`의 JSDoc에 "이 함수는 `auto_resume`을 처리하지 않는다 — `applyAutoResumeEvent`를 참조하라"는 명시적 주석 추가. 또는 `handleSseEvent` 내에서 `auto_resume`을 받으면 no-op으로 처리해 union 소진을 명시.

---

### **[INFO]** `applyAutoResumeEvent`가 store 파일에서 export — 경계 노출
- **위치**: `frontend/src/lib/stores/assistant-store.ts:442–`
- **상세**: 테스트 편의를 위해 store 내부 함수를 public export하는 패턴이다. `set` 함수 타입을 직접 받아야 하므로 store 구현 세부사항에 결합된다. 테스트는 이 API에 의존하게 되어 내부 리팩토링 시 테스트도 함께 수정해야 한다.
- **제안**: 허용 가능한 트레이드오프지만, `assistant-store.utils.ts` 같은 별도 모듈로 분리하면 store 구현과 유틸리티의 경계가 명확해진다.

---

### **[INFO]** 에러 경로에서 `streaming=false` 일괄 스캔 범위 확대
- **위치**: `frontend/src/lib/stores/assistant-store.ts:376–381`
- **상세**: 원래 `m.id === assistantId` 단건 핀이었던 것이 `m.streaming` 일괄 스캔으로 변경됐다. `isStreaming` 가드가 동시 다중 스트림을 방지하므로 현재 구조에서 오동작 위험은 낮다. 그러나 방어 의도를 코드에서 읽기 어렵다.
- **제안**: 주석을 코드 바로 위에 1줄로 유지하되(`// safety net: close any bubble left streaming after auto_resume splits`), `invariant(openBubbles.length <= 1)` 같은 개발 환경 어서션 추가 고려.

---

## 요약

전체 아키텍처는 **백엔드 스트리밍 루프 → SSE 이벤트 프로토콜 → 프론트 스토어 → UI 렌더링**의 레이어 책임이 명확하게 유지되어 있고, `applyAutoResumeEvent` 추출과 `persistAssistantTurn` 기본 파라미터 패턴은 기존 호출부 변경을 최소화하는 좋은 선택이다. 가장 실질적인 아키텍처 위험은 `MAX_STALL_ROUNDS` / `STALL_MAX_ATTEMPTS` 상수의 수동 동기 의존으로, rehydrate 경로에서 표기 오류로 이어질 수 있다. 스트리밍 루프의 mutable 상태 변수 증가는 단기 위험은 낮지만 이 패턴이 계속되면 유지보수 부채가 쌓인다.

## 위험도

**LOW**