# Spec: ForEach

> 관련 문서: [Logic 공통 규약](./0-common.md) · [Spec 노드 개요](../0-overview.md) · [Map 노드](./7-map.md) · [Spec 실행 엔진](../../5-system/4-execution-engine.md) · [Spec 표현식 언어](../../5-system/5-expression-language.md) · [CONVENTIONS](../../../user_memo/node-specs-improvement/CONVENTIONS.md)

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
   - `skip`: 스킵된 인덱스에 `{ _skipped: true, error: { code, message } }` 삽입.
   - `continue`: 에러 발생 항목도 결과에 포함 (에러 정보는 NodeExecution 에 기록).
5. 전체 완료 후 엔진이 `output` 을 `{ items: [...], count: N }` 으로 **오버라이트** (Principle 9.2) → `done` 포트로 전달.

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
| `output.items` | unknown[] | engine override (Principle 9.2) | 각 iteration 의 `emit` 포트 출력 배열. errorPolicy=`skip`/`continue` 시 에러 항목 포함 (§5.3) |
| `output.count` | number | engine override | 반복 실행된 항목 수 (= 입력 배열 길이, 인덱스 유지) |
| `meta.durationMs` | number | engine inject | 컨테이너 전체 실행 시간 (ms) |
| `meta.iterations` | number | engine inject | body 실행 횟수 (Container 메트릭, Principle 2) |
| `port` | `'done'` | engine | 반복 완료 분기 |

**Expression 접근 예**:
- `$node["ForEach"].output.items[0]` → 첫 번째 iter 의 emit 출력
- `$node["ForEach"].output.count` → 처리된 항목 수 (O(1))
- `$node["ForEach"].port` → `"done"`

### 5.3 Case 변형: `errorPolicy = 'skip'` 시 인덱스 유지

errorPolicy 가 `skip` (또는 `continue`) 인 경우, 에러가 난 인덱스 자리에 `_skipped` 마커를 끼워 원본 배열의 인덱스가 보존된다 ([공통 §4](./0-common.md#4-에러-정책-errorpolicy)).

```json
{
  "config": { "arrayField": "{{ $input.items }}", "errorPolicy": "skip" },
  "output": {
    "items": [
      { "userId": "a", "ok": true },
      { "_skipped": true, "error": { "code": "VALIDATION_FAILED", "message": "..." } },
      { "userId": "c", "ok": true }
    ],
    "count": 3
  },
  "meta": { "durationMs": 410, "iterations": 3 },
  "port": "done"
}
```

> ⚠ **미구현 (P1)**: user_memo 개선안은 `output.items` 와 `output.skipped: [{ index, error }]` 분리 + `meta.skippedCount` 추가를 제안한다 ([logic/foreach.md §3](../../../user_memo/node-specs-improvement/logic/foreach.md#3-제안된-output-구조)). 현재 구현은 인덱스 유지를 위해 `_skipped` 항목을 `items` 배열에 섞어 보낸다 — 다운스트림은 `r._skipped` 로 필터링한다.

### 5.7 Case: 엔진 오버라이트 컨트랙트 (Principle 9)

ForEach 핸들러는 두 시점에 두 가지 다른 `output` 을 낸다 ([공통 §9.1](./0-common.md#91-컨테이너-노드-핸들러--엔진-오버라이트-컨트랙트)):

| 시점 | output 형태 | 출처 |
|------|-------------|------|
| 시작 (body 진입 직전) | `output: items[]` (해석된 원본 배열) | handler return — body iteration 분배용 |
| 완료 (모든 iter 종료 후) | `output: { items: [...], count: N }` | **엔진 오버라이트** |

**컨트랙트 핵심**:
- 다운스트림 노드가 `$node["ForEach"].output.*` 로 관찰하는 값은 **항상 §5.2 의 완료 형태**.
- 핸들러가 시작 시점에 반환한 `output: items[]` 는 외부 expression 으로 노출되지 않는다 (엔진이 덮어쓰기 전 중간 단계).
- 핸들러는 `null` 을 반환하지 않는다 — 시작 시점 배열이 body iteration 입력 분배에 필요하기 때문 ([공통 §9.1](./0-common.md#91-컨테이너-노드-핸들러--엔진-오버라이트-컨트랙트) 표 참조).

> ⚠ **미구현 (P1)**: 현재 핸들러는 `meta.durationMs` / `meta.iterations` 를 직접 채우지 않는다. `durationMs` 는 엔진이 모든 노드에 공통 주입하며, `iterations` 는 user_memo 개선안의 Container 메트릭 제안 ([logic/foreach.md §3](../../../user_memo/node-specs-improvement/logic/foreach.md#3-제안된-output-구조)).

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
| body iteration 중 에러 발생 (errorPolicy=`skip` / `continue`) | `output.items[i] = { _skipped: true, error: { code, message } }` | 엔진 runtime (§5.3) |

## 7. 캔버스 요약

[공통 §8](./0-common.md#8-캔버스-요약) — `ForEach` 행 인용.
