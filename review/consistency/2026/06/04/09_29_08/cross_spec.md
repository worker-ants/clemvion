# Cross-Spec 일관성 검토 결과

검토 모드: `--impl-done` (구현 완료 후 검토)
대상: `spec/4-nodes/3-ai/` (0-common.md, 1-ai-agent.md 위주; 멀티턴 물리 압축 §6.2 d.6 및 관련 변경)
diff-base: `origin/main`

---

## 발견사항

### [WARNING] `meta.memory` 필드 목록 — `compactedMessages` 미등재

- **target 위치**: `spec/4-nodes/3-ai/1-ai-agent.md` §7.1 출력 구조 표 (`meta.memory` 행) + §6.2 d.6
- **충돌 대상**: `spec/4-nodes/3-ai/1-ai-agent.md` §7.1 `meta.memory` 설명 문자열 (`{ strategy, summarized, recalledCount, tokenBudgetUsed }`)
- **상세**: §6.2 d.6 은 물리 압축 발생 시 `meta.memory.compactedMessages` 를 노출한다고 정의한다. 그러나 §7.1 의 `meta.memory` 행 설명은 `{ strategy, summarized, recalledCount, tokenBudgetUsed }` 4개 필드만 열거하며 `compactedMessages` 가 포함되지 않는다. 구현 출력에서 새 필드가 emit 되더라도 spec 의 출력 구조 표에서 조회 가능성이 없으므로 다운스트림 워크플로우 빌더가 표현식 `$node["X"].meta.memory.compactedMessages` 를 발견하지 못한다.
- **제안**: `spec/4-nodes/3-ai/1-ai-agent.md` §7.1 의 `meta.memory` 행 설명을 `{ strategy, summarized, recalledCount, tokenBudgetUsed, compactedMessages? }` 로 갱신하고 `compactedMessages?` 에 대한 설명(Integer, 이 turn 에 messages 에서 물리 제거된 메시지 수, 미발생 시 생략)을 추가한다.

---

### [INFO] `conversation-thread.md §1.3` — `runningSummary`/`summarizedUpToSeq` 필드 정의 존재, 물리 압축 관련 언급 없음

- **target 위치**: `spec/4-nodes/3-ai/1-ai-agent.md` §6.2 d.6 (멀티턴 물리 압축)
- **충돌 대상**: `spec/conventions/conversation-thread.md` §1.3 (`ConversationThread` 자료구조)
- **상세**: `conversation-thread.md §1.3` 은 `runningSummary` / `summarizedUpToSeq` 를 ConversationThread 의 1급 필드로 정의하며, §5.3 cap 설명에서 "요약 전략에서는 char-cap 대신 token-budget" 이라고 명시한다. 그러나 §6.2 d.6 에서 정의된 "누적 LLM messages 에서 오래된 exchange 를 물리 제거한다" 동작은 conversation-thread.md 에 등장하지 않는다. 두 spec 간 모순은 없으나(`conversation-thread.md` 는 thread 자료구조를 다루고 LLM messages 배열은 다루지 않음), conversation-thread.md §5.3 의 cap/메모리 설명이 물리 압축 동작을 참조하지 않아 독자가 messages 배열 압축의 존재를 파악하기 어렵다.
- **제안**: `spec/conventions/conversation-thread.md §5.3` 의 "memoryStrategy 별 cap 메커니즘" 노트에 "d.6 physical compaction 은 LLM messages 배열 측에서 수행되며 ConversationThread.turns 자체를 변경하지 않는다" 는 1문장 참조를 추가해 독자 혼란을 예방한다 (정합 문제 없음, 명시화 권장).

---

### [INFO] `mcpServers` 필드 `service_type` 허용 목록 불일치 — `0-common.md` vs `1-ai-agent.md`

- **target 위치**: `spec/4-nodes/3-ai/0-common.md` §3 `McpServerRef` 표 (`service_type ∈ ('mcp', 'cafe24')` 만 언급)
- **충돌 대상**: `spec/4-nodes/3-ai/1-ai-agent.md` §1 `mcpServers` 필드 설명 (`service_type ∈ ('mcp', 'cafe24', 'makeshop')` 3종 명시)
- **상세**: 공통 규약 §3 의 `McpServerRef` 표는 `service_type ∈ ('mcp', 'cafe24')` 만 나열하는 반면, AI Agent §1 의 `mcpServers` 필드 설명과 §2 UI 그룹은 `makeshop` 을 포함한 3종을 명시한다. 두 문서의 동일 필드 정의가 다른 범위를 열거한다. 이는 본 diff 에서 새로 생긴 불일치가 아니라 기존에 pre-existing 한 항목이지만 검토 대상 spec 파일에 내재된 충돌이다.
- **제안**: `spec/4-nodes/3-ai/0-common.md` §3 의 `McpServerRef` 표 `integrationId` 설명에서 `service_type ∈ ('mcp', 'cafe24')` 를 `service_type ∈ ('mcp', 'cafe24', 'makeshop')` 로 동기화한다.

---

### [INFO] `meta.memory` 필드의 단일 진실 선언 모호

- **target 위치**: `spec/4-nodes/3-ai/1-ai-agent.md` §7.1 `meta.memory` 행 — "SoT: [Spec Agent Memory]" 참조
- **충돌 대상**: `spec/5-system/17-agent-memory.md` 전문 — `meta.memory.recalledCount` 만 언급 (`meta.memory.summarized`, `tokenBudgetUsed`, `compactedMessages` 는 언급 없음)
- **상세**: §7.1 은 `meta.memory` 의 단일 진실 공급원으로 `spec/5-system/17-agent-memory.md` 를 지목하지만, `17-agent-memory.md` 는 persistent 회수 카운트(`recalledCount`)만 명시하고 나머지 3개 필드(`summarized`, `tokenBudgetUsed`, `compactedMessages`)는 다루지 않는다. SoT 선언이 실제 SoT 범위를 초과한다. 모순이 아니라 SoT 지목의 부정확성이다.
- **제안**: §7.1 의 `meta.memory` SoT 주석을 "SoT: [Spec Agent Memory](recalledCount 한정). 나머지 필드(`summarized`, `tokenBudgetUsed`, `compactedMessages`)의 SoT 는 본 §6.1/§6.2 d.5/d.6" 으로 구체화하거나, `17-agent-memory.md §4` 회수 절에 `meta.memory.recalledCount` 외 세 필드를 병기한다.

---

## 요약

Cross-Spec 일관성 관점에서 이번 `spec/4-nodes/3-ai/` diff 의 핵심 변경(멀티턴 누적 messages 물리 압축 §6.2 d.6, `meta.memory.compactedMessages` 신설, `memoryTtlDays`·AGM-08~11 관련 기존 필드)은 데이터 모델(`1-data-model.md §2.23 AgentMemory`), CONVENTIONS(`node-output.md Principle`), `conversation-thread.md §1.3`, `17-agent-memory.md` 와 실질적 모순을 일으키지 않는다. 단, `1-ai-agent.md §7.1` 출력 구조 표에서 `meta.memory` 에 `compactedMessages` 가 누락된 불완전 정의(WARNING 1건)와, `0-common.md §3` 의 `service_type` 목록 미동기(INFO), `meta.memory` SoT 지목 범위 부정확(INFO), `conversation-thread.md` 에 물리 압축 참조 누락(INFO) 등 동기화 권장 항목이 있다. 모두 구조적 작동 불가 수준의 충돌은 아니며, WARNING 1건은 출력 표 보완으로 즉시 해소 가능하다.

---

## 위험도

LOW
