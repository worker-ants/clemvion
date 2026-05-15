### 발견사항

---

- **[WARNING]** 테스트 내 `as never` / `as unknown` 타입 우회 패턴
  - 위치: `dashboard.service.spec.ts` — `buildListQB([r1, r2, r3]) as unknown`, `parentNameQB as unknown`, `workflowRepo as never`, `executionRepo as never`; `websocket.gateway.spec.ts` — `{ id: 'exec-abc' } as never`
  - 상세: 타입 우회로 인해 `DashboardService` 생성자 시그니처나 `findById` 반환 타입이 변경될 경우 컴파일 오류 없이 테스트가 통과된다. 특히 `as never`는 어떤 타입과도 호환되기 때문에 모킹 형태 불일치를 완전히 감추며, `as unknown`도 중간 캐스팅 수단으로 오용될 수 있다.
  - 제안: `buildListQB`의 반환 타입을 `Partial<SelectQueryBuilder<Execution>>`으로 선언하거나, 서비스 생성자를 직접 호출하는 대신 `Test.createTestingModule`을 사용해 NestJS DI를 통한 타입 안전한 모킹으로 전환한다.

---

- **[WARNING]** `getRecentExecutions` 리밋 하드코딩 + 프론트 슬라이스 이중 선언
  - 위치: `dashboard.service.ts` — `.limit(10)`; `dashboard/page.tsx` — `.slice(0, 10)`
  - 상세: 백엔드의 `.limit(10)`과 프론트엔드의 `.slice(0, 10)`이 서로 다른 레이어에 같은 매직 넘버로 흩어져 있다. 한 쪽을 수정하면 다른 쪽이 누락되는 유지보수 부채가 생긴다. 의미 없는 슬라이싱(API가 이미 10개 이하를 반환)이기도 해서 코드 의도가 불명확하다.
  - 제안: 백엔드에 `const RECENT_EXECUTIONS_LIMIT = 10` 상수를 추출하고, API 응답이 이미 제한된 개수를 보장하므로 프론트엔드의 `.slice(0, 10)` 은 삭제한다.

---

- **[WARNING]** `FakeExec` 타입이 실제 엔티티와 분리된 수동 정의
  - 위치: `dashboard.service.spec.ts` lines 4–16
  - 상세: `Execution` 엔티티에서 파생하지 않고 필드를 수동 나열했다. 엔티티 필드 이름이 변경되거나 신규 필수 필드가 추가될 경우, 테스트의 `FakeExec`은 갱신되지 않아도 컴파일 오류가 발생하지 않으며 테스트가 잘못된 형태의 객체를 기반으로 계속 통과할 수 있다.
  - 제안: `type FakeExec = Pick<Execution, 'id' | 'workflowId' | 'workflow' | 'status' | 'startedAt' | 'durationMs' | 'triggerId' | 'executedBy' | 'parentExecutionId' | 'trigger' | 'executor'>` 형태로 실제 엔티티 타입을 직접 참조한다.

---

- **[INFO]** JSDoc 내 하드코딩된 파일 경로
  - 위치: `dashboard-response.dto.ts` — `@ApiProperty` 위 JSDoc 주석: `backend/src/modules/executions/utils/execution-trigger.ts`
  - 상세: 절대 경로가 주석에 박혀 있어 파일이 이동하거나 리팩토링될 때 stale 문서가 된다. IDE에서 클릭 가능한 링크도 아니어서 실질적인 탐색 편의도 없다.
  - 제안: 경로 대신 `see {@link deriveExecutionTrigger}` 형태의 JSDoc 링크를 사용하거나, 경로 언급 없이 "분류 규칙은 `execution-trigger` 유틸 참조" 정도로 추상화한다.

---

- **[INFO]** `loadParentWorkflowNames`의 raw SQL alias 패턴이 주변 코드와 불일치
  - 위치: `load-parent-workflow-names.ts` — `.select(['pe.id AS parent_id', 'wf.name AS workflow_name'])`
  - 상세: `executions.service.ts`와 `dashboard.service.ts`는 TypeORM의 엔티티 인식 API인 `.addSelect(['trigger.id', 'trigger.type', ...])` 형태를 사용하는 반면, 이 함수는 `AS` 별칭을 포함한 raw SQL fragment를 사용한다. 두 패턴이 혼재하면 TypeORM에 익숙하지 않은 개발자가 어느 형태를 써야 할지 혼동할 수 있다.
  - 제안: 이 함수는 `getRawMany`를 사용하므로 raw alias 방식이 의도적으로 맞다. 함수 주석에 "raw alias 사용은 getRawMany 결과 key 매핑을 명시하기 위함"이라는 한 줄 설명을 추가해 혼동을 방지한다.

---

- **[INFO]** `executions/page.tsx` 삭제 코드 후 불필요한 빈 줄
  - 위치: `executions/page.tsx` — 인라인 `TriggerCell` 삭제 직후 `export default` 선언 전
  - 상세: 코드 블록 제거 후 빈 줄이 하나 남아 있어 불필요한 공백이 생겼다. 사소하지만 `git diff` 리뷰 시 시각적 노이즈를 유발한다.
  - 제안: 빈 줄 제거.

---

### 요약

이번 변경의 핵심인 `loadParentWorkflowNames` 유틸 추출과 `TriggerCell` 공유 컴포넌트화는 중복 제거와 단일 책임 원칙 측면에서 매우 적절한 리팩토링이다. `TRIGGER_ICON` / `TRIGGER_LABEL_KEY`의 `Record<ExecutionTriggerSource, ...>` 타입 활용으로 새로운 트리거 소스 추가 시 컴파일 단계에서 누락을 잡을 수 있는 구조도 좋다. 다만 테스트 내 `as never` / `as unknown` 광범위한 사용은 타입 안전망을 약화시키고, 백엔드와 프론트엔드에 분산된 매직 넘버 `10`, `FakeExec`의 수동 타입 정의는 엔티티 변경 시 조용한 버그를 유발할 수 있는 잠재적 유지보수 부채로 남는다.

### 위험도

**LOW**