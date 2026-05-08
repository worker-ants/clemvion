# Spec: Parallel

> 관련 문서: [Logic 공통 규약](./0-common.md) · [Spec 노드 개요](../0-overview.md) · [Spec 실행 엔진](../../5-system/4-execution-engine.md)

여러 분기를 동시에(병렬로) 실행.

> **🚧 P1 구현 상태**: `PARALLEL_ENGINE=v1` 환경변수로 활성화 시 `ParallelExecutor`가 `p-limit` + `Promise.allSettled`로 분기를 동시 실행한다. 기본값(`off`)이면 기존 순차 동작을 유지한다.

---

## 1. 설정 (config)

| 필드 | 타입 | 설명 |
|------|------|------|
| branchCount | Integer | 분기 수 (출력 포트 수). 2~16 범위. |
| maxConcurrency | Integer | 동시 실행 제한. `0` = 무제한(전체 동시), `1`~`16` = 해당 수만큼 동시 실행. 기본 `0`. [공통 §6](./0-common.md#6-리소스-제한) |
| waitAll | Boolean | 모든 분기 완료를 기다릴지. **P1에서는 항상 `true`로 동작한다.** `false`는 P2에서 지원 예정. |

## 2. 포트
- 입력: `in` (1개)
- 출력: `branch_0`, `branch_1`, ... (동적, branchCount에 따름)

## 3. 실행 로직
1. 입력 데이터를 모든 분기에 복제 전달
2. `PARALLEL_ENGINE=v1`이면 `ParallelExecutor`가 `p-limit(maxConcurrency)`으로 동시 실행 수를 제한하면서 `Promise.allSettled`로 모든 분기를 병렬 실행. `off`이면 기존 순차 실행.
3. maxConcurrency > 0이면 해당 수만큼만 동시 실행, 0이면 전체 동시 실행
4. waitAll=true → 모든 분기 완료 후 **`{ branches: [...], count: N }`** 를 `done` 포트로 전달 ([공통 §5](./0-common.md#5-반복분기-출력-구조-conventions-92))
5. waitAll=false → 각 분기 독립적으로 완료 시 다음 노드 진행 (**P2 예정**)

## 4. 출력 구조 (`done` 포트)

```json
{
  "config": { "branchCount": 3, "maxConcurrency": 0, "waitAll": true },
  "output": {
    "branches": [ /* 각 분기의 마지막 노드 출력 */ ],
    "count": 3
  }
}
```

다운스트림은 `$node["Parallel"].output.branches[i]` 로 개별 분기 결과에 접근한다.

## 5. 제약 (P1)
- 분기 내 **블로킹 노드**(form / buttons / ai_conversation) 금지
- 분기 내 **back-edge**(순환) 금지
- **중첩 Parallel** 금지 (P2 예정)
