---
resource: store
entity: naverpay-setting
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#naverpay-setting
source: Cafe24 REST API Documentation (admin) — downloaded 2026-06-03
---

# Cafe24 API — Store / Naverpay setting

> Field-level 카탈로그. Endpoint enumeration index: [`../store.md`](../store.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Naverpay setting](https://developers.cafe24.com/docs/ko/api/admin/#naverpay-setting)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

네이버페이 설정(Naverpay Setting)은 쇼핑몰의 네이버페이 공통인증키를 조회하거나 수정할 수 있는 기능입니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `shop_no` |  | 멀티쇼핑몰 번호 |
| `authentication_key` |  | 네이버 공통 인증키 |
| `naverpay_version` |  | 네이버페이 연동버전 |
| `shop_id` |  | 페이센터 ID |
| `is_button_show` |  | 네이버페이 구매 버튼 노출 |
| `is_used_order` |  | 네이버 주문연동 |
| `is_used_review` |  | 네이버 구매평연동 |
| `is_show_review` |  | 네이버 구매평노출 |
| `is_order_page` |  | 네이버페이 구매 버튼 클릭 시 페이지 이동 |
| `certi_key` |  | 네이버 가맹점 인증키 |
| `image_key` |  | 네이버 버튼 인증키 |
| `naver_button_pc_product` |  | 네이버 버튼 디자인 : PC 상품상세페이지 |
| `naver_button_pc_basket` |  | 네이버 버튼 디자인 : PC 장바구니페이지 |
| `naver_button_mobile_product` |  | 네이버 버튼 디자인 : Mobile 상품상세페이지 |
| `naver_button_mobile_basket` |  | 네이버 버튼 디자인 : Mobile 장바구니페이지 |

## Operations

### `GET /api/v2/admin/naverpay/setting` — Retrieve Naver Pay settings

- **Scope**: `mall.read_store` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-naver-pay-settings

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |

### `POST /api/v2/admin/naverpay/setting` — Create Naver Pay settings

- **Scope**: `mall.write_store` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 1
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#create-naver-pay-settings

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |
| `authentication_key` |  | 형식 : [a-zA-Z0-9_-]; 최대글자수 : [50자] |  | 네이버 공통 인증키 |
| `naverpay_version` |  |  | 2.1 | 네이버페이 연동버전 |
| `shop_id` | ✓ |  |  | 페이센터 ID |
| `is_button_show` |  |  | T | 네이버페이 구매 버튼 노출 |
| `is_used_order` |  |  | T | 네이버 주문연동 |
| `is_used_review` |  |  | T | 네이버 구매평연동 |
| `is_show_review` |  |  | T | 네이버 구매평노출 |
| `is_order_page` |  |  | N | 네이버페이 구매 버튼 클릭 시 페이지 이동 |
| `certi_key` | ✓ |  |  | 네이버 가맹점 인증키 |
| `image_key` | ✓ |  |  | 네이버 버튼 인증키 |
| `naver_button_pc_product` |  |  | A\|1\|2 | 네이버 버튼 디자인 : PC 상품상세페이지 |
| `naver_button_pc_basket` |  |  | A\|1\|1 | 네이버 버튼 디자인 : PC 장바구니페이지 |
| `naver_button_mobile_product` |  |  | MA\|1\|2 | 네이버 버튼 디자인 : Mobile 상품상세페이지 |
| `naver_button_mobile_basket` |  |  | MA\|1\|1 | 네이버 버튼 디자인 : Mobile 장바구니페이지 |

### `PUT /api/v2/admin/naverpay/setting` — Update Naver Pay settings

- **Scope**: `mall.write_store` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 1
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#update-naver-pay-settings

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |
| `authentication_key` |  | 형식 : [a-zA-Z0-9_-]; 최대글자수 : [50자] |  | 네이버 공통 인증키 |
