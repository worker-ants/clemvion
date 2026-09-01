# Database 리뷰

## 발견사항

- **[INFO]** `markNodeCancelled` DB 쓰기 실패를 흡수 — 짝 `NodeExecution` row 가 non-terminal(RUNNING)로 잔류할 수 있다 (의도된 트레이드오프, plan 에 명시)
  - 위치: `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts:409-432` (`assertLinkedTransitionApplied` 신규 `try { await this.driver.markNodeCancelled(...) } catch (err) { ... }`)
  - 상세: 종전에는 `markNodeCancelled` 의 reject 가 그대로 전파돼 `ExecutionCancelledError` 자체가 던져지지 않고 취소가 FAILED 로 오분류되는 결함이 있었다. 이번 변경은 그 오분류를 정정하기 위해 마킹 실패를 `try/catch` 로 흡수하고 `ExecutionCancelledError` 로 종결시킨다(분류 정확성 우선). DB 관점의 대가는, `markNodeCancelled` 자체의 UPDATE/save 가 실패해도 짝 `NodeExecution` row 는 RUNNING(non-terminal) 상태로 영구 잔류할 수 있고, 보정 트랜잭션·재시도 로직이 이 catch 안에는 없다는 점이다. `plan/in-progress/ie-resume-turn-boundary-cancel.md` C-4 처분 항목과 코드 주석에 이 트레이드오프가 명시적으로 인지·수용돼 있다(감사 로그 실패 처리와 동일 판단).
  - 제안: 추가 코드 조치는 불요. 배포 후 stalled-job recovery 백스톱이 "Execution=CANCELLED, 짝 NodeExecution=RUNNING 잔류" 케이스를 실제로 커버하는지 관측을 권장(plan 6차 라운드 INFO#2 — `markNodeCancelled` 비원자 save 로 인한 크래시 창 — 와 재현 조건이 유사하므로 같은 추적 항목으로 합류시키는 것이 좋다).

- **[INFO]** catch 블록이 DB 쓰기 실패와 비-DB 예외(프로그래밍 오류)를 구분하지 않고 동일하게 흡수한다
  - 위치: `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts:416`
  - 상세: `markNodeCancelled` 가 실제 DB 쓰기 실패가 아니라 다른 사유로 reject 되어도 동일하게 `logger.error` 후 계속 진행한다. 의도("DB 저장 실패가 취소 분류를 바꾸면 안 된다")보다 catch 범위가 넓다.
  - 제안: 우선순위 낮음. 로그에 원본 에러 메시지가 실려 사후 추적은 가능하므로 필요 시 DB 관련 예외로 범위를 좁히는 후속 리팩터만 검토.

- **[INFO]** (정합성 개선 확인) `execution.error` 잔존값 미정리로 인한 모순 레코드(`status='completed'` + `error` non-null)를 `prepareSuccessTermination` 으로 닫음
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:749-754`(신규 헬퍼 `prepareSuccessTermination`), 호출부 `:781`(`completeRetryExecution`) · `:957` 부근(`resumeGraphAfterRetry` 자연 종결, `savedExecution.prepareSuccessTermination` 대체)
  - 상세: retry 는 정의상 FAILED 실행에서 시작하므로 로드된 엔티티가 이전 시도의 `error` 를 들고 있는데, 종결 UPDATE(`finalizeGuarded`/`driver.updateExecutionStatus`)의 `SET … error = $8::jsonb` 는 엔티티 값을 무조건 그대로 영속한다(`retry-turn.service.ts:676-689` 확인). `prepareSuccessTermination` 이 두 성공 종결 경로(자연 종결·defensive fallback) 모두에서 `execution.error = null` 을 명시적으로 세팅하도록 통일했다 — 한쪽만 고쳤으면 다른 쪽이 조용히 모순 레코드를 계속 만들었을 것이다. 취소(CANCELLED) 경로는 반대로 `finalizeGuarded` 의 CANCELLED 분기가 SET 절에서 `error` 를 아예 제외해 `stop()` 이 쓴 값을 보존한다(:640-675, W16) — 두 처방이 서로 다른 것은 "이번 시도 값이 최신 진실"이라는 각 케이스의 전제가 다르기 때문으로, 실제 코드에서 대칭적으로 반영돼 있음을 확인했다.
  - 제안: 없음(개선 확인). 신규 회귀 테스트(`retry-turn.service.spec.ts` "자연 종결이 이전 시도의 error 를 비운다" / "fallback 종결도…")가 호출 시점 스냅샷으로 두 호출부를 각각 고정하고 있어 재발 방지 신뢰도가 높다.

- **[INFO]** `retryLastTurn` 의 atomic-consume UPDATE(`jsonb_exists` 가드 + JSONB `-` 키 제거)는 이번 diff 가 만든 것이 아니라 **테스트로 처음 고정된 것** — 코드 자체는 불변
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:215-244`(`dataSource.transaction` 블록, 미변경) / 신규 테스트 `retry-turn.service.spec.ts:245-265`
  - 상세: `jsonb_exists(output_data, '_retryState')` 는 컴파일 타임 상수 `RETRY_STATE_KEY`(`'_retryState'`)를 문자열 보간한 것으로, 사용자 입력이 SQL 문자열에 섞이지 않아 인젝션 경로는 없다(직접 확인). 트랜잭션(`dataSource.transaction`) 안에서 원자 UPDATE(`affected` 로 동시 retry 를 차단)와 spawn(`manager.save`)이 같은 매니저로 묶여 있어 부분 커밋 위험도 없다. 이번 diff 는 이 SQL 형태 자체를 바꾸지 않고, mock query-builder 가 `set`/`andWhere` 인자를 실제로 포착하도록 고쳐 `jsonb_exists` 가드를 제거하는 뮤턴트가 RED 로 떨어짐을 신규로 확인했을 뿐이다(회귀 감지력 개선, DB 스키마/쿼리 자체 변경 아님).
  - 제안: 없음. 실 Postgres 상의 `jsonb_exists`/`-` 연산자 유효성은 unit 레벨에서 원리적으로 검증 불가하며(mock 경계), plan 에 이미 e2e 인프라 필요로 등재·유예돼 있다.

- **[INFO]** `Execution.error` 컬럼 TS 타입 정정 — 스키마·마이그레이션 영향 없음
  - 위치: `codebase/backend/src/modules/executions/entities/execution.entity.ts:81`
  - 상세: `@Column({ type: 'jsonb', nullable: true })` 데코레이터(DB 제약)는 이번 diff 에서 변경되지 않았고, TS 타입만 `Record<string, unknown>` → `Record<string, unknown> | null` 로 실제 DB nullable 제약과 일치시켰다. 마이그레이션 불필요, 무중단 배포 리스크 없음. `prepareSuccessTermination` 이 `execution.error = null` 을 캐스트 없이 대입할 수 있는 것은 이 타입 정정에 의존한다(두 변경이 서로 전제 관계).
  - 제안: 없음.

## 요약

이번 changeset 은 신규 스키마·마이그레이션·인덱스·쿼리 형태 변경이 없다. 기존에 존재하던 JSONB 원자 consume(`jsonb_exists` 가드, 트랜잭션 결합), guarded status-CAS UPDATE, CANCELLED 분기의 `COALESCE` ABA 회피는 모두 그대로 보존되며 새로 도입된 SQL 표현식도 없다(파라미터화되지 않은 부분은 컴파일 타임 상수 보간이며 사용자 입력과 무관함을 직접 확인). 핵심 DB 관련 변경은 (1) `markNodeCancelled` 쓰기 실패를 관측-후-흡수해 취소 분류를 보존하는 처방 — 부작용으로 짝 row 가 non-terminal 로 잔류할 수 있으나 이는 이미 plan 에 문서화·수용된 트레이드오프, (2) `executeSync` timeout 경로가 기존 guarded UPDATE 의 반환값을 소비해 형제 경로와 동일한 관측 로그를 남기도록 한 것(쿼리·트랜잭션 자체는 무변경), (3) `prepareSuccessTermination` 도입으로 성공 종결 시 이전 시도의 `error` 를 명시적으로 비워 `status='completed'` + `error` non-null 모순 레코드를 실제로 방지한 데이터 정합성 개선, (4) `execution.entity.ts` 의 `error` 컬럼 TS 타입을 실제 DB nullable 제약과 일치시킨 순수 타입 정정(마이그레이션 불요)이다. N+1·커넥션 누수·SQL 인젝션·대량 데이터 페이지네이션 관점에서 새로운 위험은 관측되지 않았다. 유일한 잔여 우려(마킹 실패 시 non-terminal 잔류)는 코드 주석과 plan 양쪽에 근거와 함께 명시적으로 기록돼 추가 코드 조치 없이도 추적 가능한 상태다.

## 위험도
LOW
