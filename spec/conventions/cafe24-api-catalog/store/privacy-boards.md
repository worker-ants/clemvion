---
resource: store
entity: privacy-boards
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#privacy-boards
source: Cafe24 REST API Documentation (admin) — downloaded 2026-06-03
---

# Cafe24 API — Store / Privacy boards

> Field-level 카탈로그. Endpoint enumeration index: [`../store.md`](../store.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Privacy boards](https://developers.cafe24.com/docs/ko/api/admin/#privacy-boards)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

이용약관 중 게시판 글 작성시점에 대한 개인정보처리방침을 조회할 수 있습니다

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `shop_no` |  | 멀티쇼핑몰 번호 |
| `no` |  | 동의서 번호 |
| `name` |  | 동의서명 |
| `use` |  | 사용 여부 T: 사용함 · F: 사용안함 |
| `content` |  | 동의서 내용 |

## Operations

### `GET /api/v2/admin/privacy/boards` — Retrieve privacy policy for posting on board

- **Scope**: `mall.read_store` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-privacy-policy-for-posting-on-board

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |

### `PUT /api/v2/admin/privacy/boards` — Update privacy policy for posting on board

- **Scope**: `mall.write_store` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 2
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#update-privacy-policy-for-posting-on-board

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |
| `no` | ✓ | 최소값: [1] |  | 동의서 번호 |
| `use` |  |  |  | 사용 여부 T: 사용함 · F: 사용안함 |
| `save_type` |  |  |  | 저장 방식 S: 표준 약관 적용 · C: 사용자 정의 약관 적용 |
| `content` |  |  |  | 동의서 내용 |
