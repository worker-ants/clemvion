# Cross-Spec 일관성 검토 결과

**검토 대상**: `plan/in-progress/spec-draft-chat-channel.md`
**검토 일자**: 2026-05-21
**검토 관점**: 데이터 모델 충돌 / API 계약 충돌 / 요구사항 ID 충돌 / 상태 전이 충돌 / 권한·RBAC 모델 충돌 / 계층 책임 충돌

---

## 발견사항

### [WARNING] Trigger 테이블 신규 컬럼이 기존 `1-data-model.md` 에 미반영

- **target 위치**: §3.4.2 — `chat_channel_health / chat_channel_last_error / chat_channel_setup_at / chat_channel_token_v2_ref / chat_channel_rotated_at` 5개 신규 컬럼 정의
- **충돌 대상**: `spec/1-data-model.md §2.8 Trigger` 엔티티 테이블
- **상세**: `spec/1-data-model.md §2.8` 의 Trigger 엔티티 필드 표는 `notification_health / notification_last_error / notification_secret_v2 / notification_rotated_at` 까지만 열거되어 있다. draft 가 추가하는 `chat_channel_*` 5개 컬럼은 현재 데이터 모델 표에 없다. `1-data-model.md` 는 제품의 단일 진실(SoT)이므로, `15-chat-channel.md` 가 확정·반영될 때 반드시 `1-data-model.md §2.8` 도 동시에 갱신해야 한다.
- **제안**: `spec/15-chat-channel.md` 를 쓸 때 `spec/1-data-model.md §2.8` 의 Trigger 필드 표에 `chat_channel_*` 5개 컬럼을 추가하는 개정을 함께 진행. draft §2.5 에 "개정 — `spec/1-data-model.md §2.8`" 을 6번째 변경 대상으로 명시.

---

### [WARNING] `POST /api/triggers/:id/chat-channel/rotate-token` 엔드포인트 — EIA의 유사 엔드포인트와 명명 패턴 불일치

- **target 위치**: §3.2 CCH-SE-04 — `POST /api/triggers/:id/chat-channel/rotate-token`
- **충돌 대상**: `spec/5-system/14-external-interaction-api.md §3.1 EIA-NX-12` — `POST /api/triggers/:id/notification/rotate-secret`
- **상세**: EIA 가 정의한 notification secret rotation 엔드포인트는 `rotate-secret` 동사를 사용한다. draft 의 Chat Channel token rotation 엔드포인트는 `rotate-token` 이라는 다른 동사를 사용한다. 같은 트리거 자원 아래에 두 rotation 엔드포인트가 동사 불일치로 공존하게 된다. API 규칙 spec(`spec/5-system/2-api-convention.md`)과의 명시적 정합은 확인이 필요하다.
- **제안**: `rotate-token` / `rotate-secret` 중 하나로 통일하거나, token 과 secret 의 의미 차이(botToken vs HMAC signing secret)를 명시하는 주석을 해당 요구사항에 추가. 가능하면 CCH-SE-04 의 endpoint 를 `POST /api/triggers/:id/chat-channel/rotate-bot-token` 으로 구체화해 notification/rotate-secret 과 의미 혼동 차단.

---

### [WARNING] CCH-AD-06의 "in-process 호출" 방식이 EIA 인증 요구사항(EIA-AU-*)과 잠재 긴장

- **target 위치**: §3.2 CCH-AD-06, §3.5 Identity/보안 — 어댑터가 EIA inbound facade 를 in-process 호출하여 외부 토큰(`iext_*`/`itk_*`) 발급을 우회한다고 명시
- **충돌 대상**: `spec/5-system/14-external-interaction-api.md §3.3 EIA-AU-01~07` — 모든 inbound 요청은 interaction token 으로 인증(`EIA-IN-06`)
- **상세**: EIA-IN-06 은 "모든 inbound 요청은 §4 의 interaction token 으로 인증"이라고 정의한다. draft 는 어댑터가 동일 process 안의 trusted caller이므로 토큰 사이클을 우회한다고 명시한다. 이는 EIA HTTP 표면의 요구사항이 아니라 in-process facade 직접 호출이므로 원칙적으로 EIA-IN-06 과 직접 충돌하지는 않는다. 그러나 현행 EIA §10 의 구현 파일 구조(`interaction.service.ts`)에 in-process bypass path 가 명시되어 있지 않아, 구현 시 신규 bypass 진입점이 외부 인증 층을 실수로 우회하는 위험이 있다.
- **제안**: `15-chat-channel.md §3.5` 에 "어댑터는 HTTP 표면이 아니라 `InteractionService.dispatchCommand()` 내부 메서드를 직접 호출하는 것이며, 이 메서드 자체는 trusted internal caller 전용 접근 제어(예: NestJS Guard 제외 명시)가 설계되어야 한다"는 컨텍스트를 추가. 아울러 EIA §10 구현 파일 구조 또는 Rationale 에 "Chat Channel adapter in-process bypass path" 를 한 줄 언급.

---

### [WARNING] `14-external-interaction-api.md §2` 시나리오 표 개정 — 기존 행의 "흡수" 처리 방식

- **target 위치**: §7 — 기존 "외부 챗봇(Telegram/Slack/카카오) 위에 워크플로우 얹기" 행을 신규 "Chat Channel via Webhook" 행으로 **흡수** 제안
- **충돌 대상**: `spec/5-system/14-external-interaction-api.md §2 사용 시나리오 표` — 기존 행이 "외부 클라이언트가 직접 변환층 구현" 케이스를 설명하고 있음
- **상세**: draft §7 의 의도(기존 수동 변환 케이스와 서버사이드 어댑터 케이스를 구분)는 타당하다. 그러나 기존 행이 흡수·제거되면, 사용자가 직접 변환층을 구현하는 케이스(어댑터를 쓰지 않고 EIA를 직접 소비)의 예시가 사라진다. 이 케이스는 여전히 EIA 의 유효한 사용 시나리오다.
- **제안**: "흡수"보다 "두 행 병존"을 권장. 기존 행은 "사용자가 직접 변환층 구현 (advanced)" 으로 표기를 정제하고, 신규 행을 "Chat Channel via Webhook (서버사이드 어댑터)" 로 추가. 두 케이스를 모두 유지하면 EIA 의 사용 시나리오가 더 완전해진다.

---

### [INFO] `spec/4-nodes/7-trigger/0-common.md` — trigger 종류 목록 미반영

- **target 위치**: §2.3 위치 결정 — `spec/4-nodes/7-trigger/providers/` 서브디렉토리 신설
- **충돌 대상**: `spec/4-nodes/7-trigger/0-common.md §1` — "Manual, Webhook, Schedule 세 가지 트리거"라고 명시
- **상세**: `0-common.md §1` 에서 trigger 종류를 "Manual / Webhook / Schedule 세 가지"로 열거하고 있다. draft 는 새 트리거 유형을 추가하지 않으므로 이 목록 자체는 변경할 필요가 없다. 그러나 `providers/` 서브디렉토리가 생기면 `0-common.md §4 출력 구조 색인` 하단에 "Provider 확장 참고: [./providers/](./providers/)" 등의 cross-link 를 추가해야 file tree 탐색자가 발견할 수 있다.
- **제안**: `spec/15-chat-channel.md` 반영 시 `spec/4-nodes/7-trigger/0-common.md §4` 또는 CHANGELOG 에 providers 서브디렉토리 관련 cross-link 1줄 추가.

---

### [INFO] `spec/conventions/conversation-thread.md` — `channelUserKey` 를 metadata로 추가하는 명시 부재

- **target 위치**: §3.2 CCH-CV-04 — `conversation thread metadata 에 channelUserKey 저장`
- **충돌 대상**: `spec/conventions/conversation-thread.md §1.2 ConversationTurn` / `§1.3 ConversationThread` 필드 정의
- **상세**: draft §10 에서 "thread 의 자료구조·source enum 변경 없음 (어댑터가 user_id 를 metadata 로만 추가)"라고 명시한다. 그러나 `conversation-thread.md §1.3 ConversationThread` 에는 현재 `channelUserKey` 필드가 없다. "metadata 로만 추가"가 ConversationThread.metadata(JSONB 자유 필드) 를 활용하는 것인지, Redis ChannelConversation 레코드(§3.4.3)에만 보관하는 것인지 명확하지 않다. ConversationThread spec 에는 metadata 자유 필드가 없다.
- **제안**: draft §3.4.3 의 Redis 레코드에 `channelUserKey` 를 보관하고 ConversationThread 에는 변경이 없다면, 이를 `15-chat-channel.md §3.4.3` 에 명시해 conversation-thread spec 과의 무관계를 확인. draft §10 의 서술은 정확하지만, 실제로 ConversationThread 에 어떤 것도 추가하지 않는다는 점을 더 명확히 기술.

---

### [INFO] `spec/2-navigation/2-trigger-list.md` — Chat Channel 트리거의 UI 표현 미정의

- **target 위치**: §3.2 WH-MG-09 (draft) — 트리거 상세 화면에 `chatChannelHealth` 표시
- **충돌 대상**: `spec/2-navigation/2-trigger-list.md` — 트리거 목록 화면 spec (읽지 않았으나 존재 확인)
- **상세**: `WH-MG-07` 은 `notificationHealth` UI 표시를 정의하고 있다. draft 의 `WH-MG-09` 는 `chatChannelHealth` 의 표시를 권장하나, 트리거 목록/상세 화면 spec 에 대한 개정이 명시되지 않았다. Chat Channel 설정 UI(botToken 입력, provider 선택) 도 미정의.
- **제안**: 향후 구현 PR 에서 `spec/2-navigation/2-trigger-list.md` 개정이 필요함을 draft §11 후속 plan 또는 별도 plan 에 명시.

---

### [INFO] `spec/conventions/migrations.md` — Flyway 마이그레이션 번호 미예약

- **target 위치**: §3.4.2 — `chat_channel_*` 5개 컬럼 ALTER TABLE 정의
- **충돌 대상**: `spec/conventions/migrations.md` (존재 확인, 내용 읽지 않음)
- **상세**: EIA 의 `notification_*` 컬럼은 V기반 마이그레이션으로 관리되고 있다(`spec/1-data-model.md` Rationale 참조). Chat Channel 컬럼도 동일한 Flyway 버전 관리가 필요하지만 draft 에 마이그레이션 번호나 명명이 없다.
- **제안**: 구현 단계(PR-A 등) 착수 전에 `spec/conventions/migrations.md` 의 다음 버전 번호를 예약하고, draft 에 참조.

---

## 요약

Cross-Spec 일관성 관점에서 draft 는 전체적으로 기존 spec 의 구조와 원칙을 잘 따르고 있다. 주요 설계 결정(새 트리거 유형 미신설, EIA consumer 포지셔닝, facade 레이어 원칙)이 `12-webhook.md`·`14-external-interaction-api.md`·`1-data-model.md` 의 기존 결정과 정합한다. 다만 두 가지 WARNING 이 구현 단계로 가기 전에 해소되어야 한다. (1) `1-data-model.md §2.8` 의 Trigger 필드 표가 `chat_channel_*` 컬럼 추가를 반영하지 않으면 DB 설계 SoT 가 갈라진다. (2) CCH-AD-06 의 in-process bypass path 가 EIA-AU 계층의 외부 표면과 구조적으로 분리됨을 구현 spec에 명시하지 않으면 in-process 경로가 우발적으로 인증을 우회하는 취약점이 발생할 수 있다. 두 WARNING 은 `spec/15-chat-channel.md` 작성 시 반드시 함께 해소해야 한다.

---

## 위험도

**MEDIUM** — CRITICAL 충돌 없음. WARNING 2건이 spec 확정 및 구현 전 해소 필요.
