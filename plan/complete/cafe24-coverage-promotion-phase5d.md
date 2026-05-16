---
worktree: cafe24-coverage-promotion-8f5b2c
started: 2026-05-16
owner: developer
---

# Plan: Cafe24 Coverage 확장 — Promotion 쿠폰 보완 Phase 5d

쿠폰 자동화 워크플로우의 핵심 read 5건 승격.

## 범위

| id | label | method | path | scope |
|---|---|---|---|---|
| `coupon_count` | 쿠폰 개수 조회 | GET | `coupons/count` | read |
| `coupon_issues_list` | 발급 쿠폰 목록 | GET | `coupons/issues` | read (paginated) |
| `coupon_issuance_customers_list` | 쿠폰 발급 대상 회원 목록 | GET | `coupons/{coupon_no}/issuancecustomers` | read (paginated) |
| `customers_coupons_list` | 회원별 쿠폰 목록 | GET | `customers/{member_id}/coupons` | read (paginated) |
| `customers_coupons_count` | 회원별 쿠폰 개수 | GET | `customers/{member_id}/coupons/count` | read |

## 결정 사항

- `customers_coupons_*` 의 path placeholder 는 codebase 의 기존 customer ops 와 일관되게 `{member_id}` 사용 (Cafe24 docs 는 `customer_no`). description 에 명시.
- `coupon_manage` (planned) 는 의미가 모호하고 `coupon_delete` 와 중복 가능성 있어 본 PR 에서 제외. 후속 검토.

## 후속

Phase 5e (Salesreport 완성), 5f (Serialcoupons).
