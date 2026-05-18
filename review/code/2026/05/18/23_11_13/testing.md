# 테스트(Testing) 리뷰

## 발견사항

- **[INFO]** `logic-ui-required.spec.ts` — `uiMeta` 헬퍼 함수에서 `ZodObject` 타입을 직접 import 해 파라미터로 사용하고 있으나, 호출 지점에서 `schema as ZodObject` 캐스트가 필요함. Zod v4 에서 `ZodObject` 제네릭 시그니처가 복잡하므로 캐스트 실패 시 런타임 오류 없이 타입 수준에서 소리 없이 동작할 수 있음.
  - 위치: `codebase/backend/src/nodes/logic/logic-ui-required.spec.ts:177`
  - 상세: `it.each` 배열에 담긴 schema 값들은 `ZodObject<any>` 와 호환되지 않을 수 있어, TypeScript 컴파일 경고 없이 `as ZodObject` 로 통과될 수 있음. 실제 테스트 실행에는 문제없지만, 타입 안전성에 구멍이 생길 수 있음.
  - 제안: `uiMeta` 함수 파라미터 타입을 `ZodObject` 대신 `z.ZodTypeAny` 또는 `{ _def: unknown }` 수준으로 완화하거나, `z.toJSONSchema` 에 직접 전달되는 형태로 리팩토링.

- **[WARNING]** `loop.schema.ts` 변경에 대한 테스트가 `logic-ui-required.spec.ts` 의 `it.each` 내 `['loop', loopNodeConfigSchema, 'count']` 한 줄에만 의존하며, `loop.schema.spec.ts` 에는 별도 `ui.required` 잠금 테스트가 없음.
  - 위치: `codebase/backend/src/nodes/logic/loop/loop.schema.ts` (변경 파일), `logic-ui-required.spec.ts:53`
  - 상세: `database-query`, `http-request`, `send-email`, `form` 노드는 각 `*.schema.spec.ts` 파일에 독립적인 `describe('...NodeConfigSchema ui.required')` 블록이 있으나, Logic 카테고리의 `loop`, `foreach`, `map`, `split`, `if-else`, `variable-declaration`, `variable-modification`, `switch` 는 `logic-ui-required.spec.ts` 라는 별도 파일로 통합 관리됨. 일관성 측면에서 허용 가능하나, 개별 `*.schema.spec.ts` 파일에서 해당 테스트가 누락되어 파일만 보고는 커버리지를 파악하기 어려움.
  - 제안: 현 구조 유지 시 `logic-ui-required.spec.ts` 상단 주석에 "이 파일이 각 `*.schema.spec.ts` 의 `ui.required` 잠금 테스트를 대신함"을 명시해 추후 기여자의 혼동 방지.

- **[WARNING]** `sendEmailNodeConfigSchema ui.required` 테스트에서 `subject` 와 `body` 필드의 테스트 케이스 이름(레이블)이 `it.each` 에서 누락됨.
  - 위치: `codebase/backend/src/nodes/integration/send-email/send-email.schema.spec.ts:992-999`
  - 상세: `it.each([...])('marks %s as required (mirrors %s)', (key) => { ... })` 에서 콜백 파라미터가 `(key)` 하나뿐이고 두 번째 인자(`warningRuleId`)는 받지 않음. `%s` 두 번 중 두 번째 `%s`는 test name에 interpolation되지만 assertion에 쓰이지는 않아 기능적 오류는 아님. 그러나 `key` 하나만 검증하므로, warningRuleId 와의 실제 연결 여부(spec 정렬)는 테스트 이름에만 서술되고 검증되지 않음.
  - 제안: 콜백을 `([key, ruleId]) => { ... }` 형태로 변경해 destructuring 의도를 명확히 하거나, `_ruleId` 로 명시해 의도적 미사용임을 표시.

- **[INFO]** `foreach.schema.ts`, `map.schema.ts`, `split.schema.ts`, `loop.schema.ts` 의 `ui.required` 변경에 대해 통합 테스트(`logic-ui-required.spec.ts`)만 존재하고, 해당 노드 개별 `*.schema.spec.ts` 파일에는 `warningRules` 동작 테스트도 없거나 불완전함.
  - 위치: `foreach.schema.ts`, `map.schema.ts`, `split.schema.ts`, `loop.schema.ts` (변경 파일들)
  - 상세: `database-query.schema.spec.ts` 나 `http-request.schema.spec.ts` 는 `warningRules` 동작(fired/not-fired), `validateConfig`, `evaluateMetadataBlockingErrors` 통합을 모두 커버하는 반면, `foreach`, `map`, `split` 스키마에는 이러한 테스트가 존재하는지 이 변경 범위에서는 확인되지 않음. `ui.required` 잠금 테스트가 추가되었으나, `warningRules` 자체의 동작 회귀 테스트가 누락되어 있을 가능성이 있음.
  - 제안: `foreach.schema.spec.ts`, `map.schema.spec.ts`, `split.schema.spec.ts` 파일에 최소한 `warningRules` 의 `fired/not-fired` 케이스 테스트가 있는지 확인하고, 없다면 추가.

- **[INFO]** `z.toJSONSchema()` 를 모든 `ui.required` 잠금 테스트에서 직접 호출하는 패턴이 반복적으로 사용됨. `unknown as` 이중 캐스트(`as unknown as { properties?: Props }`)가 각 테스트 파일에 복제되어 있음.
  - 위치: `database-query.schema.spec.ts:44-48`, `http-request.schema.spec.ts:419-424`, `send-email.schema.spec.ts:948-953`, `form.schema.spec.ts:3362-3365`, `logic-ui-required.spec.ts:178-179`
  - 상세: 기능적 문제는 없으나, 추후 `z.toJSONSchema` API 가 변경되거나 캐스트 타입이 바뀔 경우 5곳 이상을 동시에 수정해야 함. `logic-ui-required.spec.ts` 에서 `uiMeta` 헬퍼를 추출한 것은 좋은 시도이나, Integration/Presentation 테스트는 여전히 인라인 패턴을 쓰고 있어 일관성이 없음.
  - 제안: 공유 테스트 유틸(`test-helpers` 또는 `node-test-utils.ts`)에 `getUiMeta(schema, key)` 헬퍼를 추출해 모든 `*.schema.spec.ts` 에서 재사용.

- **[INFO]** `http-request.schema.spec.ts` 에서 새로 추가된 `describe('httpRequestNodeConfigSchema ui.required / requiredWhen')` 블록이 기존 `describe('validateHttpRequestConfig (imperative)')` 블록 이후에 위치하여 파일 구조 순서가 다른 노드(database-query: schema 블록 → warningRules 블록 순)와 다름.
  - 위치: `codebase/backend/src/nodes/integration/http-request/http-request.schema.spec.ts:570`
  - 상세: 기능적 문제는 없으나, `database-query.schema.spec.ts` 는 파일 시작 부분에 `ui.required` 블록을 두고, `http-request.schema.spec.ts` 는 중간에 삽입되어 있어 일관성이 부족함.
  - 제안: 신규 `ui.required` describe 블록을 파일 상단(다른 describe 블록 이전)으로 이동해 `database-query` 패턴과 일치시킴. (변경 범위 내에서 선택적 개선)

- **[INFO]** `logic-ui-required.spec.ts` 에서 `switch.switchValue` 의 `requiredWhen` 를 검증하는 테스트는 존재하나, `switch.cases` 의 `required: true` 검증은 `it.each` 내 `['switch', switchNodeConfigSchema, 'cases']` 로 커버됨. 그러나 `switch` 의 `warningRules` 동작(`switch:value-mode-needs-switch-value`, `switch:no-cases`)을 직접 테스트하는 코드가 이 변경 범위에서 보이지 않음.
  - 위치: `codebase/backend/src/nodes/logic/logic-ui-required.spec.ts`
  - 상세: `ui.required` 메타 잠금 테스트와 실제 warning 발화 테스트는 분리된 계층이며, 후자가 다른 파일에 있을 수 있으나 이번 변경 범위에서는 확인 불가. `switch.schema.spec.ts` 에 warningRules 테스트가 없다면 회귀 위험 존재.
  - 제안: `switch.schema.spec.ts` 에 `warningRules` 발화 여부 케이스를 추가해 회귀 방지.

## 요약

이번 변경은 `warningRules` SSOT 와 frontend `ui.required`/`ui.requiredWhen` 메타데이터 사이의 정합화를 위한 sweep 작업으로, 각 schema 파일에 `required: true` / `requiredWhen` 를 추가하고 `z.toJSONSchema()` 를 통해 이를 검증하는 잠금 테스트를 함께 추가하였다. Integration 카테고리(database-query, http-request, send-email)는 각 `*.schema.spec.ts` 에 독립 describe 블록으로 테스트가 추가되어 가독성과 격리성이 양호하다. Logic 카테고리는 `logic-ui-required.spec.ts` 에 통합 관리하여 중복을 줄였으나, `foreach`, `map`, `split`, `loop` 의 개별 spec 파일에서 warningRules 동작 커버리지가 이번 변경 범위 내에서 확인되지 않는다. `send-email` 의 `it.each` 콜백에서 두 번째 파라미터 destructuring 이 누락된 사소한 가독성 문제와, 테스트 유틸 패턴이 파일마다 인라인 복제되어 있어 추후 유지보수 부담이 있는 점이 개선 여지로 남는다. 전반적으로 테스트 존재 여부와 의도 표현은 적절하며, 발견된 이슈는 대부분 INFO 수준이다.

## 위험도

LOW
