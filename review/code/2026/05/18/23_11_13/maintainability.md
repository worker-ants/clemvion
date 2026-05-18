# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[INFO]** `uiMeta` 헬퍼 함수가 단일 파일에만 존재하는 것은 좋으나, 통합(Integration) 카테고리 테스트 파일들은 각각 동일한 타입 정의와 `z.toJSONSchema` 호출 패턴을 반복하고 있음
  - 위치: `database-query.schema.spec.ts` L43-48, `http-request.schema.spec.ts` L415-423, `send-email.schema.spec.ts` L947-952, `form.schema.spec.ts` L3361-3363
  - 상세: Logic 카테고리는 `logic-ui-required.spec.ts`에 `uiMeta` 헬퍼와 `it.each` 테이블 방식으로 통합 정리했지만, Integration/Presentation 카테고리는 각 schema 별 spec 파일 안에 같은 패턴(타입 `Props` 정의 + `z.toJSONSchema` 호출 + `it` 블록)을 파일마다 별도 작성함. 두 방식이 혼재해 코드베이스 스타일 일관성이 낮음.
  - 제안: Integration/Presentation 카테고리도 별도 집계 파일(`integration-ui-required.spec.ts`, `presentation-ui-required.spec.ts`)을 만들거나, 기존 각 spec 파일에 `uiMeta` 헬퍼를 공통 유틸로 추출해 재사용하는 방향을 고려. 다만 "각 노드 spec 파일에 포함"도 노드 단위 응집성을 높이는 타당한 선택이므로, 팀 내 방침을 명문화하는 것이 우선.

- **[INFO]** Integration 카테고리 테스트 3개 파일에서 `type Props = Record<string, { ui?: { required?: boolean } }>` 타입이 각각 독립 선언되어 있음
  - 위치: `database-query.schema.spec.ts` L43, `send-email.schema.spec.ts` L947, `form.schema.spec.ts` L3361
  - 상세: `http-request.schema.spec.ts`는 `requiredWhen`까지 포함한 약간 다른 타입 정의를 사용(`{ ui?: { required?: boolean; requiredWhen?: unknown } }`). Logic 카테고리의 `logic-ui-required.spec.ts`는 `UiMeta` / `Props`를 모듈 최상단에 한 번만 정의함. 동일 타입을 여러 파일에 흩어 선언하면 추후 `requiredWhen` 등 필드 확장 시 일부 파일 누락 위험이 있음.
  - 제안: 공통 테스트 유틸 모듈(`test-utils/ui-required.ts` 등)로 타입과 헬퍼를 추출하거나, 최소한 모든 파일이 동일한 타입 정의를 사용하도록 일치시킴.

- **[INFO]** `validateVariableModificationConfig` 내부에 `VALID_OPERATIONS` Set이 함수 내부에 선언되어 있고, 코드 주석도 이것이 `modOperationSchema` enum과 핸들러 `applyModification` switch와 동기화되어야 한다고 밝히고 있음
  - 위치: `variable-modification.schema.ts` L3271-3278
  - 상세: 모듈 상단에 이미 `modOperationSchema` enum이 선언되어 있음에도 Set을 중복 선언함. `VALID_OPERATIONS` 대신 `new Set(modOperationSchema.options)`로 직접 파생하면 동기화 부담이 사라짐. 세 곳 중 한 곳 변경 시 나머지가 자동으로 따라가지 않는 현재 구조는 미래 유지보수 시 누락 위험.
  - 제안: `const VALID_OPERATIONS = new Set(modOperationSchema.options as string[]);`으로 교체. `filter.schema.ts`의 `VALID_OPS` 역시 동일 패턴으로 `conditionOperatorSchema.options`에서 파생하면 일관성 확보.

- **[INFO]** `filter.schema.ts`의 `validateFilterConfig` 내 `VALID_OPS`와 `if-else.schema.ts`의 `validateIfElseConfig` 내 조건 연산자 검증이 같은 `conditionOperatorSchema` 를 공유함에도 Set 생성 방식이 다름
  - 위치: `filter.schema.ts` L1751-1767 (`VALID_OPS = new Set([...])` 리터럴), `if-else.schema.ts` L2092-2095 (`conditionOperatorSchema.options` 직접 참조)
  - 상세: `if-else.schema.ts`는 `conditionOperatorSchema.options`를 직접 사용하는 반면 `filter.schema.ts`는 같은 연산자 목록을 리터럴 배열로 다시 정의함. 연산자 추가/삭제 시 `filter.schema.ts` 쪽이 자동으로 반영되지 않음. 코멘트도 "Local copy of the operator whitelist"라고 의도적 분리를 명시하고 있으나, 이는 향후 desync 위험.
  - 제안: `filter.schema.ts`에서도 `new Set(conditionOperatorSchema.options as string[])`를 사용하도록 통일. 순환 참조 우려가 있다면 `conditionOperatorSchema`를 별도 공유 파일로 추출하는 방법도 고려.

- **[INFO]** `logic-ui-required.spec.ts`의 `it.each` 테이블 내 `schema` 파라미터 타입 캐스트(`schema as ZodObject`)가 실제 타입과 불일치할 수 있음
  - 위치: `logic-ui-required.spec.ts` L2199, `uiMeta` 함수 시그니처 L2177
  - 상세: `uiMeta(schema: ZodObject, key: string)` 시그니처가 `ZodObject`를 요구하나, `it.each` 테이블에서 다양한 Zod 스키마 타입을 `schema as ZodObject`로 강제 캐스트함. `z.toJSONSchema`는 임의 Zod 스키마를 받으므로 `ZodType` 또는 `Parameters<typeof z.toJSONSchema>[0]`로 시그니처를 넓히면 캐스트 없이도 타입 안전성 확보 가능.
  - 제안: `function uiMeta(schema: Parameters<typeof z.toJSONSchema>[0], key: string)`으로 변경하거나 `z.ZodTypeAny`를 사용.

- **[INFO]** 각 스키마 파일의 `required: true` 주석 스타일이 미세하게 다름
  - 위치: `http-request.schema.ts` L773-776 (인라인 JSDoc 주석 3줄), `database-query.schema.ts` L286-287 (1줄 주석), `if-else.schema.ts` L2040-2043 (2줄 주석)
  - 상세: 일부 파일은 `required: true` 배치에 대해 장문의 근거 주석을 달고(`http-request.schema.ts`), 일부는 단순히 warningRule ID만 언급(`database-query.schema.ts`). 코드베이스 내에서 스타일이 통일되지 않음. 읽는 사람에 따라 정보량 차이가 생김.
  - 제안: `// warningRule \`<id>\` 와 정렬.` 패턴을 모든 파일에 동일하게 적용(이미 대부분 이 방식이므로 `http-request.schema.ts`만 간소화 검토).

## 요약

이번 변경은 18개 노드 schema 파일과 관련 테스트 파일에 걸쳐 `ui.required` / `ui.requiredWhen` 메타데이터를 일괄 추가하는 sweep 작업으로, 전체적인 의도와 실행 방향은 명확하고 일관성이 있다. 각 필드에 대한 주석이 `warningRule` ID를 명시해 변경 근거를 추적하기 쉽게 했으며, 테스트도 `z.toJSONSchema` 를 통해 실제 직렬화 결과를 검증하는 구조적으로 올바른 방식이다. 다만 Logic 카테고리는 집계형 `logic-ui-required.spec.ts`를 별도로 두어 헬퍼 함수와 `it.each` 테이블을 활용한 반면, Integration/Presentation 카테고리는 각 spec 파일 내에 유사 패턴을 개별 반복하는 방식을 택해 두 접근이 혼재한다. 또한 `variable-modification.schema.ts`의 `VALID_OPERATIONS` Set과 `filter.schema.ts`의 `VALID_OPS` Set이 각각 이미 존재하는 Zod enum의 옵션 목록을 리터럴로 중복 선언하고 있어, 향후 연산자 추가/삭제 시 동기화 누락 위험이 잠재한다. 전반적인 유지보수성 수준은 양호하며, 발견된 사항들은 모두 INFO 등급의 개선 제안이다.

## 위험도

LOW
