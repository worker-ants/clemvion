# ForEach output 개선안

> 대상 spec: `spec/4-nodes/1-logic/9-foreach.md` (§5 출력 구조)

## 현재 output (spec 인용)

`spec/4-nodes/1-logic/9-foreach.md:83-91` — §5.1 시작 (body 진입 직전):

```json
{
  "config": { "arrayField": "{{ $input.items }}" },
  "output": [{ "id": "a", "name": "Alice" }, { "id": "b", "name": "Bob" }]
}
```

`spec/4-nodes/1-logic/9-foreach.md:103-118` — §5.2 완료 (`done`, 엔진 오버라이트):

```json
{
  "config": { "arrayField": "{{ $input.items }}", "errorPolicy": "stop" },
  "output": {
    "items": [{ "userId": "a", "ok": true }, { "userId": "b", "ok": true }],
    "count": 2
  },
  "meta": { "durationMs": 320, "iterations": 2 },
  "port": "done"
}
```

`spec/4-nodes/1-logic/9-foreach.md:144-166` — §5.3 (errorPolicy='skip'/'continue' 분리):

```json
{
  "output": {
    "items": [
      { "userId": "a", "ok": true },
      null,
      { "userId": "c", "ok": true }
    ],
    "count": 3,
    "skipped": [{ "index": 1, "error": { "code": "VALIDATION_FAILED", "message": "..." } }]
  },
  "meta": { "durationMs": 410, "iterations": 3, "skippedCount": 1 },
  "port": "done"
}
```

## 진단

ForEach 는 **컨테이너** (반복). 단계 2개. Map 과 동일 패턴이지만 컬렉션 키 = `items` (변형 의도가 아닌 "각 항목 처리").

| 단계 | 시점 output | 적절성 |
| --- | --- | --- |
| 시작 (body 진입 직전) | `output: items[]` (해석된 원본 배열) | Map 과 동일한 컨트랙트 변형 — spec §5.7 표가 "외부 expression 노출되지 않는다" 명시 |
| 완료 (`done`) | `output: { items, count, skipped? }` | 적절 — 비즈니스 결과 |

| 필드 | 적절성 | 근거 |
| --- | --- | --- |
| `output.items[]` | 적절 (output) | 각 iter emit 결과. errorPolicy=skip/continue 시 실패 인덱스는 `null` placeholder (인덱스 보존) |
| `output.count` | 적절 | 입력 배열 길이 |
| `output.skipped: [{index, error}]` | 적절 (output) | 실패 항목 분리 — Map 의 인라인 `_skipped` 패턴과 다름 (시멘틱 분리 의도) |
| `meta.iterations` | 적절 (meta) | body 실행 횟수. `output.count` 와 동일하나 메트릭 축 분리 |
| `meta.skippedCount` | 적절 (meta) | `output.skipped.length` 미러 |
| `meta.durationMs` | 적절 | engine 공통 |
| `config.arrayField` / `errorPolicy` (raw echo) | 적절 | Principle 7 |
| `port: 'body' / 'done'` | 적절 | 두 단계 라우팅 |

핵심 점검:

1. **§5.1 외부 노출 모호성** — Map 과 동일한 문제. spec 의 §5.7 표가 "다운스트림은 §5.2 형태만 본다" 라고 명시하지만 §5.1 의 JSON 예시가 envelope 으로 표시되어 혼동 여지. 표현 명확화 권장.
2. **`output.skipped` 분리 vs Map 의 인라인 `_skipped`** — ForEach 는 P0 채택안으로 분리, Map 은 인라인 유지. 두 노드의 시멘틱 (각 항목 독립 처리 vs 변형 배열) 이 다르므로 의도된 차이지만, 다운스트림 분기 코드의 일관성 관점에서 통일 검토 가치 있음 — 본 plan 은 현 정책 유지, 통일은 별도 조정 필요.
3. **`output.skipped` 가 0 건일 때 필드 자체 생략** — Principle 11 (`undefined` 필드 echo 금지) 부합. 다운스트림은 `output.skipped` 존재 여부로 실패 처리 분기.

## 개선안 — 정리된 output

**시작 단계 (handler 반환):**
```json
{ "config": { "arrayField": <raw> }, "output": <items[] internal> }
```

**완료 단계 (엔진 오버라이트, 다운스트림 노출):**
```json
{
  "config": { "arrayField": <raw>, "errorPolicy": <enum> },
  "output": {
    "items": [<emit | null>, ...],
    "count": <number>,
    "skipped"?: [{ "index": <number>, "error": { "code": ..., "message": ... } }, ...]
  },
  "meta": {
    "durationMs": <number>,
    "iterations": <number>,
    "skippedCount"?: <number>
  },
  "port": "done"
}
```

## 분리 제안 — output 에서 빠질 항목의 새 위치

| 기존 output 항목 | 새 위치 | 사유 |
| --- | --- | --- |
| §5.1 의 raw `items[]` 외부 노출 가능성 | handler internal (또는 spec 표현 명확화) | Principle 9.1 |
| (그 외 변경 없음) | — | conventions 부합 |

## Rationale

- 컨테이너의 두 단계 분리는 Principle 9 의 핵심.
- `skipped` 별도 필드 분리 (vs Map 의 인라인) 는 ForEach 의 의도 — "각 항목을 독립적으로 처리하는 작업" — 와 정합. 성공만 추리려면 `output.items.filter(x => x !== null)`, 실패 처리는 `output.skipped` 배열만 walk.
- `output.count` 는 ForEach 의 SSOT — 정상/실패 통합 카운트 (≠ `meta.iterations`). spec 의 footnote: "= 입력 배열 길이, 인덱스 유지".
