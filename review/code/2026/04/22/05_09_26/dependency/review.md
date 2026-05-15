## 발견사항

### [INFO] 외부 패키지 추가 없음
- **위치**: 전체 변경사항
- **상세**: 이번 변경은 새 외부 npm 패키지를 전혀 추가하지 않음. 신규 파일 `active-plan-context.ts`는 프로젝트 내부 타입(`workflow-assistant-message.entity`)만 참조.
- **제안**: 현 상태 유지.

### [INFO] `system-prompt.ts`의 `ActivePlanContext` import — `import type` 으로 전환 권장
- **위치**: `system-prompt.ts:4`
  ```ts
  import { ActivePlanContext } from '../tools/active-plan-context';
  ```
- **상세**: `system-prompt.ts`는 `ActivePlanContext`를 타입 어노테이션으로만 사용하고, 런타임 로직(`findActivePlanContext`)은 호출하지 않음. `import type`으로 명시하면 번들러(esbuild/tsc)가 타입 전용 import임을 확신하고 트리쉐이킹 힌트를 더 명확히 제공함.
- **제안**:
  ```ts
  import type { ActivePlanContext } from '../tools/active-plan-context';
  ```

### [INFO] `deriveStatus`의 `forceCleared` 파라미터 — 데드 코드 의존
- **위치**: `active-plan-context.ts` — `deriveStatus` 함수
- **상세**: `forceCleared` 인자가 항상 `false`로 고정 호출됨. `cleared` 반환 경로는 `hasClearPlanAfter` 검사로 상위에서 이미 처리(`return null`)되어 `deriveStatus`까지 도달하지 않음. 실질적으로 사용되지 않는 파라미터가 타입 시그니처에 노출되면 이후 호출부에서 혼동 가능.
- **제안**: `forceCleared` 파라미터 제거 및 함수 시그니처 단순화:
  ```ts
  function deriveStatus(plan, completedStepIds): ActivePlanStatus { ... }
  ```

### [INFO] 내부 의존 방향 — 적절함
- **위치**: `workflow-assistant-stream.service.ts` → `active-plan-context.ts` → `workflow-assistant-message.entity`
- **상세**: 의존 방향이 Service → Business Logic → Entity 순으로 단방향이며, 순환 참조 없음. `system-prompt.ts`도 동일하게 `active-plan-context` 방향으로만 참조하여 역방향 의존 없음.

---

## 요약

이번 변경에서 추가된 외부 패키지는 없으며, 신규 내부 모듈 `active-plan-context.ts`는 기존 엔티티 타입에만 의존하는 최소한의 의존 구조를 갖춤. 내부 모듈 간 의존 방향(Service → Logic → Entity)이 올바르고 순환 참조도 없음. 사소한 개선 포인트로 `import type` 전환과 미사용 파라미터 정리가 있으나 의존성 관점에서 실질적 위험은 없음.

## 위험도

**NONE**