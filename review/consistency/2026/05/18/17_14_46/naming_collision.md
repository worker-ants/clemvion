# 신규 식별자 충돌 검토 결과

검토 대상: `spec/2-navigation/4-integration.md`
검토 관점: 신규 식별자 충돌 (요구사항 ID · 엔티티/타입명 · API endpoint · 이벤트/메시지명 · ENV var · 파일 경로)

---

### 발견사항

- **[INFO]** `Cafe24PrecheckResultDto` — 신규 DTO 명칭, 기존 코퍼스 내 명시적 등록 없음
  - target 신규 식별자: `Cafe24PrecheckResultDto` (§9.2 `GET /api/integrations/cafe24/precheck` 응답 DTO)
  - 기존 사용처: `spec/1-data-model.md §2.10` 및 `spec/2-navigation/4-integration.md §5.8` 의 Integration 관련 DTO 군에 명시적 선언이 없고, 코퍼스 내 다른 DTO 명과 충돌하는 이름도 발견되지 않음
  - 상세: `IntegrationDto` 계열과 네임스페이스가 일치한다. 단, 동일 파일 내 타 DTO(`IntegrationDto`, `IntegrationTestResult` 등)의 명명 패턴이 `Integration` prefix 를 사용하는데 본 DTO 만 `Cafe24` prefix 라 일관성이 약간 낮다.
  - 제안: `IntegrationCafe24PrecheckDto` 또는 `Cafe24PrecheckDto` 로 통일하거나 현행 유지. 기능 맥락이 충분히 명확하므로 필수 변경은 아님.

- **[INFO]** `oauth_callback` postMessage 이벤트명 — 기존 소셜 로그인 OAuth 콜백과 이름 공간 공유
  - target 신규 식별자: `type: "oauth_callback"` (§3.5, §10.2 팝업 → 부모창 postMessage 이벤트)
  - 기존 사용처: `spec/2-navigation/10-auth-flow.md §5` 의 소셜 로그인 OAuth 흐름(`/api/auth/oauth/:provider/callback`) 이 동일 팝업/postMessage 패턴을 사용할 가능성이 있다. auth-flow spec 에는 postMessage 의 구체적 `type` 문자열이 명시되어 있지 않아 직접 충돌 근거는 없으나, 양 흐름이 같은 브라우저 컨텍스트에서 동작할 경우 `window.addEventListener('message', ...)` 리스너가 `type: "oauth_callback"` 메시지를 잘못 처리할 수 있다.
  - 상세: `spec/2-navigation/10-auth-flow.md §5.3` 의 소셜 로그인 콜백(`/api/auth/oauth/:provider/callback`) 은 별도 페이지 리다이렉트 방식이므로 popuppostMessage 는 사용하지 않는 것으로 보인다. 따라서 실제 충돌 가능성은 낮지만, 두 흐름의 이벤트 명칭이 spec 에 명시적으로 분리되어 있지 않아 모호성이 남는다.
  - 제안: `type: "integration_oauth_callback"` 으로 명칭을 더 구체화하거나, auth-flow spec 에 소셜 로그인 postMessage 타입이 없음을 명시하여 혼동을 방지.

- **[INFO]** `integration_expired` / `integration_action_required` Notification type — 기존 코퍼스와 일치하나 교차 확인 필요
  - target 신규 식별자: `integration_expired`, `integration_action_required` (§11.2 알림 type 값)
  - 기존 사용처: `spec/1-data-model.md §2.19 Notification.type Enum` 에 `integration_expired`, `integration_action_required` 가 동일 의미로 등록되어 있음 — 충돌 없음.
  - 상세: 양 문서가 동일한 값을 정의하고 있어 일관성이 유지된다. target 문서가 최신 정의이며 data-model 이 이를 반영하고 있다.
  - 제안: 변경 불필요.

- **[INFO]** `autoRefresh` derived 필드명 — `IntegrationDto` 전용 필드로 기존 DB 컬럼과 이름 충돌 없음
  - target 신규 식별자: `autoRefresh: boolean` (§9.1 `IntegrationDto` derived 필드)
  - 기존 사용처: `spec/1-data-model.md §2.10` 의 Integration 엔티티 컬럼 목록에 `autoRefresh` DB 컬럼은 없음. derived 필드임이 두 문서에서 동일하게 명시되어 있다.
  - 상세: DB 컬럼과 DTO 필드의 이름 공간이 혼용될 때 혼동 여지가 있으나, 양 문서가 "DB 컬럼 아님 — 매 응답 시 계산" 임을 명확히 명시하여 실질 충돌은 없다.
  - 제안: 변경 불필요.

- **[INFO]** `appUrl` derived 필드명 — `IntegrationDto` 전용이나 일반 용어와 혼용 가능성
  - target 신규 식별자: `appUrl: string | null` (§9.1 `IntegrationDto` derived 필드, Cafe24 Private 전용)
  - 기존 사용처: 동일 target 문서 내에서 환경변수 `APP_URL` 과 derived 필드 `appUrl` 이 혼용된다. `APP_URL` 은 서버 환경변수이고 `appUrl` 은 응답 DTO 필드라 의미가 다르다.
  - 상세: 기존 spec 코퍼스에서 `appUrl` 이 다른 의미로 사용된 사례는 발견되지 않는다. 그러나 동일 문서 안에서 환경변수 `APP_URL` 과 필드 `appUrl` 이 혼재하여 독자가 혼동할 여지가 있다.
  - 제안: 필드명을 `cafe24AppUrl` 또는 `installEntryUrl` 로 구체화하거나, 문서 내 주석으로 "환경변수 APP_URL 과 다른 개념임" 을 명시.

- **[WARNING]** `CAFE24_PRIVATE_APP_ALREADY_CONNECTED` 에러 코드 — 코드명과 실제 적용 범위 불일치
  - target 신규 식별자: `CAFE24_PRIVATE_APP_ALREADY_CONNECTED` (§9.4 에러 코드)
  - 기존 사용처: 동일 target 문서 §9.4 Rationale 및 §9.2 본문에 등장. 코드 이름에 `PRIVATE` 이 포함되어 있으나 실제로는 Public/Private 양쪽에서 동일 코드를 반환함이 명시되어 있다.
  - 상세: 코드명이 Private 전용처럼 읽히지만 semantic 은 "동일 mall_id 에 이미 cafe24 Integration 이 존재함 (public/private 구분 없음)" 이다. 신규 구현자나 클라이언트 개발자가 이름만 보고 Public 케이스에서는 다른 코드가 반환된다고 오해할 수 있다. target 문서 Rationale 에 "historical artifact" 임이 설명되어 있으나 코드명 자체는 그대로 남는다.
  - 제안: 코드명을 `CAFE24_MALL_ALREADY_CONNECTED` 또는 `CAFE24_DUPLICATE_MALL` 로 변경하거나, Swagger 문서와 클라이언트 SDK 에서 "public/private 무관 mall_id 기준 중복" 임을 alias 또는 주석으로 명시하여 이름-의미 불일치를 완화.

- **[INFO]** `Cafe24PrivatePending` 컴포넌트명 — spec 에서 언급되는 UI 컴포넌트 식별자
  - target 신규 식별자: `Cafe24PrivatePending` (§4.2 Overview 탭의 App URL 카드 설명에서 언급)
  - 기존 사용처: 코퍼스 내 다른 spec 문서에서 동일 이름의 컴포넌트를 다른 의미로 사용하는 사례 없음.
  - 상세: spec 문서에서 컴포넌트 이름을 직접 참조하는 것은 구현 세부를 spec 에 박제하는 패턴이라 유지보수 부담이 생길 수 있다. 기능 명칭("Cafe24 Private 설정 안내 카드") 으로 서술하는 것이 spec 관점에서 더 적합하다.
  - 제안: 컴포넌트 이름 대신 기능 설명 용어("설정 안내 카드 UI 패턴") 로 표현하거나, 컴포넌트명은 구현 주석으로 이전.

- **[INFO]** BullMQ 잡 이름 `connected-expiry` / `pending-install-ttl` / `usage-log-prune` / `cafe24-background-refresh` — 기존 시스템 spec 과 교차 확인 필요
  - target 신규 식별자: 4개의 BullMQ job name (§11.1)
  - 기존 사용처: `spec/data-flow/5-integration.md §1.4` 를 참조로 인용하고 있으나 코퍼스에 해당 파일 본문은 포함되지 않았다. 코퍼스 내 다른 문서에서 동일 잡 이름을 다른 의미로 사용하는 사례는 발견되지 않음.
  - 상세: 잡 이름이 target 문서 안에서 일관되게 사용되고, `cafe24-token-refresh` 큐 worker 와도 명확히 분리된다.
  - 제안: `spec/data-flow/5-integration.md` 와 잡 이름이 일치하는지 추가 교차 확인 권장 (본 코퍼스에 포함되지 않아 직접 확인 불가).

- **[INFO]** `install_token` / `installToken` 표기 혼용
  - target 신규 식별자: DB 컬럼명 `install_token` (snake_case), 경로 파라미터 `:installToken` (camelCase), 응답 필드 `installToken`
  - 기존 사용처: `spec/1-data-model.md §2.10` 에 DB 컬럼 `install_token` 이 동일 의미로 정의됨 — 충돌 없음.
  - 상세: DB 컬럼(`install_token` snake_case)과 API/URL 파라미터(`installToken` camelCase) 의 표기 분리는 일반적인 관행이고, 각 사용처에서 일관되게 적용되고 있다. 충돌 아닌 관습적 변환.
  - 제안: 변경 불필요. 단, spec 내 처음 등장 시 "DB 컬럼은 `install_token`, URL/DTO 는 `installToken`" 임을 한 번 명시하면 혼동 없음.

---

### 요약

`spec/2-navigation/4-integration.md` 가 도입하는 신규 식별자 중 기존 코퍼스에서 **다른 의미로 이미 사용되어 직접 충돌하는 사례는 발견되지 않았다**. 주요 엔티티(`IntegrationDto`, `Integration`, `IntegrationUsageLog`), 에러 코드(`INTEGRATION_IN_USE`, `CAFE24_INSTALL_*`), Notification type(`integration_expired`, `integration_action_required`), DB 컬럼(`install_token`, `mall_id`, `consecutive_network_failures`) 등 모두 `spec/1-data-model.md` 와 정합성을 유지한다. 다만 `CAFE24_PRIVATE_APP_ALREADY_CONNECTED` 에러 코드명이 실제 적용 범위(Public/Private 무관)와 이름이 어긋나 구현자 혼동 가능성이 있어 WARNING 으로 지적했다. `oauth_callback` postMessage 이벤트 타입은 소셜 로그인 흐름과의 이름 공간 중첩 여지가 있으나, 소셜 로그인이 postMessage 를 사용하지 않는 것으로 보여 실질 충돌 가능성은 낮다. 나머지 발견사항은 모두 INFO 수준의 일관성 보완 제안이다.

---

### 위험도

LOW
