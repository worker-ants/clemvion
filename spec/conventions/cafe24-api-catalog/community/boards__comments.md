---
resource: community
entity: boards__comments
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#boards--comments
source: Cafe24 REST API Documentation (admin) — downloaded 2026-06-03
---

# Cafe24 API — Community / Boards comments

> Field-level 카탈로그. Endpoint enumeration index: [`../community.md`](../community.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Boards comments](https://developers.cafe24.com/docs/ko/api/admin/#boards--comments)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

대량으로 게시판 댓글을 관리하기 위한 기능을 제공합니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `shop_no` |  | 멀티쇼핑몰 번호 |
| `board_no` |  | 게시판 번호 |
| `article_no` |  | 게시물 번호 |
| `comment_no` |  | 댓글 번호 |
| `content` |  | 댓글 내용 |
| `writer` | 최대글자수 : [100자] | 작성자명 |
| `member_id` | 최대글자수 : [20자] | 회원아이디 |
| `created_date` | 날짜 | 생성일 |
| `client_ip` | IP | 작성자 IP |
| `rating` | 최소: [1]~최대: [5] | 댓글 평점 |
| `secret` |  | 비밀글 여부 T : 사용함 · F : 사용안함 |
| `parent_comment_no` |  | 부모 댓글 번호 |
| `input_channel` |  | 쇼핑몰 구분 P : PC · M : 모바일 |
| `attach_file_urls` |  | 첨부 파일 상세 |
| `links` |  | link |

## Operations

### `GET /api/v2/admin/boards/{board_no}/comments` — Retrieve comments in bulk

- **Scope**: `mall.read_community` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-comments-in-bulk

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |
| `board_no` | ✓ |  |  | 게시판 번호 |
| `since_comment_no` |  | 최소값: [1]; 최대값: [2147483647] |  | 해당 댓글번호 이후 검색 |
| `limit` |  | 최소: [1]~최대: [100] | 10 | 조회결과 최대건수 |
