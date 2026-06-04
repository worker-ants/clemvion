---
resource: store
entity: kakaopay-setting
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#kakaopay-setting
source: Cafe24 REST API Documentation (admin) — fields from full-page HTML; operation 응답 샘플은 code 엔드포인트 /docs/code/api/admin/shell/<entity>.json
---

# Cafe24 API — Store / Kakaopay setting

> Field-level 카탈로그. Endpoint enumeration index: [`../store.md`](../store.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Kakaopay setting](https://developers.cafe24.com/docs/ko/api/admin/#kakaopay-setting)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

쇼핑몰의 카카오페이 설정을 조회하거나 수정할 수 있습니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `shop_no` |  | 멀티쇼핑몰 번호 |
| `shop_key` |  | 입점시 부여 받는 판매점의 고유 식별자 |
| `pixel_code` |  | 연동사(ECP/독립몰)에서 이미 사용중인 카카오 광고 픽셀 ID |
| `use_kakaopay` |  | 카카오페이 구매 사용여부 T : 사용함 · F : 사용안함 |
| `product_detail_button_size` |  | 쇼핑몰 상세상품 페이지 버튼 사이즈 |
| `basket_button_size` |  | 쇼핑몰 장바구니 페이지 버튼 사이즈 |
| `use_dark_mode` |  | 쇼핑몰 다크모드 적용여부 T : 활성화 · F : 비활성화 |
| `button_authorization_key` |  | 입점시 부여 받는 판매점의 버튼 인증 |
| `thirdparty_agree` |  | 제3자 제공 동의 여부 T : 동의함 · F : 동의안함 |
| `thirdparty_agree_date` |  | 제3자 제공 동의 날짜 |

## Operations

### `GET /api/v2/admin/kakaopay/setting` — Retrieve settings for KakaoPay orders

- **Scope**: `mall.read_store` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-settings-for-kakaopay-orders

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `kakaopay` |  | (응답 객체) |
| ↳ `shop_no` |  | 멀티쇼핑몰 번호 |
| ↳ `shop_key` |  | 입점시 부여 받는 판매점의 고유 식별자 |
| ↳ `pixel_code` |  | 연동사(ECP/독립몰)에서 이미 사용중인 카카오 광고 픽셀 ID |
| ↳ `use_kakaopay` |  | 카카오페이 구매 사용여부 T : 사용함 · F : 사용안함 |
| ↳ `product_detail_button_size` |  | 쇼핑몰 상세상품 페이지 버튼 사이즈 |
| ↳ ↳ `pc` |  |  |
| ↳ ↳ `mobile` |  |  |
| ↳ `basket_button_size` |  | 쇼핑몰 장바구니 페이지 버튼 사이즈 |
| ↳ ↳ `pc` |  |  |
| ↳ ↳ `mobile` |  |  |
| ↳ `use_dark_mode` |  | 쇼핑몰 다크모드 적용여부 T : 활성화 · F : 비활성화 |
| ↳ `button_authorization_key` |  | 입점시 부여 받는 판매점의 버튼 인증 |
| ↳ `thirdparty_agree` |  | 제3자 제공 동의 여부 T : 동의함 · F : 동의안함 |
| ↳ `thirdparty_agree_date` |  | 제3자 제공 동의 날짜 |

응답 예시 (JSON):

```json
{
    "kakaopay": {
        "shop_no": 1,
        "shop_key": "S12345",
        "pixel_code": "653867785974233605",
        "use_kakaopay": "T",
        "product_detail_button_size": {
            "pc": "210x83",
            "mobile": "290x95"
        },
        "basket_button_size": {
            "pc": "210x83",
            "mobile": "290x95"
        },
        "use_dark_mode": "T",
        "button_authorization_key": "dummy_12345",
        "thirdparty_agree": "T",
        "thirdparty_agree_date": "2021-07-15T17:59:00+09:00"
    }
}
```

### `PUT /api/v2/admin/kakaopay/setting` — Update settings for KakaoPay orders

- **Scope**: `mall.write_store` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 1
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#update-settings-for-kakaopay-orders

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |
| `shop_key` |  |  |  | 입점시 부여 받는 판매점의 고유 식별자 |
| `pixel_code` |  |  |  | 연동사(ECP/독립몰)에서 이미 사용중인 카카오 광고 픽셀 ID |
| `use_kakaopay` |  |  |  | 카카오페이 구매 사용여부 T : 사용함 · F : 사용안함 |
| `product_detail_button_size` |  |  |  | 쇼핑몰 상세상품 페이지 버튼 사이즈 |
| ↳ `pc` |  |  |  | pc |
| ↳ `mobile` |  |  |  | mobile |
| `basket_button_size` |  |  |  | 쇼핑몰 장바구니 페이지 버튼 사이즈 |
| ↳ `pc` |  |  |  | pc |
| ↳ `mobile` |  |  |  | mobile |
| `use_dark_mode` |  |  |  | 쇼핑몰 다크모드 적용여부 T : 활성화 · F : 비활성화 |
| `button_authorization_key` |  |  |  | 입점시 부여 받는 판매점의 버튼 인증 |
| `thirdparty_agree` |  |  |  | 제3자 제공 동의 여부 T : 동의함 · F : 동의안함 |
| `thirdparty_agree_date` |  | 날짜 |  | 제3자 제공 동의 날짜 |

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `kakaopay` |  | (응답 객체) |
| ↳ `shop_no` |  | 멀티쇼핑몰 번호 |
| ↳ `shop_key` |  | 입점시 부여 받는 판매점의 고유 식별자 |
| ↳ `pixel_code` |  | 연동사(ECP/독립몰)에서 이미 사용중인 카카오 광고 픽셀 ID |
| ↳ `use_kakaopay` |  | 카카오페이 구매 사용여부 T : 사용함 · F : 사용안함 |
| ↳ `product_detail_button_size` |  | 쇼핑몰 상세상품 페이지 버튼 사이즈 |
| ↳ ↳ `pc` |  |  |
| ↳ ↳ `mobile` |  |  |
| ↳ `basket_button_size` |  | 쇼핑몰 장바구니 페이지 버튼 사이즈 |
| ↳ ↳ `pc` |  |  |
| ↳ ↳ `mobile` |  |  |
| ↳ `use_dark_mode` |  | 쇼핑몰 다크모드 적용여부 T : 활성화 · F : 비활성화 |
| ↳ `button_authorization_key` |  | 입점시 부여 받는 판매점의 버튼 인증 |
| ↳ `thirdparty_agree` |  | 제3자 제공 동의 여부 T : 동의함 · F : 동의안함 |
| ↳ `thirdparty_agree_date` |  | 제3자 제공 동의 날짜 |

응답 예시 (JSON):

```json
{
    "kakaopay": {
        "shop_no": 1,
        "shop_key": "S12345",
        "pixel_code": "653867785974233605",
        "use_kakaopay": "T",
        "product_detail_button_size": {
            "pc": "210x83",
            "mobile": "290x95"
        },
        "basket_button_size": {
            "pc": "210x83",
            "mobile": "290x95"
        },
        "use_dark_mode": "T",
        "button_authorization_key": "dummy_12345",
        "thirdparty_agree": "T",
        "thirdparty_agree_date": "2021-07-15T17:59:00+09:00"
    }
}
```
