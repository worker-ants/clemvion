# Code Review 통합 보고서

## 전체 위험도

**MEDIUM** — CRITICAL 0건. 14개 reviewer 전원 결과 확보(forced 화이트리스트 6명 포함 미이행 없음). 개별 최고 위험도는 `maintainability`(MEDIUM) — `opts.allowRetryReentry`/`retryReentry` 배선 shape 이 5개 파일·9곳 이상에 중복 선언된 구조가 이번 브랜치에서 이미 2차례(8R·10R) CRITICAL 을 실제로 유발한 전력이 있어 구조적 재발 위험으로 유지. 여기에 `concurrency` 리뷰가 이번 라운드 처음으로 "Parallel 형제 브랜치가 활성 상태(RUNNING)인 동안 retry 재진입이 동일 live `ExecutionContext` 를 공유·동시 mutate 할 수 있는 구체적 경로"를 제시했다(미재현·개연성 평가) — 기존 defer #20 과 뿌리는 같지만 새 증거이므로 상단에 명시한다. 그 외 발견은 대부분 이미 `plan/in-progress/retry-turn-terminal-guard.md` 에 P2/P3 로 등재·추적 중인 항목의 독립 교차검증이며, 신규 CRITICAL 이나 인가 우회·크로스테넌트 노출은 없다.

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|

없음 — 14개 reviewer 전원 CRITICAL 0건.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 동시성/데이터정합성 | `retryLastTurn` 이 부모 `Execution.status` 를 검증하지 않고 `NodeExecution.status===FAILED` 만으로 spawn 을 진행한다. (a) 그 사이 Execution 이 `CANCELLED` 로 먼저 마감되면 spawn 된 NodeExecution 이 영구 `RUNNING` 고아로 남고(이미 defer #20, P2), (b) `ParallelErrorPolicy:'continue'` 로 형제 브랜치가 살아있어 Execution 이 여전히 `RUNNING` 인 경우 `rehydrateContext` 가 형제 브랜치와 **동일한 live `ExecutionContext` 객체**를 반환해 공유 가변 상태(`nodeOutputCache` 등)를 동시 mutate 할 수 있다(신규 관찰, 재현은 못했으나 개연성 있음, `finalizeAiNode` "RUNNING 유지" 분기를 실제로 여는 통로). | `retry-turn.service.ts` `retryLastTurn`(130-252), `ai-turn-orchestrator.service.ts` `finalizeAiNode`(1596-1601)/`reparkAiResumeTurn`, `execution-engine.service.ts` `rehydrateContext`(1468-1476), `context/execution-context.service.ts`(81,199), `containers/parallel-executor.ts`(9-37) | `retryLastTurn` 1.5단계로 `Execution.status===FAILED` 사전 검증 추가(spawn 이전 차단) — 이미 #20 에 제안된 수정으로 (a)(b) 모두 함께 닫힘. #20 의 서술에 (b) 시나리오(Parallel 형제 활성 중 공유 context race)를 추가해 근거 보강 권고. 검증용으로 "multi-turn AI 노드를 Parallel 브랜치에 두고 한 브랜치만 retry_last_turn 호출" 통합 테스트 1건 추가 제안. |
| 2 | 테스트 | DB 가드가 `allowRetryReentry` opt-in 상태에서도 `COMPLETED`/`CANCELLED` 를 여전히 배제하는지 확인하는 대조 테스트가 없음 — state-machine 계층(`canTransition` 대칭 테스트 존재)과 DB-가드 계층의 커버리지 비대칭. 코드 자체는 직접 계산 검증 결과 정확함(`completed`/`cancelled` 는 opt-in 무관 항상 제외). | `execution-engine.service.ts` `NON_TERMINAL_OR_FAILED_STATUSES_SQL`(534), `lockNonTerminalExecutionRow`(8168), `updateExecutionStatus`(8354) / 테스트 `execution-engine.service.spec.ts:5115-5201` | `dbExecutionStatus=COMPLETED`(또는 `CANCELLED`) + `{allowRetryReentry:true}` 조합에서 `persisted===false` 를 단언하는 대조 테스트 1~2건 추가. |
| 3 | 테스트 | `tryLockActiveExecutionAndSaveNodeExec` 자체 단위 테스트(describe 블록, "RUNNING 유지 분기 전용")가 신규 `opts` 파라미터를 전혀 반영하지 않아 형제 메서드(`updateExecutionStatus`) 대비 비대칭. 특히 이 PR 의 실제 버그 시나리오였던 `finalizeAiNode` 의 isFailed 분기(재시도 재실패 케이스)가 이 메서드에 opts 를 정확히 전달하는지는 단 하나의 통합 테스트에만 의존한다(직접 추적으로 그 테스트가 실제로 회귀를 잡음은 확인). "RUNNING 유지" 하위분기 자체의 갭은 별도로 도달 가능성이 불명확한 방어 코드로 이미 defer #24(P3) 추적 중. | `execution-engine.service.spec.ts:5495-5573`(로컬 타입 5498-5501), `ai-turn-orchestrator.service.ts:1504-1509`(isFailed 분기), `:1596-1601`(RUNNING 유지 분기, defer #24) | 형제 `updateExecutionStatus` 테스트와 동일 패턴(`dbExecutionStatus=FAILED`+`{allowRetryReentry:true}` → SQL 에 `'failed'` 포함 확인)의 직접 단위 테스트 추가. |
| 4 | 테스트 | `execution.retry_last_turn` 원자 claim/짝 전이 가드에 대한 실 Postgres(e2e) 검증 부재 — 전부 Jest unit mock 레벨에서만 검증됨(`grep -rl "retry_last_turn" test/*.e2e-spec.ts` 0건). 이미 plan 에 P2(5R W6, §코드 표 #3)로 등재된 잔여 갭 재확인, 이번 diff 의 신규 회귀 아님. | `retry-turn.service.ts`(`claimSpawnedRetryRow`/`applyRetryLastTurn`), `execution-engine.service.ts`(`lockNonTerminalExecutionRow`/`tryLockActiveExecutionAndSaveNodeExec`/`updateExecutionStatus`) | 신규 등재 불요(이미 P2). 이 결함 계열(SQL/가드 로직 미묘한 오류)이 3라운드 연속 unit mock 정교화로만 대응돼 온 이력을 고려해 e2e 1건 우선순위 상향 검토 권고. |
| 5 | 유지보수성/구조 | `allowRetryReentry`/`retryReentry` opt-in 플래그 shape 이 5개 파일·9곳 이상에 인라인 구조적 타입으로 중복 선언되고, 원천 export 타입 `TransitionOptions`(`state-machine.ts`)를 아무도 import 하지 않음 — "상태 전이 허용 여부"라는 하나의 규칙이 TS 상태머신과 SQL 허용목록 상수(`NON_TERMINAL_STATUSES_SQL`/`NON_TERMINAL_OR_FAILED_STATUSES_SQL`) 두 곳에 독립 인코딩되는 이중 SoT 구조와 동일 근본원인. 이 구조 자체가 이번 브랜치에서 8R·10R 두 차례 CRITICAL 을 이미 유발했다. | `state-machine.ts:45`(`TransitionOptions` export), `engine-driver.interface.ts:81,219`, `execution-engine.service.ts:8171,8233,8358`, `ai-turn-orchestrator.service.ts:220,442,1437` (+ 번역 지점 `:457,1508,1600,1619`), `retry-turn.service.ts:466` | `TransitionOptions` 를 4개 소비 파일에 import 해 인라인 리터럴 교체. SQL 허용목록은 상태머신에서 파생 생성하거나 헬퍼로 통합(이미 팀 defer #21/#22, P2/P3 — 신규 백로그 불요, 우선순위 재고만 권고). |
| 6 | 유지보수성 | `NON_TERMINAL_STATUSES_SQL` / `NON_TERMINAL_OR_FAILED_STATUSES_SQL` 두 static 상수가 `filter` 조건 한 줄만 다르고 나머지 빌드 체인(`Object.values(...).filter(...).map(...).join(...)`)이 100% 동일 — 세 번째 예외 상태가 필요해지면 세 번째 상수가 또 생길 위험. | `execution-engine.service.ts:513-518`(기존), `:534-543`(신규) | `private static buildStatusesSql(extraIncluded: ExecutionStatus[] = [])` 헬퍼로 일반화. |
| 7 | 유지보수성 | "opts→`allowRetryReentry` 번역" 3줄 삼항식(`retryReentry ? {allowRetryReentry:true} : undefined` 류)이 `ai-turn-orchestrator.service.ts` 한 파일에서만 4번(`finalizeAiNode` 3곳 + `reparkAiResumeTurn` 1곳) 손으로 반복됨 — 바로 이 "번역 한 줄"이 10R CRITICAL(뮤턴트가 표현식을 치환해도 shape 단언만 통과, 로직 무검증)의 직접 원인이었다. | `ai-turn-orchestrator.service.ts:457,1508,1600,1619`, `execution-engine.service.ts:8173-8175`(`statusesSql`)·`:8459-8461`(`elseStatusesSql`) | `finalizeAiNode` 상단에서 1회 계산한 `retryReentryOpts` 상수를 3개 호출부가 재사용하도록 리팩터, 변수명도 `statusesSql`/`elseStatusesSql` 로 갈리지 않게 통일. |
| 8 | 문서화 | `updateExecutionStatus` 의 JSDoc 이 신규 `opts.allowRetryReentry` 파라미터를 전혀 설명하지 않음 — 이 서비스의 "상태 전이 단일 choke point"이자 정확히 이번 CRITICAL 이 고친 결함의 당사자 함수인데, 같은 PR 에서 갱신된 형제 함수(`tryLockActiveExecutionAndSaveNodeExec`, `lockNonTerminalExecutionRow`)와 달리 이 함수만 관례에서 빠짐. | `engine-driver.interface.ts:49-82`(`CoreEngineDriver.updateExecutionStatus` docblock), `execution-engine.service.ts:8354`(구현부 시그니처) | 형제 함수와 동일 형식으로 `@param opts.allowRetryReentry` 절을 인터페이스·구현부 양쪽에 추가. |
| 9 | 요구사항/에러메시지 | `retryLastTurn` 의 두 사전 검증(NodeExecution 미존재/`status!==FAILED`)이 재사용하는 `InvalidExecutionStateError` 의 고정 client-safe 메시지("Execution is not waiting for input.")가 원래 다른 명령군(`waiting_for_input` 계열)을 위해 설계된 문구라 retry_last_turn 실패 사유와 의미상 맞지 않음(신규 발견). `RetryLastTurnError` 는 이미 상황별 정적 팩토리로 이 문제를 피하고 있어 패턴이 비대칭. 관련 테스트도 `code` 만 단언하고 `message` 는 검증하지 않아 drift 가 회귀로 잡히지 않음. | `retry-turn.service.ts:138-142,144-148`, 근본원인 `workflow-errors.ts:113-118`(범위 밖) | `InvalidExecutionStateError` 에 `RetryLastTurnError` 와 동일한 정적 팩토리(예: `.notFailed(detail)`)를 추가해 retry_last_turn 전용 문구 분리, 또는 최소 JSDoc 명시 + 회귀 테스트에 `message` 단언 추가. |
| 10 | 보안 | 배선(opts 전파)이 끊기면 `assertTransition` 이 DB 가드 진입 전 동기 `throw new Error(...)` 하고, 이 원문 메시지가 client-safe 매핑 없이 `EXECUTION_FAILED` WS 이벤트의 `error` 필드로 그대로 노출될 수 있음 — 같은 파일이 `RetryLastTurnError`/`InvalidExecutionStateError` 에는 "고정 client-safe 문자열" 규약을 명시해 두었는데 상태머신 어설션 예외만 그 규약 밖에 있어 대칭이 깨짐. 노출 문자열은 `ExecutionStatus` enum 값뿐이라 민감도는 낮음. | `state-machine.ts:100-104`(`assertTransition`), `ai-turn-orchestrator.service.ts:439`(JSDoc), `retry-turn.service.ts:926,956,959`(`failRetryExecution`) | `failRetryExecution`(및 형제 소비처)에서 state-machine `Error` 를 client-safe 고정 문구로 매핑 후 원본은 로그로만 남기는 방식 검토. 이번 PR 이 추가한 wiring 회귀 테스트를 상시 가드로 유지. |
| 11 | 문서동기화 | `run-debug-flow-change` 트리거로 `run-results.mdx`(ko)/`.en.mdx` 양쪽에 "재시도 성공 시 두 갈래(대화 종료→downstream 진행 / 대화 계속→입력 대기 복귀)" 안내가 동반 추가됐으나, EN 판은 신규 문단이 `Retryable`/`Not retryable` 두 항목으로 구성된 기존 분류 목록 **중간에 삽입**돼 그 목록 구조가 끊기고(KO 는 목록 뒤에 배치돼 문제 없음), 두 로케일 모두 몇 줄 뒤 기존 무조건문("downstream 이 이어서 실행돼요")이 방금 도입한 조건부 설명과 문맥상 다소 상충. | `run-results.en.mdx:93-101`(목록 구조 손상), `run-results.mdx:107-115`(ko, 기존 문장과 문맥 중복) — 이번 리뷰의 "리뷰 대상 파일" 5건 목록 밖(같은 커밋의 부수 변경) | EN: 신규 블록을 `Not retryable` 뒤·"60분 제약" 문단 앞으로 이동해 KO 와 동일 순서로 정렬. ko/en 공통: 마지막 무조건문에 "대화가 끝난 경우에 한해" 조건 명시 또는 신규 문단에 흡수 통합. |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 성능 | `NON_TERMINAL_STATUSES_SQL`/`NON_TERMINAL_OR_FAILED_STATUSES_SQL` 은 `private static readonly` 로 클래스 로드 시 1회만 평가 — 요청마다 재계산되지 않아 핫패스 비용 0. | `execution-engine.service.ts:513,534` | 조치 불요. |
| 2 | 성능 | `lockNonTerminalExecutionRow`/`updateExecutionStatus` 의 opts 선택은 두 정적 문자열 중 하나를 고르는 O(1) 삼항 연산 — 트랜잭션 경계·쿼리 횟수·라운드트립 모두 변경 전과 동일, 추가 DB 왕복 없음. | `execution-engine.service.ts:8168-8184,8224-8253,8354-8484` | 조치 불요. |
| 3 | 성능 | opts 관통 전달에 따른 소규모 객체 리터럴 할당은 AI 노드 turn 경계(re-park/finalize)마다 최대 1회뿐이라 GC 압력 무시 가능(핫루프 아님). 이번 fix 로 이전엔 매 retry 마다 발생하던 "쓸모없는 트랜잭션 + 폴백 경로 추가 쓰기" 이중비용도 오히려 줄어듦. | `ai-turn-orchestrator.service.ts:237-243,303-309,321-327,339-345,430-459,1505-1508,1597-1600` | 조치 불요. |
| 4 | 보안 | JSONB 원자 연산(`output_data - '${RETRY_STATE_KEY}'` 등) SQL 조립에 문자열 템플릿 리터럴을 쓰지만 보간값은 컴파일타임 상수(`RETRY_STATE_KEY`)/enum 뿐이고 가변 식별자는 전부 `$1`/`:id` 파라미터 바인딩 — 현재 인젝션 벡터 없음. | `retry-turn.service.ts`(`retryLastTurn`/`claimSpawnedRetryRow`), `execution-engine.service.ts:513-543` | 조치 불요(현행 유지, 코드리뷰 관례로 계속 확인). |
| 5 | 아키텍처 | `finalizeAiNode` 의 opts 소비 3분기(FAILED/RUNNING 유지/RUNNING 재claim) 중 "RUNNING 유지" 분기만 이번 라운드 mutation-검증 테스트 대상에서 빠짐 — 도달 가능성 자체가 불명확한 방어 코드로 서술됨(testing WARNING #3 과 동일 지점, 다른 각도). | `ai-turn-orchestrator.service.ts:1596-1601` | 이미 defer #24(P3) — "도달 불가 확정 시 JSDoc 명시, 도달 가능해지면 대칭 테스트 추가". |
| 6 | 테스트 | `assertTransition`(throw 래퍼) 레벨 회귀 테스트가 이번 diff 의 신규 opt-in 대상(`WAITING_FOR_INPUT`)을 다루지 않고 여전히 FAILED→RUNNING 쌍만 확인 — `canTransition` 레벨은 양방향 커버됨. | `state-machine.spec.ts:178-192`(대비 93-127) | `assertTransition(FAILED, WAITING_FOR_INPUT, {allowRetryReentry:true})` not-throw / 미지정 시 throw 대조 테스트 1쌍 추가(저비용). |
| 7 | 유지보수성 | `finalizeGuarded` 에 2~4차 라운드에 걸친 CRITICAL 수정 이력이 인라인 주석 약 40줄로 누적(실제 로직은 15줄 안팎) — 실질 가치는 있으나 신규 독자의 진입장벽 증가. | `retry-turn.service.ts:554-678` | 다음 정리 라운드에서 안정화된 과거 서술은 spec `## Rationale`/`plan/complete/` 로 이관 검토. |
| 8 | 유지보수성 | `canTransition` 의 retry 재진입 허용 대상이 `||` 개별 비교 체인으로 하드코딩돼 `ALLOWED_TRANSITIONS`(배열 `.includes`)와 스타일이 갈림 — 세 번째 대상 추가 시 조건식이 계속 길어짐. | `state-machine.ts:72-77` | `RETRY_REENTRY_TARGETS` 배열 선언 후 `.includes(to)` 로 통일. |
| 9 | 의존성 | `package.json`/`pnpm-lock.yaml` 변경 0건, 리뷰 대상 5개 파일 및 브랜치 전체에서 신규 외부 패키지 import 0건 — 원자 claim 도 별도 분산 락 라이브러리 없이 기존 TypeORM QueryBuilder + JSONB 관용구 재사용. | 저장소 루트, `codebase/backend/package.json` | 조치 불요. |
| 10 | 의존성 | `retry-turn.service.ts` 의 CRITICAL #2 근거 주석이 TypeORM 특정 patch 버전(0.3.30)의 비공개 동작을 인용하지만, 같은 주석이 이미 "버전-불문 방어"임을 명시해 실질 리스크는 낮음(이번 diff 는 이 텍스트 미변경). | `retry-turn.service.ts:359,369`, 대조 `package.json:88`(`^0.3.28`) | 조치 불요(신규 아님). |
| 11 | 문서화 | `applyRetryLastTurn` 의 인라인 주석이 retry 재진입 두 갈래(종료 시 FAILED→RUNNING vs 계속 시 FAILED→WAITING_FOR_INPUT) 중 종료 쪽에만 `retryReentry` opt-in 을 괄호로 명시해, 이 줄만 보면 계속 쪽엔 opt-in 이 불필요한 것처럼 비대칭으로 읽힘(실제 구현은 양쪽 다 정확히 opt-in 전파됨 — 표현 문제일 뿐). | `retry-turn.service.ts:455-457` | 괄호 설명을 "종료 시 FAILED→RUNNING, 계속 시 FAILED→WAITING_FOR_INPUT 둘 다 opt-in 허용" 으로 대칭 확장. |
| 12 | 부작용 | 이번 fix 로 이전엔 짝 전이가 항상 0행이라 도달 불가능했던 `recordRunningSegmentStart` 호출(`segmentStartMs.set()`)이 retry 재진입 성공 시 처음 실행 가능해짐 — §8 active-running 누적 불변식과 일치하는 의도된 활성화이고, 기존 3개 소거 지점이 executionId 단위로 이미 커버해 신규 누수 표면 아님. | `execution-engine.service.ts:8436` | 조치 불요(참고 기록). |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | 상태머신 예외 client-safe 미매핑 노출(WARNING #10), retryLastTurn 부모상태 미검증(WARNING #1과 합류), 이중 SoT/opts shape 중복(WARNING #5와 합류), JSONB SQL 보간(INFO #4) |
| performance | NONE | 순수 O(1) 변경(정적 SQL 선택 + 삼항) — 알고리즘/메모리/I/O 영향 없음, 오히려 폴백 경로 제거로 리소스 절감 |
| architecture | LOW | 이중 SoT(WARNING #5)·opts shape 중복(WARNING #5)·RUNNING유지분기 미검증(INFO #5) 3건 모두 기존 defer #21/#23/#24 교차검증, 신규 없음 — OCP/ISP 준수는 긍정 평가 |
| requirement | LOW | InvalidExecutionStateError 메시지 부정확(WARNING #9, 신규), retryLastTurn 부모상태 미검증(WARNING #1과 합류, 기존 #20) — opts 배선 line-level 검증 완료, spec 일치 |
| scope | NONE | 리뷰대상 5개 파일 스코프 위반 0건(import/포맷팅/무관 리팩터 전무), out-of-list 문서(run-results ko) 문맥 중복 INFO 1건만(WARNING #11과 연관) |
| side_effect | NONE | 신규 부작용 없음(공개 API·env·FS·네트워크 전무), 7R WARNING 이미 해소 확인, segmentStartMs 활성화는 의도된 결과(INFO #12) |
| maintainability | MEDIUM | opts shape 중복선언(WARNING #5)·SQL상수 빌드체인 반복(WARNING #6)·opts→가드 삼항변환 반복(WARNING #7) — 8R/10R CRITICAL 과 동형 구조가 그대로 잔존, 이번 라운드 최고 위험도 |
| testing | LOW | COMPLETED/CANCELLED 대조테스트 부재(WARNING #2), tryLockActiveExecutionAndSaveNodeExec opts 커버리지 갭(WARNING #3), e2e 부재(WARNING #4) — honest mock 전환이 이번 브랜치 결함을 실제로 드러낸 성과는 긍정 평가 |
| documentation | LOW | updateExecutionStatus JSDoc 누락(WARNING #8, 신규), run-results ko/en 모순(WARNING #11 과 합류, 참고용) — 5개 대상 파일 자체는 이례적으로 철저히 문서화됨 |
| dependency | LOW | 신규 외부 의존성 0건(INFO #9), opts shape 중복(WARNING #5 와 합류, 기존 defer #22 재확인) |
| database | LOW | COMPLETED/CANCELLED 대조테스트 부재(WARNING #2 와 합류), retryLastTurn 부모상태 미검증(WARNING #1 과 합류) — 트랜잭션/락/인덱스/N+1/커넥션관리 전부 이상 없음 |
| concurrency | LOW | Parallel 형제 브랜치 live context 공유 mutate 위험(WARNING #1 의 신규 (b) 시나리오 제공) — opts 전파 완결성·claim 원자성·락 순서는 전부 확인 완료 |
| api_contract | NONE | REST/WS 계약 표면(컨트롤러·DTO·ack/에러 shape) 변경 전무 — 유일한 wire 관측 효과(`_retryState` 필드 비노출)는 breaking 아닌 개선이며 회귀 테스트로 고정됨 |
| user_guide_sync | LOW | run-debug-flow-change 트리거 매칭, ko/en 동반갱신 시도됐으나 EN 목록 구조 손상(WARNING #11 주 출처) — 그 외 20개 매트릭스 행 전부 불일치(신규 노드/스키마/에러코드 없음, 실측 확인) |

## 발견 없는 에이전트

- **api_contract** — "해당 없음" 명시(REST/WS 계약 변경 전혀 없는 내부 엔진 로직 diff).
- **side_effect** — "없음(CRITICAL/WARNING 없음)" 명시(참고용 INFO 확인사항만 존재, WARNING #10/#12 참조).

## 권장 조치사항

1. **(최우선, 재발 방지)** `TransitionOptions`(`state-machine.ts`)를 `engine-driver.interface.ts`/`execution-engine.service.ts`/`ai-turn-orchestrator.service.ts` 에 import 해 인라인 중복 shape 9곳+ 통합, "opts→DB가드 삼항 변환" 4곳 반복도 단일 헬퍼/상수로 정리(WARNING #5·#6·#7) — 이 구조가 이미 8R·10R 두 차례 CRITICAL 을 유발했으므로 다음 정리 라운드 최우선 반영 권고(팀 defer #21/#22 와 일치, 신규 백로그 불요, 우선순위만 재고).
2. `retryLastTurn` 에 부모 `Execution.status===FAILED` 사전 검증 추가(WARNING #1) — 기존 defer #20(고아 RUNNING NodeExecution) 뿐 아니라 concurrency 리뷰가 이번에 새로 제시한 "Parallel 형제 브랜치 활성 중 live ExecutionContext 공유 mutate" 경로까지 동일 수정으로 함께 차단됨. 근거 보강 반영 권고.
3. `updateExecutionStatus`(인터페이스+구현부)의 JSDoc 에 `@param opts.allowRetryReentry` 절 추가(WARNING #8) — 형제 함수는 갱신됐으나 이 CRITICAL 의 당사자 함수만 누락.
4. DB 가드 opt-in 시 COMPLETED/CANCELLED 배제를 확인하는 대조 테스트 1~2건 + `tryLockActiveExecutionAndSaveNodeExec` 자체 단위 테스트에 신규 opts 커버리지 추가(WARNING #2·#3).
5. `InvalidExecutionStateError` 고정 메시지를 `retryLastTurn` 전용 정적 팩토리로 분리하고 회귀 테스트에 `message` 단언 추가(WARNING #9, 신규 발견).
6. `run-results.mdx`/`.en.mdx` ko/en 신규 문단 위치 통일 및 기존 문장과의 모순 제거(WARNING #11) — EN 목록 구조 복원 우선.
7. **(낮은 우선순위, 이미 추적 중)** `execution.retry_last_turn` 원자 claim e2e 테스트 추가 검토(WARNING #4), 상태머신 어설션 예외의 client-safe 매핑 보강(WARNING #10).

## 라우터 결정

- `routing_status=skipped` (`meta.json` 확인: `route_mode="all"`, `agents_explicit=false`) — 라우터 미사용, 전체 14개 reviewer 실행(스킵된 reviewer 없음). 별도 skip 사유 문자열은 입력에 제공되지 않음.
  - **실행**: 전체 14명 — security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, dependency, database, concurrency, api_contract, user_guide_sync
  - **제외**: 없음
  - **강제 포함(router_safety) 화이트리스트**: `maintainability, requirement, scope, security, side_effect, testing` (6명) — 라우터가 스킵되어 강제 지정 여부와 무관하게 전원 실행되었으며, 6명 전원 결과(success + 전문) 확보를 확인함. 화이트리스트 미이행 없음.