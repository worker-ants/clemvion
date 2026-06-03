---
resource: store
entity: kakaoalimtalk-profile
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#kakaoalimtalk-profile
source: Cafe24 REST API Documentation (admin) — downloaded 2026-06-03
---

# Cafe24 API — Store / Kakaoalimtalk profile

> Field-level 카탈로그. Endpoint enumeration index: [`../store.md`](../store.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Kakaoalimtalk profile](https://developers.cafe24.com/docs/ko/api/admin/#kakaoalimtalk-profile)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

상점의 카카오채널 프로필키 등록여부를 확인할 수 있는 리소스입니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `shop_no` |  | 멀티쇼핑몰 번호 DEFAULT 1 |
| `kakao_senderkey` |  | 카카오 채널 발신 프로필 키 |

## Operations

### `GET /api/v2/admin/kakaoalimtalk/profile` — Retrieve a Kakao Channel sender profile key

- **Scope**: `mall.read_store` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-a-kakao-channel-sender-profile-key

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |
