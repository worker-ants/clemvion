---
resource: customer
entity: customers__social
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#customers--social
source: Cafe24 REST API Documentation (admin) — fields from full-page HTML; operation 응답 샘플은 code 엔드포인트 /docs/code/api/admin/shell/<entity>.json
---

# Cafe24 API — Customer / Customers social

> Field-level 카탈로그. Endpoint enumeration index: [`../customer.md`](../customer.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Customers social](https://developers.cafe24.com/docs/ko/api/admin/#customers--social)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

회원의 SNS(Customers social)는 특정 회원에게 연동된 SNS 계정의 정보를 조회할 수 있는 기능입니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `shop_no` |  | 멀티쇼핑몰 번호 |
| `member_id` |  | 회원아이디 |
| `social_name` |  | 연동 된 SNS명 |
| `social_member_code` |  | 연동 된 SNS 제공코드 |
| `linked_date` |  | 연동 날짜 |

## Operations

### `GET /api/v2/admin/customers/{member_id}/social` — Retrieve a customer's social account

- **Scope**: `mall.read_customer` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-customer-s-social-account

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 |
| `member_id` | ✓ |  |  | 회원아이디 |

#### 응답 (Response)

> Cafe24 공식 docs 의 대표 응답 샘플. 실제 필드 정의는 위 [응답 속성](#응답-속성-property-list) 참조.

```json
{
    "social": {
        "shop_no": 1,
        "member_id": "sampleid",
        "social_name": "line",
        "social_member_code": "U1e0014229a08c2f95e12ee29904da597",
        "linked_date": "2019-02-18T13:03:11+09:00"
    }
}
```
