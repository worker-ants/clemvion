# Testing Review — integration-activity-api-label

검토 대상: INT-US-05 (통합 활동 로그 API 식별 정보 추가) 전체 변경
검토 일시: 2026-05-28

---

## 발견사항

### [WARNING] `extractApiPath` 에 대한 단위 테스트 부재
- 위치: `codebase/backend/src/nodes/integration/http-request/http-request.handler.ts` — `export function extractApiPath(url: string): string`
- 상세: 이 함수는 URL 파싱 로직이 비자명하다. (a) 정상 절대 URL에서 host+pathname 추출, (b) query string 제거, (c) `new URL()` 파싱 실패 시 relative URL fallback(물음표 이전 slice), (d) query string 없는 relative URL 그대로 통과 — 4가지 경로가 존재한다. `http-request.handler.spec.ts` 에 `extractApiPath` 를 직접 import해 검증하는 케이스가 없다. 기존 handler-level 테스트는 `logUsage` 에 전달되는 `api` 필드를 `expect.objectContaining({ status: ... })` 수준으로만 검증하므로 `api.path` 값의 정확성이 커버되지 않는다.
- 제안: `http-request.handler.spec.ts` 또는 별도 `extractApiPath.spec.ts` 에 `extractApiPath` 를 직접 import하여 ①절대 URL, ②query string 포함 절대 URL, ③relative URL, ④query string 포함 relative URL 4케이스를 단위 테스트로 추가한다.

### [WARNING] `extractSqlVerb` 에 대한 단위 테스트 부재
- 위치: `codebase/backend/src/nodes/integration/database-query/database-query.handler.ts` — `export function extractSqlVerb(query: string | undefined): string | null`
- 상세: 이 함수는 exported 되어 있어 단위 테스트가 자연스럽다. 경계 케이스로 ①undefined/빈 문자열 → null, ②선두 공백+SELECT, ③첫 토큰이 숫자로 시작하는 경우 → null, ④WITH CTE(`WITH` 반환), ⑤혼합 대소문자(`SeLeCt` → `SELECT`) 가 있다. `database-query.handler.spec.ts` 에 이 함수를 import해 검증하는 테스트가 없다. handler 실행 시나리오는 `queryType='raw'` 분기 없이 표준 SQL 성공/실패 케이스만 커버한다.
- 제안: `database-query.handler.spec.ts` 에 `extractSqlVerb` describe 블록을 추가해 위 경계 케이스를 최소 5개 케이스로 검증한다.

### [WARNING] http-request / database-query / send-email handler spec 에서 `api` 필드 값 검증 없음
- 위치: `http-request.handler.spec.ts`, `database-query.handler.spec.ts`, `send-email.handler.spec.ts`
- 상세: 세 파일 모두 기존 logUsage 호출 검증이 `expect.objectContaining({ status: 'success' })` 또는 `expect.objectContaining({ status: 'failed', error: ... })` 수준에 머문다. INT-US-05 에서 새로 추가된 `api: { method, path }` 필드가 실제로 올바른 값으로 전달되는지 검증하는 assertion 이 없다. 따라서 각 핸들러가 잘못된 값(예: path 에 query string 포함, method 가 소문자, send-email path 가 null 대신 undefined)을 보내도 기존 테스트는 모두 통과한다.
- 제안: 각 handler spec 에서 logUsage mock 검증 시 `api` 필드를 포함한 `expect.objectContaining` 확장이 필요하다. 최소 성공 케이스 1개 + 실패 케이스 1개에 `api: expect.objectContaining({ method: 'GET', path: 'api.example.com/me' })` 수준의 검증을 추가한다.

### [WARNING] cafe24.handler.spec.ts 에서 `api` 필드 값(label/method/path) 검증 없음
- 위치: `codebase/backend/src/nodes/integration/cafe24/cafe24.handler.spec.ts` 라인 311, 416, 443
- 상세: cafe24 핸들러는 INT-US-05 의 핵심 구현체로 `apiInfo.label = cafe24.${resource}.${operationId}`, `apiInfo.method = operation.method`, `apiInfo.path = operation.path` 를 모두 채운다. 그러나 기존 spec 의 `logUsage` 검증은 `expect.objectContaining({ status: 'success' })` 또는 `{ status: 'failed' }` 만 확인한다. operation lookup 실패 전(label만 존재, method/path는 undefined)과 lookup 성공 후(3필드 모두 존재)의 상태 분기도 검증되지 않는다.
- 제안: 성공 케이스에 `expect.objectContaining({ api: { label: 'cafe24.product.product_list', method: 'GET', path: expect.stringContaining('/products') } })` 수준의 assertion 을 추가한다. operation lookup 이전에 error 가 발생하는 케이스(operation undefined → label만 있고 method/path undefined)도 별도 케이스로 검증한다.

### [INFO] `clampApiField` 의 `max <= 1` 엣지 케이스 테스트 부재
- 위치: `codebase/backend/src/modules/integrations/integrations.service.ts` — `clampApiField` 함수 내 `if (max <= 1) return raw.slice(0, max)` 분기
- 상세: 이 분기는 ellipsis(U+2026, 3바이트)를 붙일 공간이 없을 때를 처리한다. 실제 컬럼 길이(128/8/256)에서는 도달할 수 없는 방어 코드이므로 LOW 위험이나, 함수가 일반적 유틸로 재사용될 경우를 고려하면 테스트로 문서화하는 것이 적절하다. 현재 `integrations.service.spec.ts` 의 truncate 테스트는 이 분기를 커버하지 않는다.
- 제안: `truncates over-length api fields` 케이스에 `max=1` 인 별도 케이스를 추가하거나, `clampApiField` 를 module 경계 밖으로 export 해 직접 단위 테스트를 작성한다.

### [INFO] `getServiceCatalog` 테스트에서 `listAllCafe24Operations` 실제 구현에 의존
- 위치: `codebase/backend/src/modules/integrations/integrations.service.spec.ts` — `getServiceCatalog` describe 블록
- 상세: `listAllCafe24Operations()` 가 mock 없이 실제 metadata 파일을 로드한다. 이 자체는 metadata 모듈이 순수 데이터로 구성되어 있어 큰 문제는 없다. 다만 `sample.key` 가 `cafe24` prefix 를 가지는지만 regex 로 검증하고, 특정 well-known operation(예: `cafe24.product.product_list`)의 존재 여부나 `method`/`path` 가 비어있지 않은지의 구체적 검증이 없다. metadata 파일에 버그가 생겨 빈 배열을 반환해도 `toBeGreaterThan(0)` 이 실패하는 것 외에 진단 정보가 없다.
- 제안: well-known operation 하나를 고정해 key/method/path 값을 assertion 에 포함하거나, `listAllCafe24Operations` 를 mock 으로 격리해 service 로직만 검증하는 이중 테스트 구조를 고려한다.

### [INFO] frontend `renderApiCell` / `tryTranslateLabel` 함수에 대한 단위 테스트 없음
- 위치: `codebase/frontend/src/app/(main)/integrations/[id]/page.tsx` — `renderApiCell`, `tryTranslateLabel`
- 상세: 이 두 함수는 §4.6 표시 정책의 핵심 분기 로직(라벨 있음 2줄 / endpoint만 / `—` fallback)을 구현한다. 현재 `codebase/frontend/src/app/(main)/integrations/[id]/__tests__/` 에 ActivityTab 또는 이 두 함수를 커버하는 테스트 파일이 없다. plan 의 "테스트" 항목에도 `ActivityTab 렌더 — 라벨 있음/없음/둘 다 NULL fallback` 이 목록에 있으나 미구현이다.
- 제안: `renderApiCell` 을 별도 파일로 추출하거나 테스트에서 직접 import 해, ①catalog hit + endpoint 있음, ②catalog miss + endpoint 있음, ③둘 다 null, ④labelKey 가 i18n dict 에 없어 key 그대로 반환되는 경우(tryTranslateLabel null 반환)의 4케이스를 단위 테스트로 추가한다.

### [INFO] `ActivityTab` catalog 쿼리(staleTime 1h) 동작 검증 없음
- 위치: `codebase/frontend/src/app/(main)/integrations/[id]/page.tsx` — `useQuery({ queryKey: ['integrations', 'catalog', serviceType], staleTime: ... })`
- 상세: plan 에 명시된 "catalog hook" 프론트엔드 테스트가 없다. `integrationsApi.catalog` 가 호출되는 조건, 로딩 상태, 빈 배열 응답 시의 fallback 렌더 등이 검증되지 않는다.
- 제안: 기존 `integrations/[id]/__tests__/` 패턴을 따라 `activity-tab.test.tsx` 또는 `integration-detail-page.test.tsx` 를 추가한다.

### [INFO] e2e 테스트 부재 — `GET /integrations/services/cafe24/catalog` 엔드포인트
- 위치: `codebase/backend/test/` — 신규 endpoint에 해당하는 e2e spec 없음
- 상세: plan Phase 7에 e2e 항목이 포함되어 있으나 Phase 7 는 아직 미완료(`[ ]`) 상태다. 신규 endpoint 와 활동 응답의 `apiLabel`/`apiMethod`/`apiPath` 필드 포함 여부는 e2e 레벨에서 검증되어야 한다.
- 제안: `integration-cafe24-precheck.e2e-spec.ts` 패턴을 참고해 `integration-activity-api.e2e-spec.ts` 를 추가하거나 기존 `workflow-execution.e2e-spec.ts` 에 검증 케이스를 보강한다.

---

## 요약

백엔드 service 레이어의 `logUsage` api 필드 매핑(저장·truncate·null coerce)은 `integrations.service.spec.ts` 에 4개 케이스로 잘 커버되어 있으며, `IntegrationHandlerBase` 의 forwarding 테스트도 명확하다. `getServiceCatalog` 역시 기본 성공·비지원 타입 케이스가 모두 포함되어 있다. 그러나 두 개의 exported 유틸리티 함수(`extractApiPath`, `extractSqlVerb`)에 직접 단위 테스트가 없어 경계 케이스(relative URL, query string 포함 URL, NULL 반환 조건)가 커버되지 않고, 4개 핸들러의 기존 `logUsage` assertion 이 `api` 필드 값을 전혀 검증하지 않아 잘못된 값이 저장되어도 기존 테스트가 통과한다. 프론트엔드 측은 `renderApiCell`/`tryTranslateLabel` 의 표시 분기 로직에 대한 단위 테스트가 전혀 없고 plan 에 명기된 ActivityTab 테스트도 미구현 상태다. e2e 레이어도 Phase 7 미완료로 신규 endpoint 와 활동 응답 shape 검증이 없다.

---

## 위험도

MEDIUM

(handler-level api 값 검증 누락 + extractApiPath/extractSqlVerb 직접 단위 테스트 부재가 주요 위험; service 레이어 핵심 로직은 잘 커버됨)
