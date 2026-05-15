## 발견사항

### [WARNING] `emitRunStarted` 가 try 블록 외부에서 호출됨
- **위치**: `background-execution.processor.ts:48~49`
- **상세**: `emitRunStarted()` → `websocketService.emitBackgroundRunEvent()` → `gateway.broadcastToChannel()` 가 socket.io 상태에 따라 throw 할 수 있음. try 블록 외부이므로 WS 레이어 오류가 실제 서브그래프 실행 자체를 막아 BullMQ 잡이 실패로 처리됨.
- **제안**: `emitRunStarted` 를 try 블록 안으로 이동하거나, `try { this.emitRunStarted(data, runStartedAt); } catch {}` 로 WS 오류를 격리

---

### [WARNING] catch 블록에서 `emitRunCompleted` throw 시 알림 미발송
- **위치**: `background-execution.processor.ts:58~66`
- **상세**: catch 내부에서 `emitRunCompleted(data, 'failed', ...)` 가 먼저 호출되고 그것이 throw 하면 `dispatchFailureNotification` 은 실행되지 않음. 원래 에러도 새 에러로 교체됨.
- **제안**: `emitRunCompleted` 를 `try { } catch {}` 로 감싸거나 finally 에 이동

---

### [WARNING] 성공 경로에서 `emitRunCompleted` throw 시 잡이 실패 처리됨
- **위치**: `background-execution.processor.ts:54~56`
- **상세**: 서브그래프 실행은 성공했으나 WS emit 이 throw 하면 BullMQ 는 잡을 실패로 마킹해 불필요한 재시도를 유발할 수 있음. 실제 실행 결과와 잡 상태가 불일치.
- **제안**: `emitRunCompleted` 를 `try { ... } catch (e) { this.logger.warn(...) }` 로 감싸 WS 오류가 잡 상태에 영향 주지 않도록 격리

---

### [WARNING] Legacy Background 노드에서 빈 `<div>` 렌더링 (시각 부작용)
- **위치**: `result-detail.tsx:1075~1083`
- **상세**: `nodeType === "background" && executionId` 가 참이면 `border-t` 를 가진 `<div>` 가 항상 렌더링됨. `BackgroundRunSection` 이 `backgroundRunId === null` 일 때 `null` 을 반환하므로 컨테이너 `<div>` 만 남아 레거시 노드에서 불필요한 구분선이 노출됨.
- **제안**: `backgroundRunId` null 체크를 외부 조건에 포함: `result.nodeType === "background" && executionId && extractBackgroundRunId(result.outputData) && (...)`

---

### [INFO] BullMQ 큐에 남은 기존 잡의 `backgroundRunId` 필드 부재
- **위치**: `background-execution.queue.ts:17`
- **상세**: `backgroundRunId: string` (옵셔널 아님) 으로 타입이 선언됐으나 이미 큐에 enqueue 된 잡은 이 필드가 없어 런타임에 `undefined`. `!!data.backgroundRunId` 체크가 이를 처리하므로 기능 파괴는 없지만, TypeScript 타입이 운영 중인 큐 상태와 불일치.
- **제안**: 하위 호환을 명시하려면 `backgroundRunId?: string` 또는 `backgroundRunId: string | undefined` 로 타입 변경 고려

---

### [INFO] `use-background-run.ts` — `queryKey` stale closure
- **위치**: `use-background-run.ts:67~100`
- **상세**: `useEffect` 는 `backgroundRunId` 만 deps 로 갖지만 `handler` 내부에서 참조하는 `queryKey` 는 `executionId` 도 포함함. `backgroundRunId` 불변 상태에서 `executionId` 가 바뀌면 WS 이벤트가 구 `queryKey` 를 invalidate 하여 새 쿼리에 실시간 갱신이 도달하지 않음.
- **제안**: `// eslint-disable-next-line` 를 제거하고 `useEffect` deps 에 `executionId` 추가, 또는 `handler` 안에서 `queryClient.invalidateQueries({ queryKey: [QUERY_KEY, executionId, backgroundRunId] })` 를 직접 계산

---

### [INFO] `query-background-run.dto.ts` JSDoc 와 구현 불일치
- **위치**: `query-background-run.dto.ts:8`
- **상세**: 주석은 cursor 를 `{ lastCreatedAt, lastId }` 라 설명하지만 `BackgroundRunsService` 구현은 `{ s: startedAt, i: id }` 를 사용. 클라이언트 혼란 가능.
- **제안**: 주석을 `{ s: ISO8601 startedAt, i: NodeExecution.id }` 로 수정

---

### [INFO] `Notification` 엔티티 이중 Repository 등록
- **위치**: `executions.module.ts:24`
- **상세**: `Notification` 이 `NotificationsModule` 과 `ExecutionsModule` 양쪽에 `forFeature` 로 등록됨. 같은 DB 테이블을 읽으므로 데이터 정합성 문제는 없으나 의존성 관계가 암시적으로 복잡해짐.
- **제안**: 현 구현은 기능적으로 안전하나, 장기적으로 `NotificationsModule` 을 `exports` 에 추가하거나 별도 shared repository 모듈로 분리 고려

---

## 요약

전반적인 부작용 위험은 **낮음**이다. 새 기능은 대부분 기존 흐름에서 격리된 read-only 경로로 설계되었고, BullMQ 잡의 레거시 호환 fallback(`!!data.backgroundRunId` 가드)도 적절히 배치되어 있다. 다만 `emitRunStarted` 가 try 블록 밖에 위치해 WebSocket 레이어의 예외가 실제 서브그래프 실행 자체를 차단할 수 있는 점이 가장 실질적인 위험이다. 이 호출 위치를 try 안으로 옮기거나 오류를 격리해야 잡 실행 안정성이 보장된다. `emitRunCompleted` 도 동일 이유로 오류 격리가 권장된다.

## 위험도

**LOW** (단, `emitRunStarted` try 블록 외부 배치는 MEDIUM 수준의 운영 리스크)