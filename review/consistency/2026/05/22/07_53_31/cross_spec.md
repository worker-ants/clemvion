# Cross-Spec 일관성 검토 보고서

- 대상 worktree: `chat-channel-spec-fix-5fc137`
- 검토 일시: 2026-05-22
- 검토자 모델: claude-sonnet-4-6

## 검토 대상 파일 (변경 diff)

| 파일 | 변경 규모 |
|---|---|
| `spec/5-system/15-chat-channel.md` | CCH-CV-03 케이스 명시, CCH-SE-03 v1 예외 명시, §4.1 botTokenRef 주석, §5.4 응답 계약 추가, Rationale R8 추가 |
| `spec/5-system/14-external-interaction-api.md` | EIA-AU-08 행 끝 §3.3.1 참조 추가, §3.3.1 Implementation Note 신설 |
| `spec/conventions/chat-channel-adapter.md` | §1.1 parseUpdate null 의미, §2.3 secretToken 주석, §4 step 3 dispatcher 책임, Changelog 추가 |
| `spec/4-nodes/7-trigger/providers/telegram.md` | §5.3 phone 행 명확화 |

## 검토 관점별 참조 파일

- `spec/1-data-model.md` §2.8 Trigger 엔티티
- `spec/5-system/2-api-convention.md` §5.3 에러 응답 형식
- `spec/5-system/4-execution-engine.md` §1.1 Execution 상태
- `spec/5-system/14-external-interaction-api.md` §3.3 EIA-AU-08, EIA-IN-06
- `spec/5-system/12-webhook.md` §3.4 관리

---

## 발견사항

### [INFO] §5.4 rotate-bot-token 성공 응답이 `data:` 래퍼 없이 평탄 객체 반환

- **target 위치**: `spec/5-system/15-chat-channel.md` §5.4 "성공 응답 (200 OK)"
- **충돌 대상**: `spec/5-system/2-api-convention.md` §5.1 단일 리소스 응답 형식
- **상세**: API 규칙 §5.1 은 단일 리소스 성공 응답을 `{ "data": { ... } }` 래퍼 구조로 정의한다. §5.4 의 200 OK 응답은 `{ "triggerId", "rotatedAt", "chatChannelHealth", "botIdentity" }` 를 최상위에 평탄하게 나열하며 `data:` 래퍼가 없다. EIA 의 `rotate-secret` (EIA-NX-12) 은 응답 shape 를 spec 에서 명시하지 않아 비교 대상이 없다. 그러나 EIA §5.1~5.5 의 inbound REST 응답들 (`202 Accepted` body, `200 OK` 토큰 갱신 등) 도 모두 `data:` 래퍼를 쓰지 않는다는 점에서 EIA/CCH 가 일관되게 API 규칙 §5.1 의 래퍼를 사용하지 않는 패턴을 공유하고 있다. 즉 신규 endpoint 가 기존 EIA 관례와는 일치하지만, 2-api-convention.md 와는 명시적 정렬이 없다.
- **제안**: 2-api-convention.md §5 또는 §12 에 "RPC-style action endpoint (`rotate-*`, `revoke-*` 등) 는 `data:` 래퍼를 생략하고 action 결과 필드를 직접 반환한다" 예외 문구를 추가하거나, 15-chat-channel.md §5.4 에 "API 규칙 §5.1 의 단일 리소스 래퍼 미적용 — EIA §5.x 의 action 응답 관례와 동일" 주석을 추가하여 의도적 예외임을 명시화한다.

---

### [INFO] §5.4 실패 응답의 에러 형식 참조 위치 지칭 — `{ code, message }` vs `{ "error": { "code", "message" } }`

- **target 위치**: `spec/5-system/15-chat-channel.md` §5.4 마지막 문단 "응답 schema 는 ... 표준 에러 형식 (`{ code, message }`) 을 따른다"
- **충돌 대상**: `spec/5-system/2-api-convention.md` §5.3 에러 응답 형식
- **상세**: 2-api-convention.md §5.3 의 에러 응답 형식은 `{ "error": { "code", "message", "details" } }` 구조다. target 문서는 축약 표기 `{ code, message }` 를 사용해 `error:` 래퍼가 있는지 없는지가 모호하다. EIA §5.1 에서 신규 endpoint 에러 응답은 `{ "error": { "code", "message", "details" } }` 를 명시적으로 사용하며 실제 코드 예시도 포함되어 있다. target 의 축약 표기가 개발자에게 혼동을 줄 수 있다.
- **제안**: §5.4 마지막 문단을 `{ "error": { "code", "message" } }` 전체 형식으로 확장하거나, EIA §5.1 에러 응답 절로 cross-link 를 추가한다.

---

### [INFO] CCH-CV-03 의 `running` 케이스 — Execution 상태 enum 과 정합

- **target 위치**: `spec/5-system/15-chat-channel.md` §3.2 CCH-CV-03 "(b) `running` (waiting_for_input 미도달)"
- **충돌 대상**: `spec/5-system/4-execution-engine.md` §1.1 Execution 상태 머신
- **상세**: 실행 엔진 §1.1 의 Execution 상태 enum 은 `pending / running / waiting_for_input / completed / failed / cancelled` 를 정의한다. CCH-CV-03 의 분기 (a)(b)(c) 는 이 중 `waiting_for_input`, `running`, `completed/failed/cancelled` 세 상태를 정확히 참조하며, 실행 엔진의 상태 전이 그래프와 완전 정합한다. 충돌 없음. `pending` 상태(큐 대기 중)에 대한 처리는 명시되어 있지 않으나, 이는 (b)의 `running` 케이스와 동일하게 "대기 안내 + 무시" 처리로 읽히며 의미상 합리적이다.
- **제안**: `pending` 상태를 (b) 케이스에 포함 명시하거나 각주로 처리 방침을 밝혀 모호성을 제거한다. 예: "(b) `running` 또는 `pending` (waiting_for_input 미도달)". 이는 CRITICAL/WARNING 수준의 충돌이 아닌 정확도 개선 사항이다.

---

### [INFO] Convention §4 step 3 dispatcher 책임 — §3.1 시퀀스 다이어그램과의 관계

- **target 위치**: `spec/conventions/chat-channel-adapter.md` §4 step 3 "재질문 `ChannelMessage` 생성·발송 책임은 호출자 (ChatChannelDispatcher / HooksService)"
- **충돌 대상**: `spec/5-system/15-chat-channel.md` §3.1 전체 시퀀스 다이어그램
- **상세**: §3.1 시퀀스 다이어그램은 `TelegramAdapter.sendMessage()` 를 최종 발송 단계로 표현하며, dispatcher (`chat-channel.dispatcher.ts`) 가 직접 `sendMessage` 를 호출하는 경로를 명시하지는 않는다. Convention §4 step 3 은 "재질문 ChannelMessage 발송 책임 = ChatChannelDispatcher/HooksService" 라고 명시하지만, §3.1 시퀀스에서 form 검증 실패 후 재질문 경로는 표현되어 있지 않다. 두 문서가 상호 모순은 아니지만 시퀀스 다이어그램이 정상 흐름만 표현하고 있어, 검증 실패 → dispatcher 재발송 경로가 누락된 상태다.
- **제안**: 15-chat-channel.md §3.1 시퀀스에 "form 검증 실패 → dispatcher 가 ChannelMessage(form_prompt 재질문) 발송" 분기 노트를 추가하거나, §3 에 §4 같은 form 다단계 서브시퀀스를 별도 절로 기술한다. 두 spec 간 완전한 정합이 가능하다.

---

### [INFO] EIA-AU-08 §3.3.1 union 타입과 `InteractionRequestContext` 기존 정의의 관계

- **target 위치**: `spec/5-system/14-external-interaction-api.md` §3.3.1 EIA-AU-08 Implementation Note
- **충돌 대상**: `spec/5-system/15-chat-channel.md` §5.1, §8 (InteractionRequestContext 필드 명세)
- **상세**: 15-chat-channel.md §5.1 은 `InteractionRequestContext.scope: 'in_process_trusted'` 를 하나의 optional 필드로 정의한다. §3.3.1 은 v2 에서 `ExternalInteractionRequestContext | InternalInteractionRequestContext` union 으로 분리할 것을 권고하며, 현재 optional 필드 단일 타입 방식의 한계를 명시한다. 두 spec 은 현재 v1 구현 방향에서는 모순이 없다 (15-chat-channel.md 의 §5.1 이 v1 현재 상태, §3.3.1 이 v2 권고). 하지만 §3.3.1 의 `ExternalInteractionRequestContext` 에 `tokenFamily: 'iext' | 'itk'` 가 필수 필드로 정의되어 있는 반면, 15-chat-channel.md §5.1 은 `tokenFamily` 와 `scope` 를 "직교적 의미" 로 구분한다고만 언급할 뿐 `tokenFamily` 가 현재 타입에서 어떤 필드인지 명시하지 않는다. v2 분리 시 현재 단일 타입에 `tokenFamily` 필드가 없거나 optional 이라면 union 분리 과정에서 breaking change 가 발생할 수 있다.
- **제안**: 15-chat-channel.md §5.1 또는 §8 에 현재 `InteractionRequestContext` 의 전체 필드 목록(또는 코드 SoT 링크)을 명시하거나, §3.3.1 에 "v2 분리 시 기존 `tokenFamily` 필드 추가 의무" 를 명시하여 migration path 를 불명확하게 두지 않는다.

---

### [INFO] EIA-IN-06 의 in-process 예외 표현과 §3.3.1 구조적 차단 요구의 계층

- **target 위치**: `spec/5-system/14-external-interaction-api.md` EIA-IN-06 "단 §3.3 EIA-AU-08 의 in-process trusted caller 는 제외 — HTTP 표면을 거치지 않는 in-process 호출에 한정"
- **충돌 대상**: `spec/5-system/14-external-interaction-api.md` §3.3.1 Guard/DTO 의무 제약
- **상세**: EIA-IN-06 과 §3.3.1 은 동일 spec 내 사안이지만, §3.3.1 이 새로 추가된 절로 "외부 HTTP 입력 경로에서 `scope` 플래그가 set 될 가능성을 구조적으로 차단해야 한다" 는 의무 제약을 새로 정의한다. EIA-IN-06 본문에는 §3.3.1 참조 (`§3.3 EIA-AU-08 의 ... 제외`) 만 있고 §3.3.1 자체로의 링크가 없다. EIA-IN-06 을 읽는 개발자가 §3.3.1 의 구현 제약을 놓칠 수 있다.
- **제안**: EIA-IN-06 요구사항 행에 "(구현 제약은 §3.3.1 EIA-AU-08 Implementation Note 참조)" 주석을 추가한다. 이미 EIA-AU-08 행 끝에는 §3.3.1 참조가 추가되었으나 EIA-IN-06 에는 없다.

---

### [WARNING] §5.4 성공 응답의 `chatChannelHealth` 필드명 — DB 컬럼 `chat_channel_health` 및 EIA 패턴과의 명명 관계

- **target 위치**: `spec/5-system/15-chat-channel.md` §5.4 200 OK 응답 `"chatChannelHealth": "healthy"`
- **충돌 대상**: `spec/1-data-model.md` §2.8 Trigger (`chat_channel_health` 컬럼), `spec/5-system/12-webhook.md` §3.4 WH-MG-09 (`chatChannelHealth` 배지)
- **상세**: API 응답에서 `chatChannelHealth` (camelCase) 를 반환하고 DB 컬럼은 `chat_channel_health` (snake_case) 다. 이는 일반적인 JSON API 관례(camelCase) 와 DB 컬럼 관례(snake_case) 의 표준적 분리이며 모순이 아니다. WH-MG-09 도 `chatChannelHealth` 를 UI 배지 필드명으로 일관되게 사용한다. 단, EIA 의 `notificationHealth` 필드 (outbound notification 건강도) 는 trigger 조회 응답에서 어떤 이름으로 노출되는지 14-external-interaction-api.md 에 명시되어 있지 않다. 두 health 필드 (`notificationHealth` / `chatChannelHealth`) 의 API 노출 명명 일관성이 15-chat-channel.md 에만 선행 정의되어 있고 EIA 에서는 누락된 상황이다.
- **제안**: 14-external-interaction-api.md §7.1 또는 §12 에 `notificationHealth` 가 Trigger 조회 응답에서 camelCase 로 노출됨을 명시하여 두 건강도 필드의 API 노출 명명 패턴을 대칭으로 갖춘다.

---

### [WARNING] Convention §2.3 `secretToken` — v1 plaintext 보관 범위가 `botTokenRef` 와 동일 plan 으로 묶임

- **target 위치**: `spec/conventions/chat-channel-adapter.md` §2.3 `secretToken` 주석 "v1 stub: ... DB(JSONB)에 평문 보관. secret store 연동은 별 plan `spec-update-chat-channel-bot-token-stub` 추적 (botTokenRef 와 동일 마이그레이션 경로)"
- **충돌 대상**: `spec/5-system/15-chat-channel.md` §4.1 botTokenRef 주석 "v1 stub: `config.chatChannel.botToken` 평문 필드로 stub. secret store 경로 분리는 별 plan `spec-update-chat-channel-bot-token-stub` 추적"
- **상세**: 두 spec 이 `secretToken` (webhook 인증용 server-issued secret) 과 `botTokenRef` (외부 Bot API token) 를 동일 plan `spec-update-chat-channel-bot-token-stub` 으로 추적한다고 명시한다. 그러나 두 자격증명의 보안 수준이 다르다. `botTokenRef` 는 외부 Bot API에 대한 전권한을 갖는 고위험 비밀이고, `secretToken` 은 webhook 인증 목적의 server-generated 32-char 값으로 상대적으로 낮은 위험도다. 동일 plan 으로 묶이면 v2 마이그레이션 우선순위 결정 시 혼선이 생길 수 있다.
- **제안**: `secretToken` 의 plan 추적을 별도 plan으로 분리하거나, 동일 plan 내에서 우선순위를 "botTokenRef 우선, secretToken 후속" 으로 명시한다. 또는 15-chat-channel.md §3.4 CCH-SE-03 에 두 자격증명의 위험도 차이와 마이그레이션 순서를 Rationale 로 기록한다.

---

### [WARNING] telegram.md §5.3 `phone` 필드 처리 — Form spec §1 의 `type` enum 과의 관계

- **target 위치**: `spec/4-nodes/7-trigger/providers/telegram.md` §5.3 phone 행
- **충돌 대상**: `spec/4-nodes/6-presentation/4-form.md` §1 (Form spec 의 `type` Enum — 직접 확인하지 않았으나 telegram.md 자체가 "Form spec [§1] 에 `ValidationRule.phone` 또는 명시적 pattern 예시가 spec 화되지 않아 어댑터 측 임시 가정" 이라고 명시)
- **상세**: telegram.md §5.3 는 `phone` type 이 Form spec 에 미존재함을 인지하고 "v1 은 `type: 'text'` + phone pattern custom ValidationRule 로 처리하기로 stub" 이라고 명시한다. 별 plan `spec-fix-form-phone-validation` 으로 추적한다고도 기재되어 있다. 이는 target spec 이 스스로 Form spec 과의 불일치를 인정하는 구조다. 현재 상태에서 어댑터가 Form spec 에 없는 `phone` ValidationRule 을 어댑터 내부에서 임시 적용하면, Form spec 을 기준으로 구현하는 다른 개발자(예: backend form 검증 로직)와의 동작 불일치가 발생한다. telegram 어댑터의 client-side 1차 검증이 backend server-side 검증보다 엄격하거나 다른 규칙을 적용하는 상황이 될 수 있다.
- **제안**: `spec-fix-form-phone-validation` plan 이 실제로 생성되어 있는지 확인하고, 해당 plan 에 "어댑터 측 임시 stub 동작 (phone pattern `/^\+?[\d\s\-()]+$/`)" 을 구체적으로 기재하여 추후 Form spec 갱신 시 어댑터 동작도 함께 정렬한다. 또한 telegram.md §5.3 의 phone 행 설명이 지나치게 길어 표 가독성을 해친다 — 본문 각주로 분리 검토.

---

### [WARNING] Rationale R8 "listener dedup / teardown 의무" — Convention §1.1 멱등성과의 순환 참조

- **target 위치**: `spec/5-system/15-chat-channel.md` Rationale R8 "setupChannel() 호출 시 동일 triggerId 의 기존 in-process listener 가 있으면 제거 후 새 listener 등록 — Convention §1.1 멱등성 보장"
- **충돌 대상**: `spec/conventions/chat-channel-adapter.md` §1.1 `setupChannel` 멱등성 행
- **상세**: Convention §1.1 은 `setupChannel` 이 "yes — 같은 config 재호출 OK" 라는 멱등성을 정의한다. R8 은 이 멱등성을 "listener 제거 후 재등록" 으로 구현하도록 의무화한다. 그런데 §1.1 의 멱등성 정의는 "같은 config 재호출 OK" 이지 "listener dedup 을 어떻게 구현해야 하는가" 는 정의하지 않는다. R8 이 Convention §1.1 을 "보장한다" 고 설명하지만, 실제로는 Convention 이 말하는 외부 채널 등록 멱등성(setWebhook 재호출이 ok) 과 R8 이 말하는 in-process listener dedup 는 다른 레이어의 문제다. Convention §1.1 은 외부 API 호출 레이어의 멱등성이고, R8 의 listener dedup 는 서버 내부 EventEmitter 레이어의 중복 방지다.
- **제안**: Convention §1.1 `setupChannel` 행에 "in-process listener dedup (CCH §R8) 도 setupChannel 멱등성 보장의 일환 — 동일 triggerId listener 기등록 시 제거 후 재등록" 주석을 추가하여 두 레이어의 멱등성 요구사항을 한 곳에 통합한다. 또는 R8 에서 "Convention §1.1 멱등성 보장" 표현을 "§1.1 멱등성의 서버 내부 구현 의무" 로 더 정확하게 표현한다.

---

## 요약

이번 변경(총 +104 -8 lines)은 Chat Channel 스펙의 여러 모호했던 구현 제약을 명확히 하는 내용이다. 검토 결과 기존 spec 과의 CRITICAL 수준 직접 모순은 발견되지 않았다. 데이터 모델(`spec/1-data-model.md` §2.8) 은 이미 변경 내용과 완전 정합하며, Execution 상태 enum(4-execution-engine.md §1.1) 과 CCH-CV-03 의 (a)/(b)/(c) 분기도 이상 없다. EIA-AU-08 의 in-process 예외와 EIA-IN-06 의 예외 조항도 상호 정합한다. WARNING 수준 사항 세 건은 (1) `botTokenRef`·`secretToken` 의 동일 plan 묶기로 인한 우선순위 혼선 가능성, (2) Form spec 미정의 `phone` type 에 대한 어댑터의 임시 stub 처리, (3) Convention §1.1 과 R8 의 멱등성 레이어 표현 모호성이다. INFO 수준 사항은 API 응답 래퍼 규칙 예외 명문화, 에러 형식 표기 정밀도, `pending` 상태 처리 미명시, dispatcher 책임의 시퀀스 다이어그램 반영 부재, union 타입 migration path, `notificationHealth` API 노출명 누락 등 동기화 권장 사항이다.

## 위험도

WARNING

STATUS: WARNING
