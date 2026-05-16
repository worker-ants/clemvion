# 신규 식별자 충돌 검토 — AI 대화 메시지 source 마커

검토 대상: `plan/in-progress/spec-draft-ai-thread-source-mark.md`
변경 문서: `spec/5-system/6-websocket-protocol.md`, `spec/conventions/conversation-thread.md`

---

## 발견사항

### [WARNING] `messages[].source` 필드명이 `ConversationTurn.source` 와 동일하되 타입·값집합이 다름

- **target 신규 식별자**: `messages[].source: 'live' | 'injected'` — WebSocket 페이로드의 각 메시지 항목에 추가되는 2값 enum 마커 (`spec/5-system/6-websocket-protocol.md §4.4.6`)
- **기존 사용처**: `spec/conventions/conversation-thread.md §1.2 ConversationTurn.source` — `ConversationTurnSource` 타입, 5값 (`presentation_user` / `ai_user` / `ai_assistant` / `ai_tool` / `system`). 동일 필드명 `source` 가 이미 `ConversationTurn` 객체에서 사용 중
- **상세**: 두 `source` 필드는 서로 다른 객체 계층에 위치하므로 직접 충돌(동일 객체에서 이름 겹침)은 없다. 그러나 이름이 동일하고 의미도 유사("메시지 발신 출처")하여 개발자가 혼동할 수 있다. 특히 다음 경우에 혼란 위험이 높다:
  - `conversation-thread.md §5.1 messages 모드 매핑` 표에서 `turn.source` (5값 ConversationTurnSource) 를 `role` 로 변환하는 매핑이 정의되어 있는데, target 이 §2-A 에서 추가하는 보강 문단에도 "messages 배열에 prepend 된 모든 항목은 emit 시 `source: 'injected'`" 라고 기술한다. 동일 절(`§5.1`)에 두 종류의 `source` 개념이 공존하게 된다 — `turn.source`(ConversationTurnSource, 5값)와 `messages[].source`(payload 마커, 2값).
  - `plan/in-progress/ai-thread-source-mark.md §Phase 2` 에서도 `RawMessage` 타입에 `source?: 'live' | 'injected'` 를 추가한다고 명시하는데, frontend 코드베이스에 이미 turn.source (5값) 를 다루는 코드가 존재할 경우 타입 혼용 위험이 있다.
- **제안**: target 이 `messages[].source` 라는 이름 자체를 바꿀 필요는 없으나, `spec/5-system/6-websocket-protocol.md §4.4.6` 서두와 `conversation-thread.md §2-A` 보강 문단에 다음 한 문장을 명시적으로 추가할 것을 권장한다: "이 `source` 마커는 `ConversationTurnSource` (5값 내부 enum)와 별개의 필드이며, WebSocket 페이로드 전용 2값 표식이다." 또는 타입 정의 시 별칭 `MessageOriginMarker = 'live' | 'injected'` 를 spec 에 명시해 코드 타입 시그니처와 연계하면 혼동을 방지할 수 있다.

---

### [INFO] `§4.4.6` 절 번호 신설 — 기존 절 체계 점검 권장

- **target 신규 식별자**: `spec/5-system/6-websocket-protocol.md §4.4.6`
- **기존 사용처**: 코퍼스에서 확인된 기존 절 번호는 `§4.1`, `§4.4`(상위 절). `§4.4.6` 이 신설되기 전 `§4.4.1`~`§4.4.5` 가 이미 존재하는지 코퍼스에서 확인되지 않음. 프롬프트 파일에 WebSocket spec 본문이 제한적으로 포함되어 있어 §4.4 하위절 현황 파악 불가.
- **상세**: 신규 하위절 `§4.4.6` 이 기존에 없는 번호라면 문제없다. 그러나 기존에 §4.4.1~§4.4.5 가 있는데 target 이 이를 누락하고 §4.4.6 을 곧바로 추가한다면 절 번호가 단절된다. 코퍼스에 포함된 WebSocket spec 본문은 §4.1 요약 표와 §4.4 일부 예시만 포함되어 단절 여부를 최종 확인할 수 없다.
- **제안**: `spec/5-system/6-websocket-protocol.md` 를 직접 열어 §4.4 하위절이 §4.4.1~§4.4.5 로 이미 정의되어 있는지 확인 후, 다음 번호(§4.4.6)가 순서상 정합한지 검증할 것.

---

### [INFO] `live` / `injected` 값 이름 — 기존 내부 용어와 관계 명시 필요

- **target 신규 식별자**: `'live'`, `'injected'` — `messages[].source` 의 두 리터럴 값
- **기존 사용처**: 코퍼스에서 `injected` 는 `conversation-thread.md §5.1` 및 `§5 AI Agent 자동 주입` 섹션 전반에 걸쳐 동사·명사로 빈번히 사용된다 ("주입", "injectedThread", "inject"). `live` 는 기존 spec 에서 독립 식별자로 쓰이지 않는다.
- **상세**: `injected` 라는 값이 `ConversationThread` 자동 주입 경로와 명시적 `$thread` 사용 경로를 모두 동일하게 `'injected'` 로 표현한다. 이는 의도적으로 단순화한 것이지만, 기존 `turn.source = 'ai_user' | 'ai_assistant'` 등의 세분화와 다른 추상 수준을 가진다. `spec/5-system/6-websocket-protocol.md §4.4.6` 의 `injected` 정의 내에 이미 적절한 설명이 포함되어 있어 크리티컬한 충돌은 없다.
- **제안**: `§4.4.6` 에 "이 2값 마커는 `ConversationTurnSource` 의 5값 분류를 emit 레이어에서 frontend 소비 최소화 목적으로 축약한 것이다" 라는 명시가 target 의 Rationale 에 이미 포함되어 있어 충분하다. 추가 조치는 선택 사항.

---

## 요약

target 이 도입하는 신규 식별자(`messages[].source: 'live' | 'injected'`, `§4.4.6` 절)는 기존 코퍼스에서 동일 식별자가 완전히 다른 의미로 사용되는 CRITICAL 충돌은 없다. 다만 `ConversationTurn.source` (conversation-thread.md §1.2, 5값 ConversationTurnSource)와 `messages[].source` (WebSocket 페이로드, 2값 마커)가 동일 필드명 `source` 를 서로 다른 객체에서 다른 타입으로 사용하므로, 동일 절(`conversation-thread.md §5.1`)에 두 개념이 공존하게 된다. 개발자 혼동을 방지하기 위해 spec 본문에 두 `source` 의 상이한 의미를 명시하는 한 문장 보강을 권장한다. 요구사항 ID 충돌, API endpoint 충돌, 이벤트명 충돌, 환경변수 충돌, 파일 경로 충돌은 발견되지 않았다.

---

## 위험도

LOW
