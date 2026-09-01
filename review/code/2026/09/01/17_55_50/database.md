# Database 리뷰

## 발견사항

- **[INFO]** `markNodeCancelled` DB 쓰기 실패를 관측만 하고 흡수 — 짝 `NodeExecution` row 가 non-terminal 로 잔류할 수 있다 (의도된 트레이드오프, 이미 문서화됨)
  - 위치: `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts:409-432`
  - 상세: 종전에는 `await this.driver.markNodeCancelled(...)` 의 reject 가 그대로 전파돼 `ExecutionCancelledError` 자체가 던져지지 않는 결함이 있었다. 이번 변경은 `try/catch` 로 감싸 마킹 실패와 무관하게 `ExecutionCancelledError` 로 종결되도록 고쳤다(취소 **분류**의 정확성을 우선). 다만 그 대가로 `markNodeCancelled` 의 DB 쓰기 자체가 실패하면 짝 `NodeExecution` row 가 RUNNING(non-terminal)으로 잔류할 수 있고, catch 블록은 `logger.error` 만 남기고 재시도·보정 로직이 없다. 코드 주석과 `plan/in-progress/ie-resume-turn-boundary-cancel.md` C-4 처분 항목에서 이미 인지·의도된 트레이드오프로 명시돼 있고(감사 로그 실패와 동일 판단), 형제 plan(`retry-turn-terminal-guard.md`)의 "알려진 백스톱 갭" 서술과 같은 계열이다.
  - 제안: 추가 코드 조치는 불요(설계 의도가 명확히 기록됨). 다만 stalled-job recovery 백스톱이 "Execution=CANCELLED, 짝 NodeExecution=RUNNING 잔류" 케이스를 실제로 커버하는지 배포 후 관측을 권장한다 — plan 문서의 6차 라운드 INFO#2("markNodeCancelled 비원자 save 로 인한 크래시 창")와 재현 조건이 유사하므로 같은 추적 항목에 합류시키는 것이 좋다.

- **[INFO]** catch 블록이 DB 쓰기 실패와 비-DB 예외를 구분하지 않고 동일하게 흡수한다
  - 위치: `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts:416`
  - 상세: `markNodeCancelled` 가 실제 DB 쓰기 실패가 아니라 다른 사유(예: 인자 검증 오류, 프로그래밍 실수)로 reject 되어도 동일하게 `logger.error` 후 계속 진행한다. 의도는 "취소 마킹 DB 저장 실패가 취소 분류를 바꾸면 안 된다"이지만, `catch (err)` 의 범위가 그보다 넓다.
  - 제안: 에러 메시지를 로그에 남겨 사후 추적은 가능하므로 우선순위는 낮다. 필요 시 DB 관련 예외로 범위를 좁히는 리팩터를 후속 검토.

- **[INFO]** (긍정적 수정) `execution.error` 잔존값 미정리로 인한 모순 레코드(`status='completed'` + `error` non-null) 결함을 `prepareSuccessTermination` 으로 닫음
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:770-775` (신규 헬퍼), 호출부 `:781`(`completeRetryExecution`)·`:957`(`resumeGraphAfterRetry` 자연 종결)
  - 상세: retry 는 정의상 FAILED 실행에서 시작하므로 로드된 엔티티가 이전 시도의 `error` 를 들고 있는데, 종결 UPDATE(`finalizeGuarded`/`driver.updateExecutionStatus`)는 그 컬럼을 그대로 영속한다. 두 성공 종결 경로(자연 종결·defensive fallback) 모두 `prepareSuccessTermination(execution)` 호출로 `execution.error = null` 을 명시적으로 세팅하도록 통일했다 — 한쪽만 고쳤다면 다른 쪽이 조용히 모순 레코드를 계속 만들었을 것이다. 신규 회귀 테스트(`retry-turn.service.spec.ts`, "자연 종결이 이전 시도의 error 를 비운다" / "fallback 종결도...") 가 두 호출부를 각각 뮤테이션으로 고정했다고 plan 에 기록돼 있다. DB 정합성 관점에서 타당한 수정이다.
  - 제안: 없음(개선 확인).

- **[INFO]** `resumeGraphAfterRetry` 자연 종결 경로는 `finalizeGuarded`(동시 cancel 가드)를 거치지 않고 `driver.updateExecutionStatus` 를 직접 호출 — 참조 동일성 불변식에 의존
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:957-965`
  - 상세: 이 diff 자체가 만든 것은 아니고(기존 동작에 `prepareSuccessTermination` 리팩터만 얹음) 이번 변경으로 새로 주석이 붙어 불변식("orchestrator 가 갱신하는 대상이 여기 넘기는 바로 그 `savedExecution` 객체")을 명시했다. 이 불변식이 깨지면(엔티티 재조회/교체) 과거 닫았던 stale-전이 결함이 재발할 수 있음을 코드가 스스로 경고하고 있다. `plan/in-progress/retry-turn-terminal-guard.md` INFO 2 항목에서 "통일 대신 주석" 으로 의도적으로 처분됐다.
  - 제안: 추가 조치 불요 — 문서화된 리스크로 충분히 추적됨. 향후 orchestrator 리팩터 시 재확인 필요.

- **[INFO]** `Execution.error` 컬럼 TS 타입 정정 — 스키마·마이그레이션 영향 없음
  - 위치: `codebase/backend/src/modules/executions/entities/execution.entity.ts:81`
  - 상세: `@Column({ type: 'jsonb', nullable: true })` 데코레이터(DB 제약)는 변경되지 않았고, TS 타입만 `Record<string, unknown>` → `Record<string, unknown> | null` 로 실제 DB nullable 제약과 일치시켰다. 마이그레이션 불필요, 무중단 배포 리스크 없음. `prepareSuccessTermination` 이 `execution.error = null` 을 대입하는 코드가 이 타입 정정 없이는 컴파일되지 않았을 것 — 두 변경이 서로 의존적이다.
  - 제안: 없음.

## 요약
이번 changeset 은 신규 스키마/마이그레이션/인덱스/쿼리 성능 변경이 없고, N+1·커넥션 누수·SQL 인젝션 위험도 관측되지 않았다. 핵심은 (1) `markNodeCancelled` DB 쓰기 실패 시에도 취소 **분류**(ExecutionCancelledError)를 보존하도록 예외를 관측-후-흡수하는 처방(문서화된 트레이드오프, 짝 row 잔류 가능성 존재하나 이미 인지·추적 중), (2) `execution-engine.service.ts` timeout catch 에서 `updateExecutionStatus` 반환값을 소비해 동시 cancel 선점 시 관측 로그를 남기도록 한 개선(기능 변경 없음), (3) `retry-turn.service.ts` 의 `markSpawnedRowFailed` 추출(순수 DRY 리팩터, 4단계 중복 통합)과 `prepareSuccessTermination` 도입(성공 종결 시 이전 시도의 `error` 를 명시적으로 비워 `status='completed'`인데 `error` non-null 인 모순 레코드를 실제로 닫은 데이터 정합성 수정)이다. 마지막으로 `execution.entity.ts` 의 `error` 컬럼 TS 타입을 실제 nullable 스키마와 맞춘 것은 마이그레이션이 필요 없는 순수 타입 정정이다. 전반적으로 DB 정합성을 개선하는 방향의 변경이며, 유일한 잔여 우려(마킹 실패 시 non-terminal 잔류)는 이미 코드·plan 양쪽에 근거와 함께 명시적으로 기록돼 추가 조치 없이도 추적 가능한 상태다.

## 위험도
LOW
