# 유지보수성(Maintainability) Review

## 발견사항

- **[INFO]** boolean flag 매개변수 `alreadyRunning` 이 호출부 가독성을 낮춤
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `runExecution(savedExecution, input, alreadyRunning = false)` 정의부(약 L3906 부근) 및 호출부 `await this.runExecution(execution, input, true);`(약 L3345 부근)
  - 상세: 호출부의 `true` 리터럴만 봐서는 무엇을 의미하는지 알 수 없다("magic boolean"). 정의부에 상세한 JSDoc 주석이 있어 정의를 찾아보면 이해는 가능하지만, 호출부만 읽는 리뷰어/유지보수자에게는 즉각적으로 의도가 드러나지 않는다.
  - 제안: `runExecution(execution, input, { alreadyRunning: true })` 형태의 named option object 로 바꾸거나, 최소한 호출부에 인라인 주석(`/* alreadyRunning */ true`)을 남겨 의미를 명시하면 가독성이 개선된다. 이미 함수 시그니처가 이번 PR 에서 새로 추가된 것이므로 지금이 옵션 오브젝트로 정리하기 좋은 시점이다.

- **[INFO]** `admitExecutionOrDefer` 가 한 함수 안에서 4단계 책임(큐-대기 타임아웃 체크 → cap 로딩 → 원자 admission UPDATE → deferred 재큐)을 순차 수행
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `private async admitExecutionOrDefer(...)` (diff 상 (a)~(d) 단계 주석)
  - 상세: 함수 자체는 60여 줄로 과도하게 길지는 않고, (a)(b)(c)(d) 레터링 주석으로 단계를 명확히 구분해 가독성을 상당 부분 보완하고 있다. 다만 순환 복잡도 측면에서 "타임아웃 조기 반환 + cap 로드 + 원자 UPDATE 조건부 분기 + 재큐"가 한 곳에 응집되어 있어, 향후 admission 정책이 더 복잡해지면(예: priority tier 추가) 분리가 필요해질 가능성이 있다.
  - 제안: 현재 크기·주석 밀도는 수용 가능한 수준. 향후 확장(스펙 주석의 "priority 3-tier 후속 PR") 시점에 (b)(c)(d) 를 별도 private 메서드로 추출하는 리팩터를 고려.

- **[INFO]** 원자 admission UPDATE 가 raw parameterized SQL 사용 — 파일 내 QueryBuilder 사용과 스타일 혼재로 보일 수 있으나 기존 선례와 일치
  - 위치: `execution-engine.service.ts` L2639 부근 `admitExecutionOrDefer` 의 `this.executionRepository.query(...)` vs `markQueueWaitTimeout` 의 `this.executionRepository.createQueryBuilder()...`
  - 상세: 같은 PR 안에서 한 메서드는 QueryBuilder, 다른 메서드는 raw SQL 을 쓴다. 다만 raw parameterized UPDATE 는 `updateExecutionStatus` 의 기존 else 분기(L7461 부근, "M-3" 주석)에서 이미 쓰인 확립된 패턴 — 서브쿼리 기반 조건부 UPDATE 가 필요할 때는 raw SQL, 단순 컬럼 SET 시엔 QueryBuilder 라는 암묵적 구분이 코드베이스에 존재한다. 신규 위반이 아니라 기존 컨벤션 준수로 판단.
  - 제안: 별도 조치 불요. 다만 이 구분 기준(언제 QueryBuilder, 언제 raw SQL)을 주석이나 컨벤션 문서에 한 줄로 명문화하면 다음 기여자의 판단 비용이 줄어든다(선택 사항).

- **[INFO]** 테스트 파일의 `mkQb` 헬퍼가 두 describe 블록(`admitExecutionOrDefer` 테스트, 기존 `finalizeStalledExhausted` 등)에 유사 형태로 반복
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` — 신규 `mkQb`(PR2b admission 테스트용, L497 부근) vs 기존 `mkExecQb`(L595 부근, PR4 stalled 테스트용)
  - 상세: 두 헬퍼는 이름과 반환 shape 이 거의 동일(`update/set/where/andWhere/execute` mock 체인)하다. 이미 이 파일에 유사 패턴이 존재했으므로(mkExecQb) 이번 변경이 새로운 중복을 만들었다기보다 기존 관행을 답습한 것 — 파일 전체가 15000+ 줄의 매우 큰 단일 spec 파일이라 이런 지역적 헬퍼 중복이 이미 여러 곳에 있을 가능성이 높다.
  - 제안: 즉각 조치 불요(스코프 밖). 파일 상단에 공용 `createMockQueryBuilder(affected: number)` 유틸을 두고 전역 재사용하면 향후 유사 admission/atomic-update 테스트 추가 시 중복이 줄어든다 — 별도 리팩터 티켓으로 관리 권장.

- **[INFO]** `.env.example` / migration / entity 주석의 "PR2a", "PR2b", "M-3", "W-15" 등 내부 작업 식별자가 코드 주석에 그대로 노출
  - 위치: `codebase/backend/.env.example` L35, `codebase/backend/migrations/V104__execution_queued_at.sql`, `execution.entity.ts` queuedAt 컬럼 주석
  - 상세: 이 프로젝트는 이미 전반적으로 "PR2a/W-15/M-3" 같은 작업 추적 식별자를 주석에 남기는 컨벤션을 확립해 사용 중(과거 파일에도 다수 존재). 신규 추가분(PR2b)도 동일 패턴을 따르므로 일관성 있음 — 이는 이 프로젝트의 의도된 관례(plan/코드 추적성 확보)로 판단되며 감점 요인 아님.
  - 제안: 없음(현행 컨벤션 유지가 적절).

## 요약

이번 변경(실행 동시성 cap admission gate, PR2b)은 코드 전반에 걸쳐 상세한 한국어 주석(왜 raw SQL 인지, TOCTOU 원자성을 어떻게 보장하는지, 기존 컬럼과 신규 `queued_at` 의 의미 차이 등)을 충실히 남겨 가독성과 향후 유지보수 시 의도 파악이 용이하다. 네이밍(`admitExecutionOrDefer`, `markQueueWaitTimeout`, `resolveConcurrencyCap`, `DEFAULT_WORKSPACE_MAX_CONCURRENT_EXECUTIONS` 등)은 목적을 명확히 드러내며 기존 `resolveMaxActiveRunningMs` 패턴과 일관된 명명 규칙을 따른다. 매직 넘버는 모두 이름 있는 상수로 추출되어 있고, 함수 길이·중첩 깊이도 과도하지 않다. 발견된 사항은 모두 INFO 수준의 경미한 개선 여지(boolean flag 매개변수, 테스트 헬퍼 중복, 향후 확장 시 함수 분리 고려)이며, 코드베이스의 기존 컨벤션(raw SQL 조건부 UPDATE, PR 식별자 주석)과 대체로 일치한다. 유지보수성 관점에서 이 변경을 차단할 이슈는 없다.

## 위험도

LOW
