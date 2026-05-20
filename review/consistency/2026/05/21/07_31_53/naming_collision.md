# 신규 식별자 충돌 검토 결과

**대상**: `spec/conventions/cafe24-api-catalog/` (전체 19개 파일)
**검토 모드**: `--impl-prep`
**검토 일자**: 2026-05-21

---

## 발견사항

### 1. WARNING — `boards_setting_*` (store) vs `boards_settings_*` (community) — 유사 ID 혼동 위험

- **target 신규 식별자**: `boards_setting_get` / `boards_setting_update` (`spec/conventions/cafe24-api-catalog/store.md`, planned 행)
- **기존 사용처**: `boards_settings_get` / `boards_settings_update` (`spec/conventions/cafe24-api-catalog/community.md`, supported 행 — `GET boards/{board_no}` / `PUT boards/{board_no}`)
- **상세**: ID 가 `setting` vs `settings` 1글자 차이다. Cafe24 docs 의 English title 도 비슷하다 (store: "Retrieve board settings" / community: "Retrieve the board settings"). 두 행이 서로 다른 자원(store 전체 게시판 정책 vs community 개별 게시판 속성)을 가리키지만, `catalog-sync.spec.ts` 는 resource 파일 내 unique 만 검증하므로 cross-resource 중복은 테스트로 잡히지 않는다. 개발자가 두 ID 를 혼동해 잘못된 resource 파일에 backend 메타데이터를 추가하거나 UI 드롭다운에서 혼선을 일으킬 수 있다.
- **제안**: store.md 의 planned ID 를 `store_boards_setting_get` / `store_boards_setting_update` 로 변경하거나, 구현 시점에 docs 검증 후 `store_board_policy_get` 등 더 구체적인 명칭으로 승격할 것을 명시. 현 planned 상태에서는 한국어 라벨 "(store)" 접미사가 있어 catalog 에서 구분되지만, backend metadata ID 는 변경이 필요하다.

---

### 2. WARNING — `orders_status_get/update` (store) vs `order_status_update/order_status_update_multiple` (order) — 혼동 가능

- **target 신규 식별자**: `orders_status_get` / `orders_status_update` (`spec/conventions/cafe24-api-catalog/store.md`, planned 행)
- **기존 사용처**: `order_status_update` / `order_status_update_multiple` (`spec/conventions/cafe24-api-catalog/order.md`, supported 행 — `PUT orders/{order_id}` / `PUT orders/status`)
- **상세**: store 의 `orders_status_*` 는 "주문 상태 표기(표시 레이블) 설정"(Cafe24 "Retrieve order status displayed"), order 의 `order_status_*` 는 "실제 주문의 상태 변경"이다. 의미는 완전히 다르지만 ID 패턴이 `orders_status_` vs `order_status_` 로 s 1자 차이라 혼동 가능하다. ID uniqueness 는 resource 파일 내에서만 보장되므로 현재 테스트는 이를 잡지 못한다.
- **제안**: store.md 의 `orders_status_get` / `orders_status_update` 를 `store_order_status_label_get` / `store_order_status_label_update` 와 같이 store scope 와 "표시 설정"의 의미를 명시하는 이름으로 구현 시점에 재명명. 또는 spec 에 "store 의 `orders_status_*` = 레이블 설정 API, order 의 `order_status_*` = 실제 상태 변경 API" 를 _overview §2 id 컬럼 설명에 주석으로 추가.

---

### 3. INFO — `<resource>_<verb>` 규약 이탈 다수 — catalog-sync 미검증 영역

- **target 신규 식별자**: `boards_setting_get`, `social_list`, `mains_list/add/update/delete`, `autodisplay_list/create/update/delete`, `brands_list/count/create/update/delete`, `manufacturers_list/count/get/create/update`, `trends_list/count`, `classifications_list/count`, `origin_list`, `carriers_get/create/update/delete`, `regionalsurcharges_get/update`, `shippingorigins_list/create/update/delete`, `refunds_list/get`, `return_get/create_multiple`, `cancellation_get/create_multiple`, `exchange_get/create_multiple`, `control` 등
- **기존 사용처**: `_overview.md` §2 id 컬럼 정의 — "`<resource>_<verb>` 또는 `<resource>_<sub>_<verb>`" 형식을 명시
- **상세**: 위 IDs 는 catalog 파일의 resource 이름 (`collection`, `customer`, `category`, `shipping`, `order` 등)을 prefix 로 갖지 않는다. 이는 Cafe24 공식 API 자원 경로명을 직접 사용한 것으로 Cafe24 Admin API 명명 체계를 따른 설계적 결정이지만, `_overview.md` 의 포맷 규약 "`<resource>_<verb>`" 와 불일치한다. `catalog-sync.spec.ts` 는 ID prefix 형식을 검증하지 않으므로 테스트로 잡히지 않는다. 다만 이 IDs 는 resource 파일 내에서는 unique 하고, `findCafe24Operation(resource, id)` 호출 시 resource 인자로 resource 파일을 이미 구분하므로 런타임 충돌은 없다.
- **제안**: `_overview.md` §2 id 컬럼 정의에 "Cafe24 API 가 별도 자원 경로를 쓰는 sub-resource 의 경우 해당 경로명을 prefix 로 허용" 을 명시해 규약과 현실의 괴리를 해소. 또는 이미 supported 행들이 이 패턴을 사용하고 있으므로 "resource-path_verb" 형식도 허용 패턴으로 공식화.

---

### 4. INFO — `Notification` DB 엔티티 vs `notification` Cafe24 resource — 문맥이 달라 충돌 없음, 단 용어 공존 주의

- **target 신규 식별자**: Cafe24 resource `notification` (`spec/conventions/cafe24-api-catalog/notification.md` — SMS·automails·recipientgroups 등 Cafe24 관련 알림 API)
- **기존 사용처**: `Notification` 엔티티 (`spec/1-data-model.md` §2.19 — 우리 서비스 내부의 in-app/email 알림 엔티티)
- **상세**: 같은 "notification" 단어가 (a) Cafe24 API resource 이름 (`Cafe24Resource` enum 값, `mall.read_notification` scope), (b) 우리 시스템 DB 엔티티 (`Notification` 테이블, `integration_action_required` 등 type) 두 문맥에서 사용된다. 이미 `cafe24-api-metadata.md` 의 `Cafe24ApprovalGroup` 타입 선언 주석이 collision 회피를 위해 `approvalGroup` (not `category`) 이라고 명시하는 등 collision 의식이 있으나, `notification` 자체에 대한 구분 안내는 없다. 현재 코드베이스 및 spec 은 문맥(Cafe24 vs 시스템)으로 충분히 구분되나, 신규 개발자 혼선 가능성이 있다.
- **제안**: `notification.md` 상단에 `application.md` 와 같은 "주의" 노트를 추가. 예: "> **주의**: 본 resource 는 Cafe24 알림(SMS·automails) API 다. 우리 서비스의 `Notification` DB 엔티티 (in-app/email 알림) 와 **무관** — naming collision 회피 참고."

---

### 5. INFO — `application` Cafe24 resource vs `Integration.app_type` / `service_type` — 이미 경고 문구 있음, 완전 해소

- **target 신규 식별자**: Cafe24 resource `application` (`spec/conventions/cafe24-api-catalog/application.md` — scripttags, webhooks, recipes 등 Cafe24 앱 관리 API)
- **기존 사용처**: `Integration.service_type='cafe24'` 의 `app_type` 필드 (`spec/1-data-model.md`), `spec/2-navigation/4-integration.md` 의 Public/Private 앱 등록 개념
- **상세**: `application.md` 상단에 이미 "> **주의**: 본 resource 는 Cafe24 앱 관리 API 다. 우리 서비스의 Integration `app_type` (Public/Private OAuth 앱 등록) 과 **무관** — naming collision 회피 참고." 가 명시되어 있다. 충돌 우려가 선제적으로 해소된 상태.
- **제안**: 현 상태 유지. 다만 동일 패턴을 `notification.md` 에도 적용(위 항목 4 참고).

---

### 6. INFO — `personal` Cafe24 resource vs `Integration.scope=personal` — 문맥 충분히 구분

- **target 신규 식별자**: Cafe24 resource `personal` (`spec/conventions/cafe24-api-catalog/personal.md` — 장바구니, 위시리스트 등 개인화 API)
- **기존 사용처**: `Integration.scope` enum 값 `personal` (`spec/1-data-model.md` §2.10 — "personal / organization" 구분), `spec/2-navigation/4-integration.md` 여러 곳의 "Personal scope" 개념
- **상세**: `personal` 이라는 단어가 (a) Cafe24 Admin API resource 이름, (b) 우리 Integration 의 가시성 범위(personal vs organization) 두 문맥에서 사용된다. 그러나 두 문맥은 코드·spec 모두 명확히 구분된다 — Cafe24 resource 는 `Cafe24Resource` 타입으로만 사용되고, Integration scope 는 `Integration.scope` 필드로만 등장한다.
- **제안**: 혼선 우려가 낮아 변경 불필요. 단, `personal.md` 상단에 "본 resource 는 Cafe24 개인화(장바구니·위시리스트) API 다. `Integration.scope=personal` (통합 가시성 범위) 과 무관" 을 간략히 명시하면 선제적 명확화가 된다.

---

## 요약

`spec/conventions/cafe24-api-catalog/` 가 도입하는 신규 식별자는 전반적으로 기존 spec 및 codebase 와 심각한 충돌이 없다. `Cafe24Resource` enum, `CAFE24_OPERATIONS_BY_RESOURCE`, `findCafe24Operation`, `catalog-sync.spec.ts` 등 핵심 식별자는 기존에 이미 동일 의미로 정립되어 있으며 카탈로그가 이를 그대로 참조한다. 주요 위험은 두 가지다. 첫째, `boards_setting_*` (store, planned) vs `boards_settings_*` (community, supported) 의 1글자 차이 유사 ID 가 cross-resource 중복 검증 부재 상태에서 개발자 혼선을 유발할 수 있다. 둘째, `orders_status_*` (store) vs `order_status_*` (order) 가 단수/복수 1자 차이로 완전히 다른 Cafe24 API 를 가리키는데 naming 이 지나치게 유사하다. 두 이슈 모두 현재는 `planned` 상태라 runtime 충돌이 없으나, 구현 착수 시 ID 재명명 또는 spec 주석 보강이 권장된다. `_overview.md` §2 의 ID 포맷 규약(`<resource>_<verb>`)과 실제 카탈로그 ID 간 괴리도 다수 존재하나, 이는 Cafe24 API 자원 경로명을 그대로 따른 설계 결정으로 보이며 runtime 문제는 없다.

---

## 위험도

MEDIUM
