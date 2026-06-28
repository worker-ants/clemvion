# 신규 식별자 충돌 검토

**Target**: `spec/5-system/12-webhook.md`
**검토 모드**: spec draft (--spec)
**검토일**: 2026-06-28

---

## 발견사항

### 요구사항 ID 충돌

충돌 없음. `WH-EP-*`, `WH-SC-*`, `WH-RS-*`, `WH-MG-*`, `WH-NF-*` prefix 는 해당 파일 전용이며, 기존 corpus 에서 다른 의미로 쓰이지 않는다. 하위 ID `WH-EP-05-1`, `WH-EP-05-2` 도 본 파일 외에서 참조 없음.

### 엔티티/타입명 충돌

충돌 없음. 본 target 이 직접 도입하는 신규 타입명은 없다. `HooksController`, `HooksService`, `PublicWebhookThrottleGuard`, `PublicWebhookQuotaService` 는 기존 구현 파일명을 문서화한 것이며, 다른 spec 에서 다른 의미로 정의된 바 없다.

### API endpoint 충돌

충돌 없음. target 이 정의하는 `POST /api/hooks/:endpointPath` 는 corpus 전체에서 본 spec 이 단일 SoT 로 인용된다 (`spec/5-system/14-external-interaction-api.md`, `spec/7-channel-web-chat/0-architecture.md`, `spec/data-flow/10-triggers.md` 등이 cross-link 만 보유). 기존 spec 이 동일 path 를 독자 정의하는 사례 없음.

### 이벤트/메시지명 충돌

충돌 없음. target 은 webhook/SSE 이벤트 이름을 신규 도입하지 않는다. `notification`/`interaction`/`chatChannel` config 키는 `spec/5-system/14-external-interaction-api.md` 및 `spec/5-system/15-chat-channel.md` 가 이미 정의하며, target 은 해당 spec 으로 위임(cross-link)하는 구조로 중복 없음.

### 환경변수·설정키 충돌

- **[INFO]** `NEXT_PUBLIC_WEBHOOK_BASE_URL` / `NEXT_PUBLIC_API_URL` 중복 언급
  - target 신규 식별자: `WH-EP-02` 내 `NEXT_PUBLIC_WEBHOOK_BASE_URL`, `NEXT_PUBLIC_API_URL` 결정 우선순위 서술
  - 기존 사용처: `spec/2-navigation/2-trigger-list.md` L125 ("SoT: `codebase/frontend/src/lib/utils/webhook-url.ts`"), `spec/7-channel-web-chat/5-admin-console.md` L154 / L266
  - 상세: 두 ENV var 는 이미 trigger-list spec 과 admin-console spec 에서 동일 우선순위 체인으로 기술된다. target 의 `WH-EP-02` 가 SoT 를 본 파일로 선언하는데, trigger-list spec L125 도 같은 구현 파일(`webhook-url.ts`)을 참조하며 "정본 형식은 Spec Webhook WH-EP-02" 로 역참조하므로 현재는 단방향 위임 구조로 충돌이 없다. 그러나 admin-console spec L154/L266 은 역참조 없이 직접 기술하므로, 향후 base 결정 우선순위가 변경될 경우 drift 가 발생할 수 있다.
  - 제안: admin-console spec (`spec/7-channel-web-chat/5-admin-console.md`) 의 `NEXT_PUBLIC_WEBHOOK_BASE_URL` 관련 행에 "SoT: `WH-EP-02`" 주석을 추가해 단일 진실 역참조를 완성. 현재는 INFO 수준이며 차단 불요.

- **[INFO]** `publicWebhook.maxBodyBytes` / `publicWebhook.startupPerMinute` / `publicWebhook.hourlyNewMax` config 키
  - target 신규 식별자: WH-NF-02 및 §6 에서 이 키들을 SoT 로 정의
  - 기존 사용처: `spec/5-system/3-error-handling.md` L135-137 에서 `publicWebhook.maxBodyBytes` 를 이미 동일 의미로 언급
  - 상세: 양쪽이 동일 의미로 사용하며 error-handling spec 이 webhook spec 으로 역참조(`[Spec Webhook §6]`, `[Spec Webhook §8]`)하고 있어 SoT 위계가 명확히 정립돼 있다. 충돌 없음.

### 에러코드 충돌

- **[INFO]** `AUTH_FAILED` 식별자 출처 중의성
  - target 신규 식별자: `WH-SC-04` 에서 `AUTH_FAILED` 를 webhook 인증 실패 단일 응답 메시지로 정의
  - 기존 사용처: `spec/1-data-model.md` §2.17 ("false 면 연결된 webhook 호출은 401 `AUTH_FAILED`"), `spec/data-flow/10-triggers.md` L85-86 (동일 의미 사용)
  - 상세: 모두 webhook 도메인의 동일 인증 실패 메시지를 가리키므로 의미 충돌 없음. 단, `AUTH_FAILED` 가 `spec/5-system/3-error-handling.md` §1.7 카탈로그에 등재되지 않아 공식 에러코드 카탈로그에서 가시성이 없다. WH-SC-04 는 `AUTH_FAILED` 를 401 응답 메시지 본문으로만 정의하며 에러 코드 봉투의 `error.code` 와는 다름 — 혼동 가능성 낮음.
  - 제안: 차단 불요. error-handling §1.7 에 `AUTH_FAILED` 를 401 메시지 상수(에러 코드가 아닌 단일 응답 메시지)로 명시해 카탈로그 가시성 보완 가능 (별도 작업).

- **[INFO]** `MISSING_REQUIRED_FIELD` / `TYPE_COERCION_FAILED` (Planned 에러 상세 코드)
  - target 신규 식별자: `spec/5-system/12-webhook.md` §5.2 "목표" 봉투의 `details[].code` 값
  - 기존 사용처: `spec/5-system/3-error-handling.md` L139 ("목표"로 동일 명칭 등재)
  - 상세: target 과 error-handling spec 이 동일 명칭, 동일 의미로 일관되게 사용. 충돌 없음.

### 파일 경로 충돌

충돌 없음. `spec/5-system/12-webhook.md` 는 기존 파일이며(frontmatter 에 `id: webhook` 기재), 신규 파일로 도입하는 것이 아니다. 명명 컨벤션(`N-name.md`, 정수 prefix) 을 준수한다. `spec/5-system/` 디렉터리 내 다른 파일과 이름 충돌 없음.

---

## 요약

`spec/5-system/12-webhook.md` target 이 도입하는 식별자 — 요구사항 ID(`WH-*`), 엔드포인트 `POST /api/hooks/:endpointPath`, 에러 코드(`INVALID_WEBHOOK_PAYLOAD`, `PUBLIC_WEBHOOK_*`), config 키(`publicWebhook.*`), ENV var(`NEXT_PUBLIC_WEBHOOK_BASE_URL`) — 중 다른 의미로 사용 중인 충돌 사례는 발견되지 않았다. 기존 corpus 의 WH-* 참조는 모두 본 파일로의 단방향 역참조 구조이며, ENV var 와 에러 코드도 의미 일관성이 유지된다. 단, `spec/7-channel-web-chat/5-admin-console.md` 의 `NEXT_PUBLIC_WEBHOOK_BASE_URL` 언급이 SoT 역참조를 누락한 점과, `AUTH_FAILED` 가 공식 에러코드 카탈로그에 미등재된 점은 INFO 수준의 일관성 보완 권고로 남긴다.

---

## 위험도

NONE
