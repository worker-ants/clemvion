---
resource: promotion
entity: serialcoupons__issues
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#serialcoupons--issues
source: Cafe24 REST API Documentation (admin) — fields from full-page HTML; operation 응답 샘플은 code 엔드포인트 /docs/code/api/admin/shell/<entity>.json
---

# Cafe24 API — Promotion / Serialcoupons issues

> Field-level 카탈로그. Endpoint enumeration index: [`../promotion.md`](../promotion.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Serialcoupons issues](https://developers.cafe24.com/docs/ko/api/admin/#serialcoupons--issues)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

시리얼코드로 발급한 쿠폰을 관리하는 기능을 제공합니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `shop_no` |  | 멀티쇼핑몰 번호 DEFAULT 1 |
| `coupon_no` |  | 쿠폰번호 |
| `serial_code` |  | 시리얼코드 |
| `member_id` |  | 회원아이디 |
| `verify` |  | 인증여부 Y:인증 · N:미인증 |
| `verify_datetime` |  | 인증일시 |
| `used_datetime` |  | 사용일시 |
| `deleted` |  | 쿠폰삭제 여부 T : 삭제 · F : 삭제되지 않음 |

## Operations

### `GET /api/v2/admin/serialcoupons/{coupon_no}/issues` — Retrieve a code of coupon codes

- **Scope**: `mall.read_promotion` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-code-of-coupon-codes

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 |
| `coupon_no` |  |  |  | 쿠폰번호 |
| `offset` |  | 최대값: [10000] | 0 | 조회결과 시작위치 |
| `limit` |  | 최소: [1]~최대: [500] | 100 | 조회결과 최대건수 |

#### 응답 (Response)

> Cafe24 공식 docs 의 대표 응답 샘플. 실제 필드 정의는 위 [응답 속성](#응답-속성-property-list) 참조.

```json
{
    "serialcoupons": [
        {
            "shop_no": 1,
            "coupon_no": "9000000000000000032",
            "serial_code": "A1234567890Z",
            "member_id": "sampleid",
            "verify": "Y",
            "verify_datetime": "2024-08-28T00:00:00+09:00",
            "used_datetime": "2024-08-28T00:00:00+09:00",
            "deleted": "F"
        },
        {
            "shop_no": 1,
            "coupon_no": "9000000000000000032",
            "serial_code": "A1234567890Z",
            "member_id": "",
            "verify": "N",
            "verify_datetime": "",
            "used_datetime": "",
            "deleted": "T"
        }
    ]
}
```

### `POST /api/v2/admin/serialcoupons/{coupon_no}/issues` — Register a code of coupon codes

- **Scope**: `mall.write_promotion` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 1
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#register-a-code-of-coupon-codes

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 |
| `coupon_no` |  |  |  | 쿠폰번호 |
| `serial_code_list` | ✓ | 배열 최대사이즈: [10000] |  | 시리얼넘버 목록 |

#### 응답 (Response)

> Cafe24 공식 docs 의 대표 응답 샘플. 실제 필드 정의는 위 [응답 속성](#응답-속성-property-list) 참조.

```json
{
    "serialcoupons": [
        {
            "shop_no": 1,
            "coupon_no": "9000000000000000032",
            "serial_code": "A1234567890Z"
        },
        {
            "shop_no": 1,
            "coupon_no": "9000000000000000032",
            "serial_code": "A1234567891Z"
        }
    ]
}
```
