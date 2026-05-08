# Spec: Switch

> 관련 문서: [Logic 공통 규약](./0-common.md) · [Spec 노드 개요](../0-overview.md) · [Spec 표현식 언어](../../5-system/5-expression-language.md)

입력 값에 따라 N개의 경로 중 하나로 분기.

---

## 1. 설정 (config)

| 필드 | 타입 | 설명 |
|------|------|------|
| mode | `value` / `expression` | 매칭 모드 |
| switchValue | Expression | 비교할 기준 값 (mode=value) |
| cases | CaseDef[] | 케이스 목록 |
| hasDefault | Boolean | Default 경로 사용 여부 |
| strictComparison | Boolean | 엄격 타입 비교 모드 (기본: false). [표현식 언어 §3.2.1](../../5-system/5-expression-language.md#321-strict-모드) |

**CaseDef 구조:**

| 필드 | 타입 | 설명 |
|------|------|------|
| label | String | 케이스 이름 (포트 라벨) |
| value | any | 매칭 값 (mode=value) |
| condition | ConditionGroup | 조건식 (mode=expression). 구조는 [공통 §1](./0-common.md#1-conditiongroup-구조) |

## 2. 포트
- 입력: `in` (1개)
- 출력: 동적 추가/제거. 각 케이스 포트에 **UUID v4** 기반 ID를 할당한다 (예: `550e8400-e29b-41d4-a716-446655440000`). 포트 ID 불변성은 [공통 §7](./0-common.md#7-포트-id-불변성-동적-포트). `default` 포트는 고정 ID.

## 3. 설정 UI
- 케이스 추가/제거 버튼
- 각 케이스에 라벨과 값/조건 입력
- 케이스 순서 드래그 정렬 (포트 ID는 변경되지 않음)
- Default 토글

## 4. 실행 로직
1. `switchValue` 평가
2. 각 케이스의 값/조건과 순서대로 비교
3. 첫 번째 매칭 케이스의 포트로 출력
4. 매칭 없고 hasDefault=true → `default` 포트로 출력
5. 매칭 없고 hasDefault=false → 에러 (또는 에러 핸들링 정책)
