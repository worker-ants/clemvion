# Rationale 연속성 검토 결과

**검토 모드**: `--impl-prep` (구현 착수 전)
**Target**: `spec/5-system/15-chat-channel.md`
**검토 일시**: 2026-05-25
**관련 spec Rationale 범위**: `spec/0-overview.md`, `spec/1-data-model.md`, `spec/2-navigation/2-trigger-list.md`, `spec/5-system/14-external-interaction-api.md`, `spec/conventions/chat-channel-adapter.md`, `spec/4-nodes/7-trigger/providers/telegram.md`

---

## 발견사항

### [INFO] Convention §3 매핑 표의 `execution.failed` 행이 stub 상태로 남아 있음

- **target 위치**: `spec/conventions/chat-channel-adapter.md §3` EIA Event → renderNode 매핑 표, `execution.failed` 행
- **과거 결정 출처**: `spec/conventions/chat-channel-adapter.md §3` (Changelog 2026-05-21, §3.1 설계)
- **상세**: target spec (`15-chat-channel.md`) 의 `§3.5 CCH-ERR-*` 와 `§Rationale R-CC-15` 에서 분류 알고리즘 (`classifyExecutionFailure`) 을 Convention `§3.1` 단일 진실로 위임하고 있으나 (`§3.5`, `§4.1.1`, `R-CC-15 (a)` 참조), Convention `§3` 의 매핑 표 `execution.failed` 행은 여전히 "에러 안내 (사용자에게 안전한 형태로 redact)" 한 줄 stub 상태다 (`plan/in-progress/chat-channel-error-notify.md §진단` 에서 명시). target spec 의 Rationale 는 Convention §3.1 을 단일 진실로 선언하는데 Convention 측 §3.1 이 아직 신설되지 않았다.
- **제안**: Convention `chat-channel-adapter.md` 에 `§3.1 Execution Failed 분류 알고리즘` 신설 + 매핑 표 `execution.failed` 행을 "분류 helper §3.1 결과 → `text` 1건" 으로 격상하는 갱신이 target spec 과 동시 반영되어야 한다. plan 의 변경 범위 2번 항목이 이를 추적하고 있으므로 spec commit 시 두 파일을 함께 묶을 것.

---

### [INFO] `languageLocale` 필드 신설 — Convention `ChatChannelConfig` 타입에 미반영

- **target 위치**: `spec/5-system/15-chat-channel.md §4.1` `config.chatChannel.languageLocale` 필드 추가
- **과거 결정 출처**: `spec/conventions/chat-channel-adapter.md §2.3 ChatChannelConfig` — "구조는 Spec Chat Channel §4.1 의 단일 진실을 따른다 (drift 회피 — 본 컨벤션은 type signature 만 가리킴)"
- **상세**: Convention §2.3 의 `ChatChannelConfig` 인터페이스는 §4.1 을 단일 진실로 참조하므로 이론상 자동으로 따라가야 하나, `languageLocale?: "ko" | "en"` 필드가 Convention TypeScript 인터페이스 본문에 명시되지 않으면 어댑터 구현체가 타입 참조 시 누락할 위험이 있다. 기존 결정(Convention = type signature SoT) 에 근거한 drift 보완 필요성.
- **제안**: Convention `§2.3 ChatChannelConfig` 인터페이스에 `languageLocale?: "ko" | "en"` 필드를 명시적으로 추가. 이는 `§4.1` 에서의 단일 진실 참조를 구체 타입 수준까지 보강하는 것. plan 변경 범위 2번과 동시 반영 권장.

---

### [INFO] `CCH-ERR-05` 의 `chat_channel_health=degraded` 귀결 — R-CC-15 (d) 의 "의미 분리" 와 표면적 긴장

- **target 위치**: `spec/5-system/15-chat-channel.md §3.5 CCH-ERR-05` 마지막 문장 "안내 발송이 최종 실패하면 CCH-SE-01 의 일반 정책에 따라 `chat_channel_health=degraded` 갱신"
- **과거 결정 출처**: `spec/5-system/15-chat-channel.md Rationale R-CC-15 (d)` — "`chat_channel_health` 와의 의미 분리: `chat_channel_health=degraded` 는 어댑터의 외부 API 호출(sendMessage 등) 실패 신호 (CCH-SE-01). 본 spec 의 실패 안내는 execution 자체의 실패 안내. 두 자원이 직교적이므로 발송 자체는 `chat_channel_health` 와 무관."
- **상세**: R-CC-15 (d) 에서 "두 자원이 직교적이므로 발송 자체는 `chat_channel_health` 와 무관" 이라고 명시하면서, 같은 절 끝부분에서 "안내 발송이 최종 실패하면 CCH-SE-01 의 일반 정책에 따라 `health=degraded` 갱신" 이라고 추가하고 있다. 이 두 문장은 논리적으로 충돌하는 것처럼 읽힐 수 있으나, R-CC-15 (d) 자체에서 "이건 안내 발송 메커니즘 자체의 외부 호출 실패라 정합" 이라고 단락에서 구분하고 있다. 즉 번복이 아니라 두 자원의 sink 가 다르다는 것을 이미 본인이 설명하고 있으나, 처음 읽는 구현자가 CCH-ERR-05 만 읽으면 "실행 실패 안내도 `health` 를 바꾼다" 로 오독할 수 있다.
- **제안**: CCH-ERR-05 요구사항 텍스트 끝에 단문 clarifier 추가. 예: "— 이때의 health 갱신은 sendMessage 자체의 외부 API 호출 실패로 인한 것 (R-CC-15 (d)); 안내 발송 트리거 (execution.failed 이벤트 수신) 자체가 health 를 바꾸지는 않는다." 이렇게 하면 R-CC-15 (d) 까지 읽지 않아도 의미 구분이 명확해진다.

---

### [INFO] `R-CC-10` 기각 대안(2)과 `spec/2-navigation/2-trigger-list.md R-4` 의 관계 — 교차 설명 충분

- **target 위치**: `spec/5-system/15-chat-channel.md Rationale R-CC-10` 기각된 대안 2번
- **과거 결정 출처**: `spec/2-navigation/2-trigger-list.md Rationale R-4` — "`isActive` 편집 경로를 PATCH body 와 `/toggle` 양쪽 모두 유지"
- **상세**: R-CC-10 이 기각된 대안 2번("PATCH + rotate 양쪽 허용")에서 "spec/2-navigation/2-trigger-list.md Rationale R-2 의 hmacSecret 패턴과 정렬되나, 자원 성격이 다르다" 라고 명시해 과거 결정과의 차이를 자체 설명하고 있다. 합의된 원칙을 위반하지 않으며 새 Rationale 도 함께 제공되어 있어 번복 소지 없음. 다만 R-2 (hmacSecret 분리) 와 R-4 (`isActive` 양쪽 유지) 는 서로 다른 결정이므로 혼동 여지가 있으나, 검토 범위 내 spec 에서 직접 충돌은 발견되지 않음.
- **제안**: 실제 번복이 아니므로 추가 조치 불필요. 다만 구현 착수 전 개발자가 R-2 와 R-CC-10 의 차이를 오독하지 않도록 개발자 핸드오프 메모에 언급 가치 있음.

---

## 요약

`spec/5-system/15-chat-channel.md` 의 신규 절 (`§3.5 CCH-ERR-*`, `§4.1.1`, `R-CC-15`) 은 기존 Rationale 에서 명시적으로 기각된 대안을 재도입하거나 합의된 invariant 를 직접 위반하는 항목을 포함하지 않는다. 기존 결정 (`R1~R9`, `R-CC-10~R-CC-14`, Convention §2~§6 의 인터페이스 계약, EIA §R10 단일 sink 정책) 과 정합하며, 새로운 결정이 도입될 때 (`R-CC-15`) 충분한 Rationale 와 기각 이유가 함께 작성되어 있다. 단 Convention `chat-channel-adapter.md` 의 `§3.1` 신설 및 `§3` 매핑 표 갱신이 target spec 과 동시에 이루어지지 않으면 두 파일 간 단일 진실 선언과 실제 기술 사이에 gap 이 남는다 (INFO 수준). `CCH-ERR-05` 와 R-CC-15 (d) 의 `chat_channel_health` 의미 분리 설명이 미묘하게 두 층에 나뉘어져 구현자 오독 위험이 있으나, 번복이 아니라 추가 clarifier 로 해소 가능한 수준이다. 전체적으로 Rationale 연속성 위험도는 낮다.

---

## 위험도

LOW
