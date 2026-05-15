# Parallel output 개선안

> **최신화 검토 (2026-05-16)**: 현 spec 의 §5.2 JSON 예시·필드 표에서 `meta` 가 여전히 누락된 상태(2026-05-16 확인). 컨테이너 컨트랙트 (Principle 9) 자체는 정합.
> 잔여 권고 항목:
> - §5.2 (`done` 포트) JSON 예시 + 필드 표에 `meta.durationMs` (engine 공통) + `meta.branches` (= `branches.length`, Container 메트릭 — Principle 2) 보강. 다른 Container 노드 (Loop / ForEach / Map) 와 일관성 확보.

> 대상 spec: `spec/4-nodes/1-logic/10-parallel.md` (§5 출력 구조)

## 현재 output (spec 인용)

`spec/4-nodes/1-logic/10-parallel.md:77-83` — §5.1 시작 (N 분기 fan-out):

```json
{
  "config": { "branchCount": 3, "maxConcurrency": 0, "waitAll": true },
  "output": null,
  "port": ["branch_0", "branch_1", "branch_2"]
}
```

`spec/4-nodes/1-logic/10-parallel.md:95-107` — §5.2 완료 (`done`, 엔진 오버라이트):

```json
{
  "config": { "branchCount": 3, "maxConcurrency": 0, "waitAll": true },
  "output": {
    "branches": [
      { "status": "fulfilled", "value": { "userId": "u-1", "step": "validate", "ok": true } },
      { "status": "fulfilled", "value": { "userId": "u-1", "step": "enrich", "ok": true } },
      { "status": "rejected",  "error": { "code": "Error", "message": "notify failed" } }
    ]
  },
  "port": "done"
}
```

## 진단

Parallel 은 **컨테이너** (병렬 fan-out). 단계 2개. Loop 와 같이 `output: null` → engine override 컨트랙트 채택.

| 단계 | 시점 output | 적절성 |
| --- | --- | --- |
| 시작 (N 분기 fan-out) | `output: null`, `port: string[]` | 적절 — Principle 9.1 + Principle 5 fan-out |
| 반복 중 | (각 분기 서브그래프가 자체 output) | 적절 |
| 완료 (`done`) | `output: { branches: BranchResult[] }`, `port: 'done'` | 적절 — `Promise.allSettled` 모델 |

| 필드 | 적절성 | 근거 |
| --- | --- | --- |
| `output.branches[i].status: 'fulfilled' | 'rejected'` | 적절 (output) | 분기 종료 상태 — 비즈니스 데이터 |
| `output.branches[i].value` (fulfilled 시) | 적절 | 분기 terminal 노드 출력 |
| `output.branches[i].error: {code, message}` (rejected 시) | 적절 | `errorPolicy='continue'` 모드의 실패 분기 정보 |
| `meta` | spec §5.2 에 명시 없음 (생략?) | 미흡 — `meta.durationMs` / `meta.branches` 카운트 등이 없음 |
| `config.*` (raw echo) | 적절 | Principle 7 |
| `port: string[] → 'done'` | 적절 | 단계 전이 |

추가 점검:

1. **`output.count` 제거됨** — spec §5.2 명시: "P1.1 직교성 — `branches.length` 가 SSOT". 적절 (Principle 1.1 직교).
2. **`meta` 누락** — §5.2 JSON 예시에 `meta` 필드가 없음. CONVENTIONS Principle 2 에 따라 최소한 `meta.durationMs` 와 `meta.branches` (Container 메트릭) 가 채워져야 함. spec 보강 필요.
3. **dead field `waitAll`** — schema 에 노출되지만 P1 에서 항상 `true` 로 동작. spec §1 미구현 마킹. raw echo 는 유지하나 사용자 혼동 우려 — schema 단계 제거 또는 reject 가 [개선안 logic/parallel.md §3](../../../plan/complete/archive/from-user-memo/node-specs-improvement/logic/parallel.md#3-제안된-output-구조) 에서 제안. 본 plan 은 spec 본문에 dead field 경고가 잘 명시되어 있어 변경 없음.
4. **`errorPolicy` config 누출 미흡** — schema 에 노출되지 않았다고 §1 미구현 마킹 — config echo 도 안 됨. P1 schema 노출 시 plan 갱신.

## 개선안 — 정리된 output

**시작 단계:**
```json
{
  "config": { "branchCount": <number raw>, "maxConcurrency": <number raw>, "waitAll": <boolean raw> },
  "output": null,
  "port": ["branch_0", ..., "branch_{N-1}"]
}
```

**완료 단계 (엔진 오버라이트, `meta` 보강 권장):**
```json
{
  "config": { "branchCount": <raw>, "maxConcurrency": <raw>, "waitAll": <raw> },
  "output": {
    "branches": [
      { "status": "fulfilled", "value": <unknown> } | { "status": "rejected", "error": { "code": ..., "message": ... } },
      ...
    ]
  },
  "meta": {                                           // ⚠ 현 spec 에 누락 — 보강 필요
    "durationMs": <number>,
    "branches": <number>,                             // = branches.length, Container 메트릭 (Principle 2)
    "fulfilledCount"?: <number>,                      // 진단용
    "rejectedCount"?: <number>                        // 진단용 (errorPolicy='continue' 시)
  },
  "port": "done"
}
```

## 분리 제안 — output 에서 빠질 항목의 새 위치

| 기존 output 항목 | 새 위치 | 사유 |
| --- | --- | --- |
| (없음 — 현재 output 은 정리되어 있음) | — | |

## Rationale

- 컨테이너 컨트랙트 (`output: null` → 컬렉션 키 오버라이트) 가 일관성 있게 적용됨.
- `Promise.allSettled` 모델 (`{status, value | error}`) 은 분기별 독립 결과를 명확히 표현 — `errorPolicy='stop'` 에서는 첫 실패 시 즉시 throw 되므로 `branches[i]` 가 모두 fulfilled, `errorPolicy='continue'` 에서만 rejected 가 관찰됨.
- 컬렉션 키 = `branches` 로 Loop/ForEach/Map 과 시멘틱 구분 (병렬 분기 vs 반복).
- **`meta` 보강**: spec §5.2 의 JSON 예시에 `meta` 가 빠져 있어 다른 컨테이너 노드 (`Loop`, `ForEach`, `Map`) 와 일관성이 떨어짐. 최소한 `meta.durationMs` 와 `meta.branches` 권장.
