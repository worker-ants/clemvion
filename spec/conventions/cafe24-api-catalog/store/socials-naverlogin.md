---
resource: store
entity: socials-naverlogin
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#socials-naverlogin
source: Cafe24 REST API Documentation (admin) — downloaded 2026-06-03
---

# Cafe24 API — Store / Socials naverlogin

> Field-level 카탈로그. Endpoint enumeration index: [`../store.md`](../store.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Socials naverlogin](https://developers.cafe24.com/docs/ko/api/admin/#socials-naverlogin)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

네이버 로그인 설정정보를 조회하고 설정정보를 변경하는 리소스입니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `shop_no` |  | 멀티쇼핑몰 번호 |
| `use_naverlogin` |  | 네이버 로그인 사용여부 |
| `client_id` |  | 클라이언트 아이디 |
| `client_secret` |  | 클라이언트 시크릿 키 |

## Operations

### `GET /api/v2/admin/socials/naverlogin` — Naver login details

- **Scope**: `mall.read_store` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#naver-login-details

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |

### `PUT /api/v2/admin/socials/naverlogin` — Update Naver login settings

- **Scope**: `mall.write_store` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 1
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#update-naver-login-settings

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |
| `use_naverlogin` | ✓ |  |  | 네이버 로그인 사용여부 T:사용함 · F:사용안함 |
| `client_id` |  | 형식 : [a-zA-Z0-9_-]; 최대글자수 : [255자] |  | 클라이언트 아이디 |
| `client_secret` |  | 형식 : [a-zA-Z0-9_-]; 최대글자수 : [255자] |  | 클라이언트 시크릿 키 |
