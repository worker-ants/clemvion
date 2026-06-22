# 유지보수성(Maintainability) 리뷰 결과

리뷰 대상: M-3 1단계 — `AssistantToolRouter` 추출 (commit c038cb4f)
리뷰 일시: 2026-06-23

---

## 발견사항

### [INFO] `dispatchExplore` 함수 내 `get_node_schema` 처리 블록이 비교적 길다
- 위치: `codebase/backend/src/modules/workflow-assistant/tools/assistant-tool-router.service.ts` L108–L146
- 상세: `dispatchExplore`는 총 72줄 함수로, 내부에 `get_current_workflow` / `verify_workflow` / `get_node_schema` / 기본 경로의 4개 분기가 존재한다. 특히 `get_node_schema` 블록(L108–L146)은 캐시 조회·hits 증가·hard-stop 결정·warning 결과 조립·첫 호출 캐시 저장이라는 5가지 단계가 한 블록에 섞여 있어, 순환 복잡도 측면에서 다소 높다(6~7 경로). 현재 규모에서 즉각적인 문제는 아니지만, M-3 후속 단계에서 guard 분리 시 이 블록만 별도 `handleNodeSchema()` private 메서드로 추출하면 가독성과 테스트 격리가 동시에 향상된다.
- 제안: `dispatchExplore` 내 `get_node_schema` 처리를 `private handleNodeSchemaWithCache(args, ctx): Promise<ExploreDispatchResult>` 로 추출. 함수 호출 하나로 교체하면 `dispatchExplore`가 순수 라우팅 분기 역할만 담당하게 된다.

---

### [INFO] `buildVerifyWorkflowResult`의 반환 타입이 `unknown`
- 위치: `codebase/backend/src/modules/workflow-assistant/tools/assistant-tool-router.service.ts` L235
- 상세: `buildCurrentWorkflowResult`와 `buildVerifyWorkflowResult` 모두 반환 타입이 `unknown`이다. 호출부인 `dispatchExplore`에서 `(verifyResult as { ok?: boolean } | undefined)?.ok` 로 타입 단언이 필요한 이유가 된다(L104–105). 실제 반환 shape이 명확함에도 타입 안전성을 포기하는 패턴이다. verbatim 이동 결과이므로 이번 PR 범위 안으로 보기 어렵지만, 후속 단계에서 구체 반환 타입(`VerifySuccessResult | VerifyIncompleteResult`) 을 도입하면 as-cast 제거 및 exhaustive 검사가 가능해진다.
- 제안: 인터페이스 `VerifyWorkflowResult = { ok: true; verifiedNodeCount: number; verifiedEdgeCount: number } | { ok: false; error: 'VERIFY_INCOMPLETE'; ... }` 를 export하고 반환 타입에 적용. `dispatchExplore`의 타입 단언도 함께 제거 가능.

---

### [INFO] `handleExploreCall` switch에 `get_current_workflow` safety net case가 포함되어 있으나 도달 불가 경로임이 주석에만 명시
- 위치: `codebase/backend/src/modules/workflow-assistant/tools/assistant-tool-router.service.ts` L203–L210
- 상세: `handleExploreCall`은 private 메서드이며 `dispatchExplore`가 `get_current_workflow`를 미리 처리한 뒤에만 호출된다. 따라서 L203 case는 실행 불가 방어 코드다. 주석으로 의도를 명시한 점은 긍정적이나, TypeScript 환경에서 이런 방어 경로는 `never` 단언이나 `throw new Error('unreachable')`로 표현하는 편이 런타임 오류를 즉각 노출해 디버깅에 유리하다. 현재 `ok: false` 응답을 반환하면 LLM이 조용히 비정상 경로로 진행할 수 있다.
- 제안: case `'get_current_workflow'`를 `throw new Error('AssistantToolRouter: get_current_workflow must be intercepted before handleExploreCall')` 로 변경. 프로그래밍 오류를 조용한 응답 대신 명시적 예외로 드러낸다.

---

### [INFO] `args.type` 추출 패턴이 `asString` 헬퍼를 사용하지 않고 인라인 삼항으로 작성됨
- 위치: `codebase/backend/src/modules/workflow-assistant/tools/assistant-tool-router.service.ts` L113
- 상세: `const typeArg = typeof args.type === 'string' ? args.type : '';` 는 `coerce.ts`의 `asString`과 동일한 패턴이다. `handleExploreCall` 내에서는 `asString(args.type, '')`을 이미 쓰고 있어(L168), 같은 파일 안에서 스타일 불일치가 발생한다. 사소한 중복이지만, `asString`이 공유 유틸로 분리된 취지에 맞게 통일하는 것이 일관성에 좋다.
- 제안: L113을 `const typeArg = asString(args.type, '');`으로 교체.

---

### [INFO] spec.ts의 `makeExploreTools` 팩토리가 `getWorkflow`를 mock하지 않으나 테스트에서 `get_workflow` 케이스를 검증하지 않음
- 위치: `codebase/backend/src/modules/workflow-assistant/tools/assistant-tool-router.service.spec.ts` L81–91
- 상세: `makeExploreTools()`에 `getWorkflow: jest.fn()`이 있으나, spec 파일 내 `dispatchExplore` 테스트에는 `get_workflow` 케이스를 호출하는 테스트가 없다. `list_integrations`·`list_workflows`·`get_node_schema` 경로는 커버되어 있지만, `get_workflow`, `get_workflow_executions`, `get_execution_details`에 대한 위임 단언 테스트가 빠져 있다. 현재 유닛 테스트의 커버리지 갭으로, 후속 단계에서 router를 수정할 때 회귀를 놓칠 수 있다.
- 제안: `delegates get_workflow to ExploreToolsService`, `delegates get_workflow_executions`, `delegates get_execution_details` 3개 케이스를 `dispatchExplore` describe 블록에 추가.

---

## 요약

이번 변경은 `streamMessage` 내 혼재된 explore 로직을 `AssistantToolRouter`로 단일 책임 분리하는 리팩터링으로, 유지보수성 측면에서 명백한 개선이다. 클래스 JSDoc이 잘 작성되어 있고, 공개 인터페이스(`ExploreDispatchContext`, `ExploreDispatchResult`, `SchemaCacheEntry`)의 의도가 명확하게 문서화되어 있다. `coerce.ts` 분리로 순환 의존을 회피한 설계도 적절하다. 다만 `dispatchExplore` 내 `get_node_schema` 블록이 비교적 긴 것, `buildVerifyWorkflowResult`의 `unknown` 반환 타입으로 인한 downstream 타입 단언, `handleExploreCall`의 unreachable case가 예외가 아닌 응답으로 처리되는 점, `asString` 사용 불일치, 테스트 커버리지 갭이 소규모 문제로 남는다. 모두 INFO 수준이며 즉각적인 수정 의무는 없고, M-3 후속 단계(Guard 분리)와 묶어서 처리하는 것이 효율적이다.

## 위험도

LOW
