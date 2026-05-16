# Naming Collision Review — Cafe24 API Catalog

**대상**: `spec/conventions/cafe24-api-catalog/` (18 resource 파일, ~500 operation id)
**일자**: 2026-05-16
**검토 범위**: 신규 `planned` operation id (~447개) + 기존 `supported` id 53개의 전체 충돌 점검

---

## 발견사항

### [WARNING] `privacy_` prefix ID가 `store` resource에 배치됨 — `privacy` resource와 prefix 혼동

- **target 신규 식별자**: `store.privacy_boards_get`, `store.privacy_boards_update`, `store.privacy_join_get`, `store.privacy_join_update`, `store.privacy_orders_get`, `store.privacy_orders_update` (모두 `planned`)
- **기존 사용처**: `spec/conventions/cafe24-api-catalog/privacy.md` — `privacy`는 독립 resource로 존재하며, 해당 파일의 ID는 `customers_privacy_get` (supported), `customers_privacy_list`, `customers_privacy_count`, `customers_privacy_update` 등으로 정의됨
- **상세**: `store` resource 안에 `privacy_boards_get`처럼 `privacy_` prefix로 시작하는 ID 6개가 있다. `privacy`는 18개 resource 중 독립적인 resource 이름이기도 하다. 검색·자동완성 시 `privacy_*`를 찾으면 두 resource의 ID가 섞여 나온다. 의미는 다르다 — store 쪽은 "상점 정책 안의 개인정보 정책 설정", privacy 쪽은 "회원 개인정보 조회·수정" — 이지만 prefix만 보면 구분되지 않는다.
- **제안**: store resource의 해당 6개 ID를 `store_privacy_boards_get`, `store_privacy_join_get`, `store_privacy_orders_get` 형태로 변경하거나, 또는 `privacy_policy_boards_get` 처럼 `privacy_policy_` prefix를 채택해 resource 이름 `privacy`와 명확히 구분한다.

---

### [WARNING] `shipping_suppliers_*` ID가 `supply` resource에 배치됨 — `shipping` resource와 prefix 혼동

- **target 신규 식별자**: `supply.shipping_suppliers_get`, `supply.shipping_suppliers_update`, `supply.shipping_suppliers_additionalfees_get` (모두 `planned`)
- **기존 사용처**: `spec/conventions/cafe24-api-catalog/shipping.md` — `shipping` resource에 `shipping_companies_list` (supported), `shipping_settings_get`, `shipping_settings_update`, `shipping_additionalfees_countries` 등이 정의됨
- **상세**: `supply` resource 안에 `shipping_` prefix로 시작하는 ID 3개가 있다. `shipping`은 독립 resource이며 동일 prefix(`shipping_`)를 가진 ID가 이미 shipping resource에 존재한다. 특히 `shipping.shipping_additionalfees_countries`와 `supply.shipping_suppliers_additionalfees_get`은 `shipping` + `additionalfees` 조합으로 더욱 헷갈린다. Cafe24 API에서는 공급사의 배송 설정을 별도 sub-resource로 제공하므로 `supply` resource에 두는 것 자체는 타당하지만, prefix를 맞춰야 한다.
- **제안**: `supply.supplier_shipping_get`, `supply.supplier_shipping_update`, `supply.supplier_shipping_additionalfees_get` 처럼 `supplier_shipping_` prefix를 사용해 공급사 소속 배송 설정임을 명시한다.

---

### [WARNING] `order` resource 내 `order_memos_*` (singular)와 `orders_memos_list` (plural) 혼재

- **target 신규 식별자**: `order.orders_memos_list` (planned)
- **기존 사용처**: `order.order_memos_create` (supported), `order.order_memos_list` (planned), `order.order_memos_update` (planned), `order.order_memos_delete` (planned) — 모두 단수 `order_`로 시작
- **상세**: order resource 안에 `order_memos_*` 형태(4개)와 `orders_memos_list` 형태(1개)가 섞여 있다. 두 ID 모두 "주문 메모"를 대상으로 하는데 prefix가 singular/plural로 갈린다. `order_memos_list`와 `orders_memos_list`는 기능적으로도 의미가 중복되어 보인다 (둘 다 "주문 메모 목록 조회" 방향). Cafe24 공식 docs 구조 차이에서 비롯된 것으로 보이나(`orders` vs `order/{id}` 경로 차이), 카탈로그만 보면 혼란스럽다.
- **제안**: `orders_memos_list`의 실제 Cafe24 path를 확인해 `order_memos_list`와 다른 endpoint임이 확인되면 라벨(한)과 English title을 충분히 구분되게 작성한다. 만약 같은 endpoint라면 두 행 중 하나를 제거한다. prefix는 가능하면 단수 `order_`로 통일한다.

---

### [WARNING] `store.boards_setting_*` vs `community.boards_settings_*` — 1글자 차이(`setting` vs `settings`)

- **target 신규 식별자**: `store.boards_setting_get`, `store.boards_setting_update` (모두 `planned`)
- **기존 사용처**: `community.boards_settings_get`, `community.boards_settings_update` (모두 `planned`)
- **상세**: `boards_setting_` (store)과 `boards_settings_` (community)는 단수/복수 1글자 차이다. 오타처럼 보이며, 자동완성·grep에서 두 set이 뒤섞인다. 의미는 다르다 — store 쪽은 "상점 레벨 게시판 설정", community 쪽은 "개별 게시판 설정" — 이지만 ID만 보면 판별이 어렵다.
- **제안**: store 쪽을 `boards_global_setting_get` / `boards_global_setting_update`로, 또는 community 쪽을 `board_settings_get` / `board_settings_update` (단수 `board_`)로 변경해 두 resource의 ID가 명확히 분리되도록 한다.

---

### [WARNING] `mains_` prefix가 `category`, `product`, `store` 세 resource에 분산

- **target 신규 식별자**: `category.mains_list`, `category.mains_add`, `category.mains_update`, `category.mains_delete` (planned); `product.mains_products_list`, `product.mains_products_count`, `product.mains_products_set`, `product.mains_products_delete`, `product.mains_products_update_sorting` (planned); `store.mains_properties_setting_get`, `store.mains_properties_setting_update` (planned)
- **기존 사용처**: 해당 ID들은 모두 신규(planned)이며 기존 메타데이터에 없음
- **상세**: `mains_` prefix가 3개 resource(category, product, store)에 걸쳐 11개 ID에서 사용된다. 각각 "메인 카테고리 관리", "메인 카테고리의 상품 관리", "메인 진열 설정"이라는 상이한 의미이지만, prefix만 보면 어느 resource에 속하는지 알 수 없다. 특히 `category.mains_list`와 `store.mains_properties_setting_get`은 "진열" vs "카테고리"를 다루는데 prefix가 같다.
- **제안**: resource 이름을 prefix에 반영하는 관례를 적용. 예: `category.mains_list` → `maincategory_list`, `product.mains_products_list` → `maincategory_products_list`, `store.mains_properties_setting_get` → `maindisplay_setting_get`. 또는 현행대로 두더라도 `_overview.md`에 resource별 `mains_` 의미 구분 표를 명시해 혼동을 방지한다.

---

### [INFO] `subscription_shipments_` prefix가 `order`와 `store` 두 resource에 분산

- **target 신규 식별자**: `order.subscription_shipments_get`, `order.subscription_shipments_create`, `order.subscription_shipments_update`, `order.subscription_shipments_items_update` (planned); `store.subscription_shipments_setting_list`, `store.subscription_shipments_setting_create_rule`, `store.subscription_shipments_setting_update`, `store.subscription_shipments_setting_delete` (planned)
- **기존 사용처**: 모두 신규
- **상세**: `subscription_shipments_` prefix가 두 resource에 사용되나, store 쪽은 `_setting_` 중간 토큰으로 충분히 구분된다. 혼동 위험은 낮지만, order.md와 store.md를 교차 검색할 때 노출된다.
- **제안**: 현행 명명 유지 가능. 단, UI의 Operation 드롭다운에서 각 resource가 필터링되므로 실사용자 혼동 위험은 최소화된다. `_overview.md` §5 coverage matrix 비고에 관계를 한 줄 기재하면 충분.

---

### [INFO] `financials_` prefix가 `community`와 `store` 두 resource에 분산

- **target 신규 식별자**: `community.financials_monthlyreviews_count` (planned)
- **기존 사용처**: `store.financials_paymentgateway_get`, `store.financials_store_get` (모두 planned)
- **상세**: `financials_` prefix가 두 resource에 사용되나 sub-token이 다르다(`monthlyreviews` vs `paymentgateway`, `store`). Cafe24 Admin API에서 `financials` 경로 하위에 여러 sub-resource가 있어 이런 분산은 불가피하다. 중간 토큰으로 충분히 구분되므로 실질적 충돌 위험은 낮다.
- **제안**: 현행 유지. 다만 미래에 `financials_` prefix ID가 더 늘어날 경우 전용 resource로 분리할 것을 고려한다.

---

### [INFO] `sms_` prefix가 `notification`(실행)과 `store`(설정) 두 resource에 분산

- **target 신규 식별자**: `store.sms_setting_get`, `store.sms_setting_update` (planned)
- **기존 사용처**: `notification.sms_send` (supported), `notification.sms_balance_get` (supported), `notification.sms_receivers_get` (planned), `notification.sms_senders_list` (planned)
- **상세**: `sms_` prefix가 두 resource에 사용되나 의미가 다르다 — notification 쪽은 SMS 발송/잔액 조회 실행 API, store 쪽은 SMS 기능 설정 API. `_setting_` 중간 토큰으로 구분된다.
- **제안**: 현행 유지. 의미 차이가 명확하고 구분자가 있다.

---

### [INFO] `order.control` — 단일 단어 ID (resource prefix 없음)

- **target 신규 식별자**: `order.control` (planned)
- **기존 사용처**: 다른 resource에 없음
- **상세**: order resource 내에서 유일하게 `_`이 없는 단어 ID. 다른 모든 ID는 `resource_verb` 또는 `entity_verb` 형태다. Cafe24 공식 docs에도 "Order control"이라는 독립 endpoint가 있어 이름을 그대로 따온 것으로 보이나, 의미가 불명확하다.
- **제안**: `order_control` 처럼 resource prefix를 붙이거나, 라벨(한)을 "주문 제어 (Order Control)"로 명확히 기재한다.

---

### [INFO] `design.icons_list` vs `product.product_icons_list` — "아이콘" 엔티티 두 종류

- **target 신규 식별자**: `design.icons_list`, `design.icons_update_settings` (planned)
- **기존 사용처**: `product.product_icons_list`, `product.product_icons_set`, `product.product_icons_update`, `product.product_icons_delete` (모두 planned)
- **상세**: design resource의 `icons_list`는 "디자인 아이콘 목록"(상점 UI 아이콘), product resource의 `product_icons_list`는 "상품 아이콘 목록"(상품에 부착되는 배지형 아이콘)으로 다른 엔티티다. resource prefix(`product_`)로 구분되어 있어 실제 충돌은 없다. 단, design 쪽 `icons_list`는 resource prefix(`design_`)가 없어 패턴이 일관되지 않다.
- **제안**: design 쪽도 `design_icons_list`, `design_icons_update_settings`로 resource prefix를 붙이는 것을 권장한다.

---

## 요약

18개 resource 카탈로그 전체에서 **동일 operation id가 두 resource에 동시 등록된 진성 충돌(CRITICAL)은 발견되지 않았다.** 500개 ID 모두 cross-resource 중복 없이 유일하다. 그러나 4건의 WARNING이 있다: (1) `store` resource가 `privacy_` prefix ID를 보유해 독립 resource `privacy`와 prefix가 일치하는 문제, (2) `supply` resource가 `shipping_` prefix ID를 보유해 `shipping` resource와 prefix가 일치하는 문제, (3) `order` resource 내부에서 `order_memos_*`(singular)와 `orders_memos_list`(plural)가 혼재하는 문제, (4) `store.boards_setting_*`과 `community.boards_settings_*`가 1글자 차이로 구분되는 문제. 이 4건은 `planned` 단계이므로 구현 전에 수정하기 용이하다. 5건의 INFO는 naming 일관성 보완 권고이며 즉각 차단 사유는 아니다. catalog-sync 테스트가 resource 내 유일성을 강제하므로 동일 파일 내 중복은 자동 감지된다.

## 위험도

MEDIUM
