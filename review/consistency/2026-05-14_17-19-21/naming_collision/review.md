필요한 정보를 충분히 확인했습니다. 보고서를 작성합니다.

---

## 발견사항

### [WARNING] `'default'` 값 — ConversationThread.id vs. 포트 예약어 충돌

- **Target 신규 식별자**: `ConversationThread.id` v1 고정값 `"default"` + 상수명 `DEFAULT_THREAD_ID = 'default'`
- **기존 사용처**: `spec/conventions/node-output.md` Principle 6 — 시스템 포트 예약어 목록: `out, error, **default**, done, user_ended, max_turns, completed, fallback, continue`
- **상세**: 동일한 문자열 `"default"` 가 포트 예약어(포트 ID 네이밍 금지)와 Thread ID 기본값 양쪽에 존재한다. spec에서 "port 예약어 `'default'` 와 무관 — namespace 분리"로 명시했지만, 구현 시 포트 라우터와 thread resolver가 같은 문자열을 다른 enum 도메인으로 처리해야 하므로 코드 리뷰어가 혼동할 수 있다. 특히 `DEFAULT_THREAD_ID` 상수를 쓰지 않고 리터럴 `'default'`를 직접 비교하는 코드가 포트 관련 코드와 인접 배치될 경우 silent bug 위험.
- **제안**: spec 권고대로 `DEFAULT_THREAD_ID = 'default'` 상수를 반드시 추출하고, 포트 예약어 검증 로직(frontend schema validator)이 Thread ID 비교 경로와 섞이지 않도록 모듈 분리 유지. 대안으로 Thread ID를 `"primary"` 등 예약어 비충돌 값으로 변경하면 근본 해소 가능하나 v2 multi-thread 대비 `'default'` 의미가 직관적이므로 현 설계 유지는 수용 가능.

---

### [WARNING] `'system'` 값 — ConversationTurnSource vs. AssistantMessage.role

- **Target 신규 식별자**: `ConversationTurnSource` 열거값 `'system'` — "워크플로우 레벨 수동 push 전용"
- **기존 사용처**: `spec/1-data-model.md §2.21 AssistantMessage.role` Enum: `user / assistant / tool / **system**` — "LLM API 시스템 프롬프트 메시지"
- **상세**: 동일한 값 `'system'`이 두 독립적 열거형에서 다른 의미로 사용된다. conversation-thread.md §1.1에서 "**주의**: AssistantMessage `role: 'system'` 과 무관 — 워크플로우 레벨의 수동 push 전용"으로 명시했지만, 백엔드 구현에서 `ConversationTurn` 을 LLM messages 배열로 변환할 때(`contextInjectionMode = 'messages'`) `source='system'`인 turn을 `role: 'system'` 메시지로 매핑하는 §5.1 표가 이 혼동을 내재적으로 **의도한 동작**으로 만들고 있다. 즉, 두 domain의 `'system'`은 사실상 연결되어 있다 — `system` source turn → `system` role message 변환. 이 연결이 명시적이지 않으면 구현자가 Anthropic API의 messages 배열에서 `role: 'system'` 미지원(conversation-thread.md §5.1 각주)을 놓칠 수 있다.
- **제안**: conversation-thread.md §5.1 messages 모드 매핑 표에서 `source='system'` → `role: 'system'` 행에 "Anthropic API 미지원 — provider 분기 필수" 주의를 인라인으로 추가. 현재 각주가 있으나 표 외부에 위치해 놓치기 쉽다. 명명 자체는 수용 가능.

---

### [WARNING] `ai_tool` source — 향후 AI Tool 노드 타입 신설 시 충돌 가능성

- **Target 신규 식별자**: `ConversationTurnSource.ai_tool` — "KB / MCP / condition tool 결과 (opt-in)"
- **기존 사용처**: `plan/in-progress/ai-agent-tool-connection-rewrite.md` §1 결정 옵션 (c) — "별도 `AI Tool` 노드 타입 신설" 검토 중
- **상세**: 현재는 `ai_tool` 노드 타입이 존재하지 않으므로 충돌이 없다. 그러나 `ai-agent-tool-connection-rewrite.md` plan이 완료되어 결정 (c)가 채택되면 Node.type에 `ai_tool`이 추가될 수 있다. `ConversationTurnSource.ai_tool`은 "AI Agent가 호출한 도구의 결과 turn"이고, 노드 타입 `ai_tool`은 "도구 역할을 하는 노드"이다 — 동일 식별자가 서로 다른 도메인에서 사용되면 표현식 `$thread.turns.filter(t => t.nodeType === 'ai_tool')` 같은 쿼리에서 의미 혼동 직결.
- **제안**: `ai-agent-tool-connection-rewrite.md` plan 활성화 시점에 `ConversationTurnSource.ai_tool` 명칭을 재검토 플래그. 대안 후보: `tool_result`, `agent_tool`, `tool_call_result`. 현재는 결정 (c)가 확정되지 않아 즉각 조치 불필요이나, plan 문서에 이 risk를 명기할 것.

---

### [INFO] `contextScope` vs. `Integration.scope` 유사 명명

- **Target 신규 식별자**: AI Agent config 필드 `contextScope: 'none' | 'thread' | 'lastN'`
- **기존 사용처**: `spec/1-data-model.md §2.10 Integration.scope` Enum: `personal / organization`
- **상세**: 두 필드 모두 "scope"를 사용하지만 전체 필드명(`contextScope` vs. `Integration.scope`)과 값 도메인이 완전히 달라 혼동 가능성 낮음.
- **제안**: 충돌 없음. 현재 명명 유지.

---

### [INFO] `messages` 모드값 vs. `output.messages` 필드명 중복

- **Target 신규 식별자**: `contextInjectionMode: 'messages'` 열거값
- **기존 사용처**: AI Agent multi-turn waiting 출력의 `output.messages` 필드 (node-output.md Principle 4.3)
- **상세**: 동일한 단어 `messages`가 주입 모드 값과 출력 필드명 양쪽에 등장하지만, 둘 다 "LLM messages 배열"이라는 일관된 도메인 의미를 가진다. 오히려 명명 일관성 측면에서 바람직.
- **제안**: 충돌 없음. 현재 명명 유지.

---

## 요약

`spec/conventions/conversation-thread.md` 의 신규 식별자들은 전체적으로 기존 사용처와 의미 충돌을 일으키는 CRITICAL 케이스는 없다. 두 WARNING은 spec 내에서 이미 명시적으로 주의를 기울이고 있으나, 구현 단계에서 놓치기 쉬운 지점이다: (1) `'default'` Thread ID와 포트 예약어의 namespace 분리를 상수 추출로 강제 보장하는 것, (2) `'system'` source turn → `role: 'system'` 메시지 변환 시 Anthropic API 비지원 분기 처리를 구현 시 누락하지 않는 것. `ai_tool` source 명명은 향후 AI Tool 노드 재설계 plan 완료 시 재검토 필요한 잠재 risk이다.

## 위험도

**LOW** — Critical 위배 없음. WARNING 2건은 spec에 기술되어 있으나 구현 착수 전 개발자 체크리스트 확인 권장.