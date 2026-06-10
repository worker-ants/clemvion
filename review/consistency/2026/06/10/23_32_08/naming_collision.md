## 발견사항

### [WARNING] `resumed` 식별자 — ack 필드(boolean) vs NodeExecution status enum vs 이벤트명의 3중 동명 혼재

- **target 신규 식별자**: `resumed` ack boolean 필드의 의미를 "재개 성공 여부" → "재개 시작 수락(enqueue) 여부"로 재정의 (`spec/5-system/6-websocket-protocol.md` §4.2 line 245)
- **기존 사용처**:
  - `spec/5-system/4-execution-engine.md` line 88, 101: `NodeHandlerOutput.status = "resumed"` — 사용자 메시지 수신 직후 1회 emit 되는 transient 상태 enum 값 (재개 처리 시작 의미)
  - `spec/5-system/6-websocket-protocol.md` line 169, 778: WS 서버→클라이언트 이벤트 `execution.resumed` — `waiting_for_input` 후 실행 재개를 나타내는 상태 이벤트
  - `spec/3-workflow-editor/3-execution.md` line 291: 동일 이벤트 참조
  - `spec/5-system/14-external-interaction-api.md` line 348, 361, 805: SSE 이벤트 `execution.resumed`
- **상세**: 동일 이름 `resumed` 가 세 개의 다른 맥락에서 사용된다. (A) 동기 ack payload 의 boolean 필드 (`resumed: true/false`) — target 이 의미를 재정의한 필드. (B) NodeHandlerOutput 의 status enum 값 `"resumed"` — 재개 처리 시작 transient 마커. (C) WS/SSE 이벤트명 `execution.resumed` — 재개 완료 신호. target 의 재정의 이후 ack `resumed: true` 는 "enqueue 수락"이고, 이벤트 `execution.resumed` 는 "최종 재개 성공 확인"이며, NodeHandlerOutput status `"resumed"` 는 "메시지 수신 transient tick"으로 세 가지가 모두 의미가 다르다. target 의 §4.2 NOTE(line 236)가 "ack 필드 `resumed` (boolean) 는 NodeExecution 의 재개 status enum `"resumed"` 와 이름만 같고 별개다"라고 명시하여 혼란을 인지하고 있으나, 클라이언트 개발자가 이 세 이름을 구분하지 못할 위험이 남는다.
- **제안**: 현재 spec 내 경고 NOTE 는 유지하되, §4.2 표 `resumed` 필드 설명에 "(이름이 같은 `execution.resumed` 이벤트 및 NodeHandlerOutput status `"resumed"` 와 별개)" 문구를 단 한 줄로 명시적으로 cross-reference 추가 권장. 필드 이름 자체 변경(예: `enqueued`) 은 wire 호환성 파괴가 크므로 spec 내 경고 보강으로 대응하는 것이 현실적이다.

---

### [INFO] `EXECUTION_CANCELLED` 대문자 표기 — WS 이벤트명과 에러코드 스타일 혼재 무관

- **target 신규 식별자**: `EXECUTION_CANCELLED` (엔진 §7.5 line 967, §Rationale line 1397 — 후행 이벤트를 지칭하는 표기)
- **기존 사용처**: WS 이벤트명 `execution.cancelled` (소문자 dot-notation, `spec/5-system/6-websocket-protocol.md` line 169; `spec/5-system/14-external-interaction-api.md` line 177, 812 등)
- **상세**: target 이 엔진 §7.5 본문에서 `EXECUTION_CANCELLED` (UPPER_SNAKE_CASE)로 표기한 것은 이벤트명이 아니라 "후행 이벤트를 가리키는 개념적 레퍼런스"로 사용된 것이며, 실제 wire 이벤트명은 여전히 `execution.cancelled` (소문자)이다. 두 표기가 같은 이벤트를 가리키지만 스타일이 다르다. 새로운 식별자를 도입한 것이 아니라 기술 스타일의 불일치이므로 실제 충돌은 아니나, 독자가 다른 이벤트로 오인할 가능성이 있다.
- **제안**: 엔진 §7.5 Rationale(line 1397) 및 본문 참조에서 `EXECUTION_CANCELLED` 를 `` `execution.cancelled` `` (wire 이벤트명 소문자 backtick)로 통일. 이미 line 967 에서 `execution.cancelled` 이벤트(`error.code = RESUME_*`)로 혼용 표기되어 있으므로 정리 범위는 작다.

---

## 요약

target(`plan/in-progress/spec-update-ws-resumed-ack.md`)이 도입하는 새 식별자는 없다 — spec 변경 대상은 기존 `resumed` boolean 필드의 의미 재정의와 엔진 §7.5 의 기술 정정이다. 요구사항 ID, 엔티티/타입명, API endpoint, 환경변수, 설정키, 파일 경로의 신규 도입은 없다. 주목할 만한 점은 `resumed` 라는 이름이 (a) 동기 ack boolean, (b) NodeHandlerOutput status enum, (c) WS/SSE 이벤트명으로 세 곳에서 이미 공존하고 있으며, target 의 의미 재정의 후 세 의미가 더 명확하게 갈라진다는 것이다 — 이는 신규 충돌이 아니라 기존 동명 혼재가 target 재정의로 부각된 것이다. target §4.2 NOTE 가 이를 일부 경고하나, 세 컨텍스트 모두를 명시적으로 구분하는 cross-reference 보강이 권장된다.

## 위험도

LOW
