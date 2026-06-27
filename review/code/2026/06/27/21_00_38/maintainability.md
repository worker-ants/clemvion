# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[INFO]** drift-guard 테스트의 타입 캐스트 — 컴파일 타임 안전성 부분 누락
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/swagger-passthrough-crossref/codebase/backend/src/common/swagger/api-wrapped.spec.ts` L191-195 (`pagination` 변수 캐스트 블록)
  - 상세: `wrapPaginatedSchema(SampleDto).properties?.pagination as { properties: Record<string, unknown>; required: string[] }` 캐스트는 `SchemaObject`의 `properties` 키 타입(`{ [key: string]: SchemaObject | ReferenceObject }`)과 달라 런타임에만 검증된다. `?.pagination` 체이닝 후 캐스트이므로 `pagination` 키 자체가 제거돼도 TypeScript 오류가 아닌 런타임 `undefined` 에러로만 감지된다. 테스트 전용 코드라 위험도는 낮으나, 향후 `SchemaObject` 타입에서 직접 접근하거나 `expect(pagination).toBeDefined()` 단언을 선행하면 실패 원인 명확성이 올라간다.
  - 제안: `expect(pagination).toBeDefined();`를 캐스트 직후에 추가하거나, `assert(pagination !== undefined)` TypeScript 5 assert 패턴을 사용하면 의도 불명확한 `undefined` pass-through를 방지할 수 있다. (선택 사항)

- **[INFO]** drift-guard 테스트 — 키 이름만 검증하고 필드 타입·example 값 미검증
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/swagger-passthrough-crossref/codebase/backend/src/common/swagger/api-wrapped.spec.ts` L196-197
  - 상세: `Object.keys(pagination.properties).sort()` 비교는 필드 추가/삭제 drift를 잡지만, 필드 타입이 `integer` → `string`으로 변경되거나 `example` 값이 바뀐 경우는 감지하지 못한다. 현재 pagination 4 필드는 모두 `integer` 타입으로 안정적이어서 즉각적 위험은 없다. 이미 `wrapPaginatedSchema matches PaginatedResponseDto shape` 테스트에서 전체 서브스키마 구조 단언을 하고 있으므로 두 테스트가 상호 보완 역할을 한다.
  - 제안: 현재 수준으로 충분하다. 장기적으로 `PaginationMeta`에 타입 변경이 잦아지면 타입별 단언을 추가할 수 있으나, 현 시점에서는 선택 사항.

- **[INFO]** `limit: 20` example 값 — 3곳 분산 지속 (이전 리뷰 INFO 3, 별 트랙 유지)
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/swagger-passthrough-crossref/codebase/backend/src/common/swagger/api-wrapped.ts` L342 (`example: 20`)
  - 상세: 이전 리뷰에서 "별 트랙" 처리된 pre-existing 항목. 본 변경에서 새로 추가된 내용 아님. RESOLUTION.md 에서 명시 defer 됨.
  - 제안: 이전 결정 유지 — 별 트랙.

## 요약

이번 변경은 이전 리뷰(20_44_11)에서 WARNING으로 지적된 `wrapPaginatedSchema` pagination 리터럴의 수동 동기화 의존성을 drift-guard 단위 테스트로 자동 검증 체계로 전환하는 데 성공했다. `PaginatedResponseDto.create()` 런타임 pagination 키를 직접 추출해 스키마 리터럴 키와 대조하는 방식은 의도가 명확하고, 한국어 설명 주석이 유지보수 맥락을 충분히 전달한다. `wrapItemsSchema` 테스트의 `type`·`required` 단언 추가로 4개 헬퍼 테스트의 패턴 일관성도 확보됐다. JSDoc NOTE의 테스트 이름 참조(`"pagination keys stay in sync with PaginatedResponseDto runtime shape"`)가 실제 `it()` 설명과 정확히 일치하여 cross-reference 신뢰성이 높다. 전반적으로 코드는 짧고 단일 책임을 유지하며, 이전 WARNING이 적절히 해소됐다. 잔여 INFO 항목들은 모두 pre-existing 또는 명시 defer 사항으로 본 변경의 범위를 벗어난다.

## 위험도

NONE
