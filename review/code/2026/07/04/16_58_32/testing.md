# 테스트(Testing) Review — PR2b 동시성 cap admission gate

## 발견사항

- **[WARNING]** admission 결과(deferred/cancelled)에 대한 호출부(`execute()` 백그라운드 dispatch) 통합 유닛 테스트 부재
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:3326-3335` (호출부) / `execution-engine.service.spec.ts` (테스트 부재)
  - 상세: `admitExecutionOrDefer` 자체는 3-way(`admitted`/`deferred`/`cancelled`) 유닛 테스트가 있지만, 이를 호출하는 백그라운드 dispatch 블록
    ```ts
    const admission = await this.admitExecutionOrDefer(execution, input);
    if (admission !== 'admitted') {
      if (admission === 'deferred') {
        this.eventEmitter.releaseExecutionRouting(executionId);
      }
      return;
    }
    ```
    을 직접 겨냥한 테스트가 없다. 즉 (1) `deferred` 시 `releaseExecutionRouting` 이 실제로 호출되는지, (2) `cancelled` 시에는 `releaseExecutionRouting` 이 **호출되지 않는지**(이미 `markQueueWaitTimeout` 내부에서 호출되므로 중복 호출 방지 확인), (3) 두 경우 모두 `this.runExecution` 이 호출되지 않는지를 검증하는 테스트가 없다. `admitExecutionOrDefer` 를 `jest.spyOn(...).mockResolvedValue('deferred')` 로 stub 한 뒤 `execute()`(또는 해당 백그라운드 브릿지)를 호출하는 회귀 테스트가 없으면, 향후 호출부 로직(예: `if` 분기 순서, `runExecution` 조기 호출 등)이 깨져도 유닛 테스트가 잡아내지 못하고 e2e 에만 의존하게 된다.
  - 제안: `admitExecutionOrDefer` 를 mock 해 `deferred`/`cancelled` 각각에 대해 `runExecution` 미호출 + `releaseExecutionRouting` 호출 여부(deferred=호출, cancelled=비호출)를 검증하는 테스트 2개 추가.

- **[WARNING]** `execution.queuedAt = null` (레거시 row / V104 마이그레이션 이전 데이터, 또는 `recoverStuckExecutions` 로 재구성된 row) 케이스 미테스트
  - 위치: `execution-engine.service.ts:2615` `if (execution.queuedAt) { ... }`
  - 상세: 코드는 `queuedAt` 이 falsy 면 큐 대기 타임아웃 검사를 건너뛰고 곧바로 cap 검증으로 진행하도록 방어돼 있다. 그러나 3-way 유닛 테스트는 모두 `queuedAt: new Date()` 값이 설정된 케이스만 다루고, `queuedAt: null`(또는 `undefined`) 인 execution 을 `admit()` 에 전달해 "타임아웃 검사 스킵 + cap 검증으로 정상 진행(admitted 또는 deferred)" 되는지 검증하는 테스트가 없다. migration 주석에 "기존 row 도 마이그레이션 시각으로 채워지나... 무해"라고 되어 있어 실제 프로덕션에서는 NULL 이 거의 발생하지 않지만, entity 정의(`queuedAt: Date | null`)가 명시적으로 nullable 을 허용하므로 이 분기의 회귀 안전성을 유닛 테스트로 고정해두는 것이 안전하다.
  - 제안: `queuedAt: null` 인 execution 으로 `admit()` 호출 → cap 검사(workflow findOne)가 수행되고 정상적으로 `admitted`/`deferred` 판정되는지 확인하는 테스트 추가.

- **[INFO]** `admitExecutionOrDefer` 유닛 테스트가 workspace cap 과 workflow cap 을 구분해 초과 조건을 검증하지 않음
  - 위치: `execution-engine.service.spec.ts:3081-3096` (`cap 초과(affected=0) → deferred`)
  - 상세: `admitExecutionOrDefer` 의 원자 UPDATE 는 workspace COUNT < wsCap **AND** workflow COUNT < wfCap 을 한 쿼리에서 검사한다(`execution-limits.ts`/`execution-engine.service.ts:2616-2624` raw SQL). 유닛 테스트는 `this.executionRepository.query` 자체를 mock 하므로 이 두 조건의 실제 SQL 로직(서브쿼리 join, `<` 비교, 파라미터 바인딩 순서)은 전혀 실행되지 않고, `affected` 값만으로 분기 결과를 강제한다. 즉 "cap 로드(`resolveConcurrencyCap` 호출과 workflow/workspace settings 병합)"는 별도 `execution-limits.spec.ts` 유닛 테스트로 커버되지만, **admission SQL 문 자체가 두 스코프를 올바르게 AND 조건으로 결합하는지**는 e2e 2건(둘 다 workflow cap=1 단일 스코프만 소비)만으로 검증된다. workspace cap 이 실제로 걸리는 e2e/통합 시나리오(같은 workspace 내 서로 다른 workflow 로 workspace cap 초과)는 없다.
  - 제안: raw SQL 문법 자체의 회귀 위험이 낮다면 현재로도 수용 가능하나, 여유가 있다면 e2e 에 workspace cap 초과 시나리오(예: workspace cap=1, workflow cap 은 넉넉히 설정 후 서로 다른 workflow 2개로 실행)를 추가해 스코프 결합 로직을 실증하는 편이 안전하다.

- **[INFO]** `UpdateWorkspaceSettingsDto.maxConcurrentExecutions` 필드에 대한 서비스/e2e 테스트 부재
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts:2491-2497` (`updateWorkspaceSettings` 의 병합 로직), `codebase/backend/src/modules/workspaces/dto/update-workspace-settings.dto.ts:2029-2038` (`@IsInt @Min(1)`)
  - 상세: `workspaces.service.spec.ts` 에 `maxConcurrentExecutions` 문자열 매치가 0건이고, e2e(`workspace-rbac.e2e-spec.ts`) 에도 해당 필드 관련 테스트가 없다. e2e 스펙(`execution-concurrency-cap.e2e-spec.ts`)의 주석도 "per-workflow cap=1 (DB 직접 — settings write API 는 별도 테스트 범위)"라고 명시해 API 경로(PATCH 워크스페이스 설정 → `maxConcurrentExecutions` 병합 → 이후 admission gate 반영)를 의도적으로 스코프 밖에 둔 것으로 보인다. 그러나 다음 갭이 실제로 커버되지 않는다:
    1. DTO 의 `@IsInt() @Min(1)` validation pipe 가 실제로 0/음수/소수 입력을 400 으로 거부하는지(컨트롤러 e2e 또는 DTO validation 유닛 테스트 없음).
    2. `updateWorkspaceSettings` 서비스 메서드가 `dto.maxConcurrentExecutions` 를 기존 `settings` 와 올바르게 병합(다른 키 보존)하는지 — 다른 필드(`timezone`, `interactionAllowedOrigins`)는 이미 검증된 병합 패턴을 그대로 재사용하지만, 새 필드 자체의 단위 테스트는 없다.
    3. `getWorkspaceSettings` 응답에 `maxConcurrentExecutions` 가 노출되는지 여부 확인 부재(현재 `getWorkspaceSettings` 리턴 타입에는 `maxConcurrentExecutions` 가 아예 없음 — 조회 API 로는 확인 불가능한 상태로 보임. 의도된 설계인지 재확인 필요하나 이는 테스트보다 스펙/구현 정합 이슈에 가까움).
  - 제안: 최소한 `workspaces.service.spec.ts` 에 "제공 시 병합 / 미제공 시 보존" 케이스 1-2개를 추가해 회귀를 방지. `maxConcurrentExecutions` 를 admin 설정 화면에서 실제로 노출/조회할 계획이라면 `getWorkspaceSettings` 확장과 함께 e2e 도 고려.

- **[INFO]** e2e 2건 모두 `insertRunningBlocker` 로 DB에 직접 running row 를 심는 방식이라, "실제 동시 실행 중인 Execution" 시나리오(진짜 워크플로우 실행이 cap 슬롯을 점유한 상태)는 검증하지 않음
  - 위치: `codebase/backend/test/execution-concurrency-cap.e2e-spec.ts:76-84` (`insertRunningBlocker`)
  - 상세: blocker 가 실제 실행 중인 워크플로우가 아니라 DB에 직접 삽입된 `running` row(id만 존재, node-execution 이력 없음)이므로 admission gate 의 COUNT 쿼리 정확성은 검증되지만, "실행 종료 시 상태 전이가 자연스럽게 slot 을 반환하는지"(정상적인 `completed`/`failed` 전이 경로에서 admission 이 재검사되는지)는 실증하지 않는다. 이는 fixture 로서는 합리적인 단순화이지만, 두 실제 실행이 진짜로 경쟁하는 케이스(TOCTOU 원자성의 실질적 실증)는 spec 상단 주석이 명시한 "multi-actor 동시 running Execution" 목표에 완전히 부합하지는 않는다.
  - 제안: 현재 방식도 admission SQL 자체의 COUNT 정확성 검증에는 충분하다고 판단되나, 여유가 있다면 workflow cap=2 로 두 개의 실제 실행을 거의 동시에 트리거해 셋째 실행이 deferred 되는 "진짜 경쟁" 시나리오를 별도로 추가하면 TOCTOU 원자성을 더 직접적으로 실증할 수 있다.

- **[INFO]** `resolveQueueWaitTimeoutMs`/`resolveConcurrencyCap` 유닛 테스트는 충실하나, 두 함수가 `admitExecutionOrDefer` 내부에서 어떤 인자로 호출되는지(즉, `workflow?.settings`/`workflow?.workspace?.settings` 가 각각 올바른 스코프로 전달되는지)를 통합 관점에서 확인하는 테스트는 없음
  - 위치: `execution-engine.service.ts:2626-2634`
  - 상세: `resolveConcurrencyCap(workflow?.settings, DEFAULT_WORKFLOW_MAX_CONCURRENT_EXECUTIONS)` 와 `resolveConcurrencyCap(workflow?.workspace?.settings, DEFAULT_WORKSPACE_MAX_CONCURRENT_EXECUTIONS)` 호출이 뒤바뀌면(workflow ↔ workspace 스코프 혼동) `execution-limits.spec.ts` 단위 테스트는 통과하지만 `admitExecutionOrDefer` 자체 테스트도 `mockWorkflowRepo.findOne` 이 고정된 `{ settings: {}, workspace: { settings: {} } }` 를 반환하므로(3027-3097 라인) 두 스코프 모두 `{}` 라 구분이 안 되고 감지되지 않는다. 실질적인 스코프 구분 검증은 e2e 의 workflow cap=1 케이스 하나뿐.
  - 제안: `admitExecutionOrDefer` 유닛 테스트에서 `mockWorkflowRepo.findOne` 이 `settings: { maxConcurrentExecutions: N }` 과 `workspace.settings: { maxConcurrentExecutions: M }` 을 서로 다른 값으로 반환하도록 하고, 이 값들이 raw SQL 파라미터(`$3`=wsCap, `$5`=wfCap)에 올바른 순서로 전달되는지 `query` mock 의 호출 인자를 assert 하는 테스트를 추가하면 스코프 혼동 회귀를 감지할 수 있다(현재는 `query` 호출 인자 자체를 assert 하는 테스트가 전혀 없음).

## 요약

핵심 로직(`resolveConcurrencyCap`/`resolveQueueWaitTimeoutMs` 순수 함수, `admitExecutionOrDefer`의 admitted/deferred/cancelled 3-way 분기)에 대한 유닛 테스트와, 원자성·타이밍이 필요한 실제 동시성 시나리오(cap 초과 대기 → 슬롯 해제 시 admitted, cap 초과 지속 → 5분 타임아웃 cancel)에 대한 e2e 2건이 각각 적절한 계층에 배치되어 있고 기존 회귀 테스트(예: W5/W7 setup-throw 케이스)에도 `admitExecutionOrDefer` mock 을 추가해 무너지지 않도록 조치돼 있어 전반적으로 견고하다. 다만 admission 결과가 `deferred`/`cancelled` 일 때 호출부(백그라운드 dispatch)가 `releaseExecutionRouting` 호출 여부와 `runExecution` 미호출을 올바르게 수행하는지를 검증하는 유닛 테스트가 없어 이 통합 지점은 e2e 에만 의존하는 상태이고, `queuedAt=null`(레거시/복구 row) 방어 분기와 workspace/workflow 스코프가 실제로 뒤바뀌지 않았는지에 대한 파라미터 레벨 검증도 비어 있다. 새로 추가된 `Workspace.settings.maxConcurrentExecutions` DTO 필드는 API 계약(검증·병합·조회 노출)에 대한 테스트가 전혀 없어(e2e 스펙 주석도 "별도 테스트 범위"로 명시적으로 제외) 이 부분이 가장 눈에 띄는 공백이다. 이들은 모두 CRITICAL 수준은 아니며(실제 admission enforcement 자체는 unit+e2e 로 충분히 실증됨), 향후 회귀 방지 차원의 보완 항목으로 권장한다.

## 위험도
LOW
