---
resource: community
entity: boards__comments
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#boards--comments
source: Cafe24 REST API Documentation (admin) — fields from full-page HTML; operation 응답 샘플은 code 엔드포인트 /docs/code/api/admin/shell/<entity>.json
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

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `comments` |  | (목록) |
| ↳ `shop_no` |  | 멀티쇼핑몰 번호 |
| ↳ `board_no` |  | 게시판 번호 |
| ↳ `article_no` |  | 게시물 번호 |
| ↳ `comment_no` |  | 댓글 번호 |
| ↳ `content` |  | 댓글 내용 |
| ↳ `writer` | 최대글자수 : [100자] | 작성자명 |
| ↳ `member_id` | 최대글자수 : [20자] | 회원아이디 |
| ↳ `created_date` | 날짜 | 생성일 |
| ↳ `client_ip` | IP | 작성자 IP |
| ↳ `rating` | 최소: [1]~최대: [5] | 댓글 평점 |
| ↳ `secret` |  | 비밀글 여부 T : 사용함 · F : 사용안함 |
| ↳ `parent_comment_no` |  | 부모 댓글 번호 |
| ↳ `input_channel` |  | 쇼핑몰 구분 P : PC · M : 모바일 |
| ↳ `attach_file_urls` |  | 첨부 파일 상세 |
| ↳ ↳ `no` |  |  |
| ↳ ↳ `name` |  |  |
| ↳ ↳ `url` |  | 파일 URL |
| ↳ `links` |  | link |
| ↳ ↳ `rel` |  |  |
| ↳ ↳ `href` |  |  |

응답 예시 (JSON):

```json
{
    "comments": [
        {
            "shop_no": 1,
            "board_no": 1,
            "article_no": 2,
            "comment_no": 2,
            "content": "comment text",
            "writer": "Sample",
            "member_id": "sampleid",
            "created_date": "2019-04-02T13:43:21+09:00",
            "client_ip": "127.0.0.1",
            "rating": 0,
            "secret": "F",
            "parent_comment_no": null,
            "input_channel": "P",
            "attach_file_urls": [
                {
                    "no": 1,
                    "name": "dev_starter_p1.png",
                    "url": "https://{domain}/file_data/{mall_id}/2023/01/23/4f43130f0698818abc2d4b03ca7635ad.png"
                },
                {
                    "no": 2,
                    "name": "dev_basic_p1.png",
                    "url": "https://{domain}/file_data/{mall_id}/2023/01/23/ea8203b11b4148f4cbf723e4e01c866f.png"
                }
            ],
            "links": [
                {
                    "rel": "next",
                    "href": "https://{mallid}.cafe24api.com/api/v2/admin/boards/5/comments?since_comment_no=2&limit=10"
                }
            ]
        },
        {
            "shop_no": 1,
            "board_no": 1,
            "article_no": 2,
            "comment_no": 1,
            "content": "comment text2",
            "writer": "Sample3",
            "member_id": "sampleid3",
            "created_date": "2019-04-01T16:24:21+09:00",
            "client_ip": "127.0.0.3",
            "rating": 0,
            "secret": "F",
            "parent_comment_no": null,
            "input_channel": "P",
            "attach_file_urls": [
                {
                    "no": 1,
                    "name": "dev_starter_p3.png",
                    "url": "https://{domain}/file_data/{mall_id}/2023/01/23/dfa1631de377efb25d76757700719233.png"
                },
                {
                    "no": 2,
                    "name": "dev_basic_p3.png",
                    "url": "https://{domain}/file_data/{mall_id}/2023/01/23/e8786abe5442ddf5b725995c9e785036.png"
                }
            ],
            "links": [
                {
                    "rel": "next",
                    "href": "https://{mallid}.cafe24api.com/api/v2/admin/boards/5/comments?since_comment_no=1&limit=10"
                }
            ]
        }
    ]
}
```
