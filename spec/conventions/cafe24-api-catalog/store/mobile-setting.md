---
resource: store
entity: mobile-setting
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#mobile-setting
source: Cafe24 REST API Documentation (admin) — fields from full-page HTML; operation 응답 샘플은 code 엔드포인트 /docs/code/api/admin/shell/<entity>.json
---

# Cafe24 API — Store / Mobile setting

> Field-level 카탈로그. Endpoint enumeration index: [`../store.md`](../store.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Mobile setting](https://developers.cafe24.com/docs/ko/api/admin/#mobile-setting)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

모바일 설정(Mobile setting)은 쇼핑몰의 모바일 쇼핑몰 설정에 관한 리소스입니다. · 모바일 쇼핑몰 사용 여부와 접속 주소 자동연결의 사용/사용안함 여부를 조회할 수 있습니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `shop_no` |  | 멀티쇼핑몰 번호 |
| `use_mobile_page` |  | 모바일 쇼핑몰 사용설정 T : 사용함 · F : 사용안함 |
| `use_mobile_domain_redirection` |  | 모바일 접속 주소 자동연결 설정 T : 사용함 · F : 사용안함 |

## Operations

### `GET /api/v2/admin/mobile/setting` — Retrieve mobile settings

- **Scope**: `mall.read_store` (read)
- **호출건수 제한**: 10
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-mobile-settings

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  |  | 1 | 멀티쇼핑몰 번호 |

#### 응답 (Response)

> Cafe24 공식 docs 의 대표 응답 샘플. 실제 필드 정의는 위 [응답 속성](#응답-속성-property-list) 참조.

```json
{
    "mobile": {
        "shop_no": 1,
        "use_mobile_page": "T",
        "use_mobile_domain_redirection": "T"
    }
}
```

### `PUT /api/v2/admin/mobile/setting` — Update mobile settings

- **Scope**: `mall.write_store` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 1
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#update-mobile-settings

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |
| `use_mobile_page` |  |  |  | 모바일 쇼핑몰 사용설정 T : 사용함 · F : 사용안함 |

#### 응답 (Response)

> Cafe24 공식 docs 의 대표 응답 샘플. 실제 필드 정의는 위 [응답 속성](#응답-속성-property-list) 참조.

```json
{
    "mobile": {
        "shop_no": 1,
        "use_mobile_page": "T"
    }
}
```
