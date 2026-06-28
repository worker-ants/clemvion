# 신규 식별자 충돌 검토 — spec/5-system/12-webhook.md

## 발견사항

### 발견사항 없음 (충돌 0건)

분석 결과, `spec/5-system/12-webhook.md` 가 도입하거나 정의하는 신규 식별자 중 기존 영역에서 다른 의미로 사용되고 있는 충돌 사례는 발견되지 않았다. 아래는 검토 결과의 세부 근거다.

---

### [INFO] WH-EP-05-1 / WH-EP-05-2 — 신규 하위 ID 추가

- target 신규 식별자: `WH-EP-05-1`, `WH-EP-05-2`
- 기존 사용처: `WH-EP-05` 는 기존 spec 에서 이미 사용 중 (`spec/5-system/12-webhook.md` 본체 및 교차 참조 파일)
- 상세: target 은 `WH-EP-05` 를 유지하면서 `.1`·`.2` 두 하위 ID 를 신설한다. 기존 다른 파일들(`spec/2-navigation/2-trigger-list.md`, `spec/5-system/15-chat-channel.md`, `spec/data-flow/10-triggers.md` 등)은 `WH-EP-05` 를 직접 인용하지 않으므로 외부 교차 참조 충돌은 없다.
- 제안: 이슈 없음. 현재 패턴(`WH-EP-05`→`.1`/`.2`)은 하위 세분화 의도가 명확하며, 기존 ID 와 번호가 겹치지 않는다.

---

### [INFO] NEXT_PUBLIC_WEBHOOK_BASE_URL — ENV var

- target 신규 식별자: `NEXT_PUBLIC_WEBHOOK_BASE_URL`
- 기존 사용처: `spec/2-navigation/2-trigger-list.md` line 125 — 동일 이름으로 동일 목적(프론트엔드 webhook base URL override)으로 이미 참조됨
- 상세: target 과 기존 사용처가 동일 의미로 사용하고 있어 충돌 없음. 오히려 정합성이 확인된 사례.
- 제안: 이슈 없음.

---

### [INFO] publicWebhook config key — 설정키

- target 신규 식별자: `publicWebhook.maxBodyBytes`, `publicWebhook.startupPerMinute`, `publicWebhook.hourlyNewMax`
- 기존 사용처: `spec/7-channel-web-chat/4-security.md` 에서 `PublicWebhookThrottleGuard`·`PublicWebhookQuotaService` 를 동일 클래스명으로 참조; `spec/5-system/3-error-handling.md` 에서도 동일 참조
- 상세: config 키(`publicWebhook.*`) 는 target 에서만 명시적으로 정의되고 있으며 기존 파일들은 클래스명을 참조할 뿐 config 키를 직접 정의하지 않는다. 충돌 없음.
- 제안: 이슈 없음.

---

### [INFO] PublicWebhookThrottleGuard / PublicWebhookQuotaService — 엔티티명

- target 신규 식별자: `PublicWebhookThrottleGuard`, `PublicWebhookQuotaService`
- 기존 사용처: `spec/7-channel-web-chat/4-security.md`, `spec/5-system/15-chat-channel.md`, `spec/data-flow/10-triggers.md` 에서 동일 이름으로 동일 컴포넌트를 참조
- 상세: target 과 기존 파일이 같은 의미로 사용. 정합 확인.
- 제안: 이슈 없음.

---

### [INFO] 에러 코드 — INVALID_WEBHOOK_PAYLOAD / PUBLIC_WEBHOOK_RATE_LIMIT / PUBLIC_WEBHOOK_HOURLY_LIMIT / PUBLIC_WEBHOOK_BODY_TOO_LARGE

- target 신규 식별자: `INVALID_WEBHOOK_PAYLOAD`, `PUBLIC_WEBHOOK_RATE_LIMIT`, `PUBLIC_WEBHOOK_HOURLY_LIMIT`, `PUBLIC_WEBHOOK_BODY_TOO_LARGE`, `MISSING_REQUIRED_FIELD`, `TYPE_COERCION_FAILED`
- 기존 사용처:
  - `spec/5-system/3-error-handling.md` lines 134–138: `INVALID_WEBHOOK_PAYLOAD`(400), `PUBLIC_WEBHOOK_RATE_LIMIT`(429), `PUBLIC_WEBHOOK_HOURLY_LIMIT`(429) 이 이미 동일 의미로 등재·구현됨
  - `MISSING_REQUIRED_FIELD`·`TYPE_COERCION_FAILED` 는 error-handling §1.7 (Planned) 로 미래 카탈로그 항목으로 예고됨
- 상세: target 이 이들 에러 코드를 재정의하는 것이 아니라 동일 의미로 cross-link 하므로 충돌 없음. `PUBLIC_WEBHOOK_BODY_TOO_LARGE` 는 error-handling 에서 직접 등재된 명시 행은 없으나 target 이 정의한 유일한 출처이며 error-handling spec 의 §1.7 "webhook 수신 에러 코드 도메인" 카탈로그 행으로 포함 예정임이 target 본문에 명시돼 있다.
- 제안: 이슈 없음. `PUBLIC_WEBHOOK_BODY_TOO_LARGE` 를 error-handling §1.7 에 등재하는 추적 항목이 plan 에 존재하는지 확인 권장(소폭 gap).

---

### [INFO] POST /api/hooks/:endpointPath — API endpoint

- target 신규 식별자: `POST /api/hooks/:endpointPath`
- 기존 사용처: `spec/2-navigation/2-trigger-list.md`, `spec/data-flow/10-triggers.md`, `spec/7-channel-web-chat/4-security.md` 등에서 동일 경로로 이미 참조됨
- 상세: target 이 이 endpoint 의 SoT 를 자신으로 명시하고 있으며(`Rationale` §), 교차 참조 파일들이 target 을 canonical 로 가리키고 있음. 충돌 없음.
- 제안: 이슈 없음.

---

### [INFO] V066__trigger_config_strip_inline_auth — 마이그레이션 식별자

- target 신규 식별자: `V066__trigger_config_strip_inline_auth.sql` (cleanup migration)
- 기존 사용처: `spec/5-system/14-external-interaction-api.md` line 170, 661; `spec/7-channel-web-chat/3-auth-session.md` line 29 — 동일 이름·동일 목적으로 이미 참조됨
- 상세: 동일 의미로 사용 중이며 충돌 없음.
- 제안: 이슈 없음.

---

## 요약

`spec/5-system/12-webhook.md` 가 도입하는 요구사항 ID(WH-EP/WH-SC/WH-RS/WH-MG/WH-NF 계열), 엔티티명(`PublicWebhookThrottleGuard`, `PublicWebhookQuotaService`), API endpoint(`POST /api/hooks/:endpointPath`), 에러 코드(`INVALID_WEBHOOK_PAYLOAD`, `PUBLIC_WEBHOOK_RATE_LIMIT` 등), 환경변수(`NEXT_PUBLIC_WEBHOOK_BASE_URL`, `publicWebhook.*`), 마이그레이션 식별자(`V066__...`) 모두 기존 코퍼스에서 동일 의미로 정합되게 사용되고 있으며, 다른 의미로 이미 점유된 식별자와의 충돌은 발견되지 않았다. `WH-EP-05-1`/`WH-EP-05-2` 신규 하위 ID 와 `PUBLIC_WEBHOOK_BODY_TOO_LARGE` 코드는 신규 추가이나 기존 ID 네임스페이스와 겹치지 않는다.

## 위험도

NONE
