### 발견사항

- **[INFO]** `integrationServiceType` 필드가 제네릭 인터페이스를 오염시킴
  - 위치: `detect-pending-user-config.ts:47–66`, `frontend/src/lib/api/assistant.ts:79–84`
  - 상세: `PendingUserConfigField`는 4개 widget 공통 인터페이스인데 `integrationServiceType`은 `integration-selector` 전용 힌트다. 현재는 선택적(optional) 필드로 처리했지만, 이 패턴이 반복되면 (`llmConfigProviderHint?`, `kbTypeHint?` 등) 인터페이스가 widget별 필드의 union bag이 된다.
  - 제안: 단기적으로 허용 가능하나, 장기적으로는 discriminated union(`type: 'integration-selector'; integrationServiceType: string` 등)으로 분기하거나, `hint?: Record<string, unknown>` 같은 open slot으로 설계하면 인터페이스 오염을 방지할 수 있음.

---

- **[WARNING]** `evaluateReviewGuard`의 O(n) 동시 DB 조회
  - 위치: `workflow-assistant-stream.service.ts:1301–1320`
  - 상세: `Promise.all(snapshot.nodes.map(async (n) => collectPendingUserConfigWithCandidates(...)))` 는 매 `finish` 호출마다 캔버스의 모든 노드에 대해 병렬 DB 조회를 실행한다. `collectPendingUserConfig`에서 pending이 없으면 short-circuit(`pending.length === 0 → return`)되어 불필요한 조회는 회피되지만, integration/LLM 노드가 여러 개인 워크플로에서는 finish마다 N개 쿼리가 발생한다. 현재 `finish`는 review round마다 반복 호출될 수 있으므로 누적 비용이 있다.
  - 제안: 이미 tool_result에 candidates를 채워 내려보낸 결과를 turn 범위에서 캐시하거나(`Map<nodeId, PendingUserConfigField[]>`를 turn state에 보관), `PENDING_USER_CONFIG_UNMENTIONED` 체크리스트 항목이 실제로 발동 가능한 경우에만 candidates를 fetch하는 lazy evaluation로 개선.

---

- **[WARNING]** `WorkflowAssistantStreamService`의 생성자 의존성 증가
  - 위치: `workflow-assistant-stream.service.ts:255–260`
  - 상세: 생성자 파라미터가 5개(`llmService`, `sessionService`, `exploreTools`, `nodeRegistry`, `candidateLookup`)로 늘었다. 기존에도 다목적 오케스트레이터였는데, candidate 조회까지 직접 담당하면서 책임 범위가 더 넓어졌다. 스트리밍 루프 내부에서 tool result 후처리(candidates 채움)까지 담당하는 구조다.
  - 제안: tool result 후처리(enrichment)를 별도의 `ToolResultEnricher`나 pipeline step으로 분리하면 `StreamService`의 SRP를 회복하고 단위 테스트 격리도 개선됨. 단, 현재 변경 범위에서 리팩토링까지 강제할 정도의 규모는 아님.

---

- **[INFO]** `ExploreToolsService.listWorkflows`의 `unknown` 반환 타입 노출
  - 위치: `candidate-lookup.service.ts:169–188` (`extractWorkflowItems` 함수)
  - 상세: `ExploreToolsService.listWorkflows`가 `unknown`을 반환하므로 `CandidateLookupService`가 런타임 type narrowing 헬퍼(`extractWorkflowItems`)를 정의해야 한다. 이는 `ExploreToolsService`의 타입 계약 약점이 소비자 레이어로 새어나온 것이다.
  - 제안: `ExploreToolsService.listWorkflows`에 구체적 반환 타입 정의(`{ ok: boolean; items: WorkflowSummary[] }`)를 추가하면 `extractWorkflowItems` 헬퍼가 불필요해지고, 타입 안전성이 서비스 경계에서 보장됨.

---

- **[INFO]** 타입 정의 프론트엔드/백엔드 이중화
  - 위치: `detect-pending-user-config.ts` vs `frontend/src/lib/api/assistant.ts`
  - 상세: `UserActionWidget`, `CandidateEntry`, `PendingUserConfigField` 세 타입이 양쪽에 동일하게 정의된다. 현재 monorepo 구조에서 공유 타입 패키지가 없으므로 불가피하나, 타입이 drift될 위험이 있다(예: 백엔드 `candidates` 필드명 변경 시 프론트가 자동으로 알 수 없음).
  - 제안: 단기적으로 허용. 중기적으로 `packages/shared-types` 혹은 `frontend/src/lib/api/assistant.ts`를 single source로 삼아 백엔드가 해당 타입을 참조하거나, OpenAPI 스키마 자동 생성을 도입하면 drift 방지 가능.

---

- **[INFO]** `SETTINGS_HREF` 매핑이 `assistant-message.tsx`에 위치
  - 위치: `assistant-message.tsx:22–27`
  - 상세: widget type → settings 경로 매핑이 picker 컴포넌트가 아닌 상위 컴포넌트에 있어, 새 widget 추가 시 `assistant-message.tsx`도 수정해야 한다. `CandidatePicker`가 `settingsHref`를 props로 받는 구조이므로 설계상의 trade-off지만, 라우팅 맥락을 가진 상위에서 관리하는 것이 현재 구조에선 자연스럽다.
  - 제안: 현 구조 유지 가능. 다만 향후 widget 종류가 6개 이상이 되면 `WIDGET_SETTINGS_MAP` 같은 별도 config 파일로 분리해 `assistant-message.tsx`의 변경 이유를 줄이는 것이 바람직.

---

### 요약

ED-AI-39의 전체 아키텍처는 올바른 방향으로 설계되었다. detect(스키마 분석) → enrich(DB 조회) → deliver(SSE 응답)로 이어지는 파이프라인 분리, `fillCandidates`의 불변성 보장, DB 오류 시 warn+빈배열 degrade, 프론트의 `currentValue` 기반 rehydrate 패턴 모두 적절하다. 주요 리스크는 두 가지다: `evaluateReviewGuard`에서의 O(n) 동시 DB 조회가 대형 워크플로에서 성능 병목이 될 수 있고, `integrationServiceType`처럼 widget별 힌트가 공통 인터페이스에 누적되는 경향이 향후 확장 시 인터페이스 오염으로 이어질 수 있다. 두 문제 모두 현재 기능 범위에서 즉각적인 결함은 아니나 중기적 관리가 필요하다.

### 위험도

**LOW**