## Cross-Spec 일관성 검토 결과

제공된 관련 spec 본문(`spec/0-overview.md`, `spec/1-data-model.md`, `spec/2-navigation/**`)을 대상으로 target draft와의 충돌을 분석합니다.

---

## 발견사항

### **[WARNING] `interaction.type` 명명 불일치 — `form_submit` vs `form_submitted`**

- **target 위치**: Draft §1.1 ConversationTurnSource, §1.4 text 변환 규칙, §2.1 Presentation 노드 자동 누적 계약
- **충돌 대상**: `spec/1-data-model.md` §2.14 NodeExecution.`interaction_data`

- **상세**: data model은 `interaction_data.interactionType`의 enum 값으로 `"form_submit"`(suffix `-ed` 없음)을 정의한다. 반면 draft는 `interaction.type='form_submitted'`(suffix `-ed` 있음)를 ConversationThread 자동 push 트리거로 사용한다. 두 값이 같은 폼 제출 이벤트를 가리킨다면 레이어 간 명명 불일치다. `spec/conventions/node-output.md` §4.5의 실제 enum 값이 어느 쪽인지 확인 전까지 draft와 data model 중 어느 쪽이 오류인지 판단 불가.

- **제안**: `spec/conventions/node-output.md` §4.5의 `interaction.type` enum 정의를 확인하여 authoritative 값으로 통일한다. node-output spec이 `form_submitted`를 사용한다면 data model의 `interactionType` 설명을 동기화하고, `form_submit`를 사용한다면 draft §1.1·§1.4·§2.1을 수정한다.

---

### **[INFO] `spec/0-overview.md` §8 문서 맵 — ConversationThread 미등록**

- **target 위치**: Draft 신규 파일 `spec/conventions/conversation-thread.md`
- **충돌 대상**: `spec/0-overview.md` §8 문서 맵 정식 규약 행

- **상세**: overview §8의 문서 맵 테이블은 `spec/conventions/` 하위로 `node-output.md`만 예시로 명시되어 있다. `conversation-thread.md`가 신규 생성되면 이 테이블에 포함되지 않아 진입점이 불명확해진다. Critical은 아니지만 단일 진실 원칙상 overview가 새 conventions 문서를 가리켜야 한다.

- **제안**: spec 본문 반영 시 `spec/0-overview.md` §8 정식 규약 행에 `conversation-thread.md` 한 줄을 추가한다.

---

### **[INFO] `spec/1-data-model.md` — ConversationThread in-memory 설계 미반영**

- **target 위치**: Draft §4 영속화 ("v1 은 신규 DB 컬럼 도입 없음")
- **충돌 대상**: `spec/1-data-model.md` §2.14 NodeExecution

- **상세**: draft는 NodeExecution의 `output_data`(`output.interaction`, `output.messages`, `output.result.messages`)를 ConversationThread 재구성의 분산 SoT로 사용한다. 그러나 data model 현행 정의에는 이 관계가 기술되어 있지 않다. 구현자가 data model만 읽으면 재구성 방법을 파악하기 어렵다. 충돌은 아니지만 정보 공백이다.

- **제안**: spec 본문 반영 시 `spec/1-data-model.md` §2.14 NodeExecution 표 하단에 한 줄 cross-link를 추가한다. ("ConversationThread의 분산 SoT. 상세: [Spec Conversation Thread §4](…)")

---

### **[INFO] Execution History UI — ConversationThread 크로스노드 뷰 미정의**

- **target 위치**: Draft §7 WebSocket — `conversationThread` WS payload
- **충돌 대상**: `spec/2-navigation/14-execution-history.md` EH-DETAIL-06

- **상세**: 실행 내역 spec은 "AI Agent 노드는 대화 내역 + 메시지별 상세"를 노드 단위 Preview 탭으로 정의한다. ConversationThread는 워크플로 전체를 관통하는 크로스노드 뷰인데, 실행 이력 화면이 이를 어떻게 표시할지 draft에 기술이 없다. 현재 충돌은 없지만 v2 UI spec 착수 시 EH-DETAIL-06과 정합이 필요하다.

- **제안**: Draft Rationale 또는 §7 v2 로드맵에 "실행 이력 화면의 ConversationThread 전체 뷰는 v2 UI spec에서 EH-DETAIL-06과 함께 정의" 한 줄을 추가해 범위를 명시한다.

---

## 요약

제공된 spec 본문 범위 내에서 CRITICAL 충돌은 없다. 구조적으로 draft는 기존 실행 엔진·데이터 모델·WebSocket 프로토콜과 방향이 일치하며, Background 격리 원칙(PRD §4.11 ND-BG-05)과도 정합하다. 가장 주의해야 할 지점은 **`form_submit` vs `form_submitted` 명명 불일치(WARNING)**로, `spec/conventions/node-output.md` §4.5의 실제 enum 값을 확인하여 어느 쪽을 기준으로 통일할지 결정한 후 spec을 반영해야 한다. 나머지 세 항목은 모두 INFO 수준의 문서 갭이며, 구현 정확성에 영향을 미치지 않는다.

## 위험도

**LOW** — WARNING 1건(node-output.md §4.5 확인 후 해소 가능), CRITICAL 없음. `spec/conventions/node-output.md` 전문이 검토 컨텍스트에 포함되지 않아 WARNING을 확정하지 못했음을 명시한다.