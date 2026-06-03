---
id: makeshop-board
status: implemented
code:
  - codebase/backend/src/nodes/integration/makeshop/metadata/board.ts
---

# Makeshop API Catalog — 게시판 (Board)

> 상위: [`_overview.md`](./_overview.md) · 전체 스키마(요청/응답 필드): [`openapi/board.openapi.json`](./openapi/board.openapi.json)

공통 prefix `/api/v1/{shopId}/` 는 `path` 컬럼에서 생략. 인증 `bearerAuth`. 본 표는 메이크샵 공식 문서에서 자동 추출했으며, Phase 0 에서 backend 메타데이터(`MAKESHOP_OPERATIONS_BY_RESOURCE`)와 `catalog-sync` 양방향 테스트로 동기 보호된다. `scope`/`paginated`/`status` 컬럼은 메타데이터와 1:1 일치한다.

## REST endpoints (12)

| id | 라벨 (한) | method | path | scope | paginated | status | docs |
|----|-----------|--------|------|-------|-----------|--------|------|
| `get-board` | 게시글 조회 | GET | `board` | read | ✓ | supported | [↗](https://developer.makeshop.co.kr/docs/api/board/get-board) |
| `get-board_code` | 등록 게시판 조회 | GET | `board_code` | read |  | supported | [↗](https://developer.makeshop.co.kr/docs/api/board/get-board-code) |
| `get-comment` | 게시글 댓글 조회 | GET | `comment` | read | ✓ | supported | [↗](https://developer.makeshop.co.kr/docs/api/board/get-comment) |
| `get-crm_board` | 1:1 게시판 조회 | GET | `crm_board` | read | ✓ | supported | [↗](https://developer.makeshop.co.kr/docs/api/board/get-crm-board) |
| `get-review` | 코멘트 평점타입 후기 조회 | GET | `review` | read | ✓ | supported | [↗](https://developer.makeshop.co.kr/docs/api/board/get-review) |
| `post-board-store` | 게시글 등록/수정/삭제 | POST | `board/store` | write |  | supported | [↗](https://developer.makeshop.co.kr/docs/api/board/post-board-store) |
| `post-comment-store` | 게시글 댓글 등록/수정/삭제 | POST | `comment/store` | write |  | supported | [↗](https://developer.makeshop.co.kr/docs/api/board/post-comment-store) |
| `post-crm_board-create` | 1:1 게시글 등록 | POST | `crm_board/create` | write |  | supported | [↗](https://developer.makeshop.co.kr/docs/api/board/post-crm-board-create) |
| `post-crm_board-reply` | 1:1 게시글 답변 등록 | POST | `crm_board/reply` | write |  | supported | [↗](https://developer.makeshop.co.kr/docs/api/board/post-crm-board-reply) |
| `post-crm_board-update` | 1:1 게시글 수정 | POST | `crm_board/update` | write |  | supported | [↗](https://developer.makeshop.co.kr/docs/api/board/post-crm-board-update) |
| `post-review-delete` | 코멘트 평점타입 후기 삭제 | POST | `review/delete` | write |  | supported | [↗](https://developer.makeshop.co.kr/docs/api/board/post-review-delete) |
| `post-review-store` | 코멘트 평점타입 후기 등록 | POST | `review/store` | write |  | supported | [↗](https://developer.makeshop.co.kr/docs/api/board/post-review-store) |
