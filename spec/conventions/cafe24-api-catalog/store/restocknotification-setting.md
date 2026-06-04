---
resource: store
entity: restocknotification-setting
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#restocknotification-setting
source: Cafe24 REST API Documentation (admin) — fields from full-page HTML; operation 응답 샘플은 code 엔드포인트 /docs/code/api/admin/shell/<entity>.json
---

# Cafe24 API — Store / Restocknotification setting

> Field-level 카탈로그. Endpoint enumeration index: [`../store.md`](../store.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Restocknotification setting](https://developers.cafe24.com/docs/ko/api/admin/#restocknotification-setting)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

재입고 알림 상품의 설정 관리할 수 있습니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `shop_no` | 최소값: [1] | 멀티쇼핑몰 번호 DEFAULT 1 |
| `use` |  | 사용 여부 T:사용 · F:사용안함 |
| `is_button_show` |  | 버튼 노출 여부 T:노출함 · F:노출안함 |
| `expiration_period` |  | 알림 유효기간 설정 1:1개월 · 3:3개월 · 6:6개월 · 12:1년 |
| `button_show_target` |  | 버튼 노출 대상 A:모두 노출 · M:회원만 노출 |
| `show_message_to_non_members` | 최대글자수 : [30자] | 비회원 메시지 |
| `send_method` |  | 발송 방법 A:자동발송 · M:수동발송 |
| `button_show_method` |  | 버튼 진열 타입 P:상품별 · G:품목별 |
| `available_product` |  | 버튼 노출 상품 A:전체상품 · P:특정상품 · E:제외상품 |
| `available_product_list` | 배열 최대사이즈: [200] | 버튼 노출 상품 리스트 |

## Operations

### `GET /api/v2/admin/restocknotification/setting` — Retrieve restocknotification settings

- **Scope**: `mall.read_store` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-restocknotification-settings

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |

#### 응답 (Response)

> Cafe24 공식 docs 의 대표 응답 샘플. 실제 필드 정의는 위 [응답 속성](#응답-속성-property-list) 참조.

```json
{
    "restocknotification": {
        "shop_no": 1,
        "use": "T",
        "is_button_show": "T",
        "expiration_period": 3,
        "button_show_target": "A",
        "show_message_to_non_members": "Please sign in",
        "send_method": "A",
        "button_show_method": "P",
        "available_product": "P",
        "available_product_list": [
            9,
            10
        ]
    }
}
```

### `PUT /api/v2/admin/restocknotification/setting` — Updated restocknotification settings

- **Scope**: `mall.write_store` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 1
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#updated-restocknotification-settings

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |
| `use` |  |  |  | 사용 여부 T:사용 · F:사용안함 |
| `is_button_show` |  |  |  | 버튼 노출 여부 T:노출함 · F:노출안함 |
| `expiration_period` |  |  |  | 알림 유효기간 설정 1:1개월 · 3:3개월 · 6:6개월 · 12:1년 |
| `button_show_target` |  |  |  | 버튼 노출 대상 A:모두 노출 · M:회원만 노출 |
| `show_message_to_non_members` |  | 최대글자수 : [30자] |  | 비회원 메시지 |
| `send_method` |  |  |  | 발송 방법 A:자동발송 · M:수동발송 |
| `button_show_method` |  |  |  | 버튼 진열 타입 P:상품별 · G:품목별 |
| `available_product` |  |  |  | 버튼 노출 상품 A:전체상품 · P:특정상품 · E:제외상품 |
| `available_product_list` |  | 배열 최대사이즈: [200] |  | 버튼 노출 상품 리스트 |

#### 응답 (Response)

> Cafe24 공식 docs 의 대표 응답 샘플. 실제 필드 정의는 위 [응답 속성](#응답-속성-property-list) 참조.

```json
{
    "restocknotification": {
        "shop_no": 1,
        "use": "T",
        "is_button_show": "T",
        "expiration_period": 3,
        "button_show_target": "A",
        "show_message_to_non_members": "Please sign in",
        "send_method": "A",
        "button_show_method": "P",
        "available_product": "P",
        "available_product_list": [
            9,
            10
        ]
    }
}
```
