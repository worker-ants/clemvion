### 발견사항

- **[WARNING]** 매직 문자열 `'get_current_workflow'`가 여러 파일에 하드코딩됨
  - 위치: `tool-definitions.ts:17`, `workflow-assistant-stream.service.ts:224`
  - 상세: `TOOL_KIND_BY_NAME` 등록, `if (ev.name === 'get_current_workflow')` 분기, `handleExploreCall` switch의 default 경로 — 세 곳에 동일 문자열이 분산됨. 도구 이름 변경 시 service.ts의 if-분기만 놓치면 `buildCurrentWorkflowResult` 대신 `UNKNOWN_EXPLORE_TOOL`이 반환됨
  - 제안: `export const TOOL_NAME = { GET_CURRENT_WORKFLOW: 'get_current_workflow', ... } as const` 상수를 tool-definitions.ts에 추가하고 전 파일에서 참조

- **[WARNING]** 스냅샷 매핑 로직이 두 곳에 중복됨
  - 위치: `system-prompt.ts` 내 `current` 객체 조립 vs `service.ts:buildCurrentWorkflowResult`
  - 상세: 노드·엣지를 `ShadowSnapshot` → 플레인 객체로 변환하는 코드가 거의 동일하나 미묘하게 다름 — `buildCurrentWorkflowResult`는 `id`, `category`를 포함하지만 시스템 프롬프트 스냅샷은 이를 생략. 이 필드 차이는 LLM이 스냅샷과 도구 결과를 같은 포맷으로 기대할 때 혼란을 유발하고, 한쪽만 수정하면 두 표현이 조용히 발산함
  - 제안: 공유 헬퍼 `toWorkflowView(snapshot, options?: { includeId?: boolean })` 을 추출하고 두 곳에서 호출. 또는 두 포맷의 의도적 차이를 인라인 주석으로 명시

- **[WARNING]** `get_current_workflow` 특수 분기와 `handleExploreCall` 의 암묵적 결합
  - 위치: `service.ts:224-234`
  - 상세: `handleExploreCall`의 switch에 `'get_current_workflow'` case가 없어 default(`UNKNOWN_EXPLORE_TOOL`)로 떨어지는 구조. 외부 if-분기가 없어지면 조용히 오류 응답을 반환. 이 암묵적 의존 관계는 `handleExploreCall` 코드만 읽는 개발자가 파악하기 어려움
  - 제안: `handleExploreCall` 내부 default 케이스에 `// get_current_workflow는 호출자에서 사전 처리됨` 주석을 추가하거나, `handleExploreCall`에 case를 추가하고 예외를 던져 의도를 명시

- **[INFO]** 시스템 프롬프트 내 도구 이름이 자유 텍스트로 하드코딩됨
  - 위치: `system-prompt.ts:87` (authoritative snapshot 지침 문단)
  - 상세: `` `add_node` / `update_node` / `remove_node` / `add_edge` / `remove_edge` / `get_current_workflow` `` 가 자연어 prose 안에 삽입됨. 도구 이름이 변경되면 이 문장을 찾아 수동으로 수정해야 하며, 누락 시 LLM이 잘못된 도구 호출 규칙을 학습함
  - 제안: 단기적으로는 허용 가능한 수준이지만, 시스템 프롬프트 생성 시점에 `TOOL_NAME` 상수에서 보간하면 동기화가 보장됨

- **[INFO]** 테스트 내 반복적인 인라인 타입 단언
  - 위치: `spec.ts:375-391`, `spec.ts:465-470`
  - 상세: `(toolCall?.data as { kind: string; result: { ok: boolean; nodes: Array<{...}>; edges: Array<{...}> } }).result` 형태의 복잡한 타입 캐스팅이 두 테스트에서 반복됨. 가독성이 낮고 타입 변경 시 두 곳 모두 수정 필요
  - 제안: 파일 상단에 `type ToolCallData = { ... }` 로컬 타입 또는 헬퍼 함수 `getToolCallResult(events, name)` 을 추출

---

### 요약

이번 변경은 `get_current_workflow` 도구를 체계적으로 도입하며 spec·구현·테스트·프롬프트를 일관되게 갱신한 점에서 유지보수성 측면의 완성도가 높다. 다만 도구 이름이 상수 없이 여러 파일에 흩어진 매직 문자열로 남아 있고, 스냅샷 직렬화 로직이 `system-prompt.ts`와 `buildCurrentWorkflowResult` 두 곳에 미묘하게 다른 형태로 중복되어 있다. 이 두 지점이 이후 스냅샷 스키마 변경이나 도구 이름 리팩토링 시 조용한 버그의 진입점이 될 수 있으며, 현재 수준에서 큰 위험은 아니지만 코드베이스가 확장될수록 부담이 누적될 수 있다.

### 위험도

**LOW**