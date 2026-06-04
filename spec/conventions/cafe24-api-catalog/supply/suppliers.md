---
resource: supply
entity: suppliers
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#suppliers
source: Cafe24 REST API Documentation (admin) — fields from full-page HTML; operation 응답 샘플은 code 엔드포인트 /docs/code/api/admin/shell/<entity>.json
---

# Cafe24 API — Supply / Suppliers

> Field-level 카탈로그. Endpoint enumeration index: [`../supply.md`](../supply.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Suppliers](https://developers.cafe24.com/docs/ko/api/admin/#suppliers)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

공급사(Suppliers)는 상품의 "제작정보" 중 공급사에 입력하는 정보를 의미합니다. · 공급사는 쇼핑몰에 물품을 공급하여 상품을 팔 수 있게 하는 회사 또는 개인을 의미합니다. · 공급사는 상품을 구분하는 판매분류의 하나이며, 상품은 반드시 하나의 공급사를 갖고 있습니다.(미지정시 "자체공급"을 사용함)

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `shop_no` |  | 멀티쇼핑몰 번호 멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호. |
| `supplier_code` |  | 공급사 코드 시스템이 부여한 공급사의 코드. 해당 쇼핑몰 내에서 공급사 코드는 중복되지 않는다. |
| `supplier_name` | 최대글자수 : [100자] | 공급사명 공급사의 이름. 공급사명은 쇼핑몰 관리자 화면에서 공급사를 구분할 수 있는 기본적인 정보이다. |
| `status` |  | 상태 해당 공급사와의 거래 현황 정보. A : 거래중 · P : 거래중지 · N : 거래해지 |
| `commission` |  | 수수료 정산유형이 수수료형(P)일 경우 사용하는 수수료 정보 |
| `payment_period` |  | 정산주기 공급사에 정산을 얼마나 자주할 것인지 설정할 수 있음. 0 : 선택안함 · C : 일일정산 · B : 주간정산 · A : 월간정산 |
| `business_item` | 최대글자수 : [255자] | 거래상품 유형 공급사와 거래하는 상품의 유형 정보. |
| `payment_type` |  | 정산유형 공급사에 지불할 금액을 어떤 유형으로 정산할 것인지 설정할 수 있음. · 수수료형 : 상품의 판매가격에 수수료를 책정하여 수수료 금액을 반영하여 정산함 · 매입형 : 상품 등록시 입력한 공급가격을 기준으로 정산함 P : 수수료형 · D : 매입형 |
| `supplier_type` |  | 공급사구조 공급사의 영업 형태. · 도매업체 : 최종 고객에게는 판매하지 않고 소매업체에 판매하는 업체 · 사입업체 : 도매업체로부터 물건을 구입해서 소매업체에 판매하는 업체 · 입점업체 : 쇼핑몰에 입점하여 판매중인 업체 WS : 도매업체 · SF : 사입업체 · BS : 입점업체 · ET : 기타 |
| `use_supplier` |  | 사용여부 해당 공급사를 사용하는지 여부 표시 T : 사용함 · F : 사용안함 |
| `created_date` |  | 등록일 공급사 정보가 등록된 날짜 |
| `updated_date` |  | 수정일 공급사 정보가 수정된 날짜 |
| `country_code` |  | 사업장 주소 국가 코드 |
| `zipcode` | 최대글자수 : [10자] | 우편번호 공급사의 사업장 주소 우편번호. |
| `address1` | 최대글자수 : [255자] | 기본 주소 공급사의 사업장 주소(시/군/구 단위 표기). |
| `address2` | 최대글자수 : [255자] | 상세 주소 공급사의 사업장 주소(상세 주소 표기). |
| `manager_information` |  | 담당자 공급사의 담당자 연락처 정보. 담당자는 세명까지 지정 가능하다. |
| `payment_start_day` | 최소: [0]~최대: [6] | 정산시작 요일 정산주기가 주간정산(B)일 경우 아래 요일에 따라 정산이 진행됨. · 0 : 일요일마다 정산 진행 · 1 : 월요일마다 정산 진행 · 2 : 화요일마다 정산 진행 · 3 : 수요일마다 정산 진행 · 4 : 목요일마다 정산 진행 · 5 : 금요일마다 정산 진행 · 6 : 토요일마다 정산 진행 0 : 일요일 · 1 : 월요일 · 2 : 화요일 · 3 : 수요일 · 4 : 목요일 · 5 : 금요일 · 6 : 토요일 |
| `payment_end_day` | 최소: [0]~최대: [6] | 정산종료 요일 정산주기가 주간정산(B)일 경우 아래 요일에 따라 정산이 진행됨. · 0 : 일요일마다 정산 진행 · 1 : 월요일마다 정산 진행 · 2 : 화요일마다 정산 진행 · 3 : 수요일마다 정산 진행 · 4 : 목요일마다 정산 진행 · 5 : 금요일마다 정산 진행 · 6 : 토요일마다 정산 진행 0 : 일요일 · 1 : 월요일 · 2 : 화요일 · 3 : 수요일 · 4 : 목요일 · 5 : 금요일 · 6 : 토요일 |
| `payment_start_date` | 최소: [1]~최대: [31] | 정산시작 일 정산주기가 월간정산(A)일 경우 해당 일자를 정산시작 일로 정함. |
| `payment_end_date` | 최소: [1]~최대: [31] | 정산종료 일 정산주기가 월간정산(A)일 경우 해당 일자를 정산종료 일로 정함. |
| `trading_type` |  | 공급사유형 상품이 공급사에서 배송되는 형태. · 사입 : 상품을 판매자가 구입하여 구매자에게 배송함. · 직배송 : 상품에 주문이 들어오면 공급사가 구매자에게 바로 배송함. D : 사입 · C : 직배송 |
| `bank_code` | 최대글자수 : [50자] | 은행코드 공급사 정산시 사용하는 계좌의 입금은행 코드 · bank_code |
| `bank_account_no` |  | 계좌번호 공급사 정산시 사용하는 계좌의 계좌 번호 |
| `bank_account_name` |  | 예금주 공급사 정산시 사용하는 계좌의 예금주 명 |
| `president_name` |  | 대표자명 사업자 등록시 공급사에서 등록한 대표자명 |
| `company_registration_no` | 최대글자수 : [12자] | 사업자등록번호 해당 공급사의 사업자 등록 번호. 국가에 따라 해당 사업자의 등록 고유 번호가 발급되는 경우 표시한다. |
| `company_name` |  | 상호명 사업자 등록시 공급사에서 등록한 상호명 |
| `company_condition` |  | 업태 사업자 등록시 공급사에서 등록한 업태 |
| `company_line` |  | 종목 사업자 등록시 공급사에서 등록한 종목 |
| `phone` | 최대글자수 : [20자] | 전화번호 공급사의 사업장 전화번호. |
| `fax` | 최대글자수 : [20자] | 팩스번호 공급사의 사업장 팩스번호. |
| `payment_method` |  | 정산시기 정산이 되는 기준 시점. · 10 : 결제완료 · 30 : 배송시작 · 40 : 배송완료 10 : 결제완료 · 30 : 배송시작 · 40 : 배송완료 |
| `market_country_code` |  | 시장 주소 국가 코드 |
| `market_zipcode` | 최대글자수 : [10자] | 시장주소 우편번호 |
| `market_address1` |  | 시장 기본 주소 |
| `market_address2` |  | 시장 상세 주소 |
| `exchange_country_code` |  | 반품 주소 국가 코드 |
| `exchange_zipcode` | 최대글자수 : [10자] | 반품주소 우편번호 |
| `exchange_address1` | 최대글자수 : [255자] | 반품 기본 주소 |
| `exchange_address2` | 최대글자수 : [255자] | 반품 상세 주소 |
| `homepage_url` | 최대글자수 : [100자] | 홈페이지 주소 |
| `mall_url` | 최대글자수 : [100자] | 쇼핑몰 주소 |
| `account_start_date` | 최대글자수 : [10자] | 거래개시일 |
| `account_stop_date` | 최대글자수 : [10자] | 거래중지일 |
| `show_supplier_info` | 최대글자수 : [100자] | 공급사정보 표시 SP : 전화번호 · SM : 사업장주소 · MA : 시장주소 · EA : 반품주소 · MN : 담당자명 · MI : 담당자연락처 |
| `memo` | 최대글자수 : [255자] | 메모 해당 공급사에 대한 관리용 메모 |
| `company_introduction` |  | 회사소개 공급사에 대한 간략한 소개 표시. 쇼핑몰의 회사 소개 화면에 표시된다. |

## Operations

### `GET /api/v2/admin/suppliers` — Retrieve a list of suppliers

- **Scope**: `mall.read_supply` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-suppliers

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호. |
| `supplier_code` |  |  |  | 공급사 코드 시스템이 부여한 공급사의 코드. 해당 쇼핑몰 내에서 공급사 코드는 중복되지 않는다. ,(콤마)로 여러 건을 검색할 수 있다. |
| `supplier_name` |  |  |  | 공급사명 공급사의 이름. 공급사명은 쇼핑몰 관리자 화면에서 공급사를 구분할 수 있는 기본적인 정보이다. ,(콤마)로 여러 건을 검색할 수 있다. |
| `offset` |  | 최대값: [8000] | 0 | 조회결과 시작위치 |
| `limit` |  | 최소: [1]~최대: [100] | 10 | 조회결과 최대건수 조회하고자 하는 최대 건수를 지정할 수 있음. · 예) 10 입력시 10건만 표시함. |

#### 응답 (Response)

> Cafe24 공식 docs 의 대표 응답 샘플. 실제 필드 정의는 위 [응답 속성](#응답-속성-property-list) 참조.

```json
{
    "suppliers": [
        {
            "shop_no": 1,
            "supplier_code": "S0000000",
            "supplier_name": "Supply Name",
            "status": "A",
            "commission": "0.00",
            "payment_period": "A",
            "business_item": "Online Shop",
            "payment_type": "D",
            "supplier_type": "WS",
            "use_supplier": "T",
            "created_date": "",
            "updated_date": "2018-09-04T13:42:04+09:00",
            "country_code": "KOR",
            "zipcode": "07071",
            "address1": "Sindaebang dong Dongjak-gu, Seoul, Republic of Korea",
            "address2": "Professional Construction Hall",
            "manager_information": [
                {
                    "no": 1,
                    "name": "John Doe",
                    "phone": "010-0000-0001",
                    "email": "sample@sample.com",
                    "use_sms": "F"
                },
                {
                    "no": 2,
                    "name": "Jane Doe",
                    "phone": "010-0000-0002",
                    "email": "sample@sample.com",
                    "use_sms": "F"
                }
            ],
            "payment_start_day": null,
            "payment_end_day": null,
            "payment_start_date": 1,
            "payment_end_date": 2,
            "trading_type": "D",
            "bank_code": "bank_04",
            "bank_account_no": "000-0000-00000",
            "bank_account_name": "Acoount Name",
            "company_registration_no": "118-81-20586",
            "president_name": "Representative name",
            "company_name": "Company Name",
            "company_condition": "Industry",
            "company_line": "Online",
            "phone": "010-0000-0000",
            "fax": "02-0000-0000"
        },
        {
            "shop_no": 1,
            "supplier_code": "S000000A",
            "supplier_name": "Supply Name",
            "status": "A",
            "commission": "10.00",
            "payment_period": "0",
            "business_item": "Online Shop",
            "payment_type": "P",
            "supplier_type": "WS",
            "use_supplier": "T",
            "created_date": "2018-09-04T13:42:04+09:00",
            "updated_date": "",
            "country_code": "KOR",
            "zipcode": "07071",
            "address1": "Sindaebang dong Dongjak-gu, Seoul, Republic of Korea",
            "address2": "Professional Construction Hall",
            "manager_information": [
                {
                    "no": 1,
                    "name": "John Doe",
                    "phone": "010-0000-0001",
                    "email": "sample@sample.com",
                    "use_sms": "F"
                },
                {
                    "no": 2,
                    "name": "Jane Doe",
                    "phone": "010-0000-0002",
                    "email": "sample@sample.com",
                    "use_sms": "F"
                }
            ],
            "payment_start_day": null,
            "payment_end_day": null,
            "payment_start_date": 9,
            "payment_end_date": 30,
            "trading_type": "C",
            "bank_code": "bank_05",
            "bank_account_no": "000-0000-00001",
            "bank_account_name": "Acoount Name",
            "company_registration_no": "118-81-20586",
            "president_name": "Representative name",
            "company_name": "Company Name",
            "company_condition": "Industry",
            "company_line": "Online",
            "phone": "010-0000-0000",
            "fax": "02-0000-0000"
        }
    ]
}
```

### `GET /api/v2/admin/suppliers/count` — Retrieve a count of suppliers

- **Scope**: `mall.read_supply` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-count-of-suppliers

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호. |
| `supplier_code` |  |  |  | 공급사 코드 시스템이 부여한 공급사의 코드. 해당 쇼핑몰 내에서 공급사 코드는 중복되지 않는다. ,(콤마)로 여러 건을 검색할 수 있다. |
| `supplier_name` |  |  |  | 공급사명 공급사의 이름. 공급사명은 쇼핑몰 관리자 화면에서 공급사를 구분할 수 있는 기본적인 정보이다. ,(콤마)로 여러 건을 검색할 수 있다. |

#### 응답 (Response)

> Cafe24 공식 docs 의 대표 응답 샘플. 실제 필드 정의는 위 [응답 속성](#응답-속성-property-list) 참조.

```json
{
    "count": 3
}
```

### `GET /api/v2/admin/suppliers/{supplier_code}` — Retrieve a supplier

- **Scope**: `mall.read_supply` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-supplier

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호. |
| `supplier_code` | ✓ |  |  | 공급사 코드 시스템이 부여한 공급사의 코드. 해당 쇼핑몰 내에서 공급사 코드는 중복되지 않는다. |

#### 응답 (Response)

> Cafe24 공식 docs 의 대표 응답 샘플. 실제 필드 정의는 위 [응답 속성](#응답-속성-property-list) 참조.

```json
{
    "supplier": {
        "shop_no": 1,
        "supplier_name": "Default Supplier",
        "supplier_code": "S0000000",
        "use_supplier": "T",
        "trading_type": "D",
        "supplier_type": "WS",
        "status": "A",
        "business_item": "Default Product Type",
        "payment_type": "D",
        "commission": "0.00",
        "payment_period": "A",
        "payment_method": 30,
        "payment_start_day": null,
        "payment_end_day": null,
        "payment_start_date": 9,
        "payment_end_date": 30,
        "bank_code": "bank_04",
        "bank_account_no": "000-0000-00000",
        "bank_account_name": "Acoount Name",
        "phone": "010-0000-0000",
        "fax": "02-0000-0000",
        "country_code": "KOR",
        "zipcode": "07071",
        "address1": "Sindaebang dong Dongjak-gu, Seoul, Republic of Korea",
        "address2": "Professional Construction Hall",
        "market_country_code": "KOR",
        "market_zipcode": "07071",
        "market_address1": "Sindaebang dong Dongjak-gu, Seoul, Republic of Korea",
        "market_address2": "Professional Construction Hall",
        "exchange_country_code": "KOR",
        "exchange_zipcode": "07071",
        "exchange_address1": "Sindaebang dong Dongjak-gu, Seoul, Republic of Korea",
        "exchange_address2": "Professional Construction Hall",
        "homepage_url": "sample.sample.com",
        "mall_url": "sample.sample.com",
        "manager_information": [
            {
                "no": 1,
                "name": "John Doe",
                "phone": "010-0000-0001",
                "email": "sample@sample.com",
                "use_sms": "F"
            },
            {
                "no": 2,
                "name": "Jane Doe",
                "phone": "010-0000-0002",
                "email": "sample@sample.com",
                "use_sms": "F"
            },
            {
                "no": 3,
                "name": "Jane Doe",
                "phone": "010-0000-0003",
                "email": "sample@sample.com",
                "use_sms": "F"
            }
        ],
        "account_start_date": "2018-01-01",
        "account_stop_date": "2018-01-02",
        "show_supplier_info": "SP,SM",
        "memo": "Memo Description",
        "company_registration_no": "118-81-20586",
        "company_name": "Company Name",
        "president_name": "Representative name",
        "company_condition": "Industry",
        "company_line": "Online",
        "company_introduction": "About company."
    }
}
```

### `POST /api/v2/admin/suppliers` — Create a supplier

- **Scope**: `mall.write_supply` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 1
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#create-a-supplier

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호. |
| `supplier_name` | ✓ | 최대글자수 : [50자] |  | 공급사명 공급사의 이름. 공급사명은 쇼핑몰 관리자 화면에서 공급사를 구분할 수 있는 기본적인 정보이다. |
| `manager_information` |  | 배열 최대사이즈: [3] |  | 담당자 담당자는 최대 세명까지 입력할 수 있다. |
| ↳ `no` | ✓ |  |  | 담당자 일련번호 |
| ↳ `name` | ✓ |  |  | 담당자 이름 |
| ↳ `phone` |  |  |  | 담당자 연락처 |
| ↳ `email` |  |  |  | 담당자 이메일 |
| `use_supplier` |  |  | T | 사용여부 해당 공급사를 사용하는지 여부 표시 T : 사용함 · F : 사용안함 |
| `trading_type` |  |  | D | 공급사유형 상품이 공급사에서 배송되는 형태. · 사입 : 상품을 판매자가 구입하여 구매자에게 배송함. · 직배송 : 상품에 주문이 들어오면 공급사가 구매자에게 바로 배송함. D : 사입 · C : 직배송 |
| `supplier_type` |  |  | WS | 공급사구조 공급사의 영업 형태. · 도매업체 : 최종 고객에게는 판매하지 않고 소매업체에 판매하는 업체 · 사입업체 : 도매업체로부터 물건을 구입해서 소매업체에 판매하는 업체 · 입점업체 : 쇼핑몰에 입점하여 판매중인 업체 WS : 도매업체 · SF : 사입업체 · BS : 입점업체 · ET : 기타 |
| `status` |  |  | A | 상태 해당 공급사와의 거래 현황 정보. A : 거래중 · P : 거래중지 · N : 거래해지 |
| `business_item` |  | 최대글자수 : [255자] |  | 거래상품 유형 공급사와 거래하는 상품의 유형 정보. |
| `payment_type` |  |  | P | 정산유형 공급사에 지불할 금액을 어떤 유형으로 정산할 것인지 설정할 수 있음. · 수수료형 : 상품의 판매가격에 수수료를 책정하여 수수료 금액을 반영하여 정산함 · 매입형 : 상품 등록시 입력한 공급가격을 기준으로 정산함 P : 수수료형 · D : 매입형 |
| `payment_period` |  |  | 0 | 정산주기 공급사에 정산을 얼마나 자주할 것인지 설정할 수 있음. 0 : 선택안함 · C : 일일정산 · B : 주간정산 · A : 월간정산 |
| `payment_method` |  |  |  | 정산시기 정산이 되는 기준 시점. · 10 : 결제완료 · 30 : 배송시작 · 40 : 배송완료 10 : 결제완료 · 30 : 배송시작 · 40 : 배송완료 |
| `payment_start_day` |  | 최소: [0]~최대: [6] |  | 정산시작 요일 정산주기가 주간정산(B)일 경우 아래 요일에 따라 정산이 진행됨. · 0 : 일요일마다 정산 진행 · 1 : 월요일마다 정산 진행 · 2 : 화요일마다 정산 진행 · 3 : 수요일마다 정산 진행 · 4 : 목요일마다 정산 진행 · 5 : 금요일마다 정산 진행 · 6 : 토요일마다 정산 진행 0 : 일요일 · 1 : 월요일 · 2 : 화요일 · 3 : 수요일 · 4 : 목요일 · 5 : 금요일 · 6 : 토요일 |
| `payment_end_day` |  | 최소: [0]~최대: [6] |  | 정산종료 요일 정산주기가 주간정산(B)일 경우 아래 요일에 따라 정산이 진행됨. · 0 : 일요일마다 정산 진행 · 1 : 월요일마다 정산 진행 · 2 : 화요일마다 정산 진행 · 3 : 수요일마다 정산 진행 · 4 : 목요일마다 정산 진행 · 5 : 금요일마다 정산 진행 · 6 : 토요일마다 정산 진행 0 : 일요일 · 1 : 월요일 · 2 : 화요일 · 3 : 수요일 · 4 : 목요일 · 5 : 금요일 · 6 : 토요일 |
| `payment_start_date` |  | 최소: [1]~최대: [31] |  | 정산시작 일 정산주기가 월간정산(A)일 경우 해당 일자를 정산시작 일로 정함. |
| `payment_end_date` |  | 최소: [1]~최대: [31] |  | 정산종료 일 정산주기가 월간정산(A)일 경우 해당 일자를 정산종료 일로 정함. |
| `commission` |  |  | 10 | 수수료율 정산유형이 수수료형(P)일 경우 사용하는 수수료 정보 |
| `phone` |  | 최대글자수 : [20자]; 전화번호 |  | 전화번호 공급사의 사업장 전화번호. |
| `fax` |  | 최대글자수 : [20자]; 전화번호 |  | 팩스번호 공급사의 사업장 팩스번호. |
| `country_code` |  |  |  | 사업장 주소 국가 코드 |
| `zipcode` |  | 최대글자수 : [10자] |  | 우편번호 공급사의 사업장 주소 우편번호. |
| `address1` |  | 최대글자수 : [255자] |  | 기본 주소 공급사의 사업장 주소(시/군/구 단위 표기). |
| `address2` |  | 최대글자수 : [255자] |  | 상세 주소 공급사의 사업장 주소(상세 주소 표기). |
| `market_country_code` |  |  |  | 시장 주소 국가 코드 |
| `market_zipcode` |  | 최대글자수 : [10자] |  | 시장주소 우편번호 |
| `market_address1` |  |  |  | 시장 기본 주소 |
| `market_address2` |  |  |  | 시장 상세 주소 |
| `exchange_country_code` |  |  |  | 반품 주소 국가 코드 |
| `exchange_zipcode` |  | 최대글자수 : [10자] |  | 반품주소 우편번호 |
| `exchange_address1` |  | 최대글자수 : [255자] |  | 반품 기본 주소 |
| `exchange_address2` |  | 최대글자수 : [255자] |  | 반품 상세 주소 |
| `homepage_url` |  | 최대글자수 : [100자] |  | 홈페이지 주소 |
| `mall_url` |  | 최대글자수 : [100자] |  | 쇼핑몰 주소 |
| `account_start_date` |  | 최대글자수 : [10자]; 날짜 |  | 거래개시일 |
| `account_stop_date` |  | 최대글자수 : [10자]; 날짜 |  | 거래중지일 |
| `memo` |  | 최대글자수 : [255자] |  | 메모 해당 공급사에 대한 관리용 메모 |
| `company_registration_no` |  | 최대글자수 : [12자]; 사업자번호 |  | 사업자등록번호 해당 공급사의 사업자 등록 번호. 국가에 따라 해당 사업자의 등록 고유 번호가 발급되는 경우 표시한다. |
| `company_name` |  | 최대글자수 : [30자] |  | 상호명 사업자 등록시 공급사에서 등록한 상호명 |
| `president_name` |  | 최대글자수 : [20자] |  | 대표자명 사업자 등록시 공급사에서 등록한 대표자명 |
| `company_condition` |  | 최대글자수 : [20자] |  | 업태 사업자 등록시 공급사에서 등록한 업태 |
| `company_line` |  | 최대글자수 : [20자] |  | 종목 사업자 등록시 공급사에서 등록한 종목 |
| `company_introduction` |  |  |  | 회사소개 공급사에 대한 간략한 소개 표시. 쇼핑몰의 회사 소개 화면에 표시된다. |

#### 응답 (Response)

> Cafe24 공식 docs 의 대표 응답 샘플. 실제 필드 정의는 위 [응답 속성](#응답-속성-property-list) 참조.

```json
{
    "supplier": {
        "shop_no": 1,
        "supplier_name": "Default Supplier",
        "supplier_code": "S000000J",
        "use_supplier": "T",
        "trading_type": "D",
        "supplier_type": "WS",
        "status": "A",
        "business_item": "Default Product Type",
        "payment_type": "D",
        "commission": "0.00",
        "payment_period": "A",
        "payment_method": "30",
        "payment_start_date": 9,
        "payment_end_date": 30,
        "payment_start_day": null,
        "payment_end_day": null,
        "bank_code": null,
        "bank_account_no": "",
        "bank_account_name": "",
        "phone": "010-0000-0000",
        "fax": "02-0000-0000",
        "country_code": "KOR",
        "zipcode": "07071",
        "address1": "Sindaebang dong Dongjak-gu, Seoul, Republic of Korea",
        "address2": "Professional Construction Hall",
        "market_country_code": "KOR",
        "market_zipcode": "07071",
        "market_address1": "Sindaebang dong Dongjak-gu, Seoul, Republic of Korea",
        "market_address2": "Professional Construction Hall",
        "exchange_country_code": "KOR",
        "exchange_zipcode": "07071",
        "exchange_address1": "Sindaebang dong Dongjak-gu, Seoul, Republic of Korea",
        "exchange_address2": "Professional Construction Hall",
        "homepage_url": "sample.sample.com",
        "mall_url": "sample.sample.com",
        "manager_information": [
            {
                "no": 1,
                "name": "John Doe",
                "phone": "010-0000-0001",
                "email": "sample@sample.com",
                "use_sms": null
            },
            {
                "no": 2,
                "name": "Jane Doe",
                "phone": "010-0000-0002",
                "email": "sample@sample.com",
                "use_sms": null
            },
            {
                "no": 3,
                "name": "Jane Doe",
                "phone": "010-0000-0003",
                "email": "sample@sample.com",
                "use_sms": null
            }
        ],
        "account_start_date": "2018-01-01",
        "account_stop_date": "2018-01-02",
        "show_supplier_info": "SP,SM",
        "memo": "Memo Description",
        "company_registration_no": "118-81-20586",
        "company_name": "Company Name",
        "president_name": "Representative name",
        "company_condition": "Industry",
        "company_line": "Online",
        "company_introduction": "About company."
    }
}
```

### `PUT /api/v2/admin/suppliers/{supplier_code}` — Update a supplier

- **Scope**: `mall.write_supply` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 1
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#update-a-supplier

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호. |
| `supplier_code` | ✓ | 형식 : [A-Z0-9]; 글자수 최소: [8자]~최대: [8자] |  | 공급사 코드 시스템이 부여한 공급사의 코드. 해당 쇼핑몰 내에서 공급사 코드는 중복되지 않는다. |
| `supplier_name` |  | 최대글자수 : [50자] |  | 공급사명 공급사의 이름. 공급사명은 쇼핑몰 관리자 화면에서 공급사를 구분할 수 있는 기본적인 정보이다. |
| `use_supplier` |  |  |  | 사용여부 해당 공급사를 사용하는지 여부 표시 T : 사용함 · F : 사용안함 |
| `trading_type` |  |  |  | 공급사유형 상품이 공급사에서 배송되는 형태. · 사입 : 상품을 판매자가 구입하여 구매자에게 배송함. · 직배송 : 상품에 주문이 들어오면 공급사가 구매자에게 바로 배송함. D : 사입 · C : 직배송 |
| `supplier_type` |  |  |  | 공급사구조 공급사의 영업 형태. · 도매업체 : 최종 고객에게는 판매하지 않고 소매업체에 판매하는 업체 · 사입업체 : 도매업체로부터 물건을 구입해서 소매업체에 판매하는 업체 · 입점업체 : 쇼핑몰에 입점하여 판매중인 업체 WS : 도매업체 · SF : 사입업체 · BS : 입점업체 · ET : 기타 |
| `status` |  |  |  | 상태 해당 공급사와의 거래 현황 정보. A : 거래중 · P : 거래중지 · N : 거래해지 |
| `payment_type` |  |  |  | 정산유형 공급사에 지불할 금액을 어떤 유형으로 정산할 것인지 설정할 수 있음. · 수수료형 : 상품의 판매가격에 수수료를 책정하여 수수료 금액을 반영하여 정산함 · 매입형 : 상품 등록시 입력한 공급가격을 기준으로 정산함 P : 수수료형 · D : 매입형 |
| `payment_period` |  |  |  | 정산주기 공급사에 정산을 얼마나 자주할 것인지 설정할 수 있음. 0 : 선택안함 · C : 일일정산 · B : 주간정산 · A : 월간정산 |
| `commission` |  |  |  | 수수료율 정산유형이 수수료형(P)일 경우 사용하는 수수료 정보 |
| `manager_information` |  | 배열 최대사이즈: [3] |  | 담당자 담당자는 세명까지 지정할 수 있으며, "no"를 통해 특정 담당자를 지정하여 정보를 수정할 수 있다. |
| ↳ `no` | ✓ |  |  | 담당자 일련번호 |
| ↳ `name` | ✓ |  |  | 담당자 이름 |
| ↳ `phone` |  |  |  | 담당자 연락처 |
| ↳ `email` |  |  |  | 담당자 이메일 |
| ↳ `use_sms` |  |  |  | 모바일 메시지 수신여부 · T : 수신 · F : 수신안함 |
| `business_item` |  | 최대글자수 : [255자] |  | 거래상품 유형 공급사와 거래하는 상품의 유형 정보. |
| `payment_method` |  |  |  | 정산시기 정산이 되는 기준 시점. · 10 : 결제완료 · 30 : 배송시작 · 40 : 배송완료 10 : 결제완료 · 30 : 배송시작 · 40 : 배송완료 |
| `payment_start_day` |  | 최소: [0]~최대: [6] |  | 정산시작 요일 정산주기가 주간정산(B)일 경우 아래 요일에 따라 정산이 진행됨. · 0 : 일요일마다 정산 진행 · 1 : 월요일마다 정산 진행 · 2 : 화요일마다 정산 진행 · 3 : 수요일마다 정산 진행 · 4 : 목요일마다 정산 진행 · 5 : 금요일마다 정산 진행 · 6 : 토요일마다 정산 진행 0 : 일요일 · 1 : 월요일 · 2 : 화요일 · 3 : 수요일 · 4 : 목요일 · 5 : 금요일 · 6 : 토요일 |
| `payment_end_day` |  | 최소: [0]~최대: [6] |  | 정산종료 요일 정산주기가 주간정산(B)일 경우 아래 요일에 따라 정산이 진행됨. · 0 : 일요일마다 정산 진행 · 1 : 월요일마다 정산 진행 · 2 : 화요일마다 정산 진행 · 3 : 수요일마다 정산 진행 · 4 : 목요일마다 정산 진행 · 5 : 금요일마다 정산 진행 · 6 : 토요일마다 정산 진행 0 : 일요일 · 1 : 월요일 · 2 : 화요일 · 3 : 수요일 · 4 : 목요일 · 5 : 금요일 · 6 : 토요일 |
| `payment_start_date` |  | 최소: [1]~최대: [31] |  | 정산시작 일 정산주기가 월간정산(A)일 경우 해당 일자를 정산시작 일로 정함. |
| `payment_end_date` |  | 최소: [1]~최대: [31] |  | 정산종료 일 정산주기가 월간정산(A)일 경우 해당 일자를 정산종료 일로 정함. |
| `phone` |  | 최대글자수 : [20자]; 전화번호 |  | 전화번호 공급사의 사업장 전화번호. |
| `fax` |  | 최대글자수 : [20자]; 전화번호 |  | 팩스번호 공급사의 사업장 팩스번호. |
| `country_code` |  |  |  | 사업장 주소 국가 코드 |
| `zipcode` |  | 최대글자수 : [10자] |  | 우편번호 공급사의 사업장 주소 우편번호. |
| `address1` |  | 최대글자수 : [255자] |  | 기본 주소 공급사의 사업장 주소(시/군/구 단위 표기). |
| `address2` |  | 최대글자수 : [255자] |  | 상세 주소 공급사의 사업장 주소(상세 주소 표기). |
| `market_country_code` |  |  |  | 시장 주소 국가 코드 |
| `market_zipcode` |  | 최대글자수 : [10자] |  | 시장주소 우편번호 |
| `market_address1` |  |  |  | 시장 기본 주소 |
| `market_address2` |  |  |  | 시장 상세 주소 |
| `exchange_country_code` |  |  |  | 반품 주소 국가 코드 |
| `exchange_zipcode` |  | 최대글자수 : [10자] |  | 반품주소 우편번호 |
| `exchange_address1` |  | 최대글자수 : [255자] |  | 반품 기본 주소 |
| `exchange_address2` |  | 최대글자수 : [255자] |  | 반품 상세 주소 |
| `homepage_url` |  | 최대글자수 : [100자] |  | 홈페이지 주소 |
| `mall_url` |  | 최대글자수 : [100자] |  | 쇼핑몰 주소 |
| `account_start_date` |  | 최대글자수 : [10자]; 날짜 |  | 거래개시일 |
| `account_stop_date` |  | 최대글자수 : [10자]; 날짜 |  | 거래중지일 |
| `memo` |  | 최대글자수 : [255자] |  | 메모 해당 공급사에 대한 관리용 메모 |
| `company_registration_no` |  | 최대글자수 : [12자]; 사업자번호 |  | 사업자등록번호 해당 공급사의 사업자 등록 번호. 국가에 따라 해당 사업자의 등록 고유 번호가 발급되는 경우 표시한다. |
| `company_name` |  | 최대글자수 : [30자] |  | 상호명 사업자 등록시 공급사에서 등록한 상호명 |
| `president_name` |  | 최대글자수 : [20자] |  | 대표자명 사업자 등록시 공급사에서 등록한 대표자명 |
| `company_condition` |  | 최대글자수 : [20자] |  | 업태 사업자 등록시 공급사에서 등록한 업태 |
| `company_line` |  | 최대글자수 : [20자] |  | 종목 사업자 등록시 공급사에서 등록한 종목 |
| `company_introduction` |  |  |  | 회사소개 공급사에 대한 간략한 소개 표시. 쇼핑몰의 회사 소개 화면에 표시된다. |

#### 응답 (Response)

> Cafe24 공식 docs 의 대표 응답 샘플. 실제 필드 정의는 위 [응답 속성](#응답-속성-property-list) 참조.

```json
{
    "supplier": {
        "shop_no": 1,
        "supplier_name": "Default Supplier",
        "supplier_code": "S000000J",
        "use_supplier": "T",
        "trading_type": "D",
        "supplier_type": "WS",
        "status": "A",
        "business_item": "Default Product Type",
        "payment_type": "D",
        "commission": "0.00",
        "payment_period": "A",
        "payment_method": 30,
        "payment_start_date": 9,
        "payment_end_date": 30,
        "payment_start_day": null,
        "payment_end_day": null,
        "bank_code": "bank_04",
        "bank_account_no": "000-0000-00000",
        "bank_account_name": "Acoount Name",
        "phone": "010-0000-0000",
        "fax": "02-0000-0000",
        "country_code": "KOR",
        "zipcode": "07071",
        "address1": "Sindaebang dong Dongjak-gu, Seoul, Republic of Korea",
        "address2": "Professional Construction Hall",
        "market_country_code": "KOR",
        "market_zipcode": "07071",
        "market_address1": "Sindaebang dong Dongjak-gu, Seoul, Republic of Korea",
        "market_address2": "Professional Construction Hall",
        "exchange_country_code": "KOR",
        "exchange_zipcode": "07071",
        "exchange_address1": "Sindaebang dong Dongjak-gu, Seoul, Republic of Korea",
        "exchange_address2": "Professional Construction Hall",
        "homepage_url": "sample.sample.com",
        "mall_url": "sample.sample.com",
        "manager_information": [
            {
                "no": 1,
                "name": "John Doe",
                "phone": "010-0000-0001",
                "email": "sample@sample.com",
                "use_sms": "F"
            },
            {
                "no": 2,
                "name": "Jane Doe",
                "phone": "010-0000-0002",
                "email": "sample@sample.com",
                "use_sms": "F"
            },
            {
                "no": 3,
                "name": "Jane Doe",
                "phone": "010-0000-0003",
                "email": "sample@sample.com",
                "use_sms": "F"
            }
        ],
        "account_start_date": "2018-01-01",
        "account_stop_date": "2018-01-02",
        "show_supplier_info": "SP,SM",
        "memo": "Memo Description",
        "company_registration_no": "118-81-20586",
        "company_name": "Company Name",
        "president_name": "Representative name",
        "company_condition": "Industry",
        "company_line": "Online",
        "company_introduction": "About company."
    }
}
```

### `DELETE /api/v2/admin/suppliers/{supplier_code}` — Delete a supplier

- **Scope**: `mall.write_supply` (write)
- **호출건수 제한**: 40
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#delete-a-supplier

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `supplier_code` | ✓ | 형식 : [A-Z0-9]; 글자수 최소: [8자]~최대: [8자] |  | 공급사 코드 |

#### 응답 (Response)

> Cafe24 공식 docs 의 대표 응답 샘플. 실제 필드 정의는 위 [응답 속성](#응답-속성-property-list) 참조.

```json
{
    "supplier": {
        "supplier_code": "S000000J"
    }
}
```
