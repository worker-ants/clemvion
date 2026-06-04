---
resource: customer
entity: customers__plusapp
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#customers--plusapp
source: Cafe24 REST API Documentation (admin) — fields from full-page HTML; operation 응답 샘플은 code 엔드포인트 /docs/code/api/admin/shell/<entity>.json
---

# Cafe24 API — Customer / Customers plusapp

> Field-level 카탈로그. Endpoint enumeration index: [`../customer.md`](../customer.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Customers plusapp](https://developers.cafe24.com/docs/ko/api/admin/#customers--plusapp)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

쇼핑몰 회원의 플러스앱 설치 정보를 조회할 수 있습니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `shop_no` | 최소값: [1] | 멀티쇼핑몰 번호 |
| `os_type` |  | OS 타입 |
| `install_date` |  | 설치일 |
| `auto_login_flag` |  | 자동로그인 설정 여부 |
| `use_push_flag` |  | 알림 수신 여부 |

## Operations

### `GET /api/v2/admin/customers/{member_id}/plusapp` — Retrieve app installation information

- **Scope**: `mall.read_customer` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-app-installation-information

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |
| `member_id` | ✓ |  |  | 회원아이디 |

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `plusapp` |  | (목록) |
| ↳ `shop_no` | 최소값: [1] | 멀티쇼핑몰 번호 |
| ↳ `os_type` |  | OS 타입 |
| ↳ `install_date` |  | 설치일 |
| ↳ `auto_login_flag` |  | 자동로그인 설정 여부 |
| ↳ `use_push_flag` |  | 알림 수신 여부 |

응답 예시 (JSON):

```json
{
    "plusapp": [
        {
            "shop_no": 1,
            "os_type": "ios",
            "install_date": "2018-01-18T11:19:27+09:00",
            "auto_login_flag": "T",
            "use_push_flag": "T"
        },
        {
            "shop_no": 1,
            "os_type": "android",
            "install_date": "2018-01-18T11:19:27+09:00",
            "auto_login_flag": "F",
            "use_push_flag": "F"
        }
    ]
}
```
