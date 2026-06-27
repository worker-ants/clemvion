# 신규 식별자 충돌 검토 — swagger-passthrough-crossref (fresh review)

검토 대상 변경 (origin/main 대비, 2개 커밋 합산):
- `spec/5-system/2-api-convention.md` — §5.2 cross-ref 단락 2줄 추가
- `codebase/backend/src/common/swagger/api-wrapped.ts` — JSDoc NOTE 4줄 추가
- `codebase/backend/src/common/swagger/api-wrapped.spec.ts` — `PaginatedResponseDto` import 추가 + `wrapItemsSchema` 단언 2줄 + drift-guard `it()` 블록 신규
- `plan/in-progress/swagger-pagination-followups.md` — 신규 plan 파일

기존 컨텍스트 (`spec/conventions/` 전체) 와 대조. `spec/conventions/` 에 대한 변경은 없음.

---

## 발견사항

이 PR 이 도입하는 신규 식별자는 아래 세 범주에 한정된다.

### 1. spec anchor 참조 `#2-5-응답-wrapping`

- target 신규 식별자: `spec/5-system/2-api-convention.md` §5.2 단락의 `[Swagger 규약 §2-5 응답 wrapping](../conventions/swagger.md#2-5-응답-wrapping)`
- 기존 사용처: `/Volumes/project/private/clemvion/spec/conventions/swagger.md` line 204 `### 2-5. 응답 wrapping`
- 상세: 신규 cross-ref 가 가리키는 anchor 가 swagger.md 에 이미 존재하며, PR 이 그 anchor 를 새로 정의하는 것이 아니라 참조만 하는 것. 충돌 없음.
- 제안: 해당 없음.

### 2. 타입명 `PaginatedResponseDto` / `PaginationMeta`

- target 신규 식별자: `api-wrapped.ts` JSDoc NOTE 및 `api-wrapped.spec.ts` import 에서 처음 명시되는 두 이름
- 기존 사용처: `/Volumes/project/private/clemvion/codebase/backend/src/common/dto/paginated-response.dto.ts` — `PaginationMeta` (line 3), `PaginatedResponseDto` (line 17) 로 이미 정의·사용 중. `spec/conventions/swagger.md` line 265·317 에서도 이미 인용됨.
- 상세: JSDoc 와 import 가 기존 타입명을 설명·참조 목적으로 인용하는 것이며, 명칭도 기존 구현과 완전히 일치. 충돌 없음.
- 제안: 해당 없음.

### 3. plan 파일 `swagger-pagination-followups`

- target 신규 식별자: `plan/in-progress/swagger-pagination-followups.md`
- 기존 사용처: `plan/in-progress/` 에 동일 이름 없음. `plan/complete/` 에는 `swagger-double-wrap-fix.md`·`mc-modellistdto-swagger-fix.md` 가 있으나 이름이 다름.
- 상세: 기존 plan 파일과 이름 중복 없음. 충돌 없음.
- 제안: 해당 없음.

### 4. 드리프트 가드 테스트 (`api-wrapped.spec.ts` 신규 `it()`)

- target 신규 식별자: 두 번째 커밋(dc2708442)이 추가한 `'wrapPaginatedSchema pagination keys stay in sync with PaginatedResponseDto runtime shape'` 테스트 설명 + `runtimeKeys`·`pagination` 지역 변수
- 기존 사용처: 해당 describe 블록에 같은 이름의 테스트 없음. 지역 변수명도 해당 스코프 내 한정.
- 상세: 테스트 description 문자열·지역 변수는 공개 식별자 레지스트리(spec ID·endpoint·타입명·이벤트명·환경변수)에 해당하지 않음. 충돌 없음.
- 제안: 해당 없음.

---

## 요약

이 PR 은 신규 공개 식별자를 창출하지 않는다. `spec/5-system/2-api-convention.md` §5.2 에 추가된 단락은 이미 `spec/conventions/swagger.md §2-5` (line 204)에 존재하는 anchor 를 참조만 한다. `api-wrapped.ts` JSDoc 과 `api-wrapped.spec.ts` import 는 `paginated-response.dto.ts` 에 기 정의된 `PaginatedResponseDto`/`PaginationMeta` 를 인용한다. 신규 plan 파일 이름은 `plan/in-progress/`·`plan/complete/` 양쪽에서 중복이 없다. 드리프트 가드 테스트(두 번째 커밋)가 추가한 내용도 공개 식별자 범주에 해당하지 않는다. `spec/conventions/` 전체와의 충돌 검토 결과 이름·ID·endpoint·이벤트·환경변수·파일 경로 어느 관점에서도 충돌이 발견되지 않았다.

## 위험도

NONE
