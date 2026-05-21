# Cross-Spec 일관성 검토 결과

**검토 대상**: `plan/in-progress/spec-draft-chat-channel.md`
**검토 일시**: 2026-05-21
**검토 모드**: `--spec` (spec draft 검토)

---

## 발견사항

### [WARNING] EIA §2 사용 시나리오 표 — 기존 행 의미와 신규 행 경계 모호

- **target 위치**: draft §7.1 — "외부 챗봇 위에 워크플로우 얹기" 기존 행을 "사용자가 직접 변환층 구현 (advanced)" 로 정제하고 신규 행 추가
- **충돌 대상**: `/spec/5-system/14-external-interaction-api.md` §2 사용 시나리오 표 — 현행 2행 "외부 챗봇(Telegram/Slack/카카오) 위에 워크플로우 얹기"
- **상세**: 현행 EIA §2 의 2행은 "봇 메시지 → webhook 으로 워크플로우 시작 → AI Multi Turn 진입 시 notification 으로 어시스턴트 응답 받기 → 사용자 메시지마다 REST `submit_message`" 를 기술하며, 이것이 곧 draft 의 "어댑터 없이 사용자가 직접 구현하는 advanced 케이스"와 "서버사이드 어댑터 사용 케이스" 두 가지를 구분 없이 포함하고 있다. draft 는 이 기존 행을 "advanced" 로 좁히면서 어댑터 사용 행을 새로 추가하는데, 기존 행의 설명 ("봇 메시지 → webhook…") 이 실제로는 어댑터가 있어도 동일하게 성립하므로 두 행의 경계가 불명확해질 수 있다.
- **제안**: EIA §2 개정 시 두 행의 구분 기준을 명시적으로 표기. "사용자가 직접 변환층을 구현하는 경우" 행에 "서버사이드 어댑터(`config.chatChannel`)를 사용하지 않는" 수식어를 명시. 신규 어댑터 행은 "Webhook 트리거 `config.chatChannel` 등록만으로 자동 통합 — 어댑터 코드 불필요" 로 차별화.

---

### [WARNING] EIA R10 의 단일 sink 정책과 Chat Channel 어댑터 구독 메커니즘 충돌 가능성

- **target 위치**: draft §3.2 CCH-AD-05 / §3.3 처리 흐름 다이어그램 / §3.5 보안 §R10 관계 / draft §2.5 EIA §R10 추가 단락
- **충돌 대상**: `/spec/5-system/14-external-interaction-api.md` §R10 "WebsocketService 단일 sink 정책의 확장" — "실행 엔진은 여전히 `WebsocketService.emitToExecution` 한 곳만 호출 (= 단일 sink). NotificationDispatcher 는 별도 outbox/after-commit hook 으로 트리거. SSE 어댑터는 Redis pub/sub 으로 WebsocketService 가 발행한 이벤트를 구독"
- **상세**: 현행 EIA §R10 은 NotificationDispatcher 가 **outbox/after-commit hook** 으로 트리거되고, SSE 어댑터는 **Redis pub/sub** 으로 WebsocketService 이벤트를 구독하는 구조를 명시한다. 그런데 draft 의 CCH-AD-05 와 §2.5 추가 단락은 Chat Channel 어댑터가 "NotificationDispatcher 의 after-commit EventEmitter 에 in-process listener 로 attach" 한다고 기술한다. 즉 현행 EIA spec 이 Redis pub/sub 경로를 상정하는 곳에서, draft 는 "같은 process 안에서는 EventEmitter 가 충분" 이라며 Redis 우회를 선언한다. 두 모델은 NotificationDispatcher 가 EventEmitter 를 노출하는 레이어에 대한 전제가 다르다. 현행 EIA §R10 에서는 NotificationDispatcher 가 EventEmitter 를 외부에 노출한다는 언급이 없다.
- **제안**: draft 의 §2.5 에서 EIA §R10 에 추가할 단락을 명시적으로 "NotificationDispatcher 가 **in-process EventEmitter 를 노출하는 새 인터페이스를 추가**하며, SSE 어댑터의 Redis pub/sub 경로와 Chat Channel 어댑터의 in-process EventEmitter 경로가 **병존**한다" 는 형태로 명확히 기술해야 EIA §R10 과 충돌이 없어진다. 아니면 Chat Channel 어댑터도 SSE 어댑터처럼 Redis pub/sub 을 구독하도록 정렬하는 대안도 검토 필요.

---

### [WARNING] EIA §3.3 인증 표 — EIA-AU-08 신설이 기존 인증 정책에 새 예외 경로를 도입

- **target 위치**: draft §7.2 / §3.2 CCH-AD-06 / §3.5 보안
- **충돌 대상**: `/spec/5-system/14-external-interaction-api.md` §3.3 인증 (EIA-AU-01 ~ EIA-AU-07) — "모든 inbound 요청은 §4 의 interaction token 으로 인증" (EIA-IN-06)
- **상세**: EIA-IN-06 은 "모든 inbound 요청은 interaction token 으로 인증" 을 필수로 선언한다. draft 의 EIA-AU-08 은 "in-process trusted caller 는 토큰 발급/검증을 우회" 를 예외로 추가한다. 이 예외는 EIA-IN-06 의 "모든" 에 의미 있는 구멍을 뚫는 것이므로, EIA-IN-06 의 문구 자체도 "단, EIA-AU-08 의 in-process caller 예외를 제외한다" 는 교차 참조를 명시해야 한다. 현재 draft 는 EIA-AU-08 행만 추가하고 EIA-IN-06 수정을 명시하지 않아 두 요구사항이 표면적으로 충돌 상태에 놓인다.
- **제안**: EIA §3.2 의 EIA-IN-06 행 비고에 "단, EIA-AU-08 의 in-process trusted caller 는 제외" 를 추가하거나, §3.3 의 EIA-AU-08 에서 EIA-IN-06 을 명시적으로 수정 대상으로 지목.

---

### [WARNING] 1-data-model §2.8 Trigger 표 — draft 신규 컬럼이 기존 표에 없고 개정 경계 불명확

- **target 위치**: draft §2.6 / §3.4.2 신규 컬럼
- **충돌 대상**: `/spec/1-data-model.md` §2.8 Trigger 표 — 현행 `notification_health`, `notification_last_error`, `notification_secret_v2`, `notification_rotated_at` 4개 컬럼 존재. `chat_channel_*` 컬럼 미존재.
- **상세**: draft 는 `chat_channel_health`, `chat_channel_last_error`, `chat_channel_setup_at`, `chat_channel_token_v2`, `chat_channel_rotated_at` 5개 컬럼을 추가한다고 명시하고 "§2.8 동시 갱신" 을 지시한다. 현행 data-model §2.8 Trigger 표는 이 컬럼들이 없으므로 draft 가 채택되면 data-model 도 반드시 수정해야 한다. 이는 draft 가 스스로 명시하고 있어 충돌이라기보다는 조율 의존관계이다. 그러나 컬럼 이름 세부에 잠재 비일관성이 있다: 기존 `notification_secret_v2` 와 신규 `chat_channel_token_v2` 는 naming 패턴은 같지만 저장하는 값의 semantic 이 다르다 — 전자는 HMAC secret rotation 값이고 후자는 provider bot token rotation 값이다. 이 차이가 data-model §2.8 에 주석으로 명시되어야 혼동이 없다.
- **제안**: data-model §2.8 개정 시 `chat_channel_token_v2` 컬럼 설명에 "bot token reference (notification_secret_v2 와 달리 외부 provider token reference 를 보관)" 를 명시. draft §3.4.2 주석에도 이 semantic 차이를 한 줄 추가.

---

### [WARNING] 12-webhook §3.4 관리 표 — WH-MG-08 / WH-MG-09 추가 시 WH-MG-07 과 의미 중복

- **target 위치**: draft §6.2 — WH-MG-08 / WH-MG-09 신설
- **충돌 대상**: `/spec/5-system/12-webhook.md` §3.4 관리 표 — WH-MG-07 "트리거 상세 화면에 `notificationHealth` 표시 (unknown / healthy / degraded)"
- **상세**: WH-MG-07 은 `notificationHealth` 배지를 트리거 상세 화면에 표시하는 요구사항이다. draft 의 WH-MG-09 는 `chatChannelHealth` 표시를 동일 화면에 추가한다. 두 요구사항은 동일 UI 영역(트리거 상세 드로어)에서 각각 다른 health 상태를 표시하므로 기능적 충돌은 없지만, 두 배지를 어느 위치에 어떤 순서로 표시하는지, 그리고 `spec/2-navigation/2-trigger-list.md` 의 트리거 상세 드로어 spec 이 WH-MG-07 의 `notificationHealth` 배지를 이미 정의하고 있는지 여부가 불명확하다.
- **제안**: `spec/2-navigation/2-trigger-list.md` 의 트리거 상세 드로어 spec 을 확인하여 `notificationHealth` 배지 UI 정의가 있는지 검토. 있다면 `chatChannelHealth` 배지를 동일 형식으로 나란히 배치하는 규칙을 follow-up plan(PR-A 동반 작업 — draft §11 에 I3 로 언급됨)에 명시.

---

### [INFO] EIA §2 기존 행 제목 변경 — 내용 축소 없이 표현만 변경

- **target 위치**: draft §7.1 / §2.5 — "외부 챗봇 위에 워크플로우 얹기" → "외부 챗봇 — 사용자가 직접 변환층 구현 (advanced)" 로 정제
- **충돌 대상**: `/spec/5-system/14-external-interaction-api.md` §2 표 2행
- **상세**: 기존 행의 설명문 ("봇 메시지 → webhook 으로 워크플로우 시작 → … 사용자 메시지마다 REST `submit_message`") 은 변경 없이 제목 라벨만 "advanced" 로 좁히는 것이므로 기능적 모순은 없다. 그러나 변경 후 "advanced" 가 무엇을 의미하는지 설명 부족 — 어댑터 사용 행과의 차이를 독자가 바로 이해할 수 있도록 "(서버사이드 어댑터를 사용하지 않는 fully-custom 통합)" 같은 부연이 행 설명에 추가되면 명확해진다.
- **제안**: draft §7.1 에서 기술하는 기존 행 정제 시 "서버사이드 어댑터(`config.chatChannel`) 미사용, 사용자가 직접 변환층 구현" 를 괄호 설명으로 추가.

---

### [INFO] 요구사항 ID prefix CCH-* — 기존 spec 에서 미사용 확인됨

- **target 위치**: draft §3.2 — CCH-AD-*, CCH-CV-*, CCH-MP-*, CCH-SE-*, CCH-NF-* 전체
- **충돌 대상**: 전체 `spec/**` 검색
- **상세**: `CCH-` prefix 는 기존 spec 어디에도 사용되지 않으므로 ID 충돌 없음. `WH-MG-08` / `WH-MG-09` 도 현행 12-webhook §3.4 의 최대 ID 가 WH-MG-07 이므로 순차적으로 정상. `EIA-AU-08` 도 현행 EIA §3.3 의 최대 ID 가 EIA-AU-07 이므로 순차적으로 정상.
- **제안**: 문제 없음. 확인 완료.

---

### [INFO] `chat-channel-adapter.md` 를 `spec/conventions/` 에 두는 위치 — 기존 패턴과 정합

- **target 위치**: draft §2.2 / R-H
- **충돌 대상**: `/spec/conventions/` 기존 거주자 — `node-output.md`, `conversation-thread.md`, `cafe24-api-metadata.md`
- **상세**: draft 의 R-H 에서 기술한 근거 ("복수 구체 구현이 따르는 공통 계약") 는 `conventions/` 의 기존 거주자들과 동일한 패턴이다. 위치 충돌 없음.
- **제안**: 문제 없음. 확인 완료.

---

### [INFO] `spec/4-nodes/7-trigger/providers/` 서브디렉토리 신설 — 기존 파일 구조와 충돌 없음

- **target 위치**: draft §2.3 / R-G
- **충돌 대상**: `/spec/4-nodes/7-trigger/` — 현행 `0-common.md`, `1-manual-trigger.md` 만 존재
- **상세**: `providers/` 서브디렉토리 신설은 기존 파일에 영향을 주지 않는다. `0-common.md` 의 §4 출력 구조 색인이 수동 트리거만 열거하고 있으므로, providers 디렉토리 추가 시 `0-common.md` 에 "provider 어댑터 문서는 `providers/` 서브디렉토리 참조" 한 줄 cross-link 를 추가하면 탐색성이 높아진다.
- **제안**: `spec/4-nodes/7-trigger/0-common.md` 에 providers 서브디렉토리 cross-link 추가를 draft §11 의 PR-A 동반 작업으로 명시.

---

### [INFO] Flyway 마이그레이션 슬롯 번호 예약 — migrations.md 갱신 의무

- **target 위치**: draft §3.4.2 주석 / §11 PR-A 사전 의무
- **충돌 대상**: `/spec/conventions/migrations.md` §5 새 마이그레이션 추가 절차
- **상세**: draft 는 PR-A 착수 직전 `migrations.md` 에서 슬롯 예약을 의무로 명시하고 있다. 현행 `migrations.md` 의 §5 절차를 따라야 하므로 충돌은 없고 절차 준수 사항임. 단, `chat_channel_*` 컬럼 추가 1개 + 관련 INDEX 마이그레이션이 몇 개 슬롯을 필요로 하는지 draft 에서 사전 명시하지 않은 점은 착수 전 확인이 필요하다.
- **제안**: 문제 없음. PR-A 착수 전 절차 준수로 해결.

---

## 요약

target draft 는 전반적으로 기존 EIA spec 의 facade 원칙·단일 sink 정책·인증 모델과 **의도적으로 정합**하도록 설계되어 있으며, 요구사항 ID 충돌·엔티티 정의 직접 모순·API 계약 충돌은 발견되지 않았다. 다만 세 가지 WARNING 이 존재한다: (1) EIA §R10 의 단일 sink 구조(WebsocketService → Redis pub/sub) 와 draft 가 제안하는 NotificationDispatcher in-process EventEmitter 직접 구독 모델 간의 아키텍처 전제 차이 — 현행 EIA spec 에 EventEmitter 노출 인터페이스가 명시되지 않았으므로 EIA §R10 개정이 이 변경을 명시적으로 포함해야 한다. (2) EIA-IN-06 ("모든 inbound 요청은 토큰 인증") 과 EIA-AU-08 (in-process 예외) 의 명시적 교차 참조 누락 — EIA-IN-06 문구 수정이 필요하다. (3) EIA §2 사용 시나리오 표에서 기존 행과 신규 행의 경계가 독자에게 즉시 명확하지 않을 수 있어 설명 보강이 필요하다. 나머지 발견사항은 INFO 수준의 명명 일관성·cross-link·탐색성 개선 사항이다.

---

## 위험도

MEDIUM
