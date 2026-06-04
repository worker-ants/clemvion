---
resource: store
entity: carts-setting
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#carts-setting
source: Cafe24 REST API Documentation (admin) — fields from full-page HTML; operation 응답 샘플은 code 엔드포인트 /docs/code/api/admin/shell/<entity>.json
---

# Cafe24 API — Store / Carts setting

> Field-level 카탈로그. Endpoint enumeration index: [`../store.md`](../store.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Carts setting](https://developers.cafe24.com/docs/ko/api/admin/#carts-setting)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

장바구니 설정을 조회하고 설정을 변경할 수 있습니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `shop_no` |  | 멀티쇼핑몰 번호 |
| `wishlist_display` |  | 장바구니 관심상품 노출 여부 |
| `add_action_type` |  | 장바구니 담기 이후 액션 타입 |
| `cart_item_direct_purchase` |  | 담긴 상품 확인 및 구매 가능여부 |
| `storage_period` |  | 장바구니 저장 기간 설정 여부 |
| `period` |  | 설정할 저장기간 장바구니 저장기간은 1,2,3,4,5,6,7,8,9,10,14,30일 중 설정 가능 |
| `icon_display` |  | 장바구니 담기 아이콘 표시 여부 |
| `cart_item_option_change` |  | 장바구니에서 상품 옵션 변경가능 하도록 제공 여부 |
| `discount_display` |  | 장바구니에 할인 금액 표시 |

## Operations

### `GET /api/v2/admin/carts/setting` — Retrieve carts settings

- **Scope**: `mall.read_store` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-carts-settings

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 |

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `cart` |  | (응답 객체) |
| ↳ `shop_no` |  | 멀티쇼핑몰 번호 |
| ↳ `wishlist_display` |  | 장바구니 관심상품 노출 여부 |
| ↳ `add_action_type` |  | 장바구니 담기 이후 액션 타입 |
| ↳ `cart_item_direct_purchase` |  | 담긴 상품 확인 및 구매 가능여부 |
| ↳ `storage_period` |  | 장바구니 저장 기간 설정 여부 |
| ↳ `period` |  | 설정할 저장기간 장바구니 저장기간은 1,2,3,4,5,6,7,8,9,10,14,30일 중 설정 가능 |
| ↳ `icon_display` |  | 장바구니 담기 아이콘 표시 여부 |
| ↳ `cart_item_option_change` |  | 장바구니에서 상품 옵션 변경가능 하도록 제공 여부 |
| ↳ `discount_display` |  | 장바구니에 할인 금액 표시 |

응답 예시 (JSON):

```json
{
    "cart": {
        "shop_no": 1,
        "wishlist_display": "T",
        "add_action_type": "M",
        "cart_item_direct_purchase": "T",
        "storage_period": "T",
        "period": "7",
        "icon_display": "T",
        "cart_item_option_change": "T",
        "discount_display": "T"
    }
}
```

### `PUT /api/v2/admin/carts/setting` — Update carts settings

- **Scope**: `mall.read_store` (read)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 1
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#update-carts-settings

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |
| `wishlist_display` |  |  |  | 장바구니 관심상품 노출 여부 T: 사용함 · F: 사용안함 |
| `add_action_type` |  |  |  | 장바구니 담기 이후 액션 타입 M: 장바구니 페이지 바로 이동 · S: 장바구니 페이지 이동 유무 선택 |
| `cart_item_direct_purchase` |  |  |  | 담긴 상품 확인 및 구매 가능여부 T: 사용함 · F: 사용안함 |
| `storage_period` |  |  |  | 장바구니 저장 기간 설정 여부 T: 설정함 · F: 설정안함 |
| `period` |  |  |  | 설정할 저장기간 장바구니 저장기간은 1,2,3,4,5,6,7,8,9,10,14,30일 중 설정 가능 |
| `icon_display` |  |  |  | 장바구니 담기 아이콘 표시 여부 T: 사용함 · F: 사용안함 |
| `cart_item_option_change` |  |  |  | 장바구니에서 상품 옵션 변경가능 하도록 제공 여부 T: 사용함 · F: 사용안함 |
| `discount_display` |  |  |  | 장바구니에 할인 금액 표시 T: 사용함 · F: 사용안함 |

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `cart` |  | (응답 객체) |
| ↳ `shop_no` |  | 멀티쇼핑몰 번호 |
| ↳ `wishlist_display` |  | 장바구니 관심상품 노출 여부 |
| ↳ `add_action_type` |  | 장바구니 담기 이후 액션 타입 |
| ↳ `cart_item_direct_purchase` |  | 담긴 상품 확인 및 구매 가능여부 |
| ↳ `storage_period` |  | 장바구니 저장 기간 설정 여부 |
| ↳ `period` |  | 설정할 저장기간 장바구니 저장기간은 1,2,3,4,5,6,7,8,9,10,14,30일 중 설정 가능 |
| ↳ `icon_display` |  | 장바구니 담기 아이콘 표시 여부 |
| ↳ `cart_item_option_change` |  | 장바구니에서 상품 옵션 변경가능 하도록 제공 여부 |
| ↳ `discount_display` |  | 장바구니에 할인 금액 표시 |

응답 예시 (JSON):

```json
{
    "cart": {
        "shop_no": 1,
        "wishlist_display": "T",
        "add_action_type": "M",
        "cart_item_direct_purchase": "T",
        "storage_period": "T",
        "period": "7",
        "icon_display": "T",
        "cart_item_option_change": "T",
        "discount_display": "T"
    }
}
```
