# Rationale 연속성 검토 결과

검토 범위: `spec/5-system/` (diff against origin/main, --impl-done 모드)
변경 파일: `spec/5-system/15-chat-channel.md`

---

### 발견사항

- **[INFO]** `401 WORKSPACE_REQUIRED` → `400 WORKSPACE_ID_REQUIRED` 변경 — 기존 결정 번복 아님, canonical 코드와 정합
  - target 위치: `/spec/5-system/15-chat-channel.md` §5.2 에러 응답 표 (rotate-bot-token endpoint)
  - 과거 결정 출처: `spec/5-system/3-error-handling.md §1.3` — `WORKSPACE_ID_REQUIRED` (400) 를 `@WorkspaceId()` 데코레이터의 canonical 에러코드로 명시. Rationale 기재 없으나 본 변경은 그 canonical 에 맞춰 오류가 있던 이전 항목(`401 WORKSPACE_REQUIRED`)을 수정한 것.
  - 상세: 이전 spec 은 `401 WORKSPACE_REQUIRED` (controller 인라인 throw 기반) 로 기술했고, 공용 `@WorkspaceId()` 데코레이터로 이관된 실제 구현은 `400 WORKSPACE_ID_REQUIRED` 를 발행한다. 변경은 기각된 대안을 재도입하거나 합의 원칙을 위반하지 않으며, 구현 현실에 맞는 문서 동기화다. 다만 이 변경에 대한 Rationale 항이 없어 "왜 401 → 400 으로 바뀌었나"의 맥락이 문서에 남지 않았다.
  - 제안: `15-chat-channel.md` Rationale 에 간단한 주석("옛 `401 WORKSPACE_REQUIRED` 는 controller 인라인 코드였으며, 공용 `@WorkspaceId()` 데코레이터 이관 후 `3-error-handling.md §1.3` canonical `400 WORKSPACE_ID_REQUIRED` 로 통일됨")을 추가하면 후속 검토자가 번복으로 오인하지 않는다.

- **[INFO]** Rationale R-CC-16 본문의 `EiaAiMessageEvent` → `EiaEvent` 의 `execution.ai_message` variant 로 표기 수정 — 기각된 대안 재도입 없음
  - target 위치: `/spec/5-system/15-chat-channel.md` Rationale R-CC-16 두 번째 항목 (line ~654)
  - 과거 결정 출처: `spec/conventions/chat-channel-adapter.md §1.2 EiaEvent 입력` 및 `R3 "EiaEvent 를 별 타입으로 정의하지 않고 EIA spec 위임"` — EIA §6 5종 union 을 `EiaEvent` 라는 단일 타입으로 재사용하고 별도 named variant 타입(`EiaAiMessageEvent` 등)을 신설하지 않는다는 원칙이 확립돼 있다.
  - 상세: 변경 전 본문의 `EiaAiMessageEvent` 는 실제 정의되지 않은 타입 이름이었으며, 올바른 표기인 `EiaEvent` 의 `execution.ai_message` variant 로 수정됐다. 이는 기존 `R3` 원칙(별 타입 정의 없이 EIA spec 위임)과 완전히 정합하며 기각된 대안의 재도입이 아니다. 순수한 오탈자 교정으로 볼 수 있다.
  - 제안: 없음. 변경이 올바르다.

- **[INFO]** `botIdentity` 예제에 `teamId?: string` 필드 추가 — 기존 Rationale 와 충돌 없음
  - target 위치: `/spec/5-system/15-chat-channel.md` §3.1 config.chatChannel JSONB 예제 (botIdentity 객체)
  - 과거 결정 출처: `spec/conventions/chat-channel-adapter.md §2.3` — `botIdentity?: { botId: number; username: string; teamId?: string }` 로 이미 optional `teamId` 가 포함돼 있으며, "workspace/team 개념 있는 provider(Slack 등) 한정" 이라는 주석도 convention 에 있다.
  - 상세: 변경은 `chat-channel-adapter.md §2.3` 의 기존 타입 정의를 예제에 반영한 것으로, 신규 필드 추가가 아니라 기존 타입과 예제의 동기화다. `botIdentity` 는 "read-only after creation" 원칙(초기 setupChannel 결과 캐시)을 유지하며 변경되지 않았다.
  - 제안: 없음.

---

### 요약

이번 `spec/5-system/15-chat-channel.md` diff(3 hunk)는 모두 기존 Rationale 에서 명시적으로 기각된 대안의 재도입이나 합의 원칙 위반에 해당하지 않는다. (1) `WORKSPACE_ID_REQUIRED` 로의 에러코드 정정은 `3-error-handling.md §1.3` canonical 에 맞춘 구현-문서 동기화이며, (2) Rationale R-CC-16 의 `EiaAiMessageEvent` 표기 수정은 `chat-channel-adapter.md R3` 원칙("EiaEvent 를 별 타입으로 정의하지 않고 EIA spec 위임")에 정합하는 오탈자 교정이고, (3) `botIdentity.teamId` 추가는 이미 convention spec 에 정의된 타입을 예제에 반영한 것이다. 단, (1) 변경에 대해 Rationale 설명이 부재해 "401→400 변경이 왜 이루어졌나"가 후속 검토자에게 불명확할 수 있으므로, 간단한 Rationale 주석 추가를 권고한다.

### 위험도

NONE

---

STATUS: SUCCESS
