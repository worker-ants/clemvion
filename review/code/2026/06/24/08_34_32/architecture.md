# 아키텍처(Architecture) 리뷰 결과

**리뷰 대상 커밋**: 1c17795c  
**리뷰 일시**: 2026-06-24  
**리뷰 범위**: M-3 2단계 — finish/review 가드 AssistantFinishGuard 분리 리팩터링

---

## 발견사항

### **[INFO]** SRP 이행: streamMessage 에서 가드 책임 성공적 분리
- 위치: `codebase/backend/src/modules/workflow-assistant/workflow-assistant-stream.service.ts` (삭제 구간: ~250 라인), `tools/assistant-finish-guard.service.ts` (신설, 434 라인)
- 상세: `WorkflowAssistantStreamService.streamMessage` 에 혼재하던 plan 완결성 평가(`evaluateFinishGuard`), 워크플로우 품질 self-review(`evaluateReviewGuard`), skip 판정(`shouldSkipReview`), 상수 3종, `FinishGuardState`/`FinishGuardError` 타입 선언을 `AssistantFinishGuard` 단일 collaborator 로 이전했다. 스트림 서비스는 이제 가드 발동 결과에 따른 SSE 방출·상태 변이·persist 분기만 보유한다. 단일 책임 원칙 측면에서 명확한 개선이다.
- 제안: 해당 없음.

---

### **[INFO]** 의존성 역전 및 생성자 주입 준수
- 위치: `tools/assistant-finish-guard.service.ts` lines 564–568, `workflow-assistant.module.ts` providers 배열
- 상세: `AssistantFinishGuard` 는 `NodeComponentRegistry`, `CandidateLookupService` 를 생성자 주입으로 받고 `@Injectable()` 로 NestJS IoC 컨테이너에 등록된다. 모듈 providers 목록에 선언되어 DI 그래프가 명시적으로 관리된다. 테스트 픽스처(`makeGuard()`)도 생성자 직접 호출로 의존성을 교체하므로 테스트 가능성이 높다.
- 제안: 해당 없음.

---

### **[INFO]** 순환 의존성 예방: type-only import 전략
- 위치: `tools/collect-pending-user-config.ts` lines 3, 10
- 상세: `NodeComponentRegistry` 를 `import type` 으로만 참조해 런타임 순환 참조를 차단한 설계가 명시적으로 문서화되어 있다. `isPlanPendingApproval` 을 `active-plan-context.ts` 로 이전해 서비스 3곳과 가드가 공유하는 구조도 단방향 의존성을 유지한다.
- 제안: 해당 없음.

---

### **[INFO]** FinishGuardState 소유 경계: 상태 변이가 호출부에 위임됨
- 위치: `tools/assistant-finish-guard.service.ts` 인터페이스 `FinishGuardState` (export), `workflow-assistant-stream.service.ts` 호출부
- 상세: `AssistantFinishGuard` 는 판정(read-only 평가)만 수행하고, `FinishGuardState` 의 변이(`finishBlockCount++`, `reviewRoundCount++` 등)는 호출부(`WorkflowAssistantStreamService`)가 소유한다. 이 설계는 collaborator 패턴을 명확히 따르며 가드 자체의 무상태(stateless) 성질을 보장한다. 단, `FinishGuardState` 가 public export 타입으로 노출되어 호출부 어디서나 변이 가능한 구조다. 현재 호출부가 하나이므로 문제 없으나, 향후 다른 서비스가 `AssistantFinishGuard` 를 재사용할 경우 상태 변이 방식이 산재할 수 있다.
- 제안: 장기적으로 `FinishGuardState` 에 변이 메서드(예: `incrementFinishBlock()`, `markReviewCompleted()`)를 추가하거나, 상태 변이 팩토리를 가드 내부에 제공하는 방식을 검토. 현재 규모에서는 즉각 수정 필요 없음.

---

### **[WARNING]** evaluateReviewGuard 의 시그니처 파라미터 수 과다 (9개)
- 위치: `tools/assistant-finish-guard.service.ts` lines 586–596 (`evaluateReviewGuard` 메서드 시그니처)
- 상세: `history`, `planForTurn`, `pendingToolCalls`, `state`, `originalRequest`, `assistantText`, `shadow`, `workspaceId`, `currentWorkflowId` 9개 파라미터를 받는다. 이 중 `history`, `planForTurn`, `pendingToolCalls`, `originalRequest`, `assistantText` 는 "이번 턴 컨텍스트" 로 묶을 수 있는 개념적 단위이며, `workspaceId`/`currentWorkflowId` 는 스코프 식별자다. 파라미터가 많을수록 호출 오류(순서 착오)·유지보수 비용이 높아진다. `evaluateFinishGuard`(5개)와 비교해도 불균형하다.
- 제안: "이번 턴 실행 컨텍스트"를 담은 인터페이스 타입(예: `GuardEvalContext { history, planForTurn, pendingToolCalls, originalRequest, assistantText, shadow, workspaceId, currentWorkflowId }`)을 정의해 파라미터를 1개 객체로 압축. 양쪽 메서드가 동일 컨텍스트 타입을 공유하면 호출부 코드도 단순해진다.

---

### **[INFO]** collect-pending-user-config: 함수 단위 추출의 적절성
- 위치: `tools/collect-pending-user-config.ts` (전체, 33 라인)
- 상세: `WorkflowAssistantStreamService.collectPendingUserConfig` private 메서드를 독립 순수 함수로 추출했다. edit 경로(`collectPendingUserConfigWithCandidates`)와 review 가드(`AssistantFinishGuard.evaluateReviewGuard`) 두 경로가 동일 로직을 공유한다. 추상화 수준이 적절하고, 테스트 가능성도 높다. `shadow.snapshot()` 을 내부에서 재호출하는 구조(노드 탐색 시 매번 호출)가 있으나, 가드 내부에서 이미 한 번 찍은 `snapshot` 을 전달하지 않고 `shadow` 인스턴스를 전달하는 설계다. review 가드는 `snapshot` 을 캡처한 뒤 `collectPendingUserConfig(shadow, n.id, ...)` 를 호출해 내부에서 `shadow.snapshot()` 을 다시 호출한다. 동일 턴 내 `snapshot()` 이 여러 번 호출되나, JSDoc 에 "shallow clone" 으로 명시되어 있어 비용은 낮다.
- 제안: 성능 민감 경로라면 `snapshot` 을 파라미터로 받는 시그니처(`collectPendingUserConfig(snapshot, nodeId, nodeRegistry)`)를 고려. 현재 규모에서는 즉각 수정 필요 없음.

---

### **[INFO]** 레이어 책임 분리 적정성
- 위치: `tools/assistant-finish-guard.service.ts` 전체
- 상세: `AssistantFinishGuard` 는 비즈니스 레이어 도메인 서비스로 적절히 배치되어 있다. DB 직접 접근 없이 주입받은 `CandidateLookupService`(데이터 레이어 위임)와 `NodeComponentRegistry`(도메인 카탈로그)를 사용한다. SSE 방출·HTTP 응답 등 프레젠테이션 레이어 관심사는 완전히 배제되어 있다. 레이어 책임 분리가 명확하다.
- 제안: 해당 없음.

---

### **[INFO]** 테스트 커버리지 전략: 단위/통합 분리
- 위치: `tools/assistant-finish-guard.service.spec.ts` (신설, 12 케이스), `workflow-assistant-stream.service.spec.ts` (통합 테스트 연동)
- 상세: blocking/verify 체크리스트 양성 경로는 무거운 shadow·registry fixture 가 필요해 통합 테스트(`workflow-assistant-stream.service.spec.ts`)로 위임하고, 단위 테스트는 가볍게 (a) `evaluateFinishGuard` 전 분기와 (b) `shouldSkipReview` 판정만 커버한다. 테스트 피라미드 원칙에 맞는 전략이다. `fakeShadow` / `freshState` / `makeGuard` 헬퍼가 반복 픽스처 생성을 추상화해 테스트 코드의 응집도가 높다.
- 제안: `evaluateReviewGuard` 의 실제 blocking checklist 발동 경로는 단위 테스트에서 커버하지 않는다는 점이 명시되어 있다. 통합 테스트가 이를 커버한다면 전략적으로 OK. 통합 테스트 범위를 별도로 확인 권장.

---

### **[INFO]** 확장성: 새 가드 유형 추가 시 인터페이스 부재
- 위치: `tools/assistant-finish-guard.service.ts` (`AssistantFinishGuard` 클래스)
- 상세: 현재 `AssistantFinishGuard` 는 구체 클래스로만 존재하며, 추상 인터페이스나 추상 클래스가 없다. `WorkflowAssistantStreamService` 는 구체 타입을 직접 주입받는다. 향후 "가드 교체(예: 테스트 더블 주입, 가드 전략 패턴 도입)" 시 소비자 코드를 수정해야 한다. NestJS 의 토큰 기반 DI 를 활용하면 인터페이스 없이도 대체 가능하나, 명시적 인터페이스가 없으면 계약이 코드로 표현되지 않는다.
- 제안: 단기적으로는 현재 설계로도 충분하다. 가드 전략이 여러 가지로 분기될 가능성이 있다면, `IFinishGuard` 인터페이스 혹은 `abstract class FinishGuard` 를 도입해 개방-폐쇄 원칙을 강화하는 것을 중장기 과제로 검토.

---

## 요약

이번 리팩터링은 `WorkflowAssistantStreamService` 에 혼재하던 finish/review 가드 로직을 `AssistantFinishGuard` 무상태 collaborator 로 성공적으로 분리한 SRP 이행 작업이다. 의존성 역전(생성자 주입), type-only import 를 통한 런타임 순환 참조 차단, 공유 헬퍼 함수 추출(`collect-pending-user-config`, `isPlanPendingApproval`), 단위/통합 테스트 분리 전략 모두 아키텍처 원칙에 부합하며 레이어 책임 분리가 명확하다. 지적 사항은 `evaluateReviewGuard` 의 9개 파라미터 시그니처(파라미터 객체로 압축 권장)와 구체 클래스 의존 주입(인터페이스 부재)으로, 현재 규모에서는 즉각적인 블로킹 이슈가 아니나 서비스가 성장할수록 유지보수 비용으로 이어질 수 있다. Critical 이슈 없음.

---

## 위험도

LOW