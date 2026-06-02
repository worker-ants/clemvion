# API 계약(API Contract) 리뷰 결과

## 발견사항

### **[INFO]** `GraphWarningResultDto` 에 선택적 필드 `params` 추가 — 하위 호환 additive 변경
- 위치: `codebase/backend/src/modules/workflows/dto/responses/workflow-response.dto.ts` 라인 47–52
- 상세: `params?: Record<string, string | number>` 가 `@ApiPropertyOptional` 로 선언되었다. 기존 클라이언트는 이 필드를 수신하지 않아도 동작하므로 breaking change 가 아니다. 정적 메시지 rule 은 필드를 생략한다는 점도 주석에 명시되어 있다.
- 제안: 현 설계 그대로 유지. 다만 OpenAPI 스키마에서 `additionalProperties: true` 로 선언된 object 타입이므로, 향후 `params` 키셋이 rule 별로 달라질 수 있다. rule 별 허용 키를 `oneOf` discriminated 스키마로 명시하면 클라이언트 codegen 품질이 개선된다 (현재 단계에서는 필수 아님).

### **[INFO]** 에러 응답의 `details.errors` 배열에 `params` 전파 — 스키마 정의 부재
- 위치: `codebase/backend/test/graph-warning-save.e2e-spec.ts` 라인 153, 484–488
- 상세: e2e 테스트가 `res.body.error.details?.errors` 에 `params` 가 포함됨을 검증한다. 그러나 `GRAPH_VALIDATION_FAILED` BadRequestException 의 `details.errors` 배열 구조(`ruleId`, `severity`, `params`)에 대한 OpenAPI/DTO 수준 스키마가 리뷰 대상 파일에는 보이지 않는다. `GraphWarningResultDto` 는 `GET /workflows/:id/graph-warnings` 응답 전용으로 선언되어 있고, save 실패 시 던지는 400 에러 본문의 `details` 스키마는 별도 DTO 또는 inline type 으로 문서화되어야 한다.
- 제안: `BadRequestException` 의 `details.errors` 배열 요소 타입을 `GraphWarningResultDto` 또는 이를 참조하는 별도 DTO 로 선언하고 `@ApiResponse({ status: 400, ... })` 데코레이터로 Swagger 에 등록한다. 현재는 실제 응답 구조와 OpenAPI 문서 사이 불일치 가능성이 있다.

### **[INFO]** e2e 테스트의 `params.grand` 키 검증 — DTO example 와 키명 불일치
- 위치: `codebase/backend/test/graph-warning-save.e2e-spec.ts` 라인 287; `workflow-response.dto.ts` 라인 50
- 상세: DTO `@ApiPropertyOptional` example 은 `{ node, child, product, cap }` 이지만, e2e 테스트는 `parallel:nested-depth-exceeded` rule 에서 `params.grand` 키가 존재하는지 검증한다. 이 `grand` 키는 DTO example 에 없다. example 이 불완전하면 클라이언트 codegen 과 문서가 실제 동작과 달라진다.
- 제안: `@ApiPropertyOptional` example 을 rule 별 실제 params 키를 반영하도록 갱신한다. 또는 rule 별 params 스키마를 주석/별도 DTO 로 문서화한다.

### **[INFO]** 프론트엔드 전용 변경 (파일 3–9) — API 계약 범위 외
- 위치: `custom-node.tsx`, `editor-toolbar.tsx`, `validation-errors.mdx`, `no-internal-refs.test.ts`, `backend-labels.test.ts`, `backend-labels.ts`
- 상세: 이들은 frontend i18n 렌더링 로직, 문서 MDX, 내부 가드 테스트 변경이다. HTTP API 엔드포인트 정의·요청·응답 스키마·인증을 변경하지 않으므로 API 계약 범위 밖이다.
- 제안: 해당 없음.

## 요약

이번 변경의 핵심 API 계약 변경은 `GraphWarningResultDto` 에 `params?: Record<string, string | number>` 선택적 필드를 추가한 것이다. `@ApiPropertyOptional` 로 선언되어 하위 호환성은 유지되며 breaking change 가 아니다. 다만 두 가지 개선 여지가 있다. (1) `POST /workflows/:id/save` 가 `GRAPH_VALIDATION_FAILED` 400 을 던질 때 `details.errors` 배열에 포함되는 `params` 필드가 OpenAPI 문서(Swagger `@ApiResponse`)에 공식 정의되지 않아 문서-실제 동작 간 불일치 위험이 있다. (2) `@ApiPropertyOptional` example 에 `grand` 키가 누락되어 e2e 테스트가 검증하는 실제 params 구조와 예시가 다르다. 둘 다 현재 클라이언트를 깨뜨리지는 않으나 API 소비자를 오도할 수 있는 문서 정확성 문제다.

## 위험도

LOW
