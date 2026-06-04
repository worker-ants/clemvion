---
resource: store
entity: information
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#information
source: Cafe24 REST API Documentation (admin) — fields from full-page HTML; operation 응답 샘플은 code 엔드포인트 /docs/code/api/admin/shell/<entity>.json
---

# Cafe24 API — Store / Information

> Field-level 카탈로그. Endpoint enumeration index: [`../store.md`](../store.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Information](https://developers.cafe24.com/docs/ko/api/admin/#information)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

쇼핑몰의 기타이용 안내사항을 설정할 수 있습니다

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `shop_no` |  | 멀티쇼핑몰 번호 |
| `type` |  | 안내 유형 information_type |
| `display_mobile` |  | 모바일 표시 여부 T : 표시함 · F : 표시안함 |
| `use` |  | 사용 여부 T: 사용함 · F: 사용안함 |
| `content` |  | 안내 내용 |

## Operations

### `GET /api/v2/admin/information` — Retrieve store policies

- **Scope**: `mall.read_store` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-store-policies

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `information` |  | (목록) |
| ↳ `shop_no` |  | 멀티쇼핑몰 번호 |
| ↳ `type` |  | 안내 유형 information_type |
| ↳ `display_mobile` |  | 모바일 표시 여부 T : 표시함 · F : 표시안함 |
| ↳ `use` |  | 사용 여부 T: 사용함 · F: 사용안함 |
| ↳ `content` |  | 안내 내용 |

응답 예시 (JSON):

```json
{
    "information": [
        {
            "shop_no": 1,
            "type": "PAYMENT",
            "display_mobile": "F",
            "use": null,
            "content": "For high-value payments, the card company may call you to verify the transaction for security purposes."
        },
        {
            "shop_no": 1,
            "type": "SHIPPING_INFORMATION",
            "display_mobile": null,
            "use": "T",
            "content": "This guide contains our shipping information provision policy."
        }
    ]
}
```

### `PUT /api/v2/admin/information` — Update store policies

- **Scope**: `mall.write_store` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 8
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#update-store-policies

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |
| `type` | ✓ |  |  | 안내 유형 information_type |
| `display_mobile` |  |  |  | 모바일 표시 여부 T : 표시함 · F : 표시안함 |
| `use` |  |  |  | 사용 여부 T: 사용함 · F: 사용안함 |
| `save_type` |  |  |  | 저장 방식 S: 표준 안내 적용 · C: 사용자 정의 안내 적용 |
| `content` |  |  |  | 안내 내용 |

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `information` |  | (목록) |
| ↳ `shop_no` |  | 멀티쇼핑몰 번호 |
| ↳ `type` |  | 안내 유형 information_type |
| ↳ `display_mobile` |  | 모바일 표시 여부 T : 표시함 · F : 표시안함 |
| ↳ `use` |  | 사용 여부 T: 사용함 · F: 사용안함 |
| ↳ `content` |  | 안내 내용 |

응답 예시 (JSON):

```json
{
    "information": [
        {
            "shop_no": 1,
            "type": "PAYMENT",
            "display_mobile": "F",
            "use": null,
            "content": "For high-value payments, the card company may call you to verify the transaction for security purposes."
        },
        {
            "shop_no": 1,
            "type": "SHIPPING_INFORMATION",
            "display_mobile": null,
            "use": "T",
            "content": "This is a guide to our shipping information provision policy which explains how we handle your delivery data."
        }
    ]
}
```
