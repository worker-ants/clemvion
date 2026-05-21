# Rationale 연속성 검토

검토 대상: `plan/in-progress/spec-draft-chat-channel.md`
검토 모드: `--spec`
검토일: 2026-05-21

---

## 발견사항

### [WARNING] 트리거 유형 카탈로그 "2종" 표현이 기존 spec 3종과 불일치
- **target 위치**: §1 "합의된 설계 결정" 1번 — "트리거 유형 카탈로그는 Manual / Webhook 2종 그대로 유지"
- **과거 결정 출처**: `spec/4-nodes/7-trigger/0-common.md` §1 표 — "Manual, Webhook, Schedule 세 가지 트리거" 명시. §3.1 의 `__triggerSource` 주입 설명에도 Schedule 이 포함됨
- **상세**: 기존 trigger 종류는 3종 (Manual / Webhook / Schedule) 인데 target 이 "2종 그대로 유지" 라고 기술해 Schedule 트리거를 누락시킨다. Chat Channel 기능 자체의 설계 의도 (Webhook 트리거에 config 한 갈래로 붙이는 것) 는 문제없지만, 카탈로그 크기 표현이 현행 spec 과 충돌한다. 후속 spec 병합 시 독자가 Schedule 트리거의 존재를 오해할 수 있다.
- **제안**: "트리거 유형 카탈로그는 Manual / Webhook / Schedule 3종 그대로 유지 (Chat Channel 은 Webhook 트리거의 config 갈래로만 존재)" 로 정정. 또는 Schedule 을 의도적으로 제외한 이유가 있다면 그 이유를 Rationale 에 명시.

---

### [WARNING] Chat Channel 어댑터의 구독 메커니즘이 EIA R10 에 기술된 기존 in-process subscriber 메커니즘과 구조적으로 다름 — 명시적 분리 Rationale 필요
- **target 위치**: §3.2 CCH-AD-05, §3.3 처리 흐름 다이어그램 사이드 채널 명시, §8 R-I
- **과거 결정 출처**: `spec/5-system/14-external-interaction-api.md §R10` — "SSE 어댑터는 **Redis pub/sub** 으로 WebsocketService 가 발행한 이벤트를 구독해 외부 SSE 스트림으로 변환"
- **상세**: EIA R10 의 구체 구조에서 두 기존 subscriber 의 메커니즘은 다음과 같이 명시되어 있다.
  - NotificationDispatcher: after-commit hook (HTTP webhook 발송)
  - SSE 어댑터: Redis pub/sub (WebsocketService 이벤트 구독)

  target 이 제안하는 Chat Channel 어댑터는 "NotificationDispatcher 의 after-commit EventEmitter 에 in-process listener 로 attach" 하는 세 번째 메커니즘을 도입한다. 이 메커니즘은 EIA R10 에 존재하지 않으며, 기존 R10 이 "NotificationDispatcher 는 after-commit hook 으로 트리거" 라고 기술했을 때 EventEmitter 를 외부 subscriber 가 listen 할 수 있는 것으로 정의하지 않았다.

  target §7.4 가 EIA §R10 에 한 단락을 추가 제안하고, target §8 R-I 가 Redis pub/sub / 별도 after-commit hook 을 기각한 이유를 상세히 설명하므로, 번복이 "의도적이며 Rationale 이 동반된" 점은 인정된다. 그러나 EIA R10 의 기존 구체 구조 항목이 "NotificationDispatcher 는 outbox/after-commit hook" 이라고 명시하면서 EventEmitter listen 가능성을 열어두지 않았기 때문에, 이것이 R10 의 확장인지 아니면 기각된 "별도 after-commit hook 추가" 안의 변형인지가 모호하다.

  target R-I 가 "(기각) 별도 after-commit hook 추가 — 엔진 §4.4 의 단일 sink 정책 위반 — 어댑터가 엔진 코드를 알아야 함" 이라고 기술하지만, EventEmitter subscription 도 NotificationDispatcher 의 내부를 어느 정도 알아야 한다는 점에서 이 기각 근거의 적용 범위가 일관한지 추가 설명이 필요하다.
- **제안**: EIA §R10 의 §7.4 갱신 제안에 "NotificationDispatcher 가 after-commit hook 완료 시점에 in-process EventEmitter 를 emit 하는 설계가 전제이며, 이는 기존 R10 의 outbox/hook 설명 범위 안에서 구독 채널 추가로 해석한다" 는 내용을 명시. R-I 의 기각 설명에서 "별도 after-commit hook 추가 (기각)" 와 "NotificationDispatcher EventEmitter listener (채택)" 의 구조적 차이를 1~2문장으로 보강. (현재 R-I 에서 두 안의 구체적 구조 차이가 불명확하다.)

---

### [WARNING] EIA-AU-08 (in-process trusted caller 예외) 신설이 EIA R1 의 "두 채널 분리" 원칙에 새 예외를 도입하면서 R1 에 cross-link 가 없음
- **target 위치**: §7.2 EIA-AU-08 신설, §3.5 Identity/보안 EIA inbound facade 설명
- **과거 결정 출처**: `spec/5-system/14-external-interaction-api.md §R1` — "두 채널 (Outbound Notification + Inbound REST/SSE) 을 독립적으로 제공. 내부 처리는 WebSocket 경로를 그대로 재사용하는 **facade** 로 구현하여 두 표면이 분기되지 않도록 한다." / §EIA-IN-06 — "모든 inbound 요청은 §4 의 interaction token 으로 인증"
- **상세**: EIA-IN-06 은 "모든 inbound 요청은 interaction token 으로 인증" 이라고 규정하는 절대적 표현이다. target 이 제안하는 EIA-AU-08 은 "in-process trusted caller 는 토큰 발급/검증 우회 가능" 이라는 예외 조항을 새로 도입한다. 이 예외는 기각된 대안을 재도입하는 것이 아니라 신규 케이스이지만, EIA-IN-06 의 표현과의 관계가 spec 본문에서 명시되지 않으면 두 요구사항이 충돌하는 것처럼 읽힌다. target §7.2 에서 EIA-AU-08 에 대한 설명이 상세하나, EIA-IN-06 요구사항 행의 비고 또는 각주 수준에서 "EIA-AU-08 예외 참조" 가 없다.

  또한 EIA R1 의 "facade 로 구현하여 두 표면이 분기되지 않도록" 원칙은 in-process bypass 가 아닌 외부 표면 단일화를 의미하므로 직접 충돌은 아니다. 그러나 target 이 `InteractionService.interact()` 를 in-process 직접 호출하는 패턴은 EIA R1 이 정의한 "facade 경로" 의 우회이기도 하다. 이에 대해 target §7.2 는 "HTTP 표면을 거치지 않는다" 고 기술하지만, in-process 직접 호출 = facade 계층 우회 임을 EIA R1 과의 명시적 대조 없이 처리하고 있다.
- **제안**: EIA spec §3.2 의 EIA-IN-06 행에 비고 "(단 in-process trusted caller 는 EIA-AU-08 예외 적용)" 를 한 줄 추가. 또는 EIA §R1 에 "in-process caller 는 HTTP facade 를 우회하되 동일 service layer 를 직접 호출한다 — facade 원칙의 HTTP 표면 분리 부분만 예외" 라는 1문장 보강.

---

### [INFO] EIA R4 의 `per_trigger` Telegram 예시 수정이 기존 예시를 대체하면서 기각된 케이스가 아님을 명시
- **target 위치**: §7.3 EIA §R4 의 Telegram 예시 수정
- **과거 결정 출처**: `spec/5-system/14-external-interaction-api.md §R4` — "다수 execution 을 동시에 다루는 봇 (Telegram bot 등) — execution 별 토큰 교환 비용 회피"
- **상세**: target §7.3 은 기존 R4 의 Telegram 예시를 "사용자가 직접 변환층을 구현하는 advanced 케이스 한정" 으로 한정하는 수정을 제안한다. 이 수정은 기존 R4 의 예시를 폐기하지 않고 범위를 명확화하는 것이다. 그러나 수정 전 기존 R4 의 예시가 직접 변환층 케이스만을 가리켰는지, 아니면 서버사이드 어댑터 케이스도 포함했는지 시제를 모르는 독자는 혼동할 수 있다. 수정 후 문장이 "단, 본 시나리오는 사용자가 직접 변환층을 구현하는 advanced 케이스 한정 (§2 사용 시나리오 표 2행)" 이라고 명시하고 있어 전체적으로 문제 수준은 낮지만, 변경 이유 (Chat Channel 어댑터 도입 전까지는 이 예시가 유일한 경로였기 때문에 서버사이드 어댑터 경우를 고려하지 않았다는 역사적 맥락) 를 R4 에 한 줄 기재하면 독자 혼란을 줄일 수 있다.
- **제안**: 수정 제안 텍스트 앞에 "(Chat Channel 어댑터 도입 전 예시로, 서버사이드 어댑터가 없던 시절의 시나리오 한정이었음을 소급 명시)" 한 줄 추가. 필수가 아닌 보완 수준.

---

### [INFO] `chat_channel_token_v2` 컬럼명이 `notification_secret_v2` 와 의미론적 비대칭 (보완 제안)
- **target 위치**: §3.4.2 신규 컬럼 — `chat_channel_token_v2 TEXT NULL`
- **과거 결정 출처**: `spec/1-data-model.md §2.8` — `notification_secret_v2 Text?` (Secret rotation 기간 동안 사용되는 신규 secret)
- **상세**: target 은 "의도적으로 `_v2_ref` 가 아닌 `_v2` 를 채택 (`notification_secret_v2` 와 일치)" 이라고 설명한다. 그러나 `notification_secret_v2` 는 "signing secret" 이고, `chat_channel_token_v2` 는 "bot token reference" 이다 — 두 값의 의미가 다름에도 suffix 만 맞추는 것이 혼동을 줄인다기보다 오히려 `secret` vs `token` 의 asymmetry 를 감추는 측면이 있다. target §3.4.2 의 설명 박스가 이를 명시하고 있으므로 Rationale 연속성 충돌은 아니며, 향후 I13 (공용 DB 타입 통합 검토) 에서 재논의하도록 이미 계획되어 있다. 추가 조치 불필요이나 spec 작성 시 비고에 "naming 은 일치시켰으나 의미론적 비대칭 존재 — I13 에서 통합 재검토" 를 명시적으로 남겨두면 이후 검토자 부담이 낮아진다.
- **제안**: §3.4.2 의 해당 비고 박스에 "의미론적 비대칭 (`notification_secret_v2` 는 signing secret, `chat_channel_token_v2` 는 bot token reference) 은 I13 통합 검토 시 해소 대상" 을 한 줄 추가 (현재 비고가 이를 암묵적으로 시사하나 명시하지 않음).

---

### [INFO] EIA §R5 (외부 WebSocket 보류) 재논의 트리거와의 관계 명시는 양호
- **target 위치**: §3.5 보안 "§R5 관계 (I5)" 항목
- **과거 결정 출처**: `spec/5-system/14-external-interaction-api.md §R5` — "미래 재논의 트리거: SSE 동시 연결 수 한계 실측, inbound REST round-trip latency 저해, 외부 WS 요구 파트너 등"
- **상세**: target 은 "Chat Channel 어댑터는 외부 표면을 추가하지 않으므로 §R5 의 재논의 트리거 조건과 무관 (어댑터는 in-process subscriber)" 이라고 명시한다. 이 설명은 R5 의 재논의 트리거를 무시하지 않고 명확히 관계를 정리하고 있어 Rationale 연속성 측면에서 적절하다. 별도 조치 불필요.

---

### [INFO] R-B 에서 기각한 "어댑터도 EIA HTTP endpoint 호출" 대안이 EIA 기존 Rationale 와 일관
- **target 위치**: §8 R-B
- **과거 결정 출처**: `spec/5-system/14-external-interaction-api.md §R10` — "기각된 대안: NotificationDispatcher 를 엔진 내부에 직접 호출"
- **상세**: R-B 의 기각 대안 "어댑터도 EIA HTTP endpoint 를 호출" 은 EIA Rationale 에서 명시적으로 기각된 대안은 아니지만, EIA R10 의 "엔진 외부 facade 에 위치" 원칙과 동일한 방향에서 기각되었다 (network round-trip + 토큰 사이클 부담). EIA R10 의 기각 대안 (엔진 내부 직접 호출) 과는 다른 안이나, 동일 원칙 적용으로 일관된 기각이다. Rationale 연속성 위반 없음.

---

## 요약

Rationale 연속성 관점에서 target 문서는 대체로 기존 spec 의 합의된 원칙 (EIA facade 원칙, 실행 엔진 단일 sink 정책, webhook 트리거 config 확장 전략) 을 준수한다. 기각된 대안의 재도입이나 합의된 invariant 의 직접 위반은 발견되지 않았다. 다만 세 가지 WARNING 이 존재한다. 첫 번째는 트리거 유형 카탈로그를 "2종" 으로 표현한 오기로 Schedule 트리거가 누락되어 기존 spec 과 숫자가 불일치한다. 두 번째는 Chat Channel 어댑터의 NotificationDispatcher EventEmitter subscription 메커니즘이 EIA R10 이 기술한 기존 구독 경로 (Redis pub/sub for SSE, HTTP for NotificationDispatcher) 와 구별되는 새 메커니즘임에도, EIA R10 의 구체 구조 항목과의 관계 및 R-I 의 기각 경계 설명이 부분적으로 모호하다. 세 번째는 EIA-AU-08 (in-process trusted caller 예외) 신설이 EIA-IN-06 의 절대적 표현과 spec 본문 레벨에서 상호 참조 없이 공존해 독자 혼란 가능성이 있다. 이 세 항목은 BLOCKING 수준이 아니나, spec 반영 시 수정 또는 보강이 권장된다.

## 위험도

MEDIUM

---

*검토 범위*: `spec/5-system/14-external-interaction-api.md` (Rationale R1~R12), `spec/5-system/4-execution-engine.md` (§4.4 단일 sink 정책), `spec/5-system/12-webhook.md` (Rationale), `spec/1-data-model.md` (Rationale, §2.8 Trigger 컬럼), `spec/4-nodes/7-trigger/0-common.md` (트리거 종류 표), `spec/conventions/conversation-thread.md`
