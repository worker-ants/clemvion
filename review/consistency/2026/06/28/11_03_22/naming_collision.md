# 신규 식별자 충돌 검토 결과

대상 파일: `spec/5-system/12-webhook.md`

---

## 발견사항

### 1. 요구사항 ID 충돌

WH-EP-\*, WH-SC-\*, WH-RS-\*, WH-MG-\*, WH-NF-\* 계열 ID 는 target 파일(`spec/5-system/12-webhook.md`) 외에 어느 spec 파일에서도 ID 본문(정의 행)으로 사용되지 않는다. 외부 파일들은 모두 참조(`[WH-MG-09](../5-system/12-webhook.md)` 등)로만 사용하고 있어 정의 충돌 없음.

- **INFO** WH-EP-05 에 소수점 하위 ID `WH-EP-05-1` / `WH-EP-05-2` 사용
  - target 신규 식별자: `WH-EP-05-1`, `WH-EP-05-2`
  - 기존 사용처: 기존 corpus 어디에도 이 하위 ID 를 참조·정의한 파일 없음 (검색 결과 0건)
  - 상세: 소수점 형태 하위 ID 는 다른 도메인 ID 계열(EIA-NX-\*, CCH-AD-\* 등)이 사용하지 않는 패턴. 본 목록에서는 최초 사례이므로 충돌 자체는 없으나, 기존 ID 패턴과 다름.
  - 제안: 충돌은 없으나 일관성 측면에서 `WH-EP-05a` / `WH-EP-05b` 또는 별도 ID(`WH-EP-08`, `WH-EP-09`)로 통일하는 것을 검토 가능. 단 현 패턴도 충돌 없이 식별 가능하므로 강제 변경 불필요.

---

### 2. 엔티티/타입명 충돌

**발견사항 없음.** Target 이 도입하는 새 타입명(`PublicWebhookThrottleGuard`, `PublicWebhookQuotaService`)은 이미 구현 파일에 존재하는 클래스이며, 다른 spec 파일들은 동일한 이름을 동일한 의미로 참조하고 있다 (`spec/7-channel-web-chat/4-security.md:126`, `spec/5-system/15-chat-channel.md:113`). 의미 충돌 없음.

---

### 3. API endpoint 충돌

**발견사항 없음.** `POST /api/hooks/:endpointPath` 는 `spec/5-system/2-api-convention.md:295`, `spec/data-flow/10-triggers.md:233` 등 다수 spec 에서 동일 경로로 일관되게 참조되고 있으며, target 이 새로 정의하는 경로와 의미가 일치한다. `GET /api/hooks/:endpointPath/embed-config` 는 target Rationale 에서 "본 SoT 의 스코프 밖"으로 명시적으로 제외되어 있고, `spec/7-channel-web-chat/4-security.md` 가 그 SoT 임이 명시되어 있다.

---

### 4. 이벤트/메시지명 충돌

**발견사항 없음.** Target 이 정의하는 에러 코드 문자열(`AUTH_FAILED`, `PUBLIC_WEBHOOK_BODY_TOO_LARGE`, `PUBLIC_WEBHOOK_RATE_LIMIT`, `PUBLIC_WEBHOOK_HOURLY_LIMIT`)은 다른 spec 에서 같은 이름을 다른 의미로 사용하는 사례가 없다.

---

### 5. 환경변수·설정키 충돌

- **INFO** `NEXT_PUBLIC_WEBHOOK_BASE_URL` — 정의 중복 참조 (충돌 아님)
  - target 신규 식별자: `NEXT_PUBLIC_WEBHOOK_BASE_URL` (WH-EP-02 에서 정의)
  - 기존 사용처:
    - `spec/2-navigation/2-trigger-list.md:125` — 동일 우선순위 규칙을 기술하며 WH-EP-02 를 정본으로 역참조
    - `spec/7-channel-web-chat/5-admin-console.md:154,266` — 동일 의미로 참조
  - 상세: 모든 사용처가 WH-EP-02 를 SoT 로 명시하거나 동일 의미로 사용 중. 충돌 없음.
  - 제안: 이상 없음.

- **INFO** `publicWebhook.startupPerMinute` / `publicWebhook.hourlyNewMax` / `publicWebhook.maxBodyBytes` config 키
  - target 신규 식별자: 위 세 config 키 (§6 및 §WH-NF-02)
  - 기존 사용처: 다른 spec 파일에서 이 키를 정의하거나 다른 의미로 사용하는 사례 없음
  - 상세: 충돌 없음. 단 이 키의 정의 SoT 가 분산되어 있다 — target §6 에서 키 이름과 기본값을 기술하고, `spec/7-channel-web-chat/4-security.md §4` 가 rate-limit 정책의 SoT 로 선언되어 있다. config 키 자체의 명명 충돌은 없으나 SoT 선언이 양방향으로 분산되어 있음.
  - 제안: 충돌 없음. SoT 분산은 INFO 수준.

---

### 6. 파일 경로 충돌

**발견사항 없음.** `spec/5-system/12-webhook.md` 는 이미 존재하는 파일이고(target 자체가 해당 파일의 내용), 동일 폴더의 `_product-overview.md` 및 기타 `N-name.md` 파일과 prefix 충돌이 없다. `spec/0-overview.md` 의 문서 맵(`§8`)에도 `12-webhook.md` 가 이미 등재되어 있다.

---

## 요약

`spec/5-system/12-webhook.md` 가 도입하는 WH-\* 요구사항 ID 계열, 클래스명(`PublicWebhookThrottleGuard` 등), API endpoint(`POST /api/hooks/:endpointPath`), 에러 코드 문자열, 환경변수(`NEXT_PUBLIC_WEBHOOK_BASE_URL`), config 키(`publicWebhook.*`) 모두 기존 corpus 내에서 동일한 의미로 참조되고 있거나 신규 식별자로 아직 사용된 적 없는 이름이다. CRITICAL 또는 WARNING 수준의 식별자 충돌은 발견되지 않았다. 유일한 주목 사항은 `WH-EP-05-1` / `WH-EP-05-2` 소수점 하위 ID 패턴이 기존 ID 계열에서 사용된 적 없는 최초 사례라는 점과, `publicWebhook.*` config 키의 SoT 가 webhook spec 과 web-chat 보안 spec 에 이중으로 언급되어 있다는 점이나, 이는 의미 충돌이 아닌 cross-link 구조상의 INFO 사항이다.

---

## 위험도

NONE
