## 성능 코드 리뷰

### 발견사항

---

**[WARNING]** `findActivePlanContext` 내 불필요한 `slice()` 배열 복사
- **위치**: `active-plan-context.ts` — `hasClearPlanAfter`, `hasNewerProposePlanAfter` 계산부
- **상세**: `history.slice(planIndex).some(...)` 패턴이 두 곳에서 사용됨. `slice()`는 O(n) 크기의 새 배열을 힙에 할당한 뒤 즉시 `some()`에서 소비하고 버림. history가 수백 메시지 규모로 커지는 장기 세션에서 매 턴마다 이 임시 배열이 생성·GC됨.
- **제안**:
  ```typescript
  // 현재
  const hasClearPlanAfter = history.slice(planIndex).some((m) => ...);

  // 개선
  const hasClearPlanAfter = history
    .slice(planIndex + 1) // 더 좁은 범위이기도 함 — 플랜 메시지 자체를 스캔할 필요 없음
    .some((m) => ...);

  // 또는 slice 없이
  let hasClearPlanAfter = false;
  for (let i = planIndex + 1; i < history.length; i++) {
    if (history[i].role === 'assistant' && (history[i].toolCalls ?? []).some(tc => tc.name === 'clear_plan')) {
      hasClearPlanAfter = true;
      break;
    }
  }
  ```

---

**[WARNING]** `findActivePlanContext` 매 턴 최대 3회 중복 호출
- **위치**: `workflow-assistant-stream.service.ts` — 프롬프트 생성부(L172~184), `evaluateFinishGuard`(L562~)
- **상세**: 첫 번째 호출은 시스템 프롬프트 생성 시 `planForTurn=null, pendingToolCalls=[]`로 실행됨. 이후 LLM이 `finish`를 호출할 때마다 `evaluateFinishGuard` → `findActivePlanContext`가 재실행됨(`finishBlockCount` 제한으로 최대 2회). 호출마다 전체 history O(h)를 스캔하고 `collectCompletedStepIds`의 O(h × t) 반복이 반복됨. `MAX_HISTORY_TURNS=30`으로 현재는 제한적이지만, `loadMessages`는 **전체** 세션 히스토리를 반환하므로 제한이 없음.
- **제안**: `findActivePlanContext` 결과를 턴 초기에 한 번 계산하고, 이후 `evaluateFinishGuard`에 `ActivePlanContext | null`을 직접 전달. `planForTurn`이 변경된 시점(새 plan 발행)에만 재계산.

---

**[INFO]** `buildAssistantTools()` 매 호출마다 정적 객체 재생성
- **위치**: `tool-definitions.ts`, `workflow-assistant-stream.service.ts` — `const tools = buildAssistantTools()`
- **상세**: `buildAssistantTools`는 매번 완전히 동일한 ToolDef 배열 (~11개 객체, 중첩 파라미터 포함)을 새로 생성함. 이 정의는 런타임에 변하지 않음.
- **제안**:
  ```typescript
  // 모듈 상수로 이동
  export const ASSISTANT_TOOLS: ToolDef[] = buildAssistantTools();
  ```

---

**[INFO]** `collectCompletedStepIds`에서 중간 배열 생성
- **위치**: `active-plan-context.ts` — `collectCompletedStepIds` 함수
- **상세**: `new Set(plan.steps.map((s) => s.id))`에서 `.map()`이 중간 배열을 생성한 뒤 `Set` 생성자에 넘김.
- **제안**:
  ```typescript
  const planStepIdSet = new Set(plan.steps.map((s) => s.id));
  // 개선: map 중간 배열 제거
  const planStepIdSet = new Set<string>();
  for (const s of plan.steps) planStepIdSet.add(s.id);
  ```

---

**[INFO]** `deriveStatus`의 이중 `.filter()` 체인
- **위치**: `active-plan-context.ts` — `deriveStatus` 함수
- **상세**: `plan.steps.filter(...).filter(...)` 두 번의 배열 순회와 두 개의 중간 배열이 생성됨. plan steps 수가 소규모이므로 영향은 미미하나 단일 패스로 통합 가능.
- **제안**:
  ```typescript
  const remaining = plan.steps.filter(
    (s) => s.action !== 'note' && !completedStepIds.has(s.id)
  );
  ```

---

**[INFO]** `findActivePlanContext`의 전체 history 스캔 vs LLM에 전달되는 슬라이스 불일치
- **위치**: `workflow-assistant-stream.service.ts` L172~191
- **상세**: `recentHistory = history.slice(-MAX_HISTORY_TURNS * 3)`는 최근 90개 메시지만 LLM에 전달하지만, `findActivePlanContext(history, ...)`는 **전체** history를 스캔함. 오래된 plan이 최근 plan보다 우선 감지될 가능성은 없지만, 세션이 수백 턴에 이르면 completed step 집계 루프(`collectCompletedStepIds`)가 전체 메시지를 순회함. DB에서 로드되는 history에 별도 상한이 없으면 잠재적 메모리·CPU 리스크가 있음.

---

### 요약

이번 변경에서 추가된 `findActivePlanContext` 로직은 전반적으로 잘 설계되어 있으나, 두 가지 패턴이 주목됨. 첫째, `history.slice().some()` 조합이 매 턴 불필요한 배열 복사를 유발하며 단순 for-loop로 대체 가능함. 둘째, 동일 함수가 한 턴에 최대 3회 호출될 수 있는 구조로, 결과를 memoize하거나 인자로 전달하면 중복 스캔을 제거할 수 있음. `MAX_HISTORY_TURNS=30` 제한이 LLM 컨텍스트에는 적용되지만 `findActivePlanContext`에는 미적용되어 장기 세션에서 성능 편차가 발생할 수 있음. 현재 전형적인 사용 규모에서는 실제 사용자 체감 영향은 없을 수준이나, 세션 히스토리가 무제한 성장하는 구조라는 점은 장기적으로 모니터링이 필요함.

### 위험도

**LOW**