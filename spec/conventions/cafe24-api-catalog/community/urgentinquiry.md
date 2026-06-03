---
resource: community
entity: urgentinquiry
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#urgentinquiry
source: Cafe24 REST API Documentation (admin) — downloaded 2026-06-03
---

# Cafe24 API — Community / Urgentinquiry

> Field-level 카탈로그. Endpoint enumeration index: [`../community.md`](../community.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Urgentinquiry](https://developers.cafe24.com/docs/ko/api/admin/#urgentinquiry)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

긴급문의 게시물에 대해 조회할 수 있습니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `shop_no` |  | 멀티쇼핑몰 번호 |
| `article_no` |  | 게시물 번호 |
| `article_type` |  | 게시물 유형 |
| `title` |  | 제목 |
| `writer` |  | 작성자명 |
| `member_id` |  | 회원아이디 |
| `start_date` | 날짜 | 작성일 시작일자 |
| `reply_status` |  | 답변 처리 상태 F: 미처리 · I: 처리중 · T: 처리완료 |
| `hit` |  | 조회수 |
| `content` |  | 내용 |
| `writer_email` | 이메일 | 작성자 이메일 |
| `phone` | 전화번호 | 전화번호 |
| `search_type` |  | 검색 타입 P:상품 · O:주문 |
| `keyword` |  | 검색어 |
| `attached_file_detail` |  | 첨부 파일 상세 |

## Operations

### `GET /api/v2/admin/urgentinquiry` — Retrieve an urgent inquiry post

- **Scope**: `mall.read_community` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-an-urgent-inquiry-post

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |
| `start_date` |  | 날짜 |  | 작성일 시작일자 |
| `end_date` |  | 날짜 |  | 작성일 종료일자 |
| `offset` |  | 최대값: [8000] | 0 | 조회결과 시작위치 |
| `limit` |  | 최소: [1]~최대: [100] | 10 | 조회결과 최대건수 |
