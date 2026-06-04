---
resource: store
entity: store-setting
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#store-setting
source: Cafe24 REST API Documentation (admin) — fields from full-page HTML; operation 응답 샘플은 code 엔드포인트 /docs/code/api/admin/shell/<entity>.json
---

# Cafe24 API — Store / Store setting

> Field-level 카탈로그. Endpoint enumeration index: [`../store.md`](../store.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Store setting](https://developers.cafe24.com/docs/ko/api/admin/#store-setting)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `shop_no` |  | 멀티쇼핑몰 번호 |
| `name_input_style` |  | 이름 입력 방식 SEPARATE: 성/이름 각각 입력 · COMBINED: 성/이름 한번에 입력 |

## Operations

### `GET /api/v2/admin/store/setting` — Retrieve store security settings

- **Scope**: `mall.read_store` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-store-security-settings

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `store` |  | (응답 객체) |
| ↳ `shop_no` |  | 멀티쇼핑몰 번호 |
| ↳ `name_input_style` |  | 이름 입력 방식 SEPARATE: 성/이름 각각 입력 · COMBINED: 성/이름 한번에 입력 |

응답 예시 (JSON):

```json
{
    "store": {
        "shop_no": 1,
        "name_input_style": "SEPARATE"
    }
}
```

### `PUT /api/v2/admin/store/setting` — Edit store security settings

- **Scope**: `mall.write_store` (write)
- **호출건수 제한**: 30
- **1회당 요청건수 제한**: 1
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#edit-store-security-settings

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |
| `name_input_style` |  |  |  | 이름 입력 방식 SEPARATE: 성/이름 각각 입력 · COMBINED: 성/이름 한번에 입력 |

#### 응답 (Response)

> 대표 응답 샘플에 나타난 필드를 정리한 응답 파라미터. 필드 정의는 위 [응답 속성](#응답-속성-property-list) 기준 (`↳` = 중첩, 배열은 대표 원소).

| Parameter | 제약 | 설명 |
|---|---|---|
| `store` |  | (응답 객체) |
| ↳ `shop_no` |  | 멀티쇼핑몰 번호 |
| ↳ `name_input_style` |  | 이름 입력 방식 SEPARATE: 성/이름 각각 입력 · COMBINED: 성/이름 한번에 입력 |

응답 예시 (JSON):

```json
{
    "store": {
        "shop_no": 1,
        "name_input_style": "SEPARATE"
    }
}
```
