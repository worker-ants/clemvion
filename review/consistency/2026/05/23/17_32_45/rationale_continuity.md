# Rationale 연속성 검토 결과

검토 모드: `--impl-prep`
검토 대상: `spec/conventions/conversation-thread.md`, `spec/conventions/node-output.md`, `spec/4-nodes/3-ai/1-ai-agent.md`
검토 일시: 2026-05-23

---

## 발견사항

### 1. [WARNING] `_retryState` 의 DB 영속 정책이 `_resumeState` strip 합의와 비대칭 — Rationale 부재

- **target 위치**: `spec/conventions/node-output.md` §0 (Principle 0 예외 비고), §4.2.1 `_retryState` 보존 예외; `spec/4-nodes/3-ai/1-ai-agent.md` §7 header 비고 + §7.4 생명주기 비교 표
- **과거 결정 출처**: `spec/conventions/node-output.md` 기존 Principle 4.2 — `_multiTurnState → _resumeState` 로 통일하고 "노출되지 않는 internal 필드임을 문서에 명시". `spec/5-system/4-execution-engine.md §1.3` — "최종 출력 저장 시 엔진이 `_resumeState` / `_multiTurnState` 양쪽 모두를 제거한다"
- **상세**: 기존 합의는 multi-turn 의 internal 전달 필드(`_resumeState`)를 DB 영속 시 **무조건 strip** 하는 것이었다. 이번 변경은 `_retryState` 를 동일 패턴의 internal 필드로 도입하면서도 **`retryable === true` 종결 시 `NodeExecution.outputData` 에 영속 보존**하는 strip 예외를 신설했다. 이 예외는 기존 합의와 방향이 다르지만, 신규 Rationale 에서 "왜 이 예외가 정당한가" (TTL 만료 전 재시도 진입 경로를 위해 DB 조회가 필요하다는 근거)를 설명하는 절이 `node-output.md` 본문 §4.2.1 에는 있으나 **Rationale 섹션 (문서 말미)이 없다**. spec 의 `## Rationale` 규약 (각 spec 문서 끝 Rationale 절에 결정 근거 기록) 에 따라 `node-output.md` 의 Rationale 절 또는 별도 명시적 항목이 필요하다.
- **제안**: `node-output.md` 끝 (또는 §4.2.1 바로 아래) 에 `## Rationale` 항목 "Principle 4.2.1 — `_retryState` strip 예외의 근거" 를 추가해 (a) 재시도 진입 경로가 DB lookup 을 요구하는 이유, (b) TTL 설계, (c) `_resumeState` 와 달리 보존이 허용되는 조건을 명시한다. Principle 0 예외 비고에서 이 Rationale 절을 cross-ref 한다.

---

### 2. [WARNING] `ConversationTurn.data?` 필드에 `system_error` 한정 인라인 shape 정의 — `data?` 의 "단일 진실은 node-output §4.5" 원칙 편중

- **target 위치**: `spec/conventions/conversation-thread.md` §1.2 `data?` 행 비고: "**`source: 'system_error'` 한정 인라인 정의 (node-output §4.5 scope 외)**"
- **과거 결정 출처**: `spec/conventions/conversation-thread.md` §1.2 기존 정의 — "`interaction.type` 별 shape 은 [node-output §4.5]의 단일 정의를 따른다 (drift 회피 위해 본 표에 재열거하지 않음)". §8.1 Rationale — "`data?` 는 `output.interaction.data` 스냅샷의 단일 진실이라 다른 의미의 데이터를 박지 않는다"
- **상세**: §8.1 Rationale 는 "`data?` 에 다른 의미의 데이터를 박지 않는다" 를 명시했는데, `system_error` source 의 `data?` shape `{ code, message, retryable, retryAfterSec?, nodeId, nodeLabel }` 은 `output.interaction.data` 스냅샷이 아닌 **에러 메타데이터**로 의미가 다르다. 목적(에러 인라인 표시)은 명확하고 §8.3 Rationale 에서 대안 비교를 제시하지만, `data?` 필드 본래 정의("output.interaction.data snapshot") 를 변형한 점에 대한 명시적 해명이 §8.3 에 없다.
- **제안**: `conversation-thread.md §8.3` 에 "`data?` 본래 의미의 예외적 확장" 소절을 추가해 기존 §8.1 원칙("다른 의미의 데이터를 박지 않는다")과의 tension 을 인정하고, `system_error` source 에 한해 `data?` 를 에러 메타 운반으로 사용하는 이유를 명시한다. 대안으로 `error?` 같은 별도 필드를 쓰지 않은 이유도 기록.

---

### 3. [INFO] `Inv-3` 이 새 `Inv-6` 의 immutability 와 참조 관계 미명시

- **target 위치**: `spec/conventions/conversation-thread.md` §9.9 Inv-6 — "기존 user / assistant / tool item 은 변형되지 않는다 (immutability — Inv-3 의 메타데이터 불변 원칙과 동일 강도)"
- **과거 결정 출처**: `spec/conventions/conversation-thread.md` §9.9 Inv-3 — "SummaryView 와 SelectedItemDetail 의 라벨 판정은 동일한 `isAssistantContentBlank` 에서 도출"
- **상세**: Inv-3 는 "라벨 판정의 단일 함수 의존" 에 관한 것으로, Inv-6 에서 말하는 "item 의 불변성(immutability)"과는 다른 차원의 불변량이다. Inv-6 는 "한 번 APPEND 된 item 은 수정·삭제되지 않는다" 를 의미하지만 Inv-3 을 동일 강도로 인용하면서 기반 Rationale 가 다른 두 원칙이 혼용될 수 있다. Inv-2 ("한 번 표시된 tool row 가 그룹 합쳐짐 외의 이유로 사라지지 않는다") 가 오히려 Inv-6 와 더 밀접하다.
- **제안**: Inv-6 에서 Inv-3 대신 Inv-2 를 비교 기준으로 참조하거나, "Inv-3 의 라벨 판정 불변 원칙과 동일 강도" 표현을 "Inv-2 의 tool row 보존 원칙과 동일 방향" 으로 정정한다.

---

### 4. [INFO] `Principle 4.2.1` 참조가 Principle 4.2 하위 절로 신설되었으나 `§4.2` 기존 폐기 목록 문맥 내에 위치

- **target 위치**: `spec/conventions/node-output.md` §4.2 — 기존 "폐기할 필드 / 구조" 섹션 내부에 `§4.2.1 보존 예외 — _retryState` 가 삽입됨
- **과거 결정 출처**: `spec/conventions/node-output.md` §4.2 제목 "4.2. 폐기할 필드 / 구조"
- **상세**: §4.2 는 "폐기할 필드 / 구조" 를 열거하는 절인데, §4.2.1 은 새 예외(보존) 를 정의한다. 섹션 제목과 하위 절의 의미가 상충해 독자가 맥락을 오해할 여지가 있다.
- **제안**: `_retryState` 보존 예외를 §4.2 하위가 아닌 독립 §4.3 (또는 §4.6) 에 배치하거나, §4.2 제목을 "4.2. 블로킹·재개 관련 internal 필드 정책" 으로 확장해 폐기와 보존 예외를 모두 포함하도록 개정한다.

---

### 5. [INFO] `§9.7.1 store reset 정책` 신설이 기존 §9.7 표와 이중 정의 위험

- **target 위치**: `spec/conventions/conversation-thread.md` §9.7.1 신설 — "lifecycle 액션별 두 묶음 reset 정책"
- **과거 결정 출처**: `spec/conventions/conversation-thread.md` §9.7 WS 이벤트 → store 변환 계약 (기존 §8.2 에서 합의된 "UI 계약 SoT 격상" 의 일환)
- **상세**: §9.7 은 WS 이벤트별 store mutation 을 정의하는 계약이고 §9.7.1 은 lifecycle 액션별 reset 정책을 정의한다. 두 절의 관할 범위가 겹치지 않아 충돌은 없다. 다만 §9.7.1 에서 "본 정책의 단일 진실은 본 §9.7.1" 을 선언하면서도 "[Spec 실행 §10.8] 가 본 정책을 cross-ref 한다" 고 명시하는데, 해당 §10.8 이 실제로 갱신되었는지 확인이 필요하다. 미갱신 상태라면 SoT 선언과 실제 cross-ref 부재가 충돌한다.
- **제안**: 구현 착수 전 `spec/3-workflow-editor/3-execution.md §10.8` 이 §9.7.1 을 cross-ref 하도록 갱신되어 있는지 확인하고, 없다면 별도 spec 수정으로 보완한다.

---

## 요약

이번 target 변경 (`multiturn-error-preserve`) 은 멀티턴 AI Agent 오류 시 대화 스레드를 보존하고 인라인 재시도 UI 를 제공하는 `system_error` source 와 `_retryState` 메커니즘을 신규 도입했다. 기존 Rationale 에서 명시적으로 기각된 대안을 재채택하거나 확립된 invariant 를 직접 위반하는 사례는 없다. 단, 두 가지 WARNING 이 존재한다. 첫째, `_retryState` 가 `_resumeState` 의 "무조건 strip" 합의를 예외로 번복하면서 `node-output.md` 끝의 `## Rationale` 절에 명시적 근거 기록이 없다는 점. 둘째, `ConversationTurn.data?` 필드가 기존 "output.interaction.data snapshot 단일 진실" 원칙(§8.1 Rationale)과 성격이 다른 에러 메타 shape 을 인라인 정의했음에도 §8.3 Rationale 에서 이 tension 을 명시적으로 다루지 않은 점. 나머지 발견사항은 섹션 구조와 cross-ref 보완 수준의 INFO 사항이다.

---

## 위험도

MEDIUM
