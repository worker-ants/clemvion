# Spec: Trigger 노드 공통 규약

> 관련 문서: [PRD 노드 시스템](../../../prd/3-node-system.md#3-trigger-노드-1종) · [Spec 노드 개요](../0-overview.md) · [Spec 노드 공통](../../3-workflow-editor/1-node-common.md) · [Spec 실행 엔진](../../5-system/4-execution-engine.md)

본 문서는 Trigger 카테고리 노드 전체에 공통되는 규약을 정의한다. 노드별 동작·설정은 각 노드 문서를 참조한다.

- [Manual Trigger](./1-manual-trigger.md)

---

## 1. 트리거 진입 파라미터 공통 계약

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

### TriggerParameterDefinition 스키마

```typescript
interface TriggerParameterDefinition {
  name: string;                                         // 고유 식별자 (영문/숫자/_)
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  required?: boolean;                                   // 기본 false
  defaultValue?: unknown;                               // required=false일 때만 의미 있음
  description?: string;                                 // UI 힌트
}
```

- `name`은 트리거 노드 내에서 유일해야 한다 (중복 시 validate 실패)
- 빈 배열 또는 미정의 시 파라미터 기능 비활성 (기존 동작과 호환)

---

## 2. 캔버스 요약

| 노드 | 요약 포맷 | 예시 |
|------|-----------|------|
| Manual Trigger | 파라미터 개수 | `Parameters: 2` 또는 `(none)` |
