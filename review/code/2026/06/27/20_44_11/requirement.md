# 요구사항(Requirement) Review

## 발견사항

변경 대상 4개 파일에 대해 관련 spec(`spec/conventions/swagger.md`, `spec/5-system/2-api-convention.md`) 및 `PaginatedResponseDto`/`PaginationMeta` 구현을 line-level 로 대조했다.

- **[INFO]** 수동 동기화 결합(structural coupling) — `wrapPaginatedSchema` 내 pagination 리터럴 필드·`example` 값이 `PaginationMeta` 클래스와 1:1 일치하나, 컴파일 타임에 강제되지 않는다. JSDoc NOTE 가 이 사실을 정확히 명시하므로 억압된 위험은 없다. 구조적 해결(`generateSchema(PaginationMeta)` 등)은 별도 태스크다.
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/swagger-passthrough-crossref/codebase/backend/src/common/swagger/api-wrapped.ts` L275–278 NOTE 블록
  - 상세: 현재 `page·limit·totalItems·totalPages` 네 필드와 각 `example`(1, 20, 123, 7)이 `PaginationMeta` `@ApiProperty` example 과 정확히 일치한다. 향후 필드 추가·삭제 시 NOTE 를 무시하면 drift 가 발생할 수 있다. INFO 수준 — 코드 결함 아님.

추가 이슈 없음.

## 상세 항목별 점검

### 1. 기능 완전성

**`api-wrapped.spec.ts` 변경** (`wrapItemsSchema` 테스트에 `schema.type`·`schema.required` 단언 추가):
- 구현 반환값: `{ type: 'object', required: ['data'], properties: { data: { type: 'array', items: ... } } }` — 두 단언이 정확히 일치한다.
- 기존 `wrapDataSchema` / `wrapOneOfDataSchema` / `wrapPaginatedSchema` 테스트 모두 top-level `type`·`required` 를 이미 단언한다. `wrapItemsSchema` 도 동일한 수준으로 맞춰짐 — 4 헬퍼 테스트 패리티 완성.

**`api-wrapped.ts` 변경** (JSDoc NOTE 추가만, 구현 로직 무변경):
- 기능 변경 없음. 문서화 하드닝.

**`spec/5-system/2-api-convention.md` 변경** (§5.2 아래 cross-ref 블록쿼트 추가):
- spec 설명 보강. 기존 §5.2 JSON 예시(`data`·`pagination` top-level)와 일관됨.
- `[Swagger 규약 §2-5 응답 wrapping](../conventions/swagger.md#2-5-응답-wrapping)` 링크 대상이 `spec/conventions/swagger.md § 2-5` 에 실제 존재한다.

### 2. 엣지 케이스

추가된 단언 `expect(schema.type).toBe('object')`·`expect(schema.required).toEqual(['data'])` 는 경계값/null 이슈 없음 — `wrapItemsSchema` 는 인자 없이 호출할 수 없는 타입 서명(`dto: ClassRef<T>`)이고, 반환값은 리터럴 상수다.

### 3. TODO/FIXME

신규 코드에 TODO, FIXME, HACK, XXX 주석 없음.

### 4. 의도와 구현 간 괴리

- JSDoc NOTE 본문 "수동 동기화" 경고가 실제 구현 사실(pagination 서브스키마가 리터럴 하드코딩)과 정확히 일치한다.
- 테스트 케이스 설명 `'wrapItemsSchema builds { data: array($ref) }'` 와 단언 내용이 일치한다.

### 5. 에러 시나리오

변경 범위에 새 에러 경로 없음. `wrapItemsSchema` 는 기존과 동일하게 에러를 throw 하지 않는다(fail-fast 는 `wrapOneOfDataSchema` 의 빈 배열 케이스만, 이미 기존 코드에 있음).

### 6. 데이터 유효성

추가된 단언들은 유효성 검증이 아닌 출력 shape 검증이다 — 적절한 단위 테스트 역할.

### 7. 비즈니스 로직

**spec fidelity 점검:**

| 구현 | spec 근거 | 일치 여부 |
|------|-----------|-----------|
| `wrapItemsSchema` 반환 `{ type:'object', required:['data'], properties:{data:{type:'array',...}} }` | `swagger.md §5-2` 표: `ApiOkWrappedArrayResponse → { data: <Dto>[] }` | 일치 |
| `wrapPaginatedSchema` 반환 `{ data:[…], pagination:{page,limit,totalItems,totalPages} }` (single-wrap) | `swagger.md §5-2` 표 + `§Rationale §5` (single-wrap, pass-through) | 일치 |
| `pagination` 필드 네 개·example 값 | `PaginationMeta` `@ApiProperty example` (1, 20, 123, 7) | 일치 |
| `spec/5-system/2-api-convention.md §5.2` 크로스레퍼런스 | `swagger.md §2-5` `§Rationale §5` | 내용 일관 |

`spec/conventions/swagger.md §Rationale §5` 가 single-wrap 을 "실제 런타임·e2e·§5.2 모두 single-wrap" 으로 명시하고, 구현도 동일 — spec 과 코드 간 불일치 없음.

### 8. 반환값

변경 범위 내 함수 로직은 변경 없음. 모든 경로에서 `SchemaObject` 를 반환한다.

### 9. spec fidelity 종합

- `swagger.md §5-2` 헬퍼 표, `§2-5` pass-through 설명, `§Rationale §5` 단일 진실과 코드 구현이 line-level 로 일치한다.
- `spec/5-system/2-api-convention.md §5.2` 추가 노트가 swagger.md §2-5 링크와 정합됨.
- SPEC-DRIFT 없음, CRITICAL/WARNING 없음.

## 요약

이번 변경은 `wrapItemsSchema` 단위 테스트에 누락된 두 단언(`type`, `required`)을 추가해 4개 헬퍼 테스트의 shape 검증 수준을 통일하고, `wrapPaginatedSchema` JSDoc 에 수동 동기화 주의 NOTE 를 추가하며, `spec/5-system/2-api-convention.md §5.2` 에 pass-through 메커니즘 cross-ref 를 보강한 순수 하드닝 작업이다. 추가된 단언은 구현 반환값과 정확히 일치하고, JSDoc NOTE 는 구현 사실을 정확히 기술하며, spec cross-ref 는 `swagger.md §2-5·§Rationale §5` 와 내용이 일관된다. 요구사항 충족에 결함 없음.

## 위험도

NONE
