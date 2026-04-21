## 발견사항

### [WARNING] 시스템 프롬프트 토큰 비용 급증
- **위치**: `system-prompt.ts` 전체 변경
- **상세**: "Workflow assembly rules" 섹션, 2개의 신규 few-shot 예시(new workflow, dynamic-ports branch), 기존 complex request 예시 확장, catalog MANDATORY 단락 추가로 시스템 프롬프트가 상당히 길어졌다. 이 프롬프트는 매 `streamMessage` 호출마다, 그리고 루프 내 추가 라운드마다 `system` role로 포함된다. MAX_TOOL_CALLS_PER_TURN이 16→32로 늘었으므로 한 턴에서 최대 루프 횟수가 늘어난 경우 동일 시스템 프롬프트가 반복 전송된다.
- **제안**: 현재 구조에서 시스템 프롬프트는 `messages[0]`으로 고정 삽입되고 매 라운드 재사용되므로 토큰 캐싱(Anthropic prompt caching 등) 적용 여부를 확인할 것. few-shot 예시 중 반드시 필요한 것만 남기고 일부는 규칙 섹션으로 통합 가능.

---

### [WARNING] `evaluateFinishGuard` — 히스토리 전체 이중 순회
- **위치**: `workflow-assistant-stream.service.ts:488~551`
- **상세**: `history` 배열(최대 `MAX_HISTORY_TURNS × 3 = 90` 메시지)을 순회하며 `completedStepIds` Set을 구성한다. 이 함수는 `finish` tool call 발생 시마다 호출되므로 한 턴 안에서 `finishBlockCount=0`일 때 한 번 호출되는 것이 보장되지만, 내부적으로 `history` 전체를 순회 후 `activePlan.steps`를 `.filter().map()` 두 번 패스한다.
  - 현재 경계: O(H×T + P), H≤90 메시지, T≤실제 tool calls 수, P≤plan steps 수. 실제로는 미미하다.
  - 그러나 `planForTurn`이 `null`이어서 `findLatestPlanInHistory(history)`를 호출할 경우 히스토리를 역방향으로 한 번 더 순회한다(별도 메서드). 최악의 경우 O(H)가 중복 발생.
- **제안**: `planForTurn`이 null일 때 `evaluateFinishGuard` 진입부에서 `findLatestPlanInHistory` 결과를 먼저 early-return 체크하는 현재 로직은 이미 적절하다. 다만 `.filter().map()`은 단일 패스로 합칠 수 있다:
  ```ts
  const pendingSteps: Array<{ id: string; description: string }> = [];
  for (const s of activePlan.steps) {
    if (!completedStepIds.has(s.id)) pendingSteps.push({ id: s.id, description: s.description });
  }
  ```

---

### [INFO] `JSON.stringify(current)` — 대형 워크플로우에서 시스템 프롬프트 크기 선형 증가
- **위치**: `system-prompt.ts:84` (`${JSON.stringify(current)}`)
- **상세**: `toWorkflowView(snapshot)` 결과를 매 호출마다 `JSON.stringify`로 직렬화해 프롬프트에 포함한다. 노드/엣지 수에 비례해 프롬프트 크기가 커지며, 수백 개 노드를 가진 워크플로우에서는 단일 시스템 프롬프트가 수만 토큰을 차지할 수 있다.
- **제안**: 노드 수가 일정 임계치(예: 50개)를 초과할 경우 노드/엣지를 요약(id, type, label만 포함)하는 slim 모드 직렬화 분기를 고려할 것. 현재는 `redactConfig()`로 config 값은 정리되지만 모든 필드가 포함된다.

---

### [INFO] `plan-card.tsx` — 렌더 시마다 `answer.trim()` 호출
- **위치**: `plan-card.tsx:28`
  ```ts
  const canSubmitAnswer = hasQuestions && !!onAnswerQuestions && answer.trim().length > 0;
  ```
- **상세**: textarea에 키 입력 시마다 리렌더되며 `answer.trim()`이 매 렌더마다 실행된다. 짧은 문자열에서는 무시할 수준이지만, `useMemo`로 감쌀 수 있다.
- **제안**: 실용적 영향은 없음. 선택적 개선으로 `useMemo(() => answer.trim(), [answer])`로 trimmed 결과를 캐시하면 `canSubmitAnswer`와 `submitAnswer` 양쪽에서 재사용 가능.

---

### [INFO] `assistant-panel.tsx` — messages.map 내 인라인 함수 재생성
- **위치**: `assistant-panel.tsx:174~177`
  ```tsx
  onAnswerPlanQuestions={(answer) => void sendMessage(answer, snapshot)}
  ```
- **상세**: 메시지 목록이 리렌더될 때마다 각 메시지에 대해 새 함수 레퍼런스가 생성된다. `sendMessage`와 `snapshot`이 안정적인 레퍼런스(Zustand action + useMemo)라면 `useCallback`으로 한 번만 생성 가능하지만, `PlanCard`가 `React.memo`로 감싸지지 않은 현재 구조에서는 실질적 영향이 없다.
- **제안**: 메시지 수가 많아질 경우(`messages.map`) 성능 최적화가 필요하면 `PlanCard`를 `React.memo`로 감싸고 `onAnswerPlanQuestions`를 `useCallback`으로 안정화할 것.

---

## 요약

이번 변경의 핵심 로직인 `evaluateFinishGuard`는 히스토리 선형 순회(O(H))로 구현됐으며, MAX_HISTORY_TURNS=30 경계 내에서 실제 부하는 무시할 수준이다. 주목할 성능 리스크는 코드 알고리즘이 아닌 **시스템 프롬프트 크기 증가**다 — few-shot 예시 추가와 규칙 섹션 확장으로 매 LLM 호출 시 입력 토큰이 늘어나며, MAX_TOOL_CALLS_PER_TURN=32로 증가한 상황에서 루프가 길어질수록 이 비용이 누적된다. 대형 워크플로우에서는 `JSON.stringify(current)`로 인해 시스템 프롬프트가 수만 토큰에 달할 수 있어 슬림 직렬화 전략을 미리 검토할 필요가 있다.

## 위험도

**LOW**