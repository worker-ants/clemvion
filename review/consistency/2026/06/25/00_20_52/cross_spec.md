# Cross-Spec 일관성 검토 결과

검토 대상: C-2 1차 슬라이스 — `AiTurnExecutor.executeSingleTurn` setup 단계를 3개 private 메서드로 분해  
diff-base: `origin/main`  
검토 범위: `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.{ts,spec.ts}`  
관련 spec: `spec/4-nodes/3-ai/1-ai-agent.md §6.1`, `spec/4-nodes/3-ai/0-common.md §11.4`, `spec/conventions/conversation-thread.md §2.2`

---

## 발견사항

### [INFO] 구현 내 step 번호 역전(1.7 → 1.3/1.5) 과 spec §6.1 step 순서의 표기 불일치

- **target 위치**: `ai-turn-executor.ts` diff 의 `executeSingleTurn` 내 주석 블록 — "실행 순서가 spec 단계 번호와 역전(1.7 → 1.3/1.5)인 것은 의도적이며 원본 동작 보존"
- **충돌 대상**: `spec/4-nodes/3-ai/1-ai-agent.md §6.1` 단계 열거 순서 (1.3 → 1.5 → 1.7)
- **상세**: spec §6.1 은 단계를 `0.5 → 1 → 1.3 → 1.5 → 1.7 → 2 → 2.5 → 2.7 → 3 …` 순으로 기술한다. 코드 주석은 `buildSingleTurnMessages`(1.7) 를 먼저 호출하고 `applySingleTurnMemoryInjection`(1.3/1.5) 을 나중에 호출하는 것이 "의도적"이라고 설명하며, 그 이유로 "getThreadExcludingNode 가 self 노드 turn 을 제외하므로 결과는 동일하다"를 든다. 동작 자체는 동일하지만 spec 본문은 이 역전을 명시하지 않으므로, 이후 spec 과 구현을 대조하는 리뷰어가 순서 불일치를 잠재적 회귀로 오판할 수 있다. spec 에 이 역전이 안전한 이유(self-node exclusion invariant)를 짧게 주석으로 추가하거나, `applySingleTurnMemoryInjection` JSDoc 의 설명을 spec 에 역링크로 반영하면 혼란이 줄어든다.
- **제안**: spec 변경 불요(이번 슬라이스 scope 밖). 단, 차후 spec-sync PR 시 `spec/4-nodes/3-ai/1-ai-agent.md §6.1` 1.7 항목에 "구현에서는 messages 초기 조립(1.7)이 memory injection(1.3/1.5) 보다 먼저 호출되나 getThreadExcludingNode 가 self-turn 을 제외하므로 결과 동일" 언급을 추가하면 좋다.

---

### [INFO] `buildSingleTurnSystemPrompt` JSDoc 의 §6.1 단계 번호 표기 — "단계 0.5" 한정 적용

- **target 위치**: `ai-turn-executor.ts` diff, `buildSingleTurnSystemPrompt` JSDoc — "§6.1 단계 0.5 · [1]~[4]"
- **충돌 대상**: `spec/4-nodes/3-ai/1-ai-agent.md §6.1` 단계 0.5 와 단계 1
- **상세**: spec §6.1 단계 0.5 는 System Context Prefix 빌드, 단계 1 은 "Knowledge Base / MCP 서버 setup" 이다. 신규 메서드 JSDoc 은 "[1] System Context Prefix → [2] 사용자 systemPrompt → [3] KB_TOOL_GUIDANCE → [4] Condition suffix" 라고 적고 있는데, 이 [1]~[4] 는 spec §11.4 의 systemPrompt ordering 번호(내부 정렬 표기)이지 spec §6.1 의 단계 번호가 아니다. 혼동 가능성이 있으나, 이미 JSDoc 본문에 "spec/4-nodes/3-ai/0-common.md §11.4" 를 링크하고 있으므로 독자가 맥락을 파악할 수 있다. 기존 spec 과 직접 모순은 없다.
- **제안**: 코드 주석 내 표기 정도만 정리하면 충분. spec 갱신 불요.

---

## 요약

이번 C-2 1차 슬라이스는 `executeSingleTurn` 의 setup 로직(시스템 프롬프트 조립 · messages 초기화 · 메모리 주입)을 3개 private 메서드(`buildSingleTurnSystemPrompt` / `buildSingleTurnMessages` / `applySingleTurnMemoryInjection`)로 추출하는 behavior-preserving 리팩터링이다. spec 변경 불요를 전제로 한 슬라이스이므로 cross-spec 충돌 위험은 낮다. 확인된 사항은 두 가지 INFO 수준 표기 불일치뿐이며, 둘 다 코드 동작과 spec 의미 사이의 직접 모순이 아닌 단계 번호 표기 혼동 가능성이다. `spec/4-nodes/3-ai/1-ai-agent.md §6.1` · `spec/4-nodes/3-ai/0-common.md §11.4` · `spec/conventions/conversation-thread.md §2.2` 와 데이터 모델·API 계약·RBAC·상태 전이·계층 책임 어느 관점에서도 충돌이 없다. 실질 위험도는 없다.

## 위험도

NONE
