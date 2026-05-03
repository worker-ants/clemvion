## 발견사항

### WARNING: `aiMetadata` / `turnRefIndex` 미메모이제이션 — 매 렌더 재계산
- **위치**: `result-detail.tsx` — `ResultDetail` 컴포넌트 렌더 함수 내 (diff +852~+858)
- **상세**: `extractAiMetadata(result.outputData)`는 매 렌더마다 실행된다. 내부적으로 `unwrapNodeOutput` → `extractTurnDebug`(턴당 `extractRagSources` + `extractRagDiagnostics`) 를 순차 호출하며, 20턴 × 5 chunk = ~100개 객체를 매 렌더마다 새로 생성한다. `turnRefIndex = new Map(aiMetadata?.turnDebug.map(...))` 도 동일 렌더에서 매번 새 Map과 임시 배열을 할당한다. `ResultDetail`은 WebSocket 메시지, 탭 클릭, 메시지 선택 등 모든 상호작용에서 재렌더되므로 실제 체감 빈도가 높다.
- **제안**:
  ```tsx
  const aiMetadata = useMemo(
    () => extractAiMetadata(result.outputData),
    [result.outputData],
  );
  const turnRefIndex = useMemo(
    () => new Map(aiMetadata?.turnDebug.map((t) => [t.turnIndex, t.ragSources]) ?? []),
    [aiMetadata],
  );
  ```

---

### WARNING: 렌더 중 `setState` 호출 — 불필요한 렌더 사이클
- **위치**: `result-detail.tsx` — `ResultDetail` 렌더 함수 내 (diff +830~+838)
- **상세**: `if (result && activeTabNodeId !== result.nodeId) { setActiveTabNodeId(...); setActiveTab(...); setHighlightTurnIndex(null); }` 구문이 렌더 함수 본문에 위치한다. React는 렌더 중 setState를 허용하지만 즉시 재렌더를 유발해 노드 전환 시 렌더 사이클이 2회 실행된다. `setActiveTabNodeId` → `setActiveTab` → `setHighlightTurnIndex` 세 setState가 개별 호출되므로 배치 처리 여부에 따라 최대 3회 re-render까지 발생 가능하다.
- **제안**: `useEffect` + 의존성 배열 패턴으로 전환하거나, 세 상태를 `useReducer`로 묶어 단일 dispatch로 처리:
  ```tsx
  useEffect(() => {
    if (!result) return;
    setActiveTabNodeId(result.nodeId);
    setActiveTab(result.error ? "error" : "preview");
    setHighlightTurnIndex(null);
  }, [result?.nodeId]);
  ```

---

### INFO: 단일 턴에서 `ragAcc` / `turnRagAcc` 이중 누적
- **위치**: `ai-agent.handler.ts` — `execute()` 메서드 (diff +314~+317)
- **상세**: 단일 턴 경로에서 `ragAcc`와 `turnRagAcc`는 동일 `ragSourcesDelta`/`ragDiagnosticsDelta`를 받아 완전히 같은 내용을 보유한다. 종료 시 `ragAcc.getSources()` 와 `turnRagAcc.getSources()` 결과가 동치(同値)임에도 각각 별도 배열을 반환하여 불필요한 메모리 중복이 발생한다. 단일 턴에서는 `turnRagAcc = ragAcc`로 참조를 공유하거나, 최종 조립 시 `ragAcc.getSources()`를 재사용하는 방향이 간결하다. 규모가 작아 실질 영향은 낮으나 인지 비용과 메모리 낭비가 존재한다.
- **제안**: 단일 턴 경로에서 `turnRagAcc`를 별도 인스턴스로 두지 말고 `ragAcc` 참조를 재사용하거나, `turnDebug[0].ragSources = ragAcc.getSources()` 로 직접 할당.

---

### INFO: `SummaryView`에서 같은 Map 키를 두 번 조회
- **위치**: `conversation-inspector.tsx` — `SummaryView` 렌더 내부 (diff +485~+496)
- **상세**: 조건 `(turnRefIndex?.get(item.turnIndex)?.length ?? 0) > 0`를 평가한 뒤, 참 분기에서 `turnRefIndex!.get(item.turnIndex)!`를 한 번 더 호출한다. Map 조회는 O(1)이지만, 결과를 로컬 변수로 캐싱하면 가독성과 함께 불필요한 중복 호출이 제거된다.
- **제안**:
  ```tsx
  const turnSources = turnRefIndex?.get(item.turnIndex);
  {isAssistant && onJumpToReferences && (turnSources?.length ?? 0) > 0 && (
    <ReferencesChip sources={turnSources!} ... />
  )}
  ```

---

## 요약

이번 변경의 핵심 성능 위험은 프론트엔드 `ResultDetail`에 집중된다. `extractAiMetadata`와 `new Map(turnDebug.map(...))` 이 memoization 없이 컴포넌트 렌더 본문에서 직접 계산되어, WebSocket 메시지나 탭 전환과 같은 빈번한 상호작용마다 수십~수백 개의 객체를 반복 생성한다. 백엔드(`ai-agent.handler.ts`)의 이중 누적자 패턴은 기능 상 정확하고 규모도 작아 즉각적인 문제는 아니지만, 단일 턴에서는 설계 간소화 여지가 있다. KB tool provider와 `extractTurnDebug` 함수 자체는 알고리즘 복잡도나 N+1 측면에서 별도 문제가 없다.

## 위험도

**MEDIUM** — 프론트엔드 렌더 경로의 미메모이제이션이 실사용 환경에서 누적적인 CPU/GC 부담으로 이어질 수 있으며, 렌더 중 setState 패턴은 React Concurrent Mode에서 예상치 못한 이중 렌더를 유발할 수 있다.