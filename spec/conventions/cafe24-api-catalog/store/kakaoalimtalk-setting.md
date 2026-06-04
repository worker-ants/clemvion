---
resource: store
entity: kakaoalimtalk-setting
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#kakaoalimtalk-setting
source: Cafe24 REST API Documentation (admin) — fields from full-page HTML; operation 응답 샘플은 code 엔드포인트 /docs/code/api/admin/shell/<entity>.json
---

# Cafe24 API — Store / Kakaoalimtalk setting

> Field-level 카탈로그. Endpoint enumeration index: [`../store.md`](../store.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Kakaoalimtalk setting](https://developers.cafe24.com/docs/ko/api/admin/#kakaoalimtalk-setting)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

카카오알림톡 서비스(Kakaoalimtalk setting) 사용 여부를 조회하고 설정을 변경하는 리소스입니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `shop_no` |  | 멀티쇼핑몰 번호 DEFAULT 1 |
| `use_kakaoalimtalk` |  | 카카오알림톡 사용 여부 T: 사용함 · F: 사용안함 |

## Operations

### `GET /api/v2/admin/kakaoalimtalk/setting` — Retrieve the Kakao Info-talk settings

- **Scope**: `mall.read_store` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-the-kakao-info-talk-settings

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |

#### 응답 (Response)

> Cafe24 공식 docs 의 대표 응답 샘플. 실제 필드 정의는 위 [응답 속성](#응답-속성-property-list) 참조.

```json
{
    "kakaoalimtalk": {
        "shop_no": 1,
        "use_kakaoalimtalk": "T"
    }
}
```

### `PUT /api/v2/admin/kakaoalimtalk/setting` — Update the Kakao Info-talk settings

- **Scope**: `mall.write_store` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 1
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#update-the-kakao-info-talk-settings

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |
| `use_kakaoalimtalk` |  |  |  | 카카오알림톡 사용 여부 T: 사용함 · F: 사용안함 |

#### 응답 (Response)

> Cafe24 공식 docs 의 대표 응답 샘플. 실제 필드 정의는 위 [응답 속성](#응답-속성-property-list) 참조.

```json
{
    "kakaoalimtalk": {
        "shop_no": 1,
        "use_kakaoalimtalk": "T"
    }
}
```
