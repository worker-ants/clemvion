---
resource: store
entity: store
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#store
source: Cafe24 REST API Documentation (admin) — fields from full-page HTML; operation 응답 샘플은 code 엔드포인트 /docs/code/api/admin/shell/<entity>.json
---

# Cafe24 API — Store / Store

> Field-level 카탈로그. Endpoint enumeration index: [`../store.md`](../store.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Store](https://developers.cafe24.com/docs/ko/api/admin/#store)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

상점(Store)은 쇼핑몰의 쇼핑몰명, 관리자 정보, 사업자 등록번호와 고객센터 전화번호 등 쇼핑몰의 기본적인 정보를 확인할 수 있는 기능입니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `shop_no` |  | 멀티쇼핑몰 번호 멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호. |
| `shop_name` |  | 쇼핑몰명 해당 상점의 쇼핑몰명([쇼핑몰 설정 > 기본 설정 > '쇼핑몰 정보 > 내 쇼핑몰 정보']) |
| `admin_name` |  | 관리자명 쇼핑몰의 대표운영자의 이름 |
| `mall_id` |  | 상점 아이디 쇼핑몰 아이디. 대표운영자의 아이디이자, 쇼핑몰 기본 제공 도메인(mallid.cafe24.com)에 사용한다. |
| `base_domain` |  | 기본제공 도메인 쇼핑몰 생성시 자동으로 생성되는 기본제공 도메인 정보. 해당 도메인을 통해 쇼핑몰에 접근할 수 있다. |
| `primary_domain` |  | 대표도메인 쇼핑몰에 연결한 대표도메인. 대표도메인을 연결하였을 경우에만 노출된다. |
| `company_registration_no` |  | 사업자등록번호 사업장이 위치한 국가에서 발급한 쇼핑몰의 사업자 등록 번호. |
| `company_name` |  | 상호명 사업자 등록시 등록한 상호명 또는 법인명. |
| `president_name` |  | 대표자명 사업자 등록시 등록한 대표자명. |
| `company_condition` |  | 업태 사업자 등록시 등록한 업태. |
| `company_line` |  | 종목 사업자 등록시 등록한 종목. |
| `country` |  | 사업장 국가 사업장이 있는 국가명. |
| `country_code` |  | 국가코드 |
| `zipcode` |  | 우편번호 사업장의 우편번호 |
| `address1` |  | 기본 주소 사업장 주소(시/군/도) |
| `address2` |  | 상세 주소 사업장 주소(상세 주소) |
| `phone` |  | 전화번호 |
| `fax` |  | 팩스번호 |
| `email` |  | 이메일 운영자가 자동메일을 수신할 경우 수신할 메일 주소 |
| `notification_only_email` |  | 발신전용 이메일 고객과 운영자에게 자동메일 발송시 보내는 사람 메일주소 |
| `mall_url` |  | 쇼핑몰 주소 |
| `mail_order_sales_registration` |  | 통신 판매업 신고 통신판매업 신고가 되었는지 신고 여부 T : 신고함 · F : 신고안함 |
| `mail_order_sales_registration_number` |  | 통신판매신고 번호 |
| `missing_report_reason_type` |  | 통신판매업 미신고 사유 통신판매업 신고를 하지 않았을 경우 해당 사유. |
| `missing_report_reason` |  | 통신판매업 미신고 사유 상세 내용 통신판매업 미신고 사유가 "기타"일 경우 상세 사유. |
| `about_us_contents` |  | 회사소개 쇼핑몰에 대한 간략한 소개 표시. 쇼핑몰의 회사 소개 화면에 표시된다. |
| `company_map_url` |  | 회사약도 쇼핑몰에 대한 간략한 약도 표시. 쇼핑몰의 회사 소개 화면에 표시된다. |
| `customer_service_phone` |  | 고객센터 상담/주문 전화 쇼핑몰 화면에 표시되는 고객센터 상담 전화 |
| `customer_service_email` |  | 고객센터 상담/주문 이메일 쇼핑몰 화면에 표시되는 고객센터 상담 이메일 주소. |
| `customer_service_fax` |  | 고객센터 팩스 번호 쇼핑몰 화면에 표시되는 고객센터 팩스 번호. |
| `customer_service_sms` |  | 고객센터 SMS 수신번호 쇼핑몰 화면에 표시되는 고객센터 SMS 수신 번호. |
| `customer_service_hours` |  | 고객센터 운영시간 쇼핑몰 화면에 표시되는 고객센터 운영시간. |
| `privacy_officer_name` |  | 개인정보보호 책임자명 쇼핑몰 화면에 표시되는 개인정보보호 책임자 이름. |
| `privacy_officer_position` |  | 개인정보보호 책임자 지위 |
| `privacy_officer_department` |  | 개인정보보호 책임자 부서 |
| `privacy_officer_phone` |  | 개인정보보호 책임자 연락처 쇼핑몰 화면에 표시되는 개인정보보호 책임자의 전화번호. |
| `privacy_officer_email` |  | 개인정보보호 책임자 이메일 쇼핑몰 화면에 표시되는 개인정보보호 책임자의 이메일 주소. |
| `contact_us_mobile` |  | 서비스 문의안내 모바일 표시여부 서비스 문의 안내를 모바일에 노출시킬 것인지 여부. T : 표시함 · F : 표시안함 |
| `contact_us_contents` |  | 서비스 문의안내 내용 상품상세 페이지에 노출시키는 서비스 문의 안내 내용. |
| `sales_product_categories` |  | 판매 상품 카테고리 회원가입 및 쇼핑몰 생성 직후 입력하는 판매 상품 카테고리의 정보를 조회할 수 있습니다. · (2023년 4월 이후 가입한 몰에 한하여 조회할 수 있습니다.) Undecided : 아직 결정하지 못했어요. · Apparel : 패션의류 · FashionAccessories : 패션잡화 · LuxuryGoods : 수입명품 · BrandApparel : 브랜드의류 · BrandAccessories : 브랜드잡화 · Food_Beverage : 식품 · Lifestyle_HealthCare : 생활/건강 · Furniture_HomeDecor : 가구/인테리어 · Beauty_PersonalCare : 화장품/미용 · Maternity_BabyProducts : 출산/육아 · Digital_HomeAppliances : 디지털/가전 · CarAccessories : 자동차 · Rentals : 렌탈 서비스 · Sports_Leisure : 스포츠/레저 · CD_DVD : 음반/DVD · Books : 도서 · Travels_Services : 여가/생활편의 · Used_Refurbished_Exhibition : 중고/리퍼/전시 · Others : 기타/서비스 |
| `category_tags` |  | 판매 상품 카테고리 태그 category_tags |
| `business_country` |  | 비즈니스 국가 |
| `youtube_shops_logo` |  | 유튜브쇼핑 로고 이미지 |

## Operations

### `GET /api/v2/admin/store` — Retrieve store details

- **Scope**: `mall.read_store` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-store-details

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호. |

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `store` |  | (응답 객체) |
| ↳ `shop_no` |  | 멀티쇼핑몰 번호 멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호. |
| ↳ `shop_name` |  | 쇼핑몰명 해당 상점의 쇼핑몰명([쇼핑몰 설정 > 기본 설정 > '쇼핑몰 정보 > 내 쇼핑몰 정보']) |
| ↳ `admin_name` |  | 관리자명 쇼핑몰의 대표운영자의 이름 |
| ↳ `mall_id` |  | 상점 아이디 쇼핑몰 아이디. 대표운영자의 아이디이자, 쇼핑몰 기본 제공 도메인(mallid.cafe24.com)에 사용한다. |
| ↳ `base_domain` |  | 기본제공 도메인 쇼핑몰 생성시 자동으로 생성되는 기본제공 도메인 정보. 해당 도메인을 통해 쇼핑몰에 접근할 수 있다. |
| ↳ `primary_domain` |  | 대표도메인 쇼핑몰에 연결한 대표도메인. 대표도메인을 연결하였을 경우에만 노출된다. |
| ↳ `company_registration_no` |  | 사업자등록번호 사업장이 위치한 국가에서 발급한 쇼핑몰의 사업자 등록 번호. |
| ↳ `company_name` |  | 상호명 사업자 등록시 등록한 상호명 또는 법인명. |
| ↳ `president_name` |  | 대표자명 사업자 등록시 등록한 대표자명. |
| ↳ `company_condition` |  | 업태 사업자 등록시 등록한 업태. |
| ↳ `company_line` |  | 종목 사업자 등록시 등록한 종목. |
| ↳ `country` |  | 사업장 국가 사업장이 있는 국가명. |
| ↳ `country_code` |  | 국가코드 |
| ↳ `zipcode` |  | 우편번호 사업장의 우편번호 |
| ↳ `address1` |  | 기본 주소 사업장 주소(시/군/도) |
| ↳ `address2` |  | 상세 주소 사업장 주소(상세 주소) |
| ↳ `phone` |  | 전화번호 |
| ↳ `fax` |  | 팩스번호 |
| ↳ `email` |  | 이메일 운영자가 자동메일을 수신할 경우 수신할 메일 주소 |
| ↳ `notification_only_email` |  | 발신전용 이메일 고객과 운영자에게 자동메일 발송시 보내는 사람 메일주소 |
| ↳ `mall_url` |  | 쇼핑몰 주소 |
| ↳ `mail_order_sales_registration` |  | 통신 판매업 신고 통신판매업 신고가 되었는지 신고 여부 T : 신고함 · F : 신고안함 |
| ↳ `mail_order_sales_registration_number` |  | 통신판매신고 번호 |
| ↳ `missing_report_reason_type` |  | 통신판매업 미신고 사유 통신판매업 신고를 하지 않았을 경우 해당 사유. |
| ↳ `missing_report_reason` |  | 통신판매업 미신고 사유 상세 내용 통신판매업 미신고 사유가 "기타"일 경우 상세 사유. |
| ↳ `about_us_contents` |  | 회사소개 쇼핑몰에 대한 간략한 소개 표시. 쇼핑몰의 회사 소개 화면에 표시된다. |
| ↳ `company_map_url` |  | 회사약도 쇼핑몰에 대한 간략한 약도 표시. 쇼핑몰의 회사 소개 화면에 표시된다. |
| ↳ `customer_service_phone` |  | 고객센터 상담/주문 전화 쇼핑몰 화면에 표시되는 고객센터 상담 전화 |
| ↳ `customer_service_email` |  | 고객센터 상담/주문 이메일 쇼핑몰 화면에 표시되는 고객센터 상담 이메일 주소. |
| ↳ `customer_service_fax` |  | 고객센터 팩스 번호 쇼핑몰 화면에 표시되는 고객센터 팩스 번호. |
| ↳ `customer_service_sms` |  | 고객센터 SMS 수신번호 쇼핑몰 화면에 표시되는 고객센터 SMS 수신 번호. |
| ↳ `customer_service_hours` |  | 고객센터 운영시간 쇼핑몰 화면에 표시되는 고객센터 운영시간. |
| ↳ `privacy_officer_name` |  | 개인정보보호 책임자명 쇼핑몰 화면에 표시되는 개인정보보호 책임자 이름. |
| ↳ `privacy_officer_position` |  | 개인정보보호 책임자 지위 |
| ↳ `privacy_officer_department` |  | 개인정보보호 책임자 부서 |
| ↳ `privacy_officer_phone` |  | 개인정보보호 책임자 연락처 쇼핑몰 화면에 표시되는 개인정보보호 책임자의 전화번호. |
| ↳ `privacy_officer_email` |  | 개인정보보호 책임자 이메일 쇼핑몰 화면에 표시되는 개인정보보호 책임자의 이메일 주소. |
| ↳ `contact_us_mobile` |  | 서비스 문의안내 모바일 표시여부 서비스 문의 안내를 모바일에 노출시킬 것인지 여부. T : 표시함 · F : 표시안함 |
| ↳ `contact_us_contents` |  | 서비스 문의안내 내용 상품상세 페이지에 노출시키는 서비스 문의 안내 내용. |
| ↳ `sales_product_categories` |  | 판매 상품 카테고리 회원가입 및 쇼핑몰 생성 직후 입력하는 판매 상품 카테고리의 정보를 조회할 수 있습니다. · (2023년 4월 이후 가입한 몰에 한하여 조회할 수 있습니다.) Undecided : 아직 결정하지 못했어요. · Apparel : 패션의류 · FashionAccessories : 패션잡화 · LuxuryGoods : 수입명품 · BrandApparel : 브랜드의류 · BrandAccessories : 브랜드잡화 · Food_Beverage : 식품 · Lifestyle_HealthCare : 생활/건강 · Furniture_HomeDecor : 가구/인테리어 · Beauty_PersonalCare : 화장품/미용 · Maternity_BabyProducts : 출산/육아 · Digital_HomeAppliances : 디지털/가전 · CarAccessories : 자동차 · Rentals : 렌탈 서비스 · Sports_Leisure : 스포츠/레저 · CD_DVD : 음반/DVD · Books : 도서 · Travels_Services : 여가/생활편의 · Used_Refurbished_Exhibition : 중고/리퍼/전시 · Others : 기타/서비스 |
| ↳ `category_tags` |  | 판매 상품 카테고리 태그 category_tags |
| ↳ `business_country` |  | 비즈니스 국가 |
| ↳ `youtube_shops_logo` |  | 유튜브쇼핑 로고 이미지 |

응답 예시 (JSON):

```json
{
    "store": {
        "shop_no": 1,
        "shop_name": "My Shopping Mall",
        "admin_name": "John Doe",
        "mall_id": "myshop",
        "base_domain": "sample.cafe24.com",
        "primary_domain": "sample.com",
        "company_registration_no": "118-81-20586",
        "company_name": "My Shopping Mall",
        "president_name": "John Doe",
        "company_condition": "Retail",
        "company_line": "E-Commerce Product",
        "country": "Korea",
        "country_code": "KOR",
        "zipcode": "07071",
        "address1": "Sindaebang dong Dongjak-gu, Seoul, Republic of Korea",
        "address2": "Professional Construction Hall",
        "phone": "02-0000-0000",
        "fax": "02-0000-0000",
        "email": "sample@sample.com",
        "notification_only_email": "sample@sample.com",
        "mall_url": "http://sample.com",
        "mail_order_sales_registration": "T",
        "mail_order_sales_registration_number": "강남 제 02-680-014호",
        "missing_report_reason_type": "Preparing for Register",
        "missing_report_reason": "Preparing to report ecommerce business",
        "about_us_contents": "<b>My Shopping Mall Information</b>",
        "company_map_url": "https://myshop.cafe24.com/web/upload/map.jpg",
        "customer_service_phone": "02-0000-0000",
        "customer_service_email": "sample@sample.com",
        "customer_service_fax": "02-0000-0000",
        "customer_service_sms": "02-0000-0000",
        "customer_service_hours": "9:00 AM ~ 5:00 PM",
        "privacy_officer_name": "Hong Gildong",
        "privacy_officer_position": "Manager",
        "privacy_officer_department": "Information Security Team",
        "privacy_officer_phone": "02-0000-0000",
        "privacy_officer_email": "sample@sample.com",
        "contact_us_mobile": "T",
        "contact_us_contents": "Service Information",
        "sales_product_categories": [
            "Apparel",
            "FashionAccessories"
        ],
        "category_tags": [
            "trendingItems",
            "popularProducts"
        ],
        "business_country": "US",
        "youtube_shops_logo": "https://myshop.cafe24.com/web/upload/logo/youtube_logo.png"
    }
}
```
