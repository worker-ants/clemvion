---
resource: community
entity: urgentinquiry__reply
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#urgentinquiry--reply
source: Cafe24 REST API Documentation (admin) — fields from full-page HTML; operation 응답 샘플은 code 엔드포인트 /docs/code/api/admin/shell/<entity>.json
---

# Cafe24 API — Community / Urgentinquiry reply

> Field-level 카탈로그. Endpoint enumeration index: [`../community.md`](../community.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Urgentinquiry reply](https://developers.cafe24.com/docs/ko/api/admin/#urgentinquiry--reply)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

긴급문의 게시물의 답변글을 조회, 등록, 수정할 수 있습니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `shop_no` |  | 멀티쇼핑몰 번호 |
| `article_no` |  | 게시물 번호 |
| `created_date` | 날짜 | 답변 등록일 |
| `status` |  | 답변 처리 상태 F: 미처리 · I: 처리중 · T: 처리완료 |
| `content` |  | 답변 내용 |
| `method` |  | 답변 방법 E:이메일 · S:SMS · A:전부 |
| `count` |  | 답변 처리 횟수 |
| `user_id` |  | 처리중 또는 답변완료 한 운영자 아이디 |
| `attached_file_detail` |  | 첨부 파일 상세 |

## Operations

### `GET /api/v2/admin/urgentinquiry/{article_no}/reply` — Retrieve a reply for urgent inquiry post

- **Scope**: `mall.read_community` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-reply-for-urgent-inquiry-post

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |
| `article_no` | ✓ |  |  | 게시물 번호 |

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `reply` |  | (응답 객체) |
| ↳ `shop_no` |  | 멀티쇼핑몰 번호 |
| ↳ `article_no` |  | 게시물 번호 |
| ↳ `created_date` | 날짜 | 답변 등록일 |
| ↳ `status` |  | 답변 처리 상태 F: 미처리 · I: 처리중 · T: 처리완료 |
| ↳ `content` |  | 답변 내용 |
| ↳ `method` |  | 답변 방법 E:이메일 · S:SMS · A:전부 |
| ↳ `count` |  | 답변 처리 횟수 |
| ↳ `user_id` |  | 처리중 또는 답변완료 한 운영자 아이디 |
| ↳ `attached_file_detail` |  | 첨부 파일 상세 |
| ↳ ↳ `no` |  |  |
| ↳ ↳ `source` |  |  |
| ↳ ↳ `name` |  |  |

응답 예시 (JSON):

```json
{
    "reply": {
        "shop_no": 1,
        "article_no": 2,
        "created_date": "2022-04-13T15:42:37+09:00",
        "status": "T",
        "content": "reply content text",
        "method": "E",
        "count": 2,
        "user_id": "admin",
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
}
```

### `POST /api/v2/admin/urgentinquiry/{article_no}/reply` — Create a reply for urgent inquiry post

- **Scope**: `mall.write_community` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 1
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#create-a-reply-for-urgent-inquiry-post

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |
| `article_no` | ✓ |  |  | 게시물 번호 |
| `content` | ✓ |  |  | 답변 내용 |
| `status` |  |  | F | 답변 처리 상태 F: 미처리 · I: 처리중 · T: 처리완료 |
| `user_id` | ✓ | 최대글자수 : [20자] |  | 처리중 또는 답변완료 한 운영자 아이디 |
| `attach_file_urls` |  |  |  | 첨부 파일 상세 |
| ↳ `name` | ✓ |  |  | 파일명 |
| ↳ `url` | ✓ |  |  | 파일 URL |

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `reply` |  | (응답 객체) |
| ↳ `shop_no` |  | 멀티쇼핑몰 번호 |
| ↳ `article_no` |  | 게시물 번호 |
| ↳ `created_date` | 날짜 | 답변 등록일 |
| ↳ `status` |  | 답변 처리 상태 F: 미처리 · I: 처리중 · T: 처리완료 |
| ↳ `content` |  | 답변 내용 |
| ↳ `method` |  | 답변 방법 E:이메일 · S:SMS · A:전부 |
| ↳ `count` |  | 답변 처리 횟수 |
| ↳ `user_id` |  | 처리중 또는 답변완료 한 운영자 아이디 |
| ↳ `attached_file_detail` |  | 첨부 파일 상세 |
| ↳ ↳ `no` |  |  |
| ↳ ↳ `source` |  |  |
| ↳ ↳ `name` |  |  |

응답 예시 (JSON):

```json
{
    "reply": {
        "shop_no": 1,
        "article_no": 2,
        "created_date": "2022-04-13T15:42:37+09:00",
        "status": "T",
        "content": "reply content text",
        "method": "E",
        "count": 2,
        "user_id": "admin",
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
}
```

### `PUT /api/v2/admin/urgentinquiry/{article_no}/reply` — Update a reply for urgent inquiry post

- **Scope**: `mall.write_community` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 1
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#update-a-reply-for-urgent-inquiry-post

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |
| `article_no` | ✓ |  |  | 게시물 번호 |
| `content` | ✓ |  |  | 답변 내용 |
| `status` |  |  |  | 답변 처리 상태 F: 미처리 · I: 처리중 · T: 처리완료 |
| `user_id` |  | 최대글자수 : [20자] |  | 처리중 또는 답변완료 한 운영자 아이디 |
| `attach_file_urls` |  |  |  | 첨부 파일 상세 |
| ↳ `name` | ✓ |  |  | 파일명 |
| ↳ `url` | ✓ |  |  | 파일 URL |

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `reply` |  | (응답 객체) |
| ↳ `shop_no` |  | 멀티쇼핑몰 번호 |
| ↳ `article_no` |  | 게시물 번호 |
| ↳ `created_date` | 날짜 | 답변 등록일 |
| ↳ `status` |  | 답변 처리 상태 F: 미처리 · I: 처리중 · T: 처리완료 |
| ↳ `content` |  | 답변 내용 |
| ↳ `method` |  | 답변 방법 E:이메일 · S:SMS · A:전부 |
| ↳ `count` |  | 답변 처리 횟수 |
| ↳ `user_id` |  | 처리중 또는 답변완료 한 운영자 아이디 |
| ↳ `attached_file_detail` |  | 첨부 파일 상세 |
| ↳ ↳ `no` |  |  |
| ↳ ↳ `source` |  |  |
| ↳ ↳ `name` |  |  |

응답 예시 (JSON):

```json
{
    "reply": {
        "shop_no": 1,
        "article_no": 2,
        "created_date": "2022-04-13T15:42:37+09:00",
        "status": "T",
        "content": "reply content text",
        "method": "E",
        "count": 2,
        "user_id": "admin",
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
}
```
