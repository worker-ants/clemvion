# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[INFO]** pagination 서브 스키마가 `PaginatedResponseDto`와 수동 동기화 필요
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/swagger-paginated-wrap/codebase/backend/src/common/swagger/api-wrapped.ts` — `wrapPaginatedSchema` 내 `pagination.properties` 블록 (page/limit/totalItems/totalPages + example 값)
  - 상세: `PaginatedResponseDto`의 필드 구성·예시값이 변경되면 `wrapPaginatedSchema` 의 인라인 schema object도 수동으로 업데이트해야 한다. 현재는 단일 진실 원칙(SoT)이 `PaginatedResponseDto` 클래스와 이 스키마 리터럴 두 곳에 분산되어 있어, 필드 추가·이름 변경 시 drift 위험이 있다.
  - 제안: 단기적으로는 JSDoc에 "PaginatedResponseDto 필드 변경 시 여기도 동기화 필요" 주석을 명시한다. 중기적으로는 `PaginatedResponseDto`에 `@ApiProperty`를 선언하고 `getSchemaPath(PaginatedResponseDto)`로 참조하거나, 테스트에서 DTO 필드와 스키마를 교차 검증하는 assertion을 추가하면 drift를 방지할 수 있다.

- **[INFO]** spec 표 셀이 과도하게 길어 가독성 저하
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/swagger-paginated-wrap/spec/conventions/swagger.md` §5-2 표, `ApiOkPaginatedResponse` 행
  - 상세: 반환 스키마 설명 셀에 단순 shape 표기에 더해 TransformInterceptor 동작 원리까지 인라인으로 포함되어 표가 매우 길어졌다. Markdown 표는 좁은 뷰포트에서 깨지기 쉽고, 동작 원리 설명은 표보다 하위 Rationale 또는 각주 섹션이 더 적합하다.
  - 제안: 셀에는 `{ data: <Dto>[], pagination: { page, limit, totalItems, totalPages } }` (single-wrap)만 기록하고, TransformInterceptor pass-through 근거는 Rationale 절 또는 §5-2 아래 단락에 서술한다.

- **[INFO]** 테스트에서 `schema.type` assertion 누락
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/swagger-paginated-wrap/codebase/backend/src/common/swagger/api-wrapped.spec.ts` — `wrapPaginatedSchema matches PaginatedResponseDto shape (single-wrap)` 테스트 (138–154행)
  - 상세: `wrapDataSchema`, `wrapOneOfDataSchema` 테스트는 `schema.type === 'object'`를 명시적으로 단언하는 반면, `wrapPaginatedSchema` 테스트는 이 assertion이 빠져 있다. 일관성 측면에서 미완성이며, 나중에 `type` 을 제거하거나 오타가 생겨도 테스트가 잡지 못한다.
  - 제안: `expect(schema.type).toBe('object');` 를 테스트 상단에 추가한다.

## 요약

이번 변경은 `wrapPaginatedSchema`의 double-wrap 버그를 single-wrap으로 정정하는 집중적이고 범위가 명확한 리팩터링이다. 코드 자체는 중첩 깊이가 오히려 줄었고, JSDoc이 변경 이유(TransformInterceptor pass-through 동작)를 충분히 설명하며, 네이밍과 구조는 기존 헬퍼 패턴과 일관된다. 발견된 사항은 모두 INFO 등급으로, 미래 유지보수 시 수동 동기화 부담(pagination 서브스키마 drift)과 spec 표 가독성 저하가 가장 주의할 점이다. 즉각적인 수정 없이도 운영 가능하나, pagination 서브스키마 SoT 분산 문제는 중기적으로 해소할 것을 권장한다.

## 위험도

LOW
