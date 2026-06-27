### 발견사항

- **[INFO]** `wrapPaginatedSchema` 테스트에 `schema.type` 단언 누락
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/swagger-paginated-wrap/codebase/backend/src/common/swagger/api-wrapped.spec.ts` 라인 85-102
  - 상세: `wrapDataSchema`(라인 27)와 `wrapOneOfDataSchema`(라인 44) 테스트는 모두 `expect(schema.type).toBe('object')`를 단언하는데, 변경된 `wrapPaginatedSchema` 테스트는 이 단언이 없다. 구현은 `type: 'object'`를 반환하므로 실제 갭이 존재한다.
  - 제안: `expect(schema.required).toEqual(...)` 직전에 `expect(schema.type).toBe('object')` 추가.

- **[INFO]** `pagination` 하위 스키마 단언이 `required` 배열만 검증 — `type`·개별 필드 누락
  - 위치: 같은 파일 라인 95-101
  - 상세: `data` 속성은 `toEqual({type:'array', items:...})` 로 전체 형태를 검증(양호)하지만, `pagination`은 `required` 배열만 확인한다. `pagination.type === 'object'` 여부, 그리고 `page`/`limit`/`totalItems`/`totalPages` 각 필드의 `type: 'integer'`·`example` 값은 단언하지 않는다. 구현이 변경되어도 이 부분의 회귀는 잡히지 않는다.
  - 제안: `expect(properties.pagination).toEqual({ type: 'object', required: [...], properties: { page: { type: 'integer', example: 1 }, ... } })` 형태의 deep-equal 단언으로 교체.

- **[INFO]** `ApiOkPaginatedResponse` 데코레이터 함수 자체에 대한 테스트 부재
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/swagger-paginated-wrap/codebase/backend/src/common/swagger/api-wrapped.ts` 라인 428-436
  - 상세: `ApiOkWrappedResponse`, `ApiOkWrappedOneOfResponse` 등 다른 데코레이터도 마찬가지지만, `ApiOkPaginatedResponse`는 `applyDecorators(ApiExtraModels(dto), ApiOkResponse({schema: wrapPaginatedSchema(dto)}))` 조합이다. `ApiExtraModels` 등록 여부·`ApiOkResponse` schema 전달이 올바른지는 현재 테스트로 검증되지 않는다. 단순 thin-wrapper이므로 중간 우선순위.
  - 제안: NestJS 테스트 환경(`@nestjs/testing` + `SwaggerModule.createDocument`)으로 실제 생성 OpenAPI 스펙 JSON을 확인하는 integration 테스트 1건 추가 고려. 단기적으로는 현재 스코프 외.

- **[INFO]** 15개 사용처 안전성 검증이 수동 grep 기반 — 자동화 커버리지 없음
  - 위치: `plan/in-progress/swagger-double-wrap-fix.md` "안전성" 섹션
  - 상세: plan에서 사용처 전수 확인을 `grep` 으로 했다고 기록하나, 실제 생성된 Swagger JSON이 single-wrap인지 검증하는 자동화 테스트(e2e 또는 snapshot)가 없다. 런타임 무영향이기 때문에 즉각 위험은 없으나, 장기적으로 누군가 `TransformInterceptor` pass-through 로직을 변경하면 silent 불일치가 재발할 수 있다.
  - 제안: 페이지네이션 엔드포인트 e2e 테스트에서 `res.body.data` / `res.body.pagination` top-level 단언 1건 이상 명시적으로 포함하는 것을 권장 (현재 e2e 215건에 이 단언이 이미 있을 가능성 있으나 plan에서 확인 기록 없음).

---

### 요약

이번 변경의 핵심은 `wrapPaginatedSchema` double-wrap 버그 수정이며, 테스트(`api-wrapped.spec.ts`)도 새 single-wrap 형태에 맞게 올바르게 갱신되었다. 테스트명에 "(single-wrap)" 추가 및 설명 주석 삽입으로 의도 가독성도 향상되었다. 다만 `schema.type` 단언 누락, `pagination` 하위 스키마의 shallow 단언, 데코레이터 레이어의 테스트 부재 등 INFO 수준의 커버리지 갭이 존재한다. 변경 자체가 순수 OpenAPI 메타데이터(런타임 byte-identical)이고 기존 e2e 215건이 PASS한 상태이므로 실질 위험은 낮다.

### 위험도
LOW
