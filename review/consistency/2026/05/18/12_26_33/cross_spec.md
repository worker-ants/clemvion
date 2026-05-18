# Cross-Spec 일관성 검토 결과

검토 모드: `--impl-prep` (구현 착수 전)
Target 범위: `spec/conventions/cafe24-api-catalog/` (전체 18 resource 파일 + `_overview.md`)
보조 코퍼스: `spec/0-overview.md`, `spec/1-data-model.md`, `spec/2-navigation/` 일부

---

## 발견사항

- **[INFO]** `_overview.md` §5 Coverage Matrix 기준일이 2026-05-17인데, 합계 264건은 §7 CHANGELOG의 Phase 8j 이후 변동이 없어 일치함 — 이상 없음. 단, 미래 구현 시 Matrix와 CHANGELOG를 동기 갱신하는 절차가 명문화되어 있으므로 구현자가 이를 따라야 한다는 점 안내 수준으로 기록.
  - target 위치: `_overview.md` §5, §7
  - 충돌 대상: 없음 (자기 일관성 확인)
  - 상세: Phase 8j 이후 coverage matrix row 와 CHANGELOG 가 consistent 하며 264건이 유지되고 있음. INFO 수준으로 기록.
  - 제안: 없음 (양호)

- **[INFO]** `order.md` 표에서 `order_cancellation_create` / `order_exchange_create` / `order_exchange_update` / `order_return_create` / `order_return_update` 등 여러 `planned` row가 `spec/0-overview.md §6.2` 에서 "A/S 자동화 8건 … Phase 6a 로 supported 승격" 이라고 기록된 항목들과 ID 매핑을 교차 확인하면 일부 불일치가 관찰된다.
  - target 위치: `order.md` 표 — `order_cancellation_create` (planned), `order_exchange_create` (planned), `order_return_create` (planned)
  - 충돌 대상: `_overview.md` §7 CHANGELOG Phase 6a: "A/S 자동화 8건 (`refunds_list/get`, `cancellation_get/create_multiple`, `exchange_get/create_multiple`, `return_get/create_multiple`) 를 planned → supported 로 승격"
  - 상세: Phase 6a 에서 승격된 ID 는 `cancellation_create_multiple`, `exchange_create_multiple`, `return_create_multiple` 이고, `order.md` 에서 이 ID 들은 실제로 `supported` 로 표기되어 있다. 그러나 `order_cancellation_create`(단건), `order_exchange_create`(단건), `order_return_create`(단건) 는 별개 ID 로 `planned` 상태를 유지 중이며, 이는 CHANGELOG 내용과 모순 없이 정합하다. ID 명명 패턴이 `_multiple` 접미어 유무로 구분되므로 혼동 소지가 있어 INFO로 기록.
  - 제안: `order.md` 표 주석 또는 `_overview.md` §7 Phase 6a 설명에 "(단건 `order_cancellation_create` 등과 구분)" 같은 명확화 문구를 추가 권장.

- **[WARNING]** `application.md` 에서 `webhooks_list` 와 `webhooks_update` 가 `supported` 로 등재되어 있지만, `spec/0-overview.md §6.1` 의 Cafe24 통합 구현 목록과 `spec/1-data-model.md §2.10` 의 Integration 데이터 모델에는 Webhook 관련 동기화 정책(카페24 웹훅 설정 변경이 우리 시스템 내 어떤 부분과 연동되는지)이 명시되어 있지 않다.
  - target 위치: `application.md` — `webhooks_list`, `webhooks_update`, `webhooks_logs_list` (모두 supported)
  - 충돌 대상: `spec/5-system/12-webhook.md`(참조 언급은 있으나 본 payload 에 포함되지 않음), `spec/1-data-model.md §2.10` Integration 데이터 모델
  - 상세: Cafe24의 `webhooks_update`(카페24 Admin API 의 webhook 설정 수정)가 우리 플랫폼 내 Integration 상태나 `consecutive_network_failures` 등에 어떤 영향을 주는지, 혹은 완전히 독립적인 단순 API call 에 불과한지가 카탈로그에 명시되지 않았다. 구현 시 spec 12-webhook.md 와 역할 혼동 가능성이 있다.
  - 제안: `application.md` 상단 주석에 "카페24 자체 webhook 설정 API. 플랫폼 내부 Webhook 수신 모듈(`spec/5-system/12-webhook.md`)과 무관" 설명 추가. 또는 `_overview.md` §1 resource 목록에 간략히 명기.

- **[WARNING]** `notification.md` 에서 `customers_invitation_send` (POST `customers/invitation`) 가 `scope: write`, `restricted: scope` 로 등재되어 있고 카탈로그 상 Notification resource 에 속한다. 그런데 `spec/1-data-model.md §2.19` 의 Notification 엔티티 및 `spec/2-navigation/10-auth-flow.md §2.6` 의 초대 흐름(서비스 자체 invitation 흐름) 과 명칭이 충돌할 소지가 있다.
  - target 위치: `notification.md` — `customers_invitation_send` row (Cafe24 회원 활성화 초대 발송, Notification resource 소속)
  - 충돌 대상: `spec/1-data-model.md §2.19` Notification 엔티티 (`type` enum 중 `team_invite`), `spec/2-navigation/10-auth-flow.md §2.6` "초대 토큰을 통한 가입"
  - 상세: 서비스 자체의 팀 초대(`team_invite` Notification 타입, `POST /api/invitations/:token`)와 Cafe24 Admin API 의 "카페24 회원 활성화 초대 발송"(`customers_invitation_send`)은 완전히 다른 도메인의 개념이다. 명칭 유사성(invitation/invite)으로 인해 구현자가 혼동하거나, AI Agent MCP 도구 목록에서 동음이의 충돌이 발생할 수 있다. `application.md` 의 주석("우리 서비스의 Integration `app_type` 과 무관")과 같이 disambiguation 이 명시적으로 기술되어 있지 않다.
  - 제안: `notification.md` 의 `customers_invitation_send` row 에 영문 설명 보완("Cafe24 customer account activation invitation — unrelated to platform team invitation flow")을 추가하거나, `_overview.md` §1 에 cross-domain naming collision 주의사항으로 기재.

- **[INFO]** `personal.md` 에서 `products_carts_list`/`products_carts_count` 의 path 패턴이 `products/{product_no}/carts` 이고, `privacy.md` 에서 `products_wishlist_customers_list`/`products_wishlist_customers_count` 의 path 패턴이 `products/{product_no}/wishlist/customers` 이다. 두 resource(Personal, Privacy)가 모두 `products/{product_no}/` 를 prefix 로 사용하지만 서로 다른 카탈로그 파일에 분리되어 있다.
  - target 위치: `personal.md`, `privacy.md`
  - 충돌 대상: `_overview.md` §1 resource 목록 (resource 경계 정의)
  - 상세: 직접적인 모순은 아니나, 동일한 `products/` 최상위 path 를 Personal 과 Privacy 두 resource 가 공유하여 일관성 검토 없이 구현 시 scope 혼동이 발생할 수 있다. `_overview.md` §2 컬럼 정의는 path 가 겹치는 경우의 resource 소속 기준을 명시하지 않는다.
  - 제안: INFO 수준. `_overview.md` §2 또는 해당 resource 파일 상단에 "path prefix 가 다른 resource 와 겹치는 경우 operation scope 기준으로 resource 를 결정한다" 는 원칙을 한 줄 추가하면 충분.

- **[INFO]** `_overview.md` §4 동기 정책 검증 규칙 8번에 `level='program'` 인 메타데이터는 카탈로그 검증 대상에서 제외된다고 명시되어 있다. 그런데 `spec/1-data-model.md §2.10` Integration 엔티티나 Cafe24 노드 spec(`spec/4-nodes/4-integration/4-cafe24.md`, 본 payload 미포함)에서 `level='program'` 에 해당하는 Analytics 등의 처리 방침이 별도로 기술되는지 교차 확인이 필요하다.
  - target 위치: `_overview.md` §4 검증 규칙 8
  - 충돌 대상: `spec/4-nodes/4-integration/4-cafe24.md` (본 검토 payload 에 포함되지 않음)
  - 상세: `level='program'` 제외 처리가 카탈로그 수준에서만 선언되고 노드 메타데이터 spec 쪽에서도 동일하게 기술되어 있는지 확인이 권장된다. payload 에 해당 spec 이 없어 직접 검증은 불가하므로 INFO 로 기록.
  - 제안: 구현 착수 전 `spec/4-nodes/4-integration/4-cafe24.md` 와 `spec/conventions/cafe24-api-metadata.md` 의 `level='program'` 정의를 교차 확인할 것.

---

## 요약

`spec/conventions/cafe24-api-catalog/` 의 전체 18 resource 카탈로그는 `spec/0-overview.md`, `spec/1-data-model.md` 의 Integration 엔티티 정의, 데이터 흐름 및 내비게이션 spec 과 직접 모순되는 CRITICAL 항목이 없다. `_overview.md §7 CHANGELOG` 와 각 resource 파일의 `status` 값이 내부적으로 정합하게 유지되고 있으며, `restricted` 컬럼 — 메타데이터 `restrictedApproval.level` 매핑도 `cafe24-restricted-scopes.md` 와 연계하여 일관성을 유지한다. 다만 (1) `application.md` 의 Webhook 관련 operation 이 플랫폼 내부 Webhook 수신 모듈과 역할 혼동 가능성, (2) `notification.md` 의 `customers_invitation_send` 와 플랫폼 자체 team invite 흐름 사이의 명칭 충돌 소지 — 두 WARNING 이 발견되어 구현 전 주석이나 설명 보강이 권장된다. 나머지는 INFO 수준으로 구현에 영향을 주지 않는다.

---

## 위험도

LOW
