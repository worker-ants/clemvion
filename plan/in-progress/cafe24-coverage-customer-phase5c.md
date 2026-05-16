---
worktree: cafe24-coverage-customer-6d2a4f
started: 2026-05-16
owner: developer
---

# Plan: Cafe24 Coverage 확장 — Customer 메모 CRUD Phase 5c

회원 메모 CRUD 5건을 supported 로 승격. 기존 `customer_memos_create` 와 함께 메모 CRUD 가 완성된다.

## 범위

| id | label | method | path | scope |
|---|---|---|---|---|
| `customer_memos_count` | 회원 메모 개수 조회 | GET | `customers/{member_id}/memos/count` | read |
| `customer_memos_list` | 회원 메모 목록 조회 | GET | `customers/{member_id}/memos` | read (paginated) |
| `customer_memos_get` | 회원 메모 단건 조회 | GET | `customers/{member_id}/memos/{memo_no}` | read |
| `customer_memos_update` | 회원 메모 수정 | PUT | `customers/{member_id}/memos/{memo_no}` | write |
| `customer_memos_delete` | 회원 메모 삭제 | DELETE | `customers/{member_id}/memos/{memo_no}` | write |

## 결정 사항

- **path placeholder 이름**: Cafe24 docs 는 `{customer_no}` 사용하지만 codebase 의 기존 customer ops (`customer_get`, `customer_update`, `customer_memos_create`) 가 모두 `{member_id}` 를 쓰므로 일관성 유지.
- **scopeType**: docs 는 update/delete 에 "store write" 언급하지만 기존 `customer_memos_create` 가 `scopeType: 'write'` (= `mall.write_customer`) 사용해서 일관성 유지.
- **customer_memos_update body**: `content` required, `memo_type` / `is_display` optional. 부분 갱신 패턴.

## 후속

Phase 5d (Promotion 쿠폰 보완), 5e (Salesreport 완성), 5f (Serialcoupons).
