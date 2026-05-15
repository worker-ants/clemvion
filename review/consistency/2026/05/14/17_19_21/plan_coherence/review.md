---

## 발견사항

### **[WARNING] Plan Phase 4 — `text_classifier` / `information_extractor` turn push 태스크 누락**

- **target 위치**: `spec/conventions/conversation-thread.md` §2.3 — "Turn push (누적)" 행
- **관련 plan**: `plan/in-progress/conversation-thread.md` Phase 4

**상세**:

spec §2.3은 v1 push 범위를 다음과 같이 명시한다:

> **Turn push (누적)** | 모든 AI 노드 (`ai_agent` / `text_classifier` / `information_extractor`) — multi-turn 노드는 user/assistant turn 을, single-turn 노드는 final assistant turn 을 자동 push

`spec/4-nodes/3-ai/0-common.md` §10 역시 "모든 AI 노드의 turn 누적 (자동 push) 은 v1 부터 적용된다"고 명시한다.

그러나 `plan/in-progress/conversation-thread.md` Phase 4의 체크리스트는 `ai-agent.handler.ts` hook 만 열거하며, `text_classifier.handler.ts` 와 `information_extractor.handler.ts` 의 turn push hook 태스크가 **전혀 없다**. Phase 2~8 어디에도 이 두 핸들러에 대한 구현 항목이 없다.

개발자가 plan을 따라 구현하면 spec §2.3이 요구하는 v1 push 계약을 절반만 이행하게 된다.

**제안**: Plan Phase 4 (또는 별도 Phase 4-b)에 다음 태스크를 추가한다:
```
- [ ] `text-classifier.handler.ts` final assistant turn push (single-turn, source='ai_assistant')
- [ ] `information_extractor.handler.ts` user turn / final assistant turn push (multi-turn 포함)
- [ ] 단위 테스트: text_classifier / information_extractor turn append 검증
```

---

### **[INFO] `ai-agent-tool-connection-rewrite` — `ai_tool` source 확장 시점 미정**

- **target 위치**: `spec/conventions/conversation-thread.md` §1.1 ConversationTurnSource 표
- **관련 plan**: `plan/in-progress/ai-agent-tool-connection-rewrite.md` §의존성·리스크

현재 spec의 `ai_tool` source 정의는 "KB / MCP / condition tool 결과"로 한정된다. ai-agent-tool-connection-rewrite 계획이 일반 `tool_*` 도구를 추가할 때 이 source를 재사용할지, 별도 source를 신설할지는 v2로 미루어져 있다. 이는 plan 의존성 메모에 정확히 기록되어 있으며 현 단계에서 충돌은 없다.

---

### **[INFO] `background-monitoring-api` — spec 개정 선행 조건 해소됨**

- **관련 plan**: `plan/in-progress/background-monitoring-api.md` §4 spec 갱신 순서 의존성

background-monitoring-api plan이 요구하는 "conversation-thread 관련 spec 개정 선행" 조건이 Phase 1 완료로 충족되었다 (`spec/5-system/4-execution-engine.md §3.3`에 conversationThread snapshot 항목 추가 완료). background-monitoring-api plan의 §4 spec 갱신 착수 시 해당 항목을 덮어쓰지 않도록 주의한다.

---

## 요약

`spec/conventions/` 대상 문서들은 plan/in-progress 전반과 대체로 정합하다. 단, `plan/in-progress/conversation-thread.md` Phase 4의 구현 태스크 목록이 spec §2.3의 v1 push 범위를 완전히 반영하지 못한다 — `text_classifier` 와 `information_extractor` 핸들러의 turn push 태스크가 누락되어 있어, 구현 착수 전 plan 보완이 필요하다.

## 위험도

**MEDIUM** (구현 착수 차단은 불필요하나, plan 보완 후 착수 권장)