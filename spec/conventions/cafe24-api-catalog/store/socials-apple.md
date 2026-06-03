---
resource: store
entity: socials-apple
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#socials-apple
source: Cafe24 REST API Documentation (admin) — downloaded 2026-06-03
---

# Cafe24 API — Store / Socials apple

> Field-level 카탈로그. Endpoint enumeration index: [`../store.md`](../store.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Socials apple](https://developers.cafe24.com/docs/ko/api/admin/#socials-apple)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

애플아이디 로그인(Socials apple)은 쇼핑몰 이용 고객의 애플아이디 로그인에 관한 기능입니다. · 애플아이디 로그인 설정을 사용하기 위해서는 먼저 애플의 개발자 계정에서 Sign in with Apple 앱 설정을 완료하여야 합니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `shop_no` |  | 멀티쇼핑몰 번호 |
| `use_apple_login` |  | 애플 로그인 사용 T : 사용함 · F : 사용안함 |
| `client_id` |  | client id |
| `team_id` |  | Team ID |
| `key_id` |  | Key ID |
| `auth_key_file_name` |  | Auth Key 파일명 |
| `use_certification` |  | 애플 로그인 본인인증 T : 사용함 · F : 사용안함 |

## Operations

### `GET /api/v2/admin/socials/apple` — Apple login sync details

- **Scope**: `mall.read_store` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#apple-login-sync-details

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |

### `PUT /api/v2/admin/socials/apple` — Apple login sync settings

- **Scope**: `mall.write_store` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 1
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#apple-login-sync-settings

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |
| `use_apple_login` |  |  |  | 애플 로그인 사용 T : 사용함 · F : 사용안함 |
| `client_id` |  | 최대글자수 : [300자] |  | Client ID 애플 개발자 센터의 Service ID 생성 시 설정한 Identifier |
| `team_id` |  | 최대글자수 : [300자] |  | Team ID 애플 개발자 센터의 App ID Prefix |
| `key_id` |  | 최대글자수 : [300자] |  | Key ID 애플 개발자 센터의 Key ID |
| `auth_key_file_name` |  | 최대글자수 : [30자] |  | Auth Key 파일명 App ID의 Key파일로 .p8파일만 가능 |
| `auth_key_file_contents` |  | 최대글자수 : [300자] |  | Auth Key 파일 내용 .p8파일을 텍스트 파일로 열어 줄바꿈 없이 값을 작성 |
| `use_certification` |  |  |  | 애플 로그인 본인인증 T : 사용함 · F : 사용안함 |
