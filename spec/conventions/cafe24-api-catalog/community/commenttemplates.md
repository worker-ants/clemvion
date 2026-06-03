---
resource: community
entity: commenttemplates
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#commenttemplates
source: Cafe24 REST API Documentation (admin) — downloaded 2026-06-03
---

# Cafe24 API — Community / Commenttemplates

> Field-level 카탈로그. Endpoint enumeration index: [`../community.md`](../community.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Commenttemplates](https://developers.cafe24.com/docs/ko/api/admin/#commenttemplates)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

게시판 내에서 자주 사용하는 답변을 관리할 수 있는 기능입니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `shop_no` |  | 멀티쇼핑몰 번호 |
| `comment_no` |  | 자주 쓰는 답변 번호 |
| `title` | 최대글자수 : [256자] | 자주 쓰는 답변 제목 |
| `content` | 최대글자수 : [4000자] | 자주 쓰는 답변 내용 |
| `board_type` | 최소값: [1] | 게시판 분류 1 : 운영 · 2 : 일반 · 3 : 자료실 · 4 : 기타 · 5 : 상품 · 6 : 갤러리 · 7 : 1:1상담 · 11 : 한줄메모 |
| `created_date` | 날짜 | 생성일 |

## Operations

### `GET /api/v2/admin/commenttemplates` — Retrieve frequently used answers

- **Scope**: `mall.read_community` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-frequently-used-answers

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |
| `board_type` |  |  |  | 게시판 분류 1 : 운영 · 2 : 일반 · 3 : 자료실 · 4 : 기타 · 5 : 상품 · 6 : 갤러리 · 7 : 1:1상담 · 11 : 한줄메모 |
| `title` |  | 최대글자수 : [100자] |  | 자주 쓰는 답변 제목 |
| `since_comment_no` |  | 최소값: [1]; 최대값: [2147483647] |  | 자주 쓰는 답변 번호 |
| `limit` |  | 최소: [1]~최대: [100] | 10 | 조회결과 최대건수 |

### `GET /api/v2/admin/commenttemplates/{comment_no}` — Retrieve a frequently used answer

- **Scope**: `mall.read_community` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-frequently-used-answer

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |
| `comment_no` | ✓ | 최소값: [1] |  | 해당 댓글번호 이후 검색 |

### `POST /api/v2/admin/commenttemplates` — Create a frequently used answer

- **Scope**: `mall.write_community` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 1
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#create-a-frequently-used-answer

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |
| `title` | ✓ | 최대글자수 : [256자] |  | 자주 쓰는 답변 제목 |
| `content` | ✓ | 최대글자수 : [4000자] |  | 자주 쓰는 답변 내용 |
| `board_type` | ✓ | 최소값: [1] |  | 게시판 분류 1 : 운영 · 2 : 일반 · 3 : 자료실 · 4 : 기타 · 5 : 상품 · 6 : 갤러리 · 7 : 1:1상담 · 11 : 한줄메모 |

### `PUT /api/v2/admin/commenttemplates/{comment_no}` — Update a frequently used answer

- **Scope**: `mall.write_community` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 1
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#update-a-frequently-used-answer

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |
| `comment_no` | ✓ | 최소값: [1] |  | 자주 쓰는 답변 번호 |
| `title` |  | 최대글자수 : [256자] |  | 자주 쓰는 답변 제목 |
| `content` |  | 최대글자수 : [4000자] |  | 자주 쓰는 답변 내용 |
| `board_type` |  | 최소값: [1] |  | 게시판 분류 1 : 운영 · 2 : 일반 · 3 : 자료실 · 4 : 기타 · 5 : 상품 · 6 : 갤러리 · 7 : 1:1상담 · 11 : 한줄메모 |

### `DELETE /api/v2/admin/commenttemplates/{comment_no}` — Delete a frequently used answer

- **Scope**: `mall.write_community` (write)
- **호출건수 제한**: 40
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#delete-a-frequently-used-answer

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |
| `comment_no` | ✓ | 최소값: [1] |  | 자주 쓰는 답변 번호 |
