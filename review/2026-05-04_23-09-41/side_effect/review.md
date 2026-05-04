### 발견사항

---

**[WARNING] `findByWorkflow` 반환 타입 변경 — 호출자 영향 미검증**
- 위치: `executions.service.ts`, 변경 전 `Promise<PaginatedResponseDto<Execution>>` → 변경 후 `Promise<PaginatedResponseDto<ExecutionDto>>`
- 상세: `Execution` 엔티티는 `startedAt`·`finishedAt`을 `Date` 타입으로 갖지만, `ExecutionDto`는 `string`으로 직렬화한다. 컨트롤러(`executions.controller.ts`)가 반환값을 `Execution` 타입으로 선언했거나, 서비스 결과를 엔티티 메서드(예: TypeORM 라이프사이클)에 의존하여 사용하는 코드가 있다면 컴파일 에러 또는 런타임 오동작이 발생한다. 해당 컨트롤러 파일은 이번 diff에 포함되지 않아 부작용 여부가 미확인 상태다.
- 제안: `executions.controller.ts`의 반환 타입 선언 및 사용처를 확인하여 `ExecutionDto`로 명시적으로 맞출 것.

---

**[WARNING] `findByWorkflow` 쿼리에 무조건적 LEFT JOIN 2개 추가**
- 위치: `executions.service.ts:58-62`
- 상세: `trigger`·`executor` LEFT JOIN은 필요 여부와 무관하게 모든 페이지 조회에 항상 실행된다. 트리거/실행자가 없는 워크플로우 목록(대다수의 manual 실행이 없는 케이스)에서도 DB JOIN 비용이 발생하며, 기존 대비 쿼리 실행 계획이 변경되어 페이지네이션 성능에 영향을 줄 수 있다.
- 제안: 현재 구조는 기능 정확성 측면에서 문제없으므로 즉각적인 조치는 불필요하나, 대용량 데이터셋에서 회귀 발생 시 `triggerSource`·`triggerLabel`을 별도 집계 쿼리로 분리하거나 인덱스를 보강하는 방향으로 최적화를 검토할 것.

---

**[WARNING] `loadParentWorkflowNames` — `workflow` 릴레이션 lazy-load 전제**
- 위치: `executions.service.ts:128-145`
- 상세: `executionRepository.find({ where: { id: In(parentIds) }, relations: ['workflow'] })` 호출 시 `Execution` 엔티티에 `workflow` 릴레이션이 정의되어 있어야 한다. 릴레이션이 엔티티에서 제거되거나 이름이 바뀌면 TypeORM이 런타임 에러를 내지만 TypeScript 컴파일에서는 잡히지 않는다(`relations`는 `string[]`). 특히 `p.workflow?.name` 접근의 `undefined` 안전 처리는 되어 있으나, 릴레이션 자체가 로드되지 않는 경우(예: TypeORM 설정 오류)에는 `null`이 반환되어 라벨이 빠진 채 응답된다.
- 제안: 단위 테스트에서 이미 커버되고 있어 위험도는 낮다. 엔티티 릴레이션 이름을 상수로 관리하거나, TypeORM QueryBuilder로 타입 안전 조회를 고려.

---

**[INFO] `EXECUTION_TRIGGER_SOURCES` 배열이 `readonly` 선언 없음**
- 위치: `execution-response.dto.ts:4-9`
- 상세: `const` 로 선언되어 재할당은 불가하지만 배열 요소 추가/변경은 막히지 않는다(`EXECUTION_TRIGGER_SOURCES.push(...)` 가능). `@ApiProperty({ enum: ... })`에 전달되는 값이 변경되면 Swagger 문서가 오염된다. 실제로 변경하는 코드는 없으나 타입 시스템의 보호가 없다.
- 제안: `as const` 또는 `readonly` 로 타입을 좁혀 `@ApiProperty`에 전달되는 열거값의 불변성을 명시할 것.
  ```ts
  const EXECUTION_TRIGGER_SOURCES = ['manual', 'schedule', 'webhook', 'subworkflow', 'unknown'] as const;
  ```

---

**[INFO] `ExecutionDto.triggerSource`가 필수 필드 — DTO 수동 생성 시 컴파일 에러**
- 위치: `execution-response.dto.ts:32-36`
- 상세: `triggerSource: ExecutionTriggerSource`는 optional(`?`)이 아니므로, `ExecutionDto`를 직접 객체 리터럴로 생성하는 테스트 코드나 픽스처가 있다면 TypeScript 컴파일 에러가 발생한다. 현재 diff 범위 내 코드에서는 `toExecutionDto`를 통해서만 생성하여 문제없다.
- 제안: 추가 조치 불필요. 단, 향후 외부에서 `ExecutionDto`를 직접 생성하는 테스트 픽스처 작성 시 이 필드를 포함해야 함을 주의.

---

### 요약

전반적으로 변경사항은 잘 격리되어 있으며 의도치 않은 전역 상태 변경, 파일시스템 부작용, 네트워크 외부 호출은 없다. 가장 주의해야 할 부분은 `findByWorkflow`의 반환 타입이 `Execution` 엔티티에서 `ExecutionDto`로 바뀐 점으로, diff에 포함되지 않은 컨트롤러 및 기타 호출자에서 타입 불일치 또는 동작 변경이 발생할 수 있다. 두 개의 LEFT JOIN 추가로 인한 성능 영향은 기능 정확성을 위한 의도된 트레이드오프이나, 대용량 환경에서 회귀 여부를 모니터링해야 한다. 나머지 변경사항(순수 유틸 함수, i18n 키 추가, 프론트엔드 optional 필드)은 부작용이 없다.

### 위험도

**LOW**