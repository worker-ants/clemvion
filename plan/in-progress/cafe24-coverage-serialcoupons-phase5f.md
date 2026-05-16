---
worktree: cafe24-coverage-serialcoupons-5e7b3d
started: 2026-05-16
owner: developer
---

# Plan: Cafe24 Coverage — Promotion Serialcoupons Phase 5f

마케팅 이벤트용 시리얼 쿠폰 5건 supported 승격. Phase 5 사이클의 마지막 정형 묶음.

## 범위

| id | method | path |
|---|---|---|
| serialcoupons_list | GET | serialcoupons (coupon_no query required, paginated) |
| serialcoupons_generate | POST | serialcoupons/{coupon_no}/generate (quantity required) |
| serialcoupons_delete | DELETE | serialcoupons/{coupon_no}/{code} |
| serialcoupons_issues_get | GET | serialcoupons/{coupon_no}/issues (paginated) |
| serialcoupons_issues_register | POST | serialcoupons/{coupon_no}/issues |

Coverage: promotion 10 → 15, 합계 76 → 81.

## 결정 사항

- `serialcoupons_list` 의 path `serialcoupons` 에 `coupon_no` 가 query 필수. List endpoint 가 query-only filter 인 패턴.
- `serialcoupons_generate` body 의 `prefix`/`suffix` optional — 코드 꾸미기용.
- `serialcoupons_delete` path 에 code 자체가 들어가는 변칙적 RESTful 디자인.

## 후속

본 PR 로 Phase 5 (a~f) 정형 묶음이 종료. 나머지 planned ~292 ops 는 사용자 우선순위 신호에 따라 묶음 단위 후속 PR (Phase 6+, e.g. Store 결제 설정 / Order 자동화 다음 단계 / Promotion benefit/event / etc.)
