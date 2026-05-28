# 요구사항(Requirement) 리뷰 결과

검토 대상: integration-activity-api-label (통합 활동 로그에 API 식별 컬럼 3개 추가 + catalog endpoint)
검토 일시: 2026-05-28

---

## 발견사항

### [CRITICAL] spec 갱신이 실제 파일에 반영되지 않았다 — spec fidelity 전면 불일치

- 위치: `spec/` 전역 (하기 4개 문서)
- 상세: consistency-check SUMMARY (`review/consistency/2026/05/28/09_07_26/SUMMARY.md`) 는 Phase 2 종료 시점에 아래 spec 보강이 완료됐다고 기술한다. 그러나 현재 체크아웃된 spec 파일을 직접 읽은 결과 해당 내용이 전혀 없다.

  | 코드가 참조하는 SoT | 실제 spec 파일 현황 |
  |---|---|
  | `spec/conventions/cafe24-api-metadata.md §7.5` (catalog key 형식, 길이·truncate 정책) | `§7.5` 소절 **부재**. `§7` 은 "MCP Bridge 와의 매핑" 전체 한 절. `7.5` 라는 anchor 없음 |
  | `spec/4-nodes/4-integration/_product-overview.md INT-US-05` (통합별 채우기 정책 표) | `§2.4` 에 `INT-US-01` ~ `INT-US-04` 까지만 존재. `INT-US-05` **부재** |
  | `spec/1-data-model.md §2.10.1` `api_label / api_method / api_path` 3컬럼 | 해당 표에 3행 **부재**. 기존 8행만 존재 |
  | `spec/2-navigation/4-integration.md §4.6` API 컬럼, `§9.3` catalog endpoint | `§4.6` 표는 `At/Workflow/Node/✓/ms` 5열 그대로. `§9.3` 에 `GET /api/integrations/services/:type/catalog` 행 **부재** |

  코드 파일 전체가 이 spec 참조를 SoT 로 인용하고 있어 (migration 주석, entity JSDoc, handler 주석, DTO 주석 등 12+ 위치), 현 상태에서는 "구현이 spec 을 따른다"는 검증이 불가능하다. spec 갱신이 선행되지 않은 채 구현이 머지되면 spec-impl 갭이 영구적으로 형성된다.

- 제안: `project-planner` 에게 위 4개 spec 파일 갱신을 요청한 뒤 spec 파일 실재를 확인하고 재리뷰한다. BLOCK 사유.

---

### [CRITICAL] `IntegrationActivityItemDto` 에 신규 3필드 누락 — Swagger 문서와 실제 응답 불일치

- 위치: `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts` L340-L355 (`IntegrationActivityItemDto`)
- 상세: 컨트롤러의 `GET :id/activity` 는 `@ApiOkWrappedResponse(IntegrationActivityDto, ...)` 를 선언하고 있고 `IntegrationActivityDto.items` 는 `IntegrationActivityItemDto[]` 타입이다. 그런데 이번 변경에서 `IntegrationActivityItemDto` 에 `apiLabel`, `apiMethod`, `apiPath` 필드가 추가되지 않았다. 실제 응답 JSON 에는 TypeORM 엔티티를 직접 직렬화해 3필드가 포함되지만, Swagger 스펙에는 없다. 이는 API 계약 문서 불일치이며, SDK 자동생성이나 frontend 타입 추론 도구를 사용하는 경우 잘못된 타입을 생성한다.
- 제안: `IntegrationActivityItemDto` 에 다음을 추가한다.
  ```ts
  @ApiPropertyOptional({ nullable: true }) apiLabel?: string | null;
  @ApiPropertyOptional({ nullable: true }) apiMethod?: string | null;
  @ApiPropertyOptional({ nullable: true }) apiPath?: string | null;
  ```

---

### [WARNING] `extractSqlVerb` 가 긴 SQL 동사를 반환하면 `api_method varchar(8)` 를 초과할 수 있다

- 위치: `codebase/backend/src/nodes/integration/database-query/database-query.handler.ts` `extractSqlVerb` 함수 + `clampApiField` 적용 경로
- 상세: `ROLLBACK`(8자), `TRUNCATE`(8자), `SAVEPOINT`(9자), `TRANSACTION`(11자) 처럼 8자를 초과하는 SQL 키워드가 있다. `extractSqlVerb` 는 첫 단어를 그대로 uppercase 반환하고, 이후 `clampApiField(result, 8)` 가 `SAVEPOIN…` 처럼 자른다. 자르는 동작 자체는 `clampApiField` 가 처리하므로 DB 저장은 안전하다. 그러나 잘린 값(`SAVEPOIN…`)이 UI 에 표시되면 사용자 혼란을 초래한다. 더 중요하게, `TRUNCATE`, `ROLLBACK`, `ANALYZE`, `EXPLAIN`, `EXECUTE`, `COMMENT` 등 정확히 8자 이하 동사들은 잘리지 않고 그대로 저장된다 (functional correctness OK). 이 케이스는 테스트에 다루어지지 않는다.
- 제안: 이미 `clampApiField` 로 보호되므로 기능 결함은 없다. 단, 단위 테스트에 `SAVEPOINT` 같은 9자 SQL 동사가 포함된 케이스를 추가해 `clampApiField` 와의 연동을 명시적으로 검증한다.

---

### [WARNING] `café24.handler.ts` 의 `apiInfo` 초기화 이후 `operation` lookup 실패 시 `method/path` 가 NULL 인 채로 로깅된다

- 위치: `codebase/backend/src/nodes/integration/cafe24/cafe24.handler.ts` (diff 내 `apiInfo` 초기화 ~ operation lookup 실패 분기)
- 상세: `apiInfo = { label: 'cafe24.${resource}.${operationId}' }` 로 초기화한 뒤, operation lookup 이 실패(operation 미정의)하면 `apiMethod`, `apiPath` 를 채우지 못한 채 `logUsage` 를 호출한다. diff 내 해당 에러 분기를 확인하면 `api: apiInfo` 가 포함되어 있지 않다 — 즉 `api` 인자 자체가 전달되지 않는 케이스가 있다. 실제로 diff 의 `failed` logUsage 호출들을 보면 operation 미정의 에러 throw 전의 분기는 `throw` 이므로 catch 블록에서 처리된다.

  더 구체적으로: diff 에 `@@ -228...` 과 `@@ -268...` 에 `api: apiInfo` 가 추가됐지만 operation lookup 직전 던지는 `throw` 는 outer catch 로 빠져나가는데, outer catch 의 `logUsage` 호출에 `api: apiInfo` 가 있는지 확인이 필요하다 (diff `@@ -309...` 에는 있음). operation 미정의 시에는 `label` 만 있고 `method/path` 없이 로깅된다 — 이는 계획된 동작(operation 이 unknown 이라 method/path 불명) 이며 허용 가능하나, 문서화 및 테스트가 없다.
- 제안: operation lookup 실패 케이스에서 `apiInfo.label` 만 있고 `method/path` 가 null 인 채로 로깅되는 동작을 명시적으로 테스트에 추가한다.

---

### [WARNING] `tryTranslateLabel` 에서 `cafe24Catalog.*` 패턴 키가 `TranslationKey` 타입을 강제 캐스팅한다

- 위치: `codebase/frontend/src/app/(main)/integrations/[id]/page.tsx` `tryTranslateLabel` 함수 L816
- 상세: `Dict` 타입은 `ko/index.ts` 의 `as const` 객체로부터 파생되며, `cafe24Catalog` 는 `Record<string, string>` (빈 객체)이다. TypeScript 가 `PathInto<Dict>` 로 `TranslationKey` 를 추론할 때 `cafe24Catalog` 의 동적 키들은 포함되지 않는다. 따라서 `\`cafe24Catalog.${catalogKey}\`` 를 `TranslationKey` 로 `as` 캐스팅하는 것은 타입 안전하지 않다. 현재는 빈 dict 이므로 런타임에는 항상 key miss → null 반환이라 기능 오류는 없다. 그러나 향후 `cafe24-catalog-i18n` follow-up 에서 dict 를 채울 때 타입 시스템이 올바른 키를 강제할 수 없다.
- 제안: `Dict["cafe24Catalog"]` 가 `Record<string, string>` 인 구조를 그대로 유지하되, `t` 함수 호출 시 타입 에러가 발생한다면 `as unknown as TranslationKey` 패턴보다 `t` 를 string 인덱서로 직접 호출하거나 `cafe24Catalog` dict 타입을 union key type 으로 개선하는 것을 follow-up 에 포함한다.

---

### [WARNING] `getServiceCatalog` 의 반환 타입이 `OperationCatalogDto` 와 다르다 — 서비스 메서드와 DTO 비대칭

- 위치: `codebase/backend/src/modules/integrations/integrations.service.ts` `getServiceCatalog()` 반환 타입 (diff `@@ -985+1016`)
- 상세: 서비스 메서드의 반환 타입이 인라인 객체 타입(`{ operations: Array<{ key, method, path, labelKey, descriptionKey? }> }`)으로 선언돼 있고, 컨트롤러가 이를 직접 반환해 `OperationCatalogDto` 로 Swagger 응답을 선언한다. 타입 구조는 일치하지만 TypeScript 상 `OperationCatalogDto` 타입을 반환 시그니처로 사용하지 않으므로 향후 DTO 필드 추가 시 컴파일 시점에 서비스가 강제 동기화되지 않는다.
- 제안: 서비스 메서드 반환 타입을 `OperationCatalogDto` 로 교체한다.

---

### [INFO] `IntegrationActivityItemDto` 의 기존 필드 구조도 실제 entity 와 불일치 (기존 문제)

- 위치: `IntegrationActivityItemDto` (기존 코드)
- 상세: `IntegrationActivityItemDto` 에는 `createdAt`, `errorMessage`, `executionId` 가 있지만 실제 `IntegrationUsageLog` 엔티티에는 `at`, `error` (JSONB), `nodeExecutionId` 등이 있다. 이번 변경이 도입하기 전부터 존재한 불일치이며, 본 PR 의 관심사는 아니나 언급한다.

---

### [INFO] `extractApiPath` 가 relative URL 에서 query string 만 제거하고 fragment 는 제거하지 않는다

- 위치: `codebase/backend/src/nodes/integration/http-request/http-request.handler.ts` `extractApiPath` 함수
- 상세: relative URL fallback (`new URL()` 실패 케이스)에서 `url.indexOf('?')` 로 query string 을 자르지만, `#fragment` 는 자르지 않는다. HTTP endpoint path 에 `#` 가 포함되는 경우는 거의 없지만, path 에 `#` 가 포함된 URL 이 들어올 경우 `api_path` 에 fragment 가 포함된다. 실용적 영향은 거의 없다.
- 제안: `const q = url.indexOf('?'); const h = url.indexOf('#'); const end = [q, h].filter(i => i !== -1).reduce((a, b) => Math.min(a, b), url.length); return url.slice(0, end);` 로 fragment 도 제거한다.

---

### [INFO] `cafe24Catalog` dict 가 `Record<string, string>` (빈 객체) 이므로 i18n parity guard 가 의미 있는 검사를 수행하지 않는다

- 위치: `codebase/frontend/src/lib/i18n/dict/ko/cafe24Catalog.ts`, `en/cafe24Catalog.ts`
- 상세: 두 dict 가 모두 빈 객체이므로 ko/en parity check 는 통과하지만 실제 라벨이 채워졌을 때 구조적 일치를 강제하지 않는다. `cafe24-catalog-i18n` follow-up 에서 ko dict 를 먼저 채우고 en 은 나중에 채우는 경우 parity guard 가 실패할 수 있다. 이미 follow-up plan 에서 인지하고 있으므로 INFO 수준.

---

## 요약

기능 구현 자체는 전체적으로 올바르게 설계됐다. 4개 핸들러 모두 `api` 필드를 `logUsage` 에 전달하고, `clampApiField` 가 길이 제약을 안전하게 처리하며, catalog endpoint 반환 로직도 `listAllCafe24Operations()` 를 정확히 활용한다. 프론트엔드의 `renderApiCell` 3단계 폴백(라벨 → endpoint → `—`)도 의도한 스펙 정책을 올바르게 구현한다.

그러나 **CRITICAL 2건**이 존재한다. 첫째, consistency-check 가 "완료"로 표시한 spec 갱신이 실제 spec 파일에 반영되지 않아 코드가 존재하지 않는 SoT(`§7.5`, `INT-US-05`, `api_label/method/path` 표 행, catalog endpoint 행)를 참조하는 상태다. 둘째, `IntegrationActivityItemDto` 에 신규 3필드가 빠져 Swagger 문서와 실제 API 응답이 불일치한다.

---

## 위험도

**HIGH** (CRITICAL 2건: spec 미갱신으로 인한 SoT 불재 + DTO 누락으로 인한 API 계약 불일치)
