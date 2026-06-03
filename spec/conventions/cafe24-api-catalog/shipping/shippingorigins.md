---
resource: shipping
entity: shippingorigins
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#shippingorigins
source: Cafe24 REST API Documentation (admin) — downloaded 2026-06-03
---

# Cafe24 API — Shipping / Shippingorigins

> Field-level 카탈로그. Endpoint enumeration index: [`../shipping.md`](../shipping.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Shippingorigins](https://developers.cafe24.com/docs/ko/api/admin/#shippingorigins)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

출고지 관리(Shipping origins)는 출고지에 대한 정보를 관리하는 기능입니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `origin_code` | 형식 : [A-Z0-9]; 글자수 최소: [8자]~최대: [8자] | 출고지 코드 |
| `origin_name` | 최대글자수 : [50자] | 출고지 명 |
| `default` |  | 출고지 기본설정 여부 T : 사용함 · F : 사용안함 |
| `country_code` | 최대글자수 : [2자] | 국가코드 |
| `zipcode` | 최소글자수 : [2자]; 최대글자수 : [14자] | 우편번호 |
| `address1` | 최대글자수 : [255자] | 기본 주소 |
| `address2` | 최대글자수 : [255자] | 상세 주소 |
| `contact` |  | 대표 연락처 |
| `secondary_contact` |  | 보조 연락처 |
| `variants` |  | 출고지 품목 정보 |

## Operations

### `GET /api/v2/admin/shippingorigins` — Retrieve a list of shipping origins

- **Scope**: `mall.read_shipping` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-shipping-origins

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `offset` |  | 최대값: [8000] | 0 | 조회결과 시작위치 |
| `limit` |  | 최소: [1]~최대: [100] | 10 | 조회결과 최대건수 |

### `GET /api/v2/admin/shippingorigins/{origin_code}` — Retrieve a shipping origin

- **Scope**: `mall.read_shipping` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-shipping-origin

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `origin_code` | ✓ | 형식 : [A-Z0-9]; 글자수 최소: [8자]~최대: [8자] |  | 출고지 코드 |

### `POST /api/v2/admin/shippingorigins` — Create a shipping origin

- **Scope**: `mall.write_shipping` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 1
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#create-a-shipping-origin

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `origin_name` | ✓ | 최대글자수 : [50자] |  | 출고지 명 |
| `address1` | ✓ | 최대글자수 : [255자] |  | 기본 주소 |
| `address2` | ✓ | 최대글자수 : [255자] |  | 상세 주소 |
| `country_code` | ✓ | 최대글자수 : [2자] |  | 국가코드 |
| `default` |  |  | F | 출고지 기본설정 여부 T : 사용함 · F : 사용안함 |
| `zipcode` |  | 최소글자수 : [2자]; 최대글자수 : [14자] |  | 우편번호 |
| `contact` |  | 전화번호; 최대글자수 : [20자] |  | 대표 연락처 |
| `secondary_contact` |  | 전화번호; 최대글자수 : [20자] |  | 보조 연락처 |

### `PUT /api/v2/admin/shippingorigins/{origin_code}` — Update a shipping origin

- **Scope**: `mall.write_shipping` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 1
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#update-a-shipping-origin

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `origin_code` | ✓ | 형식 : [A-Z0-9]; 글자수 최소: [8자]~최대: [8자] |  | 출고지 코드 |
| `origin_name` |  | 최대글자수 : [50자] |  | 출고지 명 |
| `country_code` |  | 최대글자수 : [2자] |  | 국가코드 |
| `default` |  |  |  | 출고지 기본설정 여부 T : 사용함 · F : 사용안함 |
| `contact` |  | 전화번호; 최대글자수 : [20자] |  | 대표 연락처 |
| `secondary_contact` |  | 전화번호; 최대글자수 : [20자] |  | 보조 연락처 |
| `zipcode` |  | 최소글자수 : [2자]; 최대글자수 : [14자] |  | 우편번호 |
| `address1` |  | 최대글자수 : [255자] |  | 기본 주소 |
| `address2` |  | 최대글자수 : [255자] |  | 상세 주소 |

### `DELETE /api/v2/admin/shippingorigins/{origin_code}` — Delete a shipping origin

- **Scope**: `mall.write_shipping` (write)
- **호출건수 제한**: 40
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#delete-a-shipping-origin

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `origin_code` | ✓ | 형식 : [A-Z0-9]; 글자수 최소: [8자]~최대: [8자] |  | 출고지 코드 |
