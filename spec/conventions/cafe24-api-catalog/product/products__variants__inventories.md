---
resource: product
entity: products__variants__inventories
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#products--variants--inventories
source: Cafe24 REST API Documentation (admin) — fields from full-page HTML; operation 응답 샘플은 code 엔드포인트 /docs/code/api/admin/shell/<entity>.json
---

# Cafe24 API — Product / Products variants inventories

> Field-level 카탈로그. Endpoint enumeration index: [`../product.md`](../product.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Products variants inventories](https://developers.cafe24.com/docs/ko/api/admin/#products--variants--inventories)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

재고(Inventories)는 판매 가능한 해당 품목의 수량을 의미합니다. 재고는 품목(Variants)별로 존재하며 해당 재고 이상 품목이 판매되면 해당 상품은 품절 상태가 됩니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `shop_no` |  | 멀티쇼핑몰 번호 멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호. |
| `variant_code` | 형식 : [A-Z0-9]; 글자수 최소: [12자]~최대: [12자] | 품목코드 시스템이 품목에 부여한 코드. 해당 쇼핑몰 내에서 품목 코드는 중복되지 않는다. |
| `use_inventory` |  | 재고 사용여부 해당 품목에서 재고 관리를 사용할 것인지 여부. 해당 품목에 재고 관리를 사용할 경우 재고 수량을 입력할 수 있다. 재고 관리를 사용하지 않을 경우 해당 상품은 재고와 관계 없이 판매할 수 있으며, 재고 수량, 재고수량 체크 기준, 품절 표시 여부를 사용할 수 없다. T : 사용함 · F : 사용안함 |
| `important_inventory` |  | 중요재고 여부 해당 재고를 중요하게 관리하는지 여부. 쇼핑몰에서는 검색을 하기위한 구분 데이터로 사용한다. A : 일반재고 · B : 중요재고 |
| `inventory_control_type` |  | 재고 수량체크 기준 재고 수량을 어느 시점에 차감할 것인지 여부. 무통장 입금처럼 결제 시점과 주문 시점이 다른 경우 재고를 차감하는 기준을 다르게 설정할 수 있다. · 주문 기준 : 주문한 시점에 재고 차감. 무통장 입금의 경우 입금 완료가 되지 않아도 재고를 차감한다. · 결제 기준 : 결제한 시점에 재고 차감. 무통장 입금의 경우 입금 완료가 된 다음 재고를 차감한다. A : 주문기준 · B : 결제기준 |
| `display_soldout` |  | 품절표시여부 재고가 다 판매되었을 경우 해당 품목을 품절로 표시할 것인지 여부. 품절로 표시되면 주문을 할 수 없다. 모든 품목이 품절이 될 경우 해당 상품에 품절 아이콘이 표시된다. · "표시안함" 선택시 재고가 다 판매되어도 주문이 가능하며 재고가 마이너스(-)로 표기된다. T : 품절표시 사용 · F : 품절표시 사용안함 |
| `quantity` |  | 수량 해당 품목에 판매가 가능한 재고 수량. 재고 수량은 주문 또는 결제시 차감되며, 품절 표시를 위하여 체크된다. |
| `safety_inventory` |  | 안전재고수량 |
| `origin_code` |  | 출고지 코드 |

## Operations

### `GET /api/v2/admin/products/{product_no}/variants/{variant_code}/inventories` — Retrieve inventory details of a product variant

- **Scope**: `mall.read_product` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-inventory-details-of-a-product-variant

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호. |
| `product_no` | ✓ |  |  | 상품번호 상품의 고유한 일련 번호. 해당 쇼핑몰 내에서 상품 번호는 중복되지 않음. |
| `variant_code` | ✓ | 형식 : [A-Z0-9]; 글자수 최소: [12자]~최대: [12자] |  | 품목코드 판매 수량을 검색할 품목 코드 |

#### 응답 (Response)

> Cafe24 공식 docs 의 대표 응답 샘플. 실제 필드 정의는 위 [응답 속성](#응답-속성-property-list) 참조.

```json
{
    "inventory": {
        "shop_no": 1,
        "variant_code": "P000000R000C",
        "use_inventory": "T",
        "important_inventory": "A",
        "inventory_control_type": "B",
        "display_soldout": "F",
        "quantity": 0,
        "safety_inventory": 0,
        "origin_code": "W00000BT"
    }
}
```

### `PUT /api/v2/admin/products/{product_no}/variants/{variant_code}/inventories` — Update a product variant inventory

- **Scope**: `mall.write_product` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 1
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#update-a-product-variant-inventory

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호. |
| `product_no` | ✓ |  |  | 상품번호 상품의 고유한 일련 번호. 해당 쇼핑몰 내에서 상품 번호는 중복되지 않음. |
| `variant_code` | ✓ | 형식 : [A-Z0-9]; 글자수 최소: [12자]~최대: [12자] |  | 품목코드 시스템이 품목에 부여한 코드. 해당 쇼핑몰 내에서 품목 코드는 중복되지 않는다. |
| `use_inventory` |  |  |  | 재고 사용여부 해당 품목에서 재고 관리를 사용할 것인지 여부. 해당 품목에 재고 관리를 사용할 경우 재고 수량을 입력할 수 있다. 재고 관리를 사용하지 않을 경우 해당 상품은 재고와 관계 없이 판매할 수 있으며, 재고 수량, 재고수량 체크 기준, 품절 표시 여부를 사용할 수 없다. T : 사용함 · F : 사용안함 |
| `important_inventory` |  |  |  | 중요재고 여부 해당 재고를 중요하게 관리하는지 여부. 쇼핑몰에서는 검색을 하기위한 구분 데이터로 사용한다. A : 일반재고 · B : 중요재고 |
| `inventory_control_type` |  |  |  | 재고 수량체크 기준 재고 수량을 어느 시점에 차감할 것인지 여부. 무통장 입금처럼 결제 시점과 주문 시점이 다른 경우 재고를 차감하는 기준을 다르게 설정할 수 있다. · 주문 기준 : 주문한 시점에 재고 차감. 무통장 입금의 경우 입금 완료가 되지 않아도 재고를 차감한다. · 결제 기준 : 결제한 시점에 재고 차감. 무통장 입금의 경우 입금 완료가 된 다음 재고를 차감한다. A : 주문기준 · B : 결제기준 |
| `display_soldout` |  |  |  | 품절표시여부 재고가 다 판매되었을 경우 해당 품목을 품절로 표시할 것인지 여부. 품절로 표시되면 주문을 할 수 없다. 모든 품목이 품절이 될 경우 해당 상품에 품절 아이콘이 표시된다. · "표시안함" 선택시 재고가 다 판매되어도 주문이 가능하며 재고가 마이너스(-)로 표기된다. T : 품절표시 사용 · F : 품절표시 사용안함 |
| `quantity` |  |  |  | 수량 해당 품목에 판매가 가능한 재고 수량. 재고 수량은 주문 또는 결제시 차감되며, 품절 표시를 위하여 체크된다. |
| `safety_inventory` |  |  |  | 안전재고수량 |
| `origin_code` |  |  |  | 출고지 코드 |

#### 응답 (Response)

> Cafe24 공식 docs 의 대표 응답 샘플. 실제 필드 정의는 위 [응답 속성](#응답-속성-property-list) 참조.

```json
{
    "inventory": {
        "shop_no": 1,
        "variant_code": "P00000GR000A",
        "use_inventory": "T",
        "important_inventory": "A",
        "inventory_control_type": "A",
        "display_soldout": "T",
        "quantity": 3,
        "safety_inventory": 8,
        "origin_code": "W00000BT"
    }
}
```
