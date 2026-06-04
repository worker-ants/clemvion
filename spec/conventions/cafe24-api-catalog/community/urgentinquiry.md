---
resource: community
entity: urgentinquiry
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#urgentinquiry
source: Cafe24 REST API Documentation (admin) — fields from full-page HTML; operation 응답 샘플은 code 엔드포인트 /docs/code/api/admin/shell/<entity>.json
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

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `urgentinquiry` |  | (목록) |
| ↳ `shop_no` |  | 멀티쇼핑몰 번호 |
| ↳ `article_no` |  | 게시물 번호 |
| ↳ `article_type` |  | 게시물 유형 |
| ↳ `title` |  | 제목 |
| ↳ `writer` |  | 작성자명 |
| ↳ `member_id` |  | 회원아이디 |
| ↳ `start_date` | 날짜 | 작성일 시작일자 |
| ↳ `reply_status` |  | 답변 처리 상태 F: 미처리 · I: 처리중 · T: 처리완료 |
| ↳ `hit` |  | 조회수 |
| ↳ `content` |  | 내용 |
| ↳ `writer_email` | 이메일 | 작성자 이메일 |
| ↳ `phone` | 전화번호 | 전화번호 |
| ↳ `search_type` |  | 검색 타입 P:상품 · O:주문 |
| ↳ `keyword` |  | 검색어 |
| ↳ `attached_file_detail` |  | 첨부 파일 상세 |
| ↳ ↳ `no` |  |  |
| ↳ ↳ `source` |  | 소스 코드 |
| ↳ ↳ `name` |  |  |
| `links` |  | link |
| ↳ `rel` |  |  |
| ↳ `href` |  |  |

응답 예시 (JSON):

```json
{
    "urgentinquiry": [
        {
            "shop_no": 1,
            "article_no": 2,
            "article_type": "type text",
            "title": "subject text",
            "writer": "John Doe",
            "member_id": "sampleid",
            "start_date": "2022-04-06T10:32:34+09:00",
            "reply_status": "T",
            "hit": 8,
            "content": "content text",
            "writer_email": "sample@sample.com",
            "phone": "010-1111-2222",
            "search_type": "P",
            "keyword": "P000000J",
            "attached_file_detail": [
                {
                    "no": 1,
                    "source": "dev_starter_p1.png",
                    "name": "/2022/04/06/696717133bf7971d5125f2a05ce16d49.png"
                },
                {
                    "no": 2,
                    "source": "dev_basic_p2.png",
                    "name": "/2022/04/06/d0d3944674d139312bdf79853201b4c6.png"
                }
            ]
        },
        {
            "shop_no": 1,
            "article_no": 3,
            "article_type": "type text",
            "title": "subject text",
            "writer": "John Doe",
            "member_id": "sampleid",
            "start_date": "2022-04-06T10:32:34+09:00",
            "reply_status": "T",
            "hit": 8,
            "content": "content text",
            "writer_email": "sample@sample.com",
            "phone": "010-1111-2222",
            "search_type": "P",
            "keyword": "P000000J",
            "attached_file_detail": [
                {
                    "no": 1,
                    "source": "dev_starter_p1.png",
                    "name": "/2022/04/06/696717133bf7971d5125f2a05ce16d49.png"
                },
                {
                    "no": 2,
                    "source": "dev_basic_p2.png",
                    "name": "/2022/04/06/d0d3944674d139312bdf79853201b4c6.png"
                }
            ]
        }
    ],
    "links": [
        {
            "rel": "prev",
            "href": "https://{mallid}.cafe24api.com/api/v2/admin/urgentinquiry?limit=10&offset=0"
        },
        {
            "rel": "next",
            "href": "https://{mallid}.cafe24api.com/api/v2/admin/urgentinquiry?limit=10&offset=20"
        }
    ]
}
```
