---
resource: community
entity: boards__articles
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#boards--articles
source: Cafe24 REST API Documentation (admin) — fields from full-page HTML; operation 응답 샘플은 code 엔드포인트 /docs/code/api/admin/shell/<entity>.json
---

# Cafe24 API — Community / Boards articles

> Field-level 카탈로그. Endpoint enumeration index: [`../community.md`](../community.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Boards articles](https://developers.cafe24.com/docs/ko/api/admin/#boards--articles)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

게시물(Boards articles)은 게시판에 게시되는 게시물을 관리하기 위한 리소스입니다. · 특정 게시판의 게시물을 조회하거나 게시물을 생성하거나 수정, 삭제할 수 있습니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `shop_no` |  | 멀티쇼핑몰 번호 |
| `article_no` | 최대값: [2147483647] | 게시물 번호 |
| `parent_article_no` |  | 부모 게시물 번호 |
| `board_no` |  | 게시판 번호 |
| `product_no` |  | 상품번호 |
| `category_no` |  | 분류 번호 |
| `board_category_no` |  | 게시판 카테고리 번호 |
| `reply_sequence` |  | 답변 게시물 순서 |
| `reply_depth` |  | 답변 차수 |
| `created_date` | 날짜 | 생성일 |
| `writer` |  | 작성자명 |
| `writer_email` | 이메일 | 작성자 이메일 |
| `member_id` |  | 회원아이디 |
| `title` |  | 제목 |
| `content` |  | 내용 |
| `supplier_id` | 형식 : [a-z0-9]; 글자수 최소: [4자]~최대: [16자] | 공급사 아이디 |
| `client_ip` | IP | 작성자 IP |
| `nick_name` |  | 별명 |
| `rating` | 최소: [1]~최대: [5] | 평점 |
| `sales_channel` | 최대글자수 : [20자] | 매체사 |
| `reply_mail` |  | 1:1 게시판 문의내용에 대한 답변 메일 여부 Y : 사용함 · N : 사용안함 |
| `display` |  | 게시 여부 T : 게시함 · F : 게시안함 |
| `secret` |  | 비밀글 여부 T : 사용함 · F : 사용안함 |
| `notice` |  | 공지 여부 T : 사용함 · F : 사용안함 |
| `fixed` |  | 고정글 여부 T : 사용함 · F : 사용안함 |
| `deleted` |  | 삭제 구분 T: 삭제 · F: 비삭제 · B: 등록전 |
| `input_channel` |  | 게시물 작성 경로 P : PC · M : 모바일 |
| `order_id` |  | 주문번호 |
| `attach_file_urls` |  | 첨부 파일 상세 |
| `hit` |  | 조회수 |
| `reply` |  | 1:1 게시판 문의내용에 대한 답변여부 T : 사용함 · F : 사용안함 |
| `reply_user_id` |  | 처리중 또는 답변완료 한 운영자 아이디 |
| `reply_status` |  | 답변 처리 상태 N : 답변전 · P : 처리중 · C : 처리완료 |
| `naverpay_review_id` |  | 네이버페이 리뷰 아이디 |
| `display_time` |  | 노출시간 사용여부 |
| `display_time_start_hour` |  | 노출시간 시작 시각 |
| `display_time_end_hour` |  | 노출시간 종료 시각 |
| `attached_file_detail` |  | 첨부 파일 상세 |
| `attached_file_urls` |  | 첨부 파일 상세 |

## Operations

### `GET /api/v2/admin/boards/{board_no}/articles` — Retrieve a list of posts for a board

- **Scope**: `mall.read_community` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-posts-for-a-board

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |
| `board_no` | ✓ |  |  | 게시판 번호 |
| `article_no` |  | 최소값: [1] |  | 게시물 번호 ,(콤마)로 여러 건을 검색할 수 있다. |
| `board_category_no` |  |  |  | 게시판 카테고리 번호 |
| `start_date` |  | 날짜 |  | 검색 시작일(작성일) 검색을 시작할 기준일 또는 작성일 |
| `end_date` |  | 날짜 |  | 검색 종료일 검색을 종료할 기준일 · 검색 시작일과 같이 사용해야함. 검색기간은 한 호출에 1년 이상 검색 불가. |
| `input_channel` |  |  |  | 쇼핑몰 구분 P : PC · M : 모바일 |
| `search` |  |  |  | 검색 영역 subject : 제목 · content : 내용 · writer_name : 작성자 · product : 상품명 · member_id : 회원 아이디 |
| `keyword` |  |  |  | 검색어 |
| `reply_status` |  |  |  | 답변상태 N : 답변 전 · P : 처리중 · C : 답변 완료 |
| `comment` |  |  |  | 댓글여부 T : 있음 · F : 없음 |
| `attached_file` |  |  |  | 첨부파일 여부 T : 있음 · F : 없음 |
| `article_type` |  |  |  | 게시물 유형 ,(콤마)로 여러 건을 검색할 수 있다. all : 전체 · normal : 일반글 · notice : 공지글 · fixed : 고정글 |
| `product_no` |  |  |  | 상품번호 |
| `has_product` |  |  |  | 상품정보 포함 여부 T : 있음 · F : 없음 |
| `is_notice` |  |  |  | 공지 여부 T : 있음 · F : 없음 |
| `is_display` |  |  |  | 게시 여부 T : 있음 · F : 없음 |
| `supplier_id` |  | 형식 : [a-z0-9]; 글자수 최소: [4자]~최대: [16자] |  | 공급사 아이디 |
| `offset` |  | 최대값: [8000] | 0 | 조회결과 시작위치 |
| `limit` |  | 최소: [1]~최대: [100] | 10 | 조회결과 최대건수 |

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `articles` |  | (목록) |
| ↳ `shop_no` |  | 멀티쇼핑몰 번호 |
| ↳ `article_no` | 최대값: [2147483647] | 게시물 번호 |
| ↳ `parent_article_no` |  | 부모 게시물 번호 |
| ↳ `board_no` |  | 게시판 번호 |
| ↳ `product_no` |  | 상품번호 |
| ↳ `category_no` |  | 분류 번호 |
| ↳ `board_category_no` |  | 게시판 카테고리 번호 |
| ↳ `reply_sequence` |  | 답변 게시물 순서 |
| ↳ `reply_depth` |  | 답변 차수 |
| ↳ `created_date` | 날짜 | 생성일 |
| ↳ `writer` |  | 작성자명 |
| ↳ `writer_email` | 이메일 | 작성자 이메일 |
| ↳ `member_id` |  | 회원아이디 |
| ↳ `title` |  | 제목 |
| ↳ `content` |  | 내용 |
| ↳ `supplier_id` | 형식 : [a-z0-9]; 글자수 최소: [4자]~최대: [16자] | 공급사 아이디 |
| ↳ `client_ip` | IP | 작성자 IP |
| ↳ `nick_name` |  | 별명 |
| ↳ `rating` | 최소: [1]~최대: [5] | 평점 |
| ↳ `reply_mail` |  | 1:1 게시판 문의내용에 대한 답변 메일 여부 Y : 사용함 · N : 사용안함 |
| ↳ `display` |  | 게시 여부 T : 게시함 · F : 게시안함 |
| ↳ `secret` |  | 비밀글 여부 T : 사용함 · F : 사용안함 |
| ↳ `notice` |  | 공지 여부 T : 사용함 · F : 사용안함 |
| ↳ `fixed` |  | 고정글 여부 T : 사용함 · F : 사용안함 |
| ↳ `deleted` |  | 삭제 구분 T: 삭제 · F: 비삭제 · B: 등록전 |
| ↳ `input_channel` |  | 게시물 작성 경로 P : PC · M : 모바일 |
| ↳ `order_id` |  | 주문번호 |
| ↳ `attach_file_urls` |  | 첨부 파일 상세 |
| ↳ ↳ `no` |  |  |
| ↳ ↳ `name` |  |  |
| ↳ ↳ `url` |  |  |
| ↳ `hit` |  | 조회수 |
| ↳ `reply` |  | 1:1 게시판 문의내용에 대한 답변여부 T : 사용함 · F : 사용안함 |
| ↳ `reply_user_id` |  | 처리중 또는 답변완료 한 운영자 아이디 |
| ↳ `reply_status` |  | 답변 처리 상태 N : 답변전 · P : 처리중 · C : 처리완료 |
| ↳ `naverpay_review_id` |  | 네이버페이 리뷰 아이디 |
| ↳ `display_time` |  | 노출시간 사용여부 |
| ↳ `display_time_start_hour` |  | 노출시간 시작 시각 |
| ↳ `display_time_end_hour` |  | 노출시간 종료 시각 |
| `links` |  | (목록) |
| ↳ `rel` |  |  |
| ↳ `href` |  |  |

응답 예시 (JSON):

```json
{
    "articles": [
        {
            "shop_no": 1,
            "article_no": 1,
            "parent_article_no": 1,
            "board_no": 4,
            "product_no": 10,
            "category_no": 1,
            "board_category_no": 1,
            "reply_sequence": 1,
            "reply_depth": 0,
            "created_date": "2019-04-30T16:44:21+09:00",
            "writer": "John Doe",
            "writer_email": "sample@sample.com",
            "member_id": "sampleid",
            "title": "subject text1",
            "content": "contents text1",
            "supplier_id": "sample",
            "client_ip": "127.0.0.1",
            "nick_name": "sample nickname",
            "rating": 5,
            "reply_mail": "N",
            "display": "T",
            "secret": "T",
            "notice": "F",
            "fixed": "F",
            "deleted": "F",
            "input_channel": "P",
            "order_id": "20170710-0000013",
            "attach_file_urls": [
                {
                    "no": 1,
                    "name": "dev_starter_p1.png",
                    "url": "https://{domain}/file_data/{mall_id}/2019/01/02/4f43130f0698818abc2d4b03ca7635ad.png"
                },
                {
                    "no": 2,
                    "name": "dev_basic_p2.png",
                    "url": "https://{domain}/file_data/{mall_id}/2019/01/02/ea8203b11b4148f4cbf723e4e01c866f.png"
                }
            ],
            "hit": 0,
            "reply": "F",
            "reply_user_id": "admin",
            "reply_status": "C",
            "naverpay_review_id": "naverid",
            "display_time": "T",
            "display_time_start_hour": 6,
            "display_time_end_hour": 12
        },
        {
            "shop_no": 1,
            "article_no": 2,
            "parent_article_no": 1,
            "board_no": 4,
            "product_no": 10,
            "category_no": 1,
            "board_category_no": 1,
            "reply_sequence": 1,
            "reply_depth": 1,
            "created_date": "2019-04-30T17:44:21+09:00",
            "writer": "John Doe",
            "writer_email": "sample@sample.com",
            "member_id": "sampleid",
            "title": "subject text2",
            "content": "contents text2",
            "supplier_id": "sample",
            "client_ip": "127.0.0.1",
            "nick_name": "sample nickname",
            "rating": 4,
            "reply_mail": "N",
            "display": "T",
            "secret": "T",
            "notice": "F",
            "fixed": "F",
            "deleted": "F",
            "input_channel": "P",
            "order_id": "20170710-0000013",
            "attach_file_urls": [
                {
                    "no": 1,
                    "name": "dev_starter_p1.png",
                    "url": "https://{domain}/file_data/{mall_id}/2019/04/30/dfa1631de377efb25d78687700719233.png"
                },
                {
                    "no": 2,
                    "name": "dev_basic_p2.png",
                    "url": "https://{domain}/file_data/{mall_id}/2019/04/30/e8786abe5442ddf5b725995c9e785036.png"
                }
            ],
            "hit": 0,
            "reply": "F",
            "reply_user_id": "admin",
            "reply_status": "C",
            "naverpay_review_id": "naverid",
            "display_time": "T",
            "display_time_start_hour": 6,
            "display_time_end_hour": 12
        }
    ],
    "links": [
        {
            "rel": "prev",
            "href": "https://{mallid}.cafe24api.com/api/v2/boards/4/articles?limit=10&offset=0"
        },
        {
            "rel": "next",
            "href": "https://{mallid}.cafe24api.com/api/v2/boards/4/articles?limit=10&offset=20"
        }
    ]
}
```

### `POST /api/v2/admin/boards/{board_no}/articles` — Create a board post

- **Scope**: `mall.write_community` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 10
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#create-a-board-post

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 |
| `board_no` | ✓ |  |  | 게시판 번호 |
| `writer` | ✓ | 최대글자수 : [100자] |  | 작성자명 |
| `title` | ✓ | 최대글자수 : [256자] |  | 제목 |
| `content` | ✓ |  |  | 내용 |
| `client_ip` | ✓ | IP |  | 작성자 IP |
| `reply_article_no` |  |  |  | 답변 게시물 번호 게시물에 답변을 추가하고자 할 경우 게시물의 번호를 입력한다. |
| `created_date` |  | 날짜 |  | 생성일 |
| `writer_email` |  | 이메일 |  | 작성자 이메일 |
| `member_id` |  | 최대글자수 : [20자] |  | 회원아이디 member_id가 mall_id인 경우: 작성자는 shop_name이 반환됩니다. · member_id를 입력하지 않거나, 회원 ID인 경우: 작성자는 writer 값이 반환됩니다. |
| `notice` |  |  | F | 공지 여부 T : 사용함 · F : 사용안함 |
| `fixed` |  |  | F | 고정글 여부 T : 사용함 · F : 사용안함 |
| `deleted` |  |  | F | 삭제 구분 T: 삭제 · F: 비삭제 · B: 등록전 |
| `reply` |  |  | F | 1:1 게시판 문의내용에 대한 답변여부 T : 사용함 · F : 사용안함 |
| `rating` |  | 최소: [1]~최대: [5] |  | 평점 |
| `sales_channel` |  | 최대글자수 : [20자] |  | 매체사 |
| `secret` |  |  | F | 비밀글 여부 T : 사용함 · F : 사용안함 |
| `password` |  |  |  | 게시글 비밀번호 |
| `reply_mail` |  |  | N | 1:1 게시판 문의내용에 대한 답변 메일 여부 Y : 사용함 · N : 사용안함 |
| `board_category_no` |  |  |  | 게시판 카테고리 번호 |
| `nick_name` |  | 최대글자수 : [50자] |  | 별명 |
| `input_channel` |  |  | P | 게시물 작성 경로 P : PC · M : 모바일 |
| `reply_user_id` |  | 최대글자수 : [20자] |  | 처리중 또는 답변완료 한 운영자 아이디 |
| `reply_status` |  |  |  | 답변 처리 상태 N : 답변전 · P : 처리중 · C : 처리완료 |
| `product_no` |  | 최대값: [2147483647] |  | 상품번호 |
| `category_no` |  |  |  | 분류 번호 |
| `order_id` |  | 주문번호; 최대글자수 : [32자] |  | 주문번호 |
| `naverpay_review_id` |  | 최대글자수 : [20자] |  | 네이버페이 리뷰 아이디 |
| `attach_file_urls` |  |  |  | 첨부 파일 상세 |
| ↳ `name` |  |  |  | 파일명 |
| ↳ `url` |  |  |  | 파일 URL |

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `articles` |  | (목록) |
| ↳ `shop_no` |  | 멀티쇼핑몰 번호 |
| ↳ `article_no` | 최대값: [2147483647] | 게시물 번호 |
| ↳ `parent_article_no` |  | 부모 게시물 번호 |
| ↳ `board_no` |  | 게시판 번호 |
| ↳ `product_no` |  | 상품번호 |
| ↳ `category_no` |  | 분류 번호 |
| ↳ `board_category_no` |  | 게시판 카테고리 번호 |
| ↳ `reply_sequence` |  | 답변 게시물 순서 |
| ↳ `reply_depth` |  | 답변 차수 |
| ↳ `created_date` | 날짜 | 생성일 |
| ↳ `writer` |  | 작성자명 |
| ↳ `writer_email` | 이메일 | 작성자 이메일 |
| ↳ `member_id` |  | 회원아이디 |
| ↳ `title` |  | 제목 |
| ↳ `content` |  | 내용 |
| ↳ `client_ip` | IP | 작성자 IP |
| ↳ `nick_name` |  | 별명 |
| ↳ `rating` | 최소: [1]~최대: [5] | 평점 |
| ↳ `reply_mail` |  | 1:1 게시판 문의내용에 대한 답변 메일 여부 Y : 사용함 · N : 사용안함 |
| ↳ `display` |  | 게시 여부 T : 게시함 · F : 게시안함 |
| ↳ `secret` |  | 비밀글 여부 T : 사용함 · F : 사용안함 |
| ↳ `notice` |  | 공지 여부 T : 사용함 · F : 사용안함 |
| ↳ `fixed` |  | 고정글 여부 T : 사용함 · F : 사용안함 |
| ↳ `deleted` |  | 삭제 구분 T: 삭제 · F: 비삭제 · B: 등록전 |
| ↳ `input_channel` |  | 게시물 작성 경로 P : PC · M : 모바일 |
| ↳ `order_id` |  | 주문번호 |
| ↳ `attached_file_detail` |  | 첨부 파일 상세 |
| ↳ ↳ `no` |  |  |
| ↳ ↳ `path` |  |  |
| ↳ ↳ `name` |  |  |
| ↳ ↳ `size` |  |  |
| ↳ ↳ `source` |  |  |
| ↳ ↳ `type` |  |  |
| ↳ ↳ `ext` |  |  |
| ↳ ↳ `width` |  |  |
| ↳ ↳ `height` |  |  |
| ↳ ↳ `thumb` |  |  |
| ↳ `hit` |  | 조회수 |
| ↳ `reply` |  | 1:1 게시판 문의내용에 대한 답변여부 T : 사용함 · F : 사용안함 |
| ↳ `reply_user_id` |  | 처리중 또는 답변완료 한 운영자 아이디 |
| ↳ `reply_status` |  | 답변 처리 상태 N : 답변전 · P : 처리중 · C : 처리완료 |
| ↳ `naverpay_review_id` |  | 네이버페이 리뷰 아이디 |

응답 예시 (JSON):

```json
{
    "articles": [
        {
            "shop_no": 1,
            "article_no": 50,
            "parent_article_no": 40,
            "board_no": 5,
            "product_no": 10,
            "category_no": 1,
            "board_category_no": 1,
            "reply_sequence": 1,
            "reply_depth": 1,
            "created_date": "2018-11-30T12:43:00+09:00",
            "writer": "John Doe",
            "writer_email": "sample@sample.com",
            "member_id": "sampleid",
            "title": "subject text1",
            "content": "contents text1",
            "client_ip": "127.0.0.1",
            "nick_name": "sample nickname",
            "rating": 0,
            "reply_mail": "N",
            "display": "T",
            "secret": "T",
            "notice": "F",
            "fixed": "F",
            "deleted": "F",
            "input_channel": "P",
            "order_id": "20170710-0000013",
            "attached_file_detail": [
                {
                    "no": 1,
                    "path": "/2019/01/02/4f43130f0698818abc2d4b03ca7635ad.png",
                    "name": "/2019/01/02/4f43130f0698818abc2d4b03ca7635ad.png",
                    "size": 87956,
                    "source": "dev_starter_p1.png",
                    "type": "image/png",
                    "ext": "png",
                    "width": 850,
                    "height": 728,
                    "thumb": "/gallery//2019/01/02/4f43130f0698818abc2d4b03ca7635ad.png"
                },
                {
                    "no": 2,
                    "path": "/2019/01/02/ea8203b11b4148f4cbf723e4e01c866f.png",
                    "name": "/2019/01/02/ea8203b11b4148f4cbf723e4e01c866f.png",
                    "size": 23072,
                    "source": "dev_basic_p2.png",
                    "type": "image/png",
                    "ext": "png",
                    "width": 821,
                    "height": 292,
                    "thumb": "/gallery//2019/01/02/ea8203b11b4148f4cbf723e4e01c866f.png"
                }
            ],
            "hit": 0,
            "reply": "F",
            "reply_user_id": "admin",
            "reply_status": "C",
            "naverpay_review_id": "naverid"
        },
        {
            "shop_no": 1,
            "article_no": 51,
            "parent_article_no": 40,
            "board_no": 5,
            "product_no": 10,
            "category_no": 1,
            "board_category_no": 1,
            "reply_sequence": 1,
            "reply_depth": 1,
            "created_date": "2018-11-30T12:43:00+09:00",
            "writer": "John Doe",
            "writer_email": "sample@sample.com",
            "member_id": "sampleid",
            "title": "subject text2",
            "content": "contents text2",
            "client_ip": "127.0.0.1",
            "nick_name": "sample nickname",
            "rating": 0,
            "reply_mail": "N",
            "display": "T",
            "secret": "F",
            "notice": "F",
            "fixed": "F",
            "deleted": "F",
            "input_channel": "P",
            "order_id": "20170710-0000013",
            "attached_file_detail": [
                {
                    "no": 1,
                    "path": "/2019/01/02/dfa1631de377efb25d78687700719233.png",
                    "name": "/2019/01/02/dfa1631de377efb25d78687700719233.png",
                    "size": 87956,
                    "source": "dev_starter_p1.png",
                    "type": "image/png",
                    "ext": "png",
                    "width": 850,
                    "height": 728,
                    "thumb": "/gallery//2019/01/02/dfa1631de377efb25d78687700719233.png"
                },
                {
                    "no": 2,
                    "path": "/2019/01/02/e8786abe5442ddf5b725995c9e785036.png",
                    "name": "/2019/01/02/e8786abe5442ddf5b725995c9e785036.png",
                    "size": 23072,
                    "source": "dev_basic_p2.png",
                    "type": "image/png",
                    "ext": "png",
                    "width": 821,
                    "height": 292,
                    "thumb": "/gallery//2019/01/02/e8786abe5442ddf5b725995c9e785036.png"
                }
            ],
            "hit": 0,
            "reply": "F",
            "reply_user_id": "admin",
            "reply_status": "C",
            "naverpay_review_id": "naverid"
        }
    ]
}
```

### `PUT /api/v2/admin/boards/{board_no}/articles/{article_no}` — Update a board post

- **Scope**: `mall.write_community` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 1
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#update-a-board-post

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 |
| `board_no` | ✓ |  |  | 게시판 번호 |
| `article_no` | ✓ |  |  | 게시물 번호 |
| `title` |  | 최대글자수 : [256자] |  | 제목 |
| `content` |  |  |  | 내용 |
| `rating` |  | 최소: [1]~최대: [5] |  | 평점 |
| `sales_channel` |  | 최대글자수 : [20자] |  | 매체사 |
| `board_category_no` |  |  |  | 게시판 카테고리 번호 |
| `display` |  |  |  | 게시 여부 T : 게시함 · F : 게시안함 |
| `notice` |  |  |  | 공지 여부 T : 사용함 · F : 사용안함 |
| `fixed` |  |  |  | 고정글 여부 T : 사용함 · F : 사용안함 |
| `display_time_start_hour` |  |  |  | 노출시간 시작 시각 |
| `display_time_end_hour` |  |  |  | 노출시간 종료 시각 |
| `attach_file_url1` |  | URL |  | 파일 URL |
| `attach_file_url2` |  | URL |  | 파일 URL |
| `attach_file_url3` |  | URL |  | 파일 URL |
| `attach_file_url4` |  | URL |  | 파일 URL |
| `attach_file_url5` |  | URL |  | 파일 URL |

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `article` |  | (응답 객체) |
| ↳ `shop_no` |  | 멀티쇼핑몰 번호 |
| ↳ `article_no` | 최대값: [2147483647] | 게시물 번호 |
| ↳ `parent_article_no` |  | 부모 게시물 번호 |
| ↳ `board_no` |  | 게시판 번호 |
| ↳ `product_no` |  | 상품번호 |
| ↳ `category_no` |  | 분류 번호 |
| ↳ `board_category_no` |  | 게시판 카테고리 번호 |
| ↳ `reply_sequence` |  | 답변 게시물 순서 |
| ↳ `reply_depth` |  | 답변 차수 |
| ↳ `created_date` | 날짜 | 생성일 |
| ↳ `writer` |  | 작성자명 |
| ↳ `writer_email` | 이메일 | 작성자 이메일 |
| ↳ `member_id` |  | 회원아이디 |
| ↳ `title` |  | 제목 |
| ↳ `content` |  | 내용 |
| ↳ `client_ip` | IP | 작성자 IP |
| ↳ `nick_name` |  | 별명 |
| ↳ `rating` | 최소: [1]~최대: [5] | 평점 |
| ↳ `reply_mail` |  | 1:1 게시판 문의내용에 대한 답변 메일 여부 Y : 사용함 · N : 사용안함 |
| ↳ `display` |  | 게시 여부 T : 게시함 · F : 게시안함 |
| ↳ `secret` |  | 비밀글 여부 T : 사용함 · F : 사용안함 |
| ↳ `notice` |  | 공지 여부 T : 사용함 · F : 사용안함 |
| ↳ `fixed` |  | 고정글 여부 T : 사용함 · F : 사용안함 |
| ↳ `deleted` |  | 삭제 구분 T: 삭제 · F: 비삭제 · B: 등록전 |
| ↳ `input_channel` |  | 게시물 작성 경로 P : PC · M : 모바일 |
| ↳ `order_id` |  | 주문번호 |
| ↳ `attached_file_urls` |  | 첨부 파일 상세 |
| ↳ ↳ `no` |  |  |
| ↳ ↳ `name` |  |  |
| ↳ ↳ `url` |  |  |
| ↳ `hit` |  | 조회수 |
| ↳ `reply` |  | 1:1 게시판 문의내용에 대한 답변여부 T : 사용함 · F : 사용안함 |
| ↳ `reply_user_id` |  | 처리중 또는 답변완료 한 운영자 아이디 |
| ↳ `reply_status` |  | 답변 처리 상태 N : 답변전 · P : 처리중 · C : 처리완료 |
| ↳ `naverpay_review_id` |  | 네이버페이 리뷰 아이디 |
| ↳ `display_time` |  | 노출시간 사용여부 |
| ↳ `display_time_start_hour` |  | 노출시간 시작 시각 |
| ↳ `display_time_end_hour` |  | 노출시간 종료 시각 |

응답 예시 (JSON):

```json
{
    "article": {
        "shop_no": 1,
        "article_no": 50,
        "parent_article_no": 40,
        "board_no": 5,
        "product_no": 10,
        "category_no": 1,
        "board_category_no": 1,
        "reply_sequence": 1,
        "reply_depth": 1,
        "created_date": "2018-11-30T12:43:00+09:00",
        "writer": "John Doe",
        "writer_email": "sample@sample.com",
        "member_id": "sampleid",
        "title": "subject text",
        "content": "contents text",
        "client_ip": "127.0.0.1",
        "nick_name": "sample nickname",
        "rating": 0,
        "reply_mail": "N",
        "display": "T",
        "secret": "T",
        "notice": "F",
        "fixed": "F",
        "deleted": "F",
        "input_channel": "P",
        "order_id": "20170710-0000013",
        "attached_file_urls": [
            {
                "no": 1,
                "name": "dev_starter_p1.png",
                "url": "https://{domain}/file_data/{mall_id}/2019/01/02/4f43130f0698818abc2d4b03ca7635ad.png"
            },
            {
                "no": 2,
                "name": "dev_basic_p2.png",
                "url": "https://{domain}/file_data/{mall_id}/2019/01/02/ea8203b11b4148f4cbf723e4e01c866f.png"
            }
        ],
        "hit": 0,
        "reply": "F",
        "reply_user_id": "admin",
        "reply_status": "C",
        "naverpay_review_id": "naverid",
        "display_time": "T",
        "display_time_start_hour": "1",
        "display_time_end_hour": "12"
    }
}
```

### `DELETE /api/v2/admin/boards/{board_no}/articles/{article_no}` — Delete a board post

- **Scope**: `mall.write_community` (write)
- **호출건수 제한**: 40
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#delete-a-board-post

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 |
| `board_no` | ✓ |  |  | 게시판 번호 |
| `article_no` | ✓ | 최대값: [2147483647] |  | 게시물 번호 |

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `article` |  | (응답 객체) |
| ↳ `shop_no` |  | 멀티쇼핑몰 번호 |
| ↳ `board_no` |  | 게시판 번호 |
| ↳ `article_no` | 최대값: [2147483647] | 게시물 번호 |

응답 예시 (JSON):

```json
{
    "article": {
        "shop_no": 1,
        "board_no": 1,
        "article_no": 1
    }
}
```
