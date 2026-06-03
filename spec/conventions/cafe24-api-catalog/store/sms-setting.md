---
resource: store
entity: sms-setting
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#sms-setting
source: Cafe24 REST API Documentation (admin) — downloaded 2026-06-03
---

# Cafe24 API — Store / Sms setting

> Field-level 카탈로그. Endpoint enumeration index: [`../store.md`](../store.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Sms setting](https://developers.cafe24.com/docs/ko/api/admin/#sms-setting)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

SMS 설정(Sms setting)은 쇼핑몰의 SMS 설정에 관한 기능입니다. · SMS API를 사용하기 위해서는 먼저 쇼핑몰에서 SMS 발송 서비스를 사용하고 있는지 확인이 필요합니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `shop_no` |  | 멀티쇼핑몰 번호 |
| `use_sms` |  | SMS 사용 여부 T: 사용함 · F: 사용안함 |
| `exclude_unsubscriber` |  | 수신거부자 제외 발송 여부 T : 제외 · F : 포함 |
| `default_sender` |  | 기본 발신번호 |
| `unsubscribe_phone` |  | 무료 수신거부 전화번호 |
| `send_method` |  | SMS 발송방법 S: 단문 분할발송 · L: 장문발송(3건 차감) |
| `send_method_automatic` |  | SMS 발송방법 (자동) L: 장문발송(3건차감) · S: 단문 분할발송 · N: 단문발송 |

## Operations

### `GET /api/v2/admin/sms/setting` — Retrieve SMS settings

- **Scope**: `mall.read_store` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-sms-settings

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 |

### `PUT /api/v2/admin/sms/setting` — Update SMS settings

- **Scope**: `mall.write_store` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 1
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#update-sms-settings

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |
| `use_sms` |  |  |  | SMS 사용 여부 T: 사용함 · F: 사용안함 |
| `exclude_unsubscriber` |  |  |  | 수신거부자 제외 발송 여부 T : 제외 · F : 포함 |
| `default_sender` |  | 최대글자수 : [14자] |  | 기본 발신번호 |
| `unsubscribe_phone` |  | 최대글자수 : [14자] |  | 무료 수신거부 전화번호 |
| `send_method` |  |  |  | SMS 발송방법 S: 단문 분할발송 · L: 장문발송(3건 차감) |
| `send_method_automatic` |  |  |  | SMS 발송방법 (자동) L: 장문발송(3건차감) · S: 단문 분할발송 · N: 단문발송 |
