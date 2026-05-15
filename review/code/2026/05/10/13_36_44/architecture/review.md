### 발견사항

---

**[WARNING] `WorkflowExecutor` 인터페이스와 핸들러 간 암묵적 문자열 계약**
- 위치: `workflow.handler.ts:194–218` (`mapSubWorkflowError`)
- 상세: `WorkflowExecutor` 인터페이스는 어떤 에러를 throw할 수 있는지 타입으로 명시하지 않는다. 핸들러는 executor의 구현 세부사항(영어 에러 메시지 문자열)에 의존하여 에러 코드를 분류한다. executor 구현체가 메시지를 변경하거나, 새 구현체가 다른 메시지를 사용하거나, 다국어 메시지를 사용하면 `mapSubWorkflowError`가 항상 `SUB_WORKFLOW_FAILED`로 폴백하고 버그가 **무음(silent)**으로 발생한다. 코드 주석이 이를 임시 방편으로 명시하고 있으나 구조적 에러 타입으로의 마이그레이션 경로가 정의되어 있지 않다.
- 제안: `WorkflowExecutor` 인터페이스에 구조적 에러 타입(`WorkflowNotFoundError`, `WorkflowTimeoutError` 등)을 정의하고, `mapSubWorkflowError` 대신 `instanceof` 분기를 사용한다. 혹은 최소한 `WorkflowExecutor` 인터페이스 JSDoc에 각 메서드가 throw할 수 있는 에러 메시지 패턴을 계약으로 문서화한다.

---

**[WARNING] 테스트를 위한 내부 함수 export (Test-Induced Design)**
- 위치: `workflow.handler.ts:193`, `workflow.handler.spec.ts:495–538`
- 상세: `mapSubWorkflowError`는 "Exported for unit testing"이라는 주석과 함께 핸들러 모듈에서 export된다. 이는 클래스 모듈의 경계를 테스트 관심사로 오염시키는 anti-pattern이다. 순수 유틸리티 함수가 테스트를 위해 export되어야 한다면, 그 함수는 독립 모듈로 분리될 필요가 있다는 신호이다.
- 제안: `workflow-error-mapper.ts` 등 별도 모듈로 분리한다. 이렇게 하면 OCP도 개선되고(`WorkflowHandler`를 수정하지 않고 매핑 규칙 변경 가능), 테스트 export 문제도 해소된다.

---

**[WARNING] `mapSubWorkflowError`의 OCP 위반**
- 위치: `workflow.handler.ts:204–216`
- 상세: `if/else` 체인은 새로운 에러 유형이 추가될 때마다 함수를 직접 수정해야 한다(OCP 위반). 현재 3개 패턴이지만, 새 executor 에러 케이스가 추가되면 이 함수가 계속 수정된다.
- 제안: 우선순위 순서의 디스패치 테이블로 교체한다:
  ```typescript
  const MAPPINGS: Array<{ test: (m: string) => boolean; code: ErrorCodeValue }> = [
    { test: m => m.includes('workflow not found'), code: ErrorCode.SUB_WORKFLOW_NOT_FOUND },
    { test: m => m.includes('timed out') || m.includes('timeout'), code: ErrorCode.SUB_WORKFLOW_TIMEOUT },
    { test: m => m.includes('queue') && /failed|enqueue|reject/.test(m), code: ErrorCode.SUB_WORKFLOW_QUEUE_FAILED },
  ];
  ```
  새 패턴 추가 시 함수 로직을 건드리지 않고 테이블에 항목만 추가한다.

---

**[INFO] 스키마-핸들러 드리프트: `meta.status` 필드 잔재**
- 위치: `workflow.schema.ts:57–62` (`workflowNodeOutputSchema`)
- 상세: async 핸들러가 `meta.status: 'started'`에서 top-level `status: 'started'`로 이동했음에도, `workflowNodeOutputSchema`의 `meta` 스키마에는 여전히 `status: z.string().optional()`이 선언되어 있다. `passthrough()`로 인해 런타임 에러는 발생하지 않지만, 스키마가 더 이상 실제 핸들러 출력을 반영하지 않아 스키마를 문서로 신뢰하는 소비자를 오도한다.
- 제안: `meta` 스키마에서 `status` 필드를 제거하거나, `meta` 자체를 async 케이스에서 방출되지 않음을 명확히 한다.

---

**[INFO] `output.result.result` 이중 중첩 위험**
- 위치: `spec/4-nodes/2-flow/1-workflow.md:115–120`, `workflow.handler.ts:137–142`
- 상세: D-1 래핑(`output: { result: inlineResult }`)은 서브 워크플로우의 최종 출력에 `result` 키가 있을 경우 `output.result.result`라는 이중 중첩을 만든다. 스펙 예시 자체가 이를 보여준다(`{ result: { result: "success", data: [...] } }`). `output`이 `z.unknown()`이라 스키마 차원의 경고도 없다.
- 제안: 래핑 키를 보다 충돌 가능성이 낮은 이름(예: `$output`, `subResult`, `value`)으로 변경하거나, 이 충돌 케이스를 스펙과 문서에 명시적으로 경고로 추가한다. 현 상태라면 적어도 표현식 접근 예시에 이중 중첩 케이스를 명시해야 한다.

---

**[INFO] `ErrorCode` 단일 전역 객체의 확장성**
- 위치: `error-codes.ts`
- 상세: 모든 노드 카테고리의 에러 코드가 단일 `ErrorCode` 객체에 누적되고 있다. 이번에 3개, 이전 DB 작업에서 3개가 추가되었다. 시스템이 커질수록 이 파일이 변경 빈도가 높은 God Object가 될 위험이 있다.
- 제안: 단기적으로는 현 구조를 유지해도 무방하나, 중기적으로 `workflow-error-codes.ts`, `db-error-codes.ts` 등 도메인별로 분리하고 `error-codes.ts`에서 re-export하는 구조를 고려한다.

---

### 요약

이번 변경은 sub-workflow 에러 코드 세분화(A-3), async 출력 구조 보강(A-2), sync 결과 1단 래핑(D-1), 스키마-핸들러 키 불일치 해소라는 4가지 목표를 달성하였고, 순환 의존성 없이 레이어 책임도 적절히 분리되어 있다. 주요 아키텍처 우려사항은 `mapSubWorkflowError`가 `WorkflowExecutor` 구현체의 영어 문자열 메시지에 암묵적으로 의존한다는 점으로, 코드 주석이 이를 임시 방편으로 인정하고 있으나 구조적 에러 타입으로의 마이그레이션 계획이 없다. 이 함수를 핸들러 모듈에서 분리하면 테스트 export 문제와 OCP 위반, 암묵적 계약 문제를 동시에 개선할 수 있다.

### 위험도

**LOW** — 현재 단일 executor 구현체 환경에서는 실질적 위험이 낮으나, executor가 교체되거나 메시지가 변경될 경우 에러 분류가 무음으로 오동작할 수 있다.