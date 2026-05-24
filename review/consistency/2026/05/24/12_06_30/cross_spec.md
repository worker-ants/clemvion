# Cross-Spec 일관성 검토 결과

**검토 모드**: `--impl-prep`  
**Target**: `spec/4-nodes/7-trigger/providers/slack.md`  
**검토 시각**: 2026-05-24  
**검토자**: Cross-Spec Consistency Checker

---

## 발견사항

### **[WARNING]** `botIdentity` 형태 — Slack 어댑터가 `teamId` 추가 필드를 포함

- **target 위치**: `slack.md §3.1 setupChannel 구체`
- **충돌 대상**: `spec/conventions/chat-channel-adapter.md §2.3 ChatChannelConfig`
- **상세**:  
  Slack 어댑터의 `setupChannel` 결과 캐시로 `config.chatChannel.botIdentity = { botId: bot_id, username: user, teamId: team_id }` 를 기술한다. 그런데 Convention `ChatChannelConfig` 타입 정의는 `botIdentity?: { botId: number; username: string }` — `teamId` 필드가 없다. `spec/5-system/15-chat-channel.md §4.1` 의 JSON 예시도 `{ botId: ..., username: ... }` 2필드만 표시한다.  
  Slack 은 `auth.test` 응답에서 `team_id` 를 추가로 얻을 수 있고, 이를 어댑터 로직에서 DM conversationKey 검증 등에 활용할 수 있으나, convention 타입에 정의되지 않은 필드를 `botIdentity` 에 직접 넣으면 (a) TypeScript 타입 위반, (b) `SetupResult.identity?: Record<string, unknown>` (free-form 추가 정보 슬롯) 와 역할이 겹친다.  
- **제안**:  
  `slack.md §3.1` 을 수정하여 `config.chatChannel.botIdentity = { botId: bot_id, username: user }` 로 convention 과 정렬하고, `teamId` 는 `SetupResult.identity` 또는 `SetupResult.configUpdates` 안의 별도 키로 캐시하도록 명시. 또는 Convention `ChatChannelConfig.botIdentity` 타입에 `teamId?: string` 을 선택 추가하고, `15-chat-channel.md §4.1` JSON 예시도 동시 갱신.

---

### **[WARNING]** `form_submission` command kind — Convention `ChannelUpdate` 에 미정의

- **target 위치**: `slack.md §4.2 Interactivity` — `"view_submission"` 행의 v2 확장 예정: `{ kind: "form_submission", fields: payload.view.state.values }`
- **충돌 대상**: `spec/conventions/chat-channel-adapter.md §2.1 ChannelUpdate.command` union
- **상세**:  
  Convention 의 `command` union 은 6종 (`start`, `cancel`, `text_message`, `button_callback`, `file_upload`, `contact_share`) 으로 정의되어 있다. `form_submission` 은 현재 union 에 포함되지 않는다.  
  Slack spec 이 이를 "v2: 확장 예정" 으로 표시하고 있어 당장 구현 대상은 아니지만, spec 본문에 기술됨으로써 나중에 구현 시 Convention 갱신 없이 진행될 위험이 있다. Convention §7 변경 관리 조항은 "본 인터페이스 변경은 두 spec 동시 갱신 의무" 를 명시한다.  
- **제안**:  
  현재 v1 구현 준비 단계이므로 즉시 차단은 아니다. 단, `slack.md §4.2` 의 `form_submission` 언급 옆에 "`Convention §2.1 의 command union 확장 필요 (v2 착수 시 convention 동시 갱신 필수)`" 라는 주석을 추가해 추후 갱신 의무를 명시할 것을 권장.

---

### **[WARNING]** `ackInteraction` 역할 충돌 — Convention 은 "인터랙션 receipt ack" 로 정의하나 Slack 은 HTTP 응답 코드 반환 메커니즘으로 사용

- **target 위치**: `slack.md §3 Web API 호출 매핑` 표의 `ackInteraction` 행, `§4.2` 의 "3초 ack 의무", `§6 보안` 의 "Interactivity 응답 3초 시한 → `200 OK`"
- **충돌 대상**: `spec/conventions/chat-channel-adapter.md §1 Adapter Interface` — `ackInteraction(update: ChannelUpdate, config): Promise<void>`, `§1.1` 의 "외부 API 호출 (provider 의존)"  
  `spec/5-system/15-chat-channel.md §5.5` 의 응답 정책 표 (`ackInteraction` 는 DB/HTTP 응답 코드 설정이 아니라 in-process 처리 후 별도 외부 provider-API 호출)
- **상세**:  
  Convention 의 `ackInteraction` 는 "워크플로우 서버가 외부 provider API 를 다시 호출하는 행위" (`answerCallbackQuery` 등) 를 뜻한다. Telegram 의 경우 inline_keyboard tap 응답 후 `answerCallbackQuery` API 를 별도로 호출하는 패턴이다.  
  반면 Slack 의 "3초 ack 의무" 는 **inbound HTTP 요청 자체에 즉시 `200 OK` 로 응답**하는 것이다 — 이는 `HooksController` 의 HTTP 응답 레이어 책임이지, 어댑터 `ackInteraction` 함수의 외부 API 호출 책임이 아니다.  
  `slack.md §3` 매핑 표의 `ackInteraction (button_callback / view_submission) → "Interactivity 응답: 3초 안에 HTTP 200 OK 반환"` 기술이 Convention 의 어댑터 함수 역할과 범주가 다르다. Convention 어댑터는 HTTP 응답 코드를 직접 제어하지 않는다.  
- **제안**:  
  `slack.md §3` 의 `ackInteraction` 행 설명을 "Slack Interactivity 의 `200 OK` HTTP 응답은 `HooksController` 레이어 책임 — `ackInteraction` 구현체는 no-op (Telegram `answerCallbackQuery` 와 역할 상이, Rationale R-S-8)" 으로 수정. 또는 `ackInteraction` 가 Slack 에서 `response_url` 로의 비동기 갱신 POST 역할을 담당하도록 명시한다면, 그 책임 범위가 Convention §1.1 의 "외부 API 호출" 에 포함됨을 명확히 기술.

---

### **[INFO]** `parseUpdate` 시그니처 — Convention 은 `Promise<ChannelUpdate | null>` 이나 Slack spec 본문이 동기 반환으로 기술

- **target 위치**: `slack.md §4.1` — "… `ChannelUpdate { kind: "file_upload", fileId, mimeType: "application/octet-stream" }` 를 **동기 반환** (Convention §1.1 pure 계약 유지)"
- **충돌 대상**: `spec/conventions/chat-channel-adapter.md §1` — `parseUpdate(raw, config): Promise<ChannelUpdate | null>`
- **상세**:  
  Convention 의 `parseUpdate` 는 `Promise<ChannelUpdate | null>` 시그니처 — async 함수. Slack spec 의 R-S-7 Rationale 에서 "동기 반환" 이라는 표현을 반복 사용한다. 이는 semantics 상 "side-effect free / pure 계약" 을 의도한 것이지만, TypeScript 레이어에서 `Promise` vs 동기 return 은 엄밀히 다르다. `async function` 이 `await` 없이 값을 반환하면 `Promise.resolve(value)` 와 동일하므로 기능 충돌은 없지만, 명세 표현이 Convention 의 타입 시그니처와 불일치를 줄 수 있다.  
- **제안**:  
  `slack.md §4.1` 의 "동기 반환" 표현을 "Convention §1.1 의 side-effect free 계약 준수 (외부 API 미호출) — Convention 타입 시그니처 `Promise<ChannelUpdate | null>` 과 동일하게 async function 이지만 즉시 resolve" 로 명확화.

---

### **[INFO]** `conversationKey` 정의 — Slack spec 에서 명시적으로 정의되지 않음

- **target 위치**: `slack.md` 전체 — `conversationKey` 에 대한 직접 정의 없음
- **충돌 대상**: `spec/5-system/15-chat-channel.md §4.3` — "`conversationKey` 는 어댑터별로 다름 (텔레그램: `chat_id`, Slack: `channel_id`+`thread_ts`, 카카오: `user_id`)"  
  `spec/conventions/chat-channel-adapter.md §2.1 ChannelUpdate` — `conversationKey: string`
- **상세**:  
  `15-chat-channel.md §4.3` 은 Slack 의 `conversationKey` 를 `channel_id` + `thread_ts` 의 복합으로 정의한다. 그런데 Slack spec (`slack.md`) 본문 어디에도 이 규칙이 명시되지 않아 어댑터 구현자가 `parseUpdate` 에서 `conversationKey` 를 어떻게 채워야 하는지 확인하려면 시스템 spec 을 직접 봐야 한다. 또한 `channel_id` + `thread_ts` 를 복합키로 쓸 경우 일반 DM (thread 없음) 에서 `thread_ts` 가 없을 때의 처리가 불명확하다.  
- **제안**:  
  `slack.md §4.1` (Events API 매핑 표) 또는 `§4 명령 매핑` 앞에 "conversationKey = `{event.channel}` (DM) 또는 `{event.channel}:{event.thread_ts}` (thread)" 와 같이 구체 규칙을 한 줄 추가. `15-chat-channel.md §4.3` 의 `channel_id+thread_ts` 표현도 DM 케이스 처리를 명시하도록 보완.

---

### **[INFO]** Telegram spec 과의 구조 비대칭 — `§5 인터랙션 노드 UI 매핑` 부재

- **target 위치**: `slack.md` — 섹션 번호가 `§3 Web API`, `§4 명령 매핑`, `§5 인터랙션 노드 UI 매핑`, `§6 보안`, `§7 명령 처리`, `§8 비기능` 순이다.
- **충돌 대상**: `spec/4-nodes/7-trigger/providers/_overview.md §3 신규 provider 추가 절차` — "Overview / §3 API 호출 매핑 / §4 명령 매핑 / §5 인터랙션 노드 UI 매핑 / §6 보안 / §7 명령 처리 / §8 비기능 / Rationale" 8섹션 + Rationale 구조 채택"
- **상세**:  
  `_overview.md` 는 신규 provider 명세 파일이 따라야 할 8섹션 구조를 명시한다. Slack spec 은 `§5 인터랙션 노드 UI 매핑` 섹션이 있고 전반적으로 이 구조를 따르고 있다. 다만 `_overview.md` 에 명시된 진입 섹션 제목 "Overview" (제품 정의 섹션) 와의 정합은 문제 없다. 이 항목은 단순 확인 수준으로 심각한 충돌은 아니다.
- **제안**: 별도 조치 불필요 (INFO 수준 확인).

---

## 요약

`spec/4-nodes/7-trigger/providers/slack.md` 는 전반적으로 `spec/5-system/15-chat-channel.md`, `spec/conventions/chat-channel-adapter.md`, `spec/1-data-model.md` 의 Trigger 데이터 모델과 일관성을 유지하며 작성되었다. `inboundSigningRef` 단일 슬롯 통합, Bot token single-path 정책, `202 Accepted` 예외 케이스 등 기존 spec 과의 교차 참조가 명확히 기술되어 있다. 주요 위험으로는 `botIdentity.teamId` 추가 필드가 Convention 타입과 불일치하는 점 (WARNING), `form_submission` command kind 가 Convention `ChannelUpdate` union 에 미정의된 채 v2 예정으로 기술된 점 (WARNING), `ackInteraction` 의 역할이 Convention 과 달리 HTTP 응답 레이어 개념으로 기술된 점 (WARNING) 이 있어, 구현 착수 전 세 항목을 정리하거나 구현자에게 명확히 안내할 필요가 있다.

---

## 위험도

**MEDIUM**

CRITICAL·BLOCKING 수준의 충돌은 없으나, WARNING 3건이 모두 Convention 인터페이스 계약과의 불일치이므로 구현자가 잘못된 방향으로 코드를 작성할 가능성이 있다. 구현 착수 전 `botIdentity` shape 및 `ackInteraction` 역할 명확화를 권장한다.
