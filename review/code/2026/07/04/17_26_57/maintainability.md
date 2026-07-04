# 유지보수성(Maintainability) Review

## 발견사항

- **[WARNING]** `admitExecutionOrDefer` 최상단 JSDoc 이 advisory lock 도입 후에도 "pg advisory lock 불요"로 남아 구현과 모순
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:2595-2608` (특히 L2603-2605 `**TOCTOU**: ... 초과가 없다(pg advisory lock 불요)`) vs 본문 `(c)` 단계 인라인 주석 L2636-2644 및 L2640 `pg_advisory_xact_lock`
  - 상세: 이번 세션은 이전 ai-review CRITICAL(조건부 UPDATE 단독으로는 서브쿼리 COUNT 에 락이 없어 TOCTOU race 발생)을 수정하며 `pg_advisory_xact_lock` 기반 트랜잭션 직렬화를 추가했다. 함수 본문 `(c)` 단계의 인라인 주석은 이 사실(advisory lock 이 왜 필요한지)을 정확히 설명하도록 갱신됐으나, 같은 함수 바로 위 함수-레벨 JSDoc 은 옛 설계("단일 조건부 UPDATE 만으로 충분, pg advisory lock 불요")를 그대로 남겨두고 있다. 같은 파일 안에서 함수 하나를 놓고 두 주석이 정반대 주장을 하는 상태 — spec 문서(`spec/5-system/4-execution-engine.md` §8 Rationale)는 이미 "조건부 UPDATE 단독은 불충분"으로 정정되어 있어, 코드 주석만 뒤처졌다. 향후 유지보수자가 함수 상단 요약만 읽고 advisory lock 을 불필요한 것으로 오인해 제거하거나, 유사 admission 로직을 복제할 때 락을 빠뜨릴 위험이 있다.
  - 제안: L2603-2605 를 "단일 트랜잭션 안에서 per-workspace `pg_advisory_xact_lock` 으로 admission 을 직렬화한 뒤 조건부 UPDATE 로 카운트-체크-전이를 원자화한다(advisory lock 없이 조건부 UPDATE 단독으로는 서브쿼리 COUNT 에 락이 없어 TOCTOU race 발생)"와 같이 `(c)` 단계 인라인 주석 및 spec Rationale 과 일치하도록 정정.

- **[INFO]** `runExecution` 의 `alreadyRunning: boolean` 3번째 매개변수 — 호출부 리터럴 `true` 가 의미를 즉시 드러내지 않음
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:3928` (정의부 `alreadyRunning = false`) 및 L3348 부근 호출부 `await this.runExecution(execution, input, true);`
  - 상세: 호출부만 보면 `true` 가 무엇을 의미하는지 알 수 없는 magic boolean 이다. 정의부 JSDoc 및 admission 관련 주석을 함께 읽어야 `admitExecutionOrDefer` 가 이미 RUNNING 전이·emit 을 수행했음을 알리는 플래그임을 파악할 수 있다. 현재 호출부가 1곳뿐이라 실제 혼선 위험은 낮다.
  - 제안: 인라인 주석(`/* alreadyRunning */ true`) 추가, 또는 향후 호출부가 늘어날 경우 named option object(`{ alreadyRunning: true }`)로 전환 검토.

- **[INFO]** 테스트 헬퍼 `mkQb`(신규, admission 3-way 테스트용)와 기존 `mkExecQb`(PR4 stalled 테스트용)가 거의 동일한 mock 체인 형태로 중복
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts:3036`(`mkQb`) vs `:3156`(`mkExecQb`)
  - 상세: 두 헬퍼 모두 `update/set/where/andWhere/execute` mock 체인을 반환하는 동일 shape 이다. 15000+ 줄의 매우 큰 단일 spec 파일에 이미 존재하던 지역적 헬퍼 중복 패턴을 이번 PR 이 답습한 것으로, 신규 위반이라기보다 기존 관행 유지에 가깝다.
  - 제안: 즉각 조치 불요. 파일 상단에 공용 `createMockQueryBuilder(affected: number)` 유틸을 두고 재사용하면 향후 유사 admission/atomic-update 테스트 추가 시 중복이 줄어든다 — 별도 리팩터 후속으로 관리 권장.

- **[INFO]** `admitExecutionOrDefer` 가 한 함수 안에서 4단계 책임(큐-대기 타임아웃 체크 → cap 로딩 → advisory-lock 트랜잭션 원자 admission → deferred 재큐)을 순차 수행
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:2609-2688` (`(a)`~`(d)` 레터링 주석)
  - 상세: 함수 길이는 약 80줄로 과도하지 않고 `(a)(b)(c)(d)` 레터링 주석이 단계를 명확히 구분해 가독성을 보완한다. 다만 advisory lock 추가로 `(c)` 단계의 트랜잭션 콜백 안에 SQL 2문(lock 획득 + 조건부 UPDATE)이 인라인돼 순환 복잡도가 약간 늘었다. 현재는 각 단계가 독립적으로 이해 가능해 분리가 필수는 아니다.
  - 제안: 향후 admission 정책이 확장(예: spec 이 언급하는 priority 3-tier 후속 PR)되면 `(b)(c)(d)` 를 별도 private 메서드로 추출하는 리팩터를 고려.

- **[INFO]** cap 해석 정책(`resolveConcurrencyCap`)이 여러 계층(env 상수 `execution-limits.ts` 기본값 → workspace DTO override → workflow raw settings override)에 분산
  - 위치: `codebase/backend/src/modules/execution-engine/execution-limits.ts:29-64`, `codebase/backend/src/modules/workspaces/dto/update-workspace-settings.dto.ts:44-58`, `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:2622-2634`
  - 상세: `resolveConcurrencyCap`/`resolveQueueWaitTimeoutMs` 자체는 순수 함수로 잘 분리돼 있고 유닛 테스트(`execution-limits.spec.ts`) 커버리지도 충실하다. 다만 "cap 이 어디서 오는가"의 전체 그림(우선순위·소스)을 파악하려면 여러 파일을 오가야 한다. 이는 기존 `resolveMaxActiveRunningMs`(PR2a) 패턴을 그대로 계승한 것이라 신규 문제는 아니다.
  - 제안: 현재 스케일에서는 조치 불요. cap 소스가 더 늘어나면(예: plan/tier 기반) 통합 리졸버 고려.

- **[INFO]** 매직 넘버·문자열은 대부분 이름 있는 상수/enum 으로 추출되어 있음(양호)
  - 위치: `DEFAULT_WORKSPACE_MAX_CONCURRENT_EXECUTIONS`(10), `DEFAULT_WORKFLOW_MAX_CONCURRENT_EXECUTIONS`(3), `DEFAULT_QUEUE_WAIT_TIMEOUT_MS`(300000), `EXECUTION_ADMISSION_RETRY_DELAY_MS`(2000) — `codebase/backend/src/modules/execution-engine/execution-limits.ts`
  - 상세: 감점 요인 아님. raw SQL 문자열 내 `'running'`/`'pending'` 상태 리터럴은 `ExecutionStatus` enum 값과 일치해야 하는 결합이 있으나(아키텍처 관점 이슈로 별도 보고됨), 유지보수성 관점에서 별도 지적 사항 없음.

## 요약

이번 변경(PR2b enforcement, advisory-lock 수정 반영판)은 상세한 한국어 주석과 명확한 네이밍(`admitExecutionOrDefer`, `markQueueWaitTimeout`, `resolveConcurrencyCap` 등, 기존 `resolveMaxActiveRunningMs` 패턴과 일관)을 유지하며 함수 길이·중첩 깊이·매직 넘버 모두 양호한 수준이다. 가장 눈에 띄는 문제는 CRITICAL 수정(advisory lock 도입) 과정에서 함수-레벨 JSDoc 이 갱신되지 않아 "advisory lock 불요"라는 옛 서술이 바로 아래 인라인 주석·spec 정정 내용과 모순되게 남아있는 점이다 — 코드 자체는 올바르나 문서 주석의 내적 일관성이 깨져 향후 오독 위험이 있어 WARNING 으로 반영한다. 그 외 발견 사항(boolean flag 매개변수, 테스트 헬퍼 중복, cap 정책 분산)은 모두 경미한 INFO 수준으로 이번 PR 을 차단할 사안은 아니다.

## 위험도

LOW
