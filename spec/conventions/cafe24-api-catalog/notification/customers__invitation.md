---
resource: notification
entity: customers__invitation
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#customers--invitation
source: Cafe24 REST API Documentation (admin) — fields from full-page HTML; operation 응답 샘플은 code 엔드포인트 /docs/code/api/admin/shell/<entity>.json
---

# Cafe24 API — Notification / Customers invitation

> Field-level 카탈로그. Endpoint enumeration index: [`../notification.md`](../notification.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Customers invitation](https://developers.cafe24.com/docs/ko/api/admin/#customers--invitation)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

회원 초대(invitation)는 계정을 활성화하기 위해 SMS, 이메일 등으로 초대 메시지를 발송하는 기능입니다. · 기존에 가입되어 있는 아이디가 있어야만 초대가 가능합니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `shop_no` | 최소값: [1] | 멀티쇼핑몰 번호 |
| `member_id` | 최대글자수 : [16자] | 회원아이디 |

## Operations

### `POST /api/v2/admin/customers/{member_id}/invitation` — Send an invitation to activate account

- **Scope**: `mall.write_notification` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 1
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#send-an-invitation-to-activate-account

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |
| `member_id` | ✓ | 최대글자수 : [16자] |  | 회원아이디 |
| `invitation_type` | ✓ |  |  | 계정 활성화 초대 수단 |

#### 응답 (Response)

> Cafe24 공식 docs 의 대표 응답 샘플. 실제 필드 정의는 위 [응답 속성](#응답-속성-property-list) 참조.

```json
{
    "invitation": {
        "shop_no": 1,
        "member_id": "sampleid"
    }
}
```
