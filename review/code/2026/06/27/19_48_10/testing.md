# 테스트(Testing) 리뷰

## 발견사항

- **[INFO]** `wrapItemsSchema` 테스트의 `schema.type` / `schema.required` 단언 누락 — sibling 불일치 (pre-existing)
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/swagger-paginated-wrap/codebase/backend/src/common/swagger/api-wrapped.spec.ts` L107–113
  - 상세: 이번 변경으로 `wrapPaginatedSchema` 테스트에는 `expect(schema.type).toBe('object')` 및 `expect(schema.required).toEqual(['data', 'pagination'])` 가 추가되어 sibling 테스트(`wrapDataSchema`, `wrapOneOfDataSchema`)와 일관성이 맞춰졌다. 그러나 `wrapItemsSchema` 테스트는 여전히 `schema.properties?.data` 만 단언하고 `type`·`required` 를 검증하지 않는다. 이번 변경이 신규 도입한 문제는 아니나, 같은 파일 내 일관성 측면에서 노출된다.
  - 제안: `wrapItemsSchema` 테스트에 `expect(schema.type).toBe('object')` 및 `expect(schema.required).toEqual(['data'])` 를 추가하면 전체 4개 헬퍼 테스트의 구조가 통일됨. 현 PR 범위 밖이면 별도 minor 정비 트랙으로 처리 가능.

- **[INFO]** `ApiOkPaginatedResponse` 데코레이터 통합 테스트 부재 (pre-existing, 이전 리뷰 INFO 6 인계)
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/swagger-paginated-wrap/codebase/backend/src/common/swagger/api-wrapped.ts` `ApiOkPaginatedResponse` (L453–461)
  - 상세: `wrapPaginatedSchema` 스키마 빌더 단위 테스트는 충분하지만, 실제 NestJS 데코레이터가 클래스 메타데이터에 올바른 OpenAPI 스키마를 부착하는지 확인하는 통합 테스트가 없다. `ApiExtraModels` + `ApiOkResponse` 조합이 실제 Swagger 문서 생성 파이프라인 안에서 의도대로 동작하는지 검증되지 않는다.
  - 제안: 별 트랙(향후). 현재 단위 커버리지가 스키마 빌더의 출력을 완전히 검증하므로 차단 이슈 아님.

- **[INFO]** paginated e2e 응답의 top-level 단언 자동화 부재 (pre-existing, 이전 리뷰 INFO 7 인계)
  - 위치: e2e 테스트 스위트 (paginated 엔드포인트)
  - 상세: 실제 e2e 가 `res.body.data[]` / `res.body.pagination` top-level 형태를 명시적으로 단언하는 케이스가 있는지 불분명하다. wire shape 버그(double-wrap)가 발생했던 원인 중 하나가 e2e 단언이 구체적이지 않았기 때문일 수 있다. plan 메모 "e2e 가 `res.body.data`·`res.body.pagination` top-level 단언"이 실제로 명시적 구조 검증인지 확인이 필요하다.
  - 제안: paginated 응답을 반환하는 e2e 케이스 최소 1개에 `expect(res.body.data).toBeInstanceOf(Array)` / `expect(res.body.pagination).toHaveProperty('totalItems')` 수준의 명시적 top-level 구조 단언 추가 권장. 별 트랙(향후).

## 긍정적 발견

- **테스트 정합성**: `wrapPaginatedSchema` 테스트가 구현 변경(double-wrap → single-wrap)을 완전히 반영하여 구현과 테스트 간 drift 없음.
- **deep-equal 강화**: 이전 리뷰(INFO 1·2) 조치로 `expect(schema.type).toBe('object')`, `pagination` 서브스키마 deep-equal(`type`, `required`, 각 필드 `example` 포함) 단언이 추가되어 회귀 감지 능력이 향상됨.
- **테스트 가독성**: 인라인 주석("// single-wrap: ... pass-through 하므로 외곽 data 래퍼가 없다")이 '왜' 이 형태인지 맥락을 명확히 설명함.
- **테스트 격리**: 각 케이스가 독립적으로 스키마를 생성하고 어떠한 공유 상태도 없음. 순서 의존성 없이 병렬 실행 가능.
- **테스트 용이성**: `wrapPaginatedSchema` 는 순수 함수(pure function) — 부작용 없고 의존성 주입 불필요. 현재 구조가 단위 테스트에 최적.
- **회귀 테스트 유효성**: RESOLUTION.md 기준 resolution 후 378 suites 통과 + e2e 215 통과 확인.

## 요약

이번 변경의 테스트 품질은 양호하다. `wrapPaginatedSchema` 테스트가 실제 single-wrap wire shape 를 정확히 단언하도록 수정되었고, 이전 리뷰 INFO 1·2 조치로 `schema.type` 및 `pagination` deep-equal 강화도 반영되어 회귀 감지 능력이 충분하다. 발견된 이슈는 모두 INFO 등급으로, `wrapItemsSchema` 테스트 구조의 sibling 불일치가 가장 주목할 점이나 이번 변경이 신규 도입한 문제는 아니다. 데코레이터 통합 테스트 및 e2e top-level 구조 단언은 선행 리뷰에서 이미 "별 트랙" 으로 처리된 항목이다.

## 위험도

LOW
