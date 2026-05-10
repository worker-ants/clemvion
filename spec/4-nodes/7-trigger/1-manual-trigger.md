# Spec: Manual Trigger

> 관련 문서: [Trigger 공통 규약](./0-common.md) · [Spec 노드 개요](../0-overview.md) · [PRD 노드 시스템](../../../prd/3-node-system.md#3-trigger-노드-1종) · [Spec 실행 엔진](../../5-system/4-execution-engine.md)

---

## 1. 개요

| 속성 | 값 |
|------|------|
| type | `manual_trigger` |
| category | `trigger` |
| 표시 이름 | Manual Trigger |
| 아이콘 | ⚡ (Zap) |
| 색상 | `#F59E0B` (앰버) |
| 입력 포트 | 없음 (0개) |
| 출력 포트 | 1개 (`out`) |
| 컨테이너 | 아니오 |

## 2. 역할

- 워크플로우의 **시작 노드**로서, 수동 실행(Run 버튼, API 호출)의 진입점
- 워크플로우당 **정확히 1개** 존재해야 하며 삭제 불가
- 워크플로우 생성 시 **자동 생성**됨 (기본 위치: x=250, y=300)

## 3. 실행 동작

- 워크플로우의 **입력 파라미터 스키마**를 노드 config로 선언
- 실행 진입 시 들어오는 원시 값(`rawParameterValues`)을 스키마 기반으로 **검증 + 기본값 적용 + 타입 강제 변환(coerce)** 후 구조화된 `parameters` 객체로 출력
- 다운스트림 노드는 `{{ $input.parameters.<name> }}` 또는 축약형 `{{ $params.<name> }}`으로 접근
- 파라미터가 정의되지 않은 경우 `parameters = {}`로 처리하여 기존 pass-through 호환
- 실행 시간: 거의 0ms (스키마 검증만 수행)

```
워크플로우 실행 요청 (parameterValues: { name: "test", count: "3" })
  ↓
Manual Trigger Node (parameters schema: name:string, count:number)
  ↓ (output.parameters: { name: "test", count: 3 })
다음 노드 ({{ $params.count }} → 3)
```

## 4. 설정 (Config)

| 키 | 타입 | 설명 |
|----|------|------|
| `parameters` | `TriggerParameterDefinition[]` | 입력 파라미터 스키마 배열 (선택). 스키마 정의는 [Trigger 공통 §1](./0-common.md#1-트리거-진입-파라미터-공통-계약) 참조 |

설정 패널에서는 Label, Notes, Parameters만 편집 가능하다.

## 5. 포트 정의

| 포트 | 방향 | ID | 레이블 | 타입 |
|------|------|-----|--------|------|
| Output | 출력 | `out` | Output | `data` |

## 6. 제약 조건

| 제약 | 설명 |
|------|------|
| 워크플로우당 1개 | 복수의 Manual Trigger 노드를 추가할 수 없음 |
| 삭제 불가 | 캔버스에서 Delete 키 및 컨텍스트 메뉴로 삭제 불가 |
| 입력 연결 불가 | 입력 포트가 없으므로 다른 노드의 출력을 받을 수 없음 |

## 7. 실행 흐름

```
1. 사용자가 Run 버튼 클릭 또는 POST /workflows/:id/execute { parameterValues } API 호출
2. 실행 엔진이 parameterValues + trigger 노드 config를 resolveTriggerParameters() 유틸로 해석
   - required 누락 → 즉시 실행 실패 (INVALID_INPUT)
   - 기본값 적용 + 타입 coerce
3. Execution 레코드 생성 (status: PENDING, inputData: { parameters })
4. 비동기 실행 시작 (status: RUNNING)
5. DAG 구성 및 위상 정렬
6. Manual Trigger 노드가 루트로 실행되어 { parameters } 구조화된 output 출력
7. 연결된 다음 노드들이 $input.parameters / $params로 값 참조
8. 모든 노드 실행 완료 → status: COMPLETED
```
