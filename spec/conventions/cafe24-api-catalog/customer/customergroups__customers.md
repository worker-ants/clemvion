---
resource: customer
entity: customergroups__customers
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#customergroups--customers
source: Cafe24 REST API Documentation (admin) — fields from full-page HTML; operation 응답 샘플은 code 엔드포인트 /docs/code/api/admin/shell/<entity>.json
---

# Cafe24 API — Customer / Customergroups customers

> Field-level 카탈로그. Endpoint enumeration index: [`../customer.md`](../customer.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Customergroups customers](https://developers.cafe24.com/docs/ko/api/admin/#customergroups--customers)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

회원등급의 회원(Customergroups customers)은 특정 회원등급의 회원과 관련된 기능입니다. · 특정 회원을 특정 등급으로 변경할 수 있습니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `shop_no` |  | 멀티쇼핑몰 번호 |
| `group_no` |  | 회원등급번호 |
| `member_id` |  | 회원아이디 |
| `fixed_group` |  | 회원등급 고정 여부 특정 회원이 회원자동등급변경에 적용되지 않기 위한 등급 고정 여부. · 회원자동등급변경 기능을 사용하는 몰에서만 사용 가능하다. T : 고정함 · F : 고정안함 |

## Operations

### `POST /api/v2/admin/customergroups/{group_no}/customers` — Update a customer's customer tier

- **Scope**: `mall.write_customer` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 200
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#update-a-customer-s-customer-tier

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 |
| `group_no` | ✓ |  |  | 회원등급번호 |
| `member_id` | ✓ | 최대글자수 : [20자] |  | 회원아이디 |
| `fixed_group` |  |  | F | 회원등급 고정 여부 특정 회원이 회원자동등급변경에 적용되지 않기 위한 등급 고정 여부 · 회원자동등급변경 기능을 사용하는 몰에서만 사용 가능하다. T : 고정함 · F : 고정안함 |

#### 응답 (Response)

> Cafe24 공식 docs 의 대표 응답 샘플. 실제 필드 정의는 위 [응답 속성](#응답-속성-property-list) 참조.

```json
{
    "customers": [
        {
            "shop_no": 1,
            "group_no": 1,
            "member_id": "sampleid1",
            "fixed_group": "T"
        },
        {
            "shop_no": 1,
            "group_no": 1,
            "member_id": "sampleid2",
            "fixed_group": "F"
        }
    ]
}
```
