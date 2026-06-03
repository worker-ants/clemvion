---
id: makeshop-member
status: implemented
code:
  - codebase/backend/src/nodes/integration/makeshop/metadata/member.ts
---

# Makeshop API Catalog — 회원 (Member)

> 상위: [`_overview.md`](./_overview.md) · 전체 스키마(요청/응답 필드): [`openapi/member.openapi.json`](./openapi/member.openapi.json)

공통 prefix `/api/v1/{shopId}/` 는 `path` 컬럼에서 생략. 인증 `bearerAuth`. 본 표는 메이크샵 공식 문서에서 자동 추출했으며, Phase 0 에서 backend 메타데이터(`MAKESHOP_OPERATIONS_BY_RESOURCE`)와 `catalog-sync` 양방향 테스트로 동기 보호된다. `scope`/`paginated`/`status` 컬럼은 메타데이터와 1:1 일치한다.

## REST endpoints (16)

| id | 라벨 (한) | method | path | scope | paginated | status | docs |
|----|-----------|--------|------|-------|-----------|--------|------|
| `get-cart` | 장바구니 조회 | GET | `cart` | read | ✓ | supported | [↗](https://developer.makeshop.co.kr/docs/api/member/get-cart) |
| `get-group` | 회원 그룹 조회 | GET | `group` | read |  | supported | [↗](https://developer.makeshop.co.kr/docs/api/member/get-group) |
| `get-user` | 회원 조회 | GET | `user` | read | ✓ | supported | [↗](https://developer.makeshop.co.kr/docs/api/member/get-user) |
| `get-user_auto_group` | 회원 그룹 자동 변경 내역 조회 | GET | `user_auto_group` | read | ✓ | supported | [↗](https://developer.makeshop.co.kr/docs/api/member/get-user-auto-group) |
| `get-user_dormant` | 휴면 회원 조회 | GET | `user_dormant` | read | ✓ | supported | [↗](https://developer.makeshop.co.kr/docs/api/member/get-user-dormant) |
| `get-user_dormant_wait` | 회원 휴면 전환 예정일 조회 | GET | `user_dormant_wait` | read | ✓ | supported | [↗](https://developer.makeshop.co.kr/docs/api/member/get-user-dormant-wait) |
| `get-user_exit` | 탈퇴 회원 조회 | GET | `user_exit` | read | ✓ | supported | [↗](https://developer.makeshop.co.kr/docs/api/member/get-user-exit) |
| `get-user_exit_log` | 탈퇴 회원 로그 조회 | GET | `user_exit_log` | read | ✓ | supported | [↗](https://developer.makeshop.co.kr/docs/api/member/get-user-exit-log) |
| `get-user_group_change_log` | 회원 그룹 변경 내역 조회 | GET | `user_group_change_log` | read | ✓ | supported | [↗](https://developer.makeshop.co.kr/docs/api/member/get-user-group-change-log) |
| `get-user_order` | 회원 주문 통계 조회 | GET | `user_order` | read |  | supported | [↗](https://developer.makeshop.co.kr/docs/api/member/get-user-order) |
| `post-send_sms` | SMS 보내기 | POST | `send_sms` | write |  | supported | [↗](https://developer.makeshop.co.kr/docs/api/member/post-send-sms) |
| `post-user-agree` | 고객 SMS 수신 동의 여부 수정 | POST | `user/agree` | write |  | supported | [↗](https://developer.makeshop.co.kr/docs/api/member/post-user-agree) |
| `post-user_counsel-create` | 고객 상담 등록 | POST | `user_counsel/create` | write |  | supported | [↗](https://developer.makeshop.co.kr/docs/api/member/post-user-counsel-create) |
| `post-user_counsel-delete` | 고객 상담 삭제 | POST | `user_counsel/delete` | write |  | supported | [↗](https://developer.makeshop.co.kr/docs/api/member/post-user-counsel-delete) |
| `post-user_counsel-update` | 고객 상담 수정 | POST | `user_counsel/update` | write |  | supported | [↗](https://developer.makeshop.co.kr/docs/api/member/post-user-counsel-update) |
| `post-user_group_change-update` | 회원 그룹 변경 | POST | `user_group_change/update` | write |  | supported | [↗](https://developer.makeshop.co.kr/docs/api/member/post-user-group-change-update) |
