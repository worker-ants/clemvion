# Spec: Merge

> 관련 문서: [Logic 공통 규약](./0-common.md) · [Spec 노드 개요](../0-overview.md)

여러 입력 경로의 데이터를 하나로 합침.

> **P1 참고**: `timeout`과 `partialOnTimeout` 필드는 스키마에 존재하지만 P1에서는 동작하지 않는다(설정 시 경고 로그만 출력). 실제 타임아웃 기능은 P2에서 활성화 예정.

---

## 1. 설정 (config)

| 필드 | 타입 | 설명 |
|------|------|------|
| strategy | Enum | 병합 전략 (기본: `wait_all`) |
| outputFormat | Enum | 출력 형식 (기본: `array`) |
| timeout | Integer | 입력 대기 타임아웃 (초 단위, 기본: 300). `0 = no timeout` (무제한 대기). **P1에서는 미동작 (경고 로그만 출력)** |
| partialOnTimeout | Boolean | 타임아웃 시 부분 병합 수행 여부 (기본: false). true 시 도착한 입력만으로 병합 수행. false 시 에러 처리 정책에 따름 (`MERGE_TIMEOUT` 에러). `timeout = 0`인 경우 적용되지 않음. **P1에서는 미동작** |

**병합 전략:**

| 전략 | 설명 |
|------|------|
| `wait_all` | 모든 입력이 도착할 때까지 대기 후 합침 |
| `first` | 가장 먼저 도착한 입력만 통과 |
| `append` | 도착 순서대로 배열에 추가, 모든 입력 도착 후 출력 |

**출력 형식:**

| 형식 | 설명 |
|------|------|
| `array` | 각 입력을 배열 요소로 합침 `[input0, input1, ...]` |
| `merge_object` | 객체를 shallow merge `{...input0, ...input1}` |
| `indexed` | 인덱스 키로 합침 `{ "in_0": input0, "in_1": input1 }` |

## 2. 포트
- 입력: `in` (1개, 다중 엣지 수신 가능)
- 출력: `out` (1개)
