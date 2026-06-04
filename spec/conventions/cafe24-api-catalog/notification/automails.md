---
resource: notification
entity: automails
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#automails
source: Cafe24 REST API Documentation (admin) — fields from full-page HTML; operation 응답 샘플은 code 엔드포인트 /docs/code/api/admin/shell/<entity>.json
---

# Cafe24 API — Notification / Automails

> Field-level 카탈로그. Endpoint enumeration index: [`../notification.md`](../notification.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Automails](https://developers.cafe24.com/docs/ko/api/admin/#automails)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

자동 알림 메일 관리'에서 메일 항목별 고객, 운영자, 공급사 설정 값을 관리할 수 있습니다. SNS, SMS 전송이 불가한 해외 고객을 관리할 수 있음.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `shop_no` |  | 멀티쇼핑몰 번호 |
| `type` |  | 메일 항목 automails_typecode |
| `use_customer` |  | 고객 |
| `use_admin` |  | 운영자 |
| `use_supplier` |  | 공급사 |

## Operations

### `GET /api/v2/admin/automails` — Retrieve automated email settings

- **Scope**: `mall.read_notification` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-automated-email-settings

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `automails` |  | (목록) |
| ↳ `shop_no` |  | 멀티쇼핑몰 번호 |
| ↳ `type` |  | 메일 항목 automails_typecode |
| ↳ `use_customer` |  | 고객 |
| ↳ `use_admin` |  | 운영자 |
| ↳ `use_supplier` |  | 공급사 |

응답 예시 (JSON):

```json
{
    "automails": [
        {
            "shop_no": 1,
            "type": "G",
            "use_customer": "T",
            "use_admin": "T",
            "use_supplier": "T"
        },
        {
            "shop_no": 1,
            "type": "H",
            "use_customer": "T",
            "use_admin": "T",
            "use_supplier": "T"
        }
    ]
}
```

### `PUT /api/v2/admin/automails` — Update automated email settings

- **Scope**: `mall.write_notification` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 100
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#update-automated-email-settings

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |
| `type` | ✓ |  |  | 메일 항목 automails_typecode |
| `use_customer` |  |  |  | 고객 T : 사용함 · F : 사용안함 |
| `use_admin` |  |  |  | 운영자 T : 사용함 · F : 사용안함 |
| `use_supplier` |  |  |  | 공급사 T : 사용함 · F : 사용안함 |

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `automails` |  | (목록) |
| ↳ `shop_no` |  | 멀티쇼핑몰 번호 |
| ↳ `type` |  | 메일 항목 automails_typecode |
| ↳ `use_customer` |  | 고객 |
| ↳ `use_admin` |  | 운영자 |
| ↳ `use_supplier` |  | 공급사 |

응답 예시 (JSON):

```json
{
    "automails": [
        {
            "shop_no": 1,
            "type": "G",
            "use_customer": "T",
            "use_admin": "F",
            "use_supplier": "T"
        },
        {
            "shop_no": 1,
            "type": "H",
            "use_customer": "T",
            "use_admin": "F",
            "use_supplier": "T"
        }
    ]
}
```
