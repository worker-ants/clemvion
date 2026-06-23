# 유지보수성(Maintainability) 리뷰 결과

**검토 대상**: M-3 2단계 — finish/review 가드를 `AssistantFinishGuard` 로 분리 (commit 1c17795c)
**검토 일시**: 2026-06-24
**검토 파일**:
- `codebase/backend/src/modules/workflow-assistant/tools/active-plan-context.ts`
- `codebase/backend/src/modules/workflow-assistant/tools/assistant-finish-guard.service.ts` (신설)
- `codebase/backend/src/modules/workflow-assistant/tools/assistant-finish-guard.service.spec.ts` (신설)
- `codebase/backend/src/modules/workflow-assistant/tools/collect-pending-user-config.ts` (신설)
- `codebase/backend/src/modules/workflow-assistant/workflow-assistant-stream.service.ts`
- `codebase/backend/src/modules/workflow-assistant/workflow-assistant-stream.service.spec.ts`
- `codebase/backend/src/modules/workflow-assistant/workflow-assistant.module.ts`

---

## 발견사항

### **[INFO]** `evaluateReviewGuard` 의 파라미터 목록이 과도하게 김
- **위치**: `assistant-finish-guard.service.ts` — `evaluateReviewGuard` 메서드 시그니처 (9개 파라미터)
- **상세**: `history`, `planForTurn`, `pendingToolCalls`, `state`, `originalRequest`, `assistantText`, `shadow`, `workspaceId`, `currentWorkflowId` 9개 파라미터가 나열된다. 이전 `WorkflowAssistantStreamService` 의 private 메서드일 때는 this 를 통해 필드에 접근했기 때문에 감춰졌던 의존성이 분리 후 시그니처에 노출되었다. 이는 이번 리팩터링의 필연적 결과물이기는 하나, 단일 값 객체(`ReviewGuardContext` 등)로 그룹핑하면 호출부 코드가 더 읽기 쉬워진다.
- **제안**: 파라미터를 `ReviewGuardInput` 인터페이스로 묶고 단일 객체로 받는 방식 검토. 단, 현행 분리 자체가 이미 큰 개선이므로 이 변경은 후속 리팩터링으로 처리해도 무방하다.

---

### **[INFO]** `shouldSkipReview` 와 `evaluateReviewGuard` 내 non-trigger 노드 카운팅 로직 중복
- **위치**: `assistant-finish-guard.service.ts` — `shouldSkipReview` (line 740–743) 와 `evaluateReviewGuard` 내 `nonTriggerNodeCount` 계산 (line 664–667)
- **상세**: `snapshot.nodes.filter(n => n.category !== 'trigger').length` 패턴이 두 메서드에 각각 등장한다. `shouldSkipReview` 는 `nonTriggerCount <= 1` 로 trivial 편집을 걸러내고, `evaluateReviewGuard` 는 `nonTriggerNodeCount < MIN_NONTRIGGER_NODES_FOR_VERIFY` 로 verify 임계값을 확인한다. 임계값이 달라 두 조건이 별도로 의미를 갖지만 필터 표현식 자체는 동일하다. snapshot 을 `shouldSkipReview` 에 이미 넘기므로, 계산 결과를 함께 반환하거나 private 헬퍼로 추출하면 의도가 더 명확해진다.
- **제안**: `private countNonTriggerNodes(snapshot: ShadowSnapshot): number` 헬퍼를 추출해 두 곳에서 재사용.

---

### **[INFO]** `evaluateFinishGuard` 에서 `tc.result` 에 대한 타입 단언이 두 가지 형태로 혼용
- **위치**: `assistant-finish-guard.service.ts` — `evaluateFinishGuard` 의 `editThisTurn` 계산 (line 793) vs `shouldSkipReview` 의 `hadSuccessfulEdit` 계산 (line 737)
- **상세**: `editThisTurn` 에서는 `(tc.result as { ok?: boolean } | null | undefined)?.ok === true` 를, `hadSuccessfulEdit` 에서는 `(tc.result as { ok?: boolean } | undefined)?.ok === true` 를 사용한다. `null` 케이스의 포함 여부가 다르다. 기능적으로는 `?.ok` 가 `null` 에 대해서도 `undefined` 를 반환하므로 결과는 동일하지만, 독자 입장에서 의도적 차이인지 실수인지 구분하기 어렵다.
- **제안**: 두 곳에서 동일한 `(tc.result as { ok?: boolean } | null | undefined)?.ok === true` 형태로 통일하거나, `isSuccessfulEdit(tc: AssistantToolCallRecord): boolean` 헬퍼 함수를 추출해 단일 진실 원칙을 유지.

---

### **[INFO]** `message` 필드의 LLM 프롬프트 문자열이 메서드 본문에 인라인으로 길게 삽입됨
- **위치**: `assistant-finish-guard.service.ts` — `evaluateReviewGuard` 반환값의 `message` 필드 (line 678, 699)
- **상세**: `WORKFLOW_VERIFY_REQUIRED` 와 `WORKFLOW_REVIEW_REQUIRED` 응답에 실리는 LLM 인스트럭션이 각각 400자 이상의 단일 문자열로 메서드 본문에 그대로 박혀 있다. 비즈니스 로직 흐름을 읽는 도중 긴 영문 문장을 건너뛰어야 하므로 가독성이 떨어진다.
- **제안**: 모듈 상단(또는 별도 상수 파일)에 `VERIFY_REQUIRED_MESSAGE` / `REVIEW_REQUIRED_MESSAGE` 상수로 추출해 메서드 본문에서는 상수 이름만 참조하도록 정리.

---

### **[INFO]** `collectPendingUserConfig` 함수 내 `shadow.snapshot()` 호출이 호출마다 발생
- **위치**: `collect-pending-user-config.ts` — 함수 본문 (line 907)
- **상세**: `collectPendingUserConfig` 는 `evaluateReviewGuard` 에서 `snapshot.nodes.map(n => ...)` 루프 안에서 노드마다 호출된다. 그런데 함수 내부에서 `shadow.snapshot()` 을 다시 호출해 nodes 배열을 얻는다. `shadow.snapshot()` 이 shallow clone 이라는 사실은 주석으로 언급되어 있지만, 루프 바깥에서 한 번 snap 을 찍고 넘기는 `evaluateReviewGuard` 와 함수 내부에서 snap 을 다시 찍는 `collectPendingUserConfig` 사이의 시점 불일치가 혼동을 줄 수 있다.
- **제안**: `collectPendingUserConfig(shadow, nodeId, nodeRegistry)` 시그니처를 `collectPendingUserConfig(snapshot, nodeId, nodeRegistry)` 로 바꿔 snapshot 을 직접 받도록 변경하거나, 함수 주석에 "스냅샷 시점 불일치는 동일 턴 내 호출이므로 무방" 이라는 설명을 추가.

---

### **[INFO]** 테스트 fixture 헬퍼 `plan` 이 예약어와 동일한 이름 사용
- **위치**: `assistant-finish-guard.service.spec.ts` — 함수명 `plan` (line 145)
- **상세**: TypeScript/JavaScript 에서 `plan` 은 예약어가 아니라 유효한 식별자이므로 문법 오류는 없다. 그러나 테스트 파일 내에서 `plan(...)` 함수와 프로덕션 코드의 `plan` 변수명이 혼동될 수 있고, 함수의 목적이 "AssistantPlanRecord fixture 생성" 임을 함수명만으로는 알 수 없다.
- **제안**: `makePlan` 또는 `buildPlan` 처럼 생성 의도를 드러내는 이름으로 변경. `okEdit` → `makeOkEdit` 와 같은 기존 `make` 접두사 패턴과도 통일된다.

---

## 요약

이번 리팩터링은 `WorkflowAssistantStreamService` 에 혼재하던 finish/review 가드 로직을 `AssistantFinishGuard` 무상태 collaborator 로 분리하고, 공유 헬퍼(`collectPendingUserConfig`, `isPlanPendingApproval`)를 독립 모듈로 추출한 작업이다. 전반적으로 단일 책임 원칙을 잘 지키고 있으며 JSDoc, 인라인 주석의 품질이 높아 의도 파악이 쉽다. 상수(`MAX_REVIEW_ROUNDS`, `MIN_NONTRIGGER_NODES_FOR_VERIFY`)의 명명도 목적을 명확히 드러낸다. 발견된 이슈는 모두 INFO 수준으로, 긴 파라미터 목록, 소규모 코드 중복(non-trigger 카운팅), 타입 단언 표현 불일치, 인라인 LLM 프롬프트 문자열, snapshot 시점 혼동 가능성, 테스트 fixture 함수명 가독성이다. Critical 또는 Warning 등급에 해당하는 사안은 없으며, 유지보수 부담을 실질적으로 높이는 구조적 결함도 발견되지 않았다.

## 위험도

LOW
