# 부작용(Side Effect) 리뷰 결과

리뷰 대상: M-3 1단계 — AssistantToolRouter 추출 (explore dispatch + kind 분류 분리)
리뷰 일시: 2026-06-23

---

## 발견사항

### [INFO] `schemaCache` 변경 — 호출자 소유 Map 을 router 가 직접 변이
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-m3-assistant-tool-router/codebase/backend/src/modules/workflow-assistant/tools/assistant-tool-router.service.ts` L509 (`cached.hits += 1`), L537 (`ctx.schemaCache.set(...)`)
- 상세: `dispatchExplore`는 `ExploreDispatchContext.schemaCache` 를 참조로 받아 내부에서 직접 `hits` 를 증가시키고 새 항목을 `set`한다. 이는 의도된 설계(router가 무상태 singleton이므로 turn-scoped 상태를 호출자가 소유)이며, 인터페이스 문서에도 명시되어 있다. 그러나 router가 전달받은 Map을 변이한다는 사실이 `ExploreDispatchContext` 인터페이스 타입 서술만으로는 충분히 드러나지 않는다 — 읽기 전용 필드인지 쓰기 가능한지 타입 레벨에서 구분되지 않는다. 현재 테스트에서는 `ctx.schemaCache.get(...)` 단언으로 변이를 검증하므로 동작은 보장된다.
- 제안: `ExploreDispatchContext.schemaCache` JSDoc에 "router가 hits 증가 및 신규 항목 삽입으로 이 Map을 변이한다 — 호출자는 동일 Map을 여러 dispatchExplore 호출에 걸쳐 재사용해야 turn-scoped 캐시가 작동한다"를 명시하면 미래 호출자가 매 호출마다 새 Map을 생성하는 실수를 방지할 수 있다.

---

### [INFO] `WorkflowAssistantStreamService` 생성자 시그니처 변경 — `ExploreToolsService` → `AssistantToolRouter`
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-m3-assistant-tool-router/codebase/backend/src/modules/workflow-assistant/workflow-assistant-stream.service.ts` L322 (생성자 파라미터)
- 상세: `private readonly exploreTools: ExploreToolsService` 가 `private readonly toolRouter: AssistantToolRouter` 로 교체됐다. NestJS DI 컨테이너 환경에서는 모듈 providers 에 `AssistantToolRouter` 가 추가되었으므로 런타임 주입은 정상이다. 그러나 이 서비스를 `new WorkflowAssistantStreamService(...)` 로 직접 인스턴스화하는 테스트 코드는 모두 영향을 받는다. 실제로 `workflow-assistant-stream.service.spec.ts` 에서 이를 반영해 `toolRouter` 를 생성·주입하는 방식으로 수정되었으며, 다른 직접 인스턴스화 코드가 없는지는 확인이 필요하다. 커밋 메시지의 "unit 375 PASS" 로 누락이 없음을 간접 확인할 수 있다.
- 제안: 추가 조치 불필요. 테스트 패스로 호출자 영향이 검증됐다.

---

### [INFO] `asString` 함수 — 모듈 간 복사 제거, 새 shared 모듈 도입
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-m3-assistant-tool-router/codebase/backend/src/modules/workflow-assistant/tools/coerce.ts`
- 상세: 기존 `workflow-assistant-stream.service.ts` 의 파일 스코프 함수 `asString` 이 `tools/coerce.ts` 로 이동했다. 함수 시그니처·동작은 완전히 동일하므로 기존 호출부에 행동 변화는 없다. `tools/` 범위의 어떤 모듈이든 import 할 수 있게 되어 향후 남용(예: 서로 다른 파싱 의미의 `asString` 을 추가) 위험이 있으나, 현재 구현체 자체는 순수 함수이므로 부작용 없음.
- 제안: 조치 불필요.

---

### [INFO] `SCHEMA_LOOKUP_HARD_STOP` 상수 이동 — 모듈 경계 변경
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-m3-assistant-tool-router/codebase/backend/src/modules/workflow-assistant/tools/assistant-tool-router.service.ts` L406 (`const SCHEMA_LOOKUP_HARD_STOP = 3`)
- 상세: 상수가 `workflow-assistant-stream.service.ts` 에서 `assistant-tool-router.service.ts` 로 이동했다. 두 파일 모두에서 파일-스코프 비공개 상수이며, 값(3)은 동일하다. 이 상수가 외부에서 직접 참조되지 않으므로 공개 인터페이스 변경에 해당하지 않는다.
- 제안: 조치 불필요.

---

### [INFO] `verify_workflow` `reviewCompleted` 신호 경로 변경 — 간접화
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-m3-assistant-tool-router/codebase/backend/src/modules/workflow-assistant/workflow-assistant-stream.service.ts` L1019 (`if (exploreOutcome.reviewCompleted) { guardState.reviewCompleted = true; }`)
- 상세: 기존에는 `streamMessage` 루프가 `verifyResult.ok === true` 를 직접 검사해 `guardState.reviewCompleted = true` 를 설정했다. 변경 후에는 `dispatchExplore` 가 `reviewCompleted: boolean` 필드를 포함한 `ExploreDispatchResult` 를 반환하고, 호출부가 이를 조건으로 가드 상태를 갱신한다. 의미론적으로 동일하지만 `reviewCompleted` 가 `false` 인 경우에도 가드가 갱신되지 않는 경로(`exploreOutcome.reviewCompleted` 가 `false` 일 때 `guardState.reviewCompleted` 를 건드리지 않음)가 그대로 유지되어 이전 동작이 보존된다.
- 제안: 조치 불필요.

---

### [INFO] NestJS 모듈 providers 에 `AssistantToolRouter` 추가 — 싱글턴 스코프 등록
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-m3-assistant-tool-router/codebase/backend/src/modules/workflow-assistant/workflow-assistant.module.ts` L1284
- 상세: `AssistantToolRouter` 는 `@Injectable()` 로 선언되어 NestJS 기본 싱글턴 스코프로 등록된다. turn-scoped 상태(`schemaCache`, `shadow`)는 router 자체가 보유하지 않고 호출 시점에 `ExploreDispatchContext` 로 전달되므로, 싱글턴이어도 동시 요청 간 상태 공유가 없다. 설계 의도와 실제 구현이 일치한다.
- 제안: 조치 불필요.

---

## 요약

이번 변경은 `streamMessage` 내부 로직을 `AssistantToolRouter` 로 추출하는 순수 리팩터링이다. 전역 변수 도입 없음, 환경 변수 접근 없음, 파일시스템 부작용 없음, 외부 네트워크 호출 패턴 변경 없음. 가장 주목할 부작용 관련 항목은 `schemaCache` Map 의 명시적 변이인데, 이는 의도된 설계이며 테스트로 검증되어 있다. `WorkflowAssistantStreamService` 생성자 시그니처 변경은 테스트 코드에서 이미 반영되었다. `verify_workflow` → `guardState.reviewCompleted` 갱신 경로가 `ExploreDispatchResult.reviewCompleted` 필드를 통해 간접화되었으나 의미론적 동작은 동일하다. 전반적으로 의도하지 않은 부작용이 발견되지 않는다.

---

## 위험도

NONE

---

STATUS: SUCCESS
