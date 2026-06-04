---
resource: store
entity: taxmanager
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#taxmanager
source: Cafe24 REST API Documentation (admin) — fields from full-page HTML; operation 응답 샘플은 code 엔드포인트 /docs/code/api/admin/shell/<entity>.json
---

# Cafe24 API — Store / Taxmanager

> Field-level 카탈로그. Endpoint enumeration index: [`../store.md`](../store.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Taxmanager](https://developers.cafe24.com/docs/ko/api/admin/#taxmanager)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

세금 관리자(MSA)의 활성화 정보 관련 기능입니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `use` |  | 세금 관리자 활성화 정보 |

## Operations

### `GET /api/v2/admin/taxmanager` — Retrieve activation information for Tax Manager

- **Scope**: `mall.read_store` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-activation-information-for-tax-manager

_요청 파라미터 없음._

#### 응답 (Response)

> Cafe24 공식 docs 의 대표 응답 샘플. 실제 필드 정의는 위 [응답 속성](#응답-속성-property-list) 참조.

```json
{
    "taxmanager": {
        "use": "T"
    }
}
```
