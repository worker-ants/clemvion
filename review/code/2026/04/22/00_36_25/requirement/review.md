## 발견사항

### **[CRITICAL] `openQuestions` 독립 gating 미구현**
- **위치**: `workflow-assistant-stream.service.ts`, `evaluateFinishGuard()` 메서드
- **상세**: spec §4.3 및 §8 "워크플로우 조립 규칙"은 "활성 plan에 pending step이 남아있거나 `openQuestions`가 있으면 서버가 실패를 반환"이라고 명시한다. 그러나 구현은 `pendingSteps.length === 0` 조건만 체크하고, `openQuestions`는 응답 페이로드에 포함될 뿐 blocking 조건으로 사용되지 않는다.
  ```typescript
  if (pendingSteps.length === 0) return null; // openQuestions 잔존 시에도 통과
  return { ok: false, error: 'PLAN_NOT_COMPLETE', pendingSteps, openQuestions: ... };
  ```
- **제안**: `pendingSteps.length === 0` 체크를 `pendingSteps.length === 0 && (activePlan.openQuestions ?? []).length === 0`으로 변경

---

### **[WARNING] 히스토리 plan 참조로 인한 false positive PLAN_NOT_COMPLETE**
- **위치**: `evaluateFinishGuard()` 내 `findLatestPlanInHistory()` 호출 경로
- **상세**: `planForTurn`이 null(단순 standalone 편집 턴)인 경우, `findLatestPlanInHistory`로 과거 히스토리의 plan을 가져온다. 만약 이전 턴의 safety escape(2회 block 허용)로 미완성 plan이 DB에 저장된 상태라면, 현재 턴의 무관한 편집이 해당 구형 plan의 pending step 때문에 잘못 차단된다.
  - 예: Turn 1에서 plan A (s1,s2,s3) 중 s3 미실행으로 safety escape → DB 저장. Turn 2에서 사용자가 "HTTP 헤더만 추가해줘" 단독 편집 → `finish` → 과거 s3 때문에 PLAN_NOT_COMPLETE 반환
- **제안**: `planForTurn`이 null이거나 현재 턴의 edit tool call 중 해당 plan의 `planStepId`가 하나도 없으면 history plan 체크를 스킵

---

### **[WARNING] `note` action 스텝이 pending으로 오인**
- **위치**: `evaluateFinishGuard()`, `activePlan.steps.filter(s => !completedStepIds.has(s.id))`
- **상세**: `propose_plan`의 step `action`은 `'note'` 타입을 허용한다(spec §4.2, entity의 `AssistantPlanStep`). `note` step은 실제 edit tool call 없이 정보 전달 목적으로 사용되므로 어떤 tool call도 해당 `planStepId`를 가지지 않는다. 따라서 note step이 포함된 plan에서 finish하면 항상 PLAN_NOT_COMPLETE가 반환된다.
- **제안**: `pendingSteps` 필터에 `action !== 'note'` 조건 추가

---

### **[WARNING] safety escape 시 spec과 구현 불일치**
- **위치**: `evaluateFinishGuard()`, `finishBlockCount > 0` 분기
- **상세**: spec §10은 "반복 실패 시(2회 연속) 안전 탈출해 **error 이벤트로 종료**"라고 명시하지만, 구현은 두 번째 finish를 정상(`ok: true`) 통과시켜 `done` 이벤트로 종료한다. 사용자 관점에서는 미완성 plan임에도 성공으로 인식될 수 있다.
- **제안**: spec 수정(현재 구현이 더 안전한 동작이라면 spec을 "정상 탈출"로 수정) 또는 구현에서 safety escape 시 에러 이벤트 방출

---

### **[INFO] spec §13 i18n 테이블 누락**
- **위치**: `spec/3-workflow-editor/4-ai-assistant.md` §13
- **상세**: `planQuestionsTitle`, `planQuestionsPlaceholder`, `planQuestionsSend` 세 키가 `en.ts`/`ko.ts`에 추가되었지만 spec §13 i18n 매핑 테이블에는 없다.
- **제안**: spec §13에 세 키 추가

---

### **[INFO] 승인된 plan의 answer input 노출**
- **위치**: `plan-card.tsx`, `{onAnswerQuestions && <div>...</div>}`
- **상세**: `plan.approved` 체크 없이 `onAnswerQuestions`가 존재하면 항상 답변 입력창이 노출된다. 이미 실행 완료된 plan 카드에서도 입력창이 남아 사용자 혼동을 유발할 수 있다.
- **제안**: `{!plan.approved && onAnswerQuestions && ...}` 로 제한

---

### **[INFO] 노드 메타데이터 필드명 이중 체크**
- **위치**: `system-prompt.ts:31-32`
- **상세**: `isDynamicPorts || dynamicPorts` 두 필드를 병렬 체크하는 것은 노드 레지스트리 내 필드명 불일치를 시사한다. spec과 테스트는 `isDynamicPorts`만 사용하므로 `dynamicPorts` 사용 노드가 실제로 존재하는지 확인이 필요하다.
- **제안**: 레지스트리 전수 조사 후 하나로 통일; 혹은 `NodeDefinitionView` 타입에 두 필드 모두 명시적으로 선언

---

## 요약

핵심 기능인 `finish` guard 메커니즘과 dynamic-ports 마커, openQuestions 인라인 답변 UI의 구현 방향은 올바르다. 그러나 **`openQuestions` 독립 blocking 미구현**은 spec과 구현 간 명백한 요구사항 괴리이며, `note` 스텝을 pending으로 오인하는 문제와 히스토리 plan 참조로 인한 false positive는 실사용에서 LLM을 무한 루프에 가까운 상황에 빠뜨릴 수 있다. safety escape 후 done 이벤트로 종료하는 동작은 spec보다 안전하지만 spec과 정합이 필요하다.

## 위험도

**MEDIUM**