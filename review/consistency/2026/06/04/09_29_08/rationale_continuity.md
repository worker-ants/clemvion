# Rationale 연속성 검토 결과

검토 대상: `spec/4-nodes/3-ai/` (diff-base: origin/main)
검토 모드: `--impl-done`

---

## 발견사항

### 1. [INFO] `conversation-thread v1/v2 경계` 번복 — 새 Rationale 포함, 적절히 처리됨

- **target 위치**: `spec/4-nodes/3-ai/1-ai-agent.md §12.10`
- **과거 결정 출처**: `spec/4-nodes/3-ai/1-ai-agent.md §12.1` (v1/v2 경계표 — "token-aware cap·DB 컬럼은 v2") 및 `spec/conventions/conversation-thread.md §7 v2 로드맵`
- **상세**: 이전 spec 은 "Token-aware cap" 과 "DB 컬럼 신설" 을 v2 유보로 명시했다. 이번 변경은 `memoryTokenBudget` (token-budget 근사) 와 `agent_memory` 테이블(별도 DB 영속)을 v1 노드에 도입하므로 외형상 그 유보를 번복한다. 단, §12.10 이 이 번복에 대해 (1) "token-budget 근사" vs "tokenizer-exact" 의 정밀도 분리, (2) DB 컬럼(`Execution.conversation_thread jsonb`) 이 아닌 `agent_memory` 별도 테이블로 v1 "신규 DB 컬럼 없음" 조항 유지, (3) 업계 레퍼런스 기반 결정 근거를 새 Rationale 항으로 명시했다. 번복의 근거가 함께 작성돼 있으므로 결정 무근거 번복에 해당하지 않는다.
- **제안**: 이미 적절히 처리됨. 다만 `spec/conventions/conversation-thread.md §7` 의 v2 로드맵 표도 "부분 실현" 로 갱신되었는지 별도 확인 권장 (본 검토 범위 외 파일).

---

### 2. [INFO] `summaryModel` 별도 필드 — 기각 대안이 명시된 Rationale 와 정합

- **target 위치**: `spec/4-nodes/3-ai/1-ai-agent.md §12.12`
- **과거 결정 출처**: 해당 기각 결정은 이번 변경에서 새로 작성된 것 (`summaryModel` 필드 기각)이므로 사전 합의된 폐기 Rationale 은 없다.
- **상세**: `summaryModel` 별도 필드를 기각하고 노드 `model`/`llmConfigId` 재사용을 채택하는 결정을 새 Rationale §12.12 로 명시했다. 과거 기각된 대안의 재도입 패턴은 아니다.
- **제안**: 현 상태 정합. v2 로드맵 항목으로 유보됨이 §12.12 와 Spec Agent Memory §3 양쪽에 교차 기재되어 있어 후속 결정 시 추적 가능하다.

---

### 3. [INFO] `contextScope` enum 에 `auto` 추가 기각 — 새 Rationale 에 명시

- **target 위치**: `spec/4-nodes/3-ai/1-ai-agent.md §12.9`
- **과거 결정 출처**: 해당 기각은 이번 변경에서 신규 작성된 결정이므로 기존 폐기 Rationale 는 없다.
- **상세**: `contextScope` enum 에 `auto` 값을 끼워넣는 대신 별도 1급 필드 `memoryStrategy` 를 도입하는 결정을 §12.9 에 명시했다. 과거 결정 번복이 아닌 신규 결정으로, 기각 대안 (enum 확장안) 을 올바르게 Rationale 에 기록했다.
- **제안**: 현 상태 정합.

---

### 4. [INFO] 멀티턴 누적 messages 물리 압축 (`d.6`) 의 `manual` 하위호환 불변식 명시

- **target 위치**: `spec/4-nodes/3-ai/1-ai-agent.md §6.2 d.6`, §12.14
- **과거 결정 출처**: `spec/4-nodes/3-ai/1-ai-agent.md §12.2` — `conversationHistory` 필드 제거 시 "schema 가 `.passthrough()` 이므로 DB legacy 워크플로 데이터에 두 키가 남아 있어도 silently 통과" 하위호환 원칙. `spec/conventions/node-output.md` CONVENTIONS 하위호환 원칙.
- **상세**: §6.2 d.6 이 "`manual` 은 물리 압축하지 않는다 (누적 messages 무변경 — 하위호환 불변식)" 를 명시하고, §12.14 도 additive 한계를 해소하되 `manual` 경로를 손대지 않는 결정 근거를 기술했다. 하위호환 원칙과 충돌 없다.
- **제안**: 현 상태 정합.

---

## 요약

이번 `spec/4-nodes/3-ai/` 변경 (persistent/summary_buffer 메모리 전략 도입) 은 기존 Rationale 에서 명시적으로 기각된 대안을 재도입하거나 합의된 설계 원칙을 위반하는 항목이 없다. 유일하게 유의할 지점은 `conversation-thread v1/v2 경계` 번복으로, 이 번복은 §12.10 에 구체적 근거 (정밀도 분리, 별도 테이블 경로, 업계 레퍼런스) 를 담은 새 Rationale 로 함께 처리되어 있다. `summaryModel` 기각, `contextScope` enum 확장 기각, `manual` 하위호환 불변식 유지 모두 Rationale 정합 상태다. 기존 spec 의 다른 Rationale 항목들 (spec/0-overview, spec/1-data-model, spec/2-navigation 등) 은 이번 `spec/4-nodes/3-ai/` 변경 범위와 교차하는 지점이 없다.

## 위험도

NONE
