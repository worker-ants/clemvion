---
resource: customer
entity: customers__autoupdate
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#customers--autoupdate
source: Cafe24 REST API Documentation (admin) — fields from full-page HTML; operation 응답 샘플은 code 엔드포인트 /docs/code/api/admin/shell/<entity>.json
---

# Cafe24 API — Customer / Customers autoupdate

> Field-level 카탈로그. Endpoint enumeration index: [`../customer.md`](../customer.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Customers autoupdate](https://developers.cafe24.com/docs/ko/api/admin/#customers--autoupdate)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

회원 별 회원등급 자동변경 정보(다음 예상 등급 등)를 API로 조회할 수 있습니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `shop_no` |  | 멀티쇼핑몰 번호 |
| `member_id` |  | 회원아이디 |
| `next_grade` |  | 다음 예상 등급 |
| `total_purchase_amount` |  | 등급 산정 기간 내 누적 사용 금액 |
| `total_purchase_count` |  | 등급 산정 기간 내 누적 사용 건수 |
| `required_purchase_amount` |  | 다음 등급까지 필요 금액 |
| `required_purchase_count` |  | 다음 등급까지 필요 건수 |

## Operations

### `GET /api/v2/admin/customers/{member_id}/autoupdate` — Retrieve customer tier auto-update details

- **Scope**: `mall.read_customer` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-customer-tier-auto-update-details

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |
| `member_id` | ✓ | 최대글자수 : [20자] |  | 회원아이디 |

#### 응답 (Response)

> Cafe24 공식 docs 의 대표 응답 샘플. 실제 필드 정의는 위 [응답 속성](#응답-속성-property-list) 참조.

```json
{
    "autoupdate": {
        "shop_no": 1,
        "member_id": "sampleid",
        "next_grade": "VIP",
        "total_purchase_amount": 20000,
        "total_purchase_count": 2,
        "required_purchase_amount": 50000,
        "required_purchase_count": 5
    }
}
```
