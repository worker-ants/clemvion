---
worktree: cafe24-backlog-residual-batch
started: 2026-05-16
owner: developer (다음 진입자)
---

# Cafe24 백로그 — 미해소 잔여

> **완료된 부분은 분리됨** (2026-06-01 split): A-1(알림 UI) · B-5-8(refresh 테스트 보강) ·
> Polish 완료분(C-3/D-1/E-1/E-3/F-2/F-3) · G-1 resource docs audit 전 batch 는
> [`plan/complete/cafe24-backlog-done.md`](../complete/cafe24-backlog-done.md) 에 기록.
> 본 문서는 **운영/결정 의존 또는 field-set 대량 확장**이 선행돼야 하는 잔여만 남긴다.
> 이력·맥락 원본: `plan/complete/cafe24-followup-backlog.md`, `plan/complete/cafe24-pending-polish-followup.md`.

## 잔여 항목 (착수 전 결정·선행 필요)

- [x] **운영(A-2) — 결정 2026-06-02**: install endpoint access log 의 `:installToken` segment 마스킹. **인프라 레벨(ingress/HAProxy)에서 처리**하기로 결정 — 코드 변경 없이 운영 측에서 적용한다. 적용 가이드(masking 위치·log-format 예시·query 이동 trade-off)를 `k8s/README.md` §Access log 에 명시. (ai-review W6/W11)
- [x] **운영(A-3) — Layer 2 완료**: install endpoint 실패 페널티 lockout (`Cafe24InstallRateLimitService`, `cafe24:install:fail:{ip}` INCR/EXPIRE, 임계치 10/10분 → `429 CAFE24_INSTALL_RATE_LIMITED`). token oracle enumeration 방어. spec §9.8 + Rationale 등재. 구현: `plan/complete/cafe24-install-ratelimit.md` (2026-06-02).
  - [ ] **A-3 follow-up — Layer 1 (분산 throttle store)**: 기존 30/min IP throttle 을 Redis 분산 store 로 이전 (멀티 인스턴스 quota 직렬화). `@nestjs/throttler` storage 가 전역 단일 설정이라 모든 throttled 엔드포인트에 영향 + 새 의존성/커스텀 storage 필요 → 별 infra PR 로 분리(deferred, 사용자 결정 2026-06-02). enumeration 방어 핵심은 Layer 2 가 cross-pod 로 완수.
- [ ] **C-6**: `buildIntegrationMeta` 레지스트리 패턴 — 현재 cafe24 하드코딩. 두 번째 provider 추가 직전 `Map<serviceType, (entity) => IntegrationMeta>` 전환. (deferred — 2nd provider 시점까지)
- [ ] **D-2** (defer — 결정 2026-06-02): `process()` 에러 격리 정책 spec 명시 (`.catch(logger.error)` BullMQ 재시도 회피). **현재는 프레임워크(NestJS Logger) 에러 로그 출력으로 충분**하다고 결정 — 별도 관측 도구(Sentry/Datadog 등) 선정 및 spec 명시는 관측 인프라를 **추후 일괄 도입**할 때 함께 진행한다. 그때까지 본 항목 유지. (ai-review W7)
- [x] **F-3 follow-up — 결정: 신설 (2026-06-02)**: 에러 코드 의미 기반 명명 원칙을 정식 규약 `spec/conventions/error-codes.md` 로 격상 완료 (명명 규율 SoT 분리 — 카탈로그·envelope 은 `5-system/3-error-handling.md`). 구현: `plan/complete/spec-draft-error-codes.md`. (기존 SoT: `4-integration.md` Rationale "(c) 의미 기반 명명 선례 예외")

### G-1-remaining — field-set 대량 확장 (별 PR — 본 PR 은 path/method 만 정렬)

> G-1 의 path/method audit 은 완료(complete 기록). 아래는 docs field ↔ metadata 갭 보강으로
> 수천 줄 규모라 별 PR 로 분리.

> **✅ UNBLOCKED (2026-06-03): field 데이터 소스 확보 완료.**
> 위 해소 조건 ① 충족 — 사용자가 Cafe24 공식 Admin API Documentation **전체 페이지를 렌더링된 HTML 로
> 다운로드 제공**(3.2MB, `<td>` 15,734개). JS 렌더링 SPA 였던 docs 가 정적 HTML 로 고정돼 **결정적
> 파싱이 가능**해졌다 — 추측·날조 없이 18 resource / 222 entity / 513 operation 의 응답 속성 + 요청
> 파라미터를 그대로 추출. 이를 토대로 **field-level 상세 카탈로그**(`cafe24-api-catalog/<resource>/<entity>.md`,
> 222개)를 생성했다 ([`_overview.md §7`](../../spec/conventions/cafe24-api-catalog/_overview.md)). 이 카탈로그가
> 곧 G-1-remaining 의 "docs 의 전체 field 목록" docs-side SoT 다. (생성 작업: worktree `cafe24-api-catalog`)
>
> **이제 남은 것은 docs(카탈로그) ↔ backend metadata 의 field 갭 보강(developer 트랙)** — 아래 4개 하위 항목.
> 각 항목은 해당 entity 의 `cafe24-api-catalog/<resource>/<entity>.md` 를 docs 기준으로 삼아 metadata `.ts`
> 와 대조한다. 여전히 수천 줄 규모이므로 resource 별로 분리 진행 권장.
>
> _(이력) 2026-06-02 BLOCKED 사유: field 전체 목록이 repo 어디에도 없고 외부 docs 가 WebFetch 로 추출 불가
> 했음. 2026-06-03 다운로드 HTML 제공으로 해소._

- [ ] **G-1-remaining** (데이터 확보 완료 — docs↔metadata 갭 보강만 잔여):
  - **store field-set 확장**: store 106 endpoint docs field 비교 audit 미수행.
  - **field-set 확장 (모든 resource)**: docs 에 있으나 metadata 에 누락된 field 추가 (예: product_list docs ~50 field vs 우리 8 field). 전 resource 적용 시 수천 줄.
  - **impliesValue metadata 적용**: 인프라 완료. 실제 ops 적용은 trigger field(refund_method, material_composite 등) 추가 후 — order cancellation/return/exchange + products create/update + bundleproducts create/update.
  - **constraint-only sweep — 미적용 date-pair**: order_count, boards_articles_list, coupon_list/count, scripttags_list/count, salesreport_volume — date 필드 부재로 field-set 확장 선행.

### G-2 — 잔존 docs 부재 ops 처리 결정 (운영 검증 후)

> **결정 2026-06-02**: 본 항목은 **현행 유지**한다 (production 검증 전이라 제거/문의 판단 보류). JSDoc ⚠ 마크 상태로 둔다.

production 검증 후 row 제거 또는 cafe24 본사 문의 후 docs 등재 요청. 모두 JSDoc ⚠ 마크 완료. 영향 ops:
- customer: customer_get, customer_update
- promotion: coupon_get, coupon_delete
- application: applications_list, webhooks_list
- category: mains_update, mains_delete
- store: socials_apple_settings_get

### G-3 — metadata ↔ 공식 docs 경로/scope 교차검증 (2026-06-03, field-level 카탈로그 부산물)

> **배경**: 기존 index `<resource>.md` + backend metadata 의 method/path/scope 는 **이전 Chrome
> 식별 기반**이라 오류 가능성이 있었다 (사용자 우려). 새로 확보한 공식 docs 전체 HTML 의 authoritative
> (method, path, scope) 와 backend metadata 500 operation 을 교차검증했다.
> 검증 스크립트: 일회성(`xcheck`), 데이터 소스: [[project-cafe24-field-catalog]] 의 docs HTML.

**결과**: **464/500 은 method+path 정확 일치** ✅. 36개가 공식 docs 와 어긋나며, 1개 scope 불일치.

> ⚠️ **주의**: 어긋남 = "metadata 가 틀렸다" 단정 아님. ① docs 가 재편/이름변경, ② 미문서화지만 동작하는
> endpoint, ③ Chrome 식별 당시 metadata 오류 — 셋 다 가능. **확정엔 live API 호출 또는 cafe24 changelog
> 확인 필요.** 단, 본 프로젝트 convention 상 **공식 docs 가 path/scope SoT** 이므로 docs 기준 불일치로 본다.
> 또한 index(Chrome) 와 field-level 카탈로그(docs) 가 이 36건에서 **경로가 서로 다르다** — 새 레이어가
> index 의 잠재 오류를 드러낸 셈.

**(a) KNOWN_G2 (7)** — 위 G-2 기등재 docs 부재분. 신규 아님: `customer_get/update`, `coupon_get/delete`,
`applications_list`, `webhooks_list`, `socials_apple_settings_get`.

**(b) NOT_IN_DOCS (5)** — docs 에 유사 경로조차 없음. 재편/폐기 의심:
- `salesreport/salesreport_daily` (`salesreport/sales`), `salesreport/salesreport_products` (`salesreport/products`) — docs 는 `financials/dailysales`·`reports/productsales` 등으로 **resource 재편**된 것으로 보임.
- `shipping/shipping_companies_list` (`shippingcompanies`) — docs 에 없음 (docs shipping = `carriers`).
- `personal/wishlists_list` (`wishlists`) — docs 는 `customers/{member_id}/wishlist`.
- `order/orders_calculation_total` (`orders/{order_id}/calculation/total`) — docs 는 `orders/calculation` (POST, order_id 없음).

**(c) METHOD_DIFF (4)** — docs 에 동일 path 있으나 우리가 쓰는 method 는 미문서화 (G-2 성격):
- `community/board_article_get` GET `boards/{board_no}/articles/{article_no}` (docs: PUT/DELETE만)
- `order/order_items_labels_delete` DELETE `.../labels` (docs: GET/POST/PUT만 — DELETE 는 `.../labels/{name}`)
- `order/subscription_shipments_get` GET `subscription/shipments/{subscription_id}` (docs: PUT만)
- `product/mains_products_delete` DELETE `mains/{display_group}/products` (docs: GET/POST/PUT만)

**(d) PATH_VARIANT (20)** — docs 에 대응 경로가 있으나 metadata path 가 다름:
- **translation 9개 — 단수 `translation/` vs docs 복수 `translations/`** (가장 큰 군집): `translation_products_list/_update`, `translation_categories_list/_update`, `translation_store_list/_update`, `translation_themes_list/_get/_update`. 추가로 `translation_themes_get/_update` 는 path param 도 `{theme_no}` vs docs `{skin_no}`.
- order: `orders_benefits_list`·`orders_coupons_list` — metadata 에 잉여 `{order_id}` (docs: `orders/benefits`·`orders/coupons`); `order/control` (`orders/control`, docs 무); `exchange_update_multiple` PUT `exchanges` (docs 단수 `exchange`).
- 잉여/누락 segment: `notification/customers_invitation_send`·`personal/customers_wishlist_count` — docs 에 `{member_id}` 추가; `mileage/points_autoexpiration_get/_delete` — docs 에 `/{id}` 없음; `design/theme_pages_get` — docs 에 `/{page_path}` 없음; `community/financials_monthlyreviews_count` — docs 에 `/count` 없음; `community/urgentinquiry_get` `{inquiry_no}` — docs 는 list 만.

**(e) SCOPE_MISMATCH (1)**: `store/carts_setting_update` PUT `carts/setting` — metadata `write` vs **docs 기본스펙 `mall.read_store` (read)**. (docs 가 PUT 에 read 를 명시 — cafe24 docs 자체 오류 의심이나 어쨌든 불일치.)

- [ ] **G-3 후속 (developer + planner 트랙)**: 위 (b)~(e) 를 cafe24 live API / changelog 로 대조해 metadata·index 정정 또는 docs-부재(G-2 류) 확정. translation 단/복수 (d) 가 사실이면 9개 endpoint 가 404 위험이므로 **최우선 검증**. catalog-sync 는 metadata↔index 만 보므로 본 docs 기준 드리프트는 잡지 못함 — 별도 가드 신설 검토.
