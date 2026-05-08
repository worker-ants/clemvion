# Spec: Filter

> 관련 문서: [Logic 공통 규약](./0-common.md) · [Spec 노드 개요](../0-overview.md) · [Transform 노드](../5-data/1-transform.md) · [Spec 표현식 언어](../../5-system/5-expression-language.md)

배열에서 조건에 맞는 항목만 추출하여 출력한다. 조건에 맞지 않는 항목은 별도 포트로 출력한다.

> **Transform `array_filter`와의 차이**: [Transform 노드](../5-data/1-transform.md) 의 `array_filter`는 변환 체인 내에서 특정 필드의 배열을 간단한 조건식으로 필터링하는 인라인 연산이다. Filter 노드는 워크플로우 흐름 상의 독립 노드로, 다중 조건(ConditionGroup)과 조건 결합(AND/OR)을 지원하며, 매칭/비매칭 항목을 각각 별도 포트로 분기한다.

---

## 1. 설정 (config)

| 필드 | 타입 | 설명 |
|------|------|------|
| inputField | Expression | 대상 배열 필드 경로 (예: `$input.items`) |
| conditions | ConditionGroup[] | 필터 조건 목록. 구조는 [공통 §1](./0-common.md#1-conditiongroup-구조). 단, 조건 내 `field` 표현식에서 `$item`으로 현재 배열 항목을 참조한다 |
| combineMode | `and` / `or` | 조건 간 결합 방식 (기본: `and`) |
| strictComparison | Boolean | 엄격 타입 비교 모드 (기본: false). [표현식 언어 §3.2.1](../../5-system/5-expression-language.md#321-strict-모드) |

지원 연산자는 [공통 §2](./0-common.md#2-지원-연산자) 참조.

## 2. 설정 UI

```
┌──────────────────────────────────────┐
│  Array Field                         │
│  [$input.items___________________]   │
│                                      │
│  Conditions (AND ▼)                  │
│                                      │
│  ┌──────────────────────────────────┐│
│  │ {{ $item.status }} [equals ▼]   ││
│  │ "active"                    [×] ││
│  └──────────────────────────────────┘│
│  ┌──────────────────────────────────┐│
│  │ {{ $item.age }}  [greater ▼]    ││
│  │ 18                          [×] ││
│  └──────────────────────────────────┘│
│                                      │
│  [+ Add Condition]                   │
│                                      │
│  ☐ Strict type comparison            │
└──────────────────────────────────────┘
```

## 3. 포트
- 입력: `in` (1개)
- 출력: `match` (조건 만족 항목 배열), `unmatched` (조건 불만족 항목 배열)

## 4. 실행 컨텍스트 변수
- `$item`: 현재 평가 중인 배열 항목 (ForEach, Map과 동일 패턴)

## 5. 실행 로직
1. `inputField`로 배열 추출. **dot-path 문자열**(`"items"`, `"order.items"`)이면 `$input`에 적용하고, `{{ $var.a }}`처럼 **inline 표현식**이면 expression resolver가 값 자체를 치환하므로 그 값을 그대로 사용 (Split/ForEach와 동일 규칙).
2. 배열이 아니면 에러
3. 각 항목에 대해 `$item`을 바인딩하고 모든 조건 평가
4. combineMode에 따라 AND/OR 결합하여 최종 매칭 여부 결정
5. 매칭된 항목을 배열로 수집하여 `match` 포트로 출력
6. 매칭되지 않은 항목을 배열로 수집하여 `unmatched` 포트로 출력
7. 빈 배열도 정상 출력 (에러 아님)
