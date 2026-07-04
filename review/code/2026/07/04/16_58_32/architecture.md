# 아키텍처(Architecture) Review

## 발견사항

- **[WARNING]** 워크플로우 레벨 cap 설정 경로의 비대칭 — API 없이 DB 직접 write 만 가능
  - 위치: `codebase/backend/src/modules/workflows/entities/workflow.entity.ts` (settings: `Record<string, unknown>`, 전용 DTO 없음) vs `codebase/backend/src/modules/workspaces/dto/update-workspace-settings.dto.ts` (`maxConcurrentExecutions` 필드 + `@IsInt @Min(1)` 검증 + `workspaces.service.ts` 병합 로직)
  - 상세: `resolveConcurrencyCap(workflow?.settings, DEFAULT_WORKFLOW_MAX_CONCURRENT_EXECUTIONS)` 은 workflow-level cap 을 정식 지원하는 것처럼 보이지만, 이 값을 쓰기 위한 API/DTO/서비스 경로가 존재하지 않는다. 실제로 e2e 테스트(`execution-concurrency-cap.e2e-spec.ts`)조차 `db.query('UPDATE workflow SET settings = ...')` 로 DB 를 직접 조작해 이 값을 주입한다("settings write API 는 별도 테스트 범위" 주석으로 스스로 인정). 워크스페이스는 프레젠테이션(DTO/Controller)→비즈니스(Service)→데이터(Entity) 전 레이어가 갖춰졌는데 워크플로우는 데이터 레이어의 무검증 JSONB 필드만 존재해 레이어 책임이 비대칭적으로 미완성 상태다. 운영자가 워크플로우별 cap 을 조정할 공식 수단이 없다.
  - 제안: 동일 PR 스코프에서 워크플로우 settings 업데이트 DTO/엔드포인트를 추가하거나, 최소한 "workflow-level cap 은 API 미제공(DB-only, 내부용)" 임을 spec/코드 주석에 명시적으로 남겨 향후 오해를 방지한다.

- **[WARNING]** `admitExecutionOrDefer` 가 Repository 추상화를 우회해 raw SQL 을 직접 실행 — 데이터 접근 레이어 경계 이탈
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:1284-1294` (`this.executionRepository.query(...)`)
  - 상세: 나머지 엔진 코드는 TypeORM Repository/QueryBuilder(`createQueryBuilder().update()...`)로 데이터 접근을 캡슐화하는데, admission 핵심 로직만 파라미터 바인딩된 raw SQL 문자열로 서브쿼리 2개(workspace COUNT, workflow COUNT)와 UPDATE 를 직접 작성한다. TOCTOU-safe 원자성을 위한 불가피한 선택이라는 점은 주석에 설명돼 있으나(합리적 트레이드오프), 이는 서비스 레이어가 SQL 스키마(`execution`/`workflow` 테이블명, 컬럼명 `workspace_id`, `status='running'` 등 매직 문자열)에 직접 결합됨을 의미한다. 스키마 변경(테이블/컬럼명 리네임) 시 이 서비스가 컴파일 타임 감지 없이 깨질 수 있다.
  - 제안: 최소한 admission 전용 리포지토리 메서드(`ExecutionAdmissionRepository.tryAdmit(...)` 등)로 SQL 을 캡슐화해 서비스 레이어가 SQL 문자열을 직접 다루지 않도록 분리하는 것을 고려. 현재도 단일 파일 내 격리돼 있어 CRITICAL 은 아니다.

- **[INFO]** `runExecution` 의 `alreadyRunning` boolean 플래그 파라미터 — 암묵적 상태 결합
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:1350-1383` (`runExecution(savedExecution, input, alreadyRunning = false)`)
  - 상세: `admitExecutionOrDefer` 가 이미 상태 전이(RUNNING)와 emit(`EXECUTION_STARTED`)을 수행했음을 `runExecution` 에 알리기 위해 boolean flag 를 추가했다. 두 메서드가 "누가 RUNNING 전이/emit 책임을 지는가"를 놓고 암묵적으로 협상하는 구조라, 호출자가 flag 전달을 빠뜨리면 RUNNING→RUNNING 이중 전이(assertTransition throw)로 이어질 수 있다. 현재는 호출부가 1곳(`runExecutionFromQueue`)뿐이라 실제 위험은 낮다.
  - 제안: 호출부가 늘어날 경우 "이미 admitted 된 execution 을 실행" 전용 별도 진입점(`resumeAdmittedExecution` 등)으로 분리하거나, admission 결과 객체에 "전이 완료 여부"를 담아 boolean 매직 파라미터보다 명시적인 계약으로 바꾸는 편이 추후 유지보수에 유리하다.

- **[INFO]** admission 정책(cap 값, retry delay)이 여러 계층에 분산
  - 위치: `execution-limits.ts` (기본값 상수), `.env.example`(env override), `update-workspace-settings.dto.ts`(workspace override), `workflow.settings`(workflow override, API 없음), `execution-engine.service.ts`(적용 로직)
  - 상세: cap 결정 로직이 "env 기본값 → workspace override → workflow override" 3단 fallback 체인으로 여러 파일에 흩어져 있다. `resolveConcurrencyCap` 자체는 순수 함수로 잘 분리돼 있어 단위 테스트 가능성은 좋으나, 정책의 전체 그림(우선순위·소스)은 코드를 여러 곳 읽어야 파악 가능하다.
  - 제안: 현재 스케일에서는 과설계가 될 수 있어 필수는 아니나, 향후 cap 소스가 늘어나면(예: plan/tier 기반) 단일 `AdmissionPolicyResolver` 같은 값 객체로 통합하는 것을 고려.

## 요약
이번 변경은 기존 PR2a(active-running 타임아웃) 패턴을 그대로 계승해 `execution-limits.ts` 에 순수 함수(`resolveConcurrencyCap`, `resolveQueueWaitTimeoutMs`)로 정책을 분리하고, `ExecutionEngineService` 에 admission gate 를 단일 원자 UPDATE 로 구현한 응집도 높은 설계다. TOCTOU 회피를 위해 raw SQL 을 쓴 것은 명확한 트레이드오프로 문서화돼 있고, DB 마이그레이션(`queued_at` 컬럼)과 entity 도 기존 컬럼(`started_at`)과 의미를 분리해 잘 설계됐다. 다만 workflow-level cap 이 "정책상 지원"인데 실제로는 API 경로가 없어 workspace-level 과 레이어 완성도가 비대칭이라는 점, 그리고 admission 로직이 Repository 추상화를 우회해 raw SQL 로 스키마에 직접 결합된 점은 향후 유지보수 시 주의가 필요하다. 순환 의존성이나 레이어 침범(프레젠테이션↔데이터 직접 결합) 같은 심각한 문제는 없다.

## 위험도
LOW
