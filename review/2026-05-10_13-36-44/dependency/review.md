## 의존성 리뷰

### 발견사항

- **[INFO] 외부 패키지 추가 없음**
  - 위치: 전체 변경사항
  - 상세: `package.json` / lock 파일 변경 없음. 모든 새 import는 프로젝트 내부 모듈 (`error-codes.ts`, `workflow-executor.interface.ts` 등) 이며, 기존 `zod` 의존성도 schema에서 이미 사용 중.
  - 제안: 해당 없음.

---

- **[WARNING] `mapSubWorkflowError` 테스트 목적 public export**
  - 위치: `workflow.handler.ts:192` — `export function mapSubWorkflowError`
  - 상세: JSDoc 주석에 "Exported for unit testing"이라고 명시되어 있으나, 모듈 public API를 테스트 편의를 위해 확장하는 패턴이다. 이 함수가 외부 모듈에서 import될 경우 내부 구현 세부사항이 public contract가 되어, 추후 리팩토링 시 breaking change를 유발할 수 있다.
  - 제안: barrel/index 파일에서 이 함수를 재-export하지 않고 내부용으로 관리하거나, `// @internal` JSDoc 태그를 추가해 의도를 명시. 또는 executor가 structured error type을 노출하는 시점에 함수를 private으로 되돌리는 TODO를 코드에 남기는 것을 권장.

---

- **[WARNING] executor 에러 메시지 문자열에 대한 암묵적 의존**
  - 위치: `workflow.handler.ts:200~218` — `mapSubWorkflowError` 패턴 매칭 로직
  - 상세: `WorkflowExecutor` 인터페이스(`workflow-executor.interface.ts`)는 구조화된 에러 타입을 정의하지 않으며, 현재 구현은 executor가 던지는 `Error.message` 문자열을 패턴 매칭한다. 이 의존은 타입 시스템이 보호하지 않아 executor가 메시지 포맷을 변경하면 잘못된 에러 코드가 조용히 반환되는 회귀가 발생한다.
    ```typescript
    // executor가 "Cannot locate workflow: X" 로 메시지를 바꾸면
    // SUB_WORKFLOW_FAILED로 폴백 — SUB_WORKFLOW_NOT_FOUND 매핑 실패
    if (lower.includes('workflow not found')) { ... }
    ```
  - 제안: `WorkflowExecutor` 인터페이스에 구조화된 에러 클래스(`WorkflowNotFoundError` 등) 또는 `errorCode` 필드를 추가하는 것이 장기 해법. 단기적으로는 executor 에러 메시지 포맷을 상수로 정의하거나, 통합 테스트에서 실제 executor와 연동하여 매핑 정확성을 검증하는 것을 권장.

---

- **[INFO] `workflow.handler.ts` → `error-codes.ts` 신규 내부 의존 추가**
  - 위치: `workflow.handler.ts:8` — `import { ErrorCode, ErrorCodeValue } from '../../core/error-codes.js'`
  - 상세: 기존에는 `'SUB_WORKFLOW_FAILED'` 문자열 리터럴을 직접 사용했으나 이제 `ErrorCode` enum을 통해 참조. `error-codes.ts`는 leaf 모듈(다른 내부 모듈을 import하지 않음)이므로 순환 의존 위험 없음. 타입 안전성이 향상된 변경.
  - 제안: 해당 없음.

---

- **[INFO] `workflowNodeOutputSchema`에 `meta.status` 필드 잔존**
  - 위치: `workflow.schema.ts` — `workflowNodeOutputSchema.meta.status`
  - 상세: 구현은 `meta.status` → top-level `status`로 이동했으나, 스키마의 `meta` 객체에 `status` 필드가 여전히 정의되어 있다. 스키마가 실제 런타임 출력보다 넓게 허용하므로 breaking change는 아니나, 스키마가 더 이상 사용되지 않는 필드를 허용하는 상태.
  - 제안: `workflowNodeOutputSchema`에서 `meta.status` 제거 검토. 단, 기존 저장된 execution 결과 파싱 호환성 필요 시 `@deprecated` 주석 추가.

---

### 요약

이번 변경은 외부 패키지를 전혀 추가하지 않으며, 핵심 의존성 변경은 내부 `error-codes.ts` 모듈에 대한 신규 import 하나로 적절한 중앙화다. 가장 주목할 의존성 위험은 `WorkflowExecutor`가 구조화된 에러 타입 없이 문자열 메시지만 던지는 현재 설계에서 비롯된 **암묵적 문자열 패턴 의존**이며, 이는 코드 주석에서도 인지한 기술 부채다. `mapSubWorkflowError` public export는 내부 구현을 API surface에 노출하는 패턴으로, executor가 structured error를 지원하는 시점에 private으로 되돌려야 한다.

### 위험도

**LOW**