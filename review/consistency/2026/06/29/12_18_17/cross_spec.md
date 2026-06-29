# Cross-Spec 일관성 검토 — `spec/4-nodes/7-trigger/providers/slack.md`

검토 대상: Slack Chat Channel Adapter (draft). 대조한 SoT: Chat Channel spec (`spec/5-system/15-chat-channel.md`), Chat Channel Adapter convention (`spec/conventions/chat-channel-adapter.md`), Telegram/Discord 어댑터, Webhook spec (`spec/5-system/12-webhook.md`), EIA spec (`spec/5-system/14-external-interaction-api.md`), Form spec (`spec/4-nodes/6-presentation/4-form.md`), secret-store convention (`spec/conventions/secret-store.md`), data-model (`spec/1-data-model.md`).

## 발견사항

### [INFO] `200 OK` 예외 행이 Chat Channel §5.5 에 이미 흡수됨 — Rationale 의 "후속 갱신 대상" 문구가 stale
- target 위치: §6 보안 "Slack 특이 예외" 2번 + Rationale R-S-8 ("Spec Chat Channel §5.5 의 case 표에 ... 행 추가가 후속 갱신 대상")
- 충돌 대상: `spec/5-system/15-chat-channel.md §5.5` (lines 418–419) + §5.5.1
- 상세: 모순은 아니다. R-S-8 / §6 본문은 url_verification(200+challenge) 과 Interactivity ack(200) 을 "§5.5 의 후속 갱신 대상" 으로 기술하나, Chat Channel §5.5 의 케이스 매트릭스에는 이미 "Slack URL Verification" / "Slack Interactivity ack" 두 행이 정식 반영되어 있고 §5.5.1 provider-specific 예외 정책까지 존재한다. 즉 약속된 동기화가 이미 완료된 상태라 target 의 "후속 갱신 대상" 표현만 시점이 어긋난다.
- 제안: target Rationale R-S-8 마지막 문장과 §6 "Slack 특이 예외 2" 의 "후속 갱신 대상이거나" 문구를 "§5.5 / §5.5.1 에 반영 완료" 로 갱신. spec 동작 자체는 정합하므로 비차단.

### [INFO] R-S-1 의 `issuedInboundSigning` 발급 주체 진술이 Convention/secret-store 와 정합 (확인용 기록)
- target 위치: §6 보안 "Config 필드" + Rationale R-S-1
- 충돌 대상: `chat-channel-adapter.md §2.4 SetupResult.issuedInboundSigning` + `secret-store.md §5.5 (b)`
- 상세: target 은 Slack signing secret 을 provider-issued(사용자 manual 입력)로 보고 `SetupResult.issuedInboundSigning` 을 비운다고 기술 — Convention §2.4 ("Slack/Discord 처럼 사용자가 manual 입력하는 provider 는 본 필드를 채우지 않는다") 및 secret-store §5.5 (b) 경로(`dto.chatChannel.inboundSigningPlaintext` → `rotate(ref,...)` → strip)와 정확히 일치. 충돌 없음.
- 제안: 조치 불필요.

### [INFO] Slack signing secret 형식 검증(`^[a-f0-9]{32}$`) 이 Chat Channel §4.1 과 일치
- target 위치: §6 보안 Signing Secret "형식 (Slack 발급 표준)" — lowercase hex 32 chars, `assertInboundSigningPlaintextByProvider` 가 trigger 생성 시 정규식 검증
- 충돌 대상: `15-chat-channel.md §4.1` line 202 (`slack=lowercase hex 32 chars (signing secret)`)
- 상세: 길이·대소문자·검증 시점·400 `VALIDATION_ERROR(field='inboundSigningPlaintext')` 모두 동일. Discord(64 hex) 와도 충돌 없음 — 두 provider 가 동일 `inboundSigningRef` 슬롯을 공유하되 backend provider 분기로 형식·알고리즘을 흡수한다는 Convention §2.3 설계와 일관.
- 제안: 조치 불필요.

## 정합 확인 항목 (충돌 없음 — 근거)
- **데이터 모델**: `botIdentity.botId: number` (slack §3.1 `hashStringToInt`) ↔ Convention §2.3 / data-model §2.3·§2.8 정합. `teamId` 는 workspace 개념 provider 한정 채움(slack 채움, telegram 비움)으로 Convention §2.3 의 optional 의미와 일치. `chat_channel_*` 컬럼·`hasBotToken` derived·`source_ip`/`response_code`(V096) 신규 도입 없음 — 기존 data-model 재사용.
- **API 계약**: `rotate-bot-token`(CCH-SE-04) / `auth.revoke`(`revokeBotToken?` 옵션 메서드) / inbound 200 vs 202 예외 / `views.open` 게이팅(`openFormModal?`) 모두 Convention §1·§4.1 + Chat Channel §5.4·§5.5 + Webhook §7 step 7f 와 일치. `submit_form` 검증 실패 `400 VALIDATION_ERROR + error.details[{field,message,code}]` → `response_action: errors` 매핑이 EIA-IN-10 / EIA-RL-03 와 정합.
- **요구사항 ID**: target 이 인용한 `CCH-CV-05`/`CCH-ERR-03`/`CCH-MP-01~04`/`CCH-SE-01·03·04`/`R-CCA-8`/`SS-SE-01` 전부 다른 spec 에 실재(dangling 없음). target 은 자체 `R-S-*` rationale 만 신설 — provider-namespaced 라 충돌 없음.
- **상태 전이**: `chat_channel_health` (unknown/healthy/degraded), CCH-CV-03 conversation 분기, 비활성 trigger 202 silent skip(WH-EP-07) 모두 SoT 와 일치. 자동 비활성화 금지 정책 보존.
- **권한·RBAC**: target 은 RBAC 모델 신규 도입 없음(trigger 도메인 기존 권한 그대로).
- **계층 책임**: `parseUpdate` pure / `HooksService` 가 `files.info`·`views.open` side-effect 담당(R-S-7) — Convention §1.1 pure 계약 + §1.1 `openFormModal?` caller 책임 분배와 일치. `private_metadata` 에 conversationKey 평문 적재(자격증명 배제)는 SS-SE-01 정신 위배 아님(slack-specific 구현 디테일, convention 미저촉).

## 요약
Slack 어댑터 draft 는 Chat Channel spec·Chat Channel Adapter convention·Webhook·EIA·Form·secret-store·data-model 의 cross-cutting 표면과 매우 높은 정합성을 보인다. 데이터 모델/API 계약/요구사항 ID/상태 전이/계층 책임 어느 관점에서도 다른 영역과의 직접 모순은 발견되지 않았다. 신규 요구사항 ID 를 minting 하지 않고 기존 `CCH-*`/`R-CCA-*`/`SS-*` ID 를 인용만 하며, 200 OK 예외·signing secret 형식·inbound-signing 슬롯 공유·native modal 게이팅 등 잠재 충돌 지점이 모두 SoT 에 사전 반영되어 있다. 유일한 비차단 잡음은 Rationale R-S-8/§6 의 "Chat Channel §5.5 후속 갱신 대상" 문구가 이미 동기화 완료된 상태라 시점상 stale 하다는 점뿐이다.

## 위험도
LOW
