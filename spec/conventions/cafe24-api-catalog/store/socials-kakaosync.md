---
resource: store
entity: socials-kakaosync
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#socials-kakaosync
source: Cafe24 REST API Documentation (admin) — downloaded 2026-06-03
---

# Cafe24 API — Store / Socials kakaosync

> Field-level 카탈로그. Endpoint enumeration index: [`../store.md`](../store.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Socials kakaosync](https://developers.cafe24.com/docs/ko/api/admin/#socials-kakaosync)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

카카오싱크 SNS(Socials kakaosync)는 쇼핑몰의 카카오싱크에 대한 설정을 조회하거나 설정할 수 있는 기능입니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `shop_no` |  | 멀티쇼핑몰 번호 |
| `use_kakaosync` |  | 카카오싱크 사용여부 T : 사용함 · F : 사용안함 |
| `rest_api_key` |  | REST API 키 |
| `javascript_key` |  | JavaScript 키 |
| `auto_login` |  | 자동 로그인 사용 카카오 웹브라우저로 쇼핑몰 이용시 카카오 아이디로 로그인 기능 사용 여부 T : 사용함 · F : 사용안함 |
| `thirdparty_agree` |  | 제3자 제공 동의 여부 T : 동의함 · F : 동의안함 |
| `thirdparty_agree_date` |  | 제3자 제공 동의 날짜 |
| `use_signup_result_page` |  | 쇼핑몰 가입 후 이동 페이지 T : 가입 완료 페이지로 이동 · F : 가입 완료 페이지 없이 즉시 가입 |

## Operations

### `GET /api/v2/admin/socials/kakaosync` — Kakao Sync details

- **Scope**: `mall.read_store` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#kakao-sync-details

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |

### `PUT /api/v2/admin/socials/kakaosync` — Kakao Sync updates

- **Scope**: `mall.write_store` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 1
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#kakao-sync-updates

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |
| `rest_api_key` | ✓ | 형식 : [a-zA-Z0-9]; 최대글자수 : [255자] |  | REST API 키 |
| `javascript_key` | ✓ | 형식 : [a-zA-Z0-9]; 최대글자수 : [255자] |  | JavaScript 키 |
| `auto_login` |  |  | F | 자동 로그인 사용 카카오 웹브라우저로 쇼핑몰 이용시 카카오 아이디로 로그인 기능 사용 여부 T : 사용함 · F : 사용안함 |
| `use_signup_result_page` |  |  | F | 쇼핑몰 가입 후 이동 페이지 T : 가입 완료 페이지로 이동 · F : 가입 완료 페이지 없이 즉시 가입 |
