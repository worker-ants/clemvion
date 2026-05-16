# Cross-Spec 일관성 검토

**대상**: `plan/in-progress/spec-draft-ai-thread-source-mark.md`
**검토일**: 2026-05-16
**모드**: spec draft 검토 (--spec)

---

### 발견사항

- **[INFO]** `execution.waiting_for_input` 기존 JSON 예시에 system 메시지 포함 — 명시적 정합화 범위 확인 필요
  - target 위치: §1-B (변경 대상 1-B: `conversationConfig.messages` JSON 예시 수정)
  - 충돌 대상: `spec/5-system/6-websocket-protocol.md` §4.4 "AI Agent Multi Turn 노드" JSON 예시 (`{ "role": "system", "content": "..." }`)
  - 상세: 기존 WebSocket spec §4.4의 `conversationConfig.messages` 예시에는 `{ "role": "system", ... }` 항목이 포함돼 있다. target draft §1-B는 이를 system 없는 형태로 교체하고 각 항목에 `source` 마커를 추가한다. draft 주석에서 "기존 예시는 system 메시지를 포함하고 있었으나 emit 페이로드에는 system이 나타나지 않는다"고 설명하며 이를 의도적 정합화로 기술하고 있다. 변경 자체는 올바르지만, 해당 예시 변경이 `spec/5-system/6-websocket-protocol.md`의 **§4.4 테이블** ("messages 필드: system을 제외한 user / assistant / tool 메시지 권위 스냅샷") 과는 이미 일치하므로 실질적 충돌은 아니다. 다만 기존 JSON 예시만 spec 텍스트와 불일치했던 것으로, target이 올바르게 수정하는 방향이다.
  - 제안: 확인 불필요. target §1-B가 기존 예시의 버그를 교정하는 것이므로 그대로 채택.

- **[INFO]** `execution.ai_message` 이벤트 표 요약 행이 draft 변경 후 `spec/3-workflow-editor/3-execution.md` §8과 미동기화 가능성
  - target 위치: §1-A (변경 대상 1-A: §4.1 표의 `execution.ai_message` 행 수정)
  - 충돌 대상: `spec/3-workflow-editor/3-execution.md` §8 (line 267: `| execution.ai_message | executionId, nodeId, message, turnCount, messages | ...`)
  - 상세: `spec/3-workflow-editor/3-execution.md` §8 이벤트 목록 표에도 `execution.ai_message` 의 payload 필드 목록이 간략히 열거돼 있다. target draft는 `spec/5-system/6-websocket-protocol.md`의 §4.1 표 설명에 `source: 'live' | 'injected'` 마커 문구를 추가하지만, `3-execution.md`의 해당 행은 payload 필드를 열거하는 방식이라 `source` 언급이 없어도 불일치로 보이지는 않는다. 단, 두 문서가 같은 이벤트를 각자 서술하므로 향후 추가 필드 도입 시 양쪽 모두 갱신해야 하는 동기화 부담이 있다.
  - 제안: 즉각 수정 불필요. 다만 spec 반영 시 `spec/3-workflow-editor/3-execution.md` §8의 `execution.ai_message` 행 설명에도 `messages[].source` 마커 언급을 짧게 추가하면 동기화 품질이 올라간다. INFO 수준 권장 사항.

- **[WARNING]** `messages[].source` 필드가 `ConversationTurn.source` (5값 enum) 와 다른 이름·의미로 동일 도메인에서 공존
  - target 위치: §1-C·§1-E (변경 대상 1-C·1-E: `messages[].source` 필드 정의)
  - 충돌 대상: `spec/conventions/conversation-thread.md` §1.1 `ConversationTurnSource` enum (`presentation_user` / `ai_user` / `ai_assistant` / `ai_tool` / `system`)
  - 상세: `ConversationTurn.source`는 5값 enum으로 메시지 발생원을 세분화한다. target draft가 도입하는 `messages[].source`는 같은 "source" 키에 2값(`'live' | 'injected'`)을 사용한다. 두 `source` 필드는 서로 다른 레이어(Thread turn vs WebSocket 페이로드 message item)에 위치하지만 이름이 동일하다. 이 자체가 API 계약 충돌은 아니지만, 프론트엔드 개발자가 `turn.source` 와 `message.source` 를 혼동할 위험이 있다. draft §1-E의 정의에도 이 두 계층의 차이가 명시적으로 서술되지 않는다.
  - 제안: §4.4.6 신규 절에 "이 `source` 필드는 `ConversationTurn.source`(Conversation Thread §1.1)와는 다른 레이어의 2값 구분이다" 라는 명시적 구분 문구를 한 줄 추가. 또는 필드명을 `origin`으로 변경하여 혼동을 구조적으로 방지하는 안도 검토 가능.

- **[INFO]** `spec/conventions/conversation-thread.md` §5.1 보강 문단이 역참조하는 §4.4.6 섹션 ID가 현재 WebSocket spec에 존재하지 않음
  - target 위치: §2-A (변경 대상 2-A: §5.1 아래 보강 문단 추가)
  - 충돌 대상: `spec/5-system/6-websocket-protocol.md` (§4.4.6 미존재)
  - 상세: draft §2-A에서 conversation-thread.md §5.1 아래에 추가되는 문단이 `[Spec WebSocket Protocol §4.4.6](../5-system/6-websocket-protocol.md#446-messagessource-마커)` 를 링크로 참조한다. §4.4.6은 target draft §1-E에 의해 신규로 추가될 절이므로, draft §1-E와 §2-A 두 변경이 **반드시 함께** 적용돼야 링크가 유효하다. 부분 적용 시 dangling 링크가 발생한다.
  - 제안: §1-E와 §2-A 를 단일 커밋/적용 단위로 묶어 원자적으로 반영한다. spec 반영 PR에 두 파일 모두 포함되도록 명시.

- **[INFO]** `spec/conventions/conversation-thread.md` §9 CHANGELOG 신규 항목 기술이 §5.1과의 관계를 "정합화"로 설명하나, §5.1 자체는 기존에 `source` 마커를 언급하지 않았음
  - target 위치: §2-B (변경 대상 2-B: CHANGELOG 신규 항목)
  - 충돌 대상: `spec/conventions/conversation-thread.md` §5.1 (현행)
  - 상세: CHANGELOG 문구는 "injection 산출 메시지가 WebSocket emit 시 `source: 'injected'` 마커를 동봉하도록 정합화 (§5.1)" 로 기재된다. 그러나 현행 §5.1은 messages 모드 매핑 표만 있고 emit 페이로드의 `source` 마커를 아예 정의하지 않았다. 따라서 CHANGELOG 표현은 "기존 §5.1과의 정합화"가 아니라 "§5.1에 신규 내용 추가"에 가깝다. 용어 선택이 혼란을 줄 수 있다.
  - 제안: CHANGELOG 문구를 "injection 산출 메시지에 `source: 'injected'` 마커 도입 — §5.1 에 emit 레이어 연계 설명 추가" 로 수정.

- **[INFO]** `변경하지 않는 부분` 절의 `output.messages` DB 영속 관련 결정 미확정이 향후 구현 ambiguity 유발 가능성
  - target 위치: §변경하지 않는 부분 (마지막 bullet: "`messages[].source`가 `output.messages` (DB 영속)에도 함께 들어갈지는 backend 구현 phase의 결정 사항으로 둔다")
  - 충돌 대상: `spec/1-data-model.md` §2.14 NodeExecution.output_data JSONB / `spec/conventions/conversation-thread.md` §4 영속화 ("`output.messages` (AI 멀티턴 누적)가 SoT")
  - 상세: conversation-thread.md §4는 `output.messages`를 "AI 멀티턴 누적의 SoT"로 명시한다. target draft는 `messages[].source` 필드를 DB 영속 여부 미결로 두는데, 만약 persist되지 않으면 실행 이력 화면에서 `source` 마커를 재구성할 수 없어 과거 대화의 turn 카운팅이 실행 이력 조회 시 여전히 깨진 상태가 된다. 실시간 디버깅(live)은 WebSocket emit으로 해소되지만 이력 조회(post-hoc)는 미해소 상태.
  - 제안: spec에서 "권장하지만 강제는 아님"으로 유지하더라도, 실행 이력 화면의 turn 카운팅 정합성 요건(spec/3-workflow-editor/3-execution.md의 Response/Request/LLM Usage 탭 매칭)과의 관계를 Rationale에 명시하고, 구현 phase에서 선택지 중 어느 것을 택하는지 결정 후 spec에 반영하도록 follow-up을 기록하는 것이 권장된다.

---

### 요약

target draft가 도입하는 `messages[].source: 'live' | 'injected'` 마커는 기존 spec 어느 영역과도 직접 모순되지 않는다. 수정 대상인 두 파일(`spec/5-system/6-websocket-protocol.md`, `spec/conventions/conversation-thread.md`)의 현행 정의와 논리적으로 호환되며, 기존 `ConversationTurnSource` 5값 enum(Conversation Thread §1.1)과는 서로 다른 레이어에 위치하여 실질적 계약 충돌이 없다. 다만 두 레이어 모두 `source`라는 동일 키를 사용해 소비자 혼동을 유발할 수 있으므로 §4.4.6에 계층 구분 문구를 추가하는 것이 권장된다. §1-E와 §2-A의 상호 참조 링크는 두 변경이 원자적으로 함께 적용되어야 유효하다. CHANGELOG 문구는 "정합화"보다 "신규 추가" 표현이 사실에 가깝다. DB 영속 결정 미확정은 실행 이력 화면의 이력 조회 시나리오에서 해소되지 않는 잠재 문제로 남으므로, spec에 follow-up 결정 필요 사항으로 명시할 것을 권장한다.

---

### 위험도

LOW
