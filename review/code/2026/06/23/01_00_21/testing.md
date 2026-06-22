# Testing Review — AssistantToolRouter 추출 (M-3 1단계)

## 발견사항

### [INFO] `coerce.ts`의 `asString` 헬퍼에 대한 독립 단위 테스트 없음
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-m3-assistant-tool-router/codebase/backend/src/modules/workflow-assistant/tools/coerce.ts`
- 상세: `asString`은 신규 공유 유틸리티 모듈로 분리됐지만 전용 spec 파일이 없다. 현재 기능은 단순하고 `assistant-tool-router.service.spec.ts`의 위임 테스트에서 간접 커버된다. 그러나 경계값(null, undefined, number, object, 빈 문자열)에 대한 명시 테스트가 없어, 추후 fallback 로직이 변경될 때 회귀를 잡기 어렵다.
- 제안: `coerce.spec.ts`를 신설하거나 `assistant-tool-router.service.spec.ts` 상단에 `asString` 섹션을 추가. 최소 케이스: `asString(null, 'fb')→'fb'`, `asString(undefined, 'fb')→'fb'`, `asString(42, 'fb')→'fb'`, `asString({}, 'fb')→'fb'`, `asString('', 'fb')→''`(빈 문자열은 통과).

---

### [INFO] `get_node_schema` 캐시에서 `typeArg`가 빈 문자열(`''`)일 때의 경로 미커버
- 위치: `assistant-tool-router.service.ts` L113-L146, `assistant-tool-router.service.spec.ts` — `get_node_schema turn-scoped cache` describe 블록
- 상세: 구현 코드는 `typeArg`가 빈 문자열이면 캐시 룩업 및 캐시 저장을 모두 건너뛰고(`if (typeArg)` 가드) 무조건 `handleExploreCall`로 위임한다. 이 경로(비타입 인자 전달 시 캐시 우회)는 테스트에 없다. 또한 같은 빈 타입으로 연속 호출해도 `hits` 카운터 없이 무제한 위임되므로 하드스톱 로직이 동작하지 않는 특수 케이스다.
- 제안: `{ type: 123 }` 또는 `{}` 처럼 비문자열 type 인자로 `get_node_schema`를 호출했을 때 캐시가 작동하지 않고 매번 실제 위임이 발생하는 케이스 테스트 추가. 동시에 이 무제한 위임이 의도적인지(비타입 호출은 LLM 오용이므로 반복 허용) 코드 주석으로 명시 필요.

---

### [INFO] `handleExploreCall`의 `default` 브랜치(`UNKNOWN_EXPLORE_TOOL`) 및 `get_current_workflow` safety-net 브랜치 미커버
- 위치: `assistant-tool-router.service.ts` L203-L213
- 상세: `handleExploreCall`는 private이지만, `dispatchExplore`에 미등록 explore 도구명을 넣으면 `default` 케이스로 분기해 `{ ok: false, error: 'UNKNOWN_EXPLORE_TOOL' }`를 반환한다. 또한 `get_current_workflow`가 `handleExploreCall`까지 도달하면 `INTERNAL` 에러를 반환하는 safety-net이 있다. 이 두 방어 경로 모두 테스트가 없다.
- 제안: 
  1. `dispatchExplore('unknown_explore_xyz', {}, ctx)` 호출이 `UNKNOWN_EXPLORE_TOOL` 에러를 반환하는 테스트 추가 — 미래에 신규 explore 도구 추가 시 switch 누락 회귀를 잡는 안전망.
  2. safety-net 브랜치는 호출 자체가 프로그래밍 오류 지표이므로 테스트 우선순위는 낮으나, 방어 코드 존재를 주석으로 언급하거나 별도 developer 노트로 표시.

---

### [INFO] `verify_workflow`에서 빈 스냅샷(nodes=[], edges=[]) + 빈 verifiedIds 케이스 미커버
- 위치: `assistant-tool-router.service.spec.ts` — `verify_workflow` 테스트들
- 상세: 현재 테스트는 (1) 노드/엣지가 있고 모두 커버된 경우, (2) 일부 누락된 경우만 다룬다. 워크플로우가 빈 경우(nodes=[], edges=[])에 빈 verifiedIds를 전달하면 `missingNodeIds`·`missingEdgeIds`가 모두 빈 배열이 되어 `ok:true`와 `reviewCompleted:true`를 반환한다. 이 케이스는 "아무것도 없는 워크플로우도 verify 통과" 라는 의도적 설계인지 확인이 필요하다.
- 제안: 빈 스냅샷 + 빈 verifiedIds로 `verify_workflow`를 호출하는 테스트를 추가해 설계 의도를 문서화.

---

### [INFO] `get_workflow`, `list_knowledge_bases`, `get_workflow_executions`, `get_execution_details` 위임 케이스 미커버
- 위치: `assistant-tool-router.service.spec.ts` — `dispatchExplore` describe 블록
- 상세: `dispatchExplore`에서 `list_integrations`와 `list_workflows`의 위임은 테스트되어 있으나, 나머지 4개 도구(`get_workflow`, `list_knowledge_bases`, `get_workflow_executions`, `get_execution_details`)는 테스트가 없다. 특히 `get_workflow`는 `mode` 파라미터 처리(`'full'` vs 기본 `'summary'`)와 `asString(args.id, '')` 경로가 있어 인자 처리 로직 테스트 가치가 있다.
- 제안: 이 케이스들이 "상세 검증 불필요한 단순 위임"이라면 기존 `list_integrations` 테스트와 동일한 수준의 "위임 호출 확인" 테스트를 추가. 최소한 `get_workflow`의 `mode: 'full'` vs 기본 summary 분기는 커버 권장.

---

### [INFO] `classifyKind` 테스트에서 편집 도구 일부만 샘플링
- 위치: `assistant-tool-router.service.spec.ts` L131-L138
- 상세: edit 도구(`add_node`, `add_edge`, `remove_node`)가 샘플로 검증되지만, 실제 `TOOL_KIND_BY_NAME`에 등록된 전체 edit 도구 목록이 테스트 파일에서 보이지 않는다. TOOL_KIND_BY_NAME에 `update_node`, `remove_edge` 등이 더 있다면 누락 가능성이 있다. 단, `classifyKind`는 `TOOL_KIND_BY_NAME`의 단순 룩업이라 SoT 테스트는 tool-definitions 레벨에서 하는 게 맞으므로 LOW 위험.
- 제안: 현재 접근(대표 샘플 검증)은 적절하나, `TOOL_KIND_BY_NAME`의 모든 키를 순회하는 exhaustive 테스트를 `tool-definitions.spec.ts`(또는 기존 spec에)에서 보완하면 OCP seam의 회귀 안전망이 강화된다.

---

### [INFO] 통합 테스트(`workflow-assistant-stream.service.spec.ts`)에서 `AssistantToolRouter` 생성 방식 변경
- 위치: `workflow-assistant-stream.service.spec.ts` L798-L803
- 상세: `makeService()`에서 `new AssistantToolRouter(mocks.exploreTools as never)`로 실제 router 인스턴스를 생성해 주입하는 방식은 올바르다. 이렇게 하면 통합 테스트에서 router 내부 위임 경로가 그대로 실행되어 기존 `mocks.exploreTools.*` 단언이 유효하게 유지된다. 다만 향후 `AssistantToolRouter`가 다른 의존성을 추가할 경우 `makeService()`도 같이 업데이트해야 하는 결합이 생긴다.
- 제안: 현재 방식은 적절. 단, `makeService()` 내부 주석("router 위임 경유로 그대로 성립한다")이 이 결합 관계를 충분히 설명하고 있으므로 유지.

---

## 요약

`AssistantToolRouter` 추출 리팩터링의 테스트 커버리지는 전반적으로 양호하다. 핵심 라우팅 로직(`classifyKind`)과 주요 explore 도구 위임, `get_node_schema` 캐시 3단계 정책, `verify_workflow` ok/fail 두 경로가 격리 단위 테스트로 명확히 커버되어 있다. 기존 통합 테스트(`workflow-assistant-stream.service.spec.ts`)에 실제 router 인스턴스를 주입하는 방식도 회귀 안전망으로 적절하다. 주요 갭은 (1) 신규 `coerce.ts` 유틸리티의 독립 테스트 부재, (2) `get_node_schema`의 비문자열 type 인자 경계 케이스, (3) 미등록 도구 및 빈 스냅샷 verify 케이스로, 모두 INFO 수준이며 현재 동작에 대한 리스크는 낮다. `handleExploreCall`의 `get_workflow`, `get_workflow_executions` 등 미커버 위임 도구들은 향후 해당 경로에 버그가 생겼을 때 탐지력이 낮으므로 추가 테스트 권장 수준이다.

## 위험도

LOW
