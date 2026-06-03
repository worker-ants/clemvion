---
id: makeshop-board
status: spec-only
code: []
pending_plans:
  - plan/in-progress/makeshop-integration.md
---

# Makeshop API Catalog — 게시판 (Board)

> 상위: [`_overview.md`](./_overview.md) · 전체 스키마(요청/응답 필드): [`openapi/board.openapi.json`](./openapi/board.openapi.json)

공통 prefix `/api/v1/{shopId}/` 는 `path` 컬럼에서 생략. 인증 `bearerAuth`. 본 표는 메이크샵 공식 문서에서 자동 추출한 **구현 전 레퍼런스**다 (우리 백엔드 메타데이터 미존재 → status/sync test 없음).

## REST endpoints (12)

| id | 라벨 (한) | method | path | 권한 (x-scope) | docs |
|----|-----------|--------|------|----------------|------|
| `get-board` | 게시글 조회 | GET | `board` | 게시판 | [↗](https://developer.makeshop.co.kr/docs/api/board/get-board) |
| `get-board_code` | 등록 게시판 조회 | GET | `board_code` | 게시판 | [↗](https://developer.makeshop.co.kr/docs/api/board/get-board-code) |
| `get-comment` | 게시글 댓글 조회 | GET | `comment` | 게시판 | [↗](https://developer.makeshop.co.kr/docs/api/board/get-comment) |
| `get-crm_board` | 1:1 게시판 조회 | GET | `crm_board` | 게시판 | [↗](https://developer.makeshop.co.kr/docs/api/board/get-crm-board) |
| `get-review` | 코멘트 평점타입 후기 조회 | GET | `review` | 게시판 | [↗](https://developer.makeshop.co.kr/docs/api/board/get-review) |
| `post-board-store` | 게시글 등록/수정/삭제 | POST | `board/store` | 게시판 | [↗](https://developer.makeshop.co.kr/docs/api/board/post-board-store) |
| `post-comment-store` | 게시글 댓글 등록/수정/삭제 | POST | `comment/store` | 게시판 | [↗](https://developer.makeshop.co.kr/docs/api/board/post-comment-store) |
| `post-crm_board-create` | 1:1 게시글 등록 | POST | `crm_board/create` | 게시판 | [↗](https://developer.makeshop.co.kr/docs/api/board/post-crm-board-create) |
| `post-crm_board-reply` | 1:1 게시글 답변 등록 | POST | `crm_board/reply` | 게시판 | [↗](https://developer.makeshop.co.kr/docs/api/board/post-crm-board-reply) |
| `post-crm_board-update` | 1:1 게시글 수정 | POST | `crm_board/update` | 게시판 | [↗](https://developer.makeshop.co.kr/docs/api/board/post-crm-board-update) |
| `post-review-delete` | 코멘트 평점타입 후기 삭제 | POST | `review/delete` | 게시판 | [↗](https://developer.makeshop.co.kr/docs/api/board/post-review-delete) |
| `post-review-store` | 코멘트 평점타입 후기 등록 | POST | `review/store` | 게시판 | [↗](https://developer.makeshop.co.kr/docs/api/board/post-review-store) |
