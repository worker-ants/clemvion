핵심 참조 파일 검토 완료. 이제 발견사항을 정리합니다.

---

## 발견사항

---

### **[WARNING]** Presentation 노드 push 트리거 — 컨벤션 vs 실행 엔진 정의 불일치

- **target 위치**: `spec/conventions/conversation-thread.md` §2.1 — "status: 'resumed' 직전"
- **위반 규약**: 교차 문서 정합성 (CLAUDE.md §"작업 이전: 관련 spec/ 문서와 plan/in-progress/ 를 먼저 읽는다")
- **상세**: `conversation-thread.md` §2.1은 Presentation 노드의 turn push 시점을 **"`status: 'resumed'` 직전"** 으로 정의한다. 그러나 `spec/5-system/4-execution-engine.md` 에는 다음 주석이 병존한다:
  > "현재 엔진은 presentation 노드의 `status: 'submitted' | 'button_click' | 'button_continue'` 레거시 값을 유지한다. Stage 3(presentation Principle 1.1 재작성) 에서 모두 `resumed` 로 통일 예정."
  
  즉 현재 실행 엔진은 레거시 status 값으로 동작하고 있고, 컨벤션은 미래 상태(`resumed`)를 기준으로 쓰여 있다. 이 상태에서 개발자가 컨벤션만 보고 구현하면 **현재 엔진의 hook 지점과 다른 시점**에 push를 구현하게 된다.
- **제안**: 두 가지 중 하나를 선택해야 한다.
  - (A) `conversation-thread.md §2.1` 에 "(현재 구현: legacy `submitted` / `button_click` / `button_continue` status 시점. Stage 3 완료 후 `resumed` 직전으로 변경 예정)" 을 주석으로 명시
  - (B) `execution-engine.md` 의 legacy 주석을 제거하고 실제 구현을 `resumed` 기준으로 선제 마이그레이션

---

### **[WARNING]** Single-turn AI Agent의 thread push 동작 — `1-ai-agent.md` 실행 흐름에 누락

- **target 위치**: `spec/4-nodes/3-ai/1-ai-agent.md` §6.1 (Single Turn 실행 흐름)
- **위반 규약**: `spec/conventions/conversation-thread.md` §2.2 (AI Agent 자동 누적 컨트랙트)
- **상세**: `conversation-thread.md §2.2` 는 single-turn 에서도 다음 두 turn 을 push 해야 한다고 정의한다:
  - `userPrompt` (resolved) → `ai_user` (1회)
  - 최종 `output.result.response` → `ai_assistant` (1회)
  
  그러나 `1-ai-agent.md §6.1` 의 실행 흐름에는 **step 1.5 (Conversation Thread 주입 — 읽기)** 만 있고, turn push (쓰기) 단계가 없다. Multi-turn 흐름(§6.2 step 2c)에는 `ConversationThread 에 ai_user turn 자동 push` 가 명시되어 있는데 single-turn 에는 해당 step이 누락되어 있다. `1-ai-agent.md` 만 보고 구현하는 개발자는 single-turn push를 빠뜨릴 위험이 있다.
- **제안**: `1-ai-agent.md §6.1` 에 다음 step 을 추가:
  - Step 2 와 4 사이 (혹은 step 4 이후): "ConversationThread 에 `ai_user` turn push (userPrompt resolved 값) + LLM 최종 응답 후 `ai_assistant` turn push — [Spec Conversation Thread §2.2](../../conventions/conversation-thread.md#22-ai-agent) 참조"

---

### **[INFO]** `ai_tool` source 에 condition tool 포함 — 동작 모호성

- **target 위치**: `spec/conventions/conversation-thread.md` §1.1 `ConversationTurnSource`, §2.2 마지막 행
- **위반 규약**: `spec/conventions/node-output.md` Principle 5 (port 활성화 모델) 및 `spec/4-nodes/3-ai/1-ai-agent.md §6.1 step 3b`
- **상세**: `conversation-thread.md §1.1` 은 `ai_tool` source를 "KB / MCP / **condition tool 결과**" 라고 정의한다. 그러나 `1-ai-agent.md §6.1 step 3b` 에 따르면 조건 도구가 매칭되면 **즉시 해당 포트로 라우팅하고 종료**된다 — 전통적인 tool_result 메시지가 LLM 에 반환되지 않는다. "condition tool 결과"를 thread 에 push한다는 것이 조건 도구 호출 인수(`reason`)를 의미하는지, 아니면 condition 자체가 `ai_tool` 에 포함되지 않아야 하는지 불명확하다.
- **제안**: `conversation-thread.md §1.1` 의 `ai_tool` 설명을 다음과 같이 명확화: "KB / MCP tool 결과 + condition tool 호출(`cond_*` 호출 시 LLM 이 제공한 `reason` argument). `includeToolTurns: true` 시에만 push"

---

### **[INFO]** `conversation-thread.md §8 Rationale` — 컨벤션 문서 외부로 위임

- **target 위치**: `spec/conventions/conversation-thread.md` §8 Rationale
- **위반 규약**: CLAUDE.md §"Rationale — 결정의 배경·근거. 해당 spec 문서 끝의 ## Rationale 섹션"
- **상세**: §8 본문이 "설계 결정의 근거는 [Spec AI Agent §12] Rationale 섹션에 단일 인라인" 이라고 선언하고, 실제 근거 내용이 `spec/4-nodes/3-ai/1-ai-agent.md §12` 에만 존재한다. 컨벤션 문서 자체의 Rationale 섹션이 비어 있어 컨벤션 파일 단독으로는 설계 판단 근거를 파악할 수 없다. `1-ai-agent.md` 가 아닌 `conversation-thread.md` 를 먼저 읽는 독자는 외부 파일을 반드시 열어야 한다.
- **제안**: `1-ai-agent.md §12` 의 핵심 결정 요약(선택지 비교 테이블, v1/v2 경계)을 `conversation-thread.md §8` 에 축약 인라인하거나, 최소한 §8 에 "설계 동기·선택지 비교·deprecated 배경은 [Spec AI Agent §12] 참조"와 함께 결정 사항(도입된 이유 한 줄)을 직접 명시할 것을 권장.

---

### **[INFO]** 복수 컨벤션 파일 — Rationale 섹션 없음 (선택 사항이나 일관성 부재)

- **target 위치**: `spec/conventions/cafe24-api-metadata.md`, `spec/conventions/node-output.md`, `spec/conventions/swagger.md`
- **위반 규약**: CLAUDE.md §"Rationale 섹션을 권장" (강제 아님)
- **상세**: `migrations.md` (§7 폐기 대안)과 `conversation-thread.md` (§8)은 Rationale 섹션을 갖고 있으나, 나머지 3개 컨벤션 파일은 없다. 특히 `node-output.md` 는 가장 광범위한 아키텍처 결정(5필드 invariant, config-output 직교성, port 예약어 등)을 담고 있어 Rationale 부재 시 설계 의도 파악이 어렵다.
- **제안**: 의무 사항이 아니므로 차단하지 않으나, 특히 `node-output.md` 에 Principle 별 폐기된 대안(예: `output.view` 래퍼 폐기 이유, `output.metadata` 제거 이유)을 `## Rationale` 섹션으로 정리하면 미래 spec 수정 시 재검토 비용이 줄어든다.

---

## 요약

5개 컨벤션 파일의 전반적인 규약 준수도는 양호하다. `conversation-thread.md` 는 신규 도입임에도 불구하고 기존 `node-output.md`, `execution-engine.md`, `expression-language.md`, `1-ai-agent.md` 와 대부분 정합하다. 다만 **Presentation 노드 push 트리거(WARNING #1)**와 **single-turn push step 누락(WARNING #2)** 두 가지는 구현 단계에서 버그로 이어질 수 있으며, 컨벤션 또는 `1-ai-agent.md` 중 하나를 조정해야 한다.

## 위험도

**MEDIUM** — CRITICAL 위배는 없으나, 두 WARNING 항목이 구현 착수 시 push 시점/단계 누락으로 이어질 수 있다.