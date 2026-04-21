### 발견사항

- **[INFO]** `CYCLE_DETECTED` 에러 반환 범위 축소 (의도된 변경)
  - 위치: `shadow-workflow.ts:252-260`, `spec/.../4-ai-assistant.md` §4.4
  - 상세: 이전에는 child → container 방향의 에지도 `CYCLE_DETECTED`를 반환했으나, 변경 후 source 노드의 `containerId` 조상 체인에 속하는 target은 `ok: true`를 반환한다. `ShadowResult` 인터페이스와 `ShadowErrorCode` 타입 자체는 변경되지 않았지만, 이 에러의 반환 조건이 좁아지는 의미론적 계약 변경이다. 클라이언트가 `CYCLE_DETECTED`를 특정 UI 처리에 이용하고 있다면, container back-edge에 대해서는 더 이상 이 에러를 받지 못한다.
  - 제안: 허용 여부이므로 breaking change는 아니나, spec §4.4 변경 내용이 충분히 전달되어야 한다. 현재 spec 업데이트가 이를 잘 반영하고 있다.

- **[INFO]** `wouldCreateCycle` 내부 DFS도 back-edge를 필터링
  - 위치: `shadow-workflow.ts:331-337`
  - 상세: 신규 에지 추가 시뿐 아니라 기존 에지 순회 중에도 `isContainerAncestor` 검사를 통해 back-edge를 건너뛴다. 이 처리가 없으면 이미 존재하는 `child → container` 에지가 도달성 계산에 포함되어 정상 에지도 cycle로 오탐할 수 있다. 로직은 올바르고, 세 번째 테스트 케이스(`unrelated non-ancestor container`)가 이 경계를 명시적으로 검증하고 있다.
  - 제안: 현 구현 유지. 테스트 커버리지 적절.

- **[INFO]** spec의 `add_edge` 인자 네이밍 불일치 (기존 이슈, 이번 변경 비기인)
  - 위치: `spec/.../4-ai-assistant.md` §4.3 테이블 (`sourceId`/`targetId`)
  - 상세: 스펙은 camelCase(`sourceId`, `targetId`)로 표기하나, 구현체는 snake_case(`source_id`, `target_id`)를 primary로 하고 camelCase를 fallback으로 지원한다. 이번 변경이 도입한 이슈가 아니지만, API 소비자(LLM이 인자를 생성하는 경우)에게 혼동을 줄 수 있다.
  - 제안: spec §4.3 테이블을 `source_id`/`target_id`로 통일하거나, 구현의 fallback 지원을 spec에 명시.

---

### 요약

이번 변경은 `ShadowWorkflow`의 cycle 검사 정책을 완화하는 **의도된 행위 확장**이다. `ShadowResult` 인터페이스, `ShadowErrorCode` 타입, HTTP 엔드포인트 구조는 전혀 변경되지 않았고, 기존에 `CYCLE_DETECTED`를 반환하던 일부 케이스(child → 조상 container 에지)가 `ok: true`를 반환하게 바뀐 것이 유일한 계약 변화다. 이는 제한 완화이므로 기존 클라이언트가 오류 경로에 의존하지 않는 한 하위 호환성이 유지된다. spec §4.4도 동일하게 갱신되어 구현과 문서가 정합하며, 경계 케이스 4종의 테스트가 명확히 검증하고 있어 신뢰도가 높다.

### 위험도
**LOW**