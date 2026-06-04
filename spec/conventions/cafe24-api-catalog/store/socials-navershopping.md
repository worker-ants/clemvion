---
resource: store
entity: socials-navershopping
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#socials-navershopping
source: Cafe24 REST API Documentation (admin) — fields from full-page HTML; operation 응답 샘플은 code 엔드포인트 /docs/code/api/admin/shell/<entity>.json
---

# Cafe24 API — Store / Socials navershopping

> Field-level 카탈로그. Endpoint enumeration index: [`../store.md`](../store.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Socials navershopping](https://developers.cafe24.com/docs/ko/api/admin/#socials-navershopping)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `shop_no` | 최소값: [1] | 멀티쇼핑몰 번호 |
| `mall_id` |  | 몰아이디 |
| `service_status` |  | 서비스 상태 T:사용함 · F:사용안함 |

## Operations

### `GET /api/v2/admin/socials/navershopping` — NAVER Shopping settings

- **Scope**: `mall.read_store` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#naver-shopping-settings

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |

#### 응답 (Response)

> Cafe24 공식 docs 의 대표 응답 샘플. 실제 필드 정의는 위 [응답 속성](#응답-속성-property-list) 참조.

```json
{
    "navershopping": {
        "shop_no": 1,
        "mall_id": "samplemall",
        "service_status": "T"
    }
}
```
