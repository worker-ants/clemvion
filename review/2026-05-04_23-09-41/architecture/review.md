### 발견사항

- **[WARNING]** `ExecutionTriggerSource` 타입 중복 정의
  - 위치: `backend/src/modules/executions/utils/execution-trigger.ts` / `frontend/src/lib/api/executions.ts`
  - 상세: 동일한 union type이 백엔드와 프론트엔드에 각각 수동 정의되어 있어 동기화 지점이 두 곳으로 분산됨. 새 트리거 타입 추가 시 두 파일 모두 수정해야 하며, 누락 시 컴파일 단계에서 감지되지 않음.
  - 제안: 모노레포 공유 타입 패키지(`packages/types`) 도입 또는 OpenAPI 스키마로부터 프론트엔드 타입 자동 생성(e.g., `openapi-typescript`). 단기적으로는 현 구조를 명세 문서에 명시해 인지 유지.

---

- **[WARNING]** `findByWorkflow` vs `findById` 반환 타입 비일관성
  - 위치: `executions.service.ts:27` (`findById`) / `:49` (`findByWorkflow`)
  - 상세: `findByWorkflow`는 `ExecutionDto`를 반환하도록 변경되었으나 `findById`는 여전히 raw `Execution` 엔티티를 반환함. 같은 서비스의 두 메서드가 서로 다른 레이어 계약을 가지며, 호출자(컨트롤러)는 각각 다른 타입을 처리해야 함. 레이어 경계가 불일관적으로 적용된 상태.
  - 제안: `findById`도 `ExecutionDetailDto`를 반환하도록 통일. 엔티티 노출 범위를 서비스 내부로 제한하는 방향이 일관된 계약.

---

- **[WARNING]** 새 트리거 타입 추가 시 변경 지점이 6곳 이상 산재
  - 위치: `execution-trigger.ts`(타입+분기), `execution-response.dto.ts`(상수 배열), `executions.ts`(프론트 타입), `page.tsx`(아이콘 맵+레이블 맵), `ko.ts`/`en.ts`(i18n)
  - 상세: `deriveExecutionTrigger`의 if-chain 방식과 `EXECUTION_TRIGGER_SOURCES` 수동 배열, `TRIGGER_ICON`/`TRIGGER_LABEL_KEY` Record 맵이 모두 개별 변경 대상. OCP 관점에서 확장이 곧 기존 코드 수정을 의미.
  - 제안: 현 규모(5개 타입, 안정적 도메인)에서는 허용 가능한 트레이드오프. 향후 트리거 타입이 동적으로 늘어날 가능성이 있다면 `TriggerTypeRegistry` 패턴으로 메타데이터(아이콘, i18n 키, 판정 로직)를 하나의 선언으로 집약할 것.

---

- **[INFO]** `loadParentWorkflowNames`에서 전체 `Execution` 엔티티 로딩
  - 위치: `executions.service.ts:131`
  - 상세: `workflow.name` 하나만 필요한데 `executionRepository.find({ relations: ['workflow'] })`로 `Execution` 전체 + `Workflow` 전체 엔티티를 로드함. 페이지 크기(기본 20)가 작으므로 실용적 부담은 적지만, 아키텍처 의도와 실제 데이터 접근 범위가 불일치.
  - 제안: `workflowRepository`(또는 raw query)로 `parent_execution_id → workflow.name` 직접 조회. 또는 `addSelect`를 활용한 서브쿼리로 최초 `getMany` 시점에 포함.

---

- **[INFO]** 서비스 내 DTO 변환 책임 혼재 (SRP 경계)
  - 위치: `executions.service.ts:152` (`toExecutionDto`), `:125` (`loadParentWorkflowNames`)
  - 상세: 서비스가 데이터 조회, 비즈니스 로직(트리거 판정), DTO 변환, 보조 배치 쿼리까지 4가지 책임을 가짐. 현재 규모에서는 허용 가능하나 서비스 크기가 커질수록 테스트와 변경 격리가 어려워짐.
  - 제안: `ExecutionMapper` 클래스 분리는 지금 당장 필요하진 않으나, `toExecutionDto`와 `loadParentWorkflowNames`는 서비스 외부 순수 함수로 추출할 수 있는 경계를 갖추고 있어 향후 분리 시 비용이 낮음.

---

- **[INFO]** 프론트엔드 JSX 내 IIFE 사용
  - 위치: `page.tsx:300` (트리거 셀 렌더링)
  - 상세: `{(() => { ... })()}` 패턴은 로직 인라인화를 위한 IIFE로, 컴포넌트 분리 없이 복잡도를 숨기는 방식. 렌더링 로직이 테이블 셀 JSX에 묻혀 가독성과 재사용성이 낮아짐.
  - 제안: `<TriggerCell source={...} label={...} />` 컴포넌트로 분리. 현재 로직 복잡도라면 인라인 함수(`renderTrigger`)로만 추출해도 충분.

---

### 요약

전체 설계 방향은 건실하다. `deriveExecutionTrigger`를 순수 함수로 분리하고 `DerivableExecution` 구조 타입으로 TypeORM 엔티티 의존을 끊은 것, 서브워크플로우 부모명 조회를 N+1 방지 배치로 처리한 것은 아키텍처적으로 올바른 판단이다. 주요 리스크는 `ExecutionTriggerSource` 타입의 프론트/백 중복과, `findById`/`findByWorkflow` 반환 타입 불일관으로 생기는 레이어 경계 혼재이며, 이 두 가지가 장기적으로 유지보수 비용을 높일 수 있다. 새 트리거 타입 추가 시 변경 지점 산재는 현 도메인 안정성을 감안하면 허용 가능한 수준이나 인지하고 있어야 한다.

### 위험도

**LOW**