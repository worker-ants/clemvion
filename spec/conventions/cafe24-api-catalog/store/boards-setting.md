---
resource: store
entity: boards-setting
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#boards-setting
source: Cafe24 REST API Documentation (admin) — fields from full-page HTML; operation 응답 샘플은 code 엔드포인트 /docs/code/api/admin/shell/<entity>.json
---

# Cafe24 API — Store / Boards setting

> Field-level 카탈로그. Endpoint enumeration index: [`../store.md`](../store.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Boards setting](https://developers.cafe24.com/docs/ko/api/admin/#boards-setting)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

게시판 관리자명, 게시판 연동하기, 구매후기 작성 버튼의 노출 시점, 게시판 비밀번호 작성규칙 설정여부, 스팸 자동생성 방지 설정여부 설정 등 게시판 관련 설정의 설정 관리할 수 있습니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `shop_no` |  | 멀티쇼핑몰 번호 |
| `admin_name` |  | 게시판 관리자명 |
| `password_rules` |  | 게시판 비밀번호 작성 규칙 설정 여부 |
| `linked_board` |  | 게시판 연동 |
| `review_button_mode` |  | 구매 후기 작성 버튼 노출 시점 |
| `spam_auto_prevention` |  | 스팸 자동 생성 방지 설정 |

## Operations

### `GET /api/v2/admin/boards/setting` — Retrieve board settings

- **Scope**: `mall.read_store` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-board-settings

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |

#### 응답 (Response)

> Cafe24 공식 docs 의 대표 응답 샘플. 실제 필드 정의는 위 [응답 속성](#응답-속성-property-list) 참조.

```json
{
    "board": {
        "shop_no": 1,
        "admin_name": "name",
        "password_rules": "T",
        "linked_board": "F",
        "review_button_mode": "all",
        "spam_auto_prevention": {
            "type": "R",
            "site_key": "SAMPLE_RECAPTCHA_SITE_KEY",
            "secret_key": "SAMPLE_RECAPTCHA_SECRET_KEY"
        }
    }
}
```

### `PUT /api/v2/admin/boards/setting` — Update board settings

- **Scope**: `mall.write_store` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 1
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#update-board-settings

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |
| `admin_name` |  |  |  | 게시판 관리자명 운영자명 : name · 운영자 닉네임 : nickname · 쇼핑몰명 : shopname · 상호명 : storename |
| `password_rules` |  |  |  | 게시판 비밀번호 작성 규칙 설정 여부 T : 사용함 · F : 사용안함 |
| `linked_board` |  |  |  | 게시판 연동 사용안함 : F · 게시판 번호 : 1 |
| `review_button_mode` |  |  |  | 구매 후기 작성 버튼 노출 시점 주문상태와 상관없음 : all · 배송중 상태 : shipbegin_date · 배송완료 후 : shipend_date |
| `spam_auto_prevention` |  |  |  | 스팸 자동 생성 방지 설정 |
| ↳ `type` |  |  |  | 스팸 자동 생성 방지 설정 방식 · S : 보안문자 입력 방식 · R : 구글 리캡챠 방식 |
| ↳ `site_key` | ✓ |  |  | 구글 리캡챠 사이트 키 |
| ↳ `secret_key` | ✓ |  |  | 구글 리캡챠 비밀 키 |

#### 응답 (Response)

> Cafe24 공식 docs 의 대표 응답 샘플. 실제 필드 정의는 위 [응답 속성](#응답-속성-property-list) 참조.

```json
{
    "board": {
        "shop_no": 1,
        "admin_name": "name",
        "password_rules": "T",
        "linked_board": "F",
        "review_button_mode": "all",
        "spam_auto_prevention": {
            "type": "R",
            "site_key": "SAMPLE_RECAPTCHA_SITE_KEY",
            "secret_key": "SAMPLE_RECAPTCHA_SECRET_KEY"
        }
    }
}
```
