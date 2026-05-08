# Spec: Variable Modification

> 관련 문서: [Logic 공통 규약](./0-common.md) · [Spec 노드 개요](../0-overview.md)

이전에 선언된 변수의 값 수정.

---

## 1. 설정 (config)

| 필드 | 타입 | 설명 |
|------|------|------|
| modifications | ModDef[] | 수정 목록 |

**ModDef 구조:**

| 필드 | 타입 | 설명 |
|------|------|------|
| variable | String | 대상 변수 이름 |
| operation | Enum | 수정 연산 |
| value | Expression | 새 값 또는 연산에 사용할 값 |

**지원 연산:**

| 연산 | 적용 타입 | 설명 |
|------|-----------|------|
| `set` | 모든 타입 | 값 덮어쓰기 |
| `increment` | number | 값 증가 |
| `decrement` | number | 값 감소 |
| `append` | string | 문자열 뒤에 추가 |
| `push` | array | 배열 끝에 요소 추가 |
| `pop` | array | 배열 끝 요소 제거 |
| `set_field` | object | 객체 필드 설정 (value = {field, val}) |
| `delete_field` | object | 객체 필드 제거 |

## 2. 포트
- 입력: `in` (1개)
- 출력: `out` (1개)

## 3. 실행 로직
1. 대상 변수 존재 확인 (없으면 에러)
2. 연산 수행
3. 입력 데이터를 그대로 `out` 포트로 전달
