# Spec: ForEach

> 관련 문서: [Logic 공통 규약](./0-common.md) · [Spec 노드 개요](../0-overview.md) · [Map 노드](./7-map.md) · [Spec 실행 엔진](../../5-system/4-execution-engine.md) · [Spec 표현식 언어](../../5-system/5-expression-language.md) · [CONVENTIONS](../../conventions/node-output.md)

배열의 각 항목에 대해 body 서브그래프를 순차 실행하고, 각 반복의 `emit` 포트 출력을 수집해 배열로 내보내는 **컨테이너 노드** (`executionMetadata.kind = 'container'`). 컨테이너 패턴은 [공통 §3](./0-common.md#3-컨테이너-노드-패턴-loop--map--foreach) 참조.

핸들러는 시작 시점에 해석된 배열을 `output: items[]` 로 반환하고, 엔진이 각 item 을 body iteration 입력으로 분배한다. 반복 완료 후 엔진이 `{ items: [...], count: N }` 으로 `output` 을 오버라이트한다 (CONVENTIONS Principle 9, [공통 §9.1](./0-common.md#91-컨테이너-노드-핸들러--엔진-오버라이트-컨트랙트)).

---

## 1. 설정 (config)

| 필드 | 타입 | 필수 | 기본값 | 설명 |
|------|------|------|--------|------|
| arrayField | Expression | ✓ | `''` | 대상 배열 필드 경로. **dot-path 문자열**(`"items"`)이면 `$input` 에 적용, **inline 표현식**(`{{ $var.a }}`)이면 resolver 가 치환한 값을 직접 사용 |
| errorPolicy | `stop` / `skip` / `continue` | | `stop` | 에러 정책. [공통 §4](./0-common.md#4-에러-정책-errorpolicy) |

> Source of truth: `backend/src/nodes/logic/foreach/foreach.schema.ts` (export `foreachNodeConfigSchema`)

빈/null 입력 fallback: `arrayField` 해석 결과가 배열이 아니면 `[]` 로 처리 (CONVENTIONS Principle 10).

## 2. 설정 UI

```
┌──────────────────────────────────────┐
│  Array Field                         │
│  ┌────────────────────────────────┐  │
│  │ {{ $input.items }}             │  │
│  └────────────────────────────────┘  │
│  Dot-path or inline expression       │
│  returning an array                  │
│                                      │
│  Error Policy        [stop      ▼]   │
└──────────────────────────────────────┘
```

## 3. 포트

### 3.1 입력 포트

| id | label | type | dynamic | 설명 |
|------|-------|------|---------|------|
| `in` | Input | data | false | 외부 데이터 진입 |
| `emit` | Emit | data | false | body 서브그래프에서 수집 지점 (반드시 정확히 1개의 body 노드 연결) |

### 3.2 출력 포트

| id | label | type | dynamic | 설명 |
|------|-------|------|---------|------|
| `body` | Body | data | false | 각 항목 처리 본문 진입 — `$item` / `$itemIndex` 바인딩 |
| `done` | Done | data | false | 반복 완료 후 `{ items, count }` 전달 |

> ForEach 는 동적 포트가 없다.

### 3.3 실행 컨텍스트 변수 (body 내부)

- `$item`: 현재 배열 항목
- `$itemIndex`: 현재 인덱스 (0부터)
- `$item.isFirst`, `$item.isLast`: 첫/마지막 항목 여부 (itemContext 기반)

## 4. 실행 로직

1. `arrayField` 로 배열 추출 ([`resolveFieldValue`](../../../backend/src/nodes/core/nested-value.util.ts)). dot-path 문자열이면 `$input` 에 적용, inline 표현식이면 resolver 가 치환한 값을 직접 사용. 배열이 아니거나 경로 미존재 시 `[]` 로 fallback (Principle 10).
2. 핸들러는 §5.1 형태로 `output: items[]` 를 반환 → 엔진이 각 item 을 body iteration 입력으로 분배 (Principle 9.1).
3. 각 항목에 대해 엔진이:
   - `$item` / `$itemIndex` 를 바인딩하고 body 서브그래프를 토폴로지 순서로 실행.
   - `emit` 포트에 연결된 body 노드의 출력을 해당 iter 결과로 수집.
4. `errorPolicy` 에 따른 에러 처리 (원본 배열과 **동일 인덱스** 유지):
   - `stop`: 즉시 실행 실패.
   - `skip` / `continue`: 실패 인덱스의 `output.items[i]` 는 `null` placeholder 로 채워 인덱스를 보존하고, 실패 정보는 `output.skipped: [{ index, error: { code, message } }]` 로 분리한다 (§5.3). `meta.skippedCount` 에는 분리된 항목 수가 담긴다.
5. 전체 완료 후 엔진이 `output` 을 `{ items: [...], count: N, skipped?: [...] }` 으로 **오버라이트** (Principle 9.2) → `done` 포트로 전달.

> 결과 배열 인덱스 유지 및 중첩 컨테이너 스코프: [실행 엔진 §3.2](../../5-system/4-execution-engine.md#32-foreach--map-실행) 및 [§3.4](../../5-system/4-execution-engine.md#34-중첩-컨테이너-스코프) 참조.

## 5. 출력 구조

> CONVENTIONS Principle 11 포맷. JSON 예시는 `undefined` 필드 생략, 5필드 (`config`/`output`/`meta?`/`port?`/`status?`) 외 top-level 키 금지.
>
> ForEach 는 컨테이너 노드이므로 §5.1 (시작 — body 진입) / §5.2 (완료 — `done` 포트) 두 시점으로 분리하고, §5.7 에 엔진 오버라이트 컨트랙트를 명시한다.

### 5.1 Case: 시작 — 핸들러 반환 (body 진입 직전)

```json
{
  "config": { "arrayField": "{{ $input.items }}" },
  "output": [
    { "id": "a", "name": "Alice" },
    { "id": "b", "name": "Bob" }
  ]
}
```

| 필드 | 타입 | 출처 | 설명 |
|------|------|------|------|
| `config.arrayField` | Expression (raw) | config echo (Principle 7) | 사용자가 입력한 raw 경로/표현식 — `{{ }}` 보존 |
| `output` | unknown[] | handler return | 해석된 배열. 엔진이 각 item 을 body iteration 입력으로 분배 — 외부에서 직접 관찰되지 않는 중간 형태 (Principle 9.1) |

> 시작 시점의 `output` 은 §5.7 의 엔진 오버라이트 직전 단계로, 다운스트림 expression(`$node["X"].output.*`)에 노출되는 값은 §5.2 의 형태다.

> **D2 결정 (2026-05-17)**: §5.1 의 `output: items[]` 는 **엔진-내부 전용 중간 표현**으로, 외부 expression / run history / webhook payload 어디에도 노출되지 않는다 ([common §9.1](./0-common.md#91-컨테이너-노드-핸들러--엔진-오버라이트-컨트랙트)). 핸들러 시그니처가 배열을 반환하는 것은 5필드 invariant 를 깨지 않고 엔진에 분배 데이터를 넘기기 위한 컨트랙트이며, 다운스트림은 §5.2 의 envelope 만 본다. 따라서 `null` 반환 + 별도 internal 채널 도입(B안)은 채택하지 않는다 — 동작 동등성 대비 invariant 변경 비용이 더 크다.

### 5.2 Case: 완료 — `done` 포트 (엔진 오버라이트 후)

```json
{
  "config": { "arrayField": "{{ $input.items }}", "errorPolicy": "stop" },
  "output": {
    "items": [
      { "userId": "a", "ok": true },
      { "userId": "b", "ok": true }
    ],
    "count": 2
  },
  "meta": {
    "durationMs": 320,
    "iterations": 2
  },
  "port": "done"
}
```

| 필드 | 타입 | 출처 | 설명 |
|------|------|------|------|
| `config.arrayField` | Expression (raw) | config echo | 사용자 입력 raw — `{{ }}` 보존 |
| `config.errorPolicy` | `'stop'` / `'skip'` / `'continue'` | config echo | 기본 `stop` |
| `output.items` | unknown[] | engine override (Principle 9.2) | 각 iteration 의 `emit` 포트 출력 배열. errorPolicy=`skip`/`continue` 시 실패 인덱스는 `null` placeholder (§5.3) |
| `output.count` | number | engine override | 반복 실행된 항목 수 (= 입력 배열 길이, 인덱스 유지) |
| `output.skipped` | `Array<{index, error}>` | engine override | errorPolicy=`skip`/`continue` 로 분리된 실패 항목. 실패가 0건이면 필드 자체가 생략된다 (§5.3) |
| `meta.skippedCount` | number | engine inject | `output.skipped.length`. 실패가 0건이면 필드 자체가 생략된다 |
| `meta.durationMs` | number | engine inject | 컨테이너 전체 실행 시간 (ms) |
| `meta.iterations` | number | engine inject | body 실행 횟수 (Container 메트릭, Principle 2) |
| `port` | `'done'` | engine | 반복 완료 분기 |

**Expression 접근 예**:
- `$node["ForEach"].output.items[0]` → 첫 번째 iter 의 emit 출력
- `$node["ForEach"].output.count` → 처리된 항목 수 (O(1))
- `$node["ForEach"].port` → `"done"`

### 5.3 Case 변형: `errorPolicy = 'skip' | 'continue'` 시 결과 분리

errorPolicy 가 `skip` 또는 `continue` 인 경우 실패한 iteration 은 다음 두 곳으로 분리된다:

- `output.items[i]` 는 **`null` placeholder** — 입력 배열의 인덱스를 보존하기 위한 자리.
- `output.skipped: [{ index, error: { code, message } }]` — 실패한 iteration 의 인덱스와 에러 정보 (성공-실패가 한 배열에 섞이지 않도록 분리).
- `meta.skippedCount: number` — `output.skipped.length` 미러. 다운스트림이 배열 walk 없이 분기/메트릭에 사용.

```json
{
  "config": { "arrayField": "{{ $input.items }}", "errorPolicy": "skip" },
  "output": {
    "items": [
      { "userId": "a", "ok": true },
      null,
      { "userId": "c", "ok": true }
    ],
    "count": 3,
    "skipped": [
      { "index": 1, "error": { "code": "VALIDATION_FAILED", "message": "..." } }
    ]
  },
  "meta": {
    "durationMs": 410,
    "iterations": 3,
    "skippedCount": 1
  },
  "port": "done"
}
```

실패가 0건이면 `output.skipped` 와 `meta.skippedCount` 둘 다 **필드 자체가 생략**된다 (5필드 invariant — `undefined` 필드 echo 금지). 다운스트림은 `output.items.filter(x => x !== null)` 로 성공만 추리거나, `output.skipped` 가 존재할 때만 실패 처리 분기로 진입하면 된다.

> 인덱스 보존 정책 / 중첩 컨테이너 스코프: [공통 §4](./0-common.md#4-에러-정책-errorpolicy) · [실행 엔진 §3.2](../../5-system/4-execution-engine.md#32-foreach--map-실행) 참조. 본 분리 형태는 아카이브 개선안 ([logic/foreach.md §3](../../../plan/complete/archive/from-user-memo/node-specs-improvement/logic/foreach.md#3-제안된-output-구조)) 의 P0 채택안이며, 호환성 무시 (D) 마이그레이션으로 적용되었다 — 기존의 인라인 `{ _skipped: true, error }` 마커는 **삭제**된다.

> **D3 결정 (2026-05-17) — Map 과의 의도된 분기**: Map 은 실패 항목을 `output.mapped[i] = { _skipped: true, error }` 인라인 마커로 유지한다 ([7-map.md §5.2](./7-map.md#52-case-완료-시점--변환-배열-수집-port-done)). 두 노드의 차이는 **시멘틱 차이**에서 의도된 것:
> - **ForEach** = "**독립 항목 반복**" 계약. 각 iteration 이 독립이므로 성공-실패가 한 배열에 섞이지 않는 편이 의미가 명확하다 → `items[]` 는 성공+null, `skipped[]` 는 실패만 분리.
> - **Map** = "**동일 타입 변환 배열**" 계약. 다운스트림이 `mapped.map(...)` 처럼 배열 전체를 한 번에 다루므로 실패 항목을 같은 배열에 인라인으로 두는 편이 자연스럽다 → `_skipped` 플래그로 분기.
>
> 따라서 D3 는 통일하지 않고 현 정책을 유지한다 (plan/in-progress/node-output-redesign D3).

### 5.7 Case: 엔진 오버라이트 컨트랙트 (Principle 9)

ForEach 의 노드 envelope 는 시점에 따라 두 가지 다른 `output` 을 갖는다 ([공통 §9.1](./0-common.md#91-컨테이너-노드-핸들러--엔진-오버라이트-컨트랙트)):

| 시점 | output 형태 | 출처 |
|------|-------------|------|
| 시작 (body 진입 직전) | `output: items[]` (해석된 원본 배열) | handler return — body iteration 분배용 |
| 완료 (모든 iter 종료 후) | `output: { items: [...], count: N, skipped?: [...] }` | **엔진 오버라이트** (핸들러 재호출 없음) |

**컨트랙트 핵심**:
- 다운스트림 노드가 `$node["ForEach"].output.*` 로 관찰하는 값은 **항상 §5.2 의 완료 형태**.
- 핸들러가 시작 시점에 반환한 `output: items[]` 는 외부 expression 으로 노출되지 않는다 (엔진이 덮어쓰기 전 중간 단계). **D2 결정 (2026-05-17)** 으로 이 동작은 그대로 유지 — `null` 반환 + internal 채널(B안)은 invariant 변경 비용이 효익을 초과해 기각.
- 핸들러는 단 한 번만 실행되며, 완료 시점 오버라이트는 엔진이 핸들러 호출 없이 직접 수행한다.

## 6. 에러 코드

ForEach 는 **runtime 에러 포트를 갖지 않는다**. 컨테이너 구조 검증 실패는 pre-flight 단계에서 throw 되고, body iteration 중 발생하는 에러는 `errorPolicy` 로 처리된다 (CONVENTIONS Principle 3.1).

| 발생 조건 | 메시지 / 코드 | 시점 |
|-----------|--------------|------|
| `arrayField` 가 빈 문자열 또는 누락 | `배열 필드를 입력해야 합니다.` | warningRule (캔버스 배지) + handler.validate |
| `errorPolicy` 가 enum 외 값 | `errorPolicy must be one of: stop, skip, continue` | handler.validate |
| `emit` 포트에 body 노드 연결 누락 | `CONTAINER_MISSING_EMIT` | 엔진 graph 검증 ([공통 §3](./0-common.md#3-컨테이너-노드-패턴-loop--map--foreach)) |
| `emit` 포트에 body 노드가 2개 이상 연결 | `CONTAINER_MULTIPLE_EMIT` | 엔진 graph 검증 |
| body 내부에 back-edge / blocking 노드 (form / buttons / ai_conversation) | (graph 검증 에러) | 엔진 graph 검증 |
| body iteration 중 에러 발생 (errorPolicy=`stop`) | 즉시 실행 실패 (throw) | 엔진 runtime |
| body iteration 중 에러 발생 (errorPolicy=`skip` / `continue`) | `output.items[i] = null` + `output.skipped[]` 에 `{ index, error: { code, message } }` 추가 + `meta.skippedCount` 증가 | 엔진 runtime (§5.3) |

## 7. 캔버스 요약

[공통 §8](./0-common.md#8-캔버스-요약) — `ForEach` 행 인용.
