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
