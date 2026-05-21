# API 계약(API Contract) 리뷰 결과

**리뷰 대상**: Chat Channel (Telegram) 어댑터 도입 — spec 파일군 + 데이터 모델 확장
**리뷰 일시**: 2026-05-22

---

## 발견사항

### [WARNING] `POST /api/triggers/:id/chat-channel/rotate-bot-token` — HTTP 상태 코드 및 응답 형식 미명시

- **위치**: `spec/5-system/15-chat-channel.md` §3.4 CCH-SE-04 (권장 등급)
- **상세**: Bot token rotation API (`POST /api/triggers/:id/chat-channel/rotate-bot-token`) 가 요구사항으로 선언되었지만 HTTP 응답 코드, 응답 바디 형식, 오류 케이스(old token 미존재 / grace 기간 중 재호출 / provider API 실패)에 대한 응답 계약이 명시되어 있지 않다. 유사한 EIA endpoint `POST /api/triggers/:id/notification/rotate-secret` 도 동일 spec 에서 구체 응답 형식을 정의하지 않은 점은 동일하나, 신규 endpoint 를 도입할 때 클라이언트가 구현 가능한 수준의 계약을 명시하는 것이 권장된다.
- **제안**: CCH-SE-04 에 "성공: 200 + `{ newTokenRef, gracePeriodUntil }`, 실패(provider 오류): 502 + 표준 에러 바디" 정도의 응답 계약 인라인을 추가하거나, `spec/5-system/15-chat-channel.md` §4 데이터 모델 섹션에 rotation API 응답 shape 절을 신설.

---

### [WARNING] Webhook 처리 흐름 Chat Channel 분기 — `202 Accepted` 응답 바디의 spec 불일치 가능성

- **위치**: `spec/5-system/12-webhook.md` §7 처리 흐름 7c·7f 단계
- **상세**: 기존 경로(chatChannel 없음)는 단계 10 에서 `202 Accepted + { executionId }` 를 반환하도록 명시되어 있다. Chat Channel 분기(단계 7c)는 `update === null` 인 경우 `202 Accepted + { ignored: true }` 를 반환하고, 단계 7f 는 `202 Accepted` 즉시 반환으로만 기술되어 있어 `executionId` 포함 여부가 불명확하다. 클라이언트(Telegram Bot API 는 신경 쓰지 않지만, 운영 모니터링 / 개발자 테스트 클라이언트)가 executionId 를 기대하면 문제가 된다.
- **제안**: `spec/5-system/12-webhook.md` 단계 7f 의 응답을 "202 Accepted + `{ executionId?, conversationKey }` (새 execution 시작인 경우 `executionId` 포함, 기존 execution forwarding 인 경우 생략 가능)" 로 명확화. `{ ignored: true }` 와 `{ executionId }` 두 shape 이 동일 endpoint, 동일 HTTP status 에서 나오는 구조를 API 계약으로 명시.

---

### [WARNING] EIA-AU-08 in-process trusted caller 예외 — Guard 구현 계약 공백

- **위치**: `spec/5-system/14-external-interaction-api.md` §3.3 EIA-AU-08 (신설)
- **상세**: EIA-AU-08 은 "외부 HTTP guard 는 ctx 합성 시 `scope: 'in_process_trusted'` 플래그를 절대 set 하지 않는다" 라고 명시하지만, 이 제약을 강제하는 구현 계약(Guard 코드에 어떤 조건 검사가 추가되어야 하는가)이 spec 에 기술되어 있지 않다. Guard 구현자가 HTTP 요청 path 에서 이 플래그를 오기입하는 것을 막는 방어 계약이 없으면 인증 bypass 취약점이 발생한다.
- **제안**: EIA-AU-08 에 "구현 요건 — `InteractionGuard` 는 HTTP 요청에서 합성되는 `InteractionRequestContext` 에 `scope` 필드를 추가하는 코드 path 를 가지지 않아야 한다. `scope: 'in_process_trusted'` 는 오직 서버 내부 모듈(ChatChannelAdapter 등)이 ctx 를 직접 생성할 때만 set 가능" 를 Implementation Note 로 추가.

---

### [INFO] `POST /api/triggers/:id/chat-channel/rotate-bot-token` — API 규약 중첩 depth 예외 처리됨, 단 예외 등록 근거 명확화 권장

- **위치**: `spec/5-system/2-api-convention.md` §2.2 (신규 예외 행 추가)
- **상세**: `spec/5-system/2-api-convention.md §2.2` 에 "RPC-style sub-channel action" 예외를 추가해 depth 4 endpoint 를 허용했다. 이미 기존 `/api/triggers/:id/notification/rotate-secret` 와 `/api/triggers/:id/interaction/revoke-token` 도 같은 패턴이므로 소급 적용 형태로 예외가 정착된 것은 적절하다. 단, 예외 조건("자원 자체가 아닌 sub-channel 의 부작용 동작") 이 명확해 새 endpoint 추가 시 남용 여지가 낮다. 조치 불필요이나 예외 추가 시 기존 선례와의 일관성 확인을 체크리스트에 포함하는 것을 권장.

---

### [INFO] `CCH-SE-03` 에서 명시한 "config JSONB 평문 금지" — v1 구현 예외가 spec 에 선언되지 않은 상태

- **위치**: `spec/5-system/15-chat-channel.md` §3.4 CCH-SE-03
- **상세**: consistency 리뷰(`review/consistency/2026/05/21/23_49_16/plan_coherence.md` §INFO botTokenRef v1 구현 형식 ambiguity) 에서 이미 확인된 사항으로, `plan/in-progress/chat-channel-impl.md §3.4` 에서 v1 구현은 `Trigger.config.chatChannel.botToken` 평문 보관을 선택했다. 현행 spec CCH-SE-03 이 "config JSONB 평문 금지" 를 "필수" 등급으로 선언하는 상태에서 구현이 이를 어기면 API 계약·보안 정책 위반이 된다. plan 에 "post-impl spec 갱신" 추적이 있으나, spec 파일 자체에는 해당 v1 예외가 명시되지 않아 리뷰어·감사 시 혼선이 발생할 수 있다.
- **제안**: CCH-SE-03 에 "v1 구현 단계에서는 notification.signing.secret stub 과 동일한 평문 보관 허용 (spec-update-chat-channel-bot-token-stub plan 으로 추적). secret store reference 로 전환 시 해당 plan 완료 후 본 요구사항 갱신" 을 인라인 비고로 명시. 이렇게 하면 API 계약이 구현 현실과 일치하게 된다.

---

### [INFO] WH-MG-08 — `chatChannel` 필드 누락 시 응답 동작이 기존 동작 호환 선언으로만 서술

- **위치**: `spec/5-system/12-webhook.md` WH-MG-08
- **상세**: "chatChannel 미존재 시 일반 webhook 트리거 (기존 동작 그대로)" 로 하위 호환성을 선언하고 있어 Breaking Change 없음은 명확하다. 요청 검증 관점에서, `chatChannel` 필드가 존재하지만 `provider` 가 미지원 값인 경우(`"provider": "unsupported-chat"`) 어떤 HTTP 상태 코드로 어느 시점(트리거 등록 시 / webhook 수신 시)에 반환하는지가 불명확하다.
- **제안**: WH-MG-08 또는 CCH-AD-01 에 "미지원 `provider` 값으로 트리거를 등록하려 하면 422 Unprocessable Entity + 에러 코드(예: `CHAT_CHANNEL_PROVIDER_NOT_SUPPORTED`)" 를 명시.

---

### [INFO] `CCH-CV-03` — `running` 상태 execution 에 두 번째 메시지 도착 시 동작 미명시

- **위치**: `spec/5-system/15-chat-channel.md` §3.2 CCH-CV-03
- **상세**: consistency 리뷰(`review/consistency/2026/05/21/23_49_16/cross_spec.md`) 에서도 지적된 사항. `waiting_for_input` 과 "종료된 execution" 두 케이스만 정의하고 `running` 상태 케이스가 누락되어 있다. API 계약 관점에서, 클라이언트가 두 번째 메시지를 보낸 경우 `running` 상태라면 어댑터가 무시 + `202 Accepted` 를 반환하는지, 대기 큐에 적재하는지, 아니면 오류를 채널 메시지로 발송하는지가 불분명하다.
- **제안**: CCH-CV-03 에 `running` 상태 케이스를 추가 — 예: "running 이면 채널에 '처리 중' 안내 메시지를 발송하고 update 를 무시 (202 Accepted)".

---

## 요약

이번 변경은 Chat Channel(Telegram) 어댑터 도입을 위한 spec 신설·기존 spec 확장으로, 실제 API 계약에 직접 영향을 미치는 변경이 다수 포함되어 있다. **하위 호환성** 측면에서는 `chatChannel` 필드가 선택 필드로 설계되어 기존 webhook 클라이언트에 Breaking Change 가 없고, 요청 검증(CCH-AD-01), 인증/인가(EIA-AU-08 in-process 예외), URL 설계(API 규약 예외 명문화)가 전반적으로 체계적으로 정의되어 있다. 주요 위험은 세 곳에 집중된다. 첫째, rotation API(`CCH-SE-04`)와 Chat Channel 분기 응답(`202` 분기)의 **응답 형식 계약이 불완전**해 클라이언트 구현 및 모니터링 도구가 응답을 일관되게 처리하기 어렵다. 둘째, EIA-AU-08 의 in-process trusted caller 예외는 Guard 구현 측의 **음의 의무(플래그를 set 하지 말 것)**가 코드 수준 계약으로 강제되지 않아 잘못 구현 시 인증 bypass 취약점이 생긴다. 셋째, CCH-SE-03 의 "평문 금지" 요구사항과 v1 구현의 실제 평문 저장 방침 사이의 **spec-코드 불일치** 가 spec 에 명시되지 않아 감사 혼선 위험이 있다.

---

## 위험도

**MEDIUM**
