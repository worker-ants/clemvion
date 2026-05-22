# 신규 식별자 충돌 검토 — `spec/conventions/cafe24-api-metadata.md`

검토 모드: 구현 착수 전 (--impl-prep)
검토 대상: `spec/conventions/cafe24-api-metadata.md` (2026-05-22 변경분)

---

## 발견사항

### 발견사항 1

- **[WARNING]** `kind: 'oneOf'` — `UiHint.visibleWhen.oneOf` 와 이름 충돌 (의미 다름, 타입 네임스페이스 분리)
  - target 신규 식별자: `Cafe24FieldConstraint` 의 discriminant 리터럴 `kind: 'oneOf'` — "listed `fields` 중 최소 1개가 제공되어야 함 (at-least-one-of)"
  - 기존 사용처:
    - `codebase/backend/src/nodes/core/node-component.interface.ts:220` — `UiHint.visibleWhen?: { field: string; oneOf: unknown[] }` — "config[field] 가 oneOf 배열에 포함되면 visible" (값 whitelist 비교)
    - `codebase/frontend/src/lib/node-definitions/types.ts:59` — `UiHint.visibleWhen?: { field: string; oneOf: readonly unknown[] }` (동일 의미)
    - `codebase/frontend/src/components/editor/settings-panel/auto-form/visibility.ts:23` — `if ("oneOf" in rule) return Array.isArray(rule.oneOf) && rule.oneOf.includes(value)`
    - `spec/4-nodes/1-logic/2-switch.md:246,248` — `visibleWhen` DSL 의 `oneOf` 형태를 한시 유지 중임을 언급
  - 상세: 의미가 완전히 다르다. `UiHint.visibleWhen.oneOf` 는 **단일 필드의 값이 배열에 포함되는지** 판단하는 값 whitelist 조건이다. `Cafe24FieldConstraint.kind = 'oneOf'` 는 **여러 필드 중 최소 1개의 존재 여부** 를 검사하는 at-least-one-of 제약이다. 타입 네임스페이스가 다르므로 (`Cafe24FieldConstraint` vs `UiHint`) 컴파일·런타임 충돌은 없다. 그러나 문서상 같은 토큰이 두 가지 다른 의미로 사용되면 새 구현자가 혼동할 위험이 있다. target 문서 자체는 이를 인지하고 `kind: 'oneOf'` type 정의 직후 "이름 주의" 박스에서 두 가지(`JSON Schema oneOf`, `UiHint.visibleWhen.oneOf`)와의 의미 차이를 명시하고 있다.
  - 제안: target 이 이미 문서 내 disambiguation 박스를 두었으므로 즉각적 이름 변경은 불필요하다. 다만 구현 시 `Cafe24FieldConstraint` 의 `kind` 리터럴 값을 `'at_least_one_of'` 또는 `'any_of_fields'` 로 바꾸면 혼동 가능성이 원천 제거된다. 변경 비용이 낮은 구현 착수 전 시점에 검토를 권장한다.

---

### 발견사항 2

- **[WARNING]** `CAFE24_MISSING_FIELDS` 에러 코드의 의미 확장 — 기존 정의와 의미 범위 불일치
  - target 신규 식별자: `constraints` 위반 시에도 `IntegrationError('CAFE24_MISSING_FIELDS', ...)` 를 재사용하도록 명시 (target §2 "노드 핸들러 / MCP execute 시 runtime 검증")
  - 기존 사용처:
    - `spec/4-nodes/4-integration/4-cafe24.md:88` — "메타데이터의 `requiredFields` 에 명시된 키가 `config.fields` 에 모두 존재하는지 검증. 누락 시 `CAFE24_MISSING_FIELDS`"
    - `spec/4-nodes/4-integration/4-cafe24.md:305` — "`CAFE24_MISSING_FIELDS` — operation 의 `requiredFields` 중 일부 누락"
    - `spec/4-nodes/4-integration/4-cafe24.md:326` — "`CAFE24_MISSING_FIELDS` (D4) | operation 의 `requiredFields` 중 일부 누락"
    - `codebase/backend/src/nodes/integration/cafe24/cafe24.handler.ts` (구현체)
    - `codebase/backend/src/nodes/ai/ai-agent/tool-providers/cafe24-mcp-tool-provider.ts` (구현체)
  - 상세: 기존 spec (`4-cafe24.md`) 은 `CAFE24_MISSING_FIELDS` 를 명시적으로 "`requiredFields` 누락" 에만 연결한다. target 이 동일 코드를 `constraints` (oneOf / allOrNone / implies) 위반에도 재사용하면 에러 코드의 의미 범위가 확장된다. client/UI 가 이 코드를 받아 "어떤 필드가 누락됐는지" 분기하는 로직이 존재할 경우, `constraints` 위반 메시지 형식이 다를 때 파싱 오류가 발생할 수 있다. 에러 메시지에 constraint 종류와 필드 목록이 함께 명시된다는 점은 target 이 기술하고 있으나, 코드를 받아 처리하는 쪽의 spec (`4-cafe24.md`) 은 아직 이 확장을 반영하지 않았다.
  - 제안: `spec/4-nodes/4-integration/4-cafe24.md` 의 `CAFE24_MISSING_FIELDS` 정의를 "`requiredFields` 누락 또는 `constraints` 위반"으로 갱신해야 에러 코드 의미가 단일 SoT 로 유지된다. 구현 착수 전에 `4-cafe24.md` 의 D4 절 및 에러 코드 표를 보완하는 것을 권장한다.

---

### 발견사항 3

- **[INFO]** `buildJsonSchema` 함수명 — 동일 네임스페이스 내 기존 private 메서드와 이름 공유
  - target 신규 식별자: target §7 pseudo-code 및 §2 "MCP/JSON Schema 매핑" 에서 `cafe24-mcp-tool-provider.buildJsonSchema()` 를 `constraints` 의 `anyOf` 변환을 포함한 새 시그니처로 참조
  - 기존 사용처:
    - `codebase/backend/src/nodes/ai/ai-agent/tool-providers/cafe24-mcp-tool-provider.ts:619` — `private buildJsonSchema(op: Cafe24OperationMetadata)` 이미 존재. 현재는 `requiredFields` 만 처리하며 `constraints` 를 반영하지 않음
    - `codebase/backend/src/nodes/ai/information-extractor/information-extractor.handler.ts:1036` — 같은 이름의 별도 `private buildJsonSchema()` 가 Information Extractor 용으로 사용 중 (클래스 멤버라 충돌은 없음)
  - 상세: 이름 자체의 충돌이 아니라 **기존 구현과 target spec 이 기술하는 동작이 다름** 이 문제다. 기존 코드의 `buildJsonSchema` 는 `constraints` 를 전혀 처리하지 않고 `requiredFields` 만 `required` 배열로 변환한다. target 이 이 함수에 `oneOf → anyOf` 변환을 추가하도록 명세하므로, 구현 시 기존 함수 시그니처는 유지되지만 내부 동작을 확장해야 한다. spec 과 코드 간 드리프트가 발생 중이며 구현 작업에서 반드시 갱신해야 한다.
  - 제안: 구현 시 `buildJsonSchema` 내부에 `constraints` 처리 블록을 추가하면 되며 함수명 변경은 불필요하다. 단, `codebase/backend/src/nodes/ai/ai-agent/tool-providers/cafe24-mcp-tool-provider.spec.ts` 의 기존 `buildJsonSchema` 테스트를 확인하고, `constraints` 케이스를 커버하는 신규 단위 테스트를 추가해야 한다.

---

### 발견사항 4

- **[INFO]** `constraints` 프로퍼티명 — TypeScript 표준 라이브러리 맥락에서 흔히 쓰이는 단어
  - target 신규 식별자: `Cafe24OperationMetadata.constraints?: Cafe24FieldConstraint[]`
  - 기존 사용처: `codebase/backend/src/modules/workflows/dto/workflow-dto-validation.spec.ts:162` — `errors.some((e) => e.property === 'ownership' && e.constraints?.isIn)` — class-validator 의 `constraints` 속성 (다른 맥락, 다른 타입)
  - 상세: `constraints` 는 class-validator 라이브러리에서 검증 실패 정보를 담는 표준 필드명이다. spec 의 `Cafe24OperationMetadata.constraints` 와 class-validator 의 `constraints` 는 전혀 다른 타입이고 다른 모듈에 속해 있어 실제 충돌은 없다.
  - 제안: 조치 불필요. 맥락이 명확히 분리되어 있어 혼동 위험이 낮다.

---

## 요약

이번 검토에서 CRITICAL 등급의 식별자 충돌은 발견되지 않았다. 가장 주의가 필요한 항목은 두 가지다. 첫째, `Cafe24FieldConstraint` 의 `kind: 'oneOf'` 가 이미 코드베이스에 존재하는 `UiHint.visibleWhen.oneOf` (단일 필드 값 whitelist 비교) 와 같은 토큰을 다른 의미로 사용한다는 점이다 — 타입 네임스페이스 분리로 런타임 충돌은 없지만 구현자 혼동 위험이 있으며 target 이 문서 내 disambiguation 박스로 대응하고 있다. 둘째, `CAFE24_MISSING_FIELDS` 에러 코드가 기존에는 `requiredFields` 누락만을 의미했으나 target 이 `constraints` 위반에도 동일 코드를 재사용하도록 명세한다 — `spec/4-nodes/4-integration/4-cafe24.md` 의 해당 정의가 아직 갱신되지 않아 에러 코드의 SoT 가 분열된 상태다. 구현 착수 전 `4-cafe24.md` 보완을 권장한다. `buildJsonSchema` 는 동일 클래스 내 기존 메서드가 있고 구현 확장이 필요한 상태다.

---

## 위험도

MEDIUM
