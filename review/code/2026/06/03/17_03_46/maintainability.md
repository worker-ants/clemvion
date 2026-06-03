# Maintainability Review

## 발견사항

### [WARNING] 인라인 timestamp·duration 렌더 패턴 4중 중복 — conversation-inspector.tsx
- **위치**: `conversation-inspector.tsx` diff, `SummaryView` 내 4곳 (라인 ~933, ~956~963, ~989~994, ~1016~1028)
- **상세**: `(item.timestamp || item.durationMs != null)` 조건 확인 → 조건부 구분자 `" · "` → 두 값 각각 조건부 렌더하는 동일 패턴이 인라인 JSX 로 4회 복사되어 있다. `result-timeline.tsx` 의 `TimelineRow` 내부에도 동일 패턴이 1회 추가되었다. 총 5곳에서 동일 로직이 인라인 반복된다.
- **제안**: `TimestampAndDuration` 또는 `ItemTimingBadge` 같은 작은 공유 컴포넌트로 추출한다. 예:
  ```tsx
  function ItemTimingBadge({ timestamp, durationMs, dateFormat }: {
    timestamp?: string; durationMs?: number; dateFormat?: "time-seconds" | "datetime";
  }) {
    if (!timestamp && durationMs == null) return null;
    return (
      <span className="...">
        {timestamp && <span>{formatDate(timestamp, dateFormat ?? "time-seconds")}</span>}
        {timestamp && durationMs != null && <span>·</span>}
        {durationMs != null && <span>{formatDuration(durationMs)}</span>}
      </span>
    );
  }
  ```
  이 컴포넌트 하나로 5곳의 중복을 제거할 수 있다.

---

### [WARNING] `new Date(callStartedAt).toISOString()` 패턴 4회 중복 — ai-agent.handler.ts
- **위치**: `ai-agent.handler.ts` diff, `+startedAt: new Date(callStartedAt).toISOString()` 4줄 (두 개의 call-loop 각 2회)
- **상세**: 백엔드에서 `callStartedAt` (number) → ISO string 변환을 동일 표현식으로 4군데 복사해 사용한다. `executeTool` 함수 내에서도 동일 변환이 수행된다. 변환 표현 자체는 단순하지만, 패턴이 분산되어 있어 나중에 포맷을 바꿀 때(예: UTC offset 추가, ms 정밀도 변경) 4곳을 모두 찾아야 한다.
- **제안**: 파일 상단에 `function toIso(epochMs: number): string { return new Date(epochMs).toISOString(); }` 를 추출하거나, 이미 존재한다면 해당 헬퍼를 재사용한다. 변환 지점이 1곳으로 줄어 추후 변경 범위가 명확해진다.

---

### [WARNING] 익명 인라인 타입 리터럴 중복 정의 — use-execution-events.ts 및 ai-agent.handler.ts
- **위치**:
  - `use-execution-events.ts` diff: `startedAt?: string; finishedAt?: string;` 가 라인 ~445~449 (`llmCalls` 배열 원소 타입), ~555~559 (두 번째 `llmCalls` 블록) 두 곳의 인라인 익명 객체 타입에 개별 추가
  - `ai-agent.handler.ts` diff: 라인 ~1194~1198 과 ~1970~1975 의 인라인 배열 원소 타입 리터럴에 각각 추가
- **상세**: 이미 `conversation-utils.ts` 에 `LlmCallEntry` 인터페이스가 정의되어 있으나 `use-execution-events.ts` 내 핸들러는 이를 재사용하지 않고 익명 인라인 타입을 반복 정의한다. 두 파일 모두 동일 형태의 인라인 타입이 2~3 곳에 걸쳐 있어 필드가 추가될 때마다 N곳을 모두 수정해야 한다.
- **제안**: `use-execution-events.ts` 에서 사용하는 `llmCalls` 배열 원소 타입을 `LlmCallEntry`(또는 공유 타입 파일의 `LlmCallDebugEntry`) 로 추출·재사용한다. `ai-agent.handler.ts` 내 인라인 배열 타입도 상단에 명명된 인터페이스로 올린다.

---

### [INFO] `toolStatusMapFromItems` 에서 `startedAt` 전파 누락 — conversation-utils.ts
- **위치**: `/Volumes/project/private/clemvion/.claude/worktrees/workflow-turn-timing-69fee2/codebase/frontend/src/lib/conversation/conversation-utils.ts` 의 `toolStatusMapFromItems` 함수 (라인 ~2588~2601)
- **상세**: `toolStatusMapFromDebug` 는 이번 변경에서 `startedAt` 을 `ToolStatusInfo` 에 채우도록 수정되었다. 그러나 live WS 이벤트 생존 시 호출되는 `toolStatusMapFromItems`(store 의 현재 items 에서 map 을 재구성)는 `startedAt` 을 map 에 담지 않는다(`ToolStatusInfo` 에 `startedAt` 이 추가된 후에도 해당 함수는 갱신되지 않았다). WS 핸들러가 `ai_message` snapshot 으로 교체 후 `tool_call_started` 이벤트가 없었던 경우 `startedAt` 이 소실될 수 있다.
- **제안**: `toolStatusMapFromItems` 가 item 의 `timestamp` 를 `startedAt` 으로 보존하도록 추가한다:
  ```ts
  map.set(item.toolCallId, {
    status: item.toolStatus,
    durationMs: item.durationMs,
    startedAt: item.timestamp,  // 추가
    error: item.error,
  });
  ```

---

### [INFO] 조건 표현식 `item.durationMs != null` vs `item.durationMs !== undefined` 혼용
- **위치**: `conversation-inspector.tsx` diff 전체 및 `result-timeline.tsx` diff
- **상세**: 같은 파일 내에서 `!= null`(null/undefined 양쪽 차단) 패턴과 `!== undefined`(undefined 만 차단, `execution-engine.service.ts` 수정부) 패턴이 혼용된다. `durationMs` 가 `0` 일 때 동작은 동일하지만 의도가 다르게 읽힐 수 있다. 기존 코드베이스는 `!= null` 패턴을 주로 사용하므로 새 추가 코드 일부(예: `use-execution-events.ts` 의 `if (payload.durationMs !== undefined)`)가 기존 패턴과 어긋난다.
- **제안**: `durationMs` 처럼 `0` 이 유효 값인 수치 필드에는 `!= null` 로 통일한다. 코드베이스 컨벤션과의 일관성 확보.

---

### [INFO] `finishedAt` 필드가 정의되었으나 프론트엔드 렌더에서 미사용
- **위치**: `LlmCallEntry`, `TurnToolCallEntry`, `ToolCallCompletedPayload` 등 전반
- **상세**: 이번 변경에서 `finishedAt` 이 백엔드·프론트 타입 양쪽에 추가되었으나, 렌더 레이어(`conversation-inspector.tsx`, `conversation-timeline-item.tsx` 등)에서 `finishedAt` 을 직접 참조하는 코드는 없다. `timestamp` 로 `startedAt` 만 사용하고 `finishedAt` 은 wire 에 담기기만 하고 현재 UI 에서는 소비되지 않는다. 이 자체는 문제가 아니지만 타입에 있는 필드가 렌더에서 쓰이지 않는다는 사실을 문서화하지 않으면 미래 개발자가 필드의 목적(durationMs 검증용 또는 미래 표시용)을 알 수 없다.
- **제안**: `LlmCallEntry` 및 `ToolStatusInfo` 의 `finishedAt` JSDoc 에 "현재 UI 렌더는 `startedAt`(= timestamp) 만 소비; `finishedAt` 은 wire 완전성 및 미래 표시·감사용으로 보존" 을 한 줄 추가한다.

---

## 요약

이번 변경은 백엔드에서 시작/종료 절대 시각을 수집해 WS 이벤트와 영속 디버그 데이터에 동봉하고, 프론트엔드 여러 surface 에서 이를 렌더하는 수직 피처다. 구조는 명확하고 spec 참조가 잘 되어 있으며 하위 호환 optional 설계도 적절하다. 주요 유지보수성 위험은 두 곳이다. 첫째, `conversation-inspector.tsx` 와 `result-timeline.tsx` 에 걸쳐 timestamp + durationMs 렌더 패턴이 5회 인라인 복사되어 있어 향후 포맷 변경 시 모두 수정해야 한다. 둘째, `use-execution-events.ts` 와 `ai-agent.handler.ts` 의 인라인 익명 타입 리터럴이 기존 `LlmCallEntry` 타입과 중복 정의되어 필드 추가 시 여러 곳을 동기화해야 한다. `toolStatusMapFromItems` 의 `startedAt` 누락(INFO)은 WS 이벤트 교체 시나리오에서 시각이 소실되는 실제 버그로 이어질 수 있으므로 확인이 필요하다.

## 위험도

LOW
