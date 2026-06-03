---
id: makeshop-shop
status: spec-only
code: []
pending_plans:
  - plan/in-progress/makeshop-integration.md
---

# Makeshop API Catalog — 상점 설정 (Shop)

> 상위: [`_overview.md`](./_overview.md) · 전체 스키마(요청/응답 필드): [`openapi/shop.openapi.json`](./openapi/shop.openapi.json)

공통 prefix `/api/v1/{shopId}/` 는 `path` 컬럼에서 생략. 인증 `bearerAuth`. 본 표는 메이크샵 공식 문서에서 자동 추출한 **구현 전 레퍼런스**다 (우리 백엔드 메타데이터 미존재 → status/sync test 없음).

## REST endpoints (39)

| id | 라벨 (한) | method | path | 권한 (x-scope) | docs |
|----|-----------|--------|------|----------------|------|
| `get-authority` | 상점 권한 조회 | GET | `authority` | 상점 설정 | [↗](https://developer.makeshop.co.kr/docs/api/shop/get-authority) |
| `get-bank_account` | 무통장 계좌 조회 | GET | `bank_account` | 상점 설정 | [↗](https://developer.makeshop.co.kr/docs/api/shop/get-bank-account) |
| `get-cart_free_config` | 카트프리 설정 조회 | GET | `cart_free_config` | 상점 설정 | [↗](https://developer.makeshop.co.kr/docs/api/shop/get-cart-free-config) |
| `get-cart_free_config-update` | 카트프리 설정 변경 | GET | `cart_free_config/update` | 상점 설정 | [↗](https://developer.makeshop.co.kr/docs/api/shop/get-cart-free-config-update) |
| `get-crm_board_config` | 1:1 게시판 설정 조회 | GET | `crm_board_config` | 상점 설정 | [↗](https://developer.makeshop.co.kr/docs/api/shop/get-crm-board-config) |
| `get-delivery_company` | 택배사 조회 | GET | `delivery_company` | 상점 설정 | [↗](https://developer.makeshop.co.kr/docs/api/shop/get-delivery-company) |
| `get-information` | 상점 정보 조회 | GET | `information` | 주문 | [↗](https://developer.makeshop.co.kr/docs/api/shop/get-information) |
| `get-kakaopay` | 카카오페이 바로구매 설정 조회 | GET | `kakaopay` | 상점 설정 | [↗](https://developer.makeshop.co.kr/docs/api/shop/get-kakaopay) |
| `get-main_display_code` | 메인 화면 상품 진열 코드 조회 | GET | `main_display_code` | 상점 설정 | [↗](https://developer.makeshop.co.kr/docs/api/shop/get-main-display-code) |
| `get-naverpay` | 네이버페이 설정 조회 | GET | `naverpay` | 상점 설정 | [↗](https://developer.makeshop.co.kr/docs/api/shop/get-naverpay) |
| `get-order_config` | 주문서 2.0 설정 조회 | GET | `order_config` | 상점 설정 | [↗](https://developer.makeshop.co.kr/docs/api/shop/get-order-config) |
| `get-page_min_image_size` | 메인/상품화면 최소 이미지 크기 조회 | GET | `page_min_image_size` | 상점 설정 | [↗](https://developer.makeshop.co.kr/docs/api/shop/get-page-min-image-size) |
| `get-page_seo` | 페이지 SEO 조회 | GET | `page_seo` | 상점 설정 | [↗](https://developer.makeshop.co.kr/docs/api/shop/get-page-seo) |
| `get-payco` | 페이코 바로구매 설정 조회 | GET | `payco` | 상점 설정 | [↗](https://developer.makeshop.co.kr/docs/api/shop/get-payco) |
| `get-privacy` | 회원 약관 내역 조회 | GET | `privacy` | 상점 설정 | [↗](https://developer.makeshop.co.kr/docs/api/shop/get-privacy) |
| `get-product_neogift` | 고급형 사은품 이벤트 조회 | GET | `product_neogift` | 상점 설정 | [↗](https://developer.makeshop.co.kr/docs/api/shop/get-product-neogift) |
| `get-provider_sub_admin` | 공급자 부운영자 조회 | GET | `provider_sub_admin` | 상점 설정 | [↗](https://developer.makeshop.co.kr/docs/api/shop/get-provider-sub-admin) |
| `get-smart_coupon_config` | 스마트 쿠폰 설정 조회 | GET | `smart_coupon_config` | 상점 설정 | [↗](https://developer.makeshop.co.kr/docs/api/shop/get-smart-coupon-config) |
| `get-smart_reserve_config` | 스마트 적립금 설정 조회 | GET | `smart_reserve_config` | 상점 설정 | [↗](https://developer.makeshop.co.kr/docs/api/shop/get-smart-reserve-config) |
| `get-sms_config` | SMS 서비스 설정 조회 | GET | `sms_config` | 상점 설정 | [↗](https://developer.makeshop.co.kr/docs/api/shop/get-sms-config) |
| `get-social_apple` | 간편가입 Apple 연동 조회 | GET | `social_apple` | 상점 설정 | [↗](https://developer.makeshop.co.kr/docs/api/shop/get-social-apple) |
| `get-social_facebook` | 간편가입 Facebook 연동 조회 | GET | `social_facebook` | 상점 설정 | [↗](https://developer.makeshop.co.kr/docs/api/shop/get-social-facebook) |
| `get-social_kakao` | 간편가입 카카오 연동 조회 | GET | `social_kakao` | 상점 설정 | [↗](https://developer.makeshop.co.kr/docs/api/shop/get-social-kakao) |
| `get-social_naver` | 간편가입 네이버 연동 조회 | GET | `social_naver` | 상점 설정 | [↗](https://developer.makeshop.co.kr/docs/api/shop/get-social-naver) |
| `get-sub_admin` | 부운영자 설정 조회 | GET | `sub_admin` | 상점 설정 | [↗](https://developer.makeshop.co.kr/docs/api/shop/get-sub-admin) |
| `get-subs_config` | 정기배송/구독 설정 조회 | GET | `subs_config` | 상점 설정 | [↗](https://developer.makeshop.co.kr/docs/api/shop/get-subs-config) |
| `post-kakaopay` | 카카오페이 바로구매 설정 | POST | `kakaopay` | 상점 설정 | [↗](https://developer.makeshop.co.kr/docs/api/shop/post-kakaopay) |
| `post-naverpay` | 네이버페이 설정 | POST | `naverpay` | 상점 설정 | [↗](https://developer.makeshop.co.kr/docs/api/shop/post-naverpay) |
| `post-page_min_image_size` | 메인/상품화면 최소 이미지 크기 설정 | POST | `page_min_image_size` | 상점 설정 | [↗](https://developer.makeshop.co.kr/docs/api/shop/post-page-min-image-size) |
| `post-page_seo` | 페이지 SEO 등록 | POST | `page_seo` | 상점 설정 | [↗](https://developer.makeshop.co.kr/docs/api/shop/post-page-seo) |
| `post-payco` | 페이코 바로구매 설정 | POST | `payco` | 상점 설정 | [↗](https://developer.makeshop.co.kr/docs/api/shop/post-payco) |
| `post-product_neogift` | 고급형 사은품 이벤트 설정 | POST | `product_neogift` | 상점 설정 | [↗](https://developer.makeshop.co.kr/docs/api/shop/post-product-neogift) |
| `post-provider_sub_admin-create` | 공급자 부운영자 등록 | POST | `provider_sub_admin/create` | 상점 설정 | [↗](https://developer.makeshop.co.kr/docs/api/shop/post-provider-sub-admin-create) |
| `post-provider_sub_admin-delete` | 공급자 부운영자 삭제 | POST | `provider_sub_admin/delete` | 상점 설정 | [↗](https://developer.makeshop.co.kr/docs/api/shop/post-provider-sub-admin-delete) |
| `post-provider_sub_admin-update` | 공급자 부운영자 수정 | POST | `provider_sub_admin/update` | 상점 설정 | [↗](https://developer.makeshop.co.kr/docs/api/shop/post-provider-sub-admin-update) |
| `post-social_apple` | 간편가입 Apple 연동 설정 | POST | `social_apple` | 상점 설정 | [↗](https://developer.makeshop.co.kr/docs/api/shop/post-social-apple) |
| `post-social_facebook` | 간편가입 Facebook 연동 설정 | POST | `social_facebook` | 상점 설정 | [↗](https://developer.makeshop.co.kr/docs/api/shop/post-social-facebook) |
| `post-social_kakao` | 간편가입 카카오 연동 설정 | POST | `social_kakao` | 상점 설정 | [↗](https://developer.makeshop.co.kr/docs/api/shop/post-social-kakao) |
| `post-social_naver` | 간편가입 네이버 연동 설정 | POST | `social_naver` | 상점 설정 | [↗](https://developer.makeshop.co.kr/docs/api/shop/post-social-naver) |
