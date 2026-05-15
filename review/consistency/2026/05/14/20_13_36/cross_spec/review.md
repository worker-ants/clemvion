`spec/conventions/` 문서들을 관련 spec 본문과 교차 분석합니다.

### 발견사항

- **[WARNING]** `excludeFromConversationThread` 범위 정의 불일치
  - target 위치: `conversation-thread.md §2.4` ("각 노드에 공통 boolean config: `excludeFromConversationThread`")
  - 충돌 대상: 동일 문서 `§5` 표 ("spec/4-nodes/3-ai/1-ai-agent.md §1 의 **5 신규 필드**"로 나열)
  - 상세: §2.4 는 이 필드를 "모든 노드 공통" config 로 정의하면서 "UI 그룹은 `Advanced > Conversation`"이라고 기술한다. 그런데 §5 는 이 필드를 ai-agent.md §1 에 추가해야 할 "5 신규 필드" 목록 안에 포함시킨다. "공통"이면 node-common spec(`spec/3-workflow-editor/1-node-common.md` 또는 `spec/4-nodes/_product-overview.md`)에 정의돼야 하고, "ai-agent.md §1 의 신규 필드"라면 v1 적용 범위가 ai_agent 한정임을 §2.4 에서도 명시해야 한다.
  - 제안: §2.4 에 "v1 에서는 ai_agent 만 turn 을 push하므로 실질 적용 노드는 ai_agent 뿐이며, v2 에서 다른 노드로 확대 시 node-common spec 으로 이동 예정"이라는 단서를 추가하거나, §5 표에서 `excludeFromConversationThread` 를 별도 행("공통 필드 — §2.4 참조")으로 분리한다.

- **[INFO]** §5 "5 신규 필드" 카운트 — `excludeFromConversationThread` 포함 여부 따라 4개 vs 5개
  - target 위치: `conversation-thread.md §5` 헤더 및 표
  - 충돌 대상: 동일 문서 §2.4
  - 상세: 위 WARNING 이 해소되기 전까지 "5 신규 필드" 수식이 `ai-agent.md §1` 을 읽는 구현자에게 혼선을 준다. `contextScope / contextScopeN / contextInjectionMode / includeToolTurns` 4개는 명백히 AI Agent 전용이고, `excludeFromConversationThread` 는 공통 또는 AI Agent 전용 여부가 미결이다.
  - 제안: 수가 확정될 때까지 "5 신규 필드"를 "다음 신규 필드" 등 카운트 없는 표현으로 변경하거나, 괄호 주석으로 포함 근거를 명시한다.

- **[INFO]** `system` source → `role: 'system'` Anthropic API 비호환 — 수동 push 도입 시 런타임 위험
  - target 위치: `conversation-thread.md §5.1` messages 모드 매핑 표 마지막 행
  - 충돌 대상: spec/5-system/7-llm-client.md (본 검토 범위 외, 참조만)
  - 상세: 문서 내에 "v1 자동 push 없으므로 현재 실질 문제 없음"이라고 명기돼 있어 cross-spec 모순은 아니지만, 향후 `system` source 의 수동 push 가 도입될 때 Anthropic provider 분기를 빠뜨릴 위험이 있다. 현재 노트는 "수동 push 도입 시 provider 분기 검증 필수"라고만 돼 있어 강제력이 없다.
  - 제안: 해당 행에 `⚠ Anthropic 미지원 — 수동 push 구현 전 LLM Client 협의 필수` 같은 명시적 블로커 레이블을 추가한다.

- **[INFO]** Presentation 노드 push 트리거 — legacy status 값 혼용 (migration gap)
  - target 위치: `conversation-thread.md §2.1` 주석
  - 충돌 대상: `spec/conventions/node-output.md` Principle 4.1 (통일된 `status: 'resumed'` 목표)
  - 상세: 현재 실행 엔진이 `'submitted' / 'button_click' / 'button_continue'` legacy status 를 사용한다는 사실을 convention 문서가 명기하고 있다. 이는 기존 node-output Principle 4.1 의 `resumed` 통일 목표와 현재 구현 간의 알려진 migration gap 이며, 문서 내에 적절히 노트로 처리돼 있다. 별도 충돌은 없으나 migration phase(Presentation Principle 1.1 재작성)의 plan 문서에 이 gap 을 트래킹하는 항목이 없다면 누락 위험이 있다.
  - 제안: `plan/in-progress/` 에 presentation node migration 항목이 있는지 확인하고, 없으면 추가한다.

---

### 요약

`spec/conventions/` 5개 문서는 참조 spec 본문(`node-output.md`, `1-data-model.md`, `0-overview.md` 등)과 전반적으로 정합하며 CRITICAL 수준의 모순은 발견되지 않는다. 주요 개선 지점은 `conversation-thread.md` 내부의 `excludeFromConversationThread` 범위 정의 불일치(§2.4 "공통" vs §5 "ai-agent.md 신규 필드")로, 구현자가 이 필드를 node-common 스키마에 추가해야 할지 ai-agent 스키마에만 추가해야 할지 혼란을 줄 수 있다. 나머지 INFO 항목들은 이미 문서 내 주석으로 처리된 알려진 migration gap 이다.

### 위험도

**LOW**