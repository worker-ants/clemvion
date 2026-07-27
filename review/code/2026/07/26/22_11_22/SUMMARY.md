# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — Critical 결함은 없음. 다만 architecture·requirement·concurrency 세 reviewer 가 독립적으로 동일한 잔여 TOCTOU(검사-후-사용) 창(`finalizeAiNode` "이미 RUNNING 유지" 분기)을 지목했고, requirement·documentation 은 CHANGELOG 가 CRITICAL#1 로 추가된 네 번째(코드 주석상 "정상 대화 종료의 주 경로") 소비처를 누락해 이 PR 이 고친 결함의 실제 심각도를 과소 서술한다고 지적했다. forced whitelist(7명: documentation·maintainability·requirement·scope·security·side_effect·testing) 전원 결과 확보 확인 — 강제 화이트리스트 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Concurrency/Architecture | `finalizeAiNode` 의 "이미 RUNNING 유지" 분기(CRITICAL#1 fix)는 형제 분기(`linkedNodeExec`, `SELECT...FOR UPDATE`)와 달리 행 잠금 없이 `assertExecutionNotCancelled`(단순 SELECT) 재확인 후 곧바로 `nodeExecutionRepository.save`+`NODE_COMPLETED`/`EXECUTION_RESUMED` emit 을 수행 — 체크 직후~save 사이의 좁은 창에서 이 PR 이 없애려던 "사후 오시그널"이 재발 가능. 신규 e2e/유닛 테스트 모두 이 마이크로 레이스는 재현하지 못함(architecture·requirement·concurrency 3개 reviewer 공통 지적) | `ai-turn-orchestrator.service.ts:1446-1464`; 대조 `execution-engine.service.ts:8159-8206`(FOR UPDATE) | `assertExecutionNotCancelled` 재확인과 `nodeExec` save 를 동일 트랜잭션의 `FOR UPDATE` 로 원자화하거나, 최소 save 직전 재확인 추가. 완전 해소가 어렵다면 plan 에 "알려진 잔여 리스크"로 명시 등재 |
| 2 | Requirement | `handleAiMessageTurn` 이 신규 turn-경계 취소 가드(LLM 호출 진입 이전)를 통과한 뒤, LLM 호출이 끝나면 취소 재확인 없이 `AI_MESSAGE`/`EXECUTION_WAITING_FOR_INPUT`(또는 terminal `AI_MESSAGE`)을 무조건 emit — 짝 전이/RUNNING 유지 가드는 그 이후 별도 메서드에서 실행되므로, LLM 호출 도중 Stop 을 눌러도 클라이언트는 "대화가 계속된다"는 이벤트를 먼저 받는다. DB 최종 상태는 안전하지만 사용자 체감상 이 PR 이 고치려던 증상("Stop 이 조용히 무효화된 것처럼 보임")과 같은 결이 남음. 3라운드 리뷰 모두 DB/반환값 관점에만 집중해 이 emit-순서 갭은 미발견 | `ai-turn-orchestrator.service.ts` `handleAiMessageTurn` (AI_MESSAGE emit 825-855/953-984, EXECUTION_WAITING_FOR_INPUT emit 888-923) | emit 직전에 `assertExecutionNotCancelled` 재확인을 추가해 취소 시 emit 을 건너뛰거나, 최소한 plan "후속" 절에 "표시상 신호 잔여"로 등재. FE 가 지연 도착한 `EXECUTION_WAITING_FOR_INPUT` 보다 `NODE_CANCELLED`/`EXECUTION_CANCELLED` 를 항상 우선하는지 별도 확인 필요 |
| 3 | Documentation | `CHANGELOG.md` 가 1차 라운드(20_10_51) 시점의 "AI 경로 3곳(re-park·첫 turn park·retry-last-turn RUNNING 재claim) 전부 소비" 서술에 멈춰 있어, 2차 라운드(21_08_01) CRITICAL#1 이 추가한 네 번째 소비처(`finalizeAiNode` "이미 RUNNING" 분기 — 코드 주석상 "정상 multi-turn 대화 종료의 주 경로")가 누락됨. 코드 JSDoc(`assertLinkedTransitionApplied`, `engine-driver.interface.ts`)은 정확히 갱신됐는데 CHANGELOG 만 stale — 이 결함의 실제 영향범위를 과소평가하게 만듦(requirement·documentation 공통 지적) | `CHANGELOG.md:9` | 항목을 "AI 경로 4곳"으로 정정하고, 4번째가 `updateExecutionStatus` 를 거치지 않는 별도 메커니즘(`assertExecutionNotCancelled` 직접 재관측)임을 명시 |
| 4 | Architecture | `markNodeCancelled` 호출 전 `nodeExec.outputData`/`error` 를 비워야 한다는 계약이 타입 시그니처가 아닌 호출부 주석(`assertLinkedTransitionApplied` 내부)으로만 강제됨 — 후속 form/button PR 이 이 헬퍼를 재사용하며 사전 초기화를 빠뜨리면 WARNING#10 이 고쳤던 "취소된 NodeExecution 이 성공 페이로드 노출" 문제가 재발 가능 | `ai-turn-orchestrator.service.ts:356-363`; `execution-engine.service.ts:4585-4611`(`markNodeCancelled` 구현) | `markNodeCancelled` 자신이 `outputData`/`error` 초기화를 항상 흡수하거나, 옵션 플래그(`clearPayload?`)로 인터페이스 시그니처에 명시 |
| 5 | Maintainability | 공유 헬퍼 `assertLinkedTransitionApplied` 의 첫 파라미터(`applied`)가 호출부마다 다른 의미로 쓰임 — re-park/첫 turn park/RUNNING 재claim 3곳은 `updateExecutionStatus` 의 실제 DB 반환값을, `finalizeAiNode` RUNNING 유지 분기는 `!cancelledExternally`(취소 미관측 플래그)를 넘김. 같은 이름이 "DB 전이 반영됨"과 "취소 미관측"이라는 이질적 계약을 가려, 후속 소비처가 오해하기 쉬움 | `ai-turn-orchestrator.service.ts:347`(정의), `:1454-1461`(호출부) | 파라미터명을 의미중립적으로(`shouldProceed`) 변경하거나 JSDoc 에 이중 계약을 명시 |
| 6 | Maintainability | `updateExecutionStatus` 의 `linkedNodeExec`/else 두 분기 끝에 동일한 4줄 마무리 블록(`recordRunningSegmentStart`+`emitTerminalExecutionMetrics`+`return persisted`)이 이번 PR 신규 코드에서 그대로 중복 이식됨 | `execution-engine.service.ts:8201-8205` vs `:8245-8249` | 공통 후처리를 함수 끝 단일 지점 또는 사설 헬퍼로 추출 |
| 7 | Side Effect | `markNodeCancelled`/`assertExecutionNotCancelled` 접근제어자가 `private`→`public` 으로 변경돼 `ExecutionEngineService` 공개 API 표면이 확대 — `AiTurnEngineDriver` 노출 목적의 의도된 변경(기존 `updateExecutionStatus` 선례와 일관)이나, concrete 클래스 직접 참조 코드가 DI 계약(turn/노드 경계에서만 호출)을 우회할 잠재 경로가 생김 | `execution-engine.service.ts:4586`, `:7996` | 별도 조치 불요(설계 의도). 후속 form/button PR 이 `ENGINE_DRIVER` 토큰 경유가 아닌 직접 참조를 추가하지 않는지 리뷰 시 확인 |
| 8 | Testing | `assertLinkedTransitionApplied` 가 던지는 `ExecutionCancelledError` 의 메시지(`phase`) 내용을 검증하는 테스트가 4개 소비처 전부에 없음 — WARNING#7(고정 접미사 제거) 회귀 재발 시에도 `.rejects.toBeInstanceOf(...)` 만으로는 RED 로 떨어지지 않음 | `ai-turn-orchestrator.service.ts:365-367`; 테스트 `ai-turn-orchestrator.service.spec.ts:182-208,233-254,361-393,498-526` | 각 소비처에 `.rejects.toThrow(/cancelled during .../)` 류 phase 문자열 단언 최소 1건 추가 |
| 9 | Testing/Maintainability | 신규 e2e("턴 진행 중 실 HTTP POST /stop")가 "RUNNING 관측" 단계는 `poll()` 로 프로젝트 컨벤션(고정 sleep 금지)을 따르면서, turn-finalize 완료 대기 단계는 고정 `setTimeout(2_500ms)` 로 되돌아감 — CI 부하 시 지연(1200ms)+큐 처리시간이 2.5초를 넘으면 결함과 무관하게 flake 발생 가능 | `execution-park-resume.e2e-spec.ts:1215` | `node_execution` 이 terminal 상태로 전이할 때까지 poll 하도록 변경(파일 내 재사용 가능한 `poll()` 헬퍼 존재) |

## SPEC-DRIFT

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SPEC-DRIFT | [SPEC-DRIFT] `spec/conventions/node-cancellation.md` §2.1(IE 행 — "resume 경로는 turn 경계 abort 체크를 별도 작업으로 추적" 서술 잔존)/§2.3(turn 경계 항목 부재)/§6(신규 가드 행 부재), `spec/5-system/4-execution-engine.md` §1.1("원자성 보장"이 짝 전이 no-op 가능성 미반영), `execution-engine.md ## Rationale` §C-1(멤버 수 12/7 → 실제 14/9)이 모두 이번 구현과 어긋남 — 코드(`engine-driver.interface.ts:36-41`)가 이 stale 수치를 스스로 명시하며 `spec-update-node-cancellation-shutdown-classification.md` #7 로 정정을 이미 위임해 둠(developer 는 spec 쓰기 권한 없음, 규약 준수) | `spec/conventions/node-cancellation.md:44,56-62,121-141`; `spec/5-system/4-execution-engine.md:79`; `execution-engine.md:1640`; 코드측 `engine-driver.interface.ts:36-41` | 코드 변경 불필요. `project-planner` 턴에서 `spec-update-node-cancellation-shutdown-classification.md` #7(보강 6~8번) 반영 — node-cancellation.md §2.1/§2.3/§6 갱신, execution-engine.md §1.1 예외 케이스 추가, `## Rationale` §C-1 12/7→14/9 정정 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security | `ExecutionCancelledError` 메시지에 `executionId` 포함되나, 신규 호출 3곳 모두 `markNodeCancelled` 에 `errorEnvelope` 미전달로 기존 W15/W19 관행("client 노출 금지") 준수 확인 — 결함 아님 | `ai-turn-orchestrator.service.ts:365-367` | 조치 불요. 향후 신규 catch 블록 추가 시 `.message` client 노출 금지 체크리스트화 |
| 2 | Security/Database | `NON_TERMINAL_STATUSES_SQL` 이 TS enum 값을 문자열 보간해 SQL `IN(...)` 절 구성 — 사용자 입력 아닌 컴파일타임 고정값이라 인젝션 경로 없음. `id` 는 정상 파라미터 바인딩 | `execution-engine.service.ts:507-512, 8184-8189, 8227` | 조치 불요. 향후 이 enum 이 외부 소스로 동적화될 경우 파라미터 바인딩(`= ANY($n::text[])`)로 전환 권고 |
| 3 | Security/Scope | `StubLlmClient` 의 `__e2e_delay_ms:<n>` 마커 — production 도달 불가(테스트 전용 클라이언트), `STUB_MAX_DELAY_MS` 상한 적용으로 무한 대기 방지, 기존 동작 보존 회귀 테스트 병행 추가됨 | `stub.client.ts:38-69` | 조치 불요. 다른 e2e 스위트와의 우연한 매칭 가능성만 유의 |
| 4 | Side Effect/Database | 짝 `NodeExecution` terminal 마킹(`markNodeCancelled`)이 Execution 을 판정한 `FOR UPDATE` 트랜잭션 커밋 **이후** 별도 `save()` 로 수행됨 — 그 사이 크래시 시 NodeExecution 이 non-terminal 로 잔류할 좁은 창(현재 stalled-recovery 백스탑 커버 여부 미확인) | `ai-turn-orchestrator.service.ts:347-368`; `execution-engine.service.ts:4586` | 크래시 윈도우 실질 영향 확인 후, 필요 시 `markNodeCancelled` save 를 동일 트랜잭션으로 전달 |
| 5 | Side Effect | `linkedNodeExec` 분기의 `FOR UPDATE` 잠금이 트랜잭션 커밋까지 유지되어, 동시 `stop()`(별도 비-트랜잭션 UPDATE) 경로가 짧게 직렬화 대기할 수 있음(교착 아님, 단일 행 잠금이라 데드락 가능성 낮음) | `execution-engine.service.ts:8181-8203` | 조치 불요. 고부하 환경에서 `stop()` 지연 체감 보고 시 트랜잭션 범위 축소 검토 |
| 6 | Side Effect | `assertExecutionNotCancelled` 가 turn 마다/대화 종료마다 스로틀 없이 신규 DB 재조회 추가(기존 노드 dispatch 루프 호출부는 `{throttle:true}` 사용) | `ai-turn-orchestrator.service.ts:658, 1449` | 조치 불요(의도된 트레이드오프). 고빈도 워크로드에서 DB 부하 문제 시 스로틀 적용 검토 |
| 7 | Side Effect | `assertLinkedTransitionApplied` 를 거의 동시에 두 소비처가 호출하면 이론상 `NODE_CANCELLED` 이벤트 중복 emit 가능(현재 순차 처리 모델상 실질 도달 가능성 낮음) | `ai-turn-orchestrator.service.ts:347-368` | 조치 불요(저확률·저영향). form/button 확장 시 재검토 |
| 8 | Architecture | `assertLinkedTransitionApplied` 의 `phase` 파라미터가 자유 문자열(stringly-typed) — 오탈자가 컴파일타임에 잡히지 않음 | `ai-turn-orchestrator.service.ts:347-354`, 호출부 4곳 | 우선순위 낮음. 리팩터 시 유니온 리터럴 타입 고려 |
| 9 | Architecture | (양성) `AiTurnEngineDriver` 전용 표면 확장·`NON_TERMINAL_STATUSES_SQL` 단일화는 기존 C-1 후속 ISP/DRY 방향과 일치하는 건전한 개선 | `engine-driver.interface.ts:116-165`; `execution-engine.service.ts:507-512` | 조치 불요 |
| 10 | Maintainability | `finalizeAiNode` 가 FAILED/RUNNING 유지/RUNNING 재claim 분기+이벤트 emit 을 모두 처리하는 다중 책임 함수로 계속 성장(이번 diff 로 분기 추가) | `ai-turn-orchestrator.service.ts:1310-1511` | 신규 청구 아님(유사 구조 리팩터는 이미 별도 라운드에서 defer). 다음 리팩터 후보로 등재 권고 |
| 11 | Maintainability | `updateExecutionStatus` `@returns` JSDoc 이 인터페이스/구현부 두 파일에 손으로 동기화 유지 — 이번 PR 이 고친 대상이 바로 이 문서쌍 드리프트였음(재발 가능 구조) | `engine-driver.interface.ts:44-58`; `execution-engine.service.ts:8112-8123` | 한쪽을 정본으로 삼고 나머지는 참조로 축약, 또는 상호 동기화 주석 배치 |
| 12 | Maintainability | `engine-driver.interface.ts` JSDoc 이 멤버 수(14/9)를 다시 하드코딩 — 이번 PR 이 고친 "12/7 stale" 과 동일 패턴 재도입 | `engine-driver.interface.ts:36-41` | 정확한 개수 대신 "멤버 추가/제거 시 Rationale §C-1 동시 갱신" 절차 문구로 대체 고려 |
| 13 | Testing | `NON_TERMINAL_STATUSES_SQL` 테스트가 `ExecutionStatus` enum 선언 순서에 암묵 결합(SQL `IN` 은 순서 무관인데 테스트는 특정 순서 하드코딩) | `execution-engine.service.spec.ts:4989-4993` | 순서 무관 단언(개별 상태 문자열 확인)으로 변경 |
| 14 | Testing | WARNING#10(outputData/error 취소 위생) 회귀가 4개 소비처 중 retry-last-turn 재claim 1곳에서만 직접 검증, CRITICAL#1(주 경로) 분기는 미검증 | `ai-turn-orchestrator.service.spec.ts:420` vs `:462-526` | CRITICAL#1 테스트에도 동일 단언 추가해 대칭 커버리지 완성 |
| 15 | Documentation | `DELAY_MARKER` 는 미-export module-private 상수인데 JSDoc `{@link}` 로 참조 — 문서 생성기 링크 해석 실패 가능(스타일 수준, 기존 관행과 일관) | `stub.client.ts` 클래스 JSDoc | 조치 불요(선택 사항) |
| 16 | Scope | `updateExecutionStatus` else 분기의 `segmentStartMs` 기록 시점 버그(WARNING#9)도 본 티켓 핵심(짝 전이 lost-update)과 별개로 함께 수정됨 — opportunistic fix, 회귀 테스트로 고정됨 | `execution-engine.service.ts:8140-8147, 8244-8247` | 조치 불요. RESOLUTION 표에 "범위 밖 opportunistic fix"로 명시하면 추적성 향상 |
| 17 | Scope | 무관한 백로그 plan 문서(`cafe24-backlog-residual.md`, `harness-consistency-summary-downgrade-rule.md`) 편집 포함 — 코드 스코프 침범 없이 발견된 사이드 이펙트를 격리 이관한 것으로, 프로젝트 컨벤션에 부합하는 올바른 처리 | 각 파일 신규 섹션 | 조치 불요 |
| 18 | Database/Concurrency | Form/Button interaction 4개 호출부(`form-interaction.service.ts:110,325`, `button-interaction.service.ts:395,567`)가 여전히 `updateExecutionStatus` 짝 전이의 `false` 반환을 미소비 — DB 자체는 안전하나 취소된 실행에 "정상 park" 이벤트가 잘못 emit 되는 표시 불일치 잔존. plan 에 이미 후속 추적됨(이번 diff 신규 결함 아님) | `engine-driver.interface.ts:44` 각주; `plan/in-progress/ie-resume-turn-boundary-cancel.md` "후속" 절 | 후속 PR 에서 `assertLinkedTransitionApplied` 패턴 재사용 적용 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 신규 인젝션/노출 벡터 없음. 기존 컨벤션(executionId 비노출) 준수 확인 |
| architecture | MEDIUM | finalizeAiNode TOCTOU 비대칭(WARNING), markNodeCancelled 사전초기화 암묵계약(WARNING) |
| requirement | MEDIUM | WS 이벤트가 취소 가드보다 먼저 emit(WARNING), CHANGELOG 4번째 소비처 누락(WARNING), spec 4곳 drift([SPEC-DRIFT], 이미 위임됨) |
| scope | LOW | 스코프 이탈 없음. 부수 fix·문서 이관 모두 적절히 격리 처리 |
| side_effect | LOW | public 접근자 확장(WARNING), 잠금/DB조회 증가는 의도된 트레이드오프(INFO) |
| maintainability | LOW | 헬퍼 파라미터 의미 혼재(WARNING), 4줄 블록 중복(WARNING), 문서 재중복 패턴(INFO) |
| testing | LOW | phase 메시지 미검증(WARNING), e2e 고정 sleep(WARNING) 외 전반 커버리지 우수 |
| documentation | MEDIUM | CHANGELOG 이 CRITICAL#1 4번째 소비처 누락 — 결함 심각도 과소서술(WARNING) |
| database | LOW | FOR UPDATE 로 핵심 lost-update 확인 차단. 잔여 비원자 창·form/button 미소비는 INFO 수준 |
| concurrency | MEDIUM | finalizeAiNode RUNNING 유지 분기의 잔여 TOCTOU 창(WARNING, architecture/requirement 와 동일 이슈 교차 확인) |

## 발견 없는 에이전트

없음 — 실행된 10개 reviewer 전원이 최소 1건 이상(WARNING 또는 INFO)의 실질 발견사항을 보고함.

## 권장 조치사항

1. `finalizeAiNode` "이미 RUNNING 유지" 분기의 잔여 TOCTOU 창을 닫거나(트랜잭션+FOR UPDATE 로 원자화), 닫지 않는다면 plan 에 "알려진 잔여 리스크"로 명시 등재 — architecture·requirement·concurrency 3개 reviewer 가 독립적으로 동일 지점을 지목한 최우선 항목.
2. `CHANGELOG.md` 를 "AI 경로 4곳"으로 정정해 CRITICAL#1 이 고친, 코드 주석상 "주 경로"인 네 번째 소비처를 반영 — 현재 서술은 이 결함의 실제 심각도를 과소평가하게 만든다.
3. `handleAiMessageTurn` 의 WS 이벤트(`AI_MESSAGE`/`EXECUTION_WAITING_FOR_INPUT`) emit 이 취소 가드보다 먼저 실행되는 갭을 검토 — 최소한 emit 직전 재확인 추가 또는 plan 에 "표시상 신호 잔여"로 명시.
4. `markNodeCancelled` 호출 전 `outputData`/`error` 초기화 계약을 타입 시그니처 수준으로 흡수해, 후속 form/button PR 이 이 헬퍼를 재사용할 때 실수로 빠뜨릴 수 없게 한다.
5. `assertLinkedTransitionApplied` 에러 메시지(phase) 검증 테스트와 e2e 의 고정 `setTimeout(2_500ms)` → poll 전환을 보강해 WARNING#7 회귀 감지력과 CI 안정성을 높인다.
6. (project-planner 턴) `spec-update-node-cancellation-shutdown-classification.md` #7 을 통해 `node-cancellation.md`/`4-execution-engine.md`/`## Rationale` §C-1 의 stale 수치(12/7→14/9 등)를 정정.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, architecture, requirement, scope, side_effect, maintainability, testing, documentation, database, concurrency (10명)
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (7명) — 전원 결과 확보 확인, 화이트리스트 미이행 없음
  - **제외**: 표 (reviewer · 이유, 4명)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | 라우터 판단 — 이번 diff(취소 가드·DB 잠금 범위)에 해당 사항 낮음으로 스코프 제외 (상세 사유 미제공) |
  | dependency | 라우터 판단 — 의존성 변경 없는 diff (상세 사유 미제공) |
  | api_contract | 라우터 판단 — 외부 API 계약 변경 없는 diff (상세 사유 미제공) |
  | user_guide_sync | 라우터 판단 — 사용자 가이드 영향 없는 내부 엔진 변경 (상세 사유 미제공) |