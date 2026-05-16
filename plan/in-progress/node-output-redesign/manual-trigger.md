# Manual Trigger output 개선안

> **최신화 검토 (2026-05-16)**: 현 spec 과 본 plan 의 분석이 정합. `config.parameters` (스키마) ↔ `output.parameters` (런타임 값) 직교 + webhook 한정 `output.request` 노출 + `__triggerSource` internal 마커 유지. 잔여 권고 없음 (이름 중복 리네이밍은 호환성 영향이 커 별도 트랙).

> 대상 spec: `spec/4-nodes/7-trigger/1-manual-trigger.md` (§5 출력 구조)

## 현재 output (spec 인용)

`spec/4-nodes/7-trigger/1-manual-trigger.md:82-94` — §5.1 Manual / Schedule (port `out`):

```json
{
  "config": { "parameters": [{ "name": "orderId", "type": "string", "required": true }, { "name": "count", "type": "number", "defaultValue": 0 }] },
  "output": { "parameters": { "orderId": "abc-123", "count": 3 } },
  "meta": { "source": "manual" }
}
```

§5.2 Webhook 어댑터 (port `out`):

```json
{
  "config": {...},
  "output": {
    "parameters": { "orderId": "abc-123" },
    "request": { "method": "POST", "headers": {...}, "query": {...}, "body": {...} }
  },
  "meta": { "source": "webhook" }
}
```

## 진단

Manual Trigger 는 **워크플로우 진입점** (단계 1개). 어댑터 종류 (manual / schedule / webhook) 에 따라 `output.request` 유무가 결정.

| 영역 | 적절성 | 근거 |
| --- | --- | --- |
| `config.parameters: TriggerParameterDefinition[]` | 적절 (config) | UI/schema 로 정의한 raw 스키마 (`{name, type, ...}` 객체 배열) |
| `output.parameters: Record<string, unknown>` | 적절 (output) | 어댑터가 입력 + defaultValue 병합 후 해석한 런타임 값 (`{[name]: value}` 맵) |
| **`config.parameters` ↔ `output.parameters` 의 직교성** | 적절 — spec footnote 명시 | "이름은 같지만 shape 이 다르다" — `config.parameters` 는 스키마, `output.parameters` 는 런타임 값. echo 관계 아님 |
| `output.request: {method, headers, query, body}` (webhook 한정) | 적절 (output) | webhook transport 컨텍스트 — 다운스트림이 raw HTTP 정보 참조 가능 |
| `meta.source: 'manual' | 'webhook' | 'schedule'` | 적절 (meta) | 어댑터 출처 — Principle 2 의 실행 컨텍스트 |
| `port` / `status` | 미설정 | Principle 5 — 단일 출력, 비-블로킹 |
| `__triggerSource` 마커 | 적절 — internal | 핸들러 진입 후 즉시 제거 (output 으로 누출 방지) |

부적절 항목 없음.

추가 점검:

1. **`config.parameters` 와 `output.parameters` 의 이름 충돌** — 같은 이름이지만 shape 이 완전히 다름. spec 이 footnote 로 명시 경고. 리네이밍 검토 가치 있음 (예: `output.values` 또는 `output.resolvedParameters`) — 그러나 이미 다운스트림 표현식이 `$node["Manual Trigger"].output.parameters.<name>` 으로 사용 중이라 호환성 영향 큼.
2. **`output.request` (webhook 한정)** — Manual / Schedule 어댑터에서는 필드 자체 생략 (Principle 11). 다운스트림은 `meta.source === 'webhook'` 으로 분기 또는 `output.request?.method` 옵셔널 체이닝.
3. **`$params.<name>` / `$input.parameters.<name>` shortcut** — 다운스트림 첫 노드 한정 별칭. spec §5 expression 접근 예에 명시. 편의성 제공.

## 개선안 — 정리된 output

현 spec 부합. 변경 없음.

```json
// Manual / Schedule
{
  "config": { "parameters": [<TriggerParameterDefinition>, ...] },     // 스키마
  "output": { "parameters": <Record<name, value>> },                   // 런타임 값
  "meta": { "source": "manual" | "schedule" }
}

// Webhook
{
  "config": { "parameters": [...] },
  "output": {
    "parameters": <Record>,
    "request": { "method": <string>, "headers": <object>, "query": <object>, "body": <unknown> }
  },
  "meta": { "source": "webhook" }
}
```

## 분리 제안 — output 에서 빠질 항목의 새 위치

| 기존 output 항목 | 새 위치 | 사유 |
| --- | --- | --- |
| (없음 — 단 `output.parameters` 의 이름 중복은 리네이밍 검토 가치 있음) | — | 호환성 영향 평가 필요 |

## Rationale

- Trigger 노드는 워크플로우 진입점 — input 이 없으므로 `config.parameters` (스키마) + 어댑터 입력 → `output.parameters` (런타임 값) 로 단방향 흐름.
- `config.parameters` ↔ `output.parameters` 직교성은 spec 이 명시한 핵심 디자인. Principle 1.1 의 변형 — 같은 이름 다른 shape.
- `output.request` 의 조건적 노출 (webhook 만) 은 Principle 11 (`undefined` 필드 echo 금지) 부합.
- `__triggerSource` 마커의 internal 처리는 5필드 invariant 외 top-level 필드를 사용자에게 노출하지 않는 안전 장치.
- `meta.source` 필드 위치 (vs `output`) — 출처는 비즈니스 데이터라기보다 실행 컨텍스트 식별자 (Principle 2). `meta` 가 적절.

## 구현 분석 (2026-05-16)

대상 파일: `backend/src/nodes/trigger/manual-trigger/{manual-trigger.handler.ts, manual-trigger.schema.ts, manual-trigger.handler.spec.ts, manual-trigger.component.ts}`.

1. **spec §5 ↔ handler return 정합성**:
   - **Manual / Schedule** (`manual-trigger.handler.ts:129-143`): `{ config: { parameters: rawParameters }, output: { parameters: resolvedParameters }, meta: { source } }` — spec §5.1 과 일치. `output.request` 가 webhook 가 아닌 경우 생략 (`:130-137` 조건문).
   - **Webhook** (`manual-trigger.handler.ts:130-137`): `output.request = { method, headers, query, body }` 4필드 추가 + `meta.source: 'webhook'` — spec §5.2 와 일치.
   - **공통**: `port` / `status` 미설정 — spec §3.1 의 "단일 출력, 비-블로킹" 부합.
   - **`__triggerSource` 마커 비노출**: handler 가 `output.request` 만 4 transport 키에서 추출하고 `__triggerSource` 는 절대 output 으로 누출 안 됨 (`:131-137` 가 명시적 화이트리스트). 테스트 (`manual-trigger.handler.spec.ts:194-203`) 가 검증.

2. **schema ↔ spec config 정합성**: `manualTriggerConfigSchema` (`manual-trigger.schema.ts:49-62`) 의 `parameters: array<TriggerParameterDefinition>` (default `[]`) 가 spec §1 표와 일치. `triggerParameterSchema` (`:7-27`) 의 5필드 (`name/type/required/defaultValue/description`) 가 Trigger 공통 §1 `TriggerParameterDefinition` 인터페이스와 정합.

3. **validate 일관성**:
   - `manual-trigger.handler.ts:86-101` 의 `handler.validate()` 는 `evaluateMetadataBlockingErrors` (warningRules 없음 — `:88-91` 주석이 "오늘 warningRules 없음" 명시) + `validateTriggerParameterSchema` (`execution-engine/utils/resolve-trigger-parameters` SSOT). 핸들러가 자체 enum/identifier 규칙 재구현 안 함.
   - 즉, identifier 검증 / 중복 검출 / type enum 검사 모두 외부 모듈 위임. spec §6 표의 4 종 검증 시점이 모두 `handler.validate` 이면서 메시지는 `parameters.<name>: <reason>` prefix (`:97`) 로 통일.

4. **에러 컨트랙트 (Principle 3)**: `handler` 는 runtime 에러 포트 없음 — `output.error` 생성 경로 자체 부재. 모든 검증 실패는 어댑터 단계(`resolveTriggerParameters`) 또는 `handler.validate` 단계의 pre-flight throw. spec §6 표와 일치.

5. **conventions Principle 0–11 위반 패턴**:
   - **Principle 1.1 (config ↔ output 직교)**: `config.parameters` (스키마 array) vs `output.parameters` (런타임 값 record) — 이름은 같으나 shape 이 다른 직교. spec footnote 가 명시 경고. handler 가 명확히 분리 (`:111-120`). 부합.
   - **Principle 2 (meta = 실행 컨텍스트)**: `meta.source` 가 어댑터 출처 식별 — Principle 2 의 "실행 메트릭" 보다는 "실행 컨텍스트" 인데 Trigger 공통 §3 가 "필수" 로 분류. 부합.
   - **Principle 5 (port 활성화)**: `port: undefined` (= 단일 출력 `'out'`). 부합.
   - **Principle 7 (config raw echo)**: `rawConfig.parameters ?? []` 패턴 (`:111-112`) 으로 `defaultValue` 의 `{{ }}` 템플릿 raw 보존. `manual-trigger.handler.spec.ts:228-244` 가 `rawConfig.parameters[*].defaultValue: '{{ $today }}'` 보존 + `evaluatedSchema` 와 분리 검증.
   - **Principle 10 (null/빈 입력 fallback)**: `isPlainRecord(typedInput?.parameters)` 가 아닐 때 `{}` fallback (`:118-120`), 전체 input 이 null/non-record 일 때 `typedInput = undefined` (`:114-116`). 테스트 (`manual-trigger.handler.spec.ts:205-216`) 가 검증.
   - **Principle 11 (undefined 필드 echo 금지)**: `output.request` 가 manual/schedule 에서 자체 생략 (`:130` `if (source === 'webhook' ...)`). 부합.

6. **handler 테스트 (`manual-trigger.handler.spec.ts`)**:
   - validate 5 케이스 (`:30-67` — undefined / 정상 / 중복 name / invalid identifier / non-array).
   - execute: resolved parameters 노출 (`:71-82`), webhook transport 묶기 (`:84-126`), `__triggerSource` 없을 때 transport-shape 감지 fallback (`:128-152`), schedule (`:154-166`), manual (`:168-179`), default fallback (`:181-192`), 마커 누출 방지 (`:194-203`), null input fallback (`:205-216`), `config.parameters` schema echo (`:218-226`), rawConfig 우선순위 + `{{ }}` 템플릿 보존 (`:228-244`). 모든 spec §5 케이스 커버.

7. **횡단 일관성 (진입점 단독)**:
   - Trigger 카테고리는 본 노드 단독 (Manual / Webhook / Schedule 어댑터가 같은 노드를 공유). 어댑터 종류 분기는 `meta.source` 단일 식별자로 통일 — Trigger `0-common.md:53-62` 표가 명문화.
   - 다른 진입점 패턴 (예: Webhook 노드가 별도로 존재한다면) 없음 — Trigger 단일 노드 + 3 어댑터 모델은 spec §1 ("동일한 파라미터 스키마, 차이는 값의 수집 방식뿐") 의 의도된 설계.
   - Workflow 의 `port: undefined` (sync 정상) 와 Manual Trigger 의 `port: undefined` (단일 출력) 는 둘 다 Principle 5 의 "단일 출력 노드" 패턴 — 일관.

8. **구현 품질**:
   - dead code 없음.
   - `TRIGGER_SOURCE_INPUT_KEY = '__triggerSource'` 상수 (`:23`) 가 export 되어 어댑터 측이 import 가능 — SSOT 의도. 하지만 handler 내부 `detectTriggerSource` (`:41-59`) 는 string literal `'__triggerSource'` 또는 union type 으로 비교 — 상수와 약간 분리. impl 미세 점검: handler 내부도 상수 import 사용 권장.
   - `TRANSPORT_KEYS` (`:35`) 의 `as const` 정의로 type-safe 화이트리스트 유지. webhook 검출 fallback 로직과 결합.
   - `detectTriggerSource` 3 단계 fallback (marker → transport-shape → manual default) 가 어댑터가 marker 누락해도 의미 있는 동작 보장 — 방어적 설계.

## 종합 개선안 (2026-05-16)

- [ ] (impl) `manual-trigger.handler.ts:41-59` 의 `detectTriggerSource` 가 internal string literal `'__triggerSource'` 비교 (`:45`) 대신 `TRIGGER_SOURCE_INPUT_KEY` 상수 import 사용. 근거: 같은 파일 내 export 상수 (`:23`) 가 이미 정의되어 있고, 어댑터/핸들러 분기점에서 단일 진입점 유지가 안전.
- [ ] (spec) §3 의 `input` shape 설명 (`spec/4-nodes/7-trigger/1-manual-trigger.md:55`) 에서 "input.parameters 만 객체, 그 외 fallback `{}`" 라는 Principle 10 fallback 동작을 명시적으로 인용 — 현재 §4-2 ("`input.parameters` 가 객체이면 그대로 채택, 아니면 `{}` 로 fallback") 가 §4 안에만 있어 §3 input 표만 보면 누락. 근거: handler `:114-120` 동작.
- [ ] (spec) `spec/4-nodes/7-trigger/0-common.md:60` 의 `meta` 카테고리 행에 "meta.source 는 실행 컨텍스트 식별자로 Principle 2 의 변형" 한 줄 추가 — 다른 노드의 `meta` 가 모두 실행 메트릭(durationMs/tokens 등) 인 점과 비교해 의미 분리. 근거: Manual Trigger 만 `meta` 에 카테고리 식별자를 두는 유일한 노드.
- [ ] (impl/test) `manual-trigger.handler.spec.ts` 에 `meta.source` enum 모든 3종 (manual/webhook/schedule) + 마커 없이 transport-shape fallback 의 4 케이스를 정리한 parameterized describe 추가 검토 — 현재 개별 it 로 분산되어 있음. 근거: 횡단 가독성 (저우선).
- [ ] (frontend) 노드 spec §5 의 expression 접근 예 (`$node["Manual Trigger"].output.parameters.orderId` / `$params.orderId` / `$input.parameters.orderId`) 가 frontend expression autocomplete 에 모두 등록되어 있는지 확인. 특히 `$params` shortcut 의 동작 범위(다운스트림 첫 노드 한정) 가 UI hint 로 노출되는지 점검. 근거: spec §5 footnote, expression-language §5-system 참조 필요.
