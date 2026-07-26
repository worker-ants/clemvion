# Code Review 통합 보고서

## 전체 위험도

**CRITICAL** — 이 PR 이 "Stop 이 부수효과를 멈추게 한다" 고 주장하는데, 3개 가드 지점 중 **1곳만 실제로 작동**하고 나머지 2곳은 회귀 테스트 커버리지가 0 이며(mutation 실측), 그중 `executeInline` 은 호출자가 예외를 흡수해 **가드가 무력화**된다. 또한 컨테이너(ForEach/Loop/Map/Parallel) 본문은 애초에 적용 범위 밖이라 동일 결함이 그대로 남는다. 즉 커밋 메시지·JSDoc·plan 의 서술이 실제 커버리지보다 낙관적이다.

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| C1 | requirement · testing · security | **`executeInline` 가드가 무력화된다.** `executeInline` 의 유일한 호출자 `workflow.handler.ts` catch 가 `ParkReleaseSignal` 만 재throw 하고 나머지 예외를 `buildSubWorkflowError()` 로 **정상 반환값**(error 포트 출력)으로 변환한다. 따라서 `ExecutionCancelledError` 가 삼켜져 (a) error 포트 하류가 1홉 계속 dispatch(= 이 PR 이 막으려던 부수효과 재현), (b) 취소가 `SUB_WORKFLOW_FAILED` 로 오분류, (c) error 엣지 부재 시 Execution 이 `cancelled` 아닌 `failed` 로 마감(§5.1 위반) | `execution-engine.service.ts:3729` (가드) · `nodes/flow/workflow/workflow.handler.ts:177-187` (흡수) · `:252-291` (`mapSubWorkflowError`) | `workflow.handler.ts` catch 에 `if (err instanceof ExecutionCancelledError) throw err;` 를 `ParkReleaseSignal` 과 나란히 추가. `ParkReleaseSignal` 선례와 대칭인 회귀 테스트 추가 |
| C2 | testing | **가드 3곳 중 2곳은 회귀 커버리지 0 — mutation 실측.** `:4261`(`runExecution`) 한 줄 제거 → 1건 RED(정상). 그러나 `:1638`(`runNodeDispatchLoop`) 제거 → **407/407 GREEN**, `:3729`(`executeInline`) 제거 → **407/407 GREEN**. 가드가 통째로 사라져도 검출 불가. `runNodeDispatchLoop` 는 폼/버튼/AI 재개 + retry 재진입이 공유하는 루프라 "재개 중 stop" 이 미고정 | `execution-engine.service.ts:1638` · `:3729` | 두 경로 각각에 "하류 노드 미도달" 회귀 테스트 추가. `executeInline` 케이스는 Sub-Workflow 노드의 `NodeExecution.status`/`NODE_FAILED` 오발사까지 단언 |
| C3 | requirement · side_effect · database | **컨테이너/Parallel 본문은 적용 범위 밖 — 동일 결함 잔존.** 가드는 top-level `while (pointer < ...)` 3곳에만 삽입됐고, `executeContainerBody`(ForEach/Loop/Map)·`executeParallelBranchBody`·`ForEachExecutor`/`LoopExecutor` 반복 루프는 별도 `for` 로 `executeNode` 를 직접 호출하며 취소 체크가 없다. 컨테이너를 쓰는 워크플로는 Stop 이후에도 컨테이너가 끝날 때까지 이메일·HTTP·DB 부수효과가 계속된다 | `execution-engine.service.ts:6429-6539` · `:7051-7130` · `containers/foreach-executor.ts` · `loop-executor.ts` | 컨테이너/Parallel 반복 루프에도 가드 확장. 범위를 의도적으로 남긴다면 plan·spec 양쪽에 잔여 스코프를 **명시**(현재 미언급 — 라벨/본문 불일치 재발 위험) |
| C4 | requirement · concurrency · side_effect · maintainability | **신규 JSDoc 의 "stop 이 쓴 `finishedAt`/`durationMs` 가 보존된다" 주장이 코드와 모순.** `ExecutionCancelledError` 를 받는 두 catch 는 terminal 여부 확인 없이 무조건 `finishedAt = new Date()` 재계산 후 stale `savedExecution` 을 full `save()` 한다. 이 PR 이전엔 사실상 도달 불가였던 경로를 이번 가드가 되살렸다 → 취소 시각이 늦은 시각으로 덮어써지고 `durationMs` 가 부풀려진다. 같은 파일의 M-3 guarded UPDATE 규약에도 어긋난다 | `execution-engine.service.ts:7792-7795`(주장) vs `:4504-4517`(`runExecution`) · `:2619-2631`(`finalizeResumedExecutionOutcome`) | 두 catch 를 guarded UPDATE(이미 CANCELLED 면 no-op)로 전환하거나 `assertExecutionNotCancelled` 가 읽은 fresh row 를 재사용. 최소한 JSDoc 을 실제 동작에 맞게 정정 |

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| W1 | performance · database · maintainability | `findOneBy({id})` 가 `status` 한 컬럼이 아니라 **Execution 전체 row** 를 SELECT 한다. 엔티티에 `input_data`·`output_data`·`error`·`conversation_thread`·`user_variables`·`resume_call_stack` 6개 JSONB 컬럼이 있고 `select:false` 가 없다. resume 이후 대화 스냅샷이 큰 실행에서 노드 경계마다 수 KB~수십 KB 를 왕복. JSDoc 의 "status 단일 컬럼" 서술과 불일치. 같은 파일 `recordNodeLatencyMetrics`(W-9)가 이미 고쳤던 패턴의 재발 | `execution-engine.service.ts:7799` | `findOne({where:{id}, select:{status:true}})` 또는 QueryBuilder 로 `status` 만 투영 |
| W2 | side_effect | **Background 노드 본문이 부모 취소를 "실패" 로 오분류.** 본문은 부모와 같은 `executionId` 를 공유하므로 새 가드가 `ExecutionCancelledError` 를 던지는데, `executeBackgroundSubgraph` catch 가 `ParkReleaseSignal` 만 특별 취급하고 재throw → `BackgroundExecutionProcessor` 가 일반 실패로 처리 → `status:'failed'` emit + `notifyOnFailure` admin **허위 알림** + BullMQ 재시도(재시도마다 알림 중복) | `execution-engine.service.ts:6850-6852` · `queues/background-execution.processor.ts:71-84` | `ExecutionCancelledError` 분기를 추가해 graceful 종료(재throw·알림·재시도 금지) |
| W3 | side_effect | 새로 상시 도달하는 `EXECUTION_CANCELLED` emit 이 공용 헬퍼 `emitCancellationEvent` 를 우회해 문서화된 payload 계약의 **`cancelledBy` 필드가 누락**된다. 기존 4개 취소 경로는 모두 헬퍼를 통해 닫힌 3값 union 을 지킨다 | `execution-engine.service.ts:4511-4515` · `:2626-2630` (계약: `spec/5-system/6-websocket-protocol.md:179`) | 두 catch 를 `emitCancellationEvent(..., { cancelledBy: 'user' })` 로 통일 |
| W4 | documentation | e2e 파일 상단 JSDoc 이 **같은 커밋에서 반증된** "⚠ 기전은 미확인 / 타이밍 우연 배제 못 함 / 엔진 단위 테스트로 고정하는 것이 후속 과제" 를 그대로 유지 | `test/node-cancellation-propagation.e2e-spec.ts:26-44` | 기전 부재가 확인돼 `assertExecutionNotCancelled` 로 수정됐고 엔진 단위 테스트가 계약을 고정한다는 내용으로 갱신 |
| W5 | documentation | 사용자 가시 결함(취소 후 부수효과 지속) 수정인데 `CHANGELOG.md` Unreleased 항목 없음 — 저장소 관행 불일치 | `CHANGELOG.md` | 항목 추가 |
| W6 | documentation · requirement | SoT `spec/conventions/node-cancellation.md` 가 새 Execution-레벨 가드를 반영하지 않고 `code:` 에 `execution-engine.service.ts` 도 없다. 같은 plan 의 자매 항목들은 planner 위임을 명시하는데 **이 항목만 위임 기록 없이 종결** | `plan/in-progress/node-cancellation-residual-signal-propagation.md` | 위임 기록 명시 + planner 앞 spec 갱신 제안(§2.3/§5.1/§6·`code:`) |
| W7 | testing | plan 의 "mutation 검증 완료 — 가드 제거 시 RED 3회" 서술이 실측과 불일치(실제로는 `runExecution` 1곳만 RED) | `plan/in-progress/node-cancellation-residual-signal-propagation.md` | C2 테스트 추가 후 문구를 실측에 맞게 정정 |
| W8 | maintainability | 순회 루프 3곳 복제로 같은 가드를 손으로 3번 넣어야 했고, 실제로 1곳만 넣어 테스트가 RED 로 남는 사고가 발생했다. 다만 **이번 PR 이 만든 부채가 아니라 기존 부채의 재노출** | `execution-engine.service.ts:1638` · `:3729` · `:4261` | 전면 통합은 과거 "엔진 재작성급 고위험" 으로 기각된 범위. **노드 경계 가드 시퀀스만** 단일 헬퍼로 승격하는 중간 크기 후속 작업을 백로그로. `executeInline` 이 `assertActiveTimeWithinLimit` 를 호출하지 않는 기존 비대칭이 의도인지 먼저 확인 필요 |

## 참고 (INFO)

- `assertExecutionNotCancelled` 의 DB 조회 실패 경로 미검증(fail-closed 방향이라 안전하나 미문서화·미테스트).
- 신규 유닛 테스트 자체는 **vacuous 하지 않음** — 실측 확인(원본 PASS → 가드 1줄 제거 시 `Expected: 1, Received: 3` 으로 정확한 이유로 FAIL → 원복 시 PASS).
- e2e 의 고정 2초 settle 은 flaky 위험 낮음(노드 A 종료 대기는 60s 폴링 기반). 다만 매직 넘버가 파일의 명명 상수 관행(`INFLIGHT_WINDOW_MS`)을 따르지 않음.
- `ExecutionCancelledError` 생성자 message 선택 인자화는 **하위 호환 확인됨**(기본값 보존, 분류는 전부 `instanceof` 기반). 전체 저장소 호출부 2곳뿐.
- `assertExecutionNotCancelled` 와 `assertActiveTimeWithinLimit` 의 로그 레벨 비일관(`log` vs `warn`) — 근거 주석 없음.
- 컨테이너 본문이 가드를 상속하지 않는 것은 **비용 측면에선** 완화 요인(폴링이 대량 아이템 반복에 곱해지지 않음).
- `createNodeExecution` 조건부 INSERT 로 라운드트립 0 추가하는 대안은 **권장하지 않음** — blast radius 가 크고, skip-only 구간에서 취소 관측을 놓쳐 결함을 좁게 재도입할 위험.

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| requirement | **CRITICAL** | C1 `executeInline` 무력화 · C3 컨테이너 범위 밖 · C4 JSDoc-코드 모순. 선형 경로에 한해서만 주장이 참 |
| testing | **HIGH** | C2 mutation 실측 — 3곳 중 2곳 커버리지 0. `executeInline` cancel 시 Sub-Workflow 노드가 `failed`+`NODE_FAILED` 로 오마킹됨을 프로브로 직접 관측 |
| security | MEDIUM | C1 을 보안 각도로 확인(부수효과 재현 + 내부 전용 message 의 client 노출) |
| concurrency | MEDIUM | C4 — 두 catch 가 모듈의 guarded-UPDATE 규약 밖. shutdown `FAILED`(SERVER_INTERRUPTED)는 가드가 감지 못함 |
| side_effect | MEDIUM | W2 Background 허위 알림 · W3 `cancelledBy` 계약 위반 · C4 |
| database | MEDIUM | W1 전체 row SELECT(JSONB 6개) |
| documentation | MEDIUM | W4 stale e2e 헤더 · W5 CHANGELOG · W6 SoT 미반영 |
| performance | LOW | 노드 경계 SELECT 1건의 상대 비용은 **허용 가능** 판정. 단 W1 투영 필요 |
| maintainability | LOW | W8 3중 복제 · W1 JSDoc 부정확 · 로그 레벨/매직넘버 |
| scope | NONE | 5개 파일 전부 단일 논리 변경에 묶임. 범위 이탈·불필요 리팩토링·포맷팅 오염 없음 |

## 권장 조치사항 (우선순위)

1. **C1** — `workflow.handler.ts` catch 에 `ExecutionCancelledError` 재throw 분기 추가 (+ 회귀 테스트).
2. **C4** — 두 catch 를 guarded 처리로 전환하거나 JSDoc 정정. 둘 중 하나는 반드시.
3. **C2** — `runNodeDispatchLoop`·`executeInline` 회귀 테스트 추가 → mutation 이 실제로 3회 RED 가 되게.
4. **C3** — 컨테이너/Parallel 로 가드 확장, 또는 잔여 스코프를 plan·spec 에 명시.
5. **W1·W2·W3** — 컬럼 투영 · Background 분기 · `emitCancellationEvent` 통일.
6. **W4·W5·W6·W7** — 문서 동기화(e2e 헤더 · CHANGELOG · planner 위임 기록 · plan 문구 정정).
7. **W8** — 가드 시퀀스 헬퍼 승격을 백로그로.

## 라우터 결정

- `routing_status=done` — **실행 10명**: security, performance, requirement, scope, side_effect, maintainability, testing, documentation, database, concurrency (강제 7명 전원 포함, 화이트리스트 미이행 없음)
- **제외 4명**: architecture(모듈 경계 변경 없음) · dependency(의존성 변경 없음) · api_contract(HTTP 계약 변경 없음) · user_guide_sync(plan 문서만, 매트릭스 trigger 아님)

> **작성 경위**: 10개 reviewer 리포트가 전부 디스크에 기록됐고(`ls *.md` = 10), main 이 반환 전문을 근거로 통합했다.
