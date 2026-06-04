---
resource: store
entity: financials-paymentgateway
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#financials-paymentgateway
source: Cafe24 REST API Documentation (admin) — fields from full-page HTML; operation 응답 샘플은 code 엔드포인트 /docs/code/api/admin/shell/<entity>.json
---

# Cafe24 API — Store / Financials paymentgateway

> Field-level 카탈로그. Endpoint enumeration index: [`../store.md`](../store.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Financials paymentgateway](https://developers.cafe24.com/docs/ko/api/admin/#financials-paymentgateway)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

Financials paymentgateway(PG 정보)는 PG사별 계약정보를 제공합니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `partner_id` |  | PG사 발급 가맹점 ID |
| `payment_gateway_name` |  | PG 이름 inicis : 이니시스 · kcp : KCP · allat : 올앳 · ksnet : KSNET · dacom : 토스페이먼츠 · allthegate : 올더게이트 · settlebank : 세틀뱅크 · smartro : 스마트로 · kicc : 한국정보통신 · mobilians : 모빌리언스 · danal : 다날 |
| `contract_date` |  | PG 계약일 |
| `setting_date` |  | PG 세팅일 |
| `bank_code` |  | 정산입금 은행코드 은행 코드 조회하기 |
| `bank_account_no` |  | 정산입금 계좌정보 |
| `status` |  | 금융제휴여부 T:제휴함 · F: 제휴안함 |
| `bank_account_name` |  | 정산입금 예금주명 |
| `payment_method_information` |  | 결제수단별 정산 정보 ※ payment_method_information 하위 요소에 대한 값 정의 · 1) payment_method_information > period(정산 기간) · D : 일별 · W : 주별 · M : 월별 |

## Operations

### `GET /api/v2/admin/financials/paymentgateway` — Retrieve a list of Payment Gateway contract details

- **Scope**: `mall.read_store` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-list-of-payment-gateway-contract-details

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `payment_gateway_name` |  |  |  | PG 이름 |
| `partner_id` |  |  |  | PG사 발급 가맹점 ID |

#### 응답 (Response)

> Cafe24 공식 docs 의 대표 응답 샘플. 실제 필드 정의는 위 [응답 속성](#응답-속성-property-list) 참조.

```json
{
    "paymentgateway": {
        "partner_id": "cafe24_Test",
        "payment_gateway_name": "cafe24payTest",
        "contract_date": "2020-01-01",
        "setting_date": "2020-01-02",
        "status": "T",
        "bank_code": "013",
        "bank_account_no": "123456789123",
        "bank_account_name": "Test",
        "payment_method_information": [
            {
                "payment_method": "card",
                "period": "M",
                "period_information": "1"
            },
            {
                "payment_method": "tcash",
                "period": "W",
                "period_information": "1"
            }
        ]
    }
}
```
