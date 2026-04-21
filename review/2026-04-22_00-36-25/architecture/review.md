## 아키텍처 리뷰

### 발견사항

---

**[WARNING] `WorkflowAssistantStreamService` God Class 심화**
- 위치: `workflow-assistant-stream.service.ts`
- 상세: `evaluateFinishGuard`, `findLatestPlanInHistory`가 추가되면서 단일 서비스가 LLM 스트리밍, 도구 라우팅, Shadow 관리, 히스토리 재구성, 플랜 완결성 검증, 세션 persist까지 담당한다. 현재 파일은 이미 700줄 이상으로 SRP 위반 징후가 뚜렷하다.
- 제안: `PlanCompletionGuard` 또는 `FinishGuardService`로 플랜 검증 로직을 분리하고, `findLatestPlanInHistory`를 `WorkflowAssistantSessionService`로 이관하는 것을 고려한다.

---

**[WARNING] 인라인 타입 임포트가 메서드 시그니처에 중복 등장**
- 위치: `workflow-assistant-stream.service.ts:491, 521`
- 상세: `evaluateFinishGuard`와 `findLatestPlanInHistory` 두 메서드 모두 파라미터 타입을 `import('./entities/...').WorkflowAssistantMessage[]`로 인라인 선언한다. 파일 상단에서는 같은 경로에서 `AssistantToolCallRecord`, `AssistantPlanRecord`를 이미 named import하고 있다.
- 제안: 파일 상단 import에 `WorkflowAssistantMessage`를 추가하고 인라인 `import()`를 제거한다. 인라인 동적 임포트는 타입 시스템 오용이며 IDE 탐색과 리팩터 자동화를 방해한다.

---

**[WARNING] 플랜 활성 상태를 명시적으로 닫는 메커니즘 부재**
- 위치: `workflow-assistant-stream.service.ts:evaluateFinishGuard`
- 상세: `findLatestPlanInHistory`는 히스토리를 역순으로 탐색해 첫 번째로 발견된 `plan`을 반환한다. 같은 세션 안에서 플랜 A(모두 완료)와 플랜 B(이번 턴에 새로 제안)가 있을 때는 올바르게 플랜 B를 반환한다. 그러나 플랜 B 이후에 플랜 A가 없다면, 플랜 A의 step이 `planStepId` 없이 실행된 경우(`planStepId` optional이므로) guard가 오판할 수 있다. LLM이 `planStepId` 태깅을 빠뜨리면 모든 step이 pending으로 남아 false-positive block이 발생한다.
- 제안: `propose_plan` 호출 시 이전 plan을 명시적으로 '닫힌 상태'로 마킹하거나, guard 조건에 "이번 턴 propose_plan이 없고 히스토리 플랜이 N턴 이상 오래된 경우 skip" 휴리스틱을 추가한다.

---

**[WARNING] `isDynamicPorts` / `dynamicPorts` 이중 속성 이름**
- 위치: `system-prompt.ts:30-32`
- 상세: `d.metadata.isDynamicPorts || d.metadata.dynamicPorts` — 두 가지 속성명을 동시에 체크한다. 이는 NodeDefinitionMetadata 인터페이스에 두 가지 변형이 혼재한다는 신호이며, 소비 코드가 명세를 따르지 않고 방어적으로 작성되었다.
- 제안: `NodeDefinitionView.metadata` 타입을 `isDynamicPorts: boolean`으로 표준화하고 `dynamicPorts` 속성을 deprecated 처리 후 제거한다. 시스템 프롬프트 빌더는 표준 필드 하나만 참조해야 한다.

---

**[INFO] `onAnswerPlanQuestions` 3단 prop drilling**
- 위치: `assistant-panel.tsx → assistant-message.tsx → plan-card.tsx`
- 상세: `onAnswerPlanQuestions` 콜백이 3개 컴포넌트를 거쳐 전달된다. 현재 트리 깊이는 얕아 즉각적인 문제는 아니지만, `AssistantPanel`이 이미 수십 줄의 `useAssistantStore` 호출로 비대하다.
- 제안: 현 규모에서는 허용 가능하다. 추후 중간 컴포넌트가 늘어나면 `useCallback`으로 안정화된 핸들러를 store action으로 노출하거나, `AssistantMessageView`가 store에서 직접 `sendMessage`를 참조하는 방향을 고려한다.

---

**[INFO] 시스템 프롬프트 내 `[dynamic-ports]` 규칙 중복 서술**
- 위치: `system-prompt.ts` — Node catalog 섹션, Workflow assembly rules 섹션, 두 개의 few-shot 예시 섹션
- 상세: `dynamic-ports` 관련 지시가 최소 4곳에 분산되어 있다. LLM 신뢰성을 위한 의도적 반복이지만, 향후 규칙이 변경될 때 4곳을 모두 동기화해야 하는 유지보수 부담이 있다.
- 제안: 핵심 규칙은 상수로 추출하고 프롬프트 빌더에서 참조해 단일 출처를 유지한다. 예: `const DYNAMIC_PORTS_RULE = '...'` 후 템플릿에서 인터폴레이션.

---

**[INFO] `finishBlockCount` 루프 탈출 전략의 spec 불일치 위험**
- 위치: `workflow-assistant-stream.service.ts:171, evaluateFinishGuard:499`
- 상세: `finishBlockCount > 0`이면 guard를 우회해 두 번째 `finish`는 항상 성공한다. spec은 "2회 연속 안전 탈출해 error 이벤트로 종료"라고 기술하지만, 구현은 두 번째 `finish`를 정상 종료(`stop`)로 처리한다. 이는 pending step이 남아있어도 대화가 조용히 종료될 수 있음을 의미한다.
- 제안: spec과 구현을 일치시킨다. 두 번째 block 시에도 `finishReason: 'stop'` 대신 사용자에게 "일부 플랜 스텝이 미완료로 종료됨"을 알리는 warning 이벤트를 추가하거나, spec을 현재 구현(조용한 탈출)으로 수정한다.

---

### 요약

이번 변경은 AI Assistant의 플랜 완결성 보장을 위한 `PLAN_NOT_COMPLETE` guard와 dynamic-ports 인식, openQuestions 인라인 응답 UI를 추가한다. 전체적으로 아키텍처적 방향은 올바르며 — guard 로직을 서버에서 통제하고, 프론트는 store action을 그대로 위임하며, 테스트가 세 가지 핵심 시나리오를 커버한다 — 즉각적인 시스템 위험은 없다. 다만 `WorkflowAssistantStreamService`의 God Class 경향이 강화되고, 인라인 타입 임포트와 이중 동적포트 속성명 같은 타입 시스템 일관성 문제가 기술 부채로 축적되고 있다. `planStepId` 태깅에 대한 guard의 LLM 의존성은 잠재적 오진 위험을 내포한다.

### 위험도

**LOW**