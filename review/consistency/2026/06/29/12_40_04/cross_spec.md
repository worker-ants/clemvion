# Cross-Spec 일관성 검토 결과

대상: `spec/4-nodes/7-trigger/providers/slack.md`

---

## 발견사항

### 1. INFO: `parseUpdate` pure 계약 vs `file_shared` enrichment 패턴 — 문서 내 자체 해소
- **target 위치**: `spec/4-nodes/7-trigger/providers/slack.md §4.1` (Events API `file_shared` 행) + R-S-7
- **충돌 대상**: `spec/conventions/chat-channel-adapter.md §1.1` (`parseUpdate`: "DB 미접근, 외부 API 미호출. Side-effect free")
- **상세**: target 은 `file_shared` 이벤트 시 `parseUpdate` 가 `mimeType: "application/octet-stream"` placeholder 를 동기 반환하고 HooksService 가 후속으로 `files.info` 를 호출해 보강한다고 기술한다. 이는 `parseUpdate` 자체가 외부 호출을 하지 않고 caller 에게 위임하므로 Convention §1.1 의 pure 계약과 실제로 충돌하지 않는다. R-S-7 이 이 패턴을 명시적으로 근거와 함께 설명하므로 자체 해소됨.
- **제안**: 현행 유지. 충돌 없음.

### 2. INFO: `botIdentity.botId` 타입 `number` — `hashStringToInt` 변환 근거 inline 기술 확인
- **target 위치**: `spec/4-nodes/7-trigger/providers/slack.md §3.1`
- **충돌 대상**: `spec/conventions/chat-channel-adapter.md §2.3 ChatChannelConfig` (`botIdentity?: { botId: number; ... }`)
- **상세**: Convention §2.3 은 `botId: number` 를 SoT 로 정의. Slack 의 `user_id`/`bot_id` 는 문자열(`U…`/`B…`)이므로 target 은 `hashStringToInt` 로 deterministic int 변환을 사용함을 §3.1 에 설명한다. Convention 의 `number` 타입 정의와 모순 없이 정합한다 — Slack 어댑터가 변환 책임을 진다는 것이 명시되어 있음.
- **제안**: 현행 유지. 충돌 없음.

### 3. INFO: `200 OK` 예외 (URL Verification / Interactivity ack) — §5.5 및 §5.5.1 반영 완료 확인
- **target 위치**: `spec/4-nodes/7-trigger/providers/slack.md §3.1`, §6 "Slack 특이 예외", R-S-8
- **충돌 대상**: `spec/5-system/15-chat-channel.md §5.5` Inbound HTTP Contract (`202 Accepted` 고정 정책) + R-CC-12
- **상세**: Chat Channel spec §5.5 는 `202 Accepted` 를 기본 정책으로 삼으나, target 이 명시한 두 예외(URL Verification: `200 OK + { challenge }`, Interactivity ack: `200 OK`)는 이미 §5.5 케이스 표 (line 418–419) 와 §5.5.1 Provider-specific 응답 예외 정책에 반영 완료라고 R-S-8 이 명시한다. 실제로 `spec/5-system/15-chat-channel.md` grep 결과도 line 418–419 에 두 예외 행이 존재함을 확인.
- **제안**: 현행 유지. 이미 상호 참조·반영 완료.

### 4. INFO: `inboundSigningRef` 단일 슬롯 — Convention·secret-store 정합 확인
- **target 위치**: `spec/4-nodes/7-trigger/providers/slack.md §6`, R-S-1
- **충돌 대상**: `spec/conventions/chat-channel-adapter.md §2.3 ChatChannelConfig`, `spec/conventions/secret-store.md §1`
- **상세**: target 은 Slack signing secret 을 `secret://triggers/{id}/inbound-signing` ref 슬롯에 보관한다고 기술. Convention §2.3 (`inboundSigningRef?: string`) 과 secret-store.md §1 (`triggers/{triggerId}/inbound-signing` 슬롯 명시)이 동일 슬롯을 정의한다. provider 별 발급 주체·검증 알고리즘 차이는 backend provider 분기로 흡수한다는 R-S-1 의 설명이 Convention §2.3 Rationale 과 일치.
- **제안**: 현행 유지. 충돌 없음.

### 5. INFO: `text_only` normalize 위치 — Convention §2.3 와 정합
- **target 위치**: `spec/4-nodes/7-trigger/providers/slack.md §5.4` ("legacy `text_only` 처리")
- **충돌 대상**: `spec/conventions/chat-channel-adapter.md §2.3 ChatChannelConfig` (`visualNode` 필드 comment: "DB 에 저장된 legacy 'text_only' 값은 어댑터가 read-time 에 'text' 로 normalize")
- **상세**: target 의 "어댑터가 입력 단계에서 `visualNode === "text_only"` 를 `"text"` 로 read-time normalize" 는 Convention §2.3 의 동일 정책과 완전 일치. Telegram spec 도 "동일" 이라 기술하므로 provider 간 정합.
- **제안**: 현행 유지. 충돌 없음.

### 6. INFO: `CCH-MP-04` 섹션 번호 표기 — §5.5 (Typing) 가 동일 번호 사용
- **target 위치**: `spec/4-nodes/7-trigger/providers/slack.md §5.5` 헤더 (`CCH-MP-04 - typing 등가`)
- **충돌 대상**: `spec/4-nodes/7-trigger/providers/slack.md §5.4` 헤더 (`CCH-MP-04`) — 같은 문서 내 §5.4 와 §5.5 가 모두 CCH-MP-04 를 참조
- **상세**: Carousel/Chart/Table (§5.4) 과 Typing (§5.5) 이 같은 요구사항 ID `CCH-MP-04` 를 참조하고 있다. Spec Chat Channel 원본에서 CCH-MP-04 가 이 두 영역을 포괄하는 의도로 부여된 것으로 보이나, 하나의 ID 가 두 섹션을 가리키면 추적 혼란이 생길 수 있다. 다른 spec 에서 다른 의미로 이미 사용 중이지는 않으므로 CRITICAL 은 아님.
- **제안**: 문서 정합성 차원에서 Typing 섹션의 ID 표기를 "CCH-MP-04 (typing sub-case)" 등으로 구분하거나, 원본 Chat Channel spec 에서 Typing 을 CCH-MP-05 로 분리 부여하는 것을 검토.

---

## 요약

`spec/4-nodes/7-trigger/providers/slack.md` 는 기존 spec 영역(Chat Channel, Convention Chat Channel Adapter, Convention Secret Store, Data Model)과 전반적으로 높은 정합성을 보인다. `parseUpdate` pure 계약·`botIdentity.botId: number` 타입·`200 OK` 예외 정책·`inboundSigningRef` 단일 슬롯·`text_only` normalize 등 주요 cross-cutting 사안이 모두 상위 Convention 및 System spec 과 일치하거나 명시적 근거(R-S-*)로 해소되어 있다. 발견된 항목들은 모두 INFO 수준이며, 하나(§5.5 CCH-MP-04 중복 참조)는 동일 문서 내부 번호 명료화 권장 사항에 해당한다. CRITICAL 또는 WARNING 충돌은 없다.

---

## 위험도

NONE

---
STATUS: OK
