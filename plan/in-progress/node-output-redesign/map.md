# Map output 개선안

> 대상 spec: `spec/4-nodes/1-logic/7-map.md` (§5 출력 구조)

## 현재 output (spec 인용)

`spec/4-nodes/1-logic/7-map.md:66-94` — §5.1 시작 시점 (port `body`):

```json
{
  "config": { "inputField": "{{ $input.items }}", "errorPolicy": "stop" },
  "output": [
    { "id": 1, "name": "Alice" },
    { "id": 2, "name": "Bob" },
    { "id": 3, "name": "Carol" }
  ],
  "meta": { "durationMs": 0 },
  "port": "body"
}
```

`spec/4-nodes/1-logic/7-map.md:104-124` — §5.2 완료 시점 (port `done`, 엔진 오버라이트 후):

```json
{
  "config": { "inputField": "{{ $input.items }}", "errorPolicy": "stop" },
  "output": {
    "mapped": [
      { "id": 1, "label": "user-1: Alice" },
      { "id": 2, "label": "user-2: Bob" },
      { "id": 3, "label": "user-3: Carol" }
    ],
    "count": 3
  },
  "meta": { "durationMs": 187 },
  "port": "done"
}
```

## 진단

Map 은 **컨테이너 노드** (반복 변형). 단계 2개:

| 단계 | 시점 output | 적절성 |
| --- | --- | --- |
| 시작 (body 진입 직전) | `output: items[]` (해석된 원본 배열) | **부분적으로 부적절** — Loop/Parallel 은 `output: null` 인데 Map/ForEach 는 배열을 반환. spec §5.7 footnote 가 "ForEachExecutor 가 이 배열을 분배 입력으로 소비" 라고 정당화하나, 다운스트림이 잠시 이 raw 배열을 보는 시점이 존재 |
| 완료 (`done` 포트) | `output: { mapped, count }` (엔진 오버라이트) | 적절 — 변형 결과 = 비즈니스 데이터 |

| 필드 | 적절성 | 근거 |
| --- | --- | --- |
| §5.1 `output: items[]` | 컨테이너 컨트랙트 변형 — Principle 9.1 의 `output: null` 패턴과 다름 | spec 명시: "다운스트림이 직접 참조해서는 안 된다 — 완료 후 §5.2 의 `{mapped, count}` 로 덮어쓰여진다" |
| §5.2 `output.mapped` | 적절 (output) | 변형된 배열, 컬렉션 키 = `mapped` (Loop=`iterations`/ForEach=`items`/Parallel=`branches` 와 구분) |
| §5.2 `output.count` | 적절 | O(1) 접근, ForEach 와 대칭성 |
| `meta.durationMs` | 적절 | engine 공통 |
| `config.inputField` / `errorPolicy` (raw echo) | 적절 | Principle 7 |
| `port: 'body' / 'done'` | 적절 | 두 단계 라우팅 |

핵심 점검 — **§5.1 의 `output: items[]` 노출 여부**:

- 다운스트림 expression `$node["Map"].output.*` 가 시작 시점에 raw 배열을 본다면 conventions Principle 9 의 "외부 expression 으로 노출되지 않는 중간 형태" 와 모순.
- spec §5.7 표가 "다운스트림 노드는 항상 §5.2 형태만 본다" 라고 명시 — 즉 시작 시점의 envelope 은 NodeHandlerOutput 자체이지 `$node["Map"].output` 으로 노출되는 값이 아님. 그러나 spec §5.1 의 JSON 예시가 "이 시점의 노드 envelope" 으로 표시되어 있어 혼동 여지.
- **개선 제안**: §5.1 의 표현을 "handler 가 반환하는 raw envelope (외부 비노출)" 으로 더 명확히 하고, 가능하면 Map/ForEach handler 도 Loop/Parallel 처럼 `output: null` 을 반환하고 분배용 배열은 별도 internal 필드로 운반하는 방안 검토. 단, executor 구현 변경이 동반되므로 본 plan 은 spec 명확화만 권장.

## 개선안 — 정리된 output

**시작 단계 (handler 반환, 외부 비노출):**

```json
{
  "config": { "inputField": <raw>, "errorPolicy": <enum> },
  "output": <items[] — 분배용 internal>,    // OR null + internal field (대안)
  "meta": { "durationMs": <number> },
  "port": "body"
}
```

**완료 단계 (엔진 오버라이트, 다운스트림 expression 노출):**

```json
{
  "config": { "inputField": <raw>, "errorPolicy": <enum> },
  "output": {
    "mapped": [<emit>, ...],
    "count": <number>
  },
  "meta": { "durationMs": <number> },
  "port": "done"
}
```

> `errorPolicy: 'skip' / 'continue'` 시 `output.mapped[i] = { _skipped: true, error }` 형태로 인덱스 보존 — spec §5.2 footnote.

## 분리 제안 — output 에서 빠질 항목의 새 위치

| 기존 output 항목 | 새 위치 | 사유 |
| --- | --- | --- |
| §5.1 의 raw `items[]` 노출 가능성 | handler internal (별도 필드) 또는 spec 표현 명확화 | 외부 expression 노출 금지 (Principle 9.1) |

## Rationale

- 컨테이너의 `output` 은 다운스트림이 보는 값 = 완료 시점 컬렉션 (`mapped`). 시작 시점은 internal.
- 컬렉션 키 분기 (`iterations` / `items` / `mapped` / `branches`) 는 컨테이너 시멘틱 구분 — Loop 는 인덱스 기반, ForEach 는 항목 기반, Map 은 변형, Parallel 은 분기. 동일 키로 통일하면 시멘틱 손실.
- `_skipped: true` 인라인 마커는 인덱스 보존을 위해 유지 (ForEach 는 별도 `output.skipped` 분리 패턴 채택 — 두 노드 시멘틱 차이가 있어 통일 후보로 검토 가능).
