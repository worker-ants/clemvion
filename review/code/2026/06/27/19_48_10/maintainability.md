# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[INFO]** pagination 서브스키마가 `PaginatedResponseDto` 와 수동 동기화 필요 (pre-existing, 이전 세션 INFO 3 이월)
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/swagger-paginated-wrap/codebase/backend/src/common/swagger/api-wrapped.ts` — `wrapPaginatedSchema` 내 `pagination.properties` 블록 (page/limit/totalItems/totalPages + example 값, L360–368)
  - 상세: `PaginatedResponseDto` 의 필드 구성·예시값이 변경되면 `wrapPaginatedSchema` 의 인라인 스키마 리터럴도 수동으로 업데이트해야 한다. 단일 진실 원칙(SoT) 이 `PaginatedResponseDto` 클래스와 이 스키마 리터럴 두 곳에 분산된 상태다. resolution 에서 "중기 tech-debt" 로 분류·보류 결정된 항목이나, 현 상태에서 drift 방어 수단이 없으므로 이월 기록.
  - 제안: 단기 — JSDoc 에 `// NOTE: PaginatedResponseDto 필드 변경 시 여기도 동기화 필요` 주석 추가. 중기 — `PaginatedResponseDto` 에 `@ApiProperty` 를 선언하고 `getSchemaPath(PaginatedResponseDto)` 로 참조하거나, 테스트에서 DTO 필드와 스키마를 교차 검증하는 assertion 을 추가해 drift 를 자동 감지.

- **[INFO]** `wrapPaginatedSchema` JSDoc 의 역사 맥락 문장이 장기적으로 잡음이 될 가능성
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/swagger-paginated-wrap/codebase/backend/src/common/swagger/api-wrapped.ts` `wrapPaginatedSchema` JSDoc 마지막 문장 — "(종전 헬퍼는 외곽 `data` 를 한 겹 더 씌운 double-wrap 으로 런타임과 불일치했다.)"
  - 상세: 수정 직후에는 의사결정 맥락으로 유용하나, 시간이 지나면 "종전 헬퍼" 언급이 읽는 사람에게 혼란을 줄 수 있다. 변경 이력은 git blame·PR 번호로 충분히 추적 가능하다.
  - 제안: 우선순위 낮음(LOW). 향후 정리 시 해당 괄호 문장을 제거하고 핵심 동작 설명(`TransformInterceptor` pass-through 조건) 만 남기는 것으로 충분.

## 긍정적 발견

- **단순화**: `wrapPaginatedSchema` 에서 외곽 `data` 래퍼가 제거되어 중첩 깊이가 2단 → 1단으로 줄었다. 스키마 리터럴을 읽고 이해하는 부담이 명확히 감소했다.
- **일관성**: 수정 후 함수 구조가 `wrapDataSchema` / `wrapItemsSchema` 패턴과 일치하여 파일 내 코드베이스 스타일 통일성이 향상됐다.
- **테스트 완결성**: 이번 resolution 에서 `expect(schema.type).toBe('object')` 추가 및 `pagination` deep-equal 단언이 적용되어 `wrapDataSchema`·`wrapOneOfDataSchema` 테스트와 동일한 커버리지 수준을 달성했다.
- **JSDoc 동기화**: `wrapPaginatedSchema` 함수 정의부 및 `ApiOkPaginatedResponse` 상위 JSDoc 2곳 모두 single-wrap 으로 갱신되어 코드-문서 drift 가 없다.
- **명확한 테스트 이름**: `(single-wrap)` suffix 와 인라인 주석이 "왜 top-level 인가"를 독자에게 즉시 전달한다.

## 요약

이번 변경(resolution 포함)은 `wrapPaginatedSchema` 의 double-wrap 버그를 single-wrap 으로 교정하는 집중적이고 범위가 명확한 수정이다. 코드 중첩 깊이가 실질적으로 줄었고, JSDoc 이 변경 이유를 충분히 설명하며, 네이밍과 구조는 기존 헬퍼 패턴과 일관된다. 이전 세션에서 지적된 `schema.type` 단언 누락과 `pagination` 서브스키마 얕은 단언 모두 resolution 에서 이미 적용되어 테스트 일관성도 확보됐다. 잔여 사항은 pagination 서브스키마 SoT 분산(이월 INFO) 과 JSDoc 역사 문장(저우선순위) 두 항목뿐으로, 즉각 차단이 필요한 발견은 없다.

## 위험도

LOW
