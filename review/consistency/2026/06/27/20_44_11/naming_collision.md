# 신규 식별자 충돌 검토 — swagger-passthrough-crossref

검토 대상 변경 (origin/main 대비):
- `spec/5-system/2-api-convention.md` — §5.2 cross-ref 단락 2줄 추가
- `codebase/backend/src/common/swagger/api-wrapped.ts` — JSDoc NOTE 4줄 추가
- `codebase/backend/src/common/swagger/api-wrapped.spec.ts` — `wrapItemsSchema` 단언 2줄 추가
- `plan/in-progress/swagger-pagination-followups.md` — 신규 plan 파일

기존 컨텍스트 (`spec/conventions/` 전체) 와 대조.

---

## 발견사항

이 PR 이 도입하는 신규 식별자는 아래 세 범주에 한정된다.

### 1. spec anchor 참조 `#2-5-응답-wrapping`

- target 신규 식별자: `spec/5-system/2-api-convention.md` §5.2 단락의 `[Swagger 규약 §2-5 응답 wrapping](../conventions/swagger.md#2-5-응답-wrapping)`
- 기존 사용처: `spec/conventions/swagger.md` line 204 `### 2-5. 응답 wrapping`
- 상세: 신규 cross-ref 가 가리키는 anchor 가 swagger.md 에 이미 존재하며, PR 이 그 anchor 를 새로 정의하는 것이 아니라 참조만 하는 것. 충돌 없음.
- 제안: 해당 없음.

### 2. 타입명 `PaginatedResponseDto` / `PaginationMeta`

- target 신규 식별자: `api-wrapped.ts` JSDoc 에서 처음 주석으로 언급되는 두 이름
- 기존 사용처: `codebase/backend/src/common/dto/paginated-response.dto.ts` — `PaginationMeta` (line 3), `PaginatedResponseDto` (line 17) 로 이미 정의·사용 중
- 상세: JSDoc 가 기존 타입명을 설명 목적으로 인용하는 것이므로 충돌이 아님. 명칭도 기존 구현과 일치.
- 제안: 해당 없음.

### 3. plan 파일 `swagger-pagination-followups`

- target 신규 식별자: `plan/in-progress/swagger-pagination-followups.md`
- 기존 사용처: `plan/in-progress/` 디렉토리에 동일 이름 없음 (확인 완료)
- 상세: 기존 plan 파일과 이름 중복 없음. `plan/complete/` 에도 없음.
- 제안: 해당 없음.

---

## 요약

이 PR 은 신규 식별자를 창출하지 않는다. `spec/5-system/2-api-convention.md` §5.2 에 추가된 단락은 이미 `spec/conventions/swagger.md §2-5` 에 정의된 anchor 를 참조할 뿐이고, `api-wrapped.ts` JSDoc 은 이미 `paginated-response.dto.ts` 에 존재하는 `PaginatedResponseDto`/`PaginationMeta` 를 인용한다. 새로 등록되는 plan 파일 이름도 기존과 중복이 없다. `spec/conventions/` 전체와의 충돌 검토 결과 이름·ID·endpoint·이벤트·환경변수·파일 경로 어느 관점에서도 충돌이 발견되지 않았다.

## 위험도

NONE
