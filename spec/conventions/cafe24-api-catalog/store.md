# Cafe24 API Catalog — Store (상점)

> 카탈로그 형식·동기 정책: [`_overview.md`](./_overview.md). Store 는 sub-resource 가 50+ 개로 가장 크다 — 상점 설정·결제·정책 등 다수.

base URL: `https://{mall_id}.cafe24api.com/api/v2/admin/`

> **일부 operation 별도 승인 필요** — `mall.read_store` / `mall.write_store` 자체는 일반 사용 가능하지만, 안의 일부 operation (Activitylogs, Menus, Naverpay/Kakaopay setting, Paymentgateway 관련, Financials paymentgateway) 은 카페24 본사가 별도 승인한 클라이언트만 사용할 수 있다. 해당 row 만 `restricted: operation` 으로 표기되며, 대응 backend 메타데이터의 `restrictedApproval.level='operation'` + `approvalGroup` 이 `activitylogs` / `menus` / `naverpay_setting` / `kakaopay_setting` / `pg_settings` 중 하나로 채워진다. 자매 일반 operation 의 `restricted` 컬럼은 빈칸 유지. 명단 SoT: [`cafe24-restricted-scopes.md §2`](../cafe24-restricted-scopes.md#2-operation-단위-별도-승인-store-scope-안의-일부).

## 표

| id | 라벨 (한) | English title | method | path | scope | restricted | paginated | status | docs |
|----|---|---|---|---|---|---|---|---|---|
| `store_get` | 상점 정보 조회 | Retrieve store details | GET | `store` | read |  |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-store-details) |
| `shops_list` | 멀티쇼핑몰 목록 조회 | Retrieve a list of shops | GET | `shops` | read |  |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-shops) |
| `shops_get` | 멀티쇼핑몰 단건 조회 | Retrieve a shop | GET | `shops/{shop_no}` | read |  |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-shop) |
| `activitylogs_list` | 액션 로그 목록 | Retrieve a list of action logs | GET | `activitylogs` | read | operation | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-action-logs) |
| `activitylogs_get` | 액션 로그 단건 조회 | Retrieve an action log | GET | `activitylogs/{process_no}` | read | operation |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-an-action-log) |
| `automessages_arguments_get` | 자동 메시지 변수 목록 | Retrieve the list of available variables for automated messages | GET | `automessages/arguments` | read |  |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-the-list-of-available-variables-for-automated-messages) |
| `automessages_setting_get` | 자동 메시지 설정 조회 | Retrieve the automated message settings | GET | `automessages/setting` | read |  |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-the-automated-message-settings) |
| `automessages_setting_update` | 자동 메시지 설정 수정 | Update an automated message | PUT | `automessages/setting` | write |  |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-an-automated-message) |
| `benefits_setting_get` | 혜택 설정 조회 | Retrieve incentive settings | GET | `benefits/setting` | read |  |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-incentive-settings) |
| `benefits_setting_update` | 혜택 설정 수정 | Update incentive settings | PUT | `benefits/setting` | write |  |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-incentive-settings) |
| `boards_setting_get` | 게시판 설정 조회 (store) | Retrieve board settings | GET | `boards/setting` | read |  |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-board-settings) |
| `boards_setting_update` | 게시판 설정 수정 (store) | Update board settings | PUT | `boards/setting` | write |  |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-board-settings) |
| `carts_setting_get` | 장바구니 설정 조회 | Retrieve carts settings | GET | `carts/setting` | read |  |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-carts-settings) |
| `carts_setting_update` | 장바구니 설정 수정 | Update carts settings | PUT | `carts/setting` | write |  |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-carts-settings) |
| `categories_properties_setting_get` | 카테고리 진열 추가 설정 조회 | Retrieve additional settings for products in the list | GET | `categories/properties/setting` | read |  |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-additional-settings-for-products-in-the-list) |
| `categories_properties_setting_update` | 카테고리 진열 추가 설정 수정 | Update additional settings for products in the list | PUT | `categories/properties/setting` | write |  |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-additional-settings-for-products-in-the-list) |
| `coupons_setting_get` | 쿠폰 설정 조회 | Retrieve coupon settings | GET | `coupons/setting` | read |  |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-coupon-settings) |
| `coupons_setting_update` | 쿠폰 설정 수정 | Update coupon settings | PUT | `coupons/setting` | write |  |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-coupon-settings) |
| `currency_get` | 통화 설정 조회 | Retrieve currency settings | GET | `currency` | read |  |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-currency-settings) |
| `currency_update` | 통화 수정 | Update a currency | PUT | `currency` | write |  |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-a-currency) |
| `customers_setting_get` | 회원 관련 설정 조회 | Retrieve member related settings | GET | `customers/setting` | read |  |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-member-related-settings) |
| `customers_setting_update` | 회원 관련 설정 수정 | Update customers setting | PUT | `customers/setting` | write |  |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-customers-setting) |
| `dashboard_get` | 대시보드 조회 | Retrieve a dashboard | GET | `dashboard` | read |  |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-dashboard) |
| `financials_paymentgateway_get` | 결제대행사 계약 정보 조회 | Retrieve a list of payment gateway contract details | GET | `financials/paymentgateway` | read | operation | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-payment-gateway-contract-details) |
| `financials_store_get` | 상점 거래 정보 조회 | Retrieve the transaction information of a store | GET | `financials/store` | read |  |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-the-transaction-information-of-a-store) |
| `images_setting_get` | 상품 이미지 크기 설정 조회 | Retrieve product image size settings | ? | ? | ? |  |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-product-image-size-settings) |
| `images_setting_update` | 상품 이미지 크기 설정 수정 | Update product image size settings | ? | ? | ? |  |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-product-image-size-settings) |
| `information_get` | 상점 정책 조회 | Retrieve store policies | ? | ? | ? |  |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-store-policies) |
| `information_update` | 상점 정책 수정 | Update store policies | ? | ? | ? |  |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-store-policies) |
| `kakaoalimtalk_profile_get` | 카카오 채널 발신자 프로필 키 조회 | Retrieve a Kakao channel sender profile key | ? | ? | ? |  |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-kakao-channel-sender-profile-key) |
| `kakaoalimtalk_setting_get` | 카카오 알림톡 설정 조회 | Retrieve the Kakao info talk settings | ? | ? | ? |  |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-the-kakao-info-talk-settings) |
| `kakaoalimtalk_setting_update` | 카카오 알림톡 설정 수정 | Update the Kakao info talk settings | ? | ? | ? |  |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-the-kakao-info-talk-settings) |
| `kakaopay_setting_get` | 카카오페이 주문 설정 조회 | Retrieve settings for kakaopay orders | ? | ? | ? | operation |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-settings-for-kakaopay-orders) |
| `kakaopay_setting_update` | 카카오페이 주문 설정 수정 | Update settings for kakaopay orders | ? | ? | ? | operation |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-settings-for-kakaopay-orders) |
| `mains_properties_setting_get` | 메인 진열 추가 설정 조회 | Retrieve additional settings for products on the main screen | ? | ? | ? |  |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-additional-settings-for-products-on-the-main-screen) |
| `mains_properties_setting_update` | 메인 진열 추가 설정 수정 | Update additional settings for products on the main screen | ? | ? | ? |  |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-additional-settings-for-products-on-the-main-screen) |
| `menus_get` | 메뉴 조회 | Retrieve menus | GET | `menus` | read | operation |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-menus) |
| `mobile_setting_get` | 모바일 설정 조회 | Retrieve mobile settings | ? | ? | ? |  |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-mobile-settings) |
| `mobile_setting_update` | 모바일 설정 수정 | Update mobile settings | ? | ? | ? |  |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-mobile-settings) |
| `naverpay_setting_get` | 네이버페이 설정 조회 | Retrieve Naver Pay settings | ? | ? | ? | operation |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-naver-pay-settings) |
| `naverpay_setting_create` | 네이버페이 설정 생성 | Create Naver Pay settings | ? | ? | ? | operation |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-naver-pay-settings) |
| `naverpay_setting_update` | 네이버페이 설정 수정 | Update Naver Pay settings | ? | ? | ? | operation |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-naver-pay-settings) |
| `orderform_setting_get` | 주문서 양식 설정 조회 | Retrieve the order order form settings | ? | ? | ? |  |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-the-order-order-form-settings) |
| `orderform_setting_update` | 주문서 양식 설정 수정 | Update the order order form settings | ? | ? | ? |  |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-the-order-order-form-settings) |
| `orders_setting_get` | 주문 설정 조회 | Retrieve order settings | ? | ? | ? |  |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-order-settings) |
| `orders_setting_update` | 주문 설정 수정 | Update order settings | ? | ? | ? |  |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-order-settings) |
| `orders_status_get` | 주문 상태 표기 조회 | Retrieve order status displayed | ? | ? | ? |  |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-order-status-displayed) |
| `orders_status_update` | 주문 상태 표기 수정 | Update order status displayed | ? | ? | ? |  |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-order-status-displayed) |
| `payment_setting_get` | 결제 설정 조회 | Retrieve payment settings | ? | ? | ? |  |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-payment-settings) |
| `payment_setting_update` | 결제 설정 수정 | Update payment settings | ? | ? | ? |  |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-payment-settings) |
| `paymentgateway_create` | 결제대행사 생성 | Create a payment gateway | POST | `paymentgateway` | write | operation |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-a-payment-gateway) |
| `paymentgateway_update` | 결제대행사 수정 | Update a payment gateway | PUT | `paymentgateway/{paymentgateway_id}` | write | operation |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-a-payment-gateway) |
| `paymentgateway_delete` | 결제대행사 삭제 | Delete a payment gateway | DELETE | `paymentgateway/{paymentgateway_id}` | write | operation |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#delete-a-payment-gateway) |
| `paymentgateway_paymentmethods_list` | 결제대행사 결제수단 목록 | Retrieve a list of payment gateway methods | GET | `paymentgateway/paymentmethods` | read | operation |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-payment-gateway-methods) |
| `paymentgateway_paymentmethods_create` | 결제대행사 결제수단 생성 | Create a payment gateway method | ? | ? | ? | operation |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-a-payment-gateway-method) |
| `paymentgateway_paymentmethods_update` | 결제대행사 결제수단 수정 | Update a payment method of a payment gateway | ? | ? | ? | operation |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-a-payment-method-of-a-payment-gateway) |
| `paymentgateway_paymentmethods_delete` | 결제대행사 결제수단 삭제 | Delete a payment method of a payment gateway | ? | ? | ? | operation |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#delete-a-payment-method-of-a-payment-gateway) |
| `paymentmethods_list` | 결제수단 목록 | Retrieve a list of payment methods | GET | `paymentmethods` | read |  | ✓ | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-payment-methods) |
| `paymentmethods_paymentproviders_list` | 결제수단별 제공사 목록 | Retrieve a list of providers by payment method | GET | `paymentmethods/paymentproviders` | read |  |  | supported | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-providers-by-payment-method) |
| `paymentmethods_paymentproviders_update_display` | 결제수단 노출 상태 수정 | Update the display status of a payment method | ? | ? | ? |  |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-the-display-status-of-a-payment-method) |
| `paymentservices_get` | PG 설정 목록 조회 | Retrieve a list of PG settings | ? | ? | ? |  |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-pg-settings) |
| `points_setting_get` | 적립금 설정 조회 | Retrieve points settings | ? | ? | ? |  |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-points-settings) |
| `points_setting_update` | 적립금 설정 수정 | Update points settings | ? | ? | ? |  |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-points-settings) |
| `policy_get` | 상점 프로필 조회 | Retrieve a store profile | ? | ? | ? |  |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-store-profile) |
| `policy_update` | 상점 프로필 수정 | Update a store profile | ? | ? | ? |  |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-a-store-profile) |
| `privacy_boards_get` | 게시판 개인정보 정책 조회 | Retrieve privacy policy for posting on board | ? | ? | ? |  |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-privacy-policy-for-posting-on-board) |
| `privacy_boards_update` | 게시판 개인정보 정책 수정 | Update privacy policy for posting on board | ? | ? | ? |  |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-privacy-policy-for-posting-on-board) |
| `privacy_join_get` | 회원가입 개인정보 정책 조회 | Retrieve privacy policy for signup | ? | ? | ? |  |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-privacy-policy-for-signup) |
| `privacy_join_update` | 회원가입 개인정보 정책 수정 | Update privacy policy for signup | ? | ? | ? |  |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-privacy-policy-for-signup) |
| `privacy_orders_get` | 주문 개인정보 정책 조회 | Retrieve privacy policy for checkout | ? | ? | ? |  |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-privacy-policy-for-checkout) |
| `privacy_orders_update` | 주문 개인정보 정책 수정 | Update privacy policy for checkout | ? | ? | ? |  |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-privacy-policy-for-checkout) |
| `products_display_setting_list` | 상품 진열 설정 목록 | List all products display setting | ? | ? | ? |  |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#list-all-products-display-setting) |
| `products_display_setting_update` | 상품 진열 설정 수정 | Update a products display setting | ? | ? | ? |  |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-a-products-display-setting) |
| `products_properties_setting_get` | 상품 상세 추가 설정 조회 | Retrieve additional settings for product details | ? | ? | ? |  |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-additional-settings-for-product-details) |
| `products_properties_setting_update` | 상품 상세 추가 설정 수정 | Update additional settings for product details | ? | ? | ? |  |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-additional-settings-for-product-details) |
| `products_setting_get` | 상품 설정 조회 | Retrieve product settings | ? | ? | ? |  |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-product-settings) |
| `redirects_list` | 리다이렉트 목록 | Retrieve a list of redirects | ? | ? | ? |  | ✓ | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-redirects) |
| `redirects_create` | 리다이렉트 생성 | Create a redirect | ? | ? | ? |  |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-a-redirect) |
| `redirects_update` | 리다이렉트 수정 | Update a redirect | ? | ? | ? |  |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-a-redirect) |
| `redirects_delete` | 리다이렉트 삭제 | Delete a redirect | ? | ? | ? |  |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#delete-a-redirect) |
| `restocknotification_setting_get` | 재입고 알림 설정 조회 | Retrieve restocknotification settings | ? | ? | ? |  |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-restocknotification-settings) |
| `restocknotification_setting_update` | 재입고 알림 설정 수정 | Update restocknotification settings | ? | ? | ? |  |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#updated-restocknotification-settings) |
| `seo_setting_get` | SEO 설정 조회 | Retrieve SEO settings | ? | ? | ? |  |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-seo-settings) |
| `seo_setting_update` | SEO 설정 수정 | Update store SEO settings | ? | ? | ? |  |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-store-seo-settings) |
| `shippingmanager_get` | 배송 매니저 활성화 정보 | Retrieve activation information for shipping manager | ? | ? | ? |  |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-activation-information-for-shipping-manager) |
| `sms_setting_get` | SMS 설정 조회 | Retrieve SMS settings | ? | ? | ? |  |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-sms-settings) |
| `sms_setting_update` | SMS 설정 수정 | Update SMS settings | ? | ? | ? |  |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-sms-settings) |
| `socials_apple_get` | Apple 로그인 연동 상세 | Apple login sync details | ? | ? | ? |  |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#apple-login-sync-details) |
| `socials_apple_settings_get` | Apple 로그인 연동 설정 | Apple login sync settings | ? | ? | ? |  |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#apple-login-sync-settings) |
| `socials_kakaosync_get` | 카카오 싱크 상세 | Kakao sync details | ? | ? | ? |  |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#kakao-sync-details) |
| `socials_kakaosync_update` | 카카오 싱크 수정 | Kakao sync updates | ? | ? | ? |  |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#kakao-sync-updates) |
| `socials_naverlogin_get` | 네이버 로그인 상세 | Naver login details | ? | ? | ? |  |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#naver-login-details) |
| `socials_naverlogin_update` | 네이버 로그인 수정 | Update Naver login settings | ? | ? | ? |  |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-naver-login-settings) |
| `socials_navershopping_get` | 네이버 쇼핑 설정 | Naver shopping settings | ? | ? | ? |  |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#naver-shopping-settings) |
| `store_accounts_list` | 상점 계좌 목록 | Retrieve a list of store bank accounts | ? | ? | ? |  |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-store-bank-accounts) |
| `store_dropshipping_get` | 위탁배송 설정 조회 | Retrieve dropshipping settings | ? | ? | ? |  |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-dropshipping-settings) |
| `store_dropshipping_manage` | 위탁배송 설정 관리 | Manage dropshipping settings | ? | ? | ? |  |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#manage-dropshipping-settings) |
| `store_setting_get` | 상점 보안 설정 조회 | Retrieve store security settings | ? | ? | ? |  |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-store-security-settings) |
| `store_setting_update` | 상점 보안 설정 수정 | Edit store security settings | ? | ? | ? |  |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#edit-store-security-settings) |
| `subscription_shipments_setting_list` | 정기배송 상품 목록 | Retrieve a list of subscription products | ? | ? | ? |  | ✓ | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-subscription-products) |
| `subscription_shipments_setting_create_rule` | 정기배송 결제 규칙 생성 | Create a subscription payment rule | ? | ? | ? |  |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#create-a-subscription-payment-rule) |
| `subscription_shipments_setting_update` | 정기배송 상품 수정 | Update subscription products | ? | ? | ? |  |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#update-subscription-products) |
| `subscription_shipments_setting_delete` | 정기배송 상품 삭제 | Delete subscription products | ? | ? | ? |  |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#delete-subscription-products) |
| `taxmanager_get` | 세금 매니저 활성화 정보 | Retrieve activation information for tax manager | ? | ? | ? |  |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-activation-information-for-tax-manager) |
| `users_list` | 운영자 사용자 목록 | Retrieve a list of admin users | ? | ? | ? |  | ✓ | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-admin-users) |
| `users_get` | 운영자 사용자 상세 | Retrieve admin user details | ? | ? | ? |  |  | planned | [↗](https://developers.cafe24.com/docs/ko/api/admin/#retrieve-admin-user-details) |

## Rationale

설계 근거 (컬럼 정의·동기 정책·status enum) 는 [`_overview.md`](./_overview.md) 의 §2·§4·§7. 별도 승인 라벨링의 의사결정 배경은 [`cafe24-restricted-scopes.md ## Rationale`](../cafe24-restricted-scopes.md#rationale).

> ※ `paymentmethods_list` / `paymentmethods_paymentproviders_list` / `paymentmethods_paymentproviders_update_display` 는 사용자 자료에 명시되지 않아 빈칸 유지. 공식 문서 재검증 후 별도 승인 대상으로 확인되면 동시 갱신.
