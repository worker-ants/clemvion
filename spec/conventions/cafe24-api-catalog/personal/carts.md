---
resource: personal
entity: carts
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#carts
source: Cafe24 REST API Documentation (admin) — downloaded 2026-06-03
---

# Cafe24 API — Personal / Carts

> Field-level 카탈로그. Endpoint enumeration index: [`../personal.md`](../personal.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Carts](https://developers.cafe24.com/docs/ko/api/admin/#carts)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

장바구니(Carts)는 상품을 주문하기 전 한번에 주문할 수 있도록 상품을 미리 담아두는 기능입니다. · 장바구니 리소스에서는 Front API를 사용하여 특정 상품을 장바구니에 담을 수 있고 Admin API에서는 특정 회원의 장바구니를 조회할 수 있습니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `shop_no` |  | 멀티쇼핑몰 번호 |
| `basket_product_no` |  | 장바구니 상품번호 |
| `member_id` |  | 회원아이디 |
| `created_date` |  | 담은일자 |
| `product_no` |  | 상품번호 |
| `additional_option_values` |  | 추가입력 옵션 |
| `variant_code` | 형식 : [A-Z0-9]; 글자수 최소: [12자]~최대: [12자] | 상품 품목 코드 |
| `quantity` |  | 수량 |
| `product_price` |  | 상품 판매가 |
| `option_price` |  | 옵션 추가 가격 |
| `product_bundle` |  | 세트상품 여부 T : 세트상품 · F : 세트상품 아님 |
| `shipping_type` |  | 배송 유형 A : 국내 · B : 해외 |
| `category_no` |  | 분류 번호 |

## Operations

### `GET /api/v2/admin/carts` — Retrieve a shopping cart

- **Scope**: `mall.read_personal` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-shopping-cart

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |
| `member_id` | ✓ |  |  | 회원아이디 ,(콤마)로 여러 건을 검색할 수 있다. |
| `offset` |  | 최대값: [10000] | 0 | 조회결과 시작위치 |
| `limit` |  | 최소: [1]~최대: [100] | 10 | 조회결과 최대건수 |
