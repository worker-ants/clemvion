# Merge output 개선안

> **최신화 검토 (2026-05-16)**: 현 spec 과 본 plan 의 분석이 정합. silent 실패 가시화 (`skippedKeys`, `dormantFields`) 유지.
> 잔여 권고 항목:
> - `meta.strategy` / `meta.outputFormat` 가 `config.strategy` / `config.outputFormat` 와 의미 중복 (default 폴백 후 같은 값). 호환성 영향 평가 후 제거 검토.

> 대상 spec: `spec/4-nodes/1-logic/11-merge.md` (§5 출력 구조)

## 현재 output (spec 인용)

`spec/4-nodes/1-logic/11-merge.md:104-119`:

```json
{
  "config": { "strategy": "wait_all", "outputFormat": "array" },
  "output": [{ "a": 1 }, { "b": 2 }],
  "meta": {
    "durationMs": 0,
    "inputCount": 2,
    "strategy": "wait_all",
    "outputFormat": "array",
    "skippedKeys": [],
    "dormantFields": []
  }
}
```

§5.1.1 의 outputFormat 별 변형:
- `merge_object` → `output: { a: 1, b: 3, c: 4 }` (객체 shallow merge)
- `indexed` → `output: { in_0: ..., in_1: ... }` (인덱스 키)

## 진단

Merge 는 **데이터 변형 노드** (단계 1개). 여러 입력 → `outputFormat` 에 따라 다른 shape 으로 합침.

| 항목 | 적절성 | 근거 |
| --- | --- | --- |
| `output: unknown[] | object` | 적절 — shape 가변 (output) | spec footnote: "merge 의 본질적 기능". 후속 노드는 `$node["X"].config.outputFormat` 으로 shape 식별 |
| `meta.inputCount` | 적절 (meta) | 실제 병합된 입력 수 |
| `meta.strategy` / `meta.outputFormat` (resolved) | **약간 부적절 — config 와 중복** | `config.strategy` / `config.outputFormat` 와 동일 값. spec footnote: "shape 판별용 분기 키" 라고 정당화하지만, `config` 만으로 충분 |
| `meta.skippedKeys` | 적절 (meta) | `merge_object` 에서 prototype pollution 으로 drop 된 키 진단 (Principle 3 silent failure 해소) |
| `meta.dormantFields` | 적절 (meta) | P1 dormant 처리된 config 필드 (`timeout`, `partialOnTimeout`) 가시화 |
| `meta.durationMs` | 적절 | engine 공통 |
| `config.strategy` / `config.outputFormat` (raw echo) | 적절 | Principle 7. `timeout` / `partialOnTimeout` 은 dormant 라 echo 안 함 (spec §4 step 5) |

핵심 점검:

1. **`meta.strategy` ↔ `config.strategy` 의 의미 중복** — spec footnote: "default 폴백 후 값" 으로 의미 다름이라 주장하나, `config.strategy` echo 가 raw 값이고 default 도 schema 단계에서 적용되므로 사실상 동일. 한쪽 제거 검토 가치 있으나 다운스트림 표현식이 `meta.outputFormat` 을 분기 키로 사용 중일 가능성 → 호환성을 위해 유지.
2. **dormant config 필드 echo 정책** — `timeout` / `partialOnTimeout` 은 raw echo 안 함 (P1 미구현). 그러나 이들이 schema 에 존재한다는 사실이 사용자에게 보이지 않아 혼동 — `meta.dormantFields` 로 보강하는 현 정책이 합리적.
3. **`output` shape 가변성 위험** — 후속 노드 표현식 `$node["X"].output[0]` (array) vs `$node["X"].output.a` (merge_object) 가 다름. spec 이 명시적으로 경고. 본질적 기능이라 변경 불가.

## 개선안 — 정리된 output

현 spec 거의 부합. 미시 보강:

- `meta.strategy` / `meta.outputFormat` 은 `config` 와 중복이므로 제거 검토 — 단 호환성 영향 평가 필요. 제거 시 다운스트림은 `$node["X"].config.outputFormat` 만 사용.

```json
{
  "config": { "strategy": "wait_all" | "first" | "append", "outputFormat": "array" | "merge_object" | "indexed" },
  "output": <array | object — outputFormat 별 shape>,
  "meta": {
    "durationMs": <number>,
    "inputCount": <number>,
    // "strategy": <enum>,           // ⚠ 검토: config 와 중복 — 제거 또는 유지
    // "outputFormat": <enum>,       // ⚠ 검토: config 와 중복 — 제거 또는 유지
    "skippedKeys": [<string>, ...],  // merge_object 한정, 그 외 []
    "dormantFields": [<string>, ...] // P1 dormant ['timeout', 'partialOnTimeout']
  }
}
```

## 분리 제안 — output 에서 빠질 항목의 새 위치

| 기존 output 항목 | 새 위치 | 사유 |
| --- | --- | --- |
| `meta.strategy` (검토) | 제거 또는 `config.strategy` 만 사용 | 중복 |
| `meta.outputFormat` (검토) | 제거 또는 `config.outputFormat` 만 사용 | 중복 |

## Rationale

- output shape 가변성은 merge 의 본질이므로 수정 대상 아님 — `config.outputFormat` 으로 분기 식별.
- `meta.skippedKeys` 와 `meta.dormantFields` 는 silent 실패 가시화 (Principle 3) — 필수.
- `meta.strategy` / `outputFormat` echo 의 의미는 약하나 호환성 영향 있어 본 plan 은 검토 항목으로만 표시 — 결정은 review 단계.
- P1 → P2 활성화 시점에 `MERGE_TIMEOUT` 코드와 함께 `error` 포트가 추가될 가능성 (spec §6 footnote) — 본 plan 은 P1 시점 정의만 다룸.
