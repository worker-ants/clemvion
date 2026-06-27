---
worktree: swagger-passthrough-crossref
started: 2026-06-27
owner: developer
status: complete
completed: 2026-06-27
spec_impact:
  - spec/5-system/2-api-convention.md
base: origin/main @ 8c5fdf257 (#725 포함)
source: #723 swagger single-wrap 후속 (A: pass-through cross-ref / B: 테스트·JSDoc 하드닝)
---

# swagger pagination 후속 정합 (A + B)

#723 의 impl-done/ai-review 가 별 트랙으로 남긴 swagger pagination 후속. **A 검증 결과 대부분 false-positive** —
실제 적용은 §5.2 cross-ref 1건 + B 테스트/JSDoc 하드닝.

## A — pass-through cross-ref (검증 후 1건만)

- **§11.4 / channel-web-chat R5 = FALSE POSITIVE, 미수정**: 둘 다 **비-paginated 도메인**(webhook 단일객체
  응답 / 위젯의 단일객체 엔드포인트)이라 "모든 응답 {data} 래핑" 이 context-accurate. pagination pass-through
  주석은 noise. (graph-rag dual-overview 와 동류 오탐.)
- **§5.2 (목록 응답) = 1줄 cross-ref 추가** (적용): `data`·`pagination` top-level 형제인 이유(PaginatedResponseDto
  pass-through, §5.1 단일객체와 대비) + `swagger.md §2-5` 링크. 목록 섹션이라 pass-through 가 실제 관련.

## B — 테스트/JSDoc 하드닝

- [x] `api-wrapped.spec.ts` `wrapItemsSchema` 테스트에 `schema.type`·`schema.required` 단언 추가 — 4헬퍼 테스트 통일(#723 ai-review INFO 4).
- [x] `wrapPaginatedSchema` JSDoc 에 `pagination` 리터럴 ↔ `PaginatedResponseDto` 수동 동기화 NOTE 추가(#723 INFO 2/3).
- [x] paginated e2e top-level 단언 — **이미 존재**(`agent-memory-admin.e2e-spec` 가 `body.pagination.totalItems`·`body.data` 단언). 신규 불요.

## 게이트

- [x] TEST WORKFLOW (lint·unit·build·e2e 215) PASS (구현 후 + resolution 후)
- [x] /ai-review (20_44_11) → LOW, Critical 0, **Warning 1**(pagination drift) → drift-guard 테스트 + JSDoc 보강(RESOLUTION.md)
- [x] consistency-check --impl-done spec/conventions/ (20_44_11) → **BLOCK NO**. Warning(swagger.md Overview 부재)은 미변경 파일 pre-existing → out-of-scope
- [x] fresh /ai-review (21_00_38) → Critical 0, **Warning 0** (clean) · fresh --impl-done (21_00_38) → **BLOCK NO**. WARNING(cafe24 application.md 명명)은 무관 pre-existing → out-of-scope

## 완료

A(§5.2 cross-ref, §11.4/channel-web-chat 는 false-positive 미수정) + B(wrapItemsSchema 테스트·JSDoc·drift-guard) 완료. 전 게이트 통과. C(plan 위생)는 별 PR.

## 메모

- spec_impact: spec/5-system/2-api-convention.md (완료 시).
- C(plan 위생)는 별 PR.
