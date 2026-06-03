# Makeshop API Catalog — 혜택 (Benefit)

> 상위: [`_overview.md`](./_overview.md) · 전체 스키마(요청/응답 필드): [`openapi/benefit.openapi.json`](./openapi/benefit.openapi.json)

공통 prefix `/api/v1/{shopId}/` 는 `path` 컬럼에서 생략. 인증 `bearerAuth`. 본 표는 메이크샵 공식 문서에서 자동 추출한 **구현 전 레퍼런스**다 (우리 백엔드 메타데이터 미존재 → status/sync test 없음).

## REST endpoints (15)

| id | 라벨 (한) | method | path | 권한 (x-scope) | docs |
|----|-----------|--------|------|----------------|------|
| `get-coupon` | 쿠폰 조회 | GET | `coupon` | 회원 | [↗](https://developer.makeshop.co.kr/docs/api/benefit/get-coupon) |
| `get-smart_coupon` | 스마트 쿠폰 조회 | GET | `smart_coupon` | 회원 | [↗](https://developer.makeshop.co.kr/docs/api/benefit/get-smart-coupon) |
| `get-smart_reserve` | 스마트 적립금 항목 조회 | GET | `smart_reserve` | 회원 | [↗](https://developer.makeshop.co.kr/docs/api/benefit/get-smart-reserve) |
| `get-user_coupon` | 회원 쿠폰 조회 | GET | `user_coupon` | 회원 | [↗](https://developer.makeshop.co.kr/docs/api/benefit/get-user-coupon) |
| `get-user_emoney` | 회원 예치금 조회 | GET | `user_emoney` | 회원 | [↗](https://developer.makeshop.co.kr/docs/api/benefit/get-user-emoney) |
| `get-user_point` | 회원 포인트 조회 | GET | `user_point` | 회원 | [↗](https://developer.makeshop.co.kr/docs/api/benefit/get-user-point) |
| `get-user_reserve` | 회원 적립금 조회 | GET | `user_reserve` | 회원 | [↗](https://developer.makeshop.co.kr/docs/api/benefit/get-user-reserve) |
| `get-user_smart_coupon` | 회원 스마트 쿠폰 조회 | GET | `user_smart_coupon` | 회원 | [↗](https://developer.makeshop.co.kr/docs/api/benefit/get-user-smart-coupon) |
| `get-user_smart_reserve` | 회원 스마트 적립금 조회 | GET | `user_smart_reserve` | 회원 | [↗](https://developer.makeshop.co.kr/docs/api/benefit/get-user-smart-reserve) |
| `post-coupon-give` | 쿠폰 지급 | POST | `coupon/give` | 쿠폰 | [↗](https://developer.makeshop.co.kr/docs/api/benefit/post-coupon-give) |
| `post-point-give` | 포인트 지급 | POST | `point/give` | 적립금 | [↗](https://developer.makeshop.co.kr/docs/api/benefit/post-point-give) |
| `post-reserve-give` | 적립금 지급 | POST | `reserve/give` | 적립금 | [↗](https://developer.makeshop.co.kr/docs/api/benefit/post-reserve-give) |
| `post-reserve_temp-give` | 적립금 지급 요청 | POST | `reserve_temp/give` | 적립금 | [↗](https://developer.makeshop.co.kr/docs/api/benefit/post-reserve-temp-give) |
| `post-smart_coupon-give` | 스마트 쿠폰 지급 | POST | `smart_coupon/give` | 쿠폰 | [↗](https://developer.makeshop.co.kr/docs/api/benefit/post-smart-coupon-give) |
| `post-smart_reserve-give` | 스마트 적립금 지급 | POST | `smart_reserve/give` | 적립금 | [↗](https://developer.makeshop.co.kr/docs/api/benefit/post-smart-reserve-give) |
