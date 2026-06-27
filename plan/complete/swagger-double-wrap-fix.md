---
worktree: swagger-paginated-wrap
started: 2026-06-27
owner: developer
status: complete
completed: 2026-06-27
spec_impact:
  - spec/conventions/swagger.md
base: origin/main @ 301b16fda (#722 포함)
source: nav-spec-doc-fix(#722) §5 검증 중 발견 — paginated 응답 swagger double-wrap (ModelListDto #721 동형)
---

# paginated 응답 swagger double-wrap → single-wrap 정합

## 버그

`wrapPaginatedSchema`(`api-wrapped.ts`)가 paginated 응답을 **double-wrap**
`{ data: { data: <ref>[], pagination } }` 로 문서화하나, 실제 wire 는 **single-wrap**
`{ data: <ref>[], pagination }`. `PaginatedResponseDto`(`{data, pagination}` 2 top-level 키)를
`TransformInterceptor` 가 pass-through(`'data' in data` → 그대로) 하기 때문. `swagger.md §6` 은
이미 single-wrap 이 정답이라 명시 — §5-2 만 outlier.

## 안전성 (조사 확인)

`ApiOkPaginatedResponse` **15개 사용처 전부** `PaginatedResponseDto.create()` 반환 → single-wrap.
예외 0 (bare array·`{items}`·진짜 double-wrap 없음). snapshot/e2e 가 old shape 핀 없음. frontend
무영향(doc/schema-only). → 헬퍼 single-wrap 전환이 전 사용처에 안전.

## 수정 (3 파일)

- [x] `api-wrapped.ts` `wrapPaginatedSchema` body — 외곽 `data` 래퍼 제거, `data`+`pagination`
      top-level hoist. JSDoc(2곳) single-wrap 정정.
- [x] `api-wrapped.spec.ts` 테스트 — top-level shape 단언으로 갱신.
- [x] `spec/conventions/swagger.md §5-2` 표 — `{ data: <Dto>[], pagination }` 로 정정.

## 게이트

- [x] TEST WORKFLOW (lint·unit·build·e2e 215) PASS (구현 후 + resolution 후 2회)
- [x] /ai-review (19_31_47) → risk LOW, Critical 0, **Warning 0** (clean). cheap INFO(1·2·4·5) 반영(RESOLUTION.md)
- [x] consistency-check --impl-done spec/conventions/ (19_31_47) → **BLOCK NO**. WARNING W-1(§2-5 pass-through) 동일 브랜치 RESOLVED
- [x] fresh /ai-review (19_48_10) → Critical 0, **Warning 0** (clean) · fresh --impl-done (19_48_10) → **BLOCK NO, Warning 0** (W-1 RESOLVED). 잔여 INFO 전부 선택적/별 트랙

## 완료

paginated 응답 swagger single-wrap 정합 완료. 전 게이트 통과. 별 트랙(선택): api-convention §11.4/§5.2·channel-web-chat 의 "모든 응답 래핑" 일반 문구에 pass-through cross-ref(타 파일), wrapItemsSchema 테스트 통일, paginated e2e top-level 단언.

## 메모

- 순수 OpenAPI 메타데이터 + convention 정합. 런타임 byte-identical.
- spec_impact: 완료 시 `spec/conventions/swagger.md` 등재.
