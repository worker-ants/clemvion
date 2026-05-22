# 부작용(Side Effect) 리뷰 결과

**대상**: Cafe24 조건부 필수 (`constraints`) backend 구현
**파일 수**: 11개 (코드 6 + 테스트 4 + plan/review 문서 다수)
**검토 일시**: 2026-05-22

---

## 발견사항

### [INFO] `buildToolDescription` / `constraintToSuffixLine` — 신규 exported 함수가 공개 API 표면 확장

- **위치**: `codebase/backend/src/nodes/ai/ai-agent/tool-providers/cafe24-mcp-tool-provider.ts` (diff +278~+305)
- **상세**: 두 함수가 `export function` 으로 모듈 공개 API 에 추가된다. 기존 `buildTools()` 내 인라인 템플릿 리터럴이 `buildToolDescription()` 호출로 교체되어 기존 description 포맷이 변경된다 (constraints 없는 operation 은 suffix 개수가 0이므로 `parts.join('\n\n')` 결과가 동일). 테스트(`cafe24-mcp-tool-provider.spec.ts`)가 이를 커버한다.
- **영향**: 두 함수를 직접 import 하는 외부 코드가 생기면 해당 시그니처가 공개 계약이 된다. 현재는 테스트 파일만 참조하므로 위험 없음. 향후 변경 시 주의 필요.
- **제안**: 내부 유틸리티 성격이면 파일 내 non-export 로 두거나, `@internal` JSDoc 을 추가해 의도적 공개 여부를 명시.

---

### [INFO] `validateCafe24Constraints` — `index.ts` re-export 로 새 공개 진입점 추가

- **위치**: `codebase/backend/src/nodes/integration/cafe24/metadata/index.ts` (diff +920)
- **상세**: `export { validateCafe24Constraints } from './constraint-validator.js'` 가 `metadata/index.ts` 의 배럴에 추가된다. 이 모듈을 import 하는 모든 소비자(handler, MCP provider, 테스트 등)에게 `validateCafe24Constraints` 가 노출된다.
- **영향**: 기존 소비자 호출 코드 변경 없음. 단, 공개 표면 증가로 인해 미래에 이 함수를 오용하거나 side-by-side import 로 중복 검증하는 코드가 생길 수 있다.
- **제안**: 현재 구조는 두 호출 지점(handler, MCP provider)이 명시적으로 import 해 쓰는 설계이므로 적절. 추가 조치 불필요.

---

### [INFO] `customer.ts` — `customerOperations` 배열의 기존 `customer_list` 객체에 `constraints` 필드 추가 (기존 데이터 구조 변경)

- **위치**: `codebase/backend/src/nodes/integration/cafe24/metadata/customer.ts` (diff +895~+898)
- **상세**: 런타임에 `listAllCafe24Operations()` 가 반환하는 `customer_list` 객체에 `constraints` 필드가 추가된다. 기존에 이 객체를 순회·직렬화하는 코드(예: catalog-sync, 어드민 API 목록 노출)가 있다면 새 필드를 포함한 결과를 받게 된다.
- **영향**: `constraints` 는 optional 필드이므로 기존 소비자가 해당 키 부재를 가정하던 코드에서 예외 없이 무시된다. 단, catalog-sync 가 operation 객체를 DB 컬럼과 1:1 직렬화한다면 미매핑 컬럼 경고가 발생할 수 있다.
- **제안**: diff 내 주석 및 consistency check 결과(I-3)에서 `constraints` 는 catalog 컬럼에 추가하지 않았음을 명시하고 있어 직접 영향 없다고 판단. 확인 완료.

---

### [INFO] `cafe24.handler.ts` — constraints 검증이 `integration.resolve` (DB 조회) 이전에 수행됨 — 의도된 early-return 이지만 검증 순서 부작용 주의

- **위치**: `codebase/backend/src/nodes/integration/cafe24/cafe24.handler.ts` (diff +403~+412)
- **상세**: `constraintViolation` 체크가 step 2b 에서 수행되어 step 3(`resolveIntegration` DB 조회) 이전에 throw 한다. 이는 DB I/O 없이 일찍 실패하는 바람직한 설계다.
- **영향**: `IntegrationUsageLog` 기록이 constraint violation 시에도 plan/in-progress/node-output-redesign/cafe24.md §4 에서 기술된 대로 `IntegrationError('CAFE24_MISSING_FIELDS', ...)` 경로로 처리된다. Usage log writer 가 이 예외를 처리하는지 확인이 필요하나, 기존 `requiredFields` 누락 경우와 동일 코드·동일 경로이므로 기존 동작과 일치한다.
- **제안**: 추가 조치 불필요. 기존 `CAFE24_MISSING_FIELDS` 처리 경로 그대로 재사용.

---

### [INFO] `buildJsonSchema()` — `required` 필드 제거 및 `allOf` 전환이 기존 JSON Schema 소비자에 영향

- **위치**: `codebase/backend/src/nodes/ai/ai-agent/tool-providers/cafe24-mcp-tool-provider.ts` (diff +225~+261)
- **상세**: `oneOf` constraint 가 있는 operation(`customer_list`)의 JSON Schema 가 기존 `required: ['shop_no']` 에서 `allOf: [{required:['shop_no']}, {anyOf:[...]}]` 로 변환된다. `constraints` 가 없는 operation 은 기존과 동일한 `required` 를 emit 한다.
- **영향**: LLM tool-call 검증기가 `allOf + anyOf` 조합을 올바르게 해석하는지는 LLM/SDK 의존이다. 단, JSON Schema 표준상 유효하고 테스트에서 커버된다. 다른 소비자가 `parameters.required` 를 직접 읽는 경우(예: frontend 폼 자동 생성) 에는 `required` 가 없어 필수 필드 힌트가 누락될 수 있다.
- **제안**: `allOf` 안의 `{required:[...]}` 로 표준 스키마를 따르므로 JSON Schema 를 올바르게 파싱하는 소비자에게는 문제없다. frontend 폼이 `parameters.required` 를 직접 참조한다면 별도 확인 권장 — 현재 spec 에서 frontend UI 는 out-of-scope 로 명시되어 있어 즉각 조치 불필요.

---

### [INFO] 파일시스템 부작용 — 신규 파일 생성

- **위치**: `codebase/backend/src/nodes/integration/cafe24/metadata/constraint-validator.ts` (new file), `plan/complete/cafe24-conditional-required-impl.md` (new file), `review/consistency/2026/05/22/...` 다수 (new files)
- **상세**: 모두 의도된 신규 생성이다. constraint-validator.ts 는 기능 구현 파일, plan/complete/... 는 계획 추적, review/... 는 일관성 검토 산출물.
- **영향**: 예상치 못한 파일 생성 없음.

---

### [INFO] 환경 변수 / 네트워크 호출 / 이벤트 — 해당 없음

- `validateCafe24Constraints` 는 순수 함수 (읽기 전용, 외부 I/O 없음).
- `buildToolDescription`, `constraintToSuffixLine` 도 순수 문자열 변환.
- 새 네트워크 호출, 환경 변수 읽기/쓰기, 이벤트 발생 추가 없음.

---

## 요약

이번 변경은 `Cafe24OperationMetadata.constraints?` 신규 optional 필드 추가와 이를 소비하는 순수 함수(`validateCafe24Constraints`, `buildToolDescription`, `constraintToSuffixLine`) 도입이 핵심이다. 세 함수 모두 전역 상태를 수정하지 않으며 외부 I/O 없는 순수 로직이다. 기존 `requiredFields` 검증 이후 early-exit 지점을 하나 추가한 것이어서 기존 경로(DB 조회, API 호출, 이벤트)는 그대로 유지된다. JSON Schema 구조가 `oneOf` constraint 보유 operation 에서 `required` → `allOf + anyOf` 로 전환되는 점이 유일한 관찰 포인트이나, 이는 spec 이 의도한 변환이고 테스트로 커버된다. 의도하지 않은 전역 상태 변경·파일시스템 부작용·환경 변수 조작·네트워크 호출·이벤트 변경은 발견되지 않는다.

---

## 위험도

LOW

CRITICAL·WARNING 발견 없음. 모든 발견사항은 INFO 등급으로 설계 의도와 일치하며 기존 호출자에 역방향 호환성을 해치는 변경이 없다.

---

STATUS: success ISSUES=5
