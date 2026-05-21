# 보안(Security) Review — Chat Channel / Telegram Adapter Spec

**검토 대상**: Chat Channel 어댑터 시스템 spec 변경 (파일 26~35)
**검토 일시**: 2026-05-22

---

## 발견사항

### [WARNING] Bot token 평문 저장 — v1 stub 이 CCH-SE-03 와 모순

- **위치**: `spec/5-system/15-chat-channel.md §4.1` (`botTokenRef` 설명), `spec/conventions/chat-channel-adapter.md §2.3 ChatChannelConfig.secretToken` 주석
- **상세**: CCH-SE-03 은 "config JSONB 평문 금지 + secret store reference 만 보관"을 **필수** 요구사항으로 명시한다. 그러나 `§4.1` 의 JSONC 예시 주석에 `v1 stub: notification.signing.secret 와 동일 plaintext 보관`이라고 기재되어 있고, `conventions/chat-channel-adapter.md §2.3` 에도 `v1 stub: botTokenRef 와 동일 plaintext 보관 정책`이라는 예외가 명시되어 있다. **Bot token 은 외부 봇 계정 완전 장악 권한**에 해당하는 고위험 자격증명이다. Secret rotation API(CCH-SE-04)까지 설계하고도 v1 구현이 JSONB 평문으로 bot token 을 저장하면 DB 접근 권한이 있는 임의 사용자(DBA, 내부 직원, DB dump 탈취 공격자)가 즉시 bot token 을 획득해 봇 계정을 탈취할 수 있다. `plan/in-progress/chat-channel-impl.md §3.4` 의 "post-impl spec 갱신 권고" 참조에 따르면 이 stub 상태가 의도적으로 출시 버전에 포함되는 구조다.
- **제안**:
  1. CCH-SE-03 의 "필수" 등급을 그대로 유지하고 v1 구현에서도 secret store reference 를 사용한다. 기존 `notification.signing.secret` 가 plaintext 로 저장된다면 그 구현도 동일한 문제를 공유하는 것이므로 양쪽을 동시에 해소해야 한다.
  2. 부득이하게 v1 plaintext stub 을 사용해야 한다면, spec 에서 "필수" 등급을 "v1: 권장, v2: 필수"로 낮추고 보안 위험을 명시적으로 수용 결정으로 기록해야 한다 (현재는 spec 이 필수로 요구하지만 구현은 위반하는 모순 상태).
  3. DB-level 암호화 (`pgcrypto`, 애플리케이션 단 AES) 또는 환경변수 기반 최소 래핑이라도 적용해 plaintext JSONB 저장을 회피한다.

---

### [WARNING] `X-Telegram-Bot-Api-Secret-Token` webhook 인증 — `secretToken` 이 `ChatChannelConfig` 인터페이스에 누락

- **위치**: `spec/conventions/chat-channel-adapter.md §6 보안` (parseUpdate 선행 검증 기술), `spec/4-nodes/7-trigger/providers/telegram.md §6 보안 / §3.1`, `spec/5-system/15-chat-channel.md §5.1`
- **상세**: Telegram `setWebhook` 의 `secret_token` 은 Telegram 이 모든 webhook update 에 `X-Telegram-Bot-Api-Secret-Token` 헤더로 동봉하는 **webhook 인증 수단**이다. `telegram.md §6` 는 "검증 실패 시 401 + null 반환"이라고 명시한다. 이 검증은 외부에서 임의 payload 를 webhook 에 주입하는 공격을 차단하는 핵심 보안 경계다. 그런데 이 검증을 누가 담당하는지 spec 에서 일관되지 않다.
  - `conventions/chat-channel-adapter.md §6` 는 "진입점 핸들러가 선행 검증"이라고 기술한다 (`parseUpdate` 가 pure 함수이므로 검증을 밖에서 한다는 의미).
  - `telegram.md §6` 는 "어댑터가 검증"이라고 기술한다.
  - 또한 consistency review (cross_spec.md) 가 지적했듯 `secretToken` 필드가 `ChatChannelConfig` 인터페이스 정의(`spec/conventions/chat-channel-adapter.md §2.3`)에는 없으나 `spec/5-system/15-chat-channel.md §4.1` JSONC 예시에는 있고, `conventions/chat-channel-adapter.md §2.3 ChatChannelConfig` 본문에는 별도 주석으로 설명된다.
  - 검증 책임 불명확 + 타입 정의 누락이 결합되면 구현자가 `secretToken` 필드를 건너뛰어 헤더 검증을 누락할 위험이 있다.
- **제안**:
  1. `ChatChannelConfig` 인터페이스에 `secretToken?: string` 필드를 명시적으로 선언한다 (이미 주석으로만 존재하는 상태를 타입 필드로 승격).
  2. 검증 책임을 단일 위치로 명확히 결정한다. `parseUpdate` 는 pure 함수이어야 하므로, `HooksService` (또는 진입점 핸들러) 가 `secretToken` 을 `config` 에서 읽어 `X-Telegram-Bot-Api-Secret-Token` 헤더와 비교하는 책임을 가지도록 spec 에 명시한다.
  3. `secretToken` 은 봇 계정의 자격증명은 아니지만 webhook 스푸핑 차단의 핵심이므로, 저장 시 plaintext JSONB 를 사용하지 않도록 botTokenRef 와 동일한 보안 정책을 적용한다.

---

### [WARNING] `InteractionRequestContext.scope: 'in_process_trusted'` 플래그 — 외부 HTTP 경로 오염 가능성

- **위치**: `spec/5-system/15-chat-channel.md §5.1 인증`, `spec/5-system/14-external-interaction-api.md EIA-AU-08`, `spec/5-system/15-chat-channel.md §8 (호환성)`
- **상세**: EIA-AU-08 은 "외부 HTTP guard 는 ctx 합성 시 이 플래그를 절대 set 하지 않는다"고 명시한다. 이는 **구현 규율에만 의존하는 방어** 다. `InteractionRequestContext` 에 `scope?: 'in_process_trusted'` 를 optional 필드로 추가하면, 외부 HTTP 요청을 처리하는 guard 코드에서 실수 또는 악의적 수정으로 이 플래그를 set 하면 토큰 검증이 완전히 우회된다. spec 에는 이를 막는 구조적 장치가 정의되어 있지 않다.
  - `InteractionRequestContext` 가 단순 interface/object 라면 런타임에 `scope: 'in_process_trusted'` 를 포함한 JSON payload 를 통해 외부 클라이언트가 주입을 시도할 가능성도 있다 (HTTP request body 에서 context 를 역직렬화하는 경우).
- **제안**:
  1. 구현 spec 에 명시적으로 "HTTP request 역직렬화 경로에서 `scope` 필드는 반드시 strip 되어야 한다"를 추가한다.
  2. 구조적으로 더 안전한 방식은 `InteractionRequestContext` 를 두 타입으로 분리하는 것이다 — `ExternalInteractionRequestContext` (외부 HTTP, `tokenFamily` 있음, `scope` 없음)와 `InternalInteractionRequestContext` (in-process, `scope: 'in_process_trusted'` 있음). `InteractionService.interact()` 는 union type 을 받되, guard 레이어는 `ExternalInteractionRequestContext` 만 생성하도록 타입으로 강제한다.
  3. 최소한 spec 에 "외부 HTTP guard 의 `InteractionRequestContext` 빌더는 `scope` 필드를 허용하는 입력 경로가 없어야 한다 (예: DTO whitelist, `class-transformer excludeExtraneousValues`)"를 명시한다.

---

### [WARNING] group chat 차단 위치 — parseUpdate 순수성 계약과 실제 안내 발송 경로 불일치

- **위치**: `spec/4-nodes/7-trigger/providers/telegram.md §4 명령 매핑`, `spec/conventions/chat-channel-adapter.md §1.1 parseUpdate` (부작용 = none, pure)
- **상세**: `parseUpdate` 계약은 "side-effect free, DB 미접근, 외부 API 미호출"이다. `telegram.md §4` 는 group/supergroup/channel update 에 대해 `null` 반환 + `languageHints.groupChatRefusal` 안내 발송을 명시하고, "호출자(`HooksService`) 가 `chat.type !== 'private'` 분기에서 sendMessage 별 호출"로 개정되어 있다. 이 개정은 `parseUpdate` 를 pure 하게 유지하고 호출자에게 sendMessage 책임을 위임한다.
  - 그러나 `telegram.md §4` 의 다른 `null` 케이스 ("그 외 (`sticker`, `voice` 등 unsupported) — 호출자가 `지원하지 않는 메시지 형식입니다.` 안내 발송") 와 "다른 봇 메시지 무시 (`from.is_bot === true`)" 케이스는 모두 호출자가 `null` 만으로 케이스를 구분할 수 없다는 문제를 가진다. `null` 은 단일 타입이라 group chat / bot message / unsupported type 을 구분할 신호를 담지 못한다.
  - 결과적으로 호출자는 `null` 이 반환될 때 어떤 안내 메시지를 보내야 할지 알 수 없어 구현이 정의되지 않거나, parseUpdate 내부에서 side-effect (sendMessage 호출) 를 수행하도록 구현자가 잘못 이해할 수 있다. 후자 구현은 security 문제는 아니나, 다른 봇 메시지에 "지원하지 않는 형식입니다" 안내를 보내는 등의 정보 노출 가능성이 있다.
- **제안**:
  1. `parseUpdate` 의 반환값을 `ChannelUpdate | null | { ignored: true; reason: 'group_chat' | 'bot_message' | 'unsupported_type' }` 형태로 확장해 호출자가 이유별로 처리를 분기할 수 있도록 한다.
  2. 또는 null 의 의미를 "무조건 무시, 아무 응답도 없음"으로 제한하고, 안내 메시지가 필요한 케이스(group chat refusal, unsupported type)는 별도 반환 타입으로 표현한다.
  3. 보안 관점에서는 다른 봇 메시지에 어떠한 응답도 보내지 않아야 한다 — 봇 간 루프(bot loop) 방지. 현재 spec 은 봇 메시지를 "안내 미발송" 으로 처리하므로 이 부분은 양호하다.

---

### [WARNING] `ChannelConversation` Redis TTL — 활성 execution 중 만료 위험

- **위치**: `spec/5-system/15-chat-channel.md §4.3 ChannelConversation`
- **상세**: Redis TTL 이 7일로 설정되어 있다. TTL 은 사용자 이탈 시 자동 만료를 위한 것이다. 그러나 7일이 지나도 같은 `chat_id` 로 메시지가 오면 conversation key 가 만료되어 기존 execution 연결이 끊기고 새 execution 이 시작된다. 이는 기능 문제이기도 하지만, 보안 관점에서 다음 시나리오를 유발한다:
  - 장기 실행 워크플로우(7일 이상)에서 사용자 메시지가 새 execution 을 시작시켜 의도치 않은 워크플로우 실행이 발생한다.
  - 만료된 conversation 의 `channelUserKey` 검증 불가로 인해 다른 사용자가 같은 chat_id 로 메시지를 보내면 기존 사용자의 세션처럼 취급될 수 있다 (텔레그램에서는 chat_id 가 변경되지 않으므로 실제로는 같은 사용자이나, 그룹 내 다른 사용자나 계정 변경 케이스에서는 문제가 될 수 있다).
  - 상태 만료 후 새 execution 을 시작하는 로직(`CCH-CV-03 — 종료된 execution 이면 새 execution 시작`)과의 상호작용이 정의되어 있지 않다.
- **제안**:
  1. TTL 만료 시 동작을 명시한다 — 만료 = 세션 없음 = 새 execution 시작으로 명문화.
  2. `lastUpdateAt` 를 기준으로 활성 execution 이 있는 동안 TTL 을 자동 연장하는 정책을 추가한다 (TTL refresh 전략).
  3. 장기 실행 워크플로우에 대한 최대 TTL 한도와 경고 정책을 정의한다.

---

### [WARNING] `update_id` 기반 idempotencyKey — 멀티 봇 인스턴스 충돌 위험

- **위치**: `spec/5-system/15-chat-channel.md §3.4 CCH-SE-02`, `spec/4-nodes/7-trigger/providers/telegram.md §4`
- **상세**: CCH-SE-02 는 "텔레그램 `update_id` 기반으로 `Idempotency-Key` 자동 발급, 동일 `update_id` 30초 안 재도착은 무시"를 규정한다. `update_id` 는 Telegram 봇별, 계정별로 단조 증가하는 전역 ID 이다. 그러나 동일 bot token 으로 webhook 이 두 곳 이상 등록되는 상황(setupChannel 실패 + 재시도, 카나리 배포, 재해복구) 에서는 동일 `update_id` 가 두 인스턴스에 동시 도달할 수 있다. idempotency 체크가 인스턴스-로컬(메모리) 이면 두 인스턴스가 모두 처리해 execution 이 중복 생성된다.
  - spec 에 idempotency 저장소의 범위(in-memory vs Redis)가 명시되어 있지 않다.
- **제안**:
  1. CCH-SE-02 의 idempotency 저장소를 **Redis** 로 명시한다 (단일 Redis 인스턴스 공유). 멀티 인스턴스 배포에서도 dedup 을 보장하기 위함.
  2. 30초 중복 체크 창(window)이 Telegram 의 재전송 정책(Telegram 은 24h 동안 재전송 시도)에 비해 짧으므로, 최소 5분 이상으로 연장하거나 EIA 의 기존 idempotency 체크 창과 일치시키는 것을 권장한다.

---

### [INFO] `execution.failed` 에러 메시지 사용자 노출 — redact 기준 미정의

- **위치**: `spec/conventions/chat-channel-adapter.md §3 EIA Event → renderNode 매핑` (`execution.failed` 행)
- **상세**: `execution.failed` 이벤트 처리 시 "에러 안내 (사용자에게 안전한 형태로 redact)"라고 명시되어 있으나, redact 의 구체 기준(어떤 정보는 노출 가능, 어떤 정보는 차단)이 정의되어 있지 않다. `error.message` 에 내부 스택 트레이스, DB 쿼리, 외부 API 응답, 시스템 경로 등이 포함될 수 있으며, 이것이 텔레그램 채팅에 그대로 노출되면 내부 시스템 정보 유출이 된다. 현재 spec 은 "안전한 형태로 redact"라는 의도는 있으나 구현자가 따를 구체 규칙이 없다.
- **제안**: redact 정책을 spec 에 명시한다. 예시:
  - 허용: 워크플로우가 명시적으로 설정한 `userMessage` 또는 error.code 의 사람이 읽을 수 있는 설명.
  - 금지: `error.details`, 스택 트레이스, 노드 ID, 외부 API 응답 본문, 내부 서비스명.
  - 기본: `languageHints.executionFailed` 안내 메시지만 발송하고 error 상세는 숨김.

---

### [INFO] 하드코딩된 시크릿 없음 확인

- spec 파일 전체에서 실제 API 키, 토큰, 비밀번호 등이 하드코딩된 경우 없음. `botTokenRef` 의 예시값 (`"secret://triggers/:id/bot-token"`) 은 placeholder 형식으로 양호하다. `secretToken` 예시값 (`"AbCd…"`) 은 마스킹 형태로 실제 값 아님.

---

### [INFO] Telegram Bot API URL 고정 — SSRF 위험 없음

- **위치**: `spec/5-system/15-chat-channel.md §5.2 SSRF`, `spec/conventions/chat-channel-adapter.md §6 보안`
- **상세**: 어댑터의 outbound URL 이 `api.telegram.org` 로 고정되어 있고, spec 이 이를 명시적으로 기술한다. 사용자 제어 URL 이 외부 API 호출에 사용되지 않으므로 SSRF 위험이 없다. EIA 의 SSRF 화이트리스트(EIA-NX-10)와 별도 경로임도 명시됨 — 양호.

---

### [INFO] SQL 인젝션 위험 없음 (spec 단계)

- spec 의 DDL 변경 (`ALTER TABLE trigger ADD COLUMN …`) 은 migration 파일을 통해 실행되는 구조이며, 사용자 입력이 SQL 에 직접 삽입되는 경로가 spec 에 정의되지 않았다. 구현 단계에서 ORM/parameterized query 를 사용하는지는 코드 리뷰에서 별도 확인 필요.

---

### [INFO] 의존성 보안 — 신규 라이브러리 없음

- 이번 변경은 spec 문서 및 plan/review 파일 변경이며 새 npm/pip 등 외부 의존성 추가가 없다. 구현 단계에서 Telegram Bot API 클라이언트 라이브러리 선택 시 알려진 취약점 여부를 별도 확인 필요.

---

## 요약

이번 변경은 외부 chat 플랫폼 어댑터 시스템을 spec 단계에서 설계한 것으로, 실제 코드 변경은 없다. 그러나 보안 관점에서 세 가지 중요한 설계 결함이 발견되었다. 첫째, CCH-SE-03 가 bot token 의 JSONB 평문 저장을 금지하는 필수 요구사항으로 명시했음에도 v1 구현이 이를 위반하는 "stub" 을 허용하는 모순이 있으며, 이는 봇 계정 탈취로 이어지는 고위험 취약점이다. 둘째, Telegram `X-Telegram-Bot-Api-Secret-Token` 헤더 검증의 책임 소재가 spec 내에서 일관되지 않아 구현자가 webhook 인증을 누락할 위험이 있다. 셋째, `InteractionRequestContext.scope: 'in_process_trusted'` 플래그가 구현 규율에만 의존해 외부 HTTP 요청에서 플래그가 주입되는 경우 인증이 완전히 우회되며, 이를 막는 구조적 타입 분리가 spec 에 정의되어 있지 않다. 나머지 발견사항(Redis TTL 정책, idempotency 저장소 범위, 에러 메시지 redact 기준 미정의)은 구현 안정성과 정보 노출 관점의 WARNING 수준이다.

---

## 위험도

**HIGH**

bot token 평문 저장 가능성(spec 과 구현 의도의 모순)과 in-process trusted bypass 의 구조적 취약점이 두 HIGH 요인이다. 코드 구현 단계에서 반드시 해소 필요.

---

STATUS: SUCCESS
