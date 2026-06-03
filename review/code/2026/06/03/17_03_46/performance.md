# 성능(Performance) Review

## 발견사항

### **[INFO]** `new Date(callStartedAt).toISOString()` — 반복적 Date 객체 생성
- 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts` +756, +772, +806/807, +833/834, +843/844
- 상세: LLM 호출마다 `new Date(callStartedAt).toISOString()` 이 실행된다. `Date` 객체 생성은 cheap 하지만, 동일 `callStartedAt` 값을 두 번 사용하는 경우(startedAt, finishedAt 을 각각 `new Date()` 로 캡처)가 중복 계산처럼 보일 수 있다. 실제로는 `startedAt`과 `finishedAt`은 서로 다른 시각을 포착해야 하므로 두 번 호출이 의도된 것이다. 다만 `new Date(Date.now()).toISOString()` 보다 `new Date().toISOString()` 이 더 짧고 동일 결과이므로 `new Date(callStartedAt).toISOString()` 부분은 단순화 가능 — 기능적 성능 이슈는 아니다.
- 제안: 특별 수정 불필요. LLM 호출 빈도(수십 ms 단위 per-call)에서 Date 객체 생성 비용은 무시 가능.

---

### **[INFO]** `formatDate` 렌더 시 매 render 호출마다 `new Date(...)` + `toLocaleTimeString` 실행
- 위치: `codebase/frontend/src/lib/utils/date.ts` `formatDate` + `conversation-timeline-item.tsx`, `result-timeline.tsx`, `conversation-inspector.tsx` 등 렌더 경로
- 상세: `formatDate(item.timestamp, "time-seconds")` 는 매 렌더(React reconcile)마다 `new Date(date)` 와 `toLocaleTimeString` 을 실행한다. `toLocaleTimeString` 은 Intl 내부 포맷터를 재생성하는 엔진이 있고, React 컴포넌트 리렌더 빈도가 높은 live 실행 중(WS 이벤트마다 store 업데이트 → 리렌더)에는 비용이 누적될 수 있다. 현재 timestamp 는 ISO string 이고 컴포넌트 per-item 이므로, 동일 timestamp 값이 반복 포맷되는 경우가 많다.
- 제안: 빈도가 높은 live 실행 타임라인에서 같은 `timestamp` 값이 연속 리렌더 된다면 `useMemo` 또는 모듈 레벨 `Map<string, string>` 캐시(LRU)를 고려할 수 있다. 단, 일반 페이지 로드(실행 내역 재구성) 경로에서는 한 번만 렌더되므로 현 구현으로 충분하다. 리렌더 빈도가 높은 live 경로에서 성능 문제가 관찰되면 그때 최적화한다.

---

### **[INFO]** `toolStatusMapFromItems` — `startedAt` 미전파
- 위치: `codebase/frontend/src/lib/conversation/conversation-utils.ts` lines ~2588-2601 (전체 컨텍스트)
- 상세: `toolStatusMapFromItems` 는 기존 `ConversationItem` 배열에서 `ToolStatusInfo` Map 을 재구성할 때 `durationMs` / `error` 는 보존하지만 `startedAt` 을 포함하지 않는다. 이 함수는 `ai_message` 스냅샷이 타임라인을 교체할 때 기존 `tool_call_completed` 상태를 보존하는 용도이므로, `startedAt` 이 누락되면 tool 아이템 타임스탬프가 교체 후 사라진다.
- 제안: 기능 정확성 관련이나 성능과 직결되지는 않는다. 다만 불필요한 두 번째 timestamp 재조회(live 이벤트 재수신)를 방지해 reconcile 횟수를 줄이려면 `map.set(item.toolCallId, { status: ..., durationMs: ..., startedAt: item.timestamp, error: ... })` 로 전파하는 편이 낫다. 현재는 `tool_call_completed` 에서 `startedAt` 이 `patch.timestamp` 로 덮어쓰이는 별도 코드 경로가 있어 보정되지만, 이중 경로는 불필요한 복잡성이다.

---

### **[INFO]** WS 이벤트 핸들러에서 `new Date().toISOString()` 폴백 — client clock 의존
- 위치: `codebase/frontend/src/lib/websocket/use-execution-events.ts` +618, +148
- 상세: `timestamp: payload.startedAt ?? new Date().toISOString()` 에서 `payload.startedAt` 이 없는 레거시 이벤트의 경우 클라이언트 현재 시각을 사용한다. 이는 네트워크 레이턴시만큼 부정확해질 수 있다. 성능 비용 자체는 없으나 live/history 시각 불일치(기능 이슈)가 생긴다. 폴백 자체는 하위호환 코드이므로 새 서버 배포 후에는 영향 없다.
- 제안: 폴백 경로에서 `undefined` 를 그대로 전달하고 UI 에서 결측 처리(`—`)하는 방안이 더 정직하다. 다만 기존 동작 유지를 위한 선택이므로 필수 수정은 아니다.

---

### **[INFO]** `conversation-inspector.tsx` 렌더 중 인라인 string concatenation 패턴 반복
- 위치: `codebase/frontend/src/components/editor/run-results/conversation-inspector.tsx` 다수 지점 (SummaryView, ToolDetail 등)
- 상세: 여러 위치에서 다음 패턴이 반복된다:
  ```
  {item.timestamp ? formatDate(item.timestamp, "time-seconds") : ""}
  {item.timestamp && item.durationMs != null ? " · " : ""}
  {item.durationMs != null ? `${item.durationMs}ms` : ""}
  ```
  이 로직이 컴포넌트에 5~6회 복사되어 있어 매 렌더마다 동일 조건 평가가 중복 실행된다. 성능 영향은 미미하지만 조건이 복잡해 실수 가능성이 있다.
- 제안: 재사용 가능한 `<TimestampBadge timestamp={...} durationMs={...} />` 컴포넌트로 추출하면 렌더 로직 중복을 제거하고 불필요한 조건 연산 횟수를 줄일 수 있다. 현재 성능 임계를 넘는 수준은 아니다.

---

## 요약

이번 변경은 실행 타임라인의 디버깅 시각 데이터 추가가 핵심이며, 성능 측면에서 심각한 문제는 없다. 백엔드는 이미 `Date.now()` 로 측정하던 값을 ISO string 으로 직렬화해 기존 JSONB 필드에 동봉할 뿐이라 DB 마이그레이션도 없고 추가 쿼리도 없다. 프론트엔드는 `formatDate` 호출이 리렌더 경로에 추가되었으나, 현재 아이템 수와 리렌더 빈도 수준에서는 실질적 병목이 되기 어렵다. `toolStatusMapFromItems` 에서 `startedAt` 이 전파되지 않는 점은 일부 중복 reconcile 을 유발할 수 있으나 성능보다는 기능 정확성 관점의 이슈다. `conversation-inspector.tsx` 에서 타임스탬프 렌더 코드가 5회 이상 복사된 점은 향후 유지보수 비용을 올리며 작은 중복 연산을 낳으나, 컴포넌트 추출로 해결 가능하다.

## 위험도

LOW
