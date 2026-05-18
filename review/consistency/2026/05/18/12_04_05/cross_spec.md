# Cross-Spec 일관성 검토 결과

**검토 대상**: `plan/in-progress/spec-draft-conversation-turn-render.md`
**검토 범위**: `spec/conventions/conversation-thread.md`, `spec/5-system/6-websocket-protocol.md`, `spec/conventions/node-output.md`, `spec/4-nodes/3-ai/1-ai-agent.md`, `spec/1-data-model.md`

---

## 발견사항

### 발견사항 1

- **[WARNING]** `form_submitted` 의 `data.fields` 키 — 기존 flat map 과 명명 충돌
  - target 위치: draft §1.2 `data?` 필드 보강 표, `form_submitted → fields (key-value 또는 Record<string,unknown>)` 행
  - 충돌 대상: `spec/conventions/node-output.md §4.5`
  - 상세: node-output §4.5 는 `form_submitted` 의 `interaction.data` 를 `{ [fieldName]: value }` (flat key-value map) 으로 정의한다. 즉, `data` 객체 자체가 필드명→값의 flat map 이다. 반면 draft §1.2 는 `ConversationTurn.data` 에서 `form_submitted → fields (key-value 또는 Record<string,unknown>)` 라고 기술해, `data.fields` 라는 중첩 키가 존재하는 것처럼 읽힌다. 만약 `ConversationTurn.data` 가 `output.interaction.data` 의 snapshot (§1.2 "구조화 원본 — `output.interaction.data` snapshot") 이라면 flat map 이어야 하며, `fields` 라는 별도 키는 존재하지 않는다. 이 표현이 `data` 자체를 `fields` 라고 부르는 것인지, `data.fields` 키를 새로 강제하는 것인지 모호해 구현자 혼동이 발생한다. 나아가 `spec/1-data-model.md §2.14 NodeExecution.interaction_data` 도 `form_submitted` 시 필드를 직접 flat map으로 저장하는 패턴과 일관성 유지가 필요하다.
  - 제안: draft §1.2 의 `form_submitted` 행을 `fields` (`Record<string, unknown>` — `output.interaction.data` 의 필드명→값 flat map, node-output §4.5 와 동일 shape) 로 명확히 재기술하거나, 또는 `fields` 는 `interaction.data` 자체를 가리키는 별칭임을 주석으로 명시. `fields` 라는 래퍼 키를 신설한다면 node-output §4.5 와 동시 갱신 필요.

---

### 발견사항 2

- **[WARNING]** `system` source 의 UI 렌더 — v1 자동 누적 없음 경고와 UI 매핑 정의의 긴장
  - target 위치: draft §11 §11.1 source 별 시각 매핑 표 (`system` 행), draft §1 (D5) source 별 시각 매핑 표 (`system` 행)
  - 충돌 대상: `spec/conventions/conversation-thread.md §1.1`
  - 상세: conversation-thread §1.1 은 `system` source 에 대해 "예약, v1 자동 누적 없음 — 명시적으로 push 한 system text 전용" 이라고 정의하며, v1 에서는 실질적으로 이 source 의 turn 이 발생하지 않는다. 그러나 draft §11.1 은 `system` source 에 대한 UI 렌더 규칙(ℹ️ 가운데정렬 system note)을 "강제" 매핑표에 포함시킨다. 이는 v1 에서 dead code 에 해당하는 UI 분기를 강제 규약으로 격상시키는 것이다. 충돌 자체는 없으나, v1 범위에서 "강제" 규약이라고 쓰면서 실제로 발생하지 않는 source 를 포함시키는 것은 독자를 오인시킬 수 있다.
  - 제안: §11.1 의 `system` 행에 "(예약 — v1 자동 push 없음, 수동 push 도입 시 활성화)" 주석을 추가해 기존 §1.1 과 동기화. 또는 v1 강제 매핑에서 `system` 행을 제외하고 "v2 예약" 절로 분리.

---

### 발견사항 3

- **[INFO]** §4.4.6 "권장 → 필수" 격상 — 기존 소비 측 권장 동작 bullet 과의 표현 불일치
  - target 위치: draft §3.2, §11 (D5) 마지막 줄 "권장 → 필수 격상", draft §1.5 예외 조항
  - 충돌 대상: `spec/5-system/6-websocket-protocol.md §4.4.6` 두 번째 bullet (현재 "권장")
  - 상세: 현재 websocket-protocol §4.4.6 소비 측 권장 동작 두 번째 bullet 은 `injected` chip 표시를 "권장" 으로 기술한다. draft 는 이를 "필수" 로 격상하며 §4.4.6 본문을 함께 수정한다고 명시(§3.2). 이 변경 자체는 spec 간 직접 모순을 제거하는 교정이므로 방향은 맞으나, §4.4.6 수정을 draft 에서 교체 문장까지 제시하는 방식으로 처리하므로, spec write 시 §4.4.6 원본 bullet 과 교체 문장이 동시에 존재하는 상태를 피하도록 원자적으로 교체해야 한다. 누락 시 두 개의 모순 지침이 공존하는 과도 상태가 생길 수 있다.
  - 제안: spec write 시 §4.4.6 의 두 번째 bullet 을 draft §3.2 제시 문장으로 전면 교체. 두 bullet 이 공존하지 않도록 기존 bullet 을 완전히 삭제.

---

### 발견사항 4

- **[INFO]** plan §3.4 의 cross-link 경로 오류 — 상대 경로 불일치
  - target 위치: draft §3.4 follow-up 항목 내 cross-link `../../spec/conventions/conversation-thread.md#11-...`
  - 충돌 대상: 파일시스템 상 `plan/in-progress/ai-thread-source-mark.md` 의 위치
  - 상세: `plan/in-progress/ai-thread-source-mark.md` 에서 `spec/conventions/conversation-thread.md` 를 relative link 로 참조할 때 올바른 경로는 `../../spec/conventions/conversation-thread.md` 가 아니라 `../../spec/conventions/conversation-thread.md` 이다 — 실제로 `plan/in-progress/` 에서 `spec/` 까지는 `../../spec/` 이므로 경로 자체는 맞지만, draft §3.4 의 표기를 그대로 plan 파일에 삽입할 경우 동일 plan 파일이 이미 repository root 기준 상대 경로를 쓰고 있다면 혼선이 생길 수 있다. 기존 plan 파일의 링크 패턴과 통일 여부를 확인할 필요가 있다.
  - 제안: spec write 시 `plan/in-progress/ai-thread-source-mark.md` 의 실제 cross-link 패턴(절대 경로 vs 상대 경로)을 확인하고 동일 스타일로 통일. 중요도는 낮음.

---

### 발견사항 5

- **[INFO]** `interaction_data` 의 `fields` 키 — NodeExecution 스키마와 draft §11.3 복원 view 간 참조 정합
  - target 위치: draft §11.3 데이터 소스 표 "실행 이력 복원 view" 행 (`NodeExecution 의 output.messages + output.interaction`)
  - 충돌 대상: `spec/1-data-model.md §2.14 NodeExecution.interaction_data`
  - 상세: data-model §2.14 의 `interaction_data` 컬럼은 `{ interactionType, buttonId?, buttonLabel?, clickedAt, clickedBy }` shape 이고, 별도의 `fields` 키나 `data` 서브 객체는 정의되어 있지 않다. 반면 draft §1.2 의 `ConversationTurn.data?` 는 `output.interaction.data` snapshot 이라고 정의한다. 실행 이력 복원 view 에서 `output.interaction` 을 참조할 때 `interaction_data` 컬럼과 `output_data.interaction` JSONB 경로가 다를 수 있어, 구현 시 어느 경로를 SoT 로 쓰는지 명확해야 한다. draft §11.3 은 이를 추상적으로 언급할 뿐 구체 경로를 특정하지 않는다.
  - 제안: 이미 conversation-thread §4 영속화 §141 에 "NodeExecution 분산 저장" 정책이 있으므로 추가 충돌은 없다. draft §11.3 의 "실행 이력 복원 view" 설명에 `output_data.interaction` (DB 영속 경로) 와 `interaction_data` 컬럼의 관계를 한 줄 명시하면 구현 혼란을 방지할 수 있다.

---

## 요약

target draft 는 `ConversationTurn` 스키마를 변경하지 않고 **렌더 규칙 + LLM payload prefix 책임 경계를 명문화** 하는 방향으로 작성되어, 기존 spec 과의 직접 모순(CRITICAL 급) 은 발견되지 않는다. 가장 주목해야 할 점은 `form_submitted` 의 `data` 필드에 `fields` 라는 키를 도입하는 표현이 기존 node-output §4.5 의 flat map 정의와 충돌 가능성(WARNING)이 있다는 것이다 — 이 부분의 표현을 draft 에서 명확히 재기술하지 않으면 구현 단에서 두 가지 shape 이 혼재할 위험이 있다. `system` source 의 강제 매핑 포함(WARNING)은 v1 에서 실제로 발화하지 않는 경로를 강제 규약으로 격상시키는 점에서 독자 오인 위험이 있다. §4.4.6 권장→필수 격상 및 plan 경로 이슈는 INFO 수준으로, spec write 시 원자적 교체와 경로 확인으로 해소 가능하다. 전체적으로 spec write 를 차단할 CRITICAL 충돌은 없으며, WARNING 2건을 draft 본문에서 보강한 뒤 write 진행을 권장한다.

## 위험도

LOW
