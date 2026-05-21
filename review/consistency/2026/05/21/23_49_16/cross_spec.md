# Cross-Spec 일관성 검토 결과

검토 대상: `spec/5-system/15-chat-channel.md`, `spec/conventions/chat-channel-adapter.md`, `spec/4-nodes/7-trigger/providers/telegram.md`
검토 모드: `--impl-prep`
검토일: 2026-05-21

---

## 발견사항

### [WARNING] `secretToken` 필드가 `ChatChannelConfig` 인터페이스와 `config.chatChannel` JSONC 스키마에서 누락

- **target 위치**: `spec/4-nodes/7-trigger/providers/telegram.md` §3.1 setupChannel 구체 (line 45) — `"secret_token": "…", // config.chatChannel.secretToken 에 저장`
- **충돌 대상**:
  - `spec/conventions/chat-channel-adapter.md` §2.3 `ChatChannelConfig` 인터페이스 (fields: `provider`, `botTokenRef`, `botIdentity?`, `uiMapping?`, `rateLimitPerMinute?`, `languageHints?`)
  - `spec/5-system/15-chat-channel.md` §4.1 `Trigger.config.chatChannel` JSONC 예시 (동일 필드 목록)
- **상세**: `setWebhook` 등록 시 발급하는 랜덤 `secret_token` (텔레그램이 `X-Telegram-Bot-Api-Secret-Token` 헤더로 돌려주는 webhook 인증 값) 을 `config.chatChannel.secretToken` 에 저장한다고 `telegram.md` 에 명시하나, 이 필드는 `ChatChannelConfig` 타입 정의와 `chatChannel` JSONC 예시 어디에도 선언되지 않았다. 구현자가 `ChatChannelConfig` 를 보고 `secretToken` 필드를 추가하지 않거나, 타입 체크에서 누락될 수 있다. 또한 이 값이 평문 JSONB 에 저장된다면 `CCH-SE-03` ("config JSONB 평문 금지") 위반 여부도 불명확해진다 — `secretToken` 은 bot token (`botTokenRef`) 과 달리 외부에서 발급받는 비밀이 아니라 서버가 자체 생성하는 webhook secret 이므로 secret store reference 처리가 별도로 필요한지 판단이 어렵다.
- **제안**: `spec/conventions/chat-channel-adapter.md` §2.3 `ChatChannelConfig` 에 `secretToken?: string` 필드를 추가하거나, `spec/5-system/15-chat-channel.md` §4.1 JSONC 예시에 이 필드를 명시하고 보안 처리 방침(서버-생성 webhook secret 이므로 secret reference 가 아닌 암호화 컬럼 or JSONB 암호화 적용 여부)을 결정할 것.

---

### [WARNING] `telegram.md` 에 중복 section 번호 `§5.4` 존재

- **target 위치**: `spec/4-nodes/7-trigger/providers/telegram.md`
  - 첫 번째 `5.4`: `### 5.4 Carousel / Chart / Table (CCH-MP-04)` (line 129)
  - 두 번째 `5.4`: `## 5.4 보안` (line 144, 앞 섹션과 동일 번호, 상위 heading level 도 다름)
- **충돌 대상**: `spec/5-system/15-chat-channel.md` §5.1 — `"providers/telegram §5.4"` 를 링크 앵커로 참조. 두 섹션이 같은 번호를 가지므로 `#54-보안` 앵커가 어느 섹션을 가리키는지 렌더러에 따라 달라진다.
- **상세**: Markdown 렌더러는 중복 앵커를 `-1`, `-2` suffix 로 처리하거나 첫 번째 매칭만 반환한다. `15-chat-channel.md §5.1` 의 `[providers/telegram §5.4](../4-nodes/7-trigger/providers/telegram.md#54-보안)` 링크가 보안 섹션이 아닌 Carousel/Chart/Table 섹션으로 연결될 위험이 있다.
- **제안**: `telegram.md` 에서 보안 섹션 번호를 `5.5` 또는 `6` 으로 수정. `15-chat-channel.md` 의 참조 링크 앵커도 함께 갱신.

---

### [WARNING] `telegram.md` §5.4 에 `template` 노드 타입이 포함되나 `CCH-MP-04` 요구사항 범위 초과

- **target 위치**: `spec/4-nodes/7-trigger/providers/telegram.md` §5.4 표 — `template` 행 (`output.rendered` 가 HTML 이면 SSR PNG, plain text 면 `sendMessage`)
- **충돌 대상**: `spec/5-system/15-chat-channel.md` §3.3 CCH-MP-04 — `"Carousel / Chart / Table 의 execution.waiting_for_input → …"` (Template 미포함)
- **상세**: CCH-MP-04 는 Carousel / Chart / Table 만 열거하고 Template 은 포함하지 않는다. `telegram.md §5.4` 는 Template 을 독립 행으로 정의한다. CCH-MP-04 의 요구사항 ID 적용 범위가 Template 까지 확장되는지, 혹은 `telegram.md` 가 요구사항 없이 단독으로 구현 명세를 선언하는 것인지 불명확하다. 또한 `execution.waiting_for_input` payload 에서 `nodeType = 'template'` 이 오는 경로가 EIA §6.2 의 `node.type` 허용값에 없는지 확인이 필요하다 (`"form" | "carousel" | "table" | "chart" | "template" | "ai_agent" | "information_extractor"` — EIA §6.2 에는 `template` 이 이미 포함되어 있으므로 spec 차원 충돌은 없지만, 요구사항 ID 누락이 문제).
- **제안**: `spec/5-system/15-chat-channel.md` §3.3 CCH-MP-04 요구사항에 Template 을 명시적으로 추가하거나, `telegram.md §5.4` 의 template 행에 "CCH-MP-04 범위 외 — v2 구현 대상" 주석을 붙여 의도를 명확히 할 것.

---

### [WARNING] `telegram.md` §5.3 의 `phone` 필드 타입이 Form 노드 spec 에 정의되지 않음

- **target 위치**: `spec/4-nodes/7-trigger/providers/telegram.md` §5.3 Form 필드 keyboard hint 표 — `| (특수) phone (custom validation rule) | request_contact: true 버튼 — share_contact |`
- **충돌 대상**: `spec/4-nodes/6-presentation/4-form.md` §1 FormField `type` Enum — `text / number / email / textarea / select / checkbox / radio / date / file` (phone 없음). `ValidationRule` 구조 — `minLength / maxLength / min / max / pattern / message` (phone 관련 검증 없음)
- **상세**: `telegram.md` 는 Form 필드의 `type` 이 `phone` 인 경우 텔레그램 `request_contact` 버튼으로 변환하도록 명세하지만, Form 노드 spec 에는 `phone` 타입이 존재하지 않는다. `(특수)` 표기가 "custom validation rule" 임을 암시하나, 구체적으로 어떤 `ValidationRule.pattern` 값이거나 별도 `type` 값인지 불분명하다. 구현자가 Form 필드에 `type: 'phone'` 을 추가하면 Form spec 과 충돌한다.
- **제안**: `spec/4-nodes/6-presentation/4-form.md` 에 `phone` 타입을 추가하거나, `telegram.md §5.3` 을 수정해 "type=text + pattern=phone regex 인 경우" 와 같이 Form spec 과 정합하는 표현으로 바꿀 것. 전자라면 Form spec 의 `type` Enum 과 `ValidationRule` 도 함께 갱신.

---

### [INFO] `EiaEvent` union 에서 `execution.cancelled` 의 `/* EIA §6.5 */` 주석이 `execution.ai_message` 와 섹션 번호를 공유

- **target 위치**: `spec/conventions/chat-channel-adapter.md` §1.2 `EiaEvent` 타입 정의 (line 72) — `/* EIA §6.5 */` 가 `execution.cancelled` 에 태깅됨
- **충돌 대상**: `spec/5-system/14-external-interaction-api.md` §6.5 제목 — `"6.5 페이로드 — execution.cancelled / execution.ai_message"` (두 이벤트가 하나의 섹션 §6.5 에 묶임)
- **상세**: EIA §6.5 는 `execution.cancelled` 와 `execution.ai_message` 를 한 섹션에서 설명한다. convention 의 `EiaEvent` 에서는 `execution.ai_message` 가 `/* EIA §6.5 + WS §4.4 ai_message */`, `execution.cancelled` 가 `/* EIA §6.5 */` 로 같은 섹션 번호를 공유하므로 두 이벤트의 출처가 정확히 동일 섹션인지 혼동할 수 있다. 기능상 오류는 없으나 유지보수 시 혼동 요인이 된다.
- **제안**: EIA §6.5 를 `§6.5 execution.cancelled` 와 `§6.6 execution.ai_message` 로 분리하거나, convention 주석에 `/* EIA §6.5 (cancelled 부분) */`, `/* EIA §6.5 (ai_message 부분) */` 로 명확히 구분할 것.

---

### [INFO] `spec/0-overview.md` §6 구현 상태 표에 Chat Channel 미포함

- **target 위치**: (없음 — 누락)
- **충돌 대상**: `spec/0-overview.md` §6.2 백엔드만 존재 / 부분 구현 표 및 §6.3 로드맵 표
- **상세**: `spec/0-overview.md` §6.2 와 §6.3 는 구현 상태 표를 관리한다. Chat Channel (새 기능) 이 추가되었으나 이 표에 반영되지 않았다. 단일 진실 원칙에 따라 구현 현황 표를 갱신할 필요가 있다.
- **제안**: `spec/0-overview.md` §6.2 또는 §6.3 에 Chat Channel 항목 추가 (구현 착수 시 §6.2, 계획 단계이면 §6.3). 완료 후 §6.1 로 이동.

---

### [INFO] `CCH-CV-03` 의 "활성 execution" 조건이 Execution 상태 enum 과 충분히 정합하나 "running" 상태 처리가 미명시

- **target 위치**: `spec/5-system/15-chat-channel.md` §3.2 CCH-CV-03 — `"활성 execution 이 waiting_for_input 상태이면 인터랙션 명령으로 forwarding, 종료된 execution 이면 새 execution 시작"`
- **충돌 대상**: `spec/1-data-model.md` §2.13 Execution.status Enum — `pending / running / completed / failed / cancelled / waiting_for_input`
- **상세**: CCH-CV-03 는 `waiting_for_input` 과 "종료된 execution" 두 케이스만 명시한다. `running` 상태 (워크플로우 실행 중, 아직 waiting_for_input 에 미도달) 에 두 번째 메시지가 도착하는 케이스가 정의되지 않았다 — 무시? 새 execution 시작? 큐 적재? 기능 충돌보다는 미명시 동작이다.
- **제안**: CCH-CV-03 에 `running` 상태 케이스를 명시 ("running 이면 무시 또는 대기 큐" 등). 이는 기능 결정 사항이므로 spec 작성자 판단 필요.

---

## 요약

세 target 파일 (`15-chat-channel.md`, `chat-channel-adapter.md`, `telegram.md`) 은 상호 간 대체로 일관성을 유지한다. `spec/1-data-model.md` 의 Trigger 엔티티 확장 (5개 `chat_channel_*` 컬럼), `spec/5-system/12-webhook.md` 의 `chatChannel` config 위치, `spec/5-system/14-external-interaction-api.md` 의 EIA facade 관계, EIA §R10 의 단일 sink 정책 확장이 모두 정합적으로 교차 참조되어 있다. 주요 주의사항은 다음 두 가지다: (1) `telegram.md` 가 `config.chatChannel.secretToken` 필드를 사용하지만 이 필드가 `ChatChannelConfig` 인터페이스와 `chatChannel` JSONC 예시에 선언되지 않아 구현 시 gap 이 생긴다. (2) `telegram.md` 의 `phone` 필드 타입 처리가 `Form` 노드 spec 에 없는 타입을 암묵적으로 가정한다. 두 항목 모두 CRITICAL 수준이 아니나, 구현 착수 전 명확히 해소하지 않으면 구현자 혼동과 Form spec 비정합이 발생할 수 있다. 요구사항 ID 충돌, API endpoint 충돌, 상태 머신 충돌, RBAC 충돌은 발견되지 않았다.

## 위험도

MEDIUM

---

STATUS: SUCCESS
