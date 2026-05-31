---
id: map
status: implemented
code:
  - codebase/backend/src/nodes/logic/map/map.*.ts
---

# Spec: Map

> 관련 문서: [Logic 공통 규약](./0-common.md) · [Spec 노드 개요](../0-overview.md) · [ForEach 노드](./9-foreach.md) · [Spec 실행 엔진](../../5-system/4-execution-engine.md) · [Spec 표현식 언어](../../5-system/5-expression-language.md) · [CONVENTIONS](../../conventions/node-output.md)

배열의 각 항목에 대해 body 서브그래프를 실행하고, 각 반복의 `emit` 포트 출력을 모아 새 배열을 생성하는 **컨테이너 노드** (`executionMetadata.kind = 'container'`). ForEach 와 동일한 실행 모델·executor (`ForEachExecutor`) 를 공유하지만 시맨틱은 "결과 수집 (transform)" 으로 특화되어 있다 — 컬렉션 키도 ForEach 의 `items` 와 달리 **`mapped`** 를 사용한다 ([공통 §5](./0-common.md#5-반복분기-출력-구조-conventions-92)). 컨테이너 패턴 일반은 [공통 §3](./0-common.md#3-컨테이너-노드-패턴-loop--map--foreach) 참조.

---

## 1. 설정 (config)

| 필드 | 타입 | 필수 | 기본값 | 설명 |
|------|------|------|--------|------|
| inputField | Expression | ✓ | `''` | 변환 대상 배열 필드. **dot-path 문자열** (`"items"`) 이면 `$input` 에 적용, **inline 표현식** (`{{ $var.a }}`) 이면 resolver 가 치환한 값을 직접 사용 |
| errorPolicy | `stop` / `skip` / `continue` | | `stop` | 반복 중 에러 정책. [공통 §4](./0-common.md#4-에러-정책-errorpolicy) |

> Source of truth: `codebase/backend/src/nodes/logic/map/map.schema.ts` (export `mapNodeConfigSchema`)

## 2. 설정 UI

```
┌──────────────────────────────────────┐
│  Input Field                         │
│  ┌──────────────────────────────────┐│
│  │ $input.items                     ││
│  └──────────────────────────────────┘│
│  Dot-path or inline expression       │
│  returning an array                  │
│                                      │
│  Error Policy  [ stop ▼ ]            │
│  (stop / skip / continue)            │
└──────────────────────────────────────┘
```

## 3. 포트

### 3.1 입력 포트

| id | label | type | dynamic | 설명 |
|------|-------|------|---------|------|
| `in` | Input | data | false | 외부 데이터 진입 |
| `emit` | Emit | data | false | body 서브그래프의 수집 지점. **반드시 정확히 1 개** body 노드가 연결되어야 한다 ([공통 §3](./0-common.md#3-컨테이너-노드-패턴-loop--map--foreach)) |

### 3.2 출력 포트

| id | label | type | dynamic | 설명 |
|------|-------|------|---------|------|
| `body` | Body | data | false | 각 항목을 body 서브그래프 첫 노드로 전달 (반복마다 1 회) |
| `done` | Done | data | false | 모든 반복 완료 후 `{ mapped, count }` 형태로 다음 노드에 전달 |

> Map 은 동적 포트가 없다.

## 4. 실행 로직

1. **입력 해석**: `inputField` 를 `resolveFieldValue(input, inputField)` 로 풀어 배열을 추출한다. dot-path 문자열이면 `$input` 의 중첩 경로를, inline 표현식이면 resolver 가 이미 치환한 값을 그대로 받는다. 결과가 배열이 아니면 `[]` 로 fallback (CONVENTIONS Principle 10).
2. **시작 시점 (body 진입 직전)**: 핸들러가 `output: items` (해석된 배열) 를 반환한다 → 엔진의 `ForEachExecutor` 가 각 항목을 `body` 포트로 분배 (§5.1).
3. **반복 실행**: 각 항목마다 `$item` / `$itemIndex` 를 바인딩하고 body 서브그래프를 토폴로지 순서로 실행. `emit` 포트에 연결된 body 노드의 출력을 해당 iter 의 변환 결과로 수집.
4. **에러 정책**: `stop` 즉시 실패 / `skip` 해당 인덱스에 `{ _skipped: true, error }` / `continue` 에러 항목 포함. 원본 배열과 동일 인덱스 유지 ([실행 엔진 §3.2](../../5-system/4-execution-engine.md#32-foreach--map-실행)).
5. **완료 시점 (모든 iter 종료 후)**: 엔진이 노드 `output` 을 **`{ mapped: [...], count: N }`** 로 오버라이트하고 `done` 포트를 활성화 (CONVENTIONS Principle 9 / [공통 §9.1](./0-common.md#91-컨테이너-노드-핸들러--엔진-오버라이트-컨트랙트), §5.7).

## 5. 출력 구조

> CONVENTIONS Principle 11 포맷. JSON 예시는 `undefined` 필드 생략, 5필드 (`config`/`output`/`meta?`/`port?`/`status?`) 외 top-level 키 금지.
>
> Map 은 컨테이너 노드이므로 핸들러 시점 출력 (§5.1) 과 엔진 오버라이트 후 출력 (§5.2) 이 다르다. §5.7 은 엔진 오버라이트 컨트랙트를 명시한다 (CONVENTIONS Principle 9 · 컬렉션 키 = **`mapped`**, ForEach 의 `items` 와 다름).

### 5.1 Case: 시작 시점 — body 진입 직전 (port `body`)

핸들러가 해석된 배열을 `output` 으로 반환하면, 엔진이 각 항목을 body 서브그래프로 분배한다. 이 시점의 노드 envelope:

```json
{
  "config": {
    "inputField": "{{ $input.items }}",
    "errorPolicy": "stop"
  },
  "output": [
    { "id": 1, "name": "Alice" },
    { "id": 2, "name": "Bob" },
    { "id": 3, "name": "Carol" }
  ],
  "meta": {
    "durationMs": 0
  },
  "port": "body"
}
```

| 필드 | 타입 | 출처 | 설명 |
|------|------|------|------|
| `config.inputField` | Expression | config echo (Principle 7) | 사용자가 입력한 raw 표현식 — `{{ }}` 보존 |
| `config.errorPolicy` | `'stop'` / `'skip'` / `'continue'` | config echo | 에러 정책 (default `stop`) |
| `output` | unknown[] | runtime — handler return | 해석된 원본 배열 (각 항목이 body 로 분배됨). `inputField` 가 배열이 아니거나 미해석 시 `[]` |
| `meta.durationMs` | number | engine inject | 핸들러 tick 의 실행 시간 (ms) |
| `port` | `'body'` | engine | 각 항목을 body 서브그래프 첫 노드로 전달 |

> 이 시점의 `output` 은 **해석된 원본 배열** 이다. body iteration 입력 분배에만 쓰이며, 다운스트림에서 직접 참조해서는 안 된다 — 완료 후 §5.2 의 `{ mapped, count }` 구조로 덮어쓰여진다.

> **D2 결정**: §5.1 의 `output: items[]` 는 **엔진-내부 전용 중간 표현**으로, 외부 expression / run history / webhook payload 어디에도 노출되지 않는다 ([common §9.1](./0-common.md#91-컨테이너-노드-핸들러--엔진-오버라이트-컨트랙트)). 핸들러 시그니처가 배열을 반환하는 것은 5필드 invariant 를 깨지 않고 엔진에 분배 데이터를 넘기기 위한 컨트랙트이며, 다운스트림은 §5.2 의 envelope 만 본다. 따라서 `null` 반환 + 별도 internal 채널 도입(B안)은 채택하지 않는다 — 동작 동등성 대비 invariant 변경 비용이 더 크다.

**body 내부 expression 접근**:
- `$item` → 현재 항목 (예: `{ id: 1, name: "Alice" }`)
- `$itemIndex` → 현재 인덱스 (0-based)

### 5.2 Case: 완료 시점 — 변환 배열 수집 (port `done`)

모든 iter 완료 후 엔진이 노드 `output` 을 `{ mapped, count }` 로 오버라이트한다 (Principle 9, §5.7).

```json
{
  "config": {
    "inputField": "{{ $input.items }}",
    "errorPolicy": "stop"
  },
  "output": {
    "mapped": [
      { "id": 1, "label": "user-1: Alice" },
      { "id": 2, "label": "user-2: Bob" },
      { "id": 3, "label": "user-3: Carol" }
    ],
    "count": 3
  },
  "meta": {
    "durationMs": 187
  },
  "port": "done"
}
```

| 필드 | 타입 | 출처 | 설명 |
|------|------|------|------|
| `config.*` | (§5.1 과 동일) | config echo | |
| `output.mapped` | unknown[] | engine override (Principle 9) | 각 iter 의 `emit` 포트 출력을 모은 변환 결과 배열. ForEach 의 `items` 와 달리 **`mapped`** 키 사용 |
| `output.count` | number | engine override | 실행된 반복 수 (`mapped.length` 와 동치, O(1) 접근) |
| `meta.durationMs` | number | engine inject | 컨테이너 전체 실행 시간 (ms) |
| `port` | `'done'` | engine | 모든 iter 완료 후 다음 노드로 전달 |

**Expression 접근 예**:
- `$node["Map"].output.mapped` → 변환 결과 배열
- `$node["Map"].output.mapped[0].label` → `"user-1: Alice"`
- `$node["Map"].output.count` → 3

> **빈 배열 입력**: `inputField` 해석 결과가 `[]` 이거나 배열이 아닌 경우, body 가 0 회 실행되고 `output: { mapped: [], count: 0 }` 으로 `done` 포트가 즉시 활성화된다 (Principle 10).

> **`errorPolicy: 'skip' / 'continue'` 시 결과 형태**: 인덱스 보존을 위해 실패 항목은 `output.mapped[i] = { _skipped: true, error: { code, message } }` 형태로 삽입된다 ([공통 §4](./0-common.md#4-에러-정책-errorpolicy) · [실행 엔진 §3.2](../../5-system/4-execution-engine.md#32-foreach--map-실행)). Map 의 의도는 "동일 타입 변환 배열" 이므로 다운스트림은 `_skipped` 플래그로 정상/실패를 구분해야 한다.

> **D3 결정 — ForEach 와의 의도된 분기**: ForEach 는 `output.items[i] = null` placeholder + `output.skipped[]` 별도 배열로 실패를 분리한다 ([9-foreach.md §5.3](./9-foreach.md#53-case-변형-errorpolicy--skip--continue-시-결과-분리)). 두 노드의 차이는 **시멘틱 차이**에서 의도된 것:
> - **Map** = "**동일 타입 변환 배열**" 계약. 다운스트림은 `mapped.map(...)` 처럼 배열 전체를 한 번에 다루기 때문에, 실패 항목도 같은 배열에 인라인으로 두는 편이 자연스럽다. `_skipped` 플래그로 분기.
> - **ForEach** = "**독립 항목 반복**" 계약. 각 iteration 이 독립이므로 성공-실패가 한 배열에 섞이지 않는 편이 의미가 명확하다. `items[]` 는 성공+null 만, `skipped[]` 는 실패만.
>
> 따라서 D3 는 통일하지 않고 현 정책을 유지한다.

### 5.7 엔진 오버라이트 컨트랙트 (Principle 9)

| 시점 | 노드 `output` | 책임 |
|------|----------------|------|
| 핸들러 tick (시작) | `items[]` (해석된 원본 배열) | `MapHandler.execute` 가 반환 |
| body iteration 중 | (변경 없음 — `body` 포트는 각 항목을 분배만) | `ForEachExecutor` |
| 모든 iter 완료 (done) | `{ mapped: [...], count: N }` | **엔진이 오버라이트** |

- 핸들러는 시작 시점에 한 번만 실행되어 `output: items` (배열) 를 반환한다 (`map.handler.ts` 현 구현). 엔진의 `ForEachExecutor` 는 이 배열을 body 분배 입력으로 소비하고, 모든 iter 완료 후 핸들러 재호출 없이 `{ mapped, count }` 로 노드 envelope 의 `output` 을 덮어쓴다.
- 다운스트림 노드는 항상 §5.2 형태 (`output.mapped[i]` / `output.count`) 만 본다 — §5.1 의 raw 배열은 노출되지 않는다. **D2 결정** 으로 이 동작은 그대로 유지된다.
- 컬렉션 키는 ForEach 의 `items`, Loop 의 `iterations`, Parallel 의 `branches` 와 모두 다르다 ([공통 §5](./0-common.md#5-반복분기-출력-구조-conventions-92) · [§9.1](./0-common.md#91-컨테이너-노드-핸들러--엔진-오버라이트-컨트랙트)). **Map 의 컬렉션 키는 반드시 `mapped`**.

## 6. 에러 코드

Map 의 핸들러 자체는 **runtime 에러 포트를 갖지 않는다**. 모든 검증 실패는 pre-flight (config 검증) 단계에서 throw 되거나, 컨테이너 본문 에러는 `errorPolicy` 로 흡수된다 (CONVENTIONS Principle 3.1).

| 발생 조건 | 메시지 | 시점 |
|-----------|--------|------|
| `inputField` 미설정 / 빈 문자열 / `null` / `undefined` | `Input 필드를 입력해야 합니다.` | warningRule (캔버스 배지) + `handler.validate` |
| `errorPolicy` 가 `stop`/`skip`/`continue` 외 | `errorPolicy must be one of: stop, skip, continue` | `handler.validate` |
| `emit` 포트 미연결 | `CONTAINER_MISSING_EMIT` | 엔진 pre-flight ([공통 §3](./0-common.md#3-컨테이너-노드-패턴-loop--map--foreach)) |
| `emit` 포트에 2 개 이상 연결 | `CONTAINER_MULTIPLE_EMIT` | 엔진 pre-flight |
| body 내부 back-edge / blocking 노드 (form / buttons / ai_conversation) | 컨테이너 제약 위반 | 엔진 pre-flight |
| body iter 에러 + `errorPolicy: 'stop'` | iter 에러 메시지 그대로 전파 | runtime — 엔진 실패 마킹 |
| body iter 에러 + `errorPolicy: 'skip' / 'continue'` | `output.mapped[i]._skipped = true` 로 인라인 기록 | runtime — 노드는 정상 종료 |

> Map 자체에는 별도 `error` 출력 포트가 없다. body 내부 에러는 `errorPolicy` 로 흡수되거나 (`skip`/`continue`) 컨테이너 실패로 전파 (`stop`) 된다.

## 7. 캔버스 요약

[공통 §8](./0-common.md#8-캔버스-요약) — `Map` 행 인용. 캔버스 헤더는 실행 중 현재 인덱스를 표시한다 (예: `Item 2/5`).
