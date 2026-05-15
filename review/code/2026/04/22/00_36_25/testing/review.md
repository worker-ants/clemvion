## 발견사항

### [WARNING] `findLatestPlanInHistory` 경로가 테스트되지 않음
- **위치**: `workflow-assistant-stream.service.ts:evaluateFinishGuard`, `workflow-assistant-stream.service.spec.ts`
- **상세**: `evaluateFinishGuard`는 `planForTurn ?? this.findLatestPlanInHistory(history)` 순서로 활성 플랜을 조회한다. 새로 추가된 3개의 테스트 모두 동일 턴 내에서 `propose_plan`을 호출하므로 `planForTurn`이 항상 세팅된다. 히스토리에 저장된 plan을 기반으로 다음 턴에서 `finish`를 조기 호출하는 경로(예: 플랜 승인 후 다음 턴에서 일부 step만 실행하고 `finish`)는 전혀 커버되지 않는다.
- **제안**: `loadMessages`에 plan을 가진 assistant 메시지를 포함한 fixture를 만들고, `planForTurn`이 null인 상태에서 PLAN_NOT_COMPLETE가 정상 발동되는 테스트 추가

### [WARNING] `completedStepIds` 히스토리 집계 경로 미테스트
- **위치**: `workflow-assistant-stream.service.ts:488-495`
- **상세**: `evaluateFinishGuard` 내부에서 `history`의 `assistant` 메시지들로부터 `planStepId`를 수집하는 루프가 있다. 신규 테스트 3개는 모두 `pendingToolCalls`에서만 완료 step을 집계한다. 이전 히스토리에 완료된 step이 있어 해당 집계 경로가 활성화되는 케이스가 없다.
- **제안**: `loadMessages`에 `planStepId: 's1'`을 가진 이전 편집 tool call 결과를 포함시켜 히스토리 집계 후 s1이 pending에서 제외됨을 검증하는 테스트 추가

### [WARNING] `openQuestions`만 남은 경우 `finish` 차단 미구현 및 미테스트
- **위치**: `workflow-assistant-stream.service.ts:523-525`, `spec/3-workflow-editor/4-ai-assistant.md`
- **상세**: spec 표에는 "활성 plan에 pending step이 남아있거나 `openQuestions`가 있으면 서버가 실패를 반환"이라 명시되어 있다. 그러나 `evaluateFinishGuard`는 `pendingSteps.length === 0`이면 null을 반환(정상 finish 허용)하므로, 모든 step이 완료되었으나 `openQuestions`가 아직 남아있는 경우를 차단하지 않는다. 서버 강제가 아닌 프롬프트 지침에만 의존하는 설계라면 spec이 오해를 줄 수 있다.
- **제안**: 설계 의도를 spec에 명확히 기술하거나(`openQuestions` 강제는 prompt-only), 아니면 `openQuestions.length > 0`인 경우도 차단 로직에 추가하고 테스트 작성

### [WARNING] `system-prompt.spec.ts`: `dynamicPorts` 속성명 미테스트
- **위치**: `system-prompt.spec.ts`, `system-prompt.ts:28-30`
- **상세**: 프로덕션 코드는 `d.metadata.isDynamicPorts || d.metadata.dynamicPorts` 두 속성을 모두 확인하나, 테스트 fixture는 `isDynamicPorts: true`만 사용한다. `dynamicPorts: true`만 있는 노드가 `[dynamic-ports]` 마커를 받는지 검증되지 않는다.
- **제안**: `dynamicPorts: true` fixture를 가진 노드를 추가하고 해당 노드에도 `[dynamic-ports]`가 붙는지 테스트

### [INFO] PLAN_NOT_COMPLETE 응답의 `openQuestions` 필드 미검증
- **위치**: `workflow-assistant-stream.service.spec.ts:648-656`
- **상세**: 첫 번째 PLAN_NOT_COMPLETE 테스트에서 `parsed.pendingSteps`는 검증하지만 `parsed.openQuestions`는 확인하지 않는다. `activePlan.openQuestions ?? []`가 올바르게 전달되는지 확인이 없다.
- **제안**: `expect(Array.isArray(parsed.openQuestions)).toBe(true)` 또는 실제 값 검증 추가

### [INFO] 차단된 `finish` tool call의 DB 퍼시스트 내용 미검증
- **위치**: `workflow-assistant-stream.service.spec.ts`
- **상세**: PLAN_NOT_COMPLETE로 차단된 `finish` 호출은 `pendingToolCalls`에 `kind: 'finish'`로 추가되어 최종 `appendMessage`에 포함된다. 테스트는 루프 횟수와 최종 `done` 이벤트만 검증하고, `appendMessage`로 저장된 assistant 메시지의 `toolCalls` 내용(차단된 finish + 두 번째 round의 편집들)은 확인하지 않는다.

### [INFO] 프론트엔드 `plan-card.tsx` 신규 UI 테스트 부재
- **위치**: `frontend/src/components/editor/assistant-panel/plan-card.tsx`
- **상세**: 인라인 답변 입력창의 Enter 키 제출, 제출 후 `answer` state 초기화, `canSubmitAnswer` 조건(빈 답변 비활성화) 등 새로운 인터랙션 로직에 대한 컴포넌트 테스트가 없다. 이 프로젝트가 프론트엔드 유닛 테스트를 운용하는 경우 커버리지 갭이다.

### [INFO] `MAX_TOOL_CALLS_PER_TURN` 32 임계값 경계 테스트 부재
- **위치**: `workflow-assistant-stream.service.ts:71`
- **상세**: 16→32 변경에 대한 경계값 테스트가 없다. 기존에 16-tool-call limit 테스트가 있었다면 갱신이 필요한지 확인이 필요하다.

---

## 요약

핵심 비즈니스 로직(`PLAN_NOT_COMPLETE` 차단 및 무한 루프 안전 탈출)에 대한 테스트는 명확하게 작성되었고 의도 파악이 쉽다. `asyncIter`/`makeService`/`collect` 헬퍼 구조로 테스트 격리가 잘 되어 있다. `system-prompt.spec.ts`도 프롬프트 계약 문자열을 고정하는 의미 있는 시도다. 그러나 `findLatestPlanInHistory` 경로(이전 턴 plan 기반 차단)와 히스토리 기반 `completedStepIds` 집계가 전혀 테스트되지 않아, 승인 후 실행 턴에서 조기 finish가 발생하는 실제 사용 시나리오에서 회귀가 발생해도 감지되지 않는다. 또한 spec과 구현 간 `openQuestions` 단독 차단 여부의 불일치는 명확히 정의될 필요가 있다.

## 위험도

**MEDIUM**