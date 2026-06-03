---
id: common
status: implemented
code:
  - codebase/backend/src/nodes/data/transform/transform.handler.ts
  - codebase/backend/src/nodes/data/code/code.handler.ts
  - codebase/backend/src/nodes/data/transform/transform.schema.ts
  - codebase/backend/src/nodes/data/code/code.schema.ts
---

# Spec: Data 노드 공통 규약

> 관련 문서: [PRD Data 노드](../_product-overview.md#8-data-노드-2종) · [Spec 노드 개요](../0-overview.md) · [Spec 노드 공통](../../3-workflow-editor/1-node-common.md) · [Spec 노드 샌드박싱](../0-overview.md#5-노드-실행-샌드박싱) · [Spec 표현식 언어](../../5-system/5-expression-language.md)

본 문서는 Data 카테고리 노드 전체에 공통되는 규약을 정의한다. 노드별 동작·설정은 각 노드 문서를 참조한다.

- [Transform](./1-transform.md)
- [Code](./2-code.md)

---

## 1. 표현식 지원 정책

Data 노드는 다음 시점에서 `{{ }}` 표현식을 평가한다:

| 노드 | 평가 위치 |
|------|-----------|
| Transform | `set_field` operation 의 `value`, `math_op` 의 `operand` 등 — 각 operation 의 표현식 허용 파라미터 |
| Code | `$input` / `$vars` 컨텍스트 객체 (코드 내부에서는 표현식 문법이 아닌 일반 JS 변수로 노출) |

표현식 문법 자체는 [Spec 표현식 언어](../../5-system/5-expression-language.md) 의 단일 정의를 따른다.

## 2. 샌드박싱 적용 범위

Code 노드는 [노드 실행 샌드박싱 정책](../0-overview.md#5-노드-실행-샌드박싱) 을 따른다. Transform 노드는 자체 격리 컨텍스트를 사용하지 않으며, operation 체인은 핸들러 프로세스 내부에서 실행된다 (외부 네트워크 / 파일시스템 접근 없음).

샌드박싱의 세부 규칙(타임아웃, 메모리, 허용/차단 API)은 Code 노드 문서 §[샌드박싱](./2-code.md#7-샌드박싱) 에서 정의한다.

---

## 3. 캔버스 요약

| 노드 | 요약 포맷 | 예시 |
|------|-----------|------|
| Transform | `{N} operations` (operations 배열의 길이) | `3 operations` |
| Code | `{language}` (대문자, `summaryTemplate: {{language\|upper}}`) | `JAVASCRIPT` |

> 캔버스 요약은 노드 metadata 의 `summaryTemplate` 에서 렌더된다 (`getConfigSummary` → `renderSummaryTemplate`). `codeNodeMetadata.summaryTemplate` 은 `{{language|upper}}` 이다. 코드 줄 수(`N lines`)는 summaryTemplate DSL 이 개행 카운트를 지원하지 않아 요약에 포함하지 않는다 ([4-nodes/0-overview §1.4.1](../0-overview.md#141-템플릿-문법-filter-dsl)).

---

## 4. 5필드 공통 규약 (Data 카테고리)

Data 노드는 모두 [CONVENTIONS Principle 0](../../conventions/node-output.md) 의 5필드 invariant `{ config, output, meta?, port?, status? }` 를 따른다. 카테고리 특이 사용 패턴:

| 필드 | Data 카테고리에서의 사용 패턴 |
|------|--------------------------------|
| `config` | 사용자 입력 raw echo (Principle 7). `code.code` 필드는 보안 차원에서 echo하되 길이 제한 없음 (사용자 본인이 작성한 코드). `transform.operations[]` 의 expression 템플릿 보존 |
| `output` | **계산 결과**. `transform`: 변환 결과 (단일 객체 또는 배열). `code`: 사용자 코드의 `return` 값 |
| `meta` | 실행 메트릭만 (Principle 2). `meta.durationMs` (공통). `transform` 노드: `meta.{operationsApplied: number, operationsSkipped: number}`. `code` 노드: `meta.{success: boolean, logs: string[]}`. 런타임 에러는 `output.error` + `port:'error'` 로 처리 — `meta.error`/`meta.errorCode`/`exitReason` 별칭은 Phase 1 (D) 에서 폐기 (CONVENTIONS Principle 2 Code 행과 일치) |
| `port` | `transform`: `undefined` (단일 출력). `code`: `'success'` / `'error'` (런타임 에러 분기) |
| `status` | Data 노드는 모두 비-블로킹 → `undefined` |

### 4.1 에러 컨트랙트 (CONVENTIONS Principle 3)

| 노드 | Pre-flight 에러 (throw) | Runtime 에러 (`port: 'error'`) |
|------|--------------------------|----------------------------------|
| `transform` | config 검증 실패 (operation 형식 오류, 표현식 문법 오류). **runtime 에러 포트 없음** — operation 실행 실패는 throw | (없음) |
| `code` | 코드 컴파일 실패 (구문 오류) | 런타임 throw, 타임아웃, 메모리 초과 → `output.error.{code, message, details?}` + `port: 'error'` |

> Transform은 expression 평가 실패도 pre-flight throw로 처리한다 (사용자가 캔버스에서 즉시 알 수 있도록). Code는 사용자 작성 임의 코드의 throw가 정상 시나리오의 일부이므로 runtime 에러 포트로 분기.

## 5. 출력 구조 색인

| 노드 | 정상 케이스 | 에러 케이스 | Pre-flight throw |
|------|-------------|-------------|---------------------|
| [transform](./1-transform.md#5-출력-구조) | §5.1 | — | §5.8 (config·expression 오류) |
| [code](./2-code.md#5-출력-구조) | §5.1 (`success` port) | §5.3 (`error` port) | §6 (코드 컴파일 실패) |
