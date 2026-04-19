# Transform (`transform`) — Output 일관성 개선안

- **카테고리**: data
- **현 문서**: [../../node-specs/data/transform.md](../../node-specs/data/transform.md)
- **전역 규칙**: [../CONVENTIONS.md](../CONVENTIONS.md)

> 최소 변경 필요 (minimal change). `transform` 은 순수 데이터 변형 노드로 현 컨트랙트가 이미 규약에 상당 부분 부합합니다. 본 개선안은 `meta` 필드 추가를 중심으로 한 **additive 변경만** 권고합니다.

## 1. 현재 Output 구조 요약

`operations` 배열을 순서대로 적용해 input을 변형한 최종 객체를 `output`으로 반환합니다. `meta` / `port` / `status` 를 사용하지 않고, 에러는 pre-flight(config) 검증 단계에서 `throw`로 처리됩니다.

```json
{
  "config": {
    "operations": [
      { "type": "rename_field", "from": "user.firstName", "to": "user.name" },
      { "type": "type_convert", "field": "user.age", "targetType": "number" },
      { "type": "string_op", "field": "user.name", "operation": "uppercase" },
      { "type": "array_sort", "field": "items", "order": "asc" }
    ]
  },
  "output": {
    "user": { "name": "ALICE", "age": 30 },
    "items": [1, 2, 3]
  }
}
```

특징 요약:

- `output` 은 input 에 operations 를 모두 적용한 **최종 객체**. 사용자는 `$node["X"].output.user.name` 형태로 변형된 필드에 **직접 접근**.
- `meta`: 반환하지 않음.
- `port`: 단일 출력 (`out`) 뿐이라 `undefined` (Principle 5 — 기본 단일 출력).
- `status`: 일반 완료 (`undefined`).
- 에러: `operations[i]` 의 `type` 이 unknown 이거나 필수 arg 가 누락되면 `throw` → 엔진이 실행 실패로 마킹 (Pre-flight). 에러 포트는 없음.
- 누락/타입 불일치 런타임 에러는 **no-op** (원본 유지) — 실패가 아니라 정상 흐름.

## 2. 식별된 불일치

| # | 항목 | 위반한 Principle | 설명 |
| --- | --- | --- | --- |
| 1 | `meta.durationMs` 부재 | Principle 2 | 공통 필수 필드가 누락. 다른 모든 노드가 제공하는 실행 시간 메트릭이 없어 워크플로우 단위 성능 분석 시 transform 노드만 측정 불가 |
| 2 | 적용된 operation 개수 등 실행 메타 부재 | Principle 2 | 디버깅/관측성 측면에서 "몇 개의 op가 실제로 적용됐는지" 를 확인할 방법이 없음. no-op 으로 스킵된 경우도 사용자가 알 수 없음 |
| 3 | `output` 래핑 여부 | Principle 8 | LLM 계열은 `output.result.*` 로 통일했으나 transform 은 "변형 결과 = output 루트" 형태를 유지. 사용자가 `output.user.name` 으로 **직접 접근**하는 관용이 강해 breaking change 감수 가치가 낮음 → **현행 유지 권고** |
| 4 | 에러 컨트랙트 | Principle 3 | pre-flight 에러는 `throw` 로 처리하는 것이 Principle 3.1 에 부합 (유지). 런타임 에러 포트는 순수 데이터 변형 특성상 불필요 (유지) |
| 5 | `port` / `status` | Principle 0 / 5 | 단일 출력 + 일반 완료 → `undefined` 유지 (OK) |

## 3. 제안된 Output 구조

### Before

```json
{
  "config": { "operations": [...] },
  "output": {
    "user": { "name": "ALICE", "age": 30 },
    "items": [1, 2, 3]
  }
}
```

### After (성공 — 유일한 정상 케이스)

```json
{
  "config": {
    "operations": [
      { "type": "rename_field", "from": "user.firstName", "to": "user.name" },
      { "type": "type_convert", "field": "user.age", "targetType": "number" },
      { "type": "string_op", "field": "user.name", "operation": "uppercase" },
      { "type": "array_sort", "field": "items", "order": "asc" }
    ]
  },
  "output": {
    "user": { "name": "ALICE", "age": 30 },
    "items": [1, 2, 3]
  },
  "meta": {
    "durationMs": 3,
    "operationsApplied": 4,
    "operationsSkipped": 0
  }
}
```

### After (Pre-flight 에러 — throw 로 엔진 실행 실패 마킹)

핸들러는 객체를 반환하지 않고 `throw` 하며, 엔진은 실행 실패(execution failed) 로 마킹합니다. Principle 3.1 의 Pre-flight 규약 그대로.

```text
Error: TransformOperation type "unknown_op" is not supported
  at TransformHandler.execute (transform.handler.ts:L)
```

**핵심 변경점**:

- `output` 구조는 **변경하지 않음** (breaking change 회피). 사용자가 `$node["X"].output.<변형된 필드>` 형태로 직접 접근하는 관용 존중.
- `meta.durationMs` 추가 — 공통 필수 필드 (Principle 2).
- `meta.operationsApplied: number` 추가 — 실제로 값을 변형한 op 개수. no-op 으로 스킵된 건 제외.
- `meta.operationsSkipped: number` 추가 — 필드 부재/타입 불일치 등으로 no-op 된 op 개수. 디버깅 용도.
- 에러 포트는 **신설하지 않음** — transform 은 순수 데이터 변형 노드이며, runtime 에러는 정의상 존재하지 않음 (모든 op가 실패 시 no-op 로 폴백). Principle 3.1 의 "pre-flight 에러는 throw" 규약만 유지.
- `port` / `status` 는 그대로 `undefined`.

### 선택 필드 표

| 필드 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `output` | `object` | yes | operations 를 순서대로 적용한 최종 객체. 루트 키 이름은 input 및 operations 에 따라 가변 |
| `meta.durationMs` | `number` | yes | 핸들러 실행 시간 (ms) |
| `meta.operationsApplied` | `number` | yes | 실제 값 변형이 발생한 op 수 |
| `meta.operationsSkipped` | `number` | yes | no-op 처리된 op 수 (`operationsApplied + operationsSkipped === config.operations.length`) |
| `port` | `undefined` | — | 단일 출력 `out` 이 기본 활성 |
| `status` | `undefined` | — | 일반 완료 |

## 4. 마이그레이션 영향도

| Expression 경로 (Before) | Expression 경로 (After) | Breaking? | 비고 |
| --- | --- | --- | --- |
| `$node["X"].output` | `$node["X"].output` | No | 변형 결과 객체 그대로 유지 |
| `$node["X"].output.user.name` | `$node["X"].output.user.name` | No | 직접 필드 접근 유지 (가장 중요) |
| `$node["X"].output.items[0]` | `$node["X"].output.items[0]` | No | 배열 인덱스 접근 유지 |
| `$node["X"].config.operations` | `$node["X"].config.operations` | No | operations echo 유지 |
| `$node["X"].config.operations.length` | `$node["X"].config.operations.length` | No | 유지 |
| (없음) | `$node["X"].meta.durationMs` | No (추가) | 신규 필드 |
| (없음) | `$node["X"].meta.operationsApplied` | No (추가) | 신규 필드 |
| (없음) | `$node["X"].meta.operationsSkipped` | No (추가) | 신규 필드 |
| Pre-flight throw | Pre-flight throw | No | 행동 동일 |

**권장 전략**:

1. P0: 핸들러에서 `meta.durationMs`, `meta.operationsApplied`, `meta.operationsSkipped` 를 계산해 반환. 100% **additive**, 기존 워크플로우 무영향.
2. P0: 문서의 "Output" 섹션에 "`meta` / `port` / `status` 는 이 노드에서는 제공되지 않습니다" 문장을 **제거**하고, 신규 `meta` 3필드를 명시.
3. P1: no-op 처리된 op 를 `meta.skippedReasons?: Array<{ opIndex, reason }>` 로 세분화할지 추가 검토 (현 단계에서는 count 만으로 충분).
4. 에러 포트 신설이나 `output` 래핑은 **고려하지 않음** — transform 은 이미 규약의 95% 를 충족하며, 사용자 관용이 강한 output 구조를 깨는 비용 > 이득.

## 5. 근거

- **Principle 2 (meta 는 실행 메트릭)**: `durationMs` 는 "공통 필수" 로 명시된 유일한 필드. 다른 모든 data/logic/integration 계열 노드가 제공하므로 transform 에만 누락되는 것은 일관성 위반. `operationsApplied` / `operationsSkipped` 는 transform 고유의 실행 메트릭으로 `meta` 에 위치하는 것이 자연스러움.
- **Principle 8 (이중/불필요한 중첩 제거)**: transform 의 `output` 은 "변형 결과 = output 루트" 관용으로, LLM 계열의 `output.result.*` 구조와 달리 **도메인 데이터가 루트** 임. `output.result` 로 래핑하면 기존 `$node["X"].output.user.name` 표현식이 모두 `.output.result.user.name` 으로 바뀌어야 해 breaking cost 가 큼. Principle 8 의 취지("1차 네이밍 통일")는 유지하면서, transform 은 입력 객체 자체를 변형하는 특성상 **예외로 현행 유지** 가 합리적.
- **Principle 3.1 (에러 컨트랙트)**: transform 의 에러는 모두 config 레벨 (op type 불명, 필수 arg 누락) → pre-flight → `throw`. Runtime 에러는 정의상 존재하지 않으므로 `error` 포트 및 `output.error` 추가는 불필요. CONVENTIONS 문서 3.3 에서도 transform 을 "pre-flight(config) 검증만 수행 → throw" 로 명시.
- **Principle 5 (port 활성화 모델)**: 단일 출력 (`out`) 이므로 `port: undefined` 가 표준. CONVENTIONS 에서 `transform` 을 `port: undefined` 의 대표 예시로 언급.
- **Principle 0 (5-필드 invariant)**: `config`, `output`, `meta` 3개만 사용하고 `port` / `status` 는 `undefined` — invariant 준수.
- INCONSISTENCY_MATRIX 축 2 "실행 메트릭 위치": transform 이 다른 노드처럼 `meta.durationMs` 를 추가하는 것이 일관성 기준. 현 매트릭스에는 transform 이 별도 행으로 없지만 공통 규칙 적용 대상.
- INCONSISTENCY_MATRIX 축 3 "에러 표현": transform 은 "throw on config 오류 → 유지 (Pre-flight)" 로 명시되어 있어 본 개선안이 그 방침과 정합.
