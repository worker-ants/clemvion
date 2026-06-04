---
resource: order
entity: orderform-properties
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#orderform-properties
source: Cafe24 REST API Documentation (admin) — fields from full-page HTML; operation 응답 샘플은 code 엔드포인트 /docs/code/api/admin/shell/<entity>.json
---

# Cafe24 API — Order / Orderform properties

> Field-level 카탈로그. Endpoint enumeration index: [`../order.md`](../order.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Orderform properties](https://developers.cafe24.com/docs/ko/api/admin/#orderform-properties)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

구매자가 주문할 때 추가로 입력받아야 하는 항목을 설정 할 수 있는 기능입니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `shop_no` |  | 멀티쇼핑몰 번호 |
| `additional_items` |  | 주문서 추가항목 |
| `input_type` |  | 주문서 추가항목 입력 형식 T : 텍스트박스(한줄) · M : 텍스트박스(여러줄) · R : 라디오버튼 · C : 체크박스 · S : 셀렉트박스 · D : 캘린더 · I : 시간 |
| `is_required` |  | 주문서 추가항목 필수 여부 T : 필수 · F : 선택 |
| `subject` |  | 주문서 추가항목명 |
| `available_product_type` |  | 적용 대상 상품 설정 A : 전체상품 · C : 상품분류별 · P : 개별상품 |
| `input_scope` |  | 입력값 적용 범위 (공통 또는 상품별) A : 공통으로 한번만 입력 받기 · P : 상품별로 입력 받기 |
| `description` |  | 주문서 추가항목 설명 |
| `field_length` |  | 주문서 추가항목 필드 길이 (텍스트박스) |
| `max_input_length` |  | 주문서 추가항목 입력 가능한 최대 글자 수 |
| `textarea_rows` |  | 주문서 추가항목 행 수 (여러 줄 입력 시) |
| `width_percentage` |  | 주문서 추가항목 가로길이 (%) |
| `option_values` |  | 주문서 추가항목 입력값 |
| `display_lines_desktop` |  | 한 줄에 표시할 옵션 개수 (PC) |
| `display_lines_mobile` |  | 한 줄에 표시할 옵션 개수 (모바일) |
| `category_no` |  | 주문서 추가항목 지정 상품분류 번호 |
| `product_no` |  | 주문서 추가항목 지정 상품 번호 |
| `orderform_property_id` |  | 주문서 추가항목 고유번호 |

## Operations

### `GET /api/v2/admin/orderform/properties` — Retrieve an additional checkout field

- **Scope**: `mall.read_order` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-an-additional-checkout-field

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `properties` |  | 항목 |
| ↳ `shop_no` |  | 멀티쇼핑몰 번호 |
| ↳ `additional_items` |  | 주문서 추가항목 |
| ↳ ↳ `orderform_property_id` |  | 주문서 추가항목 고유번호 |
| ↳ ↳ `input_type` |  | 주문서 추가항목 입력 형식 T : 텍스트박스(한줄) · M : 텍스트박스(여러줄) · R : 라디오버튼 · C : 체크박스 · S : 셀렉트박스 · D : 캘린더 · I : 시간 |
| ↳ ↳ `is_required` |  | 주문서 추가항목 필수 여부 T : 필수 · F : 선택 |
| ↳ ↳ `subject` |  | 주문서 추가항목명 |
| ↳ ↳ `description` |  | 주문서 추가항목 설명 |
| ↳ ↳ `field_length` |  | 주문서 추가항목 필드 길이 (텍스트박스) |
| ↳ ↳ `max_input_length` |  | 주문서 추가항목 입력 가능한 최대 글자 수 |
| ↳ ↳ `textarea_rows` |  | 주문서 추가항목 행 수 (여러 줄 입력 시) |
| ↳ ↳ `width_percentage` |  | 주문서 추가항목 가로길이 (%) |
| ↳ ↳ `option_values` |  | 주문서 추가항목 입력값 |
| ↳ ↳ `display_lines_desktop` |  | 한 줄에 표시할 옵션 개수 (PC) |
| ↳ ↳ `display_lines_mobile` |  | 한 줄에 표시할 옵션 개수 (모바일) |
| ↳ ↳ `available_product_type` |  | 적용 대상 상품 설정 A : 전체상품 · C : 상품분류별 · P : 개별상품 |
| ↳ ↳ `input_scope` |  | 입력값 적용 범위 (공통 또는 상품별) A : 공통으로 한번만 입력 받기 · P : 상품별로 입력 받기 |
| ↳ ↳ `category_no` |  | 주문서 추가항목 지정 상품분류 번호 |
| ↳ ↳ `product_no` |  | 주문서 추가항목 지정 상품 번호 |

응답 예시 (JSON):

```json
{
    "properties": {
        "shop_no": 1,
        "additional_items": [
            {
                "orderform_property_id": 1,
                "input_type": "T",
                "is_required": "T",
                "subject": "text additional item name",
                "description": "text additional item description",
                "field_length": 10,
                "max_input_length": 10,
                "textarea_rows": 0,
                "width_percentage": 0,
                "option_values": "",
                "display_lines_desktop": 0,
                "display_lines_mobile": 0,
                "available_product_type": "C",
                "input_scope": "A",
                "category_no": 24,
                "product_no": null
            },
            {
                "orderform_property_id": 6,
                "input_type": "I",
                "is_required": "F",
                "subject": "time additional item name",
                "description": "time additional item description",
                "field_length": 0,
                "max_input_length": 0,
                "textarea_rows": 0,
                "width_percentage": 0,
                "option_values": "{\"time_start\":\"00:00\",\"time_end\":\"01:00\",\"time_interval\":\"60\"}",
                "display_lines_desktop": 0,
                "display_lines_mobile": 0,
                "available_product_type": "P",
                "input_scope": "A",
                "category_no": null,
                "product_no": "22,23"
            }
        ]
    }
}
```

### `POST /api/v2/admin/orderform/properties` — Create an additional checkout field

- **Scope**: `mall.write_order` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 100
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#create-an-additional-checkout-field

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |
| `input_type` | ✓ |  |  | 주문서 추가항목 입력 형식 T : 텍스트박스(한줄) · M : 텍스트박스(여러줄) · R : 라디오버튼 · C : 체크박스 · S : 셀렉트박스 · D : 캘린더 · I : 시간 |
| `is_required` | ✓ |  |  | 주문서 추가항목 필수 여부 T : 필수 · F : 선택 |
| `subject` | ✓ |  |  | 주문서 추가항목명 |
| `available_product_type` | ✓ |  |  | 적용 대상 상품 설정 A : 전체상품 · C : 상품분류별 · P : 개별상품 |
| `input_scope` | ✓ |  |  | 입력값 적용 범위 (공통 또는 상품별) A : 공통으로 한번만 입력 받기 · P : 상품별로 입력 받기 |
| `description` |  | 최대글자수 : [500자] |  | 주문서 추가항목 설명 |
| `field_length` |  | 최소: [1]~최대: [250] |  | 주문서 추가항목 필드 길이 (텍스트박스) input_type를 "T"로 선택 하였을때만 입력 가능 |
| `max_input_length` |  | 최소: [1]~최대: [250] |  | 주문서 추가항목 입력 가능한 최대 글자 수 input_type를 "T"로 선택 하였을때만 입력 가능 |
| `textarea_rows` |  | 최소: [1]~최대: [70] |  | 주문서 추가항목 행 수 (여러 줄 입력 시) input_type를 "M"로 선택 하였을때만 입력 가능 |
| `width_percentage` |  | 최소: [1]~최대: [100] |  | 주문서 추가항목 가로길이 (%) input_type를 "M"로 선택 하였을때만 입력 가능 |
| `option_values` |  |  |  | 주문서 추가항목 입력값 input_type를 "R", "C", "S", "I"로 선택 하였을때만 입력 가능 · input_type를 "R", "C", "S" 로 입력한 경우 구분자 "/" 로 입력(빨강/노랑/파랑) · input_type를 "I" 로 입력한 경우 아래와 같이 시간정보를 입력 · 예) "{"time_start":"00:00","time_end":"01:00","time_interval":"60"} 예) 빨강/노랑/파랑 |
| `display_lines_desktop` |  | 최소: [1]~최대: [999] |  | 한 줄에 표시할 옵션 개수 (PC) input_type를 "R", "C"로 선택 하였을때만 입력 가능 |
| `display_lines_mobile` |  | 최소: [1]~최대: [999] |  | 한 줄에 표시할 옵션 개수 (모바일) input_type를 "R", "C"로 선택 하였을때만 입력 가능 |
| `category_no` |  |  |  | 주문서 추가항목 지정 상품분류 번호 available_product_type를 "P"로 선택 하였을때만 입력 가능(C도 마찬가지) |
| `product_no` |  |  |  | 주문서 추가항목 지정 상품 번호 available_product_type를 "P"로 선택 하였을때만 입력 가능(C도 마찬가지) |

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `properties` |  | 항목 |
| ↳ `shop_no` |  | 멀티쇼핑몰 번호 |
| ↳ `input_type` |  | 주문서 추가항목 입력 형식 T : 텍스트박스(한줄) · M : 텍스트박스(여러줄) · R : 라디오버튼 · C : 체크박스 · S : 셀렉트박스 · D : 캘린더 · I : 시간 |
| ↳ `is_required` |  | 주문서 추가항목 필수 여부 T : 필수 · F : 선택 |
| ↳ `subject` |  | 주문서 추가항목명 |
| ↳ `available_product_type` |  | 적용 대상 상품 설정 A : 전체상품 · C : 상품분류별 · P : 개별상품 |
| ↳ `input_scope` |  | 입력값 적용 범위 (공통 또는 상품별) A : 공통으로 한번만 입력 받기 · P : 상품별로 입력 받기 |
| ↳ `description` |  | 주문서 추가항목 설명 |
| ↳ `field_length` |  | 주문서 추가항목 필드 길이 (텍스트박스) |
| ↳ `max_input_length` |  | 주문서 추가항목 입력 가능한 최대 글자 수 |
| ↳ `textarea_rows` |  | 주문서 추가항목 행 수 (여러 줄 입력 시) |
| ↳ `width_percentage` |  | 주문서 추가항목 가로길이 (%) |
| ↳ `option_values` |  | 주문서 추가항목 입력값 |
| ↳ `display_lines_desktop` |  | 한 줄에 표시할 옵션 개수 (PC) |
| ↳ `display_lines_mobile` |  | 한 줄에 표시할 옵션 개수 (모바일) |
| ↳ `category_no` |  | 주문서 추가항목 지정 상품분류 번호 |
| ↳ `product_no` |  | 주문서 추가항목 지정 상품 번호 |

응답 예시 (JSON):

```json
{
    "properties": [
        {
            "shop_no": 1,
            "input_type": "T",
            "is_required": "T",
            "subject": "text additional item name",
            "available_product_type": "A",
            "input_scope": "A",
            "description": "text additional item description",
            "field_length": 10,
            "max_input_length": 10,
            "textarea_rows": null,
            "width_percentage": null,
            "option_values": null,
            "display_lines_desktop": null,
            "display_lines_mobile": null,
            "category_no": null,
            "product_no": null
        },
        {
            "shop_no": 1,
            "input_type": "I",
            "is_required": "F",
            "subject": "time additional item name",
            "available_product_type": "A",
            "input_scope": "A",
            "description": "time additional item description",
            "field_length": null,
            "max_input_length": null,
            "textarea_rows": null,
            "width_percentage": null,
            "option_values": "{\"time_start\":\"00:00\",\"time_end\":\"01:00\",\"time_interval\":\"60\"}",
            "display_lines_desktop": null,
            "display_lines_mobile": null,
            "category_no": null,
            "product_no": null
        }
    ]
}
```

### `PUT /api/v2/admin/orderform/properties/{orderform_property_id}` — Update an additional checkout field

- **Scope**: `mall.write_order` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 1
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#update-an-additional-checkout-field

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |
| `orderform_property_id` | ✓ |  |  | 주문서 추가항목 고유번호 |
| `input_type` |  |  |  | 주문서 추가항목 입력 형식 T : 텍스트박스(한줄) · M : 텍스트박스(여러줄) · R : 라디오버튼 · C : 체크박스 · S : 셀렉트박스 · D : 캘린더 · I : 시간 |
| `is_required` |  |  |  | 주문서 추가항목 필수 여부 T : 필수 · F : 선택 |
| `subject` |  |  |  | 주문서 추가항목명 |
| `description` |  | 최대글자수 : [500자] |  | 주문서 추가항목 설명 |
| `field_length` |  | 최소: [1]~최대: [250] |  | 주문서 추가항목 필드 길이 (텍스트박스) input_type를 "T"로 선택 하였을때만 입력 가능 |
| `max_input_length` |  | 최소: [1]~최대: [250] |  | 주문서 추가항목 입력 가능한 최대 글자 수 input_type를 "T"로 선택 하였을때만 입력 가능 |
| `textarea_rows` |  | 최소: [1]~최대: [70] |  | 주문서 추가항목 행 수 (여러 줄 입력 시) input_type를 "M"로 선택 하였을때만 입력 가능 |
| `width_percentage` |  | 최소: [1]~최대: [100] |  | 주문서 추가항목 가로길이 (%) input_type를 "M"로 선택 하였을때만 입력 가능 |
| `option_values` |  |  |  | 주문서 추가항목 입력값 input_type를 "R", "C", "S", "I"로 선택 하였을때만 입력 가능 · input_type를 "R", "C", "S" 로 입력한 경우 구분자 "/" 로 입력(빨강/노랑/파랑) · input_type를 "I" 로 입력한 경우 아래와 같이 시간정보를 입력 · 예) "{"time_start":"00:00","time_end":"01:00","time_interval":"60"} 예) 빨강/노랑/파랑 |
| `display_lines_desktop` |  | 최소: [1]~최대: [999] |  | 한 줄에 표시할 옵션 개수 (PC) input_type를 "R", "C"로 선택 하였을때만 입력 가능 |
| `display_lines_mobile` |  | 최소: [1]~최대: [999] |  | 한 줄에 표시할 옵션 개수 (모바일) input_type를 "R", "C"로 선택 하였을때만 입력 가능 |
| `available_product_type` |  |  |  | 적용 대상 상품 설정 A : 전체상품 · C : 상품분류별 · P : 개별상품 |
| `input_scope` |  |  |  | 입력값 적용 범위 (공통 또는 상품별) A : 공통으로 한번만 입력 받기 · P : 상품별로 입력 받기 |
| `category_no` |  |  |  | 주문서 추가항목 지정 상품분류 번호 available_product_type를 "P"로 선택 하였을때만 입력 가능(C도 마찬가지) |
| `product_no` |  |  |  | 주문서 추가항목 지정 상품 번호 available_product_type를 "P"로 선택 하였을때만 입력 가능(C도 마찬가지) |

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `properties` |  | 항목 |
| ↳ `shop_no` |  | 멀티쇼핑몰 번호 |
| ↳ `input_type` |  | 주문서 추가항목 입력 형식 T : 텍스트박스(한줄) · M : 텍스트박스(여러줄) · R : 라디오버튼 · C : 체크박스 · S : 셀렉트박스 · D : 캘린더 · I : 시간 |
| ↳ `is_required` |  | 주문서 추가항목 필수 여부 T : 필수 · F : 선택 |
| ↳ `subject` |  | 주문서 추가항목명 |
| ↳ `description` |  | 주문서 추가항목 설명 |
| ↳ `field_length` |  | 주문서 추가항목 필드 길이 (텍스트박스) |
| ↳ `max_input_length` |  | 주문서 추가항목 입력 가능한 최대 글자 수 |
| ↳ `available_product_type` |  | 적용 대상 상품 설정 A : 전체상품 · C : 상품분류별 · P : 개별상품 |
| ↳ `input_scope` |  | 입력값 적용 범위 (공통 또는 상품별) A : 공통으로 한번만 입력 받기 · P : 상품별로 입력 받기 |

응답 예시 (JSON):

```json
{
    "properties": {
        "shop_no": 1,
        "input_type": "T",
        "is_required": "T",
        "subject": "text additional item name",
        "description": "text additional item description",
        "field_length": 10,
        "max_input_length": 10,
        "available_product_type": "A",
        "input_scope": "A"
    }
}
```

### `DELETE /api/v2/admin/orderform/properties/{orderform_property_id}` — Delete an additional checkout field

- **Scope**: `mall.write_order` (write)
- **호출건수 제한**: 40
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#delete-an-additional-checkout-field

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 |
| `orderform_property_id` | ✓ |  |  | 주문서 추가항목 고유번호 |

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `properties` |  | 항목 |
| ↳ `shop_no` |  | 멀티쇼핑몰 번호 |
| ↳ `orderform_property_id` |  | 주문서 추가항목 고유번호 |

응답 예시 (JSON):

```json
{
    "properties": {
        "shop_no": 1,
        "orderform_property_id": 10
    }
}
```
