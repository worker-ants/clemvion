# 신규 식별자 충돌 검토 결과

검토 대상: `plan/in-progress/spec-draft-chat-channel-template-render-outbound.md`
검토 일시: 2026-05-25
검토 모드: spec draft (--spec)

---

## 발견사항

### 1. [WARNING] 영향 평가 섹션의 `renderPresentationNode` 스테일 참조

- **target 신규 식별자**: `renderPresentationNode` (함수명)
- **기존 사용처**: target 문서 자체의 §결정1 / R-CCA-7 / 일관성 Round 2 C-6 해소 결과에서 기각된 이름. `spec/conventions/chat-channel-adapter.md §1.1` 에는 현재 6함수 인터페이스 정의.
- **상세**: target 의 "## 영향 평가" 섹션 (라인 206) 에 `새 함수 renderPresentationNode 추가 — Telegram/Slack/Discord adapter 모두 구현 의무` 라는 문구가 남아 있다. 그런데 결정1 / Round 2 C-6 해소 / R-CCA-7 은 모두 `renderPresentationNode` 신설을 **기각**하고 `renderNode` union 확장 (6함수 유지) 을 채택했다. "영향 평가" 섹션이 revision 2 기준 (7함수 신설 방침) 에서 갱신되지 않고 stale 상태로 남아 있어, 동일 문서 안에서 결정 본문과 영향 평가가 모순된 함수명을 각각 기술한다. spec 을 본 문서에서 그대로 반영할 경우 구현자가 어느 것이 최종 결정인지 혼동할 위험이 있다.
- **제안**: "## 영향 평가" 섹션의 `새 함수 renderPresentationNode 추가 — Telegram/Slack/Discord adapter 모두 구현 의무` 줄을 `renderNode 시그니처 union 확장 (EiaEvent | ChatChannelInternalEvent) — 6함수 유지. provider 어댑터의 renderNode 구현 내부에 ChatChannelInternalEvent 분기 추가` 로 교체. 이렇게 하면 결정1·R-CCA-7·Round 2 C-6 해소와 일관된다.

---

### 2. [INFO] `CCH-AD-07` — 기존 `CCH-AD-06` 다음 번호 (순번 정합 확인)

- **target 신규 식별자**: `CCH-AD-07`
- **기존 사용처**: `spec/5-system/15-chat-channel.md §3.1` 에 `CCH-AD-01`~`CCH-AD-06` 이 순서대로 존재. `CCH-AD-06` 은 인터랙션 응답 in-process 직접 호출. `CCH-AD-07` 은 기존에 없음.
- **상세**: Round 1 C-1 에서 초안의 `CCH-AD-06` 충돌을 발견해 `CCH-AD-07` 로 교체했고 해소 확인됨. 번호 연속성 문제는 없다. 다만 `CCH-AD-06` 이 이미 인터랙션 응답 in-process 호출을 정의하고 있으므로 `CCH-AD-07` 은 라이프사이클 섹션에 추가될 일곱 번째 항목으로 정합하다.
- **제안**: 충돌 없음. 이미 해소 확인. 참고 수준.

---

### 3. [INFO] `CCH-MP-06` — 기존 `CCH-MP-05` 다음 번호 (순번 정합 확인)

- **target 신규 식별자**: `CCH-MP-06`
- **기존 사용처**: `spec/5-system/15-chat-channel.md §3.3` 에 `CCH-MP-01`~`CCH-MP-05` 존재. `CCH-MP-06` 은 기존에 없음.
- **상세**: 충돌 없음. `CCH-MP-05` 다음 번호이며 비-blocking presentation 발화를 신규 정의하는 용도.
- **제안**: 충돌 없음. 참고 수준.

---

### 4. [INFO] `R-CCA-7` — 기존 R-CCA-6 다음 번호 (순번 정합 확인)

- **target 신규 식별자**: `R-CCA-7`
- **기존 사용처**: `spec/conventions/chat-channel-adapter.md Rationale` 에 `R-CCA-5`, `R-CCA-6` 존재. `R-CCA-7` 은 없음.
- **상세**: 충돌 없음. `R-CCA-6` 다음 번호이며 `renderNode` union 확장 근거를 기술하는 용도.
- **제안**: 충돌 없음. 참고 수준.

---

### 5. [INFO] `R-CC-13` 보강 — 기존 ID 에 1행 추가

- **target 신규 식별자**: `R-CC-13` (기존 항목에 1줄 보강)
- **기존 사용처**: `spec/5-system/15-chat-channel.md` Rationale 에 `R-CC-13` 이 이미 존재 (Discord v1 의 CCH-MP-01 부분 유예 — Interactions Webhook only 의 결과, 2026-05-24).
- **상세**: target 은 기존 `R-CC-13` 을 신설하는 것이 아니라 마지막에 1행만 보강한다. ID 충돌이 아니라 기존 항목 확장이므로 식별자 수준 충돌은 없다.
- **제안**: 충돌 없음. 참고 수준.

---

### 6. [INFO] `ChatChannelInternalEvent` 타입명 — 기존 사용처 부재 확인

- **target 신규 식별자**: `ChatChannelInternalEvent` (TypeScript 타입)
- **기존 사용처**: spec 전체 및 codebase 검색 결과 동일 이름 없음. `EiaEvent` 는 `spec/conventions/chat-channel-adapter.md §1.2` 에 단일 사용.
- **상세**: 충돌 없음. 새 타입명이 기존 어느 파일에서도 다른 의미로 사용되지 않는다.
- **제안**: 충돌 없음. 참고 수준.

---

### 7. [INFO] `execution.node.completed` 이벤트명 — 기존 WS 디버깅 이벤트와 동일, 용도 구분 명확

- **target 신규 식별자**: `execution.node.completed` (ChatChannelInternalEvent 의 type 값)
- **기존 사용처**: `spec/5-system/6-websocket-protocol.md §4.4` (라인 89, 184, 187, 709) 과 `spec/5-system/14-external-interaction-api.md §5` (라인 347, 752) 에서 WS 디버깅 이벤트 / SSE 이벤트로 이미 사용 중. 실행 엔진 spec (`spec/5-system/4-execution-engine.md:1125`) 에서도 same name 언급.
- **상세**: 동일 이름이 WS/SSE 에서 이미 디버깅 이벤트로 정의되어 있고, target 은 이것을 `ChatChannelInternalEvent` 의 `type` 값으로 그대로 재사용한다. target 의 결정1 본문 (라인 61) 도 `WebsocketService.executionEvents$ Subject` 를 구독 소스로 명시하므로, 이 이벤트는 동일 Subject 의 같은 스트림에서 픽업하는 것이 의도다. 즉 새로 이름을 만드는 것이 아니라 기존 이벤트를 chat-channel-internal 용도로 consume 하는 것. 충돌이 아니며 의도된 재사용. 단 `ChatChannelInternalEvent` 타입 정의 안에서 이 이름이 "WS 디버깅 이벤트 == chat-channel-internal 구독 이벤트" 임을 주석으로 명시하면 후행 독자 혼동을 방지할 수 있다.
- **제안**: 충돌 없음. §1.3 `ChatChannelInternalEvent` 정의 블록에 `// SoT: WS §4.4 execution.node.completed — same event, consumed as chat-channel-internal` 형태의 주석 추가 권장 (spec 본문 반영 시).

---

### 8. [INFO] `EiaAiMessageEvent` 에 `presentations?` 필드 추가 — 기존 타입에 신규 필드

- **target 신규 식별자**: `EiaAiMessageEvent.presentations?: PresentationPayload[]` (기존 union variant 에 필드 추가)
- **기존 사용처**: `PresentationPayload` 타입 자체는 `spec/4-nodes/3-ai/1-ai-agent.md §7.10` 이 단일 진실. `spec/5-system/14-external-interaction-api.md §6.5` (라인 536) 에서도 동일 필드명 `presentations?` 이 이미 언급되어 있다. `spec/conventions/chat-channel-adapter.md §1.2` 의 기존 `execution.ai_message` variant 에는 현재 `presentations?` 필드 없음.
- **상세**: target 이 기존 `EiaEvent` 의 `execution.ai_message` variant 에 `presentations?: PresentationPayload[]` 를 추가하는 것은 EIA §6.5 가 이미 약속한 필드를 chat-channel 어댑터 타입에 반영하는 catch-up. EIA §6.5 와 WS §4.4 모두 동일 필드명을 사용하므로 충돌 없음. 타입 정의 확장이지 식별자 재정의가 아니다.
- **제안**: 충돌 없음. 참고 수준.

---

## 요약

target 문서가 도입하는 신규 식별자 (`CCH-AD-07`, `CCH-MP-06`, `ChatChannelInternalEvent`, `R-CCA-7`, R-CC-13 보강, `EiaAiMessageEvent.presentations?`) 는 모두 기존 ID 공간과 충돌하지 않는다. `execution.node.completed` 이벤트명은 기존 WS/SSE 디버깅 이벤트와 동일하지만 의도된 재사용이며 경로(구독 소스)도 동일하여 의미 충돌이 없다. 단, "## 영향 평가" 섹션에 `renderPresentationNode` 함수명이 스테일하게 남아 있어, 동일 문서 내에서 결정 본문(기각·6함수 유지)과 영향 평가(7함수 신설)가 모순된다. 이 스테일 참조는 WARNING 수준의 내부 일관성 문제로, spec 본문 반영 전에 수정이 필요하다.

---

## 위험도

LOW
