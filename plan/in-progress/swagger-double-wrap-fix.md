---
worktree: (unstarted)
started: 2026-06-27
owner: developer
status: backlog
base: TBD
source: nav-spec-doc-fix §5 검증 중 발견 (ModelListDto #721 와 동형 swagger↔wire 불일치)
---

# paginated 응답 swagger double-wrap 정합 (backlog)

## 버그

paginated list 응답의 **실제 wire shape 는 single-wrap** `{ data: [...], pagination: {...} }`
(`TransformInterceptor` 가 `data` 키 보유 객체를 pass-through; 핸들러가 `PaginatedResponseDto`
= `{data, pagination}` 반환; e2e 가 `res.body.data`·`res.body.pagination` top-level 단언;
`api-convention §5.2` 도 동일). 그러나 swagger 가 **double-wrap** 으로 잘못 문서화:

- `codebase/backend/src/common/swagger/api-wrapped.ts` — `wrapPaginatedSchema`(85–117)·
  `ApiOkPaginatedResponse`(194–205) 가 `{ data: { data: <ref>[], pagination } }` 스키마 선언.
- `spec/conventions/swagger.md §5-2`(≈265행) 가 동일 double-wrap 을 명문화.

#721 의 `ModelListDto` 버그와 동형 — swagger 가 outlier. OpenAPI codegen 클라이언트가
double-wrap 으로 오인할 위험.

## 할 일 (개발자 + convention)

- [ ] `wrapPaginatedSchema`/`ApiOkPaginatedResponse` 를 single-wrap `{ data: <ref>[], pagination }`
      스키마로 정정 (실제 wire shape 일치). 사용처 전수 영향 확인.
- [ ] `spec/conventions/swagger.md §5-2` 본문을 single-wrap 으로 정정 (코드와 동반).
- [ ] swagger 메타데이터 단위 검증(`api-wrapped.spec.ts`) 갱신.
- [ ] TEST WORKFLOW + /ai-review + (spec-linked) --impl-done.

## 메모

- 우선순위 LOW (문서/OpenAPI 메타데이터 정합, 런타임 무영향). `ApiOkPaginatedResponse`
  사용처가 많으면 영향 범위 큼 — 착수 시 grep 으로 사용처 확인 후 일괄.
- `spec_impact`: 완료 시 `spec/conventions/swagger.md` 등재.
