# Spec: If/Else

> 관련 문서: [Logic 공통 규약](./0-common.md) · [Spec 노드 개요](../0-overview.md) · [Spec 표현식 언어](../../5-system/5-expression-language.md)

조건식을 평가하여 True/False 분기.

---

## 1. 설정 (config)

| 필드 | 타입 | 설명 |
|------|------|------|
| conditions | ConditionGroup[] | 조건 그룹 목록. 구조는 [공통 §1](./0-common.md#1-conditiongroup-구조) |
| combineMode | `and` / `or` | 조건 그룹 간 결합 방식 |
| strictComparison | Boolean | 엄격 타입 비교 모드 (기본: false). [표현식 언어 §3.2.1](../../5-system/5-expression-language.md#321-strict-모드) |

지원 연산자는 [공통 §2](./0-common.md#2-지원-연산자) 참조.

## 2. 설정 UI

```
┌──────────────────────────────────────┐
│  Conditions (AND ▼)                  │
│                                      │
│  ┌──────────────────────────────────┐│
│  │ {{ $input.role }} [equals ▼]    ││
│  │ "admin"                     [×] ││
│  └──────────────────────────────────┘│
│  ┌──────────────────────────────────┐│
│  │ {{ $input.age }}  [greater ▼]   ││
│  │ 18                          [×] ││
│  └──────────────────────────────────┘│
│                                      │
│  [+ Add Condition]                   │
└──────────────────────────────────────┘
```

## 3. 포트
- 입력: `in` (1개)
- 출력: `true` (조건 만족), `false` (조건 불만족)

## 4. 실행 로직
1. `input` 데이터에 대해 모든 조건 평가
2. combineMode에 따라 AND/OR 결합
3. 결과가 true → `true` 포트로 출력, false → `false` 포트로 출력
4. 입력 데이터는 변형 없이 해당 포트로 전달 (pass-through)
