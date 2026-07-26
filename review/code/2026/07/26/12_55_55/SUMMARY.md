# Code Review 통합 보고서 (2R — 직전 라운드 조치 검증)

## 전체 위험도

**CRITICAL** — 직전 라운드(`11_48_55`)의 C1·C2·C4 는 **실측으로 해소 확인**됐다(testing 이 7개 지점 mutation 을 독립 재현). 그러나 C3(컨테이너/Parallel 확장)가 **불완전**하다: 같은 결함 클래스가 `ParallelExecutor` 의 `errorPolicy:'continue'` 에 그대로 남아 있고, 확장 과정에서 `runContainer` catch-all 이 취소를 일반 실패로 오분류하는 신규 부작용이 노출됐다(security·side_effect 2명 독립 수렴).

## 직전 라운드 항목 검증 결과

| 항목 | 결과 | 근거 |
|---|---|---|
| C1 `executeInline` 무력화 | **해소** | `workflow.handler.ts:195-197` 재throw 가 `buildSubWorkflowError` 앞에 배치. 회귀 테스트 2건. requirement·security·testing 3명 확인 |
| C2 mutation 커버리지 0 | **해소** | testing 이 **7개 지점 전부 독립 재실측** — 각각 정확한 이유로 RED → 복원 GREEN. RESOLUTION 주장이 정확함을 확인. RESOLUTION 미언급 W2 지점까지 추가 검증 |
| C3 컨테이너/Parallel 범위 | **부분 해소** | `executeContainerBody`·`executeParallelBranchBody`·`ForEachExecutor` 는 해소. **`ParallelExecutor` `errorPolicy:'continue'` 미해소** → 아래 C5 |
| C4 타임스탬프 모순 | **해소** | 두 catch 가 `updateExecutionStatus`(M-3 guarded, `WHERE status IN (비-terminal)`)로 전환 → 이미 terminal 이면 no-op. concurrency·requirement 확인 |
| W1 전체 row SELECT | **해소** | `findOne({select:{id,status}})` 로 투영. database·performance 확인 |
| W2 Background 허위 알림 | **해소** | `:6881-6891` graceful swallow. side_effect 확인 |
| W3 `cancelledBy` 계약 | **해소** | 두 catch 가 `emitCancellationEvent(..., {cancelledBy:'user'})` 사용 |
| W4·W5·W6 문서 | **해소** | e2e 헤더 갱신 · CHANGELOG 항목 · planner 위임 기록(#6) 전부 확인 |

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| C5 | requirement | **`ParallelExecutor` 의 `errorPolicy:'continue'` 가 `ExecutionCancelledError` 를 흡수한다** — C3 가 ForEach/Map 에서 고친 것과 **구조적으로 동일한 버그**가 Parallel 콤비네이터에 남았다. 브랜치 가드가 던진 취소가 `Promise.allSettled` 의 rejected 로 잡혀 `failures[]` 에 담기는데, `'continue'` 분기는 재throw 하지 않는다. 게다가 호출부 `runParallel` 은 `parallelResult.failures` 를 **저장소 전체에서 한 번도 읽지 않는다** → Parallel 노드가 거짓 `done` 포트로 종결되고 출력이 오염된다. Parallel 이 그래프 최종 노드인 흔한 패턴에서는 이후 가드 호출 자체가 없다 | `containers/parallel-executor.ts:277-289` · `execution-engine.service.ts:7418-7498`(`runParallel`) · 대조 선례 `foreach-executor.ts:91-101` | `errorPolicy` 분기 **이전에** `ExecutionCancelledError` 우회 재throw 추가(ForEachExecutor 와 대칭) + `parallel-executor.spec.ts` 대칭 회귀 테스트 |

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| W9 | security · side_effect (2명 수렴) | **`runContainer` catch-all 이 취소를 일반 실패로 오분류한다.** C3 가 컨테이너 경로에 `ExecutionCancelledError` 를 처음 실전 발생시켰는데, 이를 받는 기존 catch 는 `instanceof` 분기가 없어 컨테이너 `NodeExecution` 을 **`FAILED` 로 DB 영속**하고 내부 전용 message(executionId 포함)를 실어 **`NODE_FAILED` 를 WS 로 방출**한다. Execution 은 결국 `cancelled` 로 마감되므로 "실행은 취소됨인데 그 안의 ForEach/Loop/Map 노드는 실패" 라는 상태·감사로그 불일치. C1(`workflow.handler`)·C3(`ForEachExecutor`)에는 같은 패턴의 수정이 들어갔는데 `runContainer` 만 빠졌다. **신규 회귀 테스트로도 검출되지 않는 사각지대** | `execution-engine.service.ts:7530-7568`(특히 `:7541-7543` FAILED 마킹, `:7551-7566` NODE_FAILED emit). 트리거: `:6480` | catch 최상단에 `if (err instanceof ExecutionCancelledError) throw err;` 추가. 회귀 테스트로 `save`/`emitNode` 인자를 단언해 FAILED 오분류·내부 메시지 노출 부재를 고정 |
| W10 | performance | **ForEach/Loop 아이템 경계 가드가 아이템 수에 선형 비례하는 순차 DB 라운드트립을 추가**한다. ForEach 는 입력 배열 길이 상한이 없고(`MAX_NODE_ITERATIONS` 와 무관), executor 가 `itemContext` 공유 mutate 때문에 순차 실행이라 지연이 누적된다. 1만 건이면 이 가드만으로 약 10~30초 직렬 추가. 중첩 컨테이너는 곱셈적(100×100=10,100회). 직전 라운드가 "컨테이너는 상속하지 않는다"를 완화 요인으로 기록했는데 그 전제가 깨졌다 | `execution-engine.service.ts:6473-6480` · `containers/foreach-executor.ts` · `loop-executor.ts`(`DEFAULT_MAX_ITERATIONS=1000`) | 시간 기반 스로틀(예: 최근 검사 후 200~300ms 경과 시에만 실제 조회) 또는 N회마다 1회. 취소 관측 지연 수백 ms 는 best-effort 계약상 무해. 트레이드오프를 JSDoc·plan 에 명시 |
| W11 | testing | **C4 배선(raw `save()` → guarded `updateExecutionStatus`)에 회귀 테스트가 없다** — 직접 mutation 으로 확인: C4 이전 동작으로 되돌려도 **412/412 GREEN**(미검출). `emitCancellationEvent` 는 반환값과 무관하게 호출되므로 emit 단언으로는 이 배선이 고정되지 않는다. RESOLUTION 은 C4 를 "코드만"으로 정직하게 분류해뒀으므로 은폐는 아니나 열린 갭 | `execution-engine.service.ts:4524-4538` · `:2619-2638` | `mockExecutionRepo.query.mockResolvedValueOnce([])`(0행=이미 terminal)로 stale 값 재저장 부재를 단언하는 테스트 1~2건 |
| W12 | maintainability | C4 가 도입한 취소 종결 8줄 블록(`finishedAt`/`durationMs` 보정 + guarded UPDATE + emit)이 두 catch 에 `logContext` 한 값만 다른 채 **손으로 복제**됐다. 이번 PR 이 새로 만든 중복 | `execution-engine.service.ts:2625-2637` · `:4525-4537` | `finalizeCancelledExecution(savedExecution, logContext)` private 헬퍼로 추출 |
| W13 | documentation | JSDoc·CHANGELOG 의 "status **단일** 컬럼" 서술이 실제(`select:{id:true,status:true}` = 2컬럼)와 근소 불일치 | `execution-engine.service.ts:7834-7838` · `CHANGELOG.md:14` | 문구를 "id/status 2개 컬럼" 으로 정정하거나 `id:true` 제거 |

## 참고 (INFO)

- `ParallelExecutor` `errorPolicy:'stop'` 의 `failures[0]` 선택이 branch-index 순서라, 취소와 진짜 실패가 다른 브랜치에서 동시 발생 시 `cancelled`/`failed` 오분류 가능(좁은 레이스). `cancel-others-on-fail` 은 이미 root-cause 우선 로직이 있어 무해. — concurrency·side_effect
- 두 catch 가 `updateExecutionStatus` 반환값을 의도적으로 무시하고 항상 emit 하는 것은 **현재 근거상 정확**(`stop()` 의 RUNNING/PENDING 경로가 emit 하지 않음을 실측 확인). 다만 향후 복제 시 그 전제가 함께 복제되지 않으면 중복 emit 위험 — 주석 보강 권장.
- Background 본문 취소가 `background_run.completed status:'completed'` 로 나가는 것은 `ParkReleaseSignal` 이 이미 취하던 기존 패턴(스키마에 `'cancelled'` 값 부재). 이번 PR 이 만든 비일관 아님.
- `LoopExecutor` 전용 취소 회귀 테스트 부재(구조상 안전함은 코드로 확인 — swallow 하는 catch 자체가 없음).
- e2e 매직넘버 `2_000` 미상수화(직전 라운드 INFO 그대로 잔존, flaky 위험 낮음).
- `assertActiveTimeWithinLimit`(2곳) vs `assertExecutionNotCancelled`(5곳) 비대칭이 코드상 설명되지 않음 — RESOLUTION 에 "미확인" 으로 기록돼 있으나 소스에는 없음.

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 |
|---|---|---|
| requirement | **CRITICAL** | C1·C4 해소 확인. C3 는 `ParallelExecutor 'continue'` 미해소 → C5 |
| security | MEDIUM | C1 해소 확인. W9(같은 클래스가 `runContainer` 에서 재발) |
| side_effect | MEDIUM | W2·W3 해소 확인. W9 독립 수렴 |
| performance | MEDIUM | W1 해소 확인. W10(아이템 경계 비용, 상한 없음) |
| testing | MEDIUM | **C2 해소를 7지점 독립 재실측으로 확인**. W11(C4 배선 커버리지 0) |
| documentation | LOW | W4·W5·W6 해소 확인. W13 문구 |
| maintainability | LOW | 가드 확산 자체는 수용 가능 판정. W12 로직 중복 |
| concurrency | LOW | C4 해소 확인. Parallel `stop` 우선순위 레이스는 INFO |
| database | NONE | W1 해소 확인. 커넥션 풀 영향 무시할 만함 |
| scope | NONE | 범위 확장이 "원 커밋이 자체 주장한 계약의 미완성분" 이라 정당. 권한 밖·별규모 항목은 위임/백로그로 분리한 절제도 확인 |

## 권장 조치사항

1. **C5** — `ParallelExecutor` 에 `ExecutionCancelledError` 우회 재throw + 회귀 테스트.
2. **W9** — `runContainer` catch 에 재throw 분기 + 오분류/노출 부재 단언 테스트.
3. **W10** — 아이템 경계 가드에 시간 기반 스로틀 도입 + 근거 문서화.
4. **W11** — C4 배선 회귀 테스트.
5. **W12** — 취소 종결 블록 헬퍼 추출.
6. **W13** — 문구 정정.

## 라우터 결정

- **실행 10명**: security, performance, requirement, scope, side_effect, maintainability, testing, documentation, database, concurrency (강제 7명 전원 포함)
- **제외 4명**: architecture · dependency · api_contract · user_guide_sync
