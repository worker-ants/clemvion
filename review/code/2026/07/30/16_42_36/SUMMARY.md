# Code Review 통합 보고서

## 전체 위험도

**HIGH** — 8R CRITICAL(`execution.retry_last_turn` 재진입 짝 전이가 DB 가드에 막혀 절대 persist 되지 않던 결함) 자체의 수정은 다수 reviewer(concurrency/database/side_effect/architecture/security 등)가 호출 체인 전체를 직접 추적해 정확함을 확인했다. 그러나 (1) 그 수정의 핵심 glue code(`reparkAiResumeTurn`의 opts→DB가드 번역)가 **전 테스트 계층에서 무검증**임을 testing reviewer 가 뮤테이션으로 실증했고(CRITICAL) — 이 코드베이스가 정확히 이 결함 클래스로 8~9라운드째 반복 CRITICAL 을 내온 이력을 고려하면 다음 리팩터에서 같은 결함이 재발해도 테스트 스위트가 GREEN 을 유지할 실질적 위험이 있다 — (2) requirement reviewer 가 새 축(Execution 이 실제로는 `cancelled`인 사전 상태)에서 spawn 된 NodeExecution 이 영구 RUNNING 고아로 남는 미검증 경로를 발견했고(WARNING), (3) 이 PR 이 구현한 "재시도 후 대화 계속(re-park, 멀티턴에서 가장 흔한 케이스)" 이 사용자 가이드에 반영되지 않아 사용자가 재시도를 실패로 오인할 소지도 확인됐다(WARNING). forced 화이트리스트(6개) 전원 결과 확보 — 강제 목록 미이행 없음.

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | TESTING | `reparkAiResumeTurn`의 retry opts→DB 가드 번역 로직(`opts?.retryReentry ? { allowRetryReentry: true } : undefined`)이 어느 테스트 계층에서도 검증되지 않는다. 이 줄을 `undefined` 고정으로 뮤테이션한 뒤 관련 4개 spec 파일(`state-machine.spec.ts`/`ai-turn-orchestrator.service.spec.ts`/`retry-turn.service.spec.ts`/`execution-engine.service.spec.ts`) 593건을 재실행한 결과 **전원 GREEN**(0건 RED), e2e grep 도 0건. 8R 커밋이 스스로 "가장 흔한 시나리오"라 명시한 "turn 계속" 경로의 유일한 glue code가 무방비 상태 — 상태머신 계층과 DB-가드 계층이 각각 고립 테스트로는 옳아도 그 둘을 잇는 배선이 끊어져도 아무도 모른다 | `ai-turn-orchestrator.service.ts:457`(정의), `processAiResumeTurn` 내부 호출부 4곳(237/303/321/339) | 이미 존재하는 `describe('reparkAiResumeTurn — EngineDriver seam', ...)` mock-driver 하네스(`ai-turn-orchestrator.service.spec.ts:111`)에 `{retryReentry:true}` 호출 시 `driver.updateExecutionStatus`가 `{allowRetryReentry:true}`를 받는지 검증하는 테스트 1건만 추가하면 충분(대조군은 기존 5건이 이미 커버) |

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | ARCHITECTURE / MAINTAINABILITY | 상태 전이 "허용 여부"의 이중 진실 소스 — state-machine.ts 의 `ALLOWED_TRANSITIONS`/`canTransition` 과 execution-engine.service.ts 의 SQL allow-list 상수가 독립적으로 존재하고 수동으로만 동기화된다. 이번 8R CRITICAL 자체가 정확히 이 두 표현의 불일치로 발생했고, 수정 후에도 그 구조는 남는다. 게다가 두 SQL 상수(`NON_TERMINAL_STATUSES_SQL`/`NON_TERMINAL_OR_FAILED_STATUSES_SQL`)의 계산 골격과, opts 에 따라 어느 SQL 을 쓸지 고르는 3항 선택 로직 자체도 `lockNonTerminalExecutionRow`/`updateExecutionStatus` 두 곳에 토씨 하나 안 틀리고 반복돼 있다 | `state-machine.ts:31-58`, `execution-engine.service.ts:505-543,8168-8184,8354-8489` | DB 가드 SQL 을 `canTransition`/`ALLOWED_TRANSITIONS` 로부터 파생 생성하거나 최소 상호 참조 주석 추가; `buildStatusesSql(predicate)`/`resolveStatusesSql(opts)` 헬퍼로 통합 |
| 2 | ARCHITECTURE / MAINTAINABILITY | `{ allowRetryReentry?: boolean }` opts 타입이 이미 export 된 `TransitionOptions` 를 재사용하지 않고 **5곳**(state-machine.ts 원본 1 + engine-driver.interface.ts 2 + execution-engine.service.ts 2~3)에 인라인 구조적 타입으로 중복 선언(이번 diff 가 그중 3곳 신규 추가). 구조적 타이핑 때문에 지금은 컴파일 오류가 없지만, 향후 필드 추가/rename 시 컴파일러가 나머지 호출부를 강제 검사하지 못해 "일부 계층에서만 조용히 어긋나는" 결함(=이번 CRITICAL 과 동일 실패 양상)이 재발할 수 있다 | `state-machine.ts:45`, `engine-driver.interface.ts:81,213`, `execution-engine.service.ts:8171,8233,8358` | `TransitionOptions` 를 4곳에서 그대로 import 하거나 단일 타입 alias export 로 좁힐 것 |
| 3 | TESTING | `tryLockActiveExecutionAndSaveNodeExec` 의 "RUNNING 유지" 분기(`finalizeAiNode` 1600행) opts 전파가 무검증 — 동일 방식 뮤테이션 결과 593건 전체 GREEN. 코드 추적 결과 이 분기는 현재 호출 그래프상 도달 불가능해 보이는 방어적 코드이나, 대응 고립 단위테스트 2곳(`ai-turn-orchestrator.service.spec.ts:497`, `execution-engine.service.spec.ts:5495`)이 `opts` 파라미터 자체를 시그니처에도 반영하지 않아 8R 변경이 있었다는 사실조차 드러나지 않는다 | `ai-turn-orchestrator.service.ts:1600` | 도달 불가능이 맞다면 JSDoc 에 "방어적 코드, 현재 미도달" 명시; 향후 도달 가능해지면 isFailed 분기와 대칭으로 직접 단위테스트 추가 |
| 4 | TESTING | `applyRetryLastTurn` 통합 describe(`execution-engine.service.spec.ts:16785`, 실제 엔진을 배선하는 유일한 end-to-end 장소)에 "turn 계속(re-park)" 시나리오가 전무. 9R 커밋 메시지가 "통합 재현을 시도했으나 핸들러 반환 형태 문제로 FOR UPDATE 잠금 도달조차 못해 철회"라 이미 명시한 트레이드오프라 신규 결함은 아니나, 위 CRITICAL(#1)과 결합하면 "turn 계속" 경로를 실제 호출 체인으로 검증하는 테스트가 전무하다는 뜻이 된다 | `execution-engine.service.spec.ts:16785-16989` | 통합 재현이 막힌 정확한 이유(어떤 핸들러 반환 shape 문제)를 `plan/in-progress/retry-turn-terminal-guard.md` 에 남겨 반복 소모 방지; 최소 방어선은 CRITICAL #1 의 저비용 대안 우선 적용 |
| 5 | REQUIREMENT | `retryLastTurn`이 spec(`spec/5-system/6-websocket-protocol.md:368`)이 명시한 "Execution 이 retry 진입 가능 상태" 검증을 구현하지 않는다. Execution 이 (LLM 호출 도중 동시 Stop 레이스로) 실제로는 `cancelled`인 채 `_retryState`가 남은 NodeExecution 에 retry 를 시도하면, 재진입 턴 종료 시 `updateExecutionStatus`의 `assertTransition('cancelled', 'running'/'waiting_for_input', ...)`이 **DB 가드 진입 전에 동기 throw**해 `assertLinkedTransitionApplied`의 우아한 정리 경로를 우회하고, spawn 된 NodeExecution 이 영구 `RUNNING` 고아로 남는다(Execution 자신은 `cancelled`로 올바르게 유지됨). `state-machine.spec.ts`의 W5 테스트는 상태머신이 이 전이를 올바르게 **거부**하는지만 검증할 뿐, 그 거부가 호출부에서 우아하게 처리되는지는 검증하지 않는다 | `retry-turn.service.ts:130-148,373-390`, `execution-engine.service.ts:8360`, `ai-turn-orchestrator.service.ts:453-458,1596-1629` | (근본) `retryLastTurn`에 `Execution.status === FAILED` 명시 검증 단계(step 1.5) 추가, 위반 시 `InvalidExecutionStateError`로 스폰 이전에 거부; (방어) `finalizeAiNode`/`reparkAiResumeTurn`의 `updateExecutionStatus` 호출을 try/catch 로 감싸 `assertTransition` throw 도 `assertLinkedTransitionApplied` 경로로 흡수 |
| 6 | USER_GUIDE_SYNC | `run-results.mdx`/`run-results.en.mdx`(ko/en 동일 결함)의 "재시도 성공" 설명이 이번 changeset 이 구현한 "재진입 turn 이 계속되는 경우(re-park, spec §12.8 이 스스로 "멀티턴에서 가장 흔함"이라 명시)"를 언급하지 않는다. 현재 문구는 "재시도가 성공하면 downstream 노드가 이어서 실행된다"뿐이라, 사용자가 [다시 시도] 후 downstream 미실행을 보고 실패로 오인할 소지가 있다 | `run-results.mdx:109`, `run-results.en.mdx:98` | 두 파일의 콜아웃에 "대화가 계속되는 경우 downstream 대신 새 AI 응답이 표시되며 '입력 대기'로 복귀한다" 취지 문장 ko/en 동시 추가 |
| 7 | DOCUMENTATION | `AiTurnEngineDriver.tryLockActiveExecutionAndSaveNodeExec` 의 신규 `opts` 파라미터가 인터페이스 JSDoc 에 전혀 반영되지 않음 — 구현부(`execution-engine.service.ts:8224`)는 왜 필요한지 상세히 설명하는 반면, DI 로 실제 주입받는 계약면(인터페이스)만 보는 소비자는 `opts` 존재 자체를 알 수 없다. 이 파일은 "시그니처만 바뀌고 문서가 안 따라가는" 같은 패턴을 이전에도 겪은 이력이 있다 | `engine-driver.interface.ts:185-214`(JSDoc), `:213`(신규 파라미터) | `@param opts.allowRetryReentry` 항목을 구현부 인라인 주석 요약과 함께 추가 |
| 8 | DOCUMENTATION / SCOPE | `spec/5-system/4-execution-engine.md` 에 이번 PR 의 spec 편집 부산물로 이중 리스트 마커 오타 발생 — "세 번째 갈래" 신규 불릿 삽입 과정에서 기존 불릿이 `- - 재진입 성공 시...` (대시 2개)로 바뀜. 마크다운 렌더러에 따라 리터럴 `-` 노출 또는 의도치 않은 중첩 리스트로 표시될 수 있다 | `spec/5-system/4-execution-engine.md:1522` | `- -` → `-` 한 글자 정정 |
| 9 | DOCUMENTATION | `CHANGELOG.md`가 이 PR 체인 전체(8R CRITICAL 포함, 3라운드 연속)를 반영하지 않음 — 직전 문서화 리뷰(7R)가 이미 INFO 로 지적하고 이월했던 항목이 8R·9R 을 더 거치는 동안에도 반영되지 않았다. 특히 8R 은 "이 기능이 한 번도 실제로 persist 된 적이 없었다"는 이 PR 체인에서 가장 심각한 발견인데도 기록이 없다 | `CHANGELOG.md` 최상단 절 | 8R CRITICAL 요지("retry_last_turn 재진입 짝 전이가 DB 가드 불일치로 절대 persist 되지 않던 결함 수정")를 CHANGELOG 에 추가; `plan/in-progress/retry-turn-terminal-guard.md` 에도 번호 있는 항목으로 등재 |
| 10 | MAINTAINABILITY | `applyRetryLastTurn`이 라운드를 거듭할수록 책임과 분기 수가 계속 늘어남 — not-found 가드 → 멱등 fast-path → 원자 claim → 방어 분기 → in-memory sync → 병렬 조회 → context rehydrate → emit → turn 위임까지 약 10단계·조기 반환 7개 안팎이 한 함수에 몰려 있다. 같은 파일이 이미 `claimSpawnedRetryRow`/`buildRetryReentryState`를 SRP 목적으로 추출한 선례가 있다 | `retry-turn.service.ts:288-483` | "fast-path 확인 → atomic claim → 방어적 확인 → in-memory sync" 블록(301-369행)을 `claimAndLoadRetryState` 류 헬퍼로 추출 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | CONCURRENCY | `allowRetryReentry`/`retryReentry` opt-in 이 타입 레벨이 아니라 관례(주석)로만 scope 제한된다 — 오늘 시점 전수 grep 으로는 발화점이 `retry-turn.service.ts:466` 한 곳뿐이라 안전하나, 이 이름을 아는 사람이 향후 다른 재개 기능에서 무심코 재사용하면 컴파일러/린트가 막지 못한다 | `execution-engine.service.ts:8354,8224`, `ai-turn-orchestrator.service.ts:430,1426` | narrow 타입 분리 또는 브랜드 타입 검토; 저비용 대안으로 SQL 상수 선택 지점에 "새 호출부 추가 전 필독" 린트 주석 앵커 |
| 2 | DATABASE / SECURITY / CONCURRENCY | `claimSpawnedRetryRow` claim 실패 시 ack-and-discard 하면 spawn 된 NodeExecution row 가 `RUNNING`으로 영구 잔류할 수 있음(부모 Execution 은 이미 terminal 이라 `recoverStuckExecutions` 백스톱이 닿지 않음) — **신규 아님**, `plan/in-progress/retry-turn-terminal-guard.md` #15(P2)에 이미 등재된 의도적 트레이드오프(활성 작업을 오판해 죽이는 것보다 안전) | `retry-turn.service.ts:485-536` | 별도 조치 불요(plan #15 우선순위 유지); 여유 시 "FAILED Execution + RUNNING NodeExecution" 패턴 스캔 백스톱 잡 검토 |
| 3 | DATABASE / CONCURRENCY | 신규/확장된 raw JSONB atomic-consume SQL(`jsonb_exists`/`-` 연산자)의 실제 Postgres 레벨 CAS 동작(동시 UPDATE 시 정확히 1/0 매칭)이 어느 테스트 계층에서도 실행되지 않음 — **신규 아님**, plan #3/#18 에 이미 등재된 기존 갭 | `retry-turn.service.ts:205-227,538-551` | plan 우선순위(P2) 따름; 여유 시 실 테스트 DB 대상 좁은 integration 테스트 1건 검토 |
| 4 | SIDE_EFFECT | retry 재진입의 "턴 계속" 분기가 RUNNING 을 거치지 않고 FAILED→WAITING_FOR_INPUT 으로 직행 — 그 턴 1회에 한해 §8 활성-실행시간(`segmentStartMs`) 회계가 시작되지 않음(과소계상). 기존 "under-count 허용(W4)" 방침과 같은 방향이며 다음 턴부터는 정상 재개되어 영향은 1턴 국한 | `ai-turn-orchestrator.service.ts:452-458`, `execution-engine.service.ts:8375-8438` | 이번 CRITICAL fix 의 필수 범위 아님; §8 정확도가 중요하면 retry-reentry 전용 세그먼트 시작 기록 후속 검토 |
| 5 | MAINTAINABILITY | 계층별로 플래그 이름이 상이(`retryReentry` orchestrator 계층 vs `allowRetryReentry` engine 계층)하고 그 사이 변환 삼항식(`flag ? {allowRetryReentry:true} : undefined`)이 4곳에 반복 복사됨 | `ai-turn-orchestrator.service.ts:442,457,1439,1508,1600,1619` | 변환 로직을 1줄 헬퍼로 통합하거나 장기적으로 필드명 통일 |
| 6 | MAINTAINABILITY | `canTransition`의 신규 목적지-2개 OR 체인이 같은 파일 바로 아래(83행)의 `.includes()` 관용구와 스타일이 다름 — 예외 쌍이 더 늘면 가독성이 나빠짐 | `state-machine.ts:72-79` vs `:83` | `[ExecutionStatus.RUNNING, ExecutionStatus.WAITING_FOR_INPUT].includes(to as ExecutionStatus)` 형태로 통일 |
| 7 | DOCUMENTATION | `plan/in-progress/retry-turn-terminal-guard.md` 우선순위 표 #9 이 8R 로 반복 지점이 3곳→2곳으로 줄어든 사실을 반영 못해, 같은 문서 안에서 최신 서술(511줄, "2블록")과 표(334줄, "3곳 반복")가 불일치 | `retry-turn-terminal-guard.md:334` vs `:511` | "(3곳 반복)" → "(2곳 반복, 8R 로 1곳 감소)" 정정 |
| 8 | TESTING | `retry-turn.service.spec.ts`는 `applyRetryLastTurn → processAiResumeTurn` 호출에 `{retryReentry:true}`가 실제로 실렸는지 인자 단언이 없음(반환값만 mock) — `execution-engine.service.spec.ts`의 실제 엔진 배선 테스트가 간접적으로 잡아내므로 완전한 사각지대는 아니나 실패 시 원인 특정이 우회적 | `retry-turn.service.spec.ts` (mock 설정 지점 다수) | happy-path 테스트 1곳에 `toHaveBeenCalledWith(..., { retryReentry: true })` 단언 추가 |
| 9 | SECURITY | enum 기반 SQL 리스트(`NON_TERMINAL_(OR_FAILED_)STATUSES_SQL`)와 `RETRY_STATE_KEY` raw 문자열 보간 패턴은 현재 고정 enum/리터럴에서만 파생되어 인젝션 경로 없음(안전) — 다만 파라미터 바인딩이 아니라 template literal 삽입이라, 향후 이 상수의 출처가 실수로 사용자/설정값으로 바뀌면 조용히 인젝션 표면이 될 수 있는 구조 | `execution-engine.service.ts:513-543,8176-8182`, `retry-turn.service.ts:42,212-220,538-551` | 현 상태 변경 불필요; 두 상수를 절대 런타임/사용자 입력에서 파생시키지 않는다는 불변식 유지·문서화 |
| 10 | TESTING (긍정) | `mockTxManagerQuery`의 "정직한 mock" 전환(SQL 의 `status IN (...)` 리터럴과 `dbExecutionStatus`를 실제로 대조) — 8R 이전엔 SQL/status 무관하게 항상 성공을 반환해 DB 가드 결함을 8라운드 동안 은폐했으나, 지금은 이번 리뷰의 CRITICAL 뮤테이션 검증에서도 명확한 실패 신호를 제공 | `execution-engine.service.spec.ts:267-277` | 없음(개선 확인) |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | opt-in 발화점 단일 리터럴 확인(안전), SQL 상수 인젝션 경로 없음, `_retryState` 노출 축소는 개선 |
| performance | LOW | 신규 DB 왕복 1회(비루프·PK조회) 외 실질 영향 없음 |
| architecture | LOW | 이중 진실 소스 구조(WARNING #1) + opts 타입 5곳 중복 선언(WARNING #2)이 근본 원인이나 현재 배선은 정확 |
| requirement | MEDIUM | `retryLastTurn`이 Execution 상태(`cancelled` 등) 미검증 → orphan NodeExecution 가능(WARNING #5); 9R 회귀테스트·SPEC-DRIFT 는 해소 확인(INFO) |
| scope | LOW | 리뷰대상 5파일은 직전 라운드와 바이트 단위 동일(무변경); spec 문서 오타 1건(WARNING #8) |
| side_effect | LOW | 시그니처 확장 전부 호환, opt-in 발화점 단일 재확인; §8 활성시간 회계 1턴 누락(INFO #4) |
| maintainability | LOW | SQL 상수/3항 선택 로직 중복(WARNING #1), opts 타입 중복(WARNING #2), `applyRetryLastTurn` 비대화(WARNING #10) |
| testing | HIGH | `reparkAiResumeTurn` opts 번역 glue code 전 계층 무검증(CRITICAL #1, 뮤테이션 실증); RUNNING유지 분기·re-park 통합 시나리오도 무검증(WARNING #3·#4) |
| documentation | LOW | 인터페이스 JSDoc 미반영(WARNING #7), spec 오타(WARNING #8), CHANGELOG 3라운드 연속 미반영(WARNING #9) |
| dependency | NONE | 신규 외부 의존성 없음, 순수 내부 로직/타입 확장, DI 인터페이스 동기화 확인 |
| database | LOW | 3개 소비처 전수 전파 확인, 트랜잭션/인덱스/SQL인젝션 문제없음; orphan row·실DB미검증은 기존 P2(INFO #2·#3) |
| concurrency | LOW | opt-in 전파 정확·격리 확인, 단일-writer 불변식 유지; scope 가 타입 아닌 관례로만 제한(INFO #1) |
| api_contract | NONE | REST/WS 계약 표면 변경 없음 — 내부 엔진 전용 수정(대외 시그니처 불변) |
| user_guide_sync | MEDIUM | `run-results` 유저가이드가 re-park(가장 흔한 케이스)를 미반영(WARNING #6, ko/en 동일) |

## 발견 없는 에이전트

- **dependency** — 신규 외부 패키지/버전 변경 없음, 순수 내부 로직 수정 확인(전부 "문제 없음" 확인성 INFO)
- **api_contract** — REST/WS 대외 계약 표면에 이번 diff 가 포함되지 않음(해당 없음)

## 권장 조치사항

1. (최우선) `describe('reparkAiResumeTurn — EngineDriver seam', ...)` 기존 하네스에 `{retryReentry:true}` → `driver.updateExecutionStatus`가 `{allowRetryReentry:true}`를 받는지 검증하는 단위테스트 1건 추가 — 8~9라운드 반복된 결함 클래스가 재발해도 잡을 유일한 안전망(CRITICAL #1).
2. `retryLastTurn`에 `Execution.status === FAILED` 명시 검증 단계(step 1.5) 추가 — Execution 이 동시 Stop 레이스로 `cancelled`가 된 채 retry 가 시도되는 경로에서 spawn 된 NodeExecution 이 영구 RUNNING 고아로 남는 것을 스폰 이전에 차단(WARNING #5).
3. `run-results.mdx`/`run-results.en.mdx`에 "재시도 성공 후 대화가 계속되는 경우(가장 흔함) 입력 대기로 복귀" 안내를 ko/en 동시 추가(WARNING #6).
4. `{allowRetryReentry?: boolean}` opts 타입을 `TransitionOptions` 재사용으로 단일화하고, SQL 상수 계산/선택 로직을 헬퍼로 추출 — 향후 6번째 소비처 추가 시 동일 결함 클래스 재발 방지(WARNING #1·#2).
5. `engine-driver.interface.ts`의 `tryLockActiveExecutionAndSaveNodeExec` JSDoc 에 `opts` 파라미터 반영(WARNING #7), `spec/5-system/4-execution-engine.md:1522` 오타 정정(WARNING #8).
6. `CHANGELOG.md`에 8R CRITICAL(재진입 짝 전이 DB 가드 결함) 요지 기록 — 3라운드째 이월된 항목(WARNING #9).
7. (여유 시) `tryLockActiveExecutionAndSaveNodeExec`의 "RUNNING 유지" 분기 도달 가능성 재확인 후 JSDoc 명시 또는 대칭 테스트 추가(WARNING #3); `applyRetryLastTurn`의 "claim+검증" 블록 헬퍼 추출(WARNING #10).

## 라우터 결정

- `routing_status=skipped` — 라우터 미사용, 전체 reviewer(14명) 실행.
- **router_safety 강제 포함**: `maintainability, requirement, scope, security, side_effect, testing` (6명) — 전원 결과 확보됨(routing 자체가 skip 이라 강제 목록도 자연히 전체 실행에 포함). 강제 화이트리스트 미이행 없음.
- 제외된 reviewer: 없음(0명).