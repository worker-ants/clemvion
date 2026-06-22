# 테스트(Testing) 리뷰

## 발견사항

### [INFO] 신규 테스트 4건 추가 — 이전 리뷰 지적 사항 적절히 해소
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-m3-assistant-tool-router/codebase/backend/src/modules/workflow-assistant/tools/assistant-tool-router.service.spec.ts` L283–L337
- 상세: 이전 리뷰(01_00_21)에서 INFO #3~#7로 지적된 테스트 갭 중 실질적인 4건이 이번 커밋에서 추가됐다.
  - `bypasses the cache for non-string type args`: 비문자열 type 인자 시 캐시 우회 동작 고정.
  - `returns UNKNOWN_EXPLORE_TOOL`: `handleExploreCall` default 브랜치 도달 경로 커버.
  - `delegates get_workflow with mode=full/summary`: mode 파라미터 분기 위임 단언.
  - `verify_workflow on an empty canvas`: 빈 스냅샷 + 빈 ids → ok:true + reviewCompleted:true 설계 의도 고정.
- 제안: 현행 유지. 테스트 추가 방향이 정확하다.

### [INFO] `coerce.spec.ts` 신설 — 경계값 커버 충분
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-m3-assistant-tool-router/codebase/backend/src/modules/workflow-assistant/tools/coerce.spec.ts`
- 상세: null, undefined, number, object, array, boolean → fallback, 빈 문자열·정상 문자열 → passthrough 총 8개 케이스. `asString` 이 한 줄 구현이므로 이 커버리지는 완전하다. 테스트명이 의도를 명확히 표현한다.
- 제안: 변경 없이 충분.

### [INFO] `dispatchNodeSchema` private 메서드 — 테스트가 `dispatchExplore` 퍼블릭 API 경유로 간접 커버
- 위치: `assistant-tool-router.service.ts` L129–L167 (`private dispatchNodeSchema`)
- 상세: 리팩터링으로 `get_node_schema` 처리가 `dispatchNodeSchema` private 메서드로 추출됐다. 기존 `get_node_schema` 캐시 3-단계 테스트(hits=1/2/3)와 이번에 추가된 비문자열 type 우회 테스트가 해당 메서드 전 경로를 `dispatchExplore` 경유로 실행한다. private 메서드를 직접 테스트하지 않고 퍼블릭 인터페이스를 통해 커버하는 접근은 테스트 격리 원칙에 부합한다.
- 제안: 현행 유지.

### [INFO] `get_current_workflow` safety-net 브랜치(`handleExploreCall` L215-L222) 미커버
- 위치: `assistant-tool-router.service.ts` L215–L222 (`case 'get_current_workflow':` in `handleExploreCall`)
- 상세: `get_current_workflow` 는 `dispatchExplore` 에서 선처리되므로 `handleExploreCall` 의 safety-net case 는 정상 경로상 도달 불가다. RESOLUTION.md 에서 "도달 불가 — `dispatchExplore` 가 먼저 가로채므로 방어용" 으로 분류·근거 기재됨. 도달 불가 코드 경로를 테스트하려면 `handleExploreCall` 을 직접 호출하는 구조나 별도 접근이 필요하며, private 메서드이므로 현재 구조상 퍼블릭 API 경유로는 커버 불가. 위험도는 낮다(실제 도달 불가 경로).
- 제안: INFO 수준. 도달 불가 방어 코드이므로 테스트 추가 우선순위 낮음. INFO #9에서 `throw` 전환 권고가 있었으나 behavior-preserving 원칙으로 defer된 상태 — `throw` 전환 시 자연스럽게 테스트 추가 가능.

### [INFO] `list_knowledge_bases`, `get_workflow_executions`, `get_execution_details` 위임 테스트 미추가
- 위치: `assistant-tool-router.service.spec.ts` — `dispatchExplore` describe
- 상세: 이전 리뷰 INFO #7에서 "위임 케이스 단위 테스트 미커버" 로 지적된 항목 중 `get_workflow`(mode 분기)는 이번에 추가됐으나 `list_knowledge_bases`, `get_workflow_executions`, `get_execution_details` 3개 도구는 여전히 단위 테스트가 없다. 이들은 모두 `handleExploreCall` switch 의 단순 위임 case 이며 복잡한 분기 로직이 없다. 통합 테스트가 간접 커버할 가능성이 있으나, 현재 spec 파일의 범위 내에서는 갭이다.
- 제안: INFO 수준. 각 도구 위임 시 workspaceId/currentWorkflowId 가 올바르게 전달되는지 확인하는 단순 위임 단언 테스트 추가 권장. 아직 커버되지 않은 특수 케이스: `get_workflow_executions` 의 `status`·`limit` 파라미터, `get_execution_details` 의 비문자열 id 처리.

### [INFO] `verify_workflow` — `verifiedNodeIds`/`verifiedEdgeIds` 비배열 인자 처리 미테스트
- 위치: `assistant-tool-router.service.ts` L251–L258 (`buildVerifyWorkflowResult`)
- 상세: `buildVerifyWorkflowResult` 는 `Array.isArray` 로 방어하여 비배열 인자를 빈 배열로 처리한다. 이 경로는 LLM 이 잘못된 타입을 넘길 때 발생할 수 있다. 현재 테스트는 정상적인 배열 인자만 다루며, 비배열(`null`, 미전달 등) 인자 시의 동작(모든 id 미커버 → `VERIFY_INCOMPLETE`)은 커버되지 않는다.
- 제안: INFO 수준. 실제 발생 가능성이 있는 edge case이나, 현행 방어 로직이 명확해 리스크는 낮다.

### [INFO] `makeExploreTools` mock 팩토리에 `verify_workflow`/`get_current_workflow` 관련 mock 없음 — 설계상 의도적
- 위치: `assistant-tool-router.service.spec.ts` L19–L29 (`makeExploreTools`)
- 상세: `get_current_workflow` 와 `verify_workflow` 는 `ExploreToolsService` 를 호출하지 않고 shadow 로 처리되므로, mock 팩토리에 해당 메서드가 없는 것은 설계 의도와 일치하며 오히려 경계를 명확히 보여준다. 테스트에서 `exploreTools.getNodeSchema.not.toHaveBeenCalled()` 단언이 이 경계를 명시적으로 검증한다.
- 제안: 현행 유지. 설계 의도가 mock 팩토리 구조에 자연스럽게 반영됨.

### [INFO] 테스트 격리 우수 — `beforeEach` 로 매 테스트 독립 인스턴스
- 위치: `assistant-tool-router.service.spec.ts` L87–L90
- 상세: `describe('dispatchExplore')` 블록이 `beforeEach` 에서 `exploreTools` 와 `router` 를 새로 생성하고, `makeCtx` 헬퍼가 매번 새 `Map` 을 생성하므로 `schemaCache` 상태가 테스트 간 공유되지 않는다. 모든 상태변이(hits 증가, cache.set)가 테스트 범위를 벗어나지 않는다.
- 제안: 현행 유지.

## 요약

이번 커밋은 이전 리뷰(01_00_21)에서 지적된 테스트 갭(INFO #3~#7) 중 핵심 4건을 직접 해소했다: 비문자열 type 캐시 우회, UNKNOWN_EXPLORE_TOOL default 브랜치, get_workflow mode 분기, 빈 캔버스 verify_workflow 설계 의도 고정. `coerce.spec.ts` 신설로 asString 경계값도 완전히 커버됐다. 잔여 갭은 `list_knowledge_bases`/`get_workflow_executions`/`get_execution_details` 단순 위임 3개, 도달 불가 safety-net 브랜치, verify_workflow 비배열 인자 처리로, 모두 동작 보존 리팩터링 범위 안에서 낮은 우선순위의 INFO 수준이다. 테스트 격리·가독성·mock 구조 모두 양호하다.

## 위험도

LOW
