# Loop output 개선안

> 대상 spec: `spec/4-nodes/1-logic/3-loop.md` (§5 출력 구조)

## 현재 output (spec 인용)

`spec/4-nodes/1-logic/3-loop.md:91-99` — §5.1 시작 시점 (핸들러 반환):

```json
{ "config": { "count": "10", "maxIterations": 1000 }, "output": null }
```

`spec/4-nodes/1-logic/3-loop.md:113-141` — §5.2 완료 시점 (`done` 포트, 엔진 오버라이트 후):

```json
{
  "config": { "count": "10", "maxIterations": 1000 },
  "output": {
    "iterations": ["body emit result 0", "body emit result 1", "body emit result 2"]
  },
  "meta": {
    "iterations": 3,
    "maxIterationsReached": false,
    "exitReason": "completed",
    "durationMs": <number>
  }
}
```

## 진단

Loop 은 **컨테이너 노드**로 두 단계가 명확하다 — (1) 시작(body 진입 직전) / (2) 완료(`done` 포트). 각 단계의 `output` 이 **단계마다 채워지는 field** 정의에 부합:

| 단계 | 시점 output | 적절성 |
| --- | --- | --- |
| 시작 | `output: null` | 적절 — 엔진 오버라이트 시그널 (Principle 9.1). 다운스트림에 노출되지 않는 internal 상태 |
| 반복 중 | (외부 관측 안 됨) | 적절 — body 노드들이 자체 output 을 가짐 |
| 완료 | `output: { iterations: unknown[] }` | 적절 — 엔진이 collected emit 결과를 컬렉션 키 `iterations` 로 오버라이트 (Principle 9.2) |

| 필드 | 적절성 | 근거 |
| --- | --- | --- |
| `output.iterations` | 적절 (output) | 각 반복의 emit 출력 = 비즈니스 결과 (다운스트림이 그대로 사용) |
| `meta.iterations` (number) | 적절 (meta) | `output.iterations.length` 의 메트릭 미러 (Principle 2). 직교성 유지 |
| `meta.maxIterationsReached` | 적절 (meta) | 종료 진단 boolean |
| `meta.exitReason` | 적절 (meta) | 종료 사유 enum (`completed` / `break` / `maxIterations`) |
| `meta.durationMs` | 적절 | engine 공통 주입 |
| `config.count`, `config.maxIterations` (raw echo) | 적절 | Principle 7 |

부적절 항목 없음. spec 본문이 이미 conventions 와 정합.

추가 점검:

- **`config.breakCondition` echo 부재** — spec 이 의도적으로 echo 안 함 (§5.1 footnote: "다운스트림이 raw 표현식을 다시 평가할 일 없음"). 합리적이며 Principle 7 의 "선택적 echo" 원칙 안에 들어감.
- **`output.iterations` 와 `meta.iterations` 동일 값 분리** — spec §5.2 의 footnote 가 "결과 배열 vs 메트릭 축 분리" 로 정당화. 직교성 유지를 위해 둘 다 유지하는 것은 conventions Principle 1.1 / 2 합산 결정.
- **`output.count` 추가 제안 검토 → 폐기** — spec footnote: "`output.iterations.length` 가 SSOT". 현 정의 유지.

## 개선안 — 정리된 output

현 spec 부합. 변경 없음.

**시작 단계:**
```json
{ "config": { "count": <raw>, "maxIterations": <number> }, "output": null }
```

**완료 단계 (엔진 오버라이트 후):**
```json
{
  "config": { "count": <raw>, "maxIterations": <number> },
  "output": { "iterations": [<emit>, ...] },
  "meta": {
    "iterations": <number>,
    "maxIterationsReached": <boolean>,
    "exitReason": "completed" | "break" | "maxIterations",
    "durationMs": <number>
  }
}
```

## 분리 제안 — output 에서 빠질 항목의 새 위치

| 기존 output 항목 | 새 위치 | 사유 |
| --- | --- | --- |
| (없음) | — | conventions 부합 |

## Rationale

- 컨테이너 노드의 두 단계는 spec 이 §5.1 / §5.2 / §5.7 로 명시 분리. Principle 9 컨트랙트 (`output: null` → engine override) 가 `iterations` 컬렉션 키와 함께 작동.
- `output.count` 비포함은 Principle 1.1 직교 (`config.count` 와 중복 방지). 조기 종료 시 `output.iterations.length` ≠ `config.count` 인 케이스가 있어 동등성도 깨짐.
- 옛 PRD 초안의 `output.completedIterations` / `output.lastResult` 같은 필드 제안은 `iterations` 배열로 흡수 가능하므로 폐기.
