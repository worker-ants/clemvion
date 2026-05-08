# Spec: Variable Declaration

> 관련 문서: [Logic 공통 규약](./0-common.md) · [Spec 노드 개요](../0-overview.md)

워크플로우 실행 컨텍스트에 변수 선언.

---

## 1. 설정 (config)

| 필드 | 타입 | 설명 |
|------|------|------|
| variables | VarDef[] | 선언할 변수 목록 |

**VarDef 구조:**

| 필드 | 타입 | 설명 |
|------|------|------|
| name | String | 변수 이름 (영문, _, 숫자) |
| type | Enum | string / number / boolean / array / object |
| defaultValue | any | 초기값 (표현식 가능) |

## 2. 포트
- 입력: `in` (1개)
- 출력: `out` (1개)

## 3. 실행 로직
1. 각 변수를 실행 컨텍스트에 등록
2. 초기값 설정
3. 입력 데이터를 그대로 `out` 포트로 전달 (pass-through)
4. 이후 노드에서 `{{ $var.variableName }}`으로 참조
