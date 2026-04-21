### 발견사항

---

**[WARNING]** `get_current_workflow` 디스패치가 `handleExploreCall` 밖에서 처리됨
- **위치**: `workflow-assistant-stream.service.ts`, `streamMessage` 내 `if (kind === 'explore')` 블록
- **상세**: `explore` kind 도구는 `handleExploreCall`로 위임하는 것이 현재 설계 의도인데, `get_current_workflow`만 그 앞에서 별도 `if` 분기로 처리된다. `handleExploreCall`은 이제 explore 도구의 "완전한 dispatcher"가 아니게 되어 메서드 경계가 흐려졌다. 세션 스코프 상태(`ShadowWorkflow`)가 필요한 explore 도구가 추가될수록 이 `if/else if` 인라인 패턴이 누적된다.
- **제안**: `handleExploreCall` 시그니처에 `shadow: ShadowWorkflow`를 추가하고 내부 `switch`에 `get_current_workflow` case를 흡수하거나, `Map<string, Handler>` 전략 맵으로 전환하여 디스패치를 단일 지점으로 통합한다.

---

**[WARNING]** 시스템 프롬프트 스냅샷과 `get_current_workflow` 응답의 구조 불일치
- **위치**: `system-prompt.ts` (current 객체) vs `workflow-assistant-stream.service.ts` (`buildCurrentWorkflowResult`)
- **상세**: LLM은 두 소스에서 동일한 워크플로우 상태를 읽게 설계되어 있으나, 필드 형태가 다르다.
  - 시스템 프롬프트: `nodes`에 `category` 없음, `edges`에 `id` 없음
  - `get_current_workflow`: `nodes`에 `category` 있음, `edges`에 `id` 있음
  
  "authoritative snapshot" 지침이 시스템 프롬프트를 가리키지만, 도구 응답과 스키마가 다르면 LLM이 두 소스를 교차 참조할 때 혼선이 생길 수 있다.
- **제안**: 두 표현의 shape를 동일하게 맞추거나(공통 타입 정의), 의도적 차이라면 시스템 프롬프트 주석에 명시한다.

---

**[INFO]** 노드/엣지 매핑 로직 중복
- **위치**: `system-prompt.ts:34–51` (current 객체 생성), `workflow-assistant-stream.service.ts:443–466` (`buildCurrentWorkflowResult`)
- **상세**: `ShadowSnapshot → { nodes[], edges[] }` 변환 로직이 두 곳에 분산되어 있다. 현재는 필드 차이(category, edge id)가 있어 단순 추출은 불가하나, 공통 mapper 함수로 분리하면 향후 필드 추가 시 한 곳만 수정하면 된다.
- **제안**: `toWorkflowShape(snapshot, options?: { includeCategory?: boolean })` 형태의 공유 유틸로 추출하고 두 곳에서 호출한다.

---

**[INFO]** `handleExploreCall`의 책임 경계 모호
- **위치**: `workflow-assistant-stream.service.ts:407–437`
- **상세**: 메서드 이름과 의도는 "explore 도구 처리"지만, `get_current_workflow`를 처리하지 않는다. 추후 코드를 읽는 사람이 explore 도구 추가 시 이 메서드를 수정해야 하는지 호출부를 수정해야 하는지 직관적으로 알기 어렵다.
- **제안**: 메서드 이름을 `handleExternalExploreCall`로 바꾸거나, 위 WARNING의 통합 방안으로 해결한다.

---

### 요약

이번 변경은 "시스템 프롬프트 스냅샷(읽기 전용 질의) + `get_current_workflow` 도구(편집 후 재확인)" 2-tier 구조를 도입하는 실용적인 설계다. 핵심 로직은 올바르게 동작하며 테스트 커버리지도 충분하다. 다만 `get_current_workflow`가 `handleExploreCall`을 우회하는 인라인 분기 패턴이 현재 explore 디스패치의 단일 책임을 분산시키고 있으며, 시스템 프롬프트 스냅샷과 도구 응답 간의 스키마 불일치는 LLM이 두 표현을 교차 참조할 때 미묘한 혼선의 원인이 될 수 있다. 기능 정확성에 영향을 주는 결함은 없으나, 같은 패턴으로 session-scoped explore 도구가 추가되면 유지보수 부담이 선형으로 증가할 수 있다.

### 위험도

**LOW**