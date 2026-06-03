---
resource: order
entity: control
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#control
source: Cafe24 REST API Documentation (admin) — downloaded 2026-06-03
---

# Cafe24 API — Order / Control

> Field-level 카탈로그. Endpoint enumeration index: [`../order.md`](../order.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Control](https://developers.cafe24.com/docs/ko/api/admin/#control)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

주문 입금확인 제한여부 기능을 제공합니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `payments_control` |  | 주문 입금확인 제한여부 |
| `direct_url` |  | 연결 URL |

## Operations

### `PUT /api/v2/admin/control` — Order control

- **Scope**: `mall.write_order` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 1
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#order-control

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `payments_control` | ✓ |  |  | 주문 입금확인 제한여부 T:사용함 · F:사용안함 |
| `direct_url` | ✓ | URL |  | 연결 URL |
