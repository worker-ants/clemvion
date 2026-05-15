# Variable Declaration output 개선안

> **최신화 검토 (2026-05-16)**: 현 spec 과 본 plan 의 분석이 정합. side-effect 결과는 `$var.<name>` 로 참조되고 `output` 은 input pass-through — 일관성 유지. 잔여 권고 없음.

> 대상 spec: `spec/4-nodes/1-logic/4-variable-declaration.md` (§5 출력 구조)

## 현재 output (spec 인용)

`spec/4-nodes/1-logic/4-variable-declaration.md:88-107` — §5.1 단일 출력:

```json
{
  "config": { "variables": [{...}, {...}, {...}] },
  "output": { "user": { "id": "u-1", "name": "Alice" } },
  "meta": {
    "durationMs": 0,
    "declared": ["counter", "users", "today"],
    "skipped": [],
    "coercionWarnings": []
  }
}
```

## 진단

Variable Declaration 은 **pass-through + side-effect 노드** (단계 1개). 변수 등록은 `context.variables` 에 side-effect 로 일어나고, 다음 노드가 받는 데이터는 input 그대로. "단계마다 채워지는 field" = input pass-through.

| 항목 | 적절성 | 근거 |
| --- | --- | --- |
| `output` = input pass-through | 적절 | Logic 공통 §10. side-effect 는 `context.variables` 에만 발생 |
| `meta.declared: string[]` | 적절 (meta) | 신규 등록된 변수 이름 — 진단 메트릭 (skip-if-exists 동작 가시화) |
| `meta.skipped: string[]` | 적절 (meta) | 이미 존재해 skip 된 변수 — 의도된 초기화 누락 감지 |
| `meta.coercionWarnings` | 적절 (meta) | silent null fallback 가시화 |
| `meta.durationMs` | 적절 | engine 공통 |
| `config.variables` (raw echo) | 적절 | `defaultValue` 의 `{{ }}` 보존 (Principle 7) |
| `port`: undefined (단일 출력) | 적절 | Principle 5 |

부적절 항목 없음.

추가 점검:

- **`output` 에 등록된 변수 값 echo 안 함** — spec 이 의도적. 후속 노드는 `$var.<name>` 으로 참조 — 이는 conventions Principle 1.1 직교성에 부합 (variables 저장소는 별도 컨텍스트, `output` 으로 echo 하면 직교 위반).
- **`meta.declared` / `meta.skipped` / `meta.coercionWarnings` 의 cardinality** — 변수 정의 수가 매우 많을 때 (100+) 어떻게 표시할지 spec 에 명시 없음. 현 시점 cap 도입 불필요, 변경 없음.

## 개선안 — 정리된 output

현 spec 부합. 변경 없음.

```json
{
  "config": { "variables": [<VarDef>, ...] },
  "output": { /* input 전체 pass-through */ },
  "meta": {
    "durationMs": <number>,
    "declared": [<string>, ...],
    "skipped": [<string>, ...],
    "coercionWarnings": [{ "name": ..., "attemptedType": ..., "error"? }, ...]
  }
}
```

## 분리 제안 — output 에서 빠질 항목의 새 위치

| 기존 output 항목 | 새 위치 | 사유 |
| --- | --- | --- |
| (없음) | — | conventions 부합 |

## Rationale

- side-effect 노드의 핵심 동작 (변수 등록) 은 `context.variables` 에 저장되고 `$var.<name>` 으로 참조되는 워크플로우 전역 상태이지, 본 노드의 output 이 아니다.
- `output` 에 변수 값을 echo 하면: (1) `$var.<name>` 와 의미 중복, (2) 같은 워크플로우 안에서 변수가 modify 되면 `$node["X"].output.<var>` 와 `$var.<var>` 가 어긋나 혼란 발생. 둘 다 회피.
- 변경 가시성은 `meta.declared` / `meta.skipped` 로 충분.
