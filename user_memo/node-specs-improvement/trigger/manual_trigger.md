# Manual Trigger (`manual_trigger`) — Output 일관성 개선안

- **카테고리**: trigger
- **현 문서**: [../../../user_memo/node-specs/trigger/manual_trigger.md](../../node-specs/trigger/manual_trigger.md)
- **전역 규칙**: [../CONVENTIONS.md](../CONVENTIONS.md)

## 1. 현재 Output 구조 요약

핸들러는 트리거 어댑터가 이미 해석한 입력을 받아 `parameters`만 떼어 `output.parameters`로 노출하고, 나머지 상위 키는 그대로 평탄 병합합니다. `meta`, `port`, `status`는 설정하지 않으며 기본 포트 `out`으로 흐릅니다.

```json
{
  "config": {
    "parameters": [
      { "name": "orderId", "type": "string" }
    ]
  },
  "output": {
    "parameters": { "orderId": "abc" },
    "body":    { "raw": true },
    "headers": { "x-source": "github" },
    "query":   { "q": "1" },
    "method":  "POST"
  }
}
```

주요 특징:
- `output.parameters`는 항상 객체로 보장됨 (비객체/배열 input은 `{}`로 치환).
- `parameters` 이외의 키(`body`, `headers`, `query`, `method` 등)는 **어댑터 종류에 따라 존재 여부가 달라지며**, `output` 루트에 그대로 spread 병합됨.
- 핸들러는 에러 경로 없음 (try/catch 없음, `port: 'error'` 미지원).
- `meta`/`status` 는 사용하지 않음.

## 2. 식별된 불일치

| # | 항목 | 위반한 Principle | 설명 |
| --- | --- | --- | --- |
| 1 | `output` 루트에 `body`/`headers`/`query`/`method` 평탄 병합 | P1 — `output`은 "비즈니스 결과물"만 | `parameters`(사용자 설정 도메인 값)와 transport-layer 메타(`method`, `headers`)가 같은 depth에 섞여 있음. 후속 노드 표현식에서 "이 키가 파라미터인지 HTTP 헤더인지" 구분 불가. |
| 2 | `output.<나머지 키>` 의 존재 여부가 어댑터 구현에 암묵적으로 의존 | P1 / P11 — 예측 가능성 | 수동 실행 어댑터는 `parameters`만, webhook 어댑터는 `body`/`headers`/... 를 주는 식으로 같은 노드 타입이 실행 경로에 따라 다른 shape을 냄. 문서도 "실제 흐름에서 한 번 확인하세요"로 귀결. |
| 3 | webhook 메타(`method`, `headers`)가 루트에 섞여 있어 `parameters`와 이름 충돌 가능성 존재 | P1 | 사용자가 `parameters`에 `headers`라는 키를 정의하면 `output.headers`가 파라미터인지 transport 헤더인지 모호. 현 구현상 `parameters`가 먼저 떼어져 보호되지만 이는 코드 순서에 의존한 암묵적 규칙. |

> `meta`/`status` 미사용은 P0/P2 위반이 아닙니다. 트리거 핸들러는 외부 호출을 하지 않으므로 `meta.durationMs`가 의미 있는 값이 되기 어렵고, 블로킹이 아니므로 `status`도 불필요합니다.

## 3. 제안된 Output 구조

### Before

```json
{
  "config": {
    "parameters": [
      { "name": "orderId", "type": "string" }
    ]
  },
  "output": {
    "parameters": { "orderId": "abc" },
    "body":    { "raw": true },
    "headers": { "x-source": "github" },
    "query":   { "q": "1" },
    "method":  "POST"
  }
}
```

### After

```json
{
  "config": {
    "parameters": [
      { "name": "orderId", "type": "string" }
    ]
  },
  "output": {
    "parameters": { "orderId": "abc" },
    "request": {
      "method":  "POST",
      "headers": { "x-source": "github" },
      "query":   { "q": "1" },
      "body":    { "raw": true }
    }
  },
  "meta": {
    "source": "webhook"
  }
}
```

**핵심 변경점**:
- `output.parameters`는 그대로 유지 — 사용자가 정의한 도메인 값은 여전히 최상위.
- `body`/`headers`/`query`/`method` 를 **`output.request` 아래로 묶어** transport-layer 컨텍스트임을 명시. 수동 실행처럼 request 컨텍스트가 없는 어댑터에서는 `request` 자체를 생략 (`undefined`).
- 어댑터 출처를 구분하기 위해 `meta.source: 'manual' | 'webhook' | 'schedule'` 를 추가 (디버깅/분기 판단용). 도메인 로직이 아니므로 `output`이 아닌 `meta`에 배치 (P1/P2).
- `parameters`와 사용자 정의 파라미터 이름(`headers` 등)의 충돌 여지가 제거됨.

### Case별 최종 shape

#### Case 1: 수동 실행 (request 컨텍스트 없음)

```json
{
  "config": { "parameters": [{ "name": "name", "type": "string" }] },
  "output": {
    "parameters": { "name": "Alice", "count": 3 }
  },
  "meta": { "source": "manual" }
}
```

#### Case 2: Webhook 실행

```json
{
  "config": { "parameters": [{ "name": "orderId", "type": "string" }] },
  "output": {
    "parameters": { "orderId": "abc" },
    "request": {
      "method":  "POST",
      "headers": { "x-source": "github" },
      "query":   { "q": "1" },
      "body":    { "raw": true }
    }
  },
  "meta": { "source": "webhook" }
}
```

#### Case 3: 빈/비객체 input

```json
{
  "config": { "parameters": [] },
  "output": { "parameters": {} },
  "meta": { "source": "manual" }
}
```

## 4. 마이그레이션 영향도

| Expression 경로 (Before) | Expression 경로 (After) | Breaking? | 비고 |
| --- | --- | --- | --- |
| `$node["Manual Trigger"].output.parameters.userId` | `$node["Manual Trigger"].output.parameters.userId` | No | 변경 없음 (핵심 경로) |
| `$node["Manual Trigger"].output.parameters` | `$node["Manual Trigger"].output.parameters` | No | 동일 |
| `$node["Manual Trigger"].output.body` | `$node["Manual Trigger"].output.request.body` | **Yes** | webhook 사용 워크플로우 영향 |
| `$node["Manual Trigger"].output.headers` | `$node["Manual Trigger"].output.request.headers` | **Yes** | 동상 |
| `$node["Manual Trigger"].output.query` | `$node["Manual Trigger"].output.request.query` | **Yes** | 동상 |
| `$node["Manual Trigger"].output.method` | `$node["Manual Trigger"].output.request.method` | **Yes** | 동상 |
| `$input.parameters.userId` | `$input.parameters.userId` | No | 단축 표현 유지 |
| `$params.userId` | `$params.userId` | No | 단축 표현 유지 |
| (신규) | `$node["Manual Trigger"].meta.source` | No (신규) | `"manual"` / `"webhook"` / `"schedule"` |

**권장 전략**:
- Breaking 범위는 **webhook 어댑터를 사용 중인 워크플로우로 한정**됨 (수동 실행만 쓰는 다수 워크플로우는 무영향).
- 1단계 — **Alias shim**: 핸들러에서 `output.request` 를 주(primary)로 배치하되, 구버전 호환을 위해 한 릴리즈 주기 동안 `output.body`/`headers`/`query`/`method` 를 같이 노출 (deprecation 로그 남김).
- 2단계 — 다음 major release에서 flat 키 제거.
- 프런트엔드 expression 자동완성은 이미 PR(fd3dc27)에서 노드별 변수 힌팅을 개선했으므로, 개선안 적용 시 자동완성 목록을 `output.request.*` 로 갱신하면 사용자가 자연스럽게 새 경로로 이동.

## 5. 근거

- **사용자 멘탈 모델**: "내가 정의한 파라미터" 와 "webhook이 실어 준 HTTP 컨텍스트" 는 개념적으로 다른 레이어입니다. 현재는 한 평면에 섞여 있어 `output.*` 자동완성을 볼 때 어떤 것이 내가 설정한 값인지 즉시 알기 어렵습니다. `parameters` vs `request` 로 분리하면 카테고리가 명확해집니다.
- **다른 노드와의 통일성**: `http_request` 노드는 이미 `output.response` 아래에 transport 응답을 모읍니다 (CONVENTIONS P8 표). 트리거도 "들어오는 transport" 를 `output.request` 아래에 모으면 **response ↔ request 대칭**이 성립하여 학습 비용이 줄어듭니다.
- **디버깅 용이성**: `meta.source` 를 통해 "이 실행은 수동 테스트인가, 실제 webhook인가" 를 도메인 데이터와 섞지 않고 표현할 수 있습니다. 이는 P2(실행 메트릭/컨텍스트는 meta)와 정합적입니다.
- **키 충돌 방지**: 사용자가 `parameters` 스키마에서 `headers`/`body`/`method` 같은 이름을 정의해도 transport 키와 겹치지 않으므로, 파라미터 네이밍에 추가 제약을 둘 필요가 없어집니다.
- **최소 변경 원칙**: 가장 자주 쓰이는 `output.parameters.*` 경로는 **전혀 건드리지 않았으며**, 실제 breaking은 webhook 전용 4개 키에 한정됩니다. Alias shim 1릴리즈만 거치면 체감 마찰이 매우 작습니다.
