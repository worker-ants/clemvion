# 부작용(Side Effect) 코드 리뷰

**리뷰 대상**: `refactor(workflow-assistant): M-3 2단계 — finish/review 가드를 AssistantFinishGuard 로 분리`
**리뷰 일시**: 2026-06-24

---

## 발견사항

### **[INFO]** `isPlanPendingApproval` 함수의 스코프 확장 — 모듈 레벨 공개 export 로 승격
- **위치**: `codebase/backend/src/modules/workflow-assistant/tools/active-plan-context.ts` (라인 68-72)
- **상세**: 원래 `workflow-assistant-stream.service.ts` 내부의 private 파일 스코프 함수였던 `isPlanPendingApproval` 이 `active-plan-context.ts` 의 `export function` 으로 이동됐다. 함수 시그니처(`plan: AssistantPlanRecord | null => boolean`)는 동일하게 유지되므로 기존 3곳(edit 핸들러, `evaluateFinishGuard`, 메인 루프)의 호출부에 영향이 없다. 이 승격은 의도된 리팩토링으로 새 의존 경로(`assistant-finish-guard.service.ts` → `active-plan-context.ts`)를 만들지만, `active-plan-context.ts` 는 이미 해당 모듈의 공유 유틸 파일이므로 순환 의존이 발생하지 않는다.
- **제안**: 해당 없음. 의도된 변경이며 부작용 없음.

---

### **[INFO]** `collectPendingUserConfig` 추출 — private 메서드에서 모듈 레벨 순수 함수로 변환
- **위치**: `codebase/backend/src/modules/workflow-assistant/tools/collect-pending-user-config.ts` (신규 파일)
- **상세**: `WorkflowAssistantStreamService.collectPendingUserConfig` (private 인스턴스 메서드, `this.nodeRegistry` 캡처)가 `nodeRegistry` 를 명시적 파라미터로 받는 순수 함수로 추출됐다. 함수 로직 자체는 동일하다(`shadow.snapshot().nodes.find` → `nodeRegistry.getComponent` → `z.toJSONSchema` → `detectPendingUserConfig`). 호출부(`collectPendingUserConfigWithCandidates`)는 `this.collectPendingUserConfig(shadow, nodeId)` 에서 `collectPendingUserConfig(shadow, nodeId, this.nodeRegistry)` 로 교체됐다. 전역 상태 변경 없음, 파일시스템 접근 없음, 외부 네트워크 호출 없음.
- **제안**: 해당 없음.

---

### **[INFO]** `AssistantFinishGuard` 신규 `@Injectable()` 서비스 — NestJS DI 컨테이너 등록
- **위치**: `codebase/backend/src/modules/workflow-assistant/workflow-assistant.module.ts` (라인 50, providers 배열 추가)
- **상세**: `AssistantFinishGuard` 가 `WorkflowAssistantModule` 의 `providers` 배열에 추가됐다. NestJS 모듈 providers 는 모듈 스코프 싱글턴이며, 이 서비스는 `nodeRegistry: NodeComponentRegistry` 와 `candidateLookup: CandidateLookupService` 를 생성자 주입받는다. 두 의존성은 기존에 `WorkflowAssistantStreamService` 도 이미 주입받던 서비스로, 새로운 외부 DI 의존성 추가는 아니다. `exports` 배열에는 추가되지 않았으므로 외부 모듈에 노출되지 않는다.
- **제안**: 해당 없음. 의도된 모듈 구성 변경이며 다른 모듈에 전파되지 않는다.

---

### **[INFO]** `WorkflowAssistantStreamService` 생성자 시그니처 변경 — `finishGuard` 파라미터 추가
- **위치**: `codebase/backend/src/modules/workflow-assistant/workflow-assistant-stream.service.ts` (라인 203)
- **상세**: `WorkflowAssistantStreamService` 생성자에 `private readonly finishGuard: AssistantFinishGuard` 파라미터가 추가됐다. NestJS DI 프레임워크가 런타임에 자동으로 주입하므로 직접 생성자 호출 코드가 없다면 문제없다. 단, 단위·통합 테스트에서 `new WorkflowAssistantStreamService(...)` 를 직접 호출하는 경우 파라미터 목록 변경 영향이 있다. 실제로 `workflow-assistant-stream.service.spec.ts` 에서 `makeService()` 함수가 `finishGuard` 를 올바르게 구성해 전달하도록 업데이트됐음을 확인했다(`new AssistantFinishGuard(mocks.nodeRegistry, candidateLookup)` + `finishGuard` 추가 전달). 다른 테스트 파일 또는 모의 객체에서 이 서비스를 직접 생성하는 경우가 없다면 호환성 문제가 없다.
- **제안**: 이 모듈 밖에서 `WorkflowAssistantStreamService` 를 직접 인스턴스화하는 코드(예: 다른 테스트 파일, e2e 픽스처)가 있다면 `finishGuard` 인자 추가가 필요하다. 커밋 메시지에 "기존 통합 테스트 381 무변 green" 이라고 명시되어 있어 실제 영향은 없는 것으로 보인다.

---

### **[INFO]** `FinishGuardState` 인터페이스 및 `FinishGuardError` 타입 — private 에서 public export 로 승격
- **위치**: `codebase/backend/src/modules/workflow-assistant/tools/assistant-finish-guard.service.ts`
- **상세**: 원래 `workflow-assistant-stream.service.ts` 내부에 선언된 `interface FinishGuardState` 와 `type FinishGuardError` 가 별도 파일의 `export` 로 이동됐다. 스펙 테스트(`assistant-finish-guard.service.spec.ts`)에서 `import type { FinishGuardState }` 로 참조되며, 이는 의도된 사용이다. 인터페이스 구조(필드명, 타입) 자체는 변경 없이 동일하게 이전됐다. 전역 상태 접근 없음.
- **제안**: 해당 없음.

---

### **[INFO]** `evaluateFinishGuard` / `evaluateReviewGuard` — private 메서드에서 public 메서드로 접근성 변경
- **위치**: `codebase/backend/src/modules/workflow-assistant/tools/assistant-finish-guard.service.ts`
- **상세**: 원래 `WorkflowAssistantStreamService` 의 `private` 메서드였던 두 가드 함수가 `AssistantFinishGuard` 의 `public` 메서드로 이전됐다. 외부에서 호출 가능해졌으나, 반환값만 있고 공유 상태를 변이하지 않는 순수 판정 함수다(`FinishGuardState` 는 호출부에서 소유·변이, 가드는 판정만). 상태 변이·SSE emit·DB persist 는 여전히 `streamMessage` 가 담당한다. 이 구조상 가드가 외부에 노출되어도 의도치 않은 상태 변경 경로는 없다.
- **제안**: 해당 없음.

---

### **[INFO]** `review/consistency/` 하위 산출물 파일 커밋 — 빌드 아티팩트 혼입 여부
- **위치**: `review/consistency/2026/06/24/07_58_47/` (SUMMARY.md, cross_spec.md, plan_coherence.md, rationale_continuity.md, convention_compliance.md, naming_collision.md, meta.json, _retry_state.json)
- **상세**: 일관성 검토 산출물이 동일 커밋에 포함됐다. 이는 CLAUDE.md 규약("일관성 검토 산출물 위치: `review/consistency/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/`")에 따른 의도된 파일 생성이다. `_retry_state.json` 에는 로컬 절대 경로(`/Volumes/project/private/clemvion/...`)가 포함되어 있어 다른 환경에서 재현성이 없을 수 있으나, 이 파일은 오케스트레이터 내부 상태 추적용으로 사용 후 재사용되지 않는다.
- **제안**: `_retry_state.json` 에 로컬 절대 경로가 하드코딩되어 있는 점은 기존 패턴과 동일한 pre-existing 이슈이며, 이번 변경이 도입한 문제가 아니다. 영향 없음.

---

## 요약

이번 변경은 `WorkflowAssistantStreamService` 내부에 혼재하던 finish/review 가드 로직을 `AssistantFinishGuard` 라는 무상태 collaborator 로 추출하는 구조 리팩토링이다. 부작용 관점에서 핵심 사항은 다음과 같다: (1) 모든 상태 변이(FinishGuardState 카운터 변경, SSE emit, DB persist)는 기존과 동일하게 호출부(`streamMessage`)에서만 발생하며 가드는 순수 판정만 수행한다. (2) 새로 추출된 `isPlanPendingApproval`, `collectPendingUserConfig` 는 전역 상태를 참조하거나 수정하지 않는다. (3) NestJS DI 등록(`AssistantFinishGuard` providers 추가)은 모듈 내부 싱글턴 변경이며 외부 exports 를 건드리지 않는다. (4) `WorkflowAssistantStreamService` 생성자에 `finishGuard` 파라미터가 추가됐으나, 이를 직접 생성하는 테스트 코드도 함께 업데이트됐다. 네트워크 호출·파일시스템·환경 변수에 관련된 의도치 않은 부작용은 발견되지 않았다.

---

## 위험도

NONE
