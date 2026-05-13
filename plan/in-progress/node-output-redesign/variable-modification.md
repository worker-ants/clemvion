# Variable Modification output 개선안

> 대상 spec: `spec/4-nodes/1-logic/5-variable-modification.md` (§5 출력 구조)

## 현재 output (spec 인용)

`spec/4-nodes/1-logic/5-variable-modification.md:92-113`:

```json
{
  "config": {
    "modifications": [
      { "variable": "counter", "operation": "increment", "value": "{{ $delta }}" },
      { "variable": "log",     "operation": "append",    "value": " done" }
    ]
  },
  "output": { "user": { "id": 7, "name": "Alice" } },
  "meta": {
    "durationMs": 1,
    "modifications": [
      { "variable": "counter", "operation": "increment", "applied": true },
      { "variable": "log",     "operation": "append",    "applied": true }
    ],
    "coercionWarnings": [],
    "createdVariables": []
  }
}
```

## 진단

Variable Modification 도 **pass-through + side-effect 노드** (단계 1개). variable_declaration 과 동일 패턴.

| 항목 | 적절성 | 근거 |
| --- | --- | --- |
| `output` = input pass-through | 적절 | side-effect 는 `context.variables` 에만 발생 |
| `meta.modifications: Array<{variable, operation, applied, before?, after?}>` | 적절 (meta) | 적용된 modification 메트릭 + opt-in 스냅샷 (`recordValues=true` 시만 before/after, 마스킹 적용) |
| `meta.coercionWarnings` | 적절 (meta) | 비-매칭 타입 fallback 가시화 |
| `meta.createdVariables: string[]` | 적절 (meta) | 선언 없이 처음 생성된 변수 (오탈자 감지) |
| `meta.durationMs` | 적절 | engine 공통 |
| `config.modifications` (raw echo) | 적절 | Principle 7 — `value` 의 `{{ }}` 보존 |

부적절 항목 없음.

추가 점검:

- **`config.recordValues` echo** — spec 에 명시되지 않았으나 raw echo 권장. 다운스트림이 `meta.modifications[i].before/after` 의 노출 여부를 알 수 있도록.
- **before/after 마스킹 정책 (variable name secret pattern, 4096 byte cap)** 은 spec §5.1 footnote 에 명시. 수정 불필요.

## 개선안 — 정리된 output

현 spec 거의 부합. 미시 보강:

- `config.recordValues` 도 echo 추가 권장 (현재 명시 없음).

```json
{
  "config": {
    "modifications": [<ModDef>, ...],
    "recordValues"?: <boolean>
  },
  "output": { /* input 전체 pass-through */ },
  "meta": {
    "durationMs": <number>,
    "modifications": [{ "variable": ..., "operation": ..., "applied": <boolean>, "before"?, "after"? }, ...],
    "coercionWarnings": [{ "variable": ..., "operation": ..., "fromType": ..., "error"? }, ...],
    "createdVariables": [<string>, ...]
  }
}
```

## 분리 제안 — output 에서 빠질 항목의 새 위치

| 기존 output 항목 | 새 위치 | 사유 |
| --- | --- | --- |
| (없음) | — | conventions 부합 |

## Rationale

- variable_declaration 과 동일 — side-effect 결과는 `$var.<name>` 으로 참조되며 `output` 에 echo 하면 일관성 위반.
- `meta.modifications[i].applied` 는 silent no-op (예: `pop` on non-array) 가시화 — 필수 진단 메트릭.
- `recordValues` opt-in 정책은 (1) 큰 컬렉션 변수의 run log 비대화 방지, (2) PII 보호 — 합리적 default `false`.
