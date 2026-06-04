---
resource: store
entity: shippingmanager
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#shippingmanager
source: Cafe24 REST API Documentation (admin) — fields from full-page HTML; operation 응답 샘플은 code 엔드포인트 /docs/code/api/admin/shell/<entity>.json
---

# Cafe24 API — Store / Shippingmanager

> Field-level 카탈로그. Endpoint enumeration index: [`../store.md`](../store.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Shippingmanager](https://developers.cafe24.com/docs/ko/api/admin/#shippingmanager)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

배송 관리자(Shippingmanager)는 배송 관리자 활성화 정보 관련 기능입니다. · 배송 관리자의 사용 정보를 조회할 수 있습니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `use` |  | 배송 관리자 활성화 정보 |

## Operations

### `GET /api/v2/admin/shippingmanager` — Retrieve activation information for Shipping Manager

- **Scope**: `mall.read_store` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-activation-information-for-shipping-manager

_요청 파라미터 없음._

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `shippingmanager` |  | (응답 객체) |
| ↳ `use` |  | 배송 관리자 활성화 정보 |

응답 예시 (JSON):

```json
{
    "shippingmanager": {
        "use": "T"
    }
}
```
