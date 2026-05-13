# Transform output 개선안

> 대상 spec: `spec/4-nodes/5-data/1-transform.md` (§5 출력 구조)

## 현재 output (spec 인용)

`spec/4-nodes/5-data/1-transform.md:138-159` — §5.1 정상 (단일 출력):

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

## 진단

Transform 은 **순수 데이터 변형 노드** (단계 1개). operation 체인 결과를 root 에 직접 노출.

| 항목 | 적절성 | 근거 |
| --- | --- | --- |
| `output` (root 직접) | 적절 — Principle 8 예외 | 변형 결과를 root 에 둠 (spec footnote 명시). 후속 노드는 `$node["X"].output.<변형된 필드>` 직접 접근 |
| `meta.operationsApplied` | 적절 (meta) | 실제 변형이 발생한 op 수 |
| `meta.operationsSkipped` | 적절 (meta) | silent no-op 처리된 op 수 (필드 부재 / 타입 불일치 / `divide` 0 등) |
| `meta.durationMs` | 적절 | engine 공통 |
| `config.operations` (raw echo) | 적절 | Principle 7 — `set_field.value` 의 `{{ }}` 보존 |
| `port` / `status` | 미설정 | Principle 5 단일 출력 / 비-블로킹 |

부적절 항목 없음.

추가 점검:

1. **`output` root 직접 노출 (vs `output.result.*` wrapper)** — Principle 8.2 표는 "코드 실행 결과 | `output.result`" 라 명시하지만 Transform 은 의도적으로 root 직접 노출 결정 (spec §5.1 footnote: "Principle 8 예외"). 이유: Transform 의 목적이 입력 객체를 "재구조화" 하는 것이므로 결과 객체가 입력 객체와 같은 shape 으로 나가야 후속 노드가 같은 expression path 를 사용. 합리적.
2. **`meta.operationsApplied + operationsSkipped === config.operations.length`** — 일관성 보장. 진단 메트릭으로 무결성 검증 가능.
3. **runtime 에러 포트 없음** — Transform 의 모든 실패는 (a) pre-flight throw (config 검증) 또는 (b) silent no-op (필드 부재 등). spec 명시: "사용자가 캔버스에서 즉시 알 수 있어야 하는 config 오류만 pre-flight throw". 합리적.

## 개선안 — 정리된 output

현 spec 부합. 변경 없음.

```json
{
  "config": { "operations": [<Operation>, ...] },
  "output": <변형 결과 객체 — input shape 유지>,
  "meta": {
    "durationMs": <number>,
    "operationsApplied": <number>,
    "operationsSkipped": <number>
  }
}
```

## 분리 제안 — output 에서 빠질 항목의 새 위치

| 기존 output 항목 | 새 위치 | 사유 |
| --- | --- | --- |
| (없음) | — | conventions 부합 (의도적 Principle 8 예외) |

## Rationale

- Transform 의 시멘틱 = "입력 객체를 재구조화하여 출력". 결과를 `output.result.*` wrapper 로 감싸면 후속 노드가 같은 필드 경로를 쓸 수 없어 노드의 본질적 가치 손실.
- silent no-op 정책 (필드 부재, 타입 mismatch, divide 0, dayjs invalid, JSON parse 실패, regex 길이 초과) 은 `meta.operationsSkipped` 로 가시화 — Principle 3 (silent failure 해소) 부합.
- runtime 에러 포트 부재는 Transform 의 단순한 데이터 처리 시멘틱 (외부 I/O 없음) 과 정합 — pre-flight throw 만으로 충분.
