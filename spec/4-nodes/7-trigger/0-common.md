---
id: common
status: spec-only
code: []
---

# Spec: Trigger 노드 공통 규약

> 관련 문서: [PRD 노드 시스템](../_product-overview.md#3-trigger-노드-1종) · [Spec 노드 개요](../0-overview.md) · [Spec 노드 공통](../../3-workflow-editor/1-node-common.md) · [Spec 실행 엔진](../../5-system/4-execution-engine.md)

본 문서는 Trigger 카테고리 노드 전체에 공통되는 규약을 정의한다. 노드별 동작·설정은 각 노드 문서를 참조한다.

- [Manual Trigger](./1-manual-trigger.md)
- Webhook 트리거의 chat channel adapter provider catalog → [`providers/_overview.md`](./providers/_overview.md) (외부 chat 플랫폼 어댑터 — Telegram 등). 트리거 노드 자체가 아니라 Webhook 트리거의 `config.chatChannel` 갈래로 동작 — [Spec Chat Channel](../../5-system/15-chat-channel.md) 참조

---

## 1. 트리거 진입 파라미터 공통 계약

Manual, Webhook, Schedule 세 가지 트리거는 모두 **동일한 파라미터 스키마**(Manual Trigger 노드의 `config.parameters`)를 단일 소스로 사용한다. 차이는 값의 **수집 방식**뿐이다.

| 트리거 | 값 수집 방식 | 실행 실패 시점 |
|--------|--------------|---------------|
| Manual | Run 대화상자 폼 또는 `POST /workflows/:id/execute { parameterValues }` | Execution 생성 전 400 응답 또는 RUNNING 진입 즉시 실패 |
| Webhook | HTTP POST `body`에서 **동일 이름 최상위 키** 추출 | HooksService가 `400 Bad Request`로 요청 거부 (Execution 생성되지 않음) |
| Schedule | `schedule.parameterValues` 저장값 → 제한 표현식 컨텍스트(`$now`, `$schedule`)로 resolve | 스케줄 등록/수정 시 DTO 검증, 런타임은 default 채움 |

최종적으로 워크플로우 실행 엔진에는 항상 `{ parameters: Record<string, unknown>, ... }` 형태의 input이 전달된다. 어댑터는 추가로 `__triggerSource: 'manual' | 'webhook' | 'schedule'` 마커를 동봉하여 핸들러가 `meta.source` 를 결정론적으로 채울 수 있게 한다 (마커는 핸들러가 output 노출 전 제거 — `$input.__triggerSource` 로 새지 않음).

- Webhook: `$input = { parameters, body, headers, query, method }` → 핸들러는 `output.request: { method, headers, query, body }` 로 묶어 노출
- Schedule/Manual: `$input = { parameters }` → 핸들러는 `output.request` 를 생성하지 않음
- 축약형: `$params === $input.parameters`

### TriggerParameterDefinition 스키마

```typescript
interface TriggerParameterDefinition {
  name: string;                                         // 고유 식별자 (영문/숫자/_)
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  required?: boolean;                                   // 기본 false
  defaultValue?: unknown;                               // required=false일 때만 의미 있음
  description?: string;                                 // UI 힌트
}
```

- `name`은 트리거 노드 내에서 유일해야 한다 (중복 시 validate 실패)
- 빈 배열 또는 미정의 시 파라미터 기능 비활성 (기존 동작과 호환)

---

## 2. 캔버스 요약

| 노드 | 요약 포맷 | 예시 |
|------|-----------|------|
| Manual Trigger | 파라미터 개수 | `Parameters: 2` 또는 `(none)` |

---

## 3. 5필드 공통 규약 (Trigger 카테고리)

Trigger 노드는 모두 [CONVENTIONS Principle 0](../../conventions/node-output.md) 의 5필드 invariant `{ config, output, meta?, port?, status? }` 를 따른다. 카테고리 특이 사용 패턴:

| 필드 | Trigger 카테고리에서의 사용 패턴 |
|------|----------------------------------|
| `config` | 사용자 입력 raw echo. Manual Trigger는 `config.parameters` 가 `TriggerParameterDefinition[]` 스키마 그대로 echo (값이 아닌 schema) |
| `output` | **수집된 파라미터 값**. Manual Trigger: `output: $params` (= `$input.parameters`). 즉 `config.parameters` 는 schema, `output` 은 evaluated 값 — 직교 (Principle 1.1) |
| `meta` | 실행 메트릭만. `meta.durationMs` (보통 0 — Trigger는 외부 호출 없음). **`meta.source: 'manual' \| 'webhook' \| 'schedule'`** (필수 — 어댑터가 stamp한 `__triggerSource` 마커를 핸들러가 받아 채움) |
| `port` | Trigger 노드는 단일 출력 → `undefined` 또는 `'out'` (메타데이터에 정의된 정적 포트) |
| `status` | Trigger는 비-블로킹 즉시 완료 → `undefined` |

### 3.1 입력 부재

Trigger 노드는 워크플로 진입점이므로 **입력 포트가 없다** (`inputs: []`). `execute(input, config, context)` 호출 시 `input` 은 항상 외부 진입 데이터 (Manual: `{ __triggerSource: 'manual', parameters }`, Webhook: `{ __triggerSource: 'webhook', parameters, body, headers, query, method }`, Schedule: `{ __triggerSource: 'schedule', parameters }`) 로 엔진이 주입. `__triggerSource` 는 엔진-내부 마커로 핸들러가 `meta.source` 결정 후 제거하므로 다운스트림 expression 에는 노출되지 않는다.

### 3.2 trigger 종류별 동일 컨트랙트

§1 의 표대로 Manual / Webhook / Schedule 세 트리거는 **`config.parameters` 스키마와 `output` evaluated 값이 동일 형태**다. 차이는 값 수집 방식과 검증 시점뿐. 따라서 다운스트림 노드는 트리거 종류에 의존하지 않고 `$node["X"].output.<paramName>` 또는 `$params.<paramName>` 로 동일하게 접근.

## 4. 출력 구조 색인

| 노드 | 정상 케이스 |
|------|-------------|
| [manual_trigger](./1-manual-trigger.md#5-출력-구조) | §5.1 |
