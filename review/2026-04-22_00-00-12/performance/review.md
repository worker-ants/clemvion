### 발견사항

- **[INFO]** 시스템 프롬프트 토큰 증가
  - 위치: `system-prompt.ts` — authoritative snapshot 지침 단락 + 3번째 few-shot 예시
  - 상세: 매 턴마다 주입되는 시스템 프롬프트에 정적 텍스트가 약 120–150 토큰 추가된다. 노드/엣지 수에 비례하는 `JSON.stringify(current)` 가 이미 지배적 크기이므로 절대적 영향은 작지만, 세션이 많을 경우 누적 토큰 비용이 선형으로 증가한다.
  - 제안: 현 규모에서는 수용 가능하다. 향후 고트래픽 환경에서는 "authoritative snapshot" 지침을 더 짧게 요약하는 것을 검토할 수 있다.

- **[INFO]** `redactConfig` 이중 호출 가능성
  - 위치: `workflow-assistant-stream.service.ts` — `buildCurrentWorkflowResult` 내 `redactConfig(n.config ?? {})`
  - 상세: 시스템 프롬프트 조립(`buildSystemPrompt`) 시 이미 노드별로 `redactConfig`를 호출하며 결과를 직렬화한다. LLM이 `get_current_workflow`를 호출하면 동일 redact 변환이 한 번 더 수행된다. 두 호출 사이에 shadow에 편집이 발생했을 경우를 위한 의도적 설계이므로 논리적으로는 올바르나, 편집이 없을 때 호출되면 동일 데이터에 대한 불필요한 재계산이다.
  - 제안: 시스템 프롬프트 지침이 "편집 후 재확인 시에만 호출"을 명시하고 있고 few-shot 예시도 이를 강화하므로, LLM이 올바르게 따른다면 실질적 중복 호출은 드물 것이다. 현재 수준에서 별도 캐싱은 과잉 설계다.

- **[INFO]** `shadow.snapshot()` 복수 호출
  - 위치: `workflow-assistant-stream.service.ts:buildCurrentWorkflowResult`
  - 상세: 턴 시작 시 `buildSystemPrompt(this.nodeRegistry.listDefinitions(), shadow.snapshot())`로 스냅샷을 소비하고, 이후 `get_current_workflow` 호출 시 `shadow.snapshot()`을 다시 호출한다. 편집 전·후 상태가 다르므로 이는 의도적 설계다. 다만 `snapshot()`이 내부적으로 deep-copy를 수행한다면, 노드 수가 수백 개일 때 GC 부담이 될 수 있다.
  - 제안: `ShadowWorkflow.snapshot()`이 immutable reference를 반환하도록 설계되어 있다면 문제없다. 만약 매번 새 배열을 생성한다면 `get_current_workflow` 결과를 동일 turn 내에 캐싱(예: `let cachedCurrentWorkflow`)하는 것을 고려할 수 있다.

- **[INFO]** `get_current_workflow` 핸들러는 성능상 긍정적 변화
  - 위치: `workflow-assistant-stream.service.ts:214–225`
  - 상세: 기존 explore 도구들은 `await this.handleExploreCall(...)` 을 통해 DB/외부 API를 호출한다. 신규 `get_current_workflow`는 인메모리 shadow만 읽으므로 I/O 없이 동기적으로 완료된다. 도구 호출 latency가 제거되는 긍정적 효과다.

---

### 요약

이번 변경의 핵심인 `get_current_workflow` 도구는 DB 조회 대신 인메모리 shadow snapshot을 반환하므로, 기존 explore 도구 대비 레이턴시가 크게 줄어드는 긍정적 설계다. 시스템 프롬프트에 추가된 "authoritative snapshot" 지침과 few-shot 예시는 LLM이 불필요한 도구 호출을 줄이도록 유도하여 전체 턴당 LLM 왕복 횟수를 감소시킨다. 성능 리스크는 매 턴 고정 토큰 증가(~150 토큰)와 `redactConfig`/`snapshot()` 재연산 가능성 정도이며, 모두 일반적 워크플로우 크기에서는 무시할 수준이다.

### 위험도

**LOW**