---
id: makeshop-benefit
status: implemented
code:
  - codebase/backend/src/nodes/integration/makeshop/metadata/benefit.ts
---

# Makeshop API Catalog — 혜택 (Benefit)

> 상위: [`_overview.md`](./_overview.md) · 전체 스키마(요청/응답 필드): [`openapi/benefit.openapi.json`](./openapi/benefit.openapi.json)

공통 prefix `/api/v1/{shopId}/` 는 `path` 컬럼에서 생략. 인증 `bearerAuth`. 본 표는 메이크샵 공식 문서에서 자동 추출했으며, Phase 0 에서 backend 메타데이터(`MAKESHOP_OPERATIONS_BY_RESOURCE`)와 `catalog-sync` 양방향 테스트로 동기 보호된다. `scope`/`paginated`/`status` 컬럼은 메타데이터와 1:1 일치한다.

## REST endpoints (15)

| id | 라벨 (한) | method | path | scope | paginated | status | docs |
|----|-----------|--------|------|-------|-----------|--------|------|
| `get-coupon` | 쿠폰 조회 | GET | `coupon` | read | ✓ | supported | [↗](https://developer.makeshop.co.kr/docs/api/benefit/get-coupon) |
| `get-smart_coupon` | 스마트 쿠폰 조회 | GET | `smart_coupon` | read | ✓ | supported | [↗](https://developer.makeshop.co.kr/docs/api/benefit/get-smart-coupon) |
| `get-smart_reserve` | 스마트 적립금 항목 조회 | GET | `smart_reserve` | read | ✓ | supported | [↗](https://developer.makeshop.co.kr/docs/api/benefit/get-smart-reserve) |
| `get-user_coupon` | 회원 쿠폰 조회 | GET | `user_coupon` | read | ✓ | supported | [↗](https://developer.makeshop.co.kr/docs/api/benefit/get-user-coupon) |
| `get-user_emoney` | 회원 예치금 조회 | GET | `user_emoney` | read | ✓ | supported | [↗](https://developer.makeshop.co.kr/docs/api/benefit/get-user-emoney) |
| `get-user_point` | 회원 포인트 조회 | GET | `user_point` | read | ✓ | supported | [↗](https://developer.makeshop.co.kr/docs/api/benefit/get-user-point) |
| `get-user_reserve` | 회원 적립금 조회 | GET | `user_reserve` | read | ✓ | supported | [↗](https://developer.makeshop.co.kr/docs/api/benefit/get-user-reserve) |
| `get-user_smart_coupon` | 회원 스마트 쿠폰 조회 | GET | `user_smart_coupon` | read | ✓ | supported | [↗](https://developer.makeshop.co.kr/docs/api/benefit/get-user-smart-coupon) |
| `get-user_smart_reserve` | 회원 스마트 적립금 조회 | GET | `user_smart_reserve` | read | ✓ | supported | [↗](https://developer.makeshop.co.kr/docs/api/benefit/get-user-smart-reserve) |
| `post-coupon-give` | 쿠폰 지급 | POST | `coupon/give` | write |  | supported | [↗](https://developer.makeshop.co.kr/docs/api/benefit/post-coupon-give) |
| `post-point-give` | 포인트 지급 | POST | `point/give` | write |  | supported | [↗](https://developer.makeshop.co.kr/docs/api/benefit/post-point-give) |
| `post-reserve-give` | 적립금 지급 | POST | `reserve/give` | write |  | supported | [↗](https://developer.makeshop.co.kr/docs/api/benefit/post-reserve-give) |
| `post-reserve_temp-give` | 적립금 지급 요청 | POST | `reserve_temp/give` | write |  | supported | [↗](https://developer.makeshop.co.kr/docs/api/benefit/post-reserve-temp-give) |
| `post-smart_coupon-give` | 스마트 쿠폰 지급 | POST | `smart_coupon/give` | write |  | supported | [↗](https://developer.makeshop.co.kr/docs/api/benefit/post-smart-coupon-give) |
| `post-smart_reserve-give` | 스마트 적립금 지급 | POST | `smart_reserve/give` | write |  | supported | [↗](https://developer.makeshop.co.kr/docs/api/benefit/post-smart-reserve-give) |
