# 신규 식별자 충돌 검토 — `spec/2-navigation/4-integration.md`

검토 일시: 2026-05-16
검토 모드: spec draft (--spec)

---

## 발견사항

- **[INFO]** `attention` 가상 필터값 — URL 파라미터 공간 내 명확한 문서화 필요
  - target 신규 식별자: `status=attention` (API 쿼리 파라미터 가상값)
  - 기존 사용처: `spec/2-navigation/4-integration.md §9.1` 의 기존 가상값 `expiring` 과 같은 파라미터 공간을 공유. `spec/1-data-model.md §2.10` 의 `Integration.status` Enum (`connected / expired / error / pending_install`) 에는 없음.
  - 상세: target 문서 자체가 `attention` 과 `expiring` 두 가상값을 명확히 "DB Enum 에 없는 virtual filter" 로 정의하고 있어 의미 충돌은 없다. 다만 `spec/1-data-model.md §2.10` 의 `status` 필드 설명과 `spec/0-overview.md` 에는 가상 필터값 목록이 별도로 기술되지 않아, 구현자가 해당 파라미터 공간의 전체 허용값을 데이터 모델만 보고 파악하기 어렵다.
  - 제안: `spec/1-data-model.md §2.10` 의 `status` 필드 설명에 "API 필터 파라미터로는 `expiring` / `attention` 이 추가로 허용되는 가상값" 임을 주석으로 명시하거나, §9.1 의 가상값 정의를 cross-reference 링크로 명확히 연결한다.

- **[INFO]** `notifyIntegrationExpiryByEmail` 설정키 — 기존 User 필드 목록에 미등재
  - target 신규 식별자: `notifyIntegrationExpiryByEmail` (사용자 프로필 설정 토글 키)
  - 기존 사용처: `spec/1-data-model.md §2.1 User` 엔티티 필드 목록. 해당 목록에 이 필드가 없음.
  - 상세: target §11.3 이 "사용자별 프로필 설정에 `notifyIntegrationExpiryByEmail` 토글" 이라고 기술하지만, `spec/1-data-model.md §2.1` 의 User 엔티티 정의에는 이 컬럼이 없다. User 엔티티에 추가해야 하는지, 아니면 `User.settings` JSONB 나 별도 Preference 구조 안에 담기는지 명시되지 않아 구현 시 혼선 가능성이 있다.
  - 제안: `spec/1-data-model.md §2.1` 에 `notifyIntegrationExpiryByEmail` (Boolean, default false) 필드를 추가하거나, `User.settings` JSONB 하위 키로 수용한다는 규약을 target 문서 §11.3 에 명기한다.

- **[INFO]** `integration.scope_changed` AuditLog action — 기존 action 목록에 미등재
  - target 신규 식별자: `integration.scope_changed` (AuditLog.action 값)
  - 기존 사용처: `spec/1-data-model.md §2.18 AuditLog` 의 action 예시 (`workflow.create`, `trigger.update` 등). 기존 integration 관련 action 으로는 target §14.3 이 `integration.created`, `integration.deleted`, `integration.rotated`, `integration.reauthorized` 를 열거하고 있음.
  - 상세: target §14.3 은 위 5가지 action 을 정의하나, `spec/1-data-model.md §2.18` 의 AuditLog 설명에는 integration action 목록이 박제되지 않고 예시로만 처리되어 있다. `integration.scope_changed` 는 다른 action 들과 네이밍 패턴(`<resource>.<verb_past>`)이 일치하므로 충돌은 없다.
  - 제안: `spec/1-data-model.md §2.18` 또는 별도 AuditLog action vocabulary 문서에 integration 도메인 action 전체 목록(`integration.created`, `integration.deleted`, `integration.rotated`, `integration.reauthorized`, `integration.scope_changed`)을 명시해 구현자가 action string 을 발명하지 않도록 한다.

- **[INFO]** `oauth_callback` postMessage 이벤트 — 인증 도메인 OAuth 콜백과 동명 이벤트 혼동 가능
  - target 신규 식별자: `type: "oauth_callback"` (window.postMessage 이벤트 type 값, §10.2 §3.5)
  - 기존 사용처: `spec/2-navigation/10-auth-flow.md §5.3` 의 소셜 로그인 OAuth 콜백(`/api/auth/oauth/:provider/callback`). 해당 콜백은 팝업 방식이 아닌 전체 창 리다이렉트 방식이나, 프론트엔드 `/callback` 페이지 처리 코드에서 `oauth_callback` 이벤트를 리스닝하는 로직이 있다면 두 흐름의 postMessage 가 혼용될 수 있다.
  - 상세: target 의 Integration OAuth 팝업은 `type: "oauth_callback"` postMessage 를 사용하고, auth-flow 의 소셜 로그인은 전체 창 리다이렉트 → `/callback` 페이지 수신이므로 postMessage 채널 자체가 다르다. 그러나 향후 소셜 로그인을 팝업 방식으로 전환하거나, 두 흐름의 콜백 처리 코드가 한 페이지에서 공존할 경우 `type: "oauth_callback"` 이 충돌할 수 있다.
  - 제안: Integration OAuth 팝업의 postMessage type 을 `"integration_oauth_callback"` 으로 구체화해 auth 도메인의 oauth 이벤트와 명시적으로 구분한다. 특히 `provider` 필드가 동일한 `"google"` / `"github"` 를 담을 수 있어 수신 측 필터링 로직 혼용 위험이 있다.

- **[INFO]** `INTEGRATION_NOT_CONNECTED` 에러 코드 — status 전이 범위와 코드 의미 범위 불일치
  - target 신규 식별자: `INTEGRATION_NOT_CONNECTED` (§14.1 에러 코드 vocabulary)
  - 기존 사용처: `spec/1-data-model.md §2.10` Integration.status Enum 은 `connected / expired / error / pending_install` 4개.
  - 상세: `INTEGRATION_NOT_CONNECTED` 는 "Integration 상태가 `expired`/`error`" 일 때 발생한다고 §14.1 에 정의되어 있다. 그런데 상태 전이 §6 에 따르면 `pending_install` 도 노드·AI Agent 에서 사용 불가 상태다 (`INTEGRATION_INCOMPLETE` 로 처리). `pending_install` 은 `INTEGRATION_NOT_CONNECTED` 가 아니라 `INTEGRATION_INCOMPLETE` 로 따로 처리되어 있어 코드 의미 범위가 일관성 있게 정의되어 있다. 다만 `error(*)` 의 세부 사유(`auth_failed`, `insufficient_scope`, `network`) 에 따라 사용자에게 제공해야 할 복구 안내가 다르므로, 노드 실행 엔진이 단일 코드로 집약하면 세분화된 안내가 불가능하다는 설계 trade-off 가 spec 에 명기되지 않았다.
  - 제안: `INTEGRATION_NOT_CONNECTED` 의 적용 범위에 `pending_install` 제외 이유를 주석으로 명기하거나, 세부 `error.reason` 필드를 통해 클라이언트가 `status_reason` 을 재현할 수 있도록 에러 응답 스키마를 확장하는 방향을 검토한다.

---

## 요약

target 문서 `spec/2-navigation/4-integration.md` 가 도입하는 신규 식별자들은 기존 코퍼스와 **CRITICAL 또는 WARNING 수준의 실질적 충돌이 없다**. 가상 필터값 `attention` / `expiring` 은 DB Enum 과 명확히 분리된 API 파라미터 공간에 정의되어 있고, BullMQ job 명(`connected-expiry`, `pending-install-ttl`, `usage-log-prune`, `cafe24-background-refresh`), 에러 코드, API 엔드포인트, AuditLog action 모두 기존 동명 식별자와 충돌하지 않는다. 다만 네 가지 INFO 항목이 발견되었다: (1) 가상 필터값이 데이터 모델 문서에 cross-reference 없이 누락된 점, (2) `notifyIntegrationExpiryByEmail` 필드가 User 엔티티 정의에 미등재된 점, (3) Integration AuditLog action vocabulary 가 데이터 모델에 미박제된 점, (4) `oauth_callback` postMessage type 이 auth 도메인 소셜 로그인 흐름의 동명 이벤트와 장기적으로 혼동될 소지가 있는 점. 이들은 즉각적인 구현 충돌보다는 문서 정합성 및 미래 확장 시 혼선 방지를 위한 보완 사항이다.

---

## 위험도

LOW
