# Spec: Trigger 노드

> 관련 문서: [PRD 노드 시스템](../../prd/3-node-system.md#3-trigger-노드) · [Spec 노드 개요](./0-overview.md) · [Spec 노드 공통](../3-workflow-editor/1-node-common.md) · [Spec 실행 엔진](../5-system/4-execution-engine.md)

---

## 1. Manual Trigger

### 1.1 개요

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

### 1.2 역할

- 워크플로우의 **시작 노드**로서, 수동 실행(Run 버튼, API 호출)의 진입점
- 워크플로우당 **정확히 1개** 존재해야 하며 삭제 불가
- 워크플로우 생성 시 **자동 생성**됨 (기본 위치: x=250, y=300)

### 1.3 실행 동작

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

### 1.4 설정 (Config)

| 키 | 타입 | 설명 |
|----|------|------|
| `parameters` | `TriggerParameterDefinition[]` | 입력 파라미터 스키마 배열 (선택) |

**TriggerParameterDefinition**:

```typescript
interface TriggerParameterDefinition {
  name: string;                                         // 고유 식별자 (영문/숫자/_)
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  required?: boolean;                                   // 기본 false
  defaultValue?: unknown;                               // required=false일 때만 의미 있음
  description?: string;                                 // UI 힌트
}
```

- `name`은 워크플로우의 trigger 노드 내에서 유일해야 한다 (중복 시 validate 실패)
- 빈 배열 또는 미정의 시 파라미터 기능 비활성 (기존 동작과 호환)
- 설정 패널에서는 Label, Notes, Parameters만 편집 가능

### 1.5 포트 정의

| 포트 | 방향 | ID | 레이블 | 타입 |
|------|------|-----|--------|------|
| Output | 출력 | `out` | Output | `data` |

### 1.6 제약 조건

| 제약 | 설명 |
|------|------|
| 워크플로우당 1개 | 복수의 Manual Trigger 노드를 추가할 수 없음 |
| 삭제 불가 | 캔버스에서 Delete 키 및 컨텍스트 메뉴로 삭제 불가 |
| 입력 연결 불가 | 입력 포트가 없으므로 다른 노드의 출력을 받을 수 없음 |

### 1.7 실행 흐름

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

---

## 2. 트리거 진입 파라미터 공통 계약

Manual, Webhook, Schedule 세 가지 트리거는 모두 **동일한 파라미터 스키마**(Manual Trigger 노드의 `config.parameters`)를 단일 소스로 사용한다. 차이는 값의 **수집 방식**뿐이다.

| 트리거 | 값 수집 방식 | 실행 실패 시점 |
|--------|--------------|---------------|
| Manual | Run 대화상자 폼 또는 `POST /workflows/:id/execute { parameterValues }` | Execution 생성 전 400 응답 또는 RUNNING 진입 즉시 실패 |
| Webhook | HTTP POST `body`에서 **동일 이름 최상위 키** 추출 | HooksService가 `400 Bad Request`로 요청 거부 (Execution 생성되지 않음) |
| Schedule | `schedule.parameterValues` 저장값 → 제한 표현식 컨텍스트(`$now`, `$schedule`)로 resolve | 스케줄 등록/수정 시 DTO 검증, 런타임은 default 채움 |

최종적으로 워크플로우 실행 엔진에는 항상 `{ parameters: Record<string, unknown>, ... }` 형태의 input이 전달된다.

- Webhook: `$input = { parameters, body, headers, query, method }`
- Schedule/Manual: `$input = { parameters }`
- 축약형: `$params === $input.parameters`

---

## 3. 캔버스 요약

| 노드 | 요약 포맷 | 예시 |
|------|-----------|------|
| Manual Trigger | 파라미터 개수 | `Parameters: 2` 또는 `(none)` |
