---
resource: store
entity: shops
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#shops
source: Cafe24 REST API Documentation (admin) — downloaded 2026-06-03
---

# Cafe24 API — Store / Shops

> Field-level 카탈로그. Endpoint enumeration index: [`../store.md`](../store.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Shops](https://developers.cafe24.com/docs/ko/api/admin/#shops)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

멀티쇼핑몰(Shops)은 한개의 몰아이디에서 두개 이상의 쇼핑몰을 운영하고 있는 경우 생성한 멀티 쇼핑몰의 정보입니다. · 멀티쇼핑몰은 최대 15개까지 생성이 가능하며, 각각 다른 언어와 화폐로 생성할 수 있어 다국어 쇼핑몰을 운영하기 용이합니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `shop_no` |  | 멀티쇼핑몰 번호 멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호. |
| `default` |  | 기본샵 여부 기본샵 여부 구분 T : 기본샵 · F : 기본샵 아님 |
| `shop_name` | 최대글자수 : [255자] | 쇼핑몰명 해당 멀티쇼핑몰의 쇼핑몰 이름 |
| `business_country_code` |  | 사업자 거점 국가 코드 business_country_code |
| `language_code` |  | 언어 코드 멀티쇼핑몰의 기본 언어 코드 ko_KR : 국문 · en_US : 영문 · zh_CN : 중문(간체) · zh_TW : 중문(번체) · ja_JP : 일문 · vi_VN : 베트남어 |
| `language_name` | 최대글자수 : [20자] | 기본 언어명 멀티쇼핑몰의 기본 언어명 |
| `currency_code` | 형식 : [A-Z] | 결제 화폐 코드 멀티쇼핑몰의 결제 화폐 코드 South Korean Won (KRW) · United States Dollar (USD) · Japanese Yen (JPY) · Chinese Yuan (CNY) · Taiwan Dollar (TWD) · Euro (EUR) · Brazilian Real (BRL) · Vietnamese Dong (VND) |
| `currency_name` |  | 결제 화폐명 멀티쇼핑몰의 결제 화폐명 |
| `reference_currency_code` | 형식 : [A-Z] | 참조 화폐 코드 멀티쇼핑몰의 참조 화폐 코드 South Korean Won (KRW) · United States Dollar (USD) · Japanese Yen (JPY) · Chinese Yuan (CNY) |
| `reference_currency_name` |  | 참조 화폐명 멀티쇼핑몰의 참조 화폐명 |
| `pc_skin_no` |  | PC 쇼핑몰 대표 디자인 번호 멀티쇼핑몰의 PC 쇼핑몰 대표 디자인 번호. 현재 쇼핑몰에서 사용하고 있는 디자인 번호를 나타낸다. |
| `mobile_skin_no` |  | 모바일 쇼핑몰 대표 디자인 번호 모바일 쇼핑몰 대표 디자인 번호. 현재 쇼핑몰에서 사용하고 있는 디자인 번호를 나타낸다. |
| `base_domain` | 최대글자수 : [63자] | 기본제공 도메인 기본제공하는 도메인 |
| `primary_domain` | 최대글자수 : [63자] | 대표도메인 멀티쇼핑몰 대표 도메인 |
| `slave_domain` |  | 연결 도메인 쇼핑몰에 연결된 도메인 |
| `active` |  | 활성화 여부 멀티쇼핑몰 활성화 여부 T : 활성화 · F : 비활성화 |
| `timezone` |  | 표준시간대(타임존) |
| `timezone_name` |  | 표준시간대 정보 |
| `date_format` |  | 표준시간대 날짜 표시형식 년/월/일 : YYYY-MM-DD · 월/일/년 : MM-DD-YYYY · 일/월/년 : DD-MM-YYYY |
| `time_format` |  | 표준시간대 시간 표시형식 시/분/초 표시 : hh:mm:ss · 시/분 표시 : hh:mm |
| `unit_system` |  | 단위 체계 metric : 메트릭 체계 · imperial : 야드파운드법 |
| `weight_unit` |  | 중량 단위 kg : 킬로그램 · g : 그램 · lb : 파운드 · oz : 온스 |
| `use_reference_currency` |  | 참조화폐 사용여부 |
| `is_https_active` |  | HTTPS 활성화 여부 T : 활성화 · F : 비활성화 |
| `site_connect` |  | 사이트 접속설정 |
| `channel` |  | 채널 |
| `use_translation` |  | 자동번역 |

## Operations

### `GET /api/v2/admin/shops` — Retrieve a list of shops

- **Scope**: `mall.read_store` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-shops

_요청 파라미터 없음._

### `GET /api/v2/admin/shops/{shop_no}` — Retrieve a shop

- **Scope**: `mall.read_store` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-shop

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` | ✓ |  | 1 | 멀티쇼핑몰 번호 멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호. |
