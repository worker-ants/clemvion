### 발견사항

- **[WARNING]** 스트리밍 종료 후 cleanup의 잠재적 경쟁 조건
  - 위치: `frontend/src/lib/stores/assistant-store.ts` — `sendMessage` 종료 구간
  - 상세: `set({ isStreaming: false, ... })` 호출 직후 `await get().refreshSessions()` 가 이벤트 루프를 양보한다. 이 구간에서 `approveActivePlan` / `continueAfterBudget` 버튼 클릭 등으로 두 번째 `sendMessage` 가 진입하면, 두 번째 스트림이 `streaming: true` 인 새 assistant row 를 push 한다. 이어서 첫 번째 스트림의 cleanup `set(s => ({ messages: s.messages.map(m => m.streaming ? { ...m, streaming: false } : m) }))` 가 실행되면 **현재 진행 중인 두 번째 스트림의 스트리밍 지시자를 강제 종료**한다. 원래 코드는 `m.id === assistantId` 로 단일 row 만 pinpoint 했으나, 이번 변경에서 `m.streaming` 전체 스캔으로 교체되면서 이 문제가 새로 생겼다.
  - 제안: cleanup set 에서 현재 턴의 row id 집합(assistantId + auto_resume 로 생성된 nextId 목록)을 클로저로 닫아 해당 id 들만 finalize 한다. 예: `let ownedIds = new Set([assistantId])`, `applyAutoResumeEvent` 반환값을 받을 때마다 `ownedIds.add(nextId)`, cleanup 시 `m.streaming && ownedIds.has(m.id) ? { ...m, streaming: false } : m`.

- **[INFO]** `STALL_MAX_ATTEMPTS` 상수 이중 관리
  - 위치: `frontend/src/lib/stores/assistant-store.ts:72` (`STALL_MAX_ATTEMPTS = 2`)
  - 상세: 백엔드의 `MAX_STALL_ROUNDS` 와 동일한 값을 프론트가 별도 상수로 복제한다. rehydrate 시 서버가 persist 한 `autoResumeAttempt` 만 있고 `max` 는 이 상수에서 조합한다. 두 값이 desync 되면 "N/M" 표시가 잘못된다. 동시성 문제는 아니나 정합성 위험.
  - 제안: 서버가 `GET /sessions/{id}` 응답이나 SSE `done` 이벤트에 `maxStallRounds` 를 포함해 내려주거나, `autoResumeAttempt` / `max` 를 `auto_resume` SSE + persist row 둘 다에 실어 단일 출처로 유지한다. (현재 SSE 에는 `max` 가 포함되어 실시간 경로는 정확하나, rehydrate 경로만 상수에 의존한다.)

- **[INFO]** 중간 row persist 실패 시 planPersisted 미설정
  - 위치: `backend/src/modules/workflow-assistant/workflow-assistant-stream.service.ts` — stall 복구 블록
  - 상세: `await this.persistAssistantTurn(...)` 가 예외를 throw 하면 `if (planForTurn) planPersisted = true` 라인에 도달하지 못한다. 이후 에러 catch 블록에서 최종 persist 가 `planPersisted ? null : planForTurn` 으로 plan 을 다시 싣는다. 중복 persist 가 일어나는 것은 아니지만(에러 경로에서 루프가 종료되므로), throw 로 인해 `assistantText = ''; pendingToolCalls = [];` 커서 리셋도 수행되지 않아, 에러 경로 persist 에서 이미 중간 row 에 포함된 text/toolCalls 가 다시 실린다. 동일 내용이 두 row 에 중복될 수 있다.
  - 제안: `persistAssistantTurn` 호출을 `try/finally` 또는 성공 분기만 `planPersisted` 를 세팅하도록 유지하되, 에러 catch 에서 커서를 확인하거나 중간 persist 성공 여부를 별도 플래그(`midRowPersisted`)로 구분해 처리한다.

- **[INFO]** PostgreSQL DDL — 안전
  - 위치: `backend/migrations/V020__assistant_message_auto_resume.sql`
  - 상세: `ADD COLUMN ... NOT NULL DEFAULT false` 는 PostgreSQL 11+ 에서 테이블 리라이트 없이 메타데이터만 갱신한다. nullable 컬럼 2개도 instant DDL. 대규모 테이블에서도 배포 중 잠금 없이 안전하다.

---

### 요약

변경 범위의 핵심 흐름(SSE 이벤트 처리 → 상태 업데이트 → DB persist)은 JavaScript 단일 스레드 모델 덕분에 내부 경쟁 조건 위험이 낮다. 그러나 프론트엔드 `sendMessage` 의 cleanup 로직이 `await refreshSessions()` 전후로 분리되면서, 첫 번째 스트림 종료와 두 번째 스트림 시작 사이의 이벤트 루프 양보 구간에서 두 번째 스트림의 `streaming` 상태가 조기 종료될 수 있는 경쟁 조건이 도입되었다. 이 변경은 `m.id === assistantId` 에서 `m.streaming` 전체 스캔으로 교체된 결과이며, 이번 PR 에서 신설된 multi-row 분리 패턴을 올바르게 finalize 하려는 의도였지만 더 좁은 id 스코프로 해결 가능하다. 나머지 항목(상수 이중 관리, 중간 row 에러 경로)은 동시성보다는 정합성 우려이며 LOW 수준이다.

### 위험도

**LOW**