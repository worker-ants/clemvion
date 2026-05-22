# 요구사항(Requirement) 리뷰 결과

**리뷰 대상**: Cafe24 조건부 필수 (`constraints`) — backend 구현 (파일 1-26)
**관련 Spec**: `spec/conventions/cafe24-api-metadata.md` §2 "constraints 의 의미" + §6 step 5/8 + §7 pseudo-code (2026-05-22 갱신분)
**리뷰 일시**: 2026-05-22

---

## 발견사항

### [INFO] spec §7 pseudo-code 가 `integration.name` 없이 `(Cafe24 ${op.method} ${op.path})` 로 기술 — 실제 구현은 `— via Internal Bridge: ${integrationName}` 포함
- 위치: `spec/conventions/cafe24-api-metadata.md §7` pseudo-code ("`(Cafe24 ${op.method} ${op.path})`") vs `cafe24-mcp-tool-provider.ts` `buildToolDescription()` ("`(Cafe24 ${op.method} ${op.path} — via Internal Bridge: ${integrationName})`")
- 상세: spec §7 의 `descParts` 조립 예시에는 integration name suffix 가 없지만, 실제 `buildToolDescription` 함수는 `— via Internal Bridge: ${integrationName}` 를 포함한다. spec §7 주석에 "본 §7 pseudo-code 는 ... derivative" 라고 명시되어 §2 가 SoT 임을 인지하고 있으며, spec §2 의 `customer_list` MCP tool description 예시도 `(Cafe24 GET customers — via Internal Bridge: <integration.name>)` 형태다. spec §7 과 §2 사이의 미세한 표현 불일치이나, 실제 구현 동작은 §2 예시에 부합한다.
- 제안: spec §7 의 pseudo-code 를 `(Cafe24 ${op.method} ${op.path} — via Internal Bridge: <integration.name>)` 로 보정하는 것을 권장 (project-planner 위임). 코드 동작에는 영향 없음.

### [INFO] `constraint-validator.ts` 의 spec §6 step 참조가 구 번호를 사용
- 위치: `codebase/backend/src/nodes/integration/cafe24/metadata/constraint-validator.ts` 파일 JSDoc — `§6 step 8 (runtime validation entry)`
- 상세: spec §6 신규 endpoint 추가 절차에서 "조건부 제약 확인" 은 step 5 로 이동됐고 (구 step 8), runtime 검증은 `metadata.spec.ts` invariant 로 step 8 에서 다룬다. 파일 JSDoc 의 `§6 step 8` 참조는 구 단계 번호이므로 spec 현행 번호와 불일치.
- 제안: JSDoc 참조를 `§6 step 5 (조건부 제약 확인)` 으로 수정. 동작에는 영향 없음.

### [INFO] 테스트 커버리지 부분 누락 — `allOrNone` / `implies` 에 대한 MCP tool-provider handler-level 테스트 없음
- 위치: `codebase/backend/src/nodes/ai/ai-agent/tool-providers/cafe24-mcp-tool-provider.spec.ts`
- 상세: 파일 1 (spec)에 추가된 `execute()` 테스트는 `oneOf` 위반/만족 케이스 2개만 포함한다. plan (`plan/complete/cafe24-conditional-required-impl.md`) §4 에는 "3종 kind × (위반/만족)" 테스트를 추가한다고 명시했지만, 실제 MCP provider spec 파일에는 `allOrNone`·`implies` 의 execute-level 케이스가 없다. `constraint-validator.spec.ts` 가 단위 테스트로 세 kind 를 모두 커버하므로 regression 방어는 있지만, integration-level 경계에서는 `oneOf` 만 검증된다.
  - plan §4 원문: "`execute()` 가 `constraints` 위반 args 에 대해 `CAFE24_MISSING_FIELDS` 에러 envelope 반환". — kind 구분 미명시지만 3종 단위 추가가 의도였다면 미완.
- 제안: MCP provider spec 에 `allOrNone`·`implies` 위반 케이스를 각 1건씩 추가하거나, `constraint-validator.spec.ts` 단위 테스트로 충분하다고 plan 주석에 명시하면 명확해진다. LOW 위험.

### [INFO] `cafe24.handler.spec.ts` 에 `allOrNone`·`implies` handler-level 테스트 없음
- 위치: `codebase/backend/src/nodes/integration/cafe24/cafe24.handler.spec.ts` (파일 3)
- 상세: plan §3 는 "3종 kind × (위반/만족) 6개 케이스 추가"를 명시했으나, 추가된 테스트는 `oneOf` 2케이스만 포함. `allOrNone`·`implies` 위반 테스트가 없다. `constraint-validator.spec.ts` 가 단위 커버를 하고 있고 handler 통합 경계에서도 동일 함수(`validateCafe24Constraints`)가 호출되므로 기능 회귀 위험은 낮으나, plan 과 실제 커버리지 간 불일치가 있다.
- 제안: plan 을 현행("oneOf 케이스만 handler level에서 검증") 반영으로 수정하거나, `allOrNone`/`implies` 케이스를 handler spec 에 추가한다.

---

## Spec Fidelity (spec 본문 일치 여부) 점검

### spec §2 MCP/JSON Schema 매핑 표 vs 구현

| spec 요구사항 | 구현 위치 | 일치 여부 |
|---|---|---|
| `oneOf` → `anyOf: [{required:[a]}, ...]` | `cafe24-mcp-tool-provider.ts buildJsonSchema()` | 일치 |
| `requiredFields` 비어있지 않으면 `allOf: [{required:[...requiredFields]}, {anyOf:...}]` | 동 함수 | 일치 |
| `allOrNone` / `implies` JSON Schema 변환 없음 | 동 함수 (`oneOfConstraints` 필터만 처리) | 일치 |
| description suffix: `base → (Cafe24 method path) → constraint lines → CAFE24_TIMEZONE_SUFFIX` | `buildToolDescription()` | 일치 |
| constraint suffix 포맷: `Constraint: at least one of {a}, {b} must be provided.` | `constraintToSuffixLine()` | 일치 |
| `allOrNone` suffix: `Constraint: {a}, {b} must be provided together (all or none).` | `constraintToSuffixLine()` | 일치 |
| `implies` suffix: `Constraint: when {a} is provided, {b}, {c} are also required.` | `constraintToSuffixLine()` | 일치 |
| runtime 검증은 `requiredFields` 검사 직후 | handler.ts `:171`, mcp-tool-provider.ts `:204` | 일치 |
| 위반 시 `CAFE24_MISSING_FIELDS` 에러 코드 재사용 | 두 파일 모두 | 일치 |

### spec §2 invariant vs `metadata.spec.ts`

| spec invariant | metadata.spec.ts 검증 | 일치 여부 |
|---|---|---|
| `fields` 참조하는 필드명이 `operation.fields` 키 부분집합 | 있음 (파일 9) | 일치 |
| `oneOf.fields` / `allOrNone.fields` 길이 ≥ 2 | 있음 | 일치 |
| `implies.then` 길이 ≥ 1 | 있음 | 일치 |

### spec §2 type 정의 vs `types.ts`

| spec 타입 | `types.ts` 구현 | 일치 여부 |
|---|---|---|
| `{ kind: 'oneOf'; fields: string[] }` | 일치 | 일치 |
| `{ kind: 'allOrNone'; fields: string[] }` | 일치 | 일치 |
| `{ kind: 'implies'; if: string; then: [string, ...string[]] }` | 일치 (tuple) | 일치 |
| `Cafe24OperationMetadata.constraints?: Cafe24FieldConstraint[]` | 일치 | 일치 |

### `customer.ts` 의 `customer_list` constraint 등재 (spec §2 예시)
- spec §2 예시: `constraints: [{ kind: 'oneOf', fields: ['member_id', 'group_no', 'since'] }]`
- `customer.ts` 구현: 동일 — 일치

---

## 요약

4개 파일(constraint-validator, types, handler, mcp-tool-provider) + 4개 테스트 + 1개 메타데이터 파일로 구성된 이번 변경은 `spec/conventions/cafe24-api-metadata.md` §2 "constraints 의 의미" 에 명시된 요구사항을 실질적으로 충족한다. 타입 정의·JSON Schema 변환 규칙·description suffix 포맷·runtime 검증 순서·에러 코드 재사용 모두 spec 본문과 line-level 로 일치하며, `customer_list` canonical 예시도 정확히 구현됐다. 발견된 이슈 4건은 모두 INFO 등급이며 — spec §7 pseudo-code 와 구현 간 integration-name suffix 표현 미세 불일치, JSDoc 의 구 step 번호 참조, plan 에서 약속한 "3종 kind × 위반·만족" 테스트가 handler spec / MCP provider spec 모두 `oneOf` 2케이스에만 그침 — 기능 동작이나 회귀 보호 수준에는 영향이 없다.

---

## 위험도

LOW
