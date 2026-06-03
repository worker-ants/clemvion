---
resource: order
entity: labels
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#labels
source: Cafe24 REST API Documentation (admin) — downloaded 2026-06-03
---

# Cafe24 API — Order / Labels

> Field-level 카탈로그. Endpoint enumeration index: [`../order.md`](../order.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Labels](https://developers.cafe24.com/docs/ko/api/admin/#labels)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

Labels(주문 라벨)이란, 각각의 주문을 쉽게 식별하고 구분할 수 있도록 도와주는 기능입니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `shop_no` |  | 멀티쇼핑몰 번호 |
| `names` |  | 주문 라벨명 |
| `name` |  | 주문 라벨명 |
| `order_item_code` |  | 품주코드 |

## Operations

### `GET /api/v2/admin/labels` — Retrieve order labels

- **Scope**: `mall.read_order` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-order-labels

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `limit` |  | 최소: [1]~최대: [1000] | 100 | 조회결과 최대건수 |
| `offset` |  | 최대값: [15000] | 0 | 조회결과 시작위치 |

### `POST /api/v2/admin/labels` — Create multiple order labels

- **Scope**: `mall.write_order` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 10
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#create-multiple-order-labels

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |
| `name` | ✓ |  |  | 주문 라벨명 |
| `order_item_code` | ✓ |  |  | 품주코드 |
