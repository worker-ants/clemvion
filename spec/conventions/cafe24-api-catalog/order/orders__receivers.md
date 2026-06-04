---
resource: order
entity: orders__receivers
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#orders--receivers
source: Cafe24 REST API Documentation (admin) — fields from full-page HTML; operation 응답 샘플은 code 엔드포인트 /docs/code/api/admin/shell/<entity>.json
---

# Cafe24 API — Order / Orders receivers

> Field-level 카탈로그. Endpoint enumeration index: [`../order.md`](../order.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Orders receivers](https://developers.cafe24.com/docs/ko/api/admin/#orders--receivers)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

주문수령자 정보(Orders receivers)는 주문한 상품을 배송 받을 수령자의 이름, 연락처, 주소 등의 정보에 대한 기능 입니다. · 수령자 정보는 하위 리소스로서 주문(Order) 하위에서만 사용할 수 있습니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `shop_no` | 최소값: [1] | 멀티쇼핑몰 번호 멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호. DEFAULT 1 |
| `name` |  | 수령자명 |
| `name_furigana` |  | 수령자명 (발음) |
| `phone` |  | 전화번호 |
| `cellphone` |  | 수령자 휴대 전화 |
| `virtual_phone_no` |  | 수령자 안심번호 |
| `zipcode` |  | 우편번호 |
| `address1` |  | 기본 주소 |
| `address2` |  | 상세 주소 |
| `address_state` |  | 주/도 |
| `address_city` |  | 시/군/도시 |
| `address_street` |  | 도로명 |
| `address_full` |  | 전체주소 |
| `name_en` |  | 수령자명 (영문) |
| `city_en` |  | 수령자 도시 (영문) |
| `state_en` |  | 수령자 주 (영문) |
| `street_en` |  | 수령자 주소 (영문) |
| `country_code` |  | 국가코드 |
| `country_name` |  | 국가명 |
| `country_name_en` |  | 국가명 (영문) |
| `shipping_message` |  | 배송 메세지 |
| `clearance_information_type` |  | 통관정보 유형 I : 신분증 ID · P : 여권번호 · C : 개인통관고유부호 |
| `clearance_information` |  | 통관정보 |
| `wished_delivery_date` |  | 희망배송일 |
| `wished_delivery_time` |  | 희망배송시간 |
| `shipping_code` |  | 배송번호 |
| `change_default_shipping_address` |  | 기본배송지 변경 여부 T : 변경함 · F : 변경안함 |
| `use_fast_delivery_date` |  | 가능한 빠른 배송일 설정 여부 T: 사용함 · F: 사용안함 |
| `use_fast_delivery_time` |  | 가능한 빠른 배송시간 설정 여부 T: 사용함 · F: 사용안함 |

## Operations

### `GET /api/v2/admin/orders/{order_id}/receivers` — Retrieve a list of recipients of an order

- **Scope**: `mall.read_order` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-recipients-of-an-order

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호. |
| `order_id` | ✓ | 주문번호 |  | 주문번호 |
| `shipping_code` |  |  |  | 배송번호 ,(콤마)로 여러 건을 검색할 수 있다. |

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `receivers` |  | (목록) |
| ↳ `shop_no` | 최소값: [1] | 멀티쇼핑몰 번호 멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호. DEFAULT 1 |
| ↳ `name` |  | 수령자명 |
| ↳ `name_furigana` |  | 수령자명 (발음) |
| ↳ `phone` |  | 전화번호 |
| ↳ `cellphone` |  | 수령자 휴대 전화 |
| ↳ `virtual_phone_no` |  | 수령자 안심번호 |
| ↳ `zipcode` |  | 우편번호 |
| ↳ `address1` |  | 기본 주소 |
| ↳ `address2` |  | 상세 주소 |
| ↳ `name_en` |  | 수령자명 (영문) |
| ↳ `city_en` |  | 수령자 도시 (영문) |
| ↳ `state_en` |  | 수령자 주 (영문) |
| ↳ `street_en` |  | 수령자 주소 (영문) |
| ↳ `country_code` |  | 국가코드 |
| ↳ `country_name` |  | 국가명 |
| ↳ `country_name_en` |  | 국가명 (영문) |
| ↳ `shipping_message` |  | 배송 메세지 |
| ↳ `clearance_information_type` |  | 통관정보 유형 I : 신분증 ID · P : 여권번호 · C : 개인통관고유부호 |
| ↳ `clearance_information` |  | 통관정보 |
| ↳ `wished_delivery_date` |  | 희망배송일 |
| ↳ `wished_delivery_time` |  | 희망배송시간 |
| ↳ `shipping_code` |  | 배송번호 |

응답 예시 (JSON):

```json
{
    "receivers": [
        {
            "shop_no": 1,
            "name": "John Doe",
            "name_furigana": "John Doe",
            "phone": "02-0000-0000",
            "cellphone": "010-0000-0000",
            "virtual_phone_no": null,
            "zipcode": "06258",
            "address1": "Sindaebang dong Dongjak-gu, Seoul, Republic of Korea",
            "address2": "Professional Construction Hall",
            "name_en": null,
            "city_en": null,
            "state_en": null,
            "street_en": null,
            "country_code": "",
            "country_name": null,
            "country_name_en": null,
            "shipping_message": "Sample shipping message",
            "clearance_information_type": "C",
            "clearance_information": "P123456789012",
            "wished_delivery_date": "",
            "wished_delivery_time": null,
            "shipping_code": "D-20200928-0000011-00"
        }
    ]
}
```

### `PUT /api/v2/admin/orders/{order_id}/receivers` — Update order recipients

- **Scope**: `mall.write_order` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 100
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#update-order-recipients

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 |
| `order_id` | ✓ | 주문번호 |  | 주문번호 |
| `name` |  | 최대글자수 : [20자] |  | 수령자명 |
| `phone` |  | 최대글자수 : [20자] |  | 수령자 일반 전화 한국몰일 경우 02-0000-0000 형태로 입력 · 그외 해외몰일 경우 국가번호-000-0000 형태로 입력 |
| `cellphone` |  | 최대글자수 : [20자] |  | 수령자 휴대 전화 한국몰일 경우 010-0000-0000 형태로 입력 · 그외 해외몰일 경우 국가번호-000-0000 형태로 입력 |
| `shipping_message` |  |  |  | 배송 메세지 |
| `name_furigana` |  |  |  | 수령자명 (발음) Youtube shopping 이용 시에는 미제공 해외몰 중 일본몰인 경우에만 필수 입력 |
| `zipcode` |  | 최소글자수 : [2자]; 최대글자수 : [14자] |  | 우편번호 |
| `address1` |  | 최대글자수 : [255자] |  | 기본 주소 |
| `address2` |  | 최대글자수 : [255자] |  | 상세 주소 |
| `address_state` |  |  |  | 주/도 해외몰인 경우 필수 입력 |
| `address_city` |  |  |  | 시/군/도시 해외몰인 경우 필수 입력 |
| `name_en` |  |  |  | 수령자명 (영문) |
| `city_en` |  |  |  | 수령자 도시 (영문) |
| `state_en` |  |  |  | 수령자 주 (영문) |
| `street_en` |  |  |  | 수령자 주소 (영문) |
| `country_code` |  |  |  | 국가코드 해외몰인 경우 필수 입력 · 한국 : KR / 중국: CN / 일본: JP / 필리핀: PH / 미국: US / 대만: TW / 베트남 : VN |
| `clearance_information_type` |  |  |  | 통관정보 유형 I : 신분증 ID · P : 여권번호 · C : 개인통관고유부호 |
| `clearance_information` |  |  |  | 통관정보 |
| `shipping_code` |  |  |  | 배송번호 |
| `change_default_shipping_address` |  |  | F | 기본배송지 변경 여부 T : 변경함 · F : 변경안함 |
| `virtual_phone_no` |  |  |  | 수령자 안심번호 Youtube shopping 이용 시에는 미제공 복수 배송지 주문일 경우 수령자 안심번호 수정 불가 |
| `wished_delivery_date` |  | 날짜 |  | 희망배송일 Youtube shopping 이용 시에는 미제공 |
| `use_fast_delivery_date` |  |  |  | 가능한 빠른 배송일 설정 여부 Youtube shopping 이용 시에는 미제공 가능한 빠른 배송시간 설정 여부'가 'T' 일때는 null 로 응답함 T: 사용함 · F: 사용안함 |
| `wished_delivery_time` |  |  |  | 희망배송시간 Youtube shopping 이용 시에는 미제공 희망배송 시작시간(start_hour) · 00~23 까지 입력 가능 · 희망배송 종료시간(end_hour) · 00~23 까지 입력 가능 |
| ↳ `start_hour` |  |  |  | 희망배송 시작시간 |
| ↳ `end_hour` |  |  |  | 희망배송 종료시간 |
| `use_fast_delivery_time` |  |  |  | 가능한 빠른 배송시간 설정 여부 가능한 빠른 배송일 설정 여부'가 'T' 일때는 null 로 응답함 T: 사용함 · F: 사용안함 |

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `receivers` |  | (목록) |
| ↳ `shop_no` | 최소값: [1] | 멀티쇼핑몰 번호 멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호. DEFAULT 1 |
| ↳ `name` |  | 수령자명 |
| ↳ `name_furigana` |  | 수령자명 (발음) |
| ↳ `phone` |  | 전화번호 |
| ↳ `cellphone` |  | 수령자 휴대 전화 |
| ↳ `virtual_phone_no` |  | 수령자 안심번호 |
| ↳ `zipcode` |  | 우편번호 |
| ↳ `address1` |  | 기본 주소 |
| ↳ `address2` |  | 상세 주소 |
| ↳ `address_state` |  | 주/도 |
| ↳ `address_city` |  | 시/군/도시 |
| ↳ `address_street` |  | 도로명 |
| ↳ `address_full` |  | 전체주소 |
| ↳ `name_en` |  | 수령자명 (영문) |
| ↳ `city_en` |  | 수령자 도시 (영문) |
| ↳ `state_en` |  | 수령자 주 (영문) |
| ↳ `street_en` |  | 수령자 주소 (영문) |
| ↳ `country_code` |  | 국가코드 |
| ↳ `country_name` |  | 국가명 |
| ↳ `country_name_en` |  | 국가명 (영문) |
| ↳ `shipping_message` |  | 배송 메세지 |
| ↳ `shipping_code` |  | 배송번호 |
| ↳ `clearance_information_type` |  | 통관정보 유형 I : 신분증 ID · P : 여권번호 · C : 개인통관고유부호 |
| ↳ `clearance_information` |  | 통관정보 |
| ↳ `change_default_shipping_address` |  | 기본배송지 변경 여부 T : 변경함 · F : 변경안함 |
| ↳ `wished_delivery_date` |  | 희망배송일 |
| ↳ `use_fast_delivery_date` |  | 가능한 빠른 배송일 설정 여부 T: 사용함 · F: 사용안함 |
| ↳ `wished_delivery_time` |  | 희망배송시간 |
| ↳ ↳ `start_hour` |  |  |
| ↳ ↳ `end_hour` |  |  |
| ↳ `use_fast_delivery_time` |  | 가능한 빠른 배송시간 설정 여부 T: 사용함 · F: 사용안함 |

응답 예시 (JSON):

```json
{
    "receivers": [
        {
            "shop_no": 1,
            "name": "John Doe",
            "name_furigana": "",
            "phone": "02-0000-0000",
            "cellphone": "010-0000-0000",
            "virtual_phone_no": "0500-0000-0000",
            "zipcode": "06258",
            "address1": "Sindaebang dong Dongjak-gu, Seoul, Republic of Korea",
            "address2": "Professional Construction Hall",
            "address_state": "",
            "address_city": "",
            "address_street": "",
            "address_full": "Sindaebang dong Dongjak-gu, Seoul, Republic of Korea Professional Construction Hall",
            "name_en": "",
            "city_en": "",
            "state_en": "",
            "street_en": "",
            "country_code": "",
            "country_name": "",
            "country_name_en": "",
            "shipping_message": "Sample shipping message",
            "shipping_code": "D-20170710-0000013-00",
            "clearance_information_type": null,
            "clearance_information": null,
            "change_default_shipping_address": "T",
            "wished_delivery_date": "2017-07-17",
            "use_fast_delivery_date": "F",
            "wished_delivery_time": {
                "start_hour": "08",
                "end_hour": "12"
            },
            "use_fast_delivery_time": "F"
        },
        {
            "shop_no": 1,
            "name": "Jane Kim",
            "name_furigana": "",
            "phone": "02-0000-0000",
            "cellphone": "010-0000-0000",
            "virtual_phone_no": "0500-0000-0000",
            "zipcode": "04312",
            "address1": "5, Hyochangwon-ro 70-gil, Yongsan-gu, Seoul, Republic of Korea",
            "address2": "2F, Shinwha Building",
            "address_state": "",
            "address_city": "",
            "address_street": "",
            "address_full": "5, Hyochangwon-ro 70-gil, Yongsan-gu, Seoul, Republic of Korea 2F, Shinwha Building",
            "name_en": "",
            "city_en": "",
            "state_en": "",
            "street_en": "",
            "country_code": "",
            "country_name": "",
            "country_name_en": "",
            "shipping_message": "Sample shipping message",
            "shipping_code": "D-20170710-0000013-01",
            "clearance_information_type": null,
            "clearance_information": null,
            "change_default_shipping_address": "F",
            "wished_delivery_date": "2017-07-17",
            "use_fast_delivery_date": "F",
            "wished_delivery_time": {
                "start_hour": "08",
                "end_hour": "12"
            },
            "use_fast_delivery_time": "F"
        }
    ]
}
```

### `PUT /api/v2/admin/orders/{order_id}/receivers/{shipping_code}` — Change shipping information

- **Scope**: `mall.write_order` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 1
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#change-shipping-information

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |
| `order_id` | ✓ | 주문번호 |  | 주문번호 |
| `shipping_code` | ✓ |  |  | 배송번호 |
| `name` |  | 최대글자수 : [20자] |  | 수령자명 |
| `phone` |  | 최대글자수 : [20자] |  | 수령자 일반 전화 |
| `cellphone` |  | 최대글자수 : [20자] |  | 수령자 휴대 전화 |
| `shipping_message` |  |  |  | 배송 메세지 |
| `name_furigana` |  |  |  | 수령자명 (발음) |
| `zipcode` |  | 최소글자수 : [2자]; 최대글자수 : [14자] |  | 우편번호 |
| `address1` |  | 최대글자수 : [255자] |  | 기본 주소 |
| `address2` |  | 최대글자수 : [255자] |  | 상세 주소 |
| `address_state` |  |  |  | 주/도 |
| `address_city` |  |  |  | 시/군/도시 |
| `name_en` |  |  |  | 수령자명 (영문) |
| `city_en` |  |  |  | 수령자 도시 (영문) |
| `state_en` |  |  |  | 수령자 주 (영문) |
| `street_en` |  |  |  | 수령자 주소 (영문) |
| `country_code` |  |  |  | 국가코드 |
| `clearance_information_type` |  |  |  | 통관정보 유형 I : 신분증 ID · P : 여권번호 · C : 개인통관고유부호 |
| `clearance_information` |  |  |  | 통관정보 |
| `change_default_shipping_address` |  |  | F | 기본배송지 변경 여부 T : 변경함 · F : 변경안함 |
| `virtual_phone_no` |  |  |  | 수령자 안심번호 복수 배송지 주문일 경우 수령자 안심번호 수정 불가 |
| `wished_delivery_date` |  | 날짜 |  | 희망배송일 |
| `use_fast_delivery_date` |  |  |  | 가능한 빠른 배송일 설정 여부 가능한 빠른 배송시간 설정 여부'가 'T' 일때는 null 로 응답함 T: 사용함 · F: 사용안함 |
| `wished_delivery_time` |  |  |  | 희망배송시간 희망배송 시작시간(start_hour) · 00~23 까지 입력 가능 · 희망배송 종료시간(end_hour) · 00~23 까지 입력 가능 |
| ↳ `start_hour` |  |  |  | 희망배송 시작시간 |
| ↳ `end_hour` |  |  |  | 희망배송 종료시간 |
| `use_fast_delivery_time` |  |  |  | 가능한 빠른 배송시간 설정 여부 가능한 빠른 배송일 설정 여부'가 'T' 일때는 null 로 응답함 T: 사용함 · F: 사용안함 |
| `receiver_direct_input_check` |  |  |  | 주소 직접입력 |

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `receiver` |  | (응답 객체) |
| ↳ `shop_no` | 최소값: [1] | 멀티쇼핑몰 번호 멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호. DEFAULT 1 |
| ↳ `name` |  | 수령자명 |
| ↳ `name_furigana` |  | 수령자명 (발음) |
| ↳ `phone` |  | 전화번호 |
| ↳ `cellphone` |  | 수령자 휴대 전화 |
| ↳ `virtual_phone_no` |  | 수령자 안심번호 |
| ↳ `zipcode` |  | 우편번호 |
| ↳ `address1` |  | 기본 주소 |
| ↳ `address2` |  | 상세 주소 |
| ↳ `address_state` |  | 주/도 |
| ↳ `address_city` |  | 시/군/도시 |
| ↳ `address_street` |  | 도로명 |
| ↳ `address_full` |  | 전체주소 |
| ↳ `name_en` |  | 수령자명 (영문) |
| ↳ `city_en` |  | 수령자 도시 (영문) |
| ↳ `state_en` |  | 수령자 주 (영문) |
| ↳ `street_en` |  | 수령자 주소 (영문) |
| ↳ `country_code` |  | 국가코드 |
| ↳ `country_name` |  | 국가명 |
| ↳ `country_name_en` |  | 국가명 (영문) |
| ↳ `shipping_message` |  | 배송 메세지 |
| ↳ `clearance_information_type` |  | 통관정보 유형 I : 신분증 ID · P : 여권번호 · C : 개인통관고유부호 |
| ↳ `clearance_information` |  | 통관정보 |
| ↳ `change_default_shipping_address` |  | 기본배송지 변경 여부 T : 변경함 · F : 변경안함 |
| ↳ `wished_delivery_date` |  | 희망배송일 |
| ↳ `use_fast_delivery_date` |  | 가능한 빠른 배송일 설정 여부 T: 사용함 · F: 사용안함 |
| ↳ `wished_delivery_time` |  | 희망배송시간 |
| ↳ ↳ `start_hour` |  |  |
| ↳ ↳ `end_hour` |  |  |
| ↳ `use_fast_delivery_time` |  | 가능한 빠른 배송시간 설정 여부 T: 사용함 · F: 사용안함 |

응답 예시 (JSON):

```json
{
    "receiver": {
        "shop_no": 1,
        "name": "John Doe",
        "name_furigana": "",
        "phone": "02-0000-0000",
        "cellphone": "010-0000-0000",
        "virtual_phone_no": "0500-0000-0000",
        "zipcode": "06258",
        "address1": "Sindaebang dong Dongjak-gu, Seoul, Republic of Korea",
        "address2": "Professional Construction Hall",
        "address_state": "",
        "address_city": "",
        "address_street": "",
        "address_full": "Sindaebang dong Dongjak-gu, Seoul, Republic of Korea Professional Construction Hall",
        "name_en": "",
        "city_en": "",
        "state_en": "",
        "street_en": "",
        "country_code": "",
        "country_name": "",
        "country_name_en": "",
        "shipping_message": "Sample shipping message",
        "clearance_information_type": null,
        "clearance_information": null,
        "change_default_shipping_address": "F",
        "wished_delivery_date": "2017-07-17",
        "use_fast_delivery_date": "F",
        "wished_delivery_time": {
            "start_hour": "08",
            "end_hour": "12"
        },
        "use_fast_delivery_time": "F"
    }
}
```
