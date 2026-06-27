# 요구사항(Requirement) 리뷰

## 발견사항

- **[INFO]** `wrapPaginatedSchema` 에 null/undefined DTO 가드 미존재
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/swagger-paginated-wrap/codebase/backend/src/common/swagger/api-wrapped.ts` `wrapPaginatedSchema`
  - 상세: `dto` 인자에 `undefined`/`null` 이 전달될 경우 `getSchemaPath(dto)` 가 NestJS 내부 오류를 던진다. 그러나 이는 `wrapDataSchema`, `wrapItemsSchema` 등 동류 헬퍼가 공유하는 pre-existing 설계 — Swagger 설정이 모듈 초기화 시 한 번 실행되므로 오류가 조기에 노출된다. 이번 변경이 신규 도입한 문제가 아니다.
  - 제안: 현 변경 범위에서 조치 불필요. 전체 헬퍼 통일 시 별도 트랙.

- **[INFO]** pagination 서브스키마가 `PaginationMeta` DTO 와 수동 동기화 (SoT 분산) — 이미 RESOLUTION 에서 인식·deferred
  - 위치: `api-wrapped.ts` L363–370 (pagination properties 리터럴) vs `/Volumes/project/private/clemvion/.claude/worktrees/swagger-paginated-wrap/codebase/backend/src/common/dto/paginated-response.dto.ts` `PaginationMeta`
  - 상세: `PaginationMeta` 는 `page/limit/totalItems/totalPages` 4개 필드를 `@ApiProperty({ example })` 로 선언한다. `wrapPaginatedSchema` 의 인라인 리터럴(type·example)은 현 시점 완전히 일치하나, `PaginationMeta` 에 필드가 추가/변경되면 헬퍼를 수동으로 갱신해야 한다. RESOLUTION.md INFO 3 에서 이미 중기 tech-debt 로 인식했다.
  - 제안: 현 변경 범위에서 조치 불필요.

- **[INFO]** [SPEC-DRIFT] `spec/conventions/swagger.md §5-2` 표 셀 — 과거 double-wrap 관련 설명이 이전 리뷰 지적 대비 충분히 축약됐으나 여전히 괄호 주석이 다소 길다
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/swagger-paginated-wrap/spec/conventions/swagger.md` §5-2 `ApiOkPaginatedResponse` 행
  - 상세: RESOLUTION.md 에서 "셀 축약 + 근거는 §2-5 로 이전" 으로 조치했으며, 현재 셀은 `{ data: <Dto>[], pagination: { page, limit, totalItems, totalPages } }` 와 `§2-5 pass-through` 참조 포함 형태다. 코드 구현은 옳고, spec 표현 스타일 개선 여지만 남은 상태 — 코드 fix 대상이 아니라 spec 재작성 후보(선택).
  - 제안: 코드 유지. 향후 spec 편집 시 표 셀을 `{ data: <Dto>[], pagination }` 로 더 간략화하고 상세는 §2-5 로 완전 이전. 긴급하지 않음.

## spec fidelity 점검

참조 spec: `/Volumes/project/private/clemvion/.claude/worktrees/swagger-paginated-wrap/spec/conventions/swagger.md`

| 점검 항목 | spec 본문 | 코드 구현 | 결과 |
|-----------|-----------|-----------|------|
| `wrapPaginatedSchema` wire shape | §5-2: `{ data: <Dto>[], pagination: { page, limit, totalItems, totalPages } }` single-wrap | `required: ['data', 'pagination']`, `data: { type: 'array', items: { $ref } }`, `pagination: { required: [...4개...], properties: {...} }` | 일치 |
| pagination 필드 목록 | §5-2: `page, limit, totalItems, totalPages` | 리터럴에 4개 동일 | 일치 |
| pagination example 값 | `PaginationMeta @ApiProperty`: page=1, limit=20, totalItems=123, totalPages=7 | `api-wrapped.ts` 리터럴 동일 example | 일치 |
| pass-through 예외 | §2-5: "`'data' in data` 분기 → 추가 래핑 없이 pass-through" | `PaginatedResponseDto` 반환 시 TransformInterceptor 가 pass-through — 헬퍼 문서가 single-wrap 반영 | 일치 |
| 테스트 단언 | — | `expect(schema.type).toBe('object')`, `required` toEqual, `data` toEqual, `pagination` deep-equal | 구현과 완전 일치 |

## 요약

이번 변경(`wrapPaginatedSchema` double-wrap → single-wrap)은 의도한 기능(Swagger 문서를 실제 wire shape 와 정합)을 완전히 구현했다. 핵심 판단 근거는 `PaginatedResponseDto`(`{ data, pagination }` 2 top-level 키) + `TransformInterceptor` pass-through 로 인해 실제 런타임 wire shape 가 single-wrap 이라는 사실이며, 코드·테스트·spec(§2-5·§5-2·Rationale §5) 모두 일치한다. `PaginationMeta` 의 `page/limit/totalItems/totalPages` 4개 필드와 각 example 값이 `wrapPaginatedSchema` 인라인 리터럴과 정확히 일치한다. TODO/FIXME 없음. 모든 반환 경로에서 `SchemaObject` 가 올바르게 반환된다. 발견된 이슈는 모두 INFO 등급(기존 설계 공유 한계·SoT 분산 tech-debt·spec 표 스타일) 으로 이번 변경의 차단 요인이 없다.

## 위험도

NONE
