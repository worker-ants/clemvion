# 테스트(Testing) 코드 리뷰

## 발견사항

### [WARNING] `constraintToSuffixLine` 과 `buildToolDescription` 의 직접 단위 테스트 없음
- 위치: `codebase/backend/src/nodes/ai/ai-agent/tool-providers/cafe24-mcp-tool-provider.ts` — `export function buildToolDescription(...)` / `export function constraintToSuffixLine(...)`
- 상세: 두 함수는 모두 `export` 로 공개되어 있고, 세 가지 `kind`(`oneOf`, `allOrNone`, `implies`) 에 대해 각기 다른 문자열 포맷을 생성한다. 현재 `cafe24-mcp-tool-provider.spec.ts` 에 추가된 테스트는 `buildTools()` 통합 경로를 통해 `oneOf` 케이스의 description suffix 만 간접 검증하고 있다. `allOrNone`·`implies` suffix 포맷과 `buildToolDescription` 의 섹션 조립 순서(description → path 줄 → constraint lines → timezone suffix)가 직접 단위 테스트에 의해 커버되지 않는다. 함수가 공개 API 이므로 별도 `describe('constraintToSuffixLine')` / `describe('buildToolDescription')` 블록으로 테스트하는 것이 적절하다.
- 제안: `cafe24-mcp-tool-provider.spec.ts` 에 `constraintToSuffixLine` 과 `buildToolDescription` 을 직접 import 하여 각 kind 별 출력 포맷과 섹션 순서를 검증하는 단위 테스트 추가.

### [WARNING] `cafe24.handler.spec.ts` 신규 테스트가 `allOrNone` / `implies` kind 를 커버하지 않음
- 위치: `codebase/backend/src/nodes/integration/cafe24/cafe24.handler.spec.ts` 신규 2건 (`constraints oneOf is violated` / `constraints oneOf satisfied`)
- 상세: 핸들러 경로(`cafe24.handler.ts`)의 `validateCafe24Constraints` 호출은 `allOrNone` / `implies` 위반 시에도 `CAFE24_MISSING_FIELDS` 를 던진다. 현재 handler spec 에는 `oneOf` 테스트 2건만 추가됐고, `allOrNone`·`implies` 에 대한 핸들러 수준 테스트가 없다. `constraint-validator.spec.ts` 가 validator 단위를 커버하지만, handler 의 에러 매핑 경로(`IntegrationError` throw + 메시지 형식)는 별도 검증이 필요하다.
- 제안: `cafe24.handler.spec.ts` 에 `allOrNone` 위반 케이스(`since` 만 제공, `until` 누락) 및 `implies` 위반 케이스(조건 필드 제공 + then 필드 누락) 각 1건씩 추가. plan 문서(§3)는 "3종 kind × (위반/만족) 6개 케이스"를 언급했으나 실제로 2건만 구현됐다.

### [WARNING] `cafe24-mcp-tool-provider.spec.ts` 에서 `allOrNone` / `implies` 의 MCP execute 경로 미커버
- 위치: `codebase/backend/src/nodes/ai/ai-agent/tool-providers/cafe24-mcp-tool-provider.spec.ts` `execute` describe 블록
- 상세: MCP execute 경로의 constraint 검증 테스트는 `customer_list`(`oneOf`)에 대해서만 추가됐다. `allOrNone`·`implies` 를 가진 operation 이 미래에 추가됐을 때 MCP execute 경로에서 올바르게 `CAFE24_MISSING_FIELDS` 를 반환하는지 검증하는 테스트가 없다. 현재 제약조건 metadata 에 등록된 operation 이 `customer_list` 1건뿐이어서 MCP 통합 테스트로도 커버할 수 없다.
- 제안: `execute` describe 블록에 `allOrNone` 위반 시 에러 반환을 검증하는 테스트를 추가하거나, 최소한 별도 fake operation stub 을 사용하는 단위 테스트로 해당 경로를 커버.

### [WARNING] `buildJsonSchema` 의 `requiredFields` 가 없고 `oneOf` 만 있는 경우 미커버
- 위치: `codebase/backend/src/nodes/ai/ai-agent/tool-providers/cafe24-mcp-tool-provider.ts` — `buildJsonSchema()` 내 `allOf` 조합 로직 (라인 690–693)
- 상세: `requiredClause` 가 null 일 때(requiredFields 길이 0) 이면서 `oneOfConstraints` 가 있는 경우, `allOf` 는 `anyOfClauses` 만으로 구성된다. 현재 테스트에서는 `customer_list` 가 `requiredFields: ['shop_no']`를 가지고 있어 `[requiredClause, ...anyOfClauses]` 브랜치만 검증된다. `requiredClause === null` 이면서 `oneOfConstraints.length > 0` 인 브랜치는 테스트로 커버되지 않는다.
- 제안: `buildTools` 또는 `buildJsonSchema` 직접 테스트에서 `requiredFields: []` + `oneOf` 조합의 케이스를 추가해 `allOf: [anyOfClause]` 형태의 schema 를 검증.

### [INFO] `isAbsent` 함수의 숫자 `0`, 불리언 `false` 처리 문서화·테스트 부재
- 위치: `codebase/backend/src/nodes/integration/cafe24/metadata/constraint-validator.ts` — `isAbsent()` (라인 19–21)
- 상세: `isAbsent` 는 `undefined | null | ''` 만 absent 로 처리하며, `0`·`false` 는 present 로 본다. `constraint-validator.spec.ts` 의 `oneOf` 통과 케이스에서 `{ b: 1, c: true }` 가 사용됐으나, `0`·`false` 가 present 로 처리되는지는 명시적으로 검증되지 않는다. Cafe24 API 에 boolean/number 필드가 constraint 에 포함될 경우, `0`이 present 로 처리되는 동작이 의도적인지 명확해야 한다.
- 제안: `constraint-validator.spec.ts` 에 `{ a: 0 }`, `{ a: false }` 가 absent 로 처리되지 않음을 단언하는 케이스 추가 (정책 확인 + 문서화 목적).

### [INFO] `metadata.spec.ts` invariant 테스트가 `implies.then` 중복 필드를 허용하는지 검증 없음
- 위치: `codebase/backend/src/nodes/integration/cafe24/metadata/metadata.spec.ts` — 신규 constraints invariant 테스트
- 상세: invariant 테스트는 필드명이 `fields` 키 부분집합인지, 길이 조건을 충족하는지 검증한다. 그러나 `oneOf.fields`, `allOrNone.fields`, `implies.then` 내 중복 필드명은 논리적으로 의미없으므로 금지해야 하나, 현재 테스트에서 unique 여부를 검증하지 않는다. 이는 metadata 품질 회귀 방지 관점에서 누락이다.
- 제안: 필요 시 중복 필드명 검사 조건을 invariant 테스트에 추가(INFO 수준이므로 즉각 필수 아님).

### [INFO] `cafe24.handler.spec.ts` 신규 테스트의 success 경로 assertion 이 취약
- 위치: `codebase/backend/src/nodes/integration/cafe24/cafe24.handler.spec.ts` — `constraints oneOf satisfied` 테스트 (라인 369–371)
- 상세: success 검증이 `(result as { port?: string }).port === 'success'` 로만 되어 있다. 실제 response body(`{ customers: [] }`)가 output 에 정확히 매핑되는지는 검증하지 않는다. 기존 handler 성공 테스트들과 달리 응답 본문 비교가 생략됐다. constraint check 통과 후 API 실제 호출 여부(`apiClient.call` 호출 확인)가 빠져 있어 "통과"의 의미가 불완전하다.
- 제안: `apiClient.call` 이 호출됐음을 `expect(apiClient.call).toHaveBeenCalled()` 로 검증하거나, 기존 성공 경로 테스트와 동일한 수준의 response 매핑 assertion 추가.

### [INFO] plan 문서 §3 의 "6개 케이스" 목표와 실제 구현 건수 불일치
- 위치: `plan/complete/cafe24-conditional-required-impl.md` §3
- 상세: plan 에는 "3종 kind × (위반/만족) 6개 케이스 추가"라고 명시됐으나 실제로 `cafe24.handler.spec.ts` 에는 `oneOf` 관련 2건만 추가됐다(`allOrNone`·`implies` 위반/만족 4건 미구현). 이는 WARNING 항목과 연결되며, plan 의 완료 기준을 충족하지 못한 상태다.
- 제안: `allOrNone`·`implies` 케이스 4건을 추가해 plan 완료 기준(§3 체크박스)을 실제로 달성.

## 요약

신규 `constraint-validator.ts` 의 단위 테스트(`constraint-validator.spec.ts`)는 세 가지 constraint kind 모두에 대해 통과·실패·경계값(null/undefined/empty string)을 고르게 커버하며 격리성과 가독성이 우수하다. `metadata.spec.ts` 의 invariant 테스트도 모든 operation 에 대해 전수 검증하는 좋은 회귀 방어 구조다. 그러나 plan 에 명시된 "3종 × 위반/만족 6케이스" 목표와 달리 `cafe24.handler.spec.ts` 와 `cafe24-mcp-tool-provider.spec.ts` 모두 `oneOf` 만 테스트하고 `allOrNone`·`implies` 는 핸들러/MCP 경로 수준에서 커버되지 않는다. 공개 exported 함수인 `buildToolDescription`·`constraintToSuffixLine` 의 직접 단위 테스트가 없고, `buildJsonSchema` 의 `requiredFields=[]` + `oneOf` 조합 브랜치도 미커버다. 이 세 가지 WARNING 항목은 향후 유사 operation 이 등록될 때 회귀 위험을 높인다.

## 위험도

MEDIUM

STATUS: success