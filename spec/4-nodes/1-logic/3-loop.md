---
id: loop
status: spec-only
code: []
---

# Spec: Loop

> 관련 문서: [Logic 공통 규약](./0-common.md) · [Spec 노드 개요](../0-overview.md) · [Spec 실행 엔진](../../5-system/4-execution-engine.md) · [Spec 표현식 언어](../../5-system/5-expression-language.md) · [CONVENTIONS](../../conventions/node-output.md)

지정된 횟수만큼 내부 노드 그룹(`body` 서브그래프)을 반복 실행하는 **컨테이너 노드**. 핸들러는 `output: null` 을 반환하고, 엔진이 모든 반복 종료 후 `{ iterations }` 로 `output` 을 오버라이트한다 (Logic 공통 §9.1, CONVENTIONS Principle 9). 컨테이너 공통 패턴은 [공통 §3](./0-common.md#3-컨테이너-노드-패턴-loop--map--foreach) 참조.

---

## 1. 설정 (config)

| 필드 | 타입 | 필수 | 기본값 | 설명 |
|------|------|------|--------|------|
| count | Expression \| Integer | ✓ | `'1'` | 반복 횟수. 정수 리터럴(`10`), 숫자 문자열(`"10"`), 또는 표현식(`{{ $input.count }}`) 허용. 표현식은 엔진 평가 시 정수로 해석되어야 한다. default `'1'` 은 "최소 반복 1회" 정책 — §8 Rationale 참조 |
| maxIterations | Integer | | `1000` | 최대 반복 제한 (안전 캡). [공통 §6](./0-common.md#6-리소스-제한). `count` 가 이 값을 초과하면 `MAX_ITERATIONS_EXCEEDED` throw |
| breakCondition | Expression? | | `undefined` | Boolean 표현식 (선택). 매 반복 종료 직후 평가되어 truthy 면 조기 종료 (§6 step 6, `meta.exitReason='break'`). `$loop.index`, `$var.*`, `$node[...].output` 등을 참조 가능. 평가 실패는 silent false (loop 진행 — `execution-engine.service.ts` 의 `buildLoopBreakConditionEvaluator` 가 `evaluate()` 호출을 try/catch 로 감쌈) |

> Source of truth: `codebase/backend/src/nodes/logic/loop/loop.schema.ts` (export `loopNodeConfigSchema`, `validateLoopConfig`)

## 2. 설정 UI

```
┌──────────────────────────────────────┐
│  Count                               │
│  ┌──────────────────────────────────┐│
│  │ 10                               ││  ← Integer 또는 {{ ... }}
│  └──────────────────────────────────┘│
│                                      │
│  Max Iterations                      │
│  ┌──────────────────────────────────┐│
│  │ 1000                             ││
│  └──────────────────────────────────┘│
│                                      │
│  Break Condition (optional)          │
│  ┌──────────────────────────────────┐│
│  │ {{ $loop.index >= 5 }}           ││
│  └──────────────────────────────────┘│
└──────────────────────────────────────┘
```

## 3. 포트

### 3.1 입력 포트

| id | label | type | dynamic | 설명 |
|------|-------|------|---------|------|
| `in` | Input | data | false | 외부에서 컨테이너로 진입하는 데이터. 첫 반복의 body 입력 시드로 사용되지 않음 (Loop 는 `count` 기반이며 input 분배 안 함) |
| `emit` | Emit | data | false | body 서브그래프의 수집 지점. **반드시 정확히 1개**의 body 노드가 연결되어야 한다 (CONTAINER_MISSING_EMIT / CONTAINER_MULTIPLE_EMIT, [공통 §3](./0-common.md#3-컨테이너-노드-패턴-loop--map--foreach)) |

### 3.2 출력 포트

| id | label | type | dynamic | 설명 |
|------|-------|------|---------|------|
| `body` | Body | data | false | 컨테이너 내부 body 진입점. 매 반복마다 첫 노드로 데이터 전달 (이전 반복 결과를 다음 반복 입력으로 — §4.5) |
| `done` | Done | data | false | 모든 반복 종료 후 수집된 결과 전달. 다운스트림은 §5.2 형태를 본다 |

> Loop 은 동적 포트를 갖지 않는다.

## 4. 실행 로직

1. **시작 시점 (핸들러 실행)**: `LoopHandler.execute` 가 `{ config: { count, maxIterations }, output: null }` 반환 (§5.1). 엔진은 `output: null` 을 보고 컨테이너 오버라이트 컨트랙트를 활성화한다 (Principle 9.1).
2. **count 평가**: 엔진이 `engineResolvedConfig.count` 를 정수로 강제 변환 (`coerceContainerNumber`). `count > maxIterations` 시 즉시 `MAX_ITERATIONS_EXCEEDED` throw (§6).
3. **반복 실행**: `LoopExecutor.execute` 가 0 ~ `count - 1` 인덱스로 body 서브그래프를 순차 실행. 매 반복마다 `context.loopContext = { index, count, isFirst, isLast }` 를 바인딩.
4. **emit 수집**: 각 반복에서 `emit` 포트에 연결된 body 노드의 출력을 `LoopIterationResult { index, output }` 으로 수집.
5. **반복 간 입력 전달**: i 번째 반복의 body 입력은 (i-1) 번째 반복의 emit 출력. 첫 반복(i=0)의 입력은 `undefined`.
6. **breakCondition 검사**: 매 반복 종료 후 (body 실행 직후) `engine` 이 `config.breakCondition` 표현식을 freshly built `expressionContext` (현재 `$loop.*`, `$var.*`, body 노드들의 최신 `$node[...].output` 반영) 와 함께 `evaluate()` 한다. truthy 면 즉시 조기 종료 + `meta.exitReason='break'`. 평가 에러는 silent false (loop 진행).
7. **maxIterations 가드**: 반복 인덱스 i 가 `maxIterations` 에 도달하면 `MAX_ITERATIONS_EXCEEDED` throw.
8. **완료 시점 (엔진 오버라이트)**: `collected.map(r => r.output)` 로 `iterations` 배열 생성 → 엔진이 `{ iterations }` 로 `output` 을 덮어쓴다 (§5.2, §5.7). 다운스트림은 `done` 포트로 라우팅. 반복 횟수가 필요하면 `output.iterations.length` 를 사용한다 (CONVENTIONS Principle 1.1 — config↔output 직교).

### 4.1 실행 컨텍스트 변수 (`$loop.*`)

body 내부에서 다음 변수에 접근 가능:

| 변수 | 타입 | 설명 |
|------|------|------|
| `$loop.index` | number | 현재 반복 인덱스 (0-based) |
| `$loop.iteration` | number | 1-based 반복 횟수 (= `index + 1`) |
| `$loop.count` | number | 총 반복 횟수 (= `config.count` 평가값) |
| `$loop.isFirst` | boolean | 첫 번째 반복 여부 (`index === 0`) |
| `$loop.isLast` | boolean | 마지막 반복 여부 (`index === count - 1`) |

> 중첩 Loop 시 `$loop` 은 가장 가까운 Loop 컨테이너의 컨텍스트를 가리킨다. 외부 Loop 의 컨텍스트는 [실행 엔진 §3.4 중첩 컨테이너 스코프](../../5-system/4-execution-engine.md#34-중첩-컨테이너-스코프) 참조.

## 5. 출력 구조

> CONVENTIONS Principle 11 포맷. JSON 예시는 `undefined` 필드 생략, 5필드 (`config` / `output` / `meta?` / `port?` / `status?`) 외 top-level 키 금지.
>
> Loop 은 컨테이너 노드이므로 핸들러 출력(§5.1)과 엔진 오버라이트 후 다운스트림이 보는 출력(§5.2)이 다르다. §5.7 에서 오버라이트 컨트랙트를 명시한다.

### 5.1 Case: 시작 시점 (핸들러 반환 — body 진입 직전)

```json
{
  "config": {
    "count": "10",
    "maxIterations": 1000
  },
  "output": null
}
```

| 필드 | 타입 | 출처 | 설명 |
|------|------|------|------|
| `config.count` | number \| string | config echo (Principle 7) | 사용자가 입력한 raw 값 — 표현식 `{{ }}` 보존, 숫자 문자열 그대로 |
| `config.maxIterations` | number | config echo | raw 값 또는 default `1000` |
| `output` | `null` | handler return | **엔진 오버라이트 시그널** (Principle 9.1). 엔진이 §5.2 로 덮어쓴다 |

> 핸들러는 `breakCondition` 을 echo 하지 않는다 — 컨테이너 실행 컨트랙트(§4)의 일부로 엔진이 직접 평가하며, 다운스트림이 raw 표현식을 받을 의미가 없다 (사용자가 `$node["Loop"].config` 로 표현식을 다시 평가할 일이 없다는 뜻).
>
> Loop 은 입력 분배가 없는 횟수 기반 컨테이너이므로 §5.1 시점에 body iteration 입력은 `undefined` (첫 반복) 또는 이전 반복의 emit 출력 (§4.5).

### 5.2 Case: 완료 시점 (`done` 포트 — 엔진 오버라이트 후)

```json
{
  "config": {
    "count": "10",
    "maxIterations": 1000
  },
  "output": {
    "iterations": [
      "body emit result 0",
      "body emit result 1",
      "body emit result 2"
    ]
  },
  "meta": {
    "iterations": 3,
    "maxIterationsReached": false,
    "exitReason": "completed"
  }
}
```

| 필드 | 타입 | 출처 | 설명 |
|------|------|------|------|
| `config.*` | (§5.1과 동일) | config echo | 핸들러가 반환한 raw config 가 보존됨 (엔진 오버라이트는 `output` 만 영향) |
| `output.iterations` | unknown[] | **engine override** (Principle 9.2) | 각 반복의 emit 노드 출력을 인덱스 순서로 수집한 배열. 길이 = 실제 실행된 반복 수 |
| `meta.iterations` | number | **engine inject** (Principle 2) | 실제 실행된 반복 수. 정상 완료 시 `config.count` 와 같지만 `breakCondition` 이 truthy 가 되어 조기 종료된 경우 작아진다. `output.iterations.length` 와 동일 값 — `output` 은 결과 배열, `meta` 는 메트릭 축으로 분리되어 있음 |
| `meta.maxIterationsReached` | boolean | engine inject (Principle 2) | `meta.exitReason === 'maxIterations'` 인 경우에만 `true`. 즉 break 없이 한도까지 정상 완료한 경우. 한도 초과 시점은 `MAX_ITERATIONS_EXCEEDED` throw 로 처리되므로 (§6) 이 플래그는 항상 "break 없는 정상 한도 완료" 만을 가리킨다 |
| `meta.exitReason` | `'completed' \| 'break' \| 'maxIterations'` | engine inject (Principle 2) | 종료 원인. `'break'` 는 `config.breakCondition` 이 truthy 평가되어 조기 종료된 경우, `'maxIterations'` 는 `config.count === config.maxIterations` 로 한도까지 정상 완료된 경우, 그 외는 `'completed'` |
| `meta.durationMs` | number | engine inject (CONVENTIONS Principle 2 공통) | 컨테이너 전체 소요 시간 (ms) |

> CONVENTIONS Principle 1.1 (config ↔ output 직교) 준수를 위해 `output.count` 는 **제공하지 않는다** — 정상 완료 시 `config.count` 와 동일하고, 조기 종료 시에는 `output.iterations.length` 가 사실상의 실행 횟수다. 다운스트림은 항상 `output.iterations.length` 또는 `meta.iterations` 를 사용한다.

**Expression 접근 예** (현재 엔진 동작 기준):
- `$node["Loop"].output.iterations[0]` → `"body emit result 0"`
- `$node["Loop"].output.iterations.length` → `3`
- `$node["Loop"].config.count` → `"10"` (raw, 사용자 설정값)

### 5.7 Case: 엔진 오버라이트 컨트랙트 (Principle 9)

핸들러 반환과 엔진 오버라이트 결과의 관계:

| 시점 | 주체 | `output` 내용 | 비고 |
|------|------|---------------|------|
| 시작 (§5.1) | `LoopHandler` | `null` | Principle 9.1 — 엔진에 오버라이트 의도 신호 |
| 반복 중 | `LoopExecutor` | (body 노드들이 자체 output 을 가짐) | `$node["Loop"].output` 는 아직 `null` — 다운스트림이 `done` 이후에만 의미 있는 값 본다 |
| 완료 (§5.2) | engine | `{ iterations: [...] }` | Principle 9.2 — 컨테이너 컬렉션 키 = `iterations`. 횟수는 `iterations.length` (Principle 1.1 직교) |

> 핸들러가 `output: null` 이외의 값을 반환하면 엔진은 오버라이트하지 않는다 (Principle 9.1). Loop 핸들러는 항상 `null` 을 반환하므로 이 분기는 발생하지 않는다.
>
> `config` 는 핸들러가 반환한 그대로 유지된다 — 엔진 오버라이트는 `output` 만 대상으로 한다.

## 6. 에러 코드

Loop 은 **runtime 에러 포트를 갖지 않는다**. 모든 검증 실패는 pre-flight (config 검증) 또는 컨테이너 구조 검증 단계에서 throw 된다 (CONVENTIONS Principle 3.1):

| 발생 조건 | 메시지 | 시점 |
|-----------|--------|------|
| `count` 가 표현식이 아니면서 숫자 파싱 실패 | `count must be a number or expression` | handler.validate (`validateLoopConfig`) |
| `count` 가 0 이하 정수 | `count must be greater than 0` | handler.validate |
| `maxIterations` 가 표현식이 아니면서 숫자 파싱 실패 | `maxIterations must be a number` | handler.validate |
| `count > maxIterations` (둘 다 리터럴) | `count must be less than or equal to maxIterations (N)` | handler.validate |
| `count > maxIterations` (런타임 평가) | `MAX_ITERATIONS_EXCEEDED: Loop count <count> exceeds maximum <maxIterations>` | engine `LoopExecutor.execute` (런타임 throw) |
| 반복 i 가 `maxIterations` 도달 | `MAX_ITERATIONS_EXCEEDED: Loop iteration <i> exceeds maximum <maxIterations>` | engine `LoopExecutor.execute` |
| `emit` 포트에 body 노드 미연결 | `CONTAINER_MISSING_EMIT: Container "<label>" has no body node wired to its "emit" port. ...` | engine pre-flight |
| `emit` 포트에 body 노드 2개 이상 연결 | `CONTAINER_MULTIPLE_EMIT: Container "<label>" has <N> nodes wired to its "emit" port. Only one emit source is allowed.` | engine pre-flight |
| `emit` 의 source 가 body child 가 아님 | `CONTAINER_MISSING_EMIT: ... that node isn't a body child of this container. ...` | engine pre-flight |

## 7. 캔버스 요약

[공통 §8](./0-common.md#8-캔버스-요약) — `Loop` 행 인용. 형식: `{count}x` (예: `10x`). breakCondition 이 설정되어 있으면 `· break condition` 추가.

실행 중 컨테이너 헤더에는 현재 진행 인덱스를 표시한다 (예: `Iteration 3/10`, [공통 §3](./0-common.md#3-컨테이너-노드-패턴-loop--map--foreach)).

## 8. Rationale

### 8.1 "최소 반복 1회" 정책 — `count` default `'1'`

`count` 의 zod schema 는 `default('1')` 이며, UI 메타는 `ui.required: true` 다. 두 layer 가 결합되어 "count 가 빈 값" 상태는 발생하지 않는다 — 사용자가 폼에서 명시적으로 비워도, storage layer (zod parse) 에서 `'1'` 로 채워진다.

`default('1')` 을 유지하는 이유는 `'1'` = "한 번 반복" 으로 의미 있는 fallback 이기 때문이다. `default('')` 로 두면 신규 노드 추가 시 빈 input 이 노출되어 의미 있는 default UX 가 부재하고, dead `loop:no-count` warningRule 도 살아남는다. 대신 `default('1')` + warningRule 제거 + Rationale 명문화로 SSOT 를 단순화한다.

**결과 동작 layer**:
- **UI** — `ui.required: true` 가 asterisk 표시 (`visibility.ts isFieldRequired`)
- **Storage (zod)** — `default('1')` 가 `undefined` 일 때 채움. 빈 string `''` 은 그대로 통과되지만, 일반 폼 흐름에서는 사용자가 빈 값으로 명시 저장할 경로가 거의 없음
- **Runtime (engine)** — `coerceContainerNumber` 가 0 / `''` / `null` 등 비정상값 진입 시 `INVALID_CONTAINER_PARAM` throw — 레거시 데이터·직접 repo write 등으로 schema 우회된 경로의 safety net
- **Backend handler.validate** — `validateLoopConfig` 가 명시적 0/음수/non-numeric 만 reject. 빈 config 는 zod default 가 채울 수 있으므로 통과

**dead warningRule 제거**: `loop:no-count` (`when: '!count'`) 는 `default('1')` 로 인해 발화 경로가 없다. `warningRules: []` 로 두고 코드 주석에 "intentionally empty" 명시 — 향후 유지보수자가 dead rule 을 재현·복원하지 않도록.

### 8.2 `validateLoopConfig` cross-field 검증의 numeric-only 가드

`validateLoopConfig` 의 "`count > maxIterations`" cross-field 비교는 `typeof count === 'number'` 일 때만 발화한다. 사용자 입력 raw 가 숫자 문자열(`'200'`) 인 경우는 schema 단계의 cross-field 검증을 **의도적으로 건너뛴다**.

근거:
- 사용자 입력 raw string 은 핸들러가 **echo** 한다 (Principle 7) — 표현식 `{{ ... }}` 보존을 위해 string ↔ number 변환을 schema 단에서 강제하지 않는다.
- 문자열 → 숫자 강제는 engine 의 `coerceContainerNumber` (execution-engine.service §runContainerInner) 에서 일어나며, 그 단계에서 `MAX_ITERATIONS_EXCEEDED` 가 cross-field 위반을 잡는다 (§6 표).
- schema 단에서 문자열을 미리 파싱·재해석하면 "raw string ↔ engine 평가값" 두 진실이 생기는데, raw string 보존이 더 단일 진실에 가깝다.

결과: `validateLoopConfig({ count: '200', maxIterations: 100 })` 는 schema 단계에서 통과되고, runtime 에서 `MAX_ITERATIONS_EXCEEDED` 로 차단된다 — 두 단계 모두 안전 net 이지만 책임이 분리되어 있다.
