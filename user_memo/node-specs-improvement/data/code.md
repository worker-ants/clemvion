# Code (`code`) — Output 일관성 개선안

- **카테고리**: data
- **현 문서**: [../../node-specs/data/code.md](../../node-specs/data/code.md)
- **전역 규칙**: [../CONVENTIONS.md](../CONVENTIONS.md)

> 에러 컨트랙트가 Principle 3 과 정면 충돌합니다. 본 개선안은 **Option A (less-breaking) / Option B (consistency-first)** 두 안을 제시하고 **Option A 를 권고**합니다.

## 1. 현재 Output 구조 요약

Node.js `vm` 기반 sandbox 에서 사용자 JavaScript 를 실행하여 `return` 값을 `output` 에 담아 반환합니다. 에러가 발생해도 **throw 하지 않고** `meta.success: false` + `meta.error*` 필드로 표현하며, **항상 기본 포트(`out`)로만 흐릅니다**.

```json
{
  "config": { "language": "javascript" },
  "output": 42,
  "meta": {
    "success": true,
    "logs": []
  }
}
```

실패 케이스:

```json
{
  "config": { "language": "javascript" },
  "output": null,
  "meta": {
    "success": false,
    "error": "boom",
    "errorCode": "CODE_RUNTIME_ERROR",
    "stack": "Error: boom\n    at code-node.js:3:7",
    "logs": []
  }
}
```

특징 요약:

- `output` 은 사용자 `return` 값의 **raw shape** (primitive/object/array 모두 가능).
- 실패 시 `output: null` — 사용자가 의도적으로 `return null` 한 경우와 **구분 불가능**.
- `meta.success: boolean` 로 성공/실패 표현.
- `port`: 성공/실패 구분 없이 `undefined` → 기본 `out` 으로만 흐름. `error` 포트 없음.
- 후속 분기는 사용자가 If/Else 에서 `{{ $node["X"].meta.success }}` 를 검사해야 함 — **워크플로우 엔진의 에러 포트 라우팅을 못 씀**.
- `meta.logs` 에 `console.*` 출력 100줄까지 캡처.
- `meta.durationMs` 부재.

## 2. 식별된 불일치

| # | 항목 | 위반한 Principle | 설명 |
| --- | --- | --- | --- |
| 1 | 에러를 `meta` 로만 표현, `error` 포트 부재 | **Principle 3.1** | 런타임 에러는 `port: 'error'` + `output.error` 로 표현해야 함. 현재는 정상/실패가 모두 `out` 포트로 흐르고 `meta.success` 로만 구분 가능 → 엔진의 에러 라우팅 기능을 활용 불가, 워크플로우 작성자가 매 code 노드마다 `meta.success` If/Else 를 붙여야 함 |
| 2 | 실패 시 `output: null` | **Principle 3.1 / 8** | 사용자가 의도적으로 `return null` 한 정상 케이스와 **구분 불가**. `output.error` 로 별도 필드에 에러를 담는 것이 규약 |
| 3 | `meta.error` / `meta.errorCode` / `meta.stack` 위치 | **Principle 3.2** | `output.error: { code, message, stack? }` 표준 형태로 이동해야 함. 표준 `code` 값은 `UPPER_SNAKE_CASE` 로 통일 |
| 4 | `meta.durationMs` 부재 | **Principle 2** | 공통 필수 실행 메트릭 누락 |
| 5 | `meta.success` | Principle 2 | CONVENTIONS 2 에서 "Code 계열 meta 에 `success` 포함" 으로 명시되어 있어 유지 가능. 단, `error` 포트 도입과 함께 redundant 여부 검토 필요 |
| 6 | `meta.logs` | Principle 2 | 실행 메트릭으로 적합. 유지 |
| 7 | `errorCode` 값 네이밍 | Principle 3.2 | `EXECUTION_TIMEOUT` 은 code 노드 prefix 규칙에 맞춰 `CODE_TIMEOUT` 으로 통일 권장 (UPPER_SNAKE_CASE + 노드 prefix) |

## 3. 제안된 Output 구조

### Option A — Less-breaking 권고안 (채택)

`output` 은 **사용자 return 값의 raw shape** 그대로 유지. 에러만 `error` 포트 + `output.error` 로 분리. 성공 시 output 접근 방식(`$node["X"].output`, `$node["X"].output.foo`)은 **완전히 무변경**.

#### 성공 케이스 (primitive return)

config: `{ "code": "return $input.x * 2;" }`, input: `{ "x": 21 }`

```json
{
  "config": { "language": "javascript" },
  "output": 42,
  "meta": {
    "durationMs": 7,
    "success": true,
    "logs": []
  },
  "port": "out"
}
```

#### 성공 케이스 (object return + logs)

config: `{ "code": "console.log('processing', 1); return { ok: true };" }`

```json
{
  "config": { "language": "javascript" },
  "output": { "ok": true },
  "meta": {
    "durationMs": 9,
    "success": true,
    "logs": ["[log] processing 1"]
  },
  "port": "out"
}
```

#### 에러 케이스 (런타임 에러)

config: `{ "code": "throw new Error('boom');" }`

```json
{
  "config": { "language": "javascript" },
  "output": {
    "error": {
      "code": "CODE_RUNTIME_ERROR",
      "message": "boom",
      "stack": "Error: boom\n    at code-node.js:3:7"
    }
  },
  "meta": {
    "durationMs": 5,
    "success": false,
    "logs": []
  },
  "port": "error"
}
```

#### 에러 케이스 (구문 에러)

```json
{
  "config": { "language": "javascript" },
  "output": {
    "error": {
      "code": "CODE_SYNTAX_ERROR",
      "message": "Unexpected identifier ...",
      "stack": "SyntaxError: ..."
    }
  },
  "meta": {
    "durationMs": 1,
    "success": false,
    "logs": []
  },
  "port": "error"
}
```

#### 에러 케이스 (타임아웃)

```json
{
  "config": { "language": "javascript" },
  "output": {
    "error": {
      "code": "CODE_TIMEOUT",
      "message": "Code execution timed out",
      "stack": "..."
    }
  },
  "meta": {
    "durationMs": 1000,
    "success": false,
    "logs": []
  },
  "port": "error"
}
```

#### 표준 error code 값

| code | 의미 |
| --- | --- |
| `CODE_RUNTIME_ERROR` | sandbox 내 throw / 런타임 예외 |
| `CODE_SYNTAX_ERROR` | vm.Script 컴파일 실패 |
| `CODE_TIMEOUT` | timeout 초과 (`EXECUTION_TIMEOUT` → `CODE_TIMEOUT` 으로 rename) |
| `CODE_MEMORY_LIMIT` | sandbox 메모리 한도 초과 (신규, runtime 지원 시) |

### Option B — Consistency-first (참고용, 비채택)

`output` 도 `output.result` 로 래핑하여 LLM/DB 노드와 shape 일관성 확보.

성공:
```json
{
  "output": { "result": 42 },
  "meta": { "durationMs": 7, "success": true, "logs": [] },
  "port": "out"
}
```

에러: Option A 와 동일 (`output.error`).

### Option A vs Option B 비교

| 축 | Option A (raw output 유지) | Option B (`output.result` 래핑) |
| --- | --- | --- |
| Breaking change 범위 | **에러 핸들링 워크플로우만** (기존 `meta.success` If/Else → error 포트 라우팅) | **모든 code 노드 사용처** (`$node["X"].output` → `$node["X"].output.result`) |
| Principle 8 (1차 네이밍 통일) 준수 | ⚠️ 부분 준수 (LLM 은 `output.result.response`, DB 는 `output.rows` 등 각 노드별 도메인 루트. code 는 "return 값" 이 그 자체로 도메인 루트) | ✅ 완전 준수 |
| Principle 3 준수 | ✅ | ✅ |
| 사용자 관용 | raw return 접근이 code 노드의 사용 패턴 — primitive/object/array 모두 자유롭게 반환. `output.result` 래핑은 primitive return 시 어색 | 래핑이 강제되어 primitive return 도 `{result: 42}` 로 감싸져 약간의 인지 부담 |
| 마이그레이션 비용 | 작음 (에러 핸들러 일부) | 큼 (기존 워크플로우 전수 migration 필요) |
| 기대 이득 | 에러 포트 도입만으로 엔진 라우팅 기능 활용 가능 | 위 + 노드 간 shape 완전 통일 |

**권고**: **Option A 채택**. 이유는 §5 근거에서 상세.

### 필드 표 (Option A 기준)

| 필드 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `output` | `any` (성공 시) | yes | 사용자 코드의 `return` 값. primitive/object/array 모두 허용 |
| `output.error.code` | `string` | 에러 시 yes | `CODE_RUNTIME_ERROR` / `CODE_SYNTAX_ERROR` / `CODE_TIMEOUT` / `CODE_MEMORY_LIMIT` |
| `output.error.message` | `string` | 에러 시 yes | 에러 메시지 (로그/디버깅용 원문) |
| `output.error.stack` | `string` | 에러 시 no | 스택 트레이스 (가능한 경우) |
| `meta.durationMs` | `number` | yes | 핸들러 실행 시간 (ms) |
| `meta.success` | `boolean` | yes | `true`(정상) / `false`(실패). Code 전용 편의 필드 (CONVENTIONS 2) |
| `meta.logs` | `string[]` | no | `[level] payload` 형식, 최대 100줄 |
| `port` | `'out' \| 'error'` | yes | 성공 → `'out'`, 실패 → `'error'` |
| `status` | `undefined` | — | 일반 완료 |

## 4. 마이그레이션 영향도

### Option A 기준 마이그레이션 표

| Expression 경로 / 동작 (Before) | Expression 경로 / 동작 (After) | Breaking? | 비고 |
| --- | --- | --- | --- |
| `$node["X"].output` (성공 시) | `$node["X"].output` | No | raw return 값 접근 유지 |
| `$node["X"].output.foo` (성공, object return) | `$node["X"].output.foo` | No | 유지 |
| `$node["X"].output` (실패 시 `null`) | `$node["X"].output.error` (실패 시 error 객체) | **Yes (semantic)** | 실패 분기는 이제 `error` 포트로 라우팅되므로 후속 노드에서 `$node["X"].output` 에 접근하는 코드는 `error` 포트에 연결된 경우에만 의미 |
| `$node["X"].meta.success` | `$node["X"].meta.success` | No | 유지 (CONVENTIONS 2 에서 허용) |
| `$node["X"].meta.error` | `$node["X"].output.error.message` | **Yes** | 에러 메시지 위치 이동 |
| `$node["X"].meta.errorCode` (`EXECUTION_TIMEOUT` 등) | `$node["X"].output.error.code` (`CODE_TIMEOUT` 등) | **Yes** | 위치 + 값 rename. `EXECUTION_TIMEOUT` → `CODE_TIMEOUT` |
| `$node["X"].meta.stack` | `$node["X"].output.error.stack` | **Yes** | 위치 이동 |
| `$node["X"].meta.logs` | `$node["X"].meta.logs` | No | 유지 |
| (없음) | `$node["X"].meta.durationMs` | No (추가) | 신규 필수 필드 |
| (없음) | `$node["X"].port === 'error'` | No (추가) | 신규 라우팅 |
| `out` 포트로만 흐름 (성공/실패 모두) | 성공 `out` / 실패 `error` | **Yes (behavior)** | 워크플로우 그래프의 **에러 엣지 추가 필요** |
| `meta.success:false` 를 If/Else 로 분기 | `error` 포트로 자동 라우팅 | **Yes (behavior)** | 기존 If/Else 는 제거하거나 `error` 포트 edge 로 교체 |

### 권장 마이그레이션 전략

1. **Phase 1 (additive, non-breaking)**:
   - 핸들러에 `meta.durationMs` 추가.
   - `errorCode` 값 중 `EXECUTION_TIMEOUT` 은 `CODE_TIMEOUT` 과 **둘 다** 동일 의미로 인정 (alias).
   - 기존 워크플로우 무영향.
2. **Phase 2 (schema migration)**:
   - 핸들러에서 실패 시 `output: { error: { code, message, stack? } }` + `port: 'error'` 반환.
   - 동시에 legacy 필드 `meta.error`, `meta.errorCode`, `meta.stack` 은 **한 버전간 deprecated 유지** (값 복제). 사용자가 충분히 이전할 시간 확보.
   - 프런트엔드 노드 정의에 `error` 포트 추가. 기존 노드는 자동 연결 없이 "unconnected error port" 경고.
3. **Phase 3 (cleanup)**:
   - legacy `meta.error` / `meta.errorCode` / `meta.stack` 제거.
   - `EXECUTION_TIMEOUT` alias 제거, `CODE_TIMEOUT` 만 유지.
   - 문서 "에러 포트 없음" 문구 제거, "error 포트로 자동 라우팅" 으로 교체.
4. **마이그레이션 툴**:
   - 기존 워크플로우에서 code 노드 뒤에 붙은 `If/Else ($node["X"].meta.success === false)` 패턴을 탐지해 `error` 포트 edge 로 자동 변환하는 마이그레이션 스크립트 제공 권장.

## 5. 근거

### 왜 Option A 인가 (Option B 대신)

- **Principle 8 (1차 네이밍 통일)** 은 "LLM 계열은 `output.result` 아래 도메인 결과 모음" 을 명시합니다. code 노드는 LLM 계열이 아니며, "도메인 결과" 자체가 **사용자 정의 return 값** 입니다. return 값의 shape 은 본질적으로 **사용자 의사 결정 영역** 이므로, 엔진이 `output.result` 로 강제 래핑하면 primitive return (`return 42`, `return "ok"`) 이 `{result: 42}` 로 변환돼 어색해집니다. CONVENTIONS 8.2 표에서도 "코드 실행 결과 — `output.result`" 로 표기하지만, 이는 원칙 표기일 뿐 "primitive 값을 그대로 반환할 수 있어야 한다" 는 **사용자 관용과 상충**합니다.
- code 노드는 HTTP/DB/LLM 과 달리 "명시된 도메인 shape 이 없는" 범용 transform. 이런 범용 노드는 transform 과 마찬가지로 **사용자 return 그대로** 가 가장 직관적.
- Breaking change 범위: Option B 는 모든 code 노드 출력 접근을 변경시키나, Option A 는 에러 핸들링 워크플로우만 변경. 프로덕트 안정성 측면에서 Option A 가 **월등히 안전**.
- **Principle 3 의 핵심 가치** (에러는 `error` 포트 + `output.error`) 는 Option A 에서도 **완전 달성**. Option B 의 추가 이득은 shape 통일 뿐.

### Option A 의 규칙 준수 정리

- **Principle 3.1 (에러 컨트랙트)**: 런타임 에러 (throw/syntax/timeout) 는 `port: 'error'` + `output.error` 로 표현 → 규약 준수. Pre-flight 에러 (timeout 범위 밖, language 미지원 등) 는 `validate()` 단계 throw 유지 → Principle 3.1 준수.
- **Principle 3.2 (`output.error` 표준 형태)**: `{code, message, stack?}` 사용. `code` 는 UPPER_SNAKE_CASE 및 노드 prefix (`CODE_*`) 통일. `stack` 은 `details` 가 아닌 전용 필드로 둠 — code 노드 고유 컨벤션으로 허용 가능 (details 는 "노드별 선택적 스키마" 이므로 대체 가능하나, stack 은 code 노드에서 거의 항상 존재해 1차 필드로 올리는 것이 UX 우수).
- **Principle 2 (`meta` 는 실행 메트릭)**: `durationMs` 추가. `success` / `logs` 는 CONVENTIONS 2 표에서 Code 계열 권장 필드로 명시되어 유지.
- **Principle 5 (port 활성화 모델)**: `port: 'out' | 'error'` — 복수 출력 중 하나 선택. CONVENTIONS 5 의 "`port: string` — 복수 출력 중 하나 선택" 형태.
- **Principle 0 (5-필드 invariant)**: `config`, `output`, `meta`, `port` 4개 사용. `status` 는 `undefined` — invariant 준수.
- INCONSISTENCY_MATRIX 축 3 "에러 표현" 에서 code 는 "error 포트 신설, `output.error` 로 이동" 으로 명시 — 본 개선안의 방향과 일치.
- INCONSISTENCY_MATRIX 축 2 "실행 메트릭 위치" 에서 code 는 "`meta.{success, error, errorCode, stack, logs}` → 유지 + `meta.durationMs` 추가" 로 명시. 본 개선안은 `error` / `errorCode` / `stack` 을 `output.error` 로 이동 (Option A) 하므로 매트릭스보다 한 단계 **더 엄격**. 이는 INCONSISTENCY_MATRIX 축 3 (에러 표현) 과 축 2 (실행 메트릭) 의 충돌을 축 3 방향으로 해결한 결과 — 에러 컨트랙트 통일 (Principle 3) 이 더 상위 원칙이기 때문.
- **하위호환 (Phase 2)**: legacy `meta.error` / `meta.errorCode` / `meta.stack` 을 일시적으로 duplicate 로 유지해 마이그레이션 기간 동안 기존 워크플로우를 깨지 않음. 이는 "breaking change 는 phased 로" 라는 기본 원칙에 부합.
