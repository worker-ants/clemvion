# Spec: Loop

> 관련 문서: [Logic 공통 규약](./0-common.md) · [Spec 노드 개요](../0-overview.md) · [Spec 실행 엔진](../../5-system/4-execution-engine.md)

지정된 횟수만큼 내부 노드 그룹을 반복 실행. **컨테이너 노드** — 패턴은 [공통 §3](./0-common.md#3-컨테이너-노드-패턴-loop--map--foreach) 참조.

---

## 1. 설정 (config)

| 필드 | 타입 | 설명 |
|------|------|------|
| count | Expression | 반복 횟수 (정수 또는 표현식) |
| maxIterations | Integer | 최대 반복 제한 (기본: 1000). [공통 §6](./0-common.md#6-리소스-제한) |
| breakCondition | ConditionGroup? | Break 조건 (선택). 구조는 [공통 §1](./0-common.md#1-conditiongroup-구조) |

## 2. 포트
- 입력: `in` (외부 데이터 진입), `emit` (body 서브그래프에서 수집 지점)
- 출력: `body` (반복 본문 → 하위 노드로), `done` (반복 완료 후)

## 3. 실행 컨텍스트 변수
- `$loop.index`: 현재 반복 인덱스 (0부터)
- `$loop.count`: 총 반복 횟수
- `$loop.isFirst`: 첫 번째 반복 여부
- `$loop.isLast`: 마지막 반복 여부

## 4. 실행 로직
1. `count` 평가.
2. `body` 포트에 연결된 노드 그룹을 count 횟수만큼 반복.
3. 매 반복마다 `$loop.*`를 바인딩하고 body를 토폴로지 순서로 실행.
4. 각 반복의 `emit` 포트에 연결된 body 노드 출력을 결과 배열로 수집.
5. `breakCondition` 충족 시 조기 종료.
6. `maxIterations` 초과 시 에러.
7. 반복 완료 후 **`{ iterations: [...], count: N }`** 를 `done` 포트로 전달 ([공통 §5](./0-common.md#5-반복분기-출력-구조-conventions-92)).

## 5. 출력 구조

```json
{
  "config": { "count": 3, "maxIterations": 100 },
  "output": {
    "iterations": [ /* 각 반복의 emit 출력 */ ],
    "count": 3
  }
}
```

다운스트림은 `$node["Loop"].output.iterations[i]` 로 개별 결과에, `$node["Loop"].output.count` 로 실행된 반복 수에 접근한다.

## 6. 제약 / 컨테이너 렌더링

[공통 §3 컨테이너 노드 패턴](./0-common.md#3-컨테이너-노드-패턴-loop--map--foreach) 참조. 실행 시각화는 헤더에 현재 반복 인덱스를 표시한다 (예: "Iteration 3/10").
