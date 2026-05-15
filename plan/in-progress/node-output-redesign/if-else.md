# If/Else output 개선안

> **최신화 검토 (2026-05-16)**: 현 spec 과 본 plan 의 분석이 정합. 모든 항목이 conventions Principle 0–11 에 부합하며 잔여 권고 없음.

> 대상 spec: `spec/4-nodes/1-logic/1-if-else.md` (§5 출력 구조)

## 현재 output (spec 인용)

`spec/4-nodes/1-logic/1-if-else.md:70-100` (Case 5.1 — 조건 만족, port `true`):

```json
{
  "config": { "conditions": [...], "combineMode": "and" },
  "output": { "user": { "age": 25, "name": "Alice" } },
  "meta": {
    "durationMs": 0,
    "conditionResult": true,
    "matchedConditions": [
      { "index": 0, "field": "user.age", "operator": "gte", "value": 18, "result": true }
    ]
  },
  "port": "true"
}
```

§5.2 의 Case `false` 분기는 `port: "false"` + `meta.conditionResult: false` 만 다르며 `output` 은 동일하게 input pass-through.

## 진단

If/Else 는 분기만 수행하는 **pass-through 노드**이므로 단계가 1개이고, "그 단계가 끝났을 때 채워지는 field" 는 *input 그대로 통과한 결과* 다. 따라서 현 spec 의 `output = input pass-through` 는 **정의에 부합한다**.

| 항목 | 적절성 | 근거 |
| --- | --- | --- |
| `output` = input 전체 (pass-through) | 적절 | Logic 공통 Pass-through 규약. 다음 노드가 받을 데이터 = 분기 통과한 값 = input 자체 |
| `meta.conditionResult: boolean` | 적절 (meta) | 실행 메트릭 (Principle 2) — `port` 문자열 비교 없이 boolean 판별용 |
| `meta.matchedConditions: Array` | 적절 (meta) | 디버깅용 per-condition 평가 결과 — 비즈니스 데이터 아님 |
| `meta.durationMs` | 적절 (meta) | engine 공통 주입 |
| `config.conditions` / `config.combineMode` | 적절 (config echo) | Principle 7 raw echo |
| `port: 'true' | 'false'` | 적절 | Principle 5 — 분기 결과 |

부적절한 항목 없음. 다만 다음 미시 점검:

- **`meta.matchedConditions[i]` 의 shape 일관성** — `combineMode='or'` 일 때 단락 평가(short-circuit)가 적용되면 평가되지 않은 조건은 누락되는지 spec 에 명시되지 않음. "단계마다 채워지는 field" 정의에는 영향 없으나 디버깅 진단 누락 가능.
- **`output` 단일 case** — pass-through 이므로 `output` 자체에 분기별 차이가 없다. 후속 노드는 `port` 또는 `meta.conditionResult` 로 분기 판별. spec 이 이미 명시.

## 개선안 — 정리된 output

현 spec 은 conventions 에 부합하므로 **구조 변경 없음**. 다만 다음 미시 보강:

- §5.1 / §5.2 둘 다에서 `meta.matchedConditions` 가 short-circuit 시 어떻게 채워지는지 한 줄 명시 (모두 평가 / 매칭 시점까지만 평가) — "단계마다 채워지는 field" 정의가 흔들리지 않도록.

```json
{
  "config": { "conditions": [...], "combineMode": "and" },
  "output": { /* input 전체 그대로 */ },
  "meta": { "durationMs": <number>, "conditionResult": <boolean>, "matchedConditions": [/* 평가된 항목만 */] },
  "port": "true" | "false"
}
```

## 분리 제안 — output 에서 빠질 항목의 새 위치

| 기존 output 항목 | 새 위치 | 사유 |
| --- | --- | --- |
| (없음) | — | 본 노드는 conventions 부합 |

## Rationale

- **pass-through 노드의 단계** = 분기 평가 1단계. 평가 결과는 `port` (라우팅) + `meta.conditionResult` (boolean 진단) 로 분리되어 있어 `output` 에 추가 데이터를 넣을 필요가 없다.
- 옛 PRD 초안에서 검토되었던 `output.view` 판별자 / `output.matchedBranch` 같은 필드는 [Principle 1.1.4](../../../spec/conventions/node-output.md#114-예외--outputview-타입-판별자-패턴은-사용하지-않는다) 에 따라 폐기.
- `output.matchedConditions` 처럼 진단 메트릭을 `output` 에 두는 대안도 검토 가능하나, 비즈니스 로직(다운스트림 노드의 정상 입력)이 아니므로 `meta` 가 정답.
