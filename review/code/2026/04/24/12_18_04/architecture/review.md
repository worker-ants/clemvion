## 아키텍처 코드 리뷰

### 발견사항

---

**[WARNING] `getExecutionDetails` 의 sub-workflow 타임라인 로딩에 N+1 쿼리 존재**
- 위치: `explore-tools.service.ts` — `getExecutionDetails` 내 `subExecutions` 조립 블록
- 상세: `Promise.all(directChildren.map(async (child) => ({ timeline: await this.loadTimeline(child.id) })))` 가 직계 자식 실행 건수만큼 개별 `find` 쿼리를 발행한다. `loadNodeStats` 가 `In(executionIds)` 로 N+1을 회피한 것과 달리, `loadTimeline` 은 각 자식마다 별도 쿼리다. 루프 노드가 sub-workflow를 수십 회 호출하는 경우 수십 번의 DB 왕복이 발생한다.
- 제안: `loadNodeStats` 의 패턴과 동일하게 — `childIds` 로 한 번에 `nodeExecution` 을 가져온 뒤 `executionId` 로 그룹핑해 각 자식의 timeline 을 조립하는 `loadTimelinesForExecutions(ids: string[])` 유틸로 대체.

---

**[WARNING] `ExploreToolsService` 생성자 파라미터 9개 — 서비스가 Fat Service로 성장 중**
- 위치: `explore-tools.service.ts` — constructor (Repository × 7, NodeComponentRegistry × 1, 가까운 미래에 추가 가능성)
- 상세: 탐색 도구가 추가될수록 한 서비스에 의존성이 계속 쌓인다. 이미 테스트 헬퍼(`makeService`)가 7개 mock repo를 직접 배선해야 하며, 이는 유지보수 비용이 높다. 단일 책임 원칙 관점에서 워크플로·노드 탐색과 실행 이력 탐색은 서로 다른 도메인이다.
- 제안: `ExecutionExploreService` (executionRepo, nodeExecutionRepo만 보유)를 별도 클래스로 분리하고 `ExploreToolsService` 가 이를 주입받는 구조로 전환. 현 단계에서 즉시 강제할 필요는 없으나 도구가 2~3개 더 추가될 경우 리팩토링 적기.

---

**[WARNING] 도구 추가 시 Shotgun Surgery 패턴 — 4개 파일 동시 수정 불가피**
- 위치: `tool-definitions.ts` (TOOL_KIND_BY_NAME + buildAssistantToolsInternal), `explore-tools.service.ts`, `workflow-assistant-stream.service.ts` (switch case), `workflow-assistant.module.ts`
- 상세: 탐색 도구 한 종을 추가할 때마다 서로 다른 레이어의 4개 파일을 반드시 건드려야 한다. OCP(Open/Closed Principle) 위반이며 도구 수가 계속 늘어날 경우 switch 블록이 유지보수 병목이 된다.
- 제안: 탐색 도구를 인터페이스(`IExploreTool { name, kind, definition, handle }`)로 추상화하고 모듈 로드 시 레지스트리에 자동 등록하는 패턴을 도입하면 도구 추가가 단일 파일 수정으로 격리된다. 현 규모(8종)에서는 즉각 리팩토링 비용이 높으므로 INFO 수준이지만, 도구가 계속 증가하는 로드맵이 있다면 경계를 넘은 시점이다.

---

**[INFO] i18n 키 추가됐으나 `tool-call-badge.tsx` 에서 미사용 — 일관성 갭**
- 위치: `ko.ts` / `en.ts` (3개 키 추가) vs `tool-call-badge.tsx` (`summarize` 함수 내 하드코딩 영문)
- 상세: `exploreExecutionsList`, `exploreExecutionDetails`, `executionNotInScope` 키가 사전에 추가됐지만, 배지 컴포넌트의 `summarize` 함수는 여전히 하드코딩된 영문 문자열(`"executions (${status})"`, `"execution detail: ${count} nodes"`)을 반환한다. 기존 배지 라벨(예: `"+ node"`, `"→ edge"`)도 동일 패턴이므로 이는 기존 관행과 일치하지만, i18n 키를 추가한 의도가 어디에서 사용될지 불명확하다.
- 제안: 배지에서 i18n 사용이 의도라면 `useTranslation` 훅을 `summarize` 로 전달하거나 별도 번역 맵을 만들어 적용. 배지 외 다른 곳(토스트·알림 등)에서 쓸 예정이라면 주석으로 의도를 명시.

---

**[INFO] `getWorkflowExecutions` / `getExecutionDetails` 반환 타입 `Promise<unknown>` — 컴파일 타임 타입 안전성 부재**
- 위치: `explore-tools.service.ts` — 두 메서드 시그니처
- 상세: LLM tool result 특성상 구조가 느슨하다는 점은 이해되나, `{ ok: true; items: ExecSummary[] } | { ok: false; error: ErrorCode }` 같은 discriminated union 을 서비스 레이어에서라도 정의하면 `workflow-assistant-stream.service.ts` 쪽에서의 타입 캐스팅(`as Record`) 없이 정확성을 보장할 수 있다.
- 제안: 내부 전용 응답 타입(`ExploreResult<T>`)을 정의해 컴파일 타임에 오류 코드와 성공 envelope를 구분.

---

**[INFO] `workflow-assistant.module.ts` 가 `Execution`/`NodeExecution` 엔티티에 직접 접근 — 도메인 서비스 계층 우회**
- 위치: `workflow-assistant.module.ts` — TypeOrmModule.forFeature 추가
- 상세: `ExecutionModule`/`NodeExecutionModule`을 import 하는 대신 엔티티를 직접 접근한다. 서비스 파일 내 아키텍처 주석이 "RBAC 등 비즈니스 규칙이 추가되면 그 시점에 서비스 DI로 교체"라고 명시하므로 의도된 기술 부채다. 단, 이 주석이 없는 개발자가 같은 패턴을 무비판적으로 반복할 위험이 있다.
- 제안: 현 상태 유지 가능하나, RBAC 로드맵이 구체화될 때를 위한 TODO 주석을 모듈 파일에도 추가.

---

### 요약

이번 변경은 기존 아키텍처 패턴(Repository 직접 주입, explore/plan/edit 도구 분류, `{ ok, error }` 결과 envelope)을 일관되게 따르며, 스코프 격리·민감 필드 마스킹·N+1 회피(`loadNodeStats`)·running 상태 부분 타임라인 처리 등 핵심 보안·성능 요구사항을 잘 구현했다. 다만 `getExecutionDetails` 의 자식 타임라인 로딩에서 `loadNodeStats` 가 해결한 것과 동일한 N+1 패턴이 재현됐고, `ExploreToolsService` 가 단일 서비스로 계속 성장하는 구조적 경향이 가시화되고 있다. 이 두 가지를 개선하면 현 아키텍처의 약점이 크게 줄어든다.

### 위험도

**LOW** — 기능 정확성과 보안 경계는 견고하며, N+1 이슈는 직계 자식 실행이 다수인 경우에만 체감되는 성능 문제로 즉각적인 블로커는 아니다.