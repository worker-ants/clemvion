# Cross-Spec 일관성 검토 — memory-autoinject-extend

**검토 일시**: 2026-06-05  
**worktree**: `memory-autoinject-extend-e102af`  
**merge-base**: `9e65f853`  
**검토 대상 spec**:
- `spec/4-nodes/3-ai/0-common.md` §10
- `spec/conventions/conversation-thread.md` §2.3 / §5
- `spec/4-nodes/3-ai/2-text-classifier.md` §1 / §5
- `spec/4-nodes/3-ai/3-information-extractor.md` §1 / §5
- `spec/4-nodes/3-ai/1-ai-agent.md` §7.1 (앵커)

---

## 발견사항

### INFO — §5 heading anchor 변경, spec 내부 inbound 링크는 모두 갱신 완료

- **target 위치**: `spec/conventions/conversation-thread.md` §5 heading (`## 5. AI Agent 자동 주입` → `## 5. contextScope 자동 주입 (세 AI 노드 공통)`)
- **충돌 대상**: spec 내부에서 `#5-contextscope-자동-주입-세-ai-노드-공통` 앵커를 참조하는 링크들
- **상세**: `spec/` 내부에서 구 앵커 `#5-ai-agent-자동-주입`를 참조하는 파일이 **0개**임을 확인했다. `spec/4-nodes/3-ai/0-common.md:240`, `spec/4-nodes/3-ai/1-ai-agent.md:399` 양쪽 모두 신규 앵커 `#5-contextscope-자동-주입-세-ai-노드-공통`으로 업데이트되어 있다. `review/code/` 하위 `_prompts/` 파일들에 구 앵커가 남아 있으나 이는 이미 완료된 리뷰 생성 당시의 스냅샷으로 spec 규약이 아니다.
- **제안**: 조치 불필요.

---

### INFO — `node-output.md` §2 LLM 계열 meta 정의가 3노드 공통으로 묵시적으로 정합, 명시 갱신은 미이루어짐

- **target 위치**: `spec/4-nodes/3-ai/2-text-classifier.md §5.1/§5.2/§5.3`, `3-information-extractor.md §5.1/§5.6` — `meta.contextInjection` 행 신규 추가
- **충돌 대상**: `spec/conventions/node-output.md:90` — `| **LLM 계열** | ... meta.contextInjection? ...` 정의
- **상세**: `node-output.md §2` 의 LLM 계열 공통 meta 목록에 `meta.contextInjection?` 가 이미 포함되어 있으며 `ai_agent` / `text_classifier` / `information_extractor` 세 노드 모두 LLM 계열로 분류되어 있다(§3.2.1 참조). 따라서 논리적 충돌은 없다. 단, `node-output.md` 의 해당 행에 `contextInjection` 가 "(ConversationThread 자동 주입 시)" 라고만 기술되어 있고 적용 노드 범위가 명시되지 않아 "3노드 공통"임을 독자가 추론해야 한다.
- **제안**: 명시적 정합성 향상을 위해 `node-output.md:90` 의 해당 설명에 "세 LLM 계열 노드 공통 (`ai_agent` / `text_classifier` / `information_extractor`)" 문구를 추가할 수 있으나 기능적 충돌은 아니다. 우선순위 낮음.

---

### INFO — `information-extractor §5.4 waiting` / `§5.5 resumed` 케이스의 meta 표에 `meta.contextInjection` 행 부재

- **target 위치**: `spec/4-nodes/3-ai/3-information-extractor.md §5.4` (waiting meta 표), `§5.5` (resumed meta 표)
- **충돌 대상**: `spec/4-nodes/3-ai/3-information-extractor.md §5.1` (meta.contextInjection 행 존재) 및 `§5.6` (meta.contextInjection 행 존재)
- **상세**: information_extractor multi-turn 에서 contextScope 주입은 "첫 진입(`executeMultiTurn`) 의 초기 messages 빌드 직후 1회 주입"되고 `_resumeState.messages` 로 운반된다. §5.6 completed/user_ended/max_turns 케이스에는 `meta.contextInjection` echo 가 명시되어 있으나 (§5.6 통합 표 line 626), §5.4 waiting 케이스의 meta 표와 §5.5 resumed 케이스의 meta 표에는 `meta.contextInjection` 행이 없다. 실제로 waiting 시점에 contextInjection 이 echo 되어야 하는지(첫 주입 결과가 있다면 echo 가능)가 spec 상 명시되지 않아 모호성이 있다.
- **제안**: §5.6 통합 표의 `meta.contextInjection` 행 주석("multi-turn 은 첫 진입 시 1회 주입한 결과를 state 로 운반해 종결 출력에 echo")이 §5.4 waiting, §5.5 resumed에는 부재한다. §5.4/§5.5의 meta 표에도 "(multi-turn 은 첫 진입 주입 시에만 설정, 이후 state 운반)" 주석을 달아 명시 동기화를 권장.

---

### INFO — `memoryStrategy` 구분의 일관성: 세 spec 간 일치 확인됨

- **target 위치**: `spec/4-nodes/3-ai/0-common.md §10`, `spec/conventions/conversation-thread.md §2.3`, `spec/4-nodes/3-ai/2-text-classifier.md §1`, `spec/4-nodes/3-ai/3-information-extractor.md §1`
- **충돌 대상**: `spec/4-nodes/3-ai/1-ai-agent.md §1` (memoryStrategy 정의)
- **상세**: 네 곳 모두 "memoryStrategy 는 ai_agent 전용, text_classifier / information_extractor 는 항상 contextScope(manual) 경로"를 일관되게 기술한다. `0-common.md §10` 표 안의 `memoryStrategy` 행에 "ai_agent 한정" 주석이 명기되어 있고, `conversation-thread.md §2.3` 표의 자동 메모리 행도 "ai_agent 만" 으로 구분된다. conversation-thread.md §5 본문 말미에도 "ai_agent 의 memoryStrategy ∈ {summary_buffer, persistent} 자동 메모리 경로는 이 공유 주입을 대체" 구분이 명시되어 있다. 충돌 없음.

---

### INFO — `meta.contextInjection` shape의 5-필드 정의가 세 spec에서 일치

- **target 위치**: `spec/4-nodes/3-ai/1-ai-agent.md §7.1` line 519, `spec/4-nodes/3-ai/2-text-classifier.md §5.1` line 187, `spec/4-nodes/3-ai/3-information-extractor.md §5.1` line 243
- **충돌 대상**: `spec/conventions/conversation-thread.md §5.3`, `spec/conventions/node-output.md:90`
- **상세**: 세 노드의 meta 표와 conversation-thread §5.3 모두 `{ appliedScope, appliedMode, injectedTurns, droppedTurns, totalInjectedChars }` 로 5필드를 동일하게 정의한다. node-output.md:90 도 동일 shape. 충돌 없음.

---

### INFO — `contextScope` 5필드 정의: `0-common.md §10` vs 두 노드 spec §1 비교

- **target 위치**: `spec/4-nodes/3-ai/2-text-classifier.md §1` (필드 표), `spec/4-nodes/3-ai/3-information-extractor.md §1` (필드 표)
- **충돌 대상**: `spec/4-nodes/3-ai/0-common.md §10` 표
- **상세**: 두 노드 spec의 §1 설정 표에 `contextScope` / `contextScopeN` / `contextInjectionMode` / `includeToolTurns` / `excludeFromConversationThread` 5필드가 추가되어 있고, `0-common.md §10` 의 표와 필드명·타입·기본값이 정확히 일치한다. 충돌 없음.

---

## 요약

이번 변경(contextScope 자동 주입 ai_agent → 세 노드 공통 확장)에 대한 네 개의 spec 파일 간 일관성은 전반적으로 양호하다. `memoryStrategy` 는 ai_agent 전용, `contextScope` 는 3노드 공통이라는 구분이 0-common.md §10, conversation-thread.md §2.3/§5, 두 노드 개별 spec §1에서 상호 일치하여 기술된다. `meta.contextInjection` shape 정의도 세 노드 spec 과 conversation-thread §5.3, node-output.md 모두 동일하다. §5 heading anchor 변경에 따른 inbound 링크는 spec 내부에서 모두 갱신되어 있다. 발견된 이슈는 information-extractor §5.4/§5.5 케이스의 meta 표 동기화 누락(INFO)과 node-output.md 의 적용 범위 명시 보완(INFO) 두 건으로, 기능적 동작에 모순을 일으키는 CRITICAL/WARNING 충돌은 없다.

## 위험도

LOW

---

BLOCK: NO
