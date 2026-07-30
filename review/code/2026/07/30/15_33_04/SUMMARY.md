# Code Review 통합 보고서

대상 커밋: `2ca44b769` "fix(engine): retry 재진입 짝 전이가 DB 가드에 막혀 절대 persist 되지 않던 결함 (8R CRITICAL)"
범위: `state/state-machine.ts`, `execution-engine.service.ts`, `ai-turn-orchestrator.service.ts`, `engine-driver.interface.ts`, `retry-turn.service.ts`(컨텍스트, 0줄 변경) + 대응 `*.spec.ts` 3개.

## 전체 위험도

**HIGH** — 8R CRITICAL 버그 자체(재진입 짝 전이가 상태머신 opt-in 은 통과하나 DB 가드 3개 소비처에서 항상 0행으로 막히던 결함)는 정확히 수정됐고, security/requirement/concurrency 등 다수 리뷰어의 독립적인 수동 호출체인 추적으로 현재 코드의 correctness 가 확인됐다. 다만 (1) 그 수정이 처음으로 실제 도달 가능하게 만든 "커밋 메시지 스스로 '최빈 시나리오'라 명시한" turn 계속→re-park(`FAILED→WAITING_FOR_INPUT`) 경로에 대한 회귀 테스트가 4개 관련 spec 파일 어디에도 없고(CRITICAL, testing), (2) 동일 전이가 SoT spec 3개 문서에 전혀 반영되지 않은 SPEC-DRIFT(CRITICAL 등급, 코드는 유지하고 spec 만 갱신)가 있다. 두 CRITICAL 모두 "지금 프로덕션에서 활성 상태인 버그"는 아니지만, 이 코드베이스가 정확히 "약한 mock 이 8라운드 동안 결함을 은폐"한 이력을 반복하지 않으려면 다음 라운드 전에 반드시 해소해야 한다. 그 외 데이터 정합성(stale error/finishedAt 재기록)·구조적 fan-out 중복 등 WARNING 9건은 즉각적 차단 사유는 아니나 누적 시 재발 위험이 있다.

**라우터 참고**: `forced`(router_safety 강제) 6명(maintainability, requirement, scope, security, side_effect, testing) 전원 결과 확보됨 — 화이트리스트 미이행 없음.

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Testing | 커밋 메시지가 "가장 흔한 시나리오"라 명시한 "turn 계속 → re-park(`FAILED→WAITING_FOR_INPUT`)" 경로 — `allowRetryReentry` opts 전파가 실제로 DB SQL 가드까지 도달해 persist 되는지 검증하는 회귀 테스트가 관련 4개 spec 파일 어디에도 없다(시나리오 자체가 구성되지 않거나 mock 이 그 경로를 통째로 우회). 코드 자체는 requirement/concurrency 리뷰어의 수동 추적으로 correct 함이 확인됐으나, 자동 회귀 안전망은 이 경로에 대해 전무하다. | `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts:430-457`(`reparkAiResumeTurn` opts 전파); `ai-turn-orchestrator.service.spec.ts:111-119,759-793,860-`(`opts` 미전달); `execution-engine.service.spec.ts:16732-`(`applyRetryLastTurn (multi-turn loop re-entry)` describe — continuation 시나리오 없음, `status:'ended'`/throw 뿐); `retry-turn.service.spec.ts:727-738`(`processAiResumeTurn` 을 통째로 mock) | `applyRetryLastTurn` describe 에 `processReturn` 이 continuation(`status:'waiting'`/`ended:false`)을 반환하는 fixture 1건 추가 — `dbExecutionStatus=FAILED` 상태에서 opts 전파로 `WAITING_FOR_INPUT` 까지 실제 persist 되는지, mutation(예: `opts` 를 `undefined` 로 되돌림)으로 RED 가 되는지 확인할 것. 이 영역은 8라운드째 "약한 mock 이 실 결함을 은폐"한 패턴이 반복된 자리이므로 우선순위를 낮추지 말 것 |
| 2 | SPEC-DRIFT | [SPEC-DRIFT] 이번 커밋이 신설한 `FAILED → WAITING_FOR_INPUT` retry-reentry opt-in 전이("turn 계속 → re-park", 커밋 스스로 "최빈 시나리오"라 명시)가 관련 spec 3개 문서 어디에도 반영되지 않았다 — 코드는 의도적이고 정확하나(state-machine.ts 주석이 "2026-07-30 ai-review CRITICAL #1 후속"이라 명시), spec 은 여전히 성공/실패 이분법에 머물러 있다. | `spec/5-system/4-execution-engine.md:40-47`(ASCII 상태 다이어그램에 `waiting_for_input` 엣지 없음), `:66-78`(§1.1 "허용되는 상태 전이" 표 — `failed\|waiting_for_input` 행 부재, `failed\|running` 행만 존재), `:1507-1519`(전용 Rationale "### failed → running 재진입 전이" — 세 번째 갈래 없음); `spec/5-system/6-websocket-protocol.md:376`(§4.2 "재진입 종결 후 graph 진행" 단락에 재-park 결과 누락); `spec/4-nodes/3-ai/1-ai-agent.md:989,1302-1308`(§7.9/§12.8, 성공/실패만 서술); 코드 근거 `codebase/backend/src/modules/execution-engine/state/state-machine.ts:30-37,68-79`(`canTransition` opt-in 확장) | 코드는 유지(되돌릴 대상 아님). `project-planner` 턴으로 위임 — §1.1 표에 `failed\|waiting_for_input` 행 신설(+ 다이어그램 갱신) + Rationale 에 "계속(re-park)" 세 번째 갈래 추가 + `6-websocket-protocol.md` §4.2 및 `1-ai-agent.md` §7.9/§12.8 에 재-park 결과 한 문장씩 보강. `plan/in-progress/retry-turn-terminal-guard.md` 의 `spec_impact` 트래킹에 등재 |

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Database | 이번 fix 로 새로 도달 가능해진 `FAILED→RUNNING`/`FAILED→WAITING_FOR_INPUT` 짝 전이가, 원래 실패 시점에 기록된 `execution.error`/`finishedAt`/`durationMs` 를 clear 하지 않은 채 non-terminal 행에 그대로 재기록한다(full-entity save / raw UPDATE). 특히 재-park(최빈 케이스) 시 이 모순 상태가 다음 사용자 입력까지 장시간(수 시간~영구) 유지되어, `GET /executions/:id` 폴링 소비자에게 "대기 중인데 오류 메시지·완료시각·소요시간이 함께 표시"되는 모순을 노출할 수 있다. | `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:8430-8432`(`updateExecutionStatus` `linkedNodeExec` 분기, `manager.save(Execution, execution)` full-entity save), `:8458-8461`+`:8486`(else 분기 raw UPDATE); 소비 경로 `ai-turn-orchestrator.service.ts:453-458`(`reparkAiResumeTurn`→WAITING_FOR_INPUT), `:1615-1620`(`finalizeAiNode`→RUNNING); 노출 지점 `codebase/backend/src/modules/executions/executions.service.ts:826-840`(`ExecutionDto` 매핑) | `RetryTurnService.applyRetryLastTurn` 진입 직후(fresh `execution` 로드 시점, `retry-turn.service.ts:374` 부근)에 `execution.error = null`(+ 가능하면 `finishedAt`/`durationMs`)을 명시적으로 초기화. 기존 추적 중인 plan #5(COMPLETED 종결 케이스, 같은 근본원인)와 한 번에 해소 가능 |
| 2 | Concurrency | 이번 fix 로 "형제 FAILED 멀티턴 노드의 동시 `retry_last_turn`" 경로가 처음으로 실제 동작 가능해졌다 — 하나의 Execution 아래 서로 다른 두 FAILED 멀티턴 AI 노드(예: Parallel 형제 브랜치)가 동시에 재진입하면, `FOR UPDATE` 잠금은 단일 시도의 lost-update 는 막지만 한쪽이 먼저 RUNNING/WAITING_FOR_INPUT 으로 전이시킨 뒤에는 그 상태가 opt-in 여부와 무관하게 항상 non-terminal 에 포함돼 뒤따르는 형제 노드도 잠금·전이를 적용할 수 있다(데이터 손상보다는 소유권 모호성 위험). | `codebase/backend/src/modules/execution-engine/state/state-machine.ts:73-77`(opt-in 판정), `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:8168-8184`(`lockNonTerminalExecutionRow`), `:8354-8441`(`updateExecutionStatus` linkedNodeExec 분기) | 한 Execution 에 재시도 가능한 FAILED 멀티턴 노드가 2개 이상 공존 가능한지 제품 설계 차원에서 확인. 가능하다면 동시 `retry_last_turn` 통합/e2e 테스트 추가, 불가능한 불변식이라면 `retry-turn.service.ts` JSDoc/spec 에 명문화 |
| 3 | Architecture/Security/Database/Maintainability | `opts?.allowRetryReentry ? NON_TERMINAL_OR_FAILED_STATUSES_SQL : NON_TERMINAL_STATUSES_SQL` 삼항식이 두 곳에 문자 그대로 복제됨 — 이 파일은 정확히 "손으로 중복된 status SQL 리터럴" 문제로 이미 WARNING #8(2026-07-26)을 받은 이력이 있는 자리이고, 이번 8R CRITICAL 버그 자체가 "리뷰어는 2경로만 지목했으나 실측으로 3곳" 이라는 fan-out 누락에서 비롯됐다. | `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:8173-8175`(`lockNonTerminalExecutionRow` 내부 `statusesSql`), `:8459-8461`(`updateExecutionStatus` else 분기 `elseStatusesSql`) | `private static resolveGuardStatusesSql(opts?: { allowRetryReentry?: boolean }): string` 같은 단일 헬퍼로 통합해 두 호출부가 한 줄만 쓰도록 정리 |
| 4 | Architecture | retry-reentry 예외 불변식("FAILED 는 원칙적으로 부활 불가, `retry_last_turn` 재진입만 예외")이 타입/구조가 아니라 계층마다 수동으로 이어 나르는 boolean 하나로만 성립함 — 최소 6개 지점(상태머신·DB 가드 헬퍼/소비처 3·오케스트레이터 호출부 4·retry 서비스)에서 빠짐없이 전달돼야 하며, 이번 라운드조차 설계 검토만으로는 3번째 소비처를 찾지 못하고 mutation testing 으로 사후 발견했다. 정적 검증 수단이 없어 향후 4번째 소비처 추가 시 동일 클래스 결함이 재발할 구조적 위험이 남는다. | `codebase/backend/src/modules/execution-engine/state/state-machine.ts:57`, `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:8171,8233,8358`, `codebase/backend/src/modules/execution-engine/engine-driver.interface.ts:81,213`, `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts:442-457,1437,1508,1600,1619`, `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:466` | retry-reentry 시나리오 전체를 감싸는 단일 진입점(예: `RetryEngineDriver` 전용 `transitionForRetryReentry(...)`)으로 캡슐화하거나, 최소한 "opts 를 받아야 하는 모든 가드 함수" 목록을 타입/JSDoc 한 곳에 열거해 신규 소비처 추가 시 체크리스트로 쓸 것 |
| 5 | Maintainability | `flag ? { allowRetryReentry: true } : undefined` boilerplate("flag→opts 객체 변환")가 한 파일 안에서 4회 반복됨 — 새 소비처 추가 시 이 변환을 빠뜨리면 이번 커밋이 고친 것과 동일 클래스의 결함(opts 미배선→DB 가드 항상 0행)이 재발할 수 있는 지점이다. | `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts:457`(`reparkAiResumeTurn`), `:1508,1600,1619`(`finalizeAiNode` 3곳) | `private static toRetryReentryOpts(flag: boolean \| undefined): { allowRetryReentry: boolean } \| undefined` 같은 단일 변환 헬퍼로 4곳을 한 곳으로 통합 |
| 6 | Testing | `updateExecutionStatus` 의 `linkedNodeExec` 분기와 `tryLockActiveExecutionAndSaveNodeExec` 을 직접 겨냥하는 전용(focused) unit describe 블록 2곳이 새 `opts` 파라미터를 전혀 인지하지 못한다(타입 캐스팅 자체가 구식, `FAILED` 상태 미등장) — 실제 opts 전파 검증은 훨씬 거리가 먼 통합 테스트(`applyRetryLastTurn`)가 우연히 지나가며 간접 수행할 뿐이라, 그 통합 테스트가 스코프를 바꾸거나 삭제되면 이 파라미터에 대한 유일한 안전망도 함께 사라진다. | `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts:5279-5399`(`linkedNodeExec` 짝 전이 describe), `:5442-5520`(`tryLockActiveExecutionAndSaveNodeExec` describe, `priv()` 타입 정의 `:5443-5449`가 3번째 인자 미선언) | 두 블록에 `updateExecutionStatus` else 분기용으로 이미 추가된 패턴(`:5111-5152`, SQL 에 `'failed'` 포함 여부 직접 단언)과 동일하게 "opt-in 시 FOR UPDATE 쿼리가 `'failed'` 를 포함한다/포함하지 않는다" 테스트를 로컬로 추가 |
| 7 | Testing | `retry_last_turn` 전체 흐름(WS 커맨드 → `retryLastTurn` → continuation worker → `applyRetryLastTurn`)에 대한 e2e(`*.e2e-spec.ts`) 테스트가 전무하다 — 이번 결함이 정확히 "실제 Postgres 가 아니라 손으로 짠 mock 이 8라운드 동안 결함을 가린" 사례였는데도, 여전히 실제 DB round-trip(`FOR UPDATE`, 트랜잭션 원자성)을 대체 검증할 뿐 실행하지는 않는다. | `codebase/backend/test/*.e2e-spec.ts` 전체 grep 0건(대조: `execution-crash-redrive`/`execution-stalled-redelivery`/`execution-park-resume` 등 인접 기능은 e2e 보유) | CRITICAL 은 아니나, `retry_last_turn` WS 커맨드 왕복(2차 turn 계속/2차 turn 종료 양쪽)을 검증하는 `execution-*.e2e-spec.ts` 류 backstop 을 백로그에 등재 권고 |
| 8 | Documentation | 이번 "8R CRITICAL" 수준 수정에 `CHANGELOG.md` 항목이 없다 — 동일 파일의 유사·더 가벼운 결함 수정들(`771801e3e` 등, 그중 하나는 바로 이 `retry_last_turn` 기능의 직전 결함 수정)은 전부 CHANGELOG 항목을 동반한 기존 관례와 불일치한다. | `CHANGELOG.md`(최상단, 신규 `## Unreleased` 섹션 부재); 대조 커밋 `771801e3e`, `d3fafbafc`, `24d8ab623` | 기존 선례와 동일 형식으로 결함 재현조건·수정 4곳·mock 하드코딩이 8라운드 동안 결함을 은폐한 경위·SoT 링크를 요약해 `Unreleased` 섹션에 추가 |
| 9 | Documentation | `tryLockActiveExecutionAndSaveNodeExec` 의 JSDoc 이 신규 `opts` 인자를 반영하지 못함 — 같은 diff 의 자매 함수(`lockNonTerminalExecutionRow`)는 `@returns`/`@param` 이 "non-terminal(또는 opt-in 시 FAILED)" 뉘앙스로 정확히 갱신됐는데, 이 함수와 그 인터페이스 미러(`engine-driver.interface.ts`, "메서드 시그니처는 엔진을 SoT 로 그대로 미러링" 선언)에는 적용되지 않았다. | `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:8217-8220`(`@returns`), `codebase/backend/src/modules/execution-engine/engine-driver.interface.ts:186-209,213` | `tryLockActiveExecutionAndSaveNodeExec` 의 `@returns`(양쪽 파일)에 "(또는 opt-in 시 FAILED)" 뉘앙스 반영 + `engine-driver.interface.ts` 에 최소 1줄 `@param opts.allowRetryReentry` 추가 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Architecture/Maintainability | retry-reentry opts 필드명이 계층 경계마다 다르다(orchestrator/retry-turn 계층=`retryReentry`, state-machine/engine 계층=`allowRetryReentry`) — 매 계층 경계에서 수동 리네임 변환이 필요해 인지 부하가 소폭 늘지만 기능적 결함은 아니다. | `ai-turn-orchestrator.service.ts:220,442,457`, `retry-turn.service.ts:466` vs `state-machine.ts:57`, `engine-driver.interface.ts:81,213`, `execution-engine.service.ts:8171,8233,8358` | 즉시 수정 불요 — 후속 리팩터링 때 계층 간 이름 통일을 백로그로 고려 |
| 2 | Concurrency | `finalizeAiNode` 의 RUNNING 유지 분기에 추가된 opts 전달이 retry 재진입 경로에서는 현재 도달 불가능한 조합이다(`savedExecution.status` 가 이 경로에서 항상 FAILED 로 고정돼 `===RUNNING` 조건이 항상 거짓) — 무해하나 테스트되지 않는 분기로 남는다. | `ai-turn-orchestrator.service.ts:1600`(`tryLockActiveExecutionAndSaveNodeExec` 3번째 인자), `:1596`(`if (savedExecution.status === RUNNING)`) | 조치 불요 — 향후 이 조합이 실제 필요해지는 리팩터 시 회귀 테스트 추가 |
| 3 | Side Effect | retry 재진입 "턴 계속" 분기가 RUNNING 을 거치지 않고 `FAILED→WAITING_FOR_INPUT` 으로 직행해, `updateExecutionStatus` 의 `enteringRunning`(`newStatus===RUNNING`) 조건이 거짓이 되어 `recordRunningSegmentStart` 가 호출되지 않는다 — 이 재개 턴의 처리시간이 §8 `activeRunningMs` 누적 예산에 계측되지 않는다. 기존 문서화된 under-count 허용 방침(Graceful Shutdown 관련)과 같은 방향이며 영향은 이 턴 1회로 국한된다. | `ai-turn-orchestrator.service.ts:453-458`(`reparkAiResumeTurn`), `execution-engine.service.ts:8375-8376`(`enteringRunning` 계산) | 정보 제공 목적 — §8 활성시간 정확도가 중요하다면 retry-reentry 경로 한정 별도 세그먼트 기록을 후속 검토 가능 |
| 4 | API Contract | retry 재진입 spawn row 의 `NODE_STARTED` WS 이벤트 payload 에서 내부 전용 `_retryState` 키가 제거됨 — 의도된 변경(W6, ai-review 7R), `execution.node.started` 최소 스키마(spec §4.1)가 애초에 비-계약 필드였고 소비하는 프런트엔드 코드도 없음, 이미 회귀 테스트로 고정. | `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:369,447` | 조치 불필요 — 향후 WS 이벤트 방출 필드 전체를 spec 에 정식 스키마화할 기회가 있다면 "내부 전용 제외 필드"를 각주로 남길 것 |
| 5 | Scope | 커밋에 이번 fix 와 무관한 1줄 spec 링크 앵커 정정(`#73-크래시-재개`→`#73-멱등성-보장`)이 동반됨 — 직전 커밋(`025aedd0f`)이 만든 오류를 자기교정한 것으로, 커밋 메시지가 투명하게 공개했고 이 저장소에 유사 drive-by 정정을 "기록만 하고 되돌리지 않는다"로 처리한 선례가 있다. | `spec/5-system/4-execution-engine.md:1394` | 조치 불필요 — 되돌릴 실익 없음 |
| 6 | Documentation | `ExecutionEngineService` 클래스 최상단 docstring 의 "상태 머신" 한 줄 요약이 retry-reentry 예외 엣지를 언급하지 않는다 — 이번 diff 이전부터 있던 서술이라 diff 범위 밖 참고 사항. | `execution-engine.service.ts:441-442` | 우선순위 낮음 — 위 spec 정정과 함께 처리하거나 별도 후속으로 defer 가능 |
| 7 | Testing | `assertTransition` 의 새 boundary(`FAILED → WAITING_FOR_INPUT`)에 대한 직접 단위 테스트가 없다 — `assertTransition` 은 `canTransition` 의 단순 위임이고 `canTransition` 쪽은 새 boundary 를 3건으로 꼼꼼히 커버해 실질 리스크는 낮다. | `codebase/backend/src/modules/execution-engine/state/state-machine.spec.ts:175-193`(`assertTransition` describe) | 선택 사항 — 대칭성을 위해 1줄 테스트 추가 가능하나 우선순위 낮음 |
| 8 | Security | 신규 상수(`NON_TERMINAL_OR_FAILED_STATUSES_SQL`)를 포함한 raw SQL 문자열 보간을 재확인 — 두 상수 모두 고정 TS enum(`ExecutionStatus`)에서만 파생되고 가변 입력은 전부 파라미터 바인딩(`$1`/`:id`)으로 처리돼 인젝션 벡터가 아니다. | `execution-engine.service.ts:505-543,8176-8181,8462-8473` | 조치 불필요 |
| 9 | Dependency/Performance/Database | 신규 외부 의존성·패키지 버전 변경 없음(package.json/lockfile diff 0), 쿼리 카디널리티·인덱스 사용 패턴도 불변(모든 변경이 PK 단건 조회/UPDATE, 정적 SQL 상수는 클래스 로드 시 1회만 계산) — 순수 내부 로직 수정. | 전 5개 대상 파일 공통 | 조치 불필요 |
| 10 | User Guide Sync | "실행·디버깅 흐름 변경" trigger 후보로 검토했으나, 이미 `run-results.mdx`(+`.en.mdx`)에 상세 문서화된 "멀티턴 대화 재시도" 기능의 내부 원자성 버그 수정이라 신규 사용자 가시 계약 변경이 없다 — 사용자 가이드 동반 갱신 불요. | `codebase/frontend/src/content/docs/05-run-and-debug/run-results.mdx` | 조치 불필요 — 재시도 정책 자체(제한시간·재시도 가능 오류 유형)가 바뀔 때만 동반 갱신 필요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | fix 가 기존 정보노출/오분류 결함을 제거(순개선); SQL fan-out 재발 위험 WARNING 1건 |
| performance | NONE | 성능 영향 없음(정적 1회 계산, 쿼리 카디널리티·복잡도 불변) |
| architecture | LOW | retry-reentry 불변식이 6+ 지점 수동 boolean 전파에만 의존(구조적 재발 위험), SQL 삼항식 중복 |
| requirement | MEDIUM | re-park 시나리오 회귀 테스트 부재(WARNING, testing 의 CRITICAL 과 동일 사안), `FAILED→WAITING_FOR_INPUT` 전이 SPEC-DRIFT |
| scope | NONE | 결함 수정에 필요한 파일만 정확히 변경, 무관 변경 없음(1줄 spec 자기교정만 disclosed) |
| side_effect | LOW | 시그니처 확장 전부 하위호환, `segmentStartMs` 1턴 under-count 정보성 관찰 |
| maintainability | LOW | SQL 삼항식 2곳 + opts 변환 boilerplate 4곳 중복(헬퍼 추출 권고) |
| testing | HIGH | "turn 계속→re-park" 경로 회귀 테스트 전무(CRITICAL), 전용 unit 2곳 opts 미인지, e2e 전무 |
| documentation | HIGH | `FAILED→WAITING_FOR_INPUT` 전이 SoT spec 미반영(CRITICAL), CHANGELOG 누락, 자매 함수 JSDoc 불일치 |
| dependency | NONE | 신규 외부 의존성 없음, 순수 내부 로직 수정 |
| database | LOW | 재-park 시 stale `error`/`finishedAt`/`durationMs` 재기록(WARNING), SQL fan-out 중복 |
| concurrency | LOW | 8R CRITICAL 수정 정확성 확인(전체 호출체인 추적+591개 테스트 실행), 형제 FAILED 노드 동시 재진입 시나리오 신규 활성화(WARNING) |
| api_contract | NONE | REST/WS 계약 표면 불변, `_retryState` 내부 키 제거만 확인(비-계약 필드) |
| user_guide_sync | NONE | 사용자 가이드 동반 갱신 불요(이미 문서화된 기능의 내부 정합성 수정) |

## 발견 없는 에이전트

performance, scope, dependency, api_contract, user_guide_sync — 5개 에이전트가 Critical/Warning 없이 위험도 NONE 으로 판정(확인성 INFO 만 존재).

## 권장 조치사항

1. `execution-engine.service.spec.ts` 의 `applyRetryLastTurn` 스위트에 "turn 계속(re-park)" 시나리오 fixture 를 추가 — `dbExecutionStatus=FAILED` 상태에서 opts 전파로 `WAITING_FOR_INPUT` 까지 실제 persist 되는지 mutation-test 수준으로 회귀 잠금 (Critical #1).
2. `spec/5-system/4-execution-engine.md`(§1.1 표/다이어그램/Rationale), `spec/5-system/6-websocket-protocol.md`(§4.2), `spec/4-nodes/3-ai/1-ai-agent.md`(§7.9/§12.8)에 `FAILED→WAITING_FOR_INPUT` 전이 반영 — `project-planner` 턴으로 위임(SPEC-DRIFT, 코드는 유지) (Critical #2).
3. `RetryTurnService.applyRetryLastTurn` 진입 시 `execution.error`(+ 가능하면 `finishedAt`/`durationMs`)를 명시적으로 초기화해 재-park/재개 시 stale 오류 정보 노출 방지 — 기존 plan #5 와 통합 해결 (Warning #1).
4. 한 Execution 내 복수 FAILED 멀티턴 노드의 동시 `retry_last_turn` 가능성을 제품 설계 차원에서 확인하고, 필요시 동시성 통합/e2e 테스트 또는 불변식 문서화 (Warning #2).
5. `execution-engine.service.ts` 의 SQL 상태목록 선택 삼항식(8173-8175, 8459-8461)을 `resolveGuardStatusesSql` 류 단일 헬퍼로 통합 (Warning #3, 재발 이력 있는 자리).
6. `ai-turn-orchestrator.service.ts` 의 `flag→opts` 변환 boilerplate 4곳을 단일 헬퍼(`toRetryReentryOpts`)로 통합 (Warning #5).
7. `linkedNodeExec`/`tryLockActiveExecutionAndSaveNodeExec` 전용 unit describe 2곳에 opt-in SQL 단언 보강, `retry_last_turn` 전체 흐름 e2e 백로그 등재 (Warning #6, #7).
8. `CHANGELOG.md` 에 이번 "8R CRITICAL" fix 항목 추가(기존 관례 정합) (Warning #8).
9. `tryLockActiveExecutionAndSaveNodeExec` 의 JSDoc(`@returns`) 및 `engine-driver.interface.ts` 미러에 opt-in 시 FAILED 포함 뉘앙스 반영 (Warning #9).
10. (선택) retry-reentry 불변식을 단일 진입점으로 캡슐화하거나 소비처 체크리스트를 문서화해 구조적 fan-out 재발 위험 완화 (Warning #4).

## 라우터 결정

- `routing_status=skipped` — 라우터 미사용(사유 미기재, prompt 에 `routing_skip_reason` 값 없음). 전체 14개 reviewer 실행(skipped 없음).
- **강제 포함(router_safety)**: `maintainability, requirement, scope, security, side_effect, testing` (6명) — 전원 결과 확보 확인, 화이트리스트 미이행 없음.
- **실행**: `security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, dependency, database, concurrency, api_contract, user_guide_sync` (14명, 전원).
- **제외**: 없음.