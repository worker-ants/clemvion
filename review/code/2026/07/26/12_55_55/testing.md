# 테스트(Testing) Review

대상: `dad70c7b2`+`ff87ede27`+`107133cfd`(코드/테스트) — 외부 cancel(Stop) 후 하류 노드 dispatch·부수효과 지속 결함 수정 + 직전 라운드(`review/code/2026/07/26/11_48_55`) SUMMARY C1-C4/W1-W8 조치.

## 0. 재검증 방법론 (최우선 지시사항)

직전 라운드 CRITICAL C2("가드 3곳 중 2곳 회귀 커버리지 0 — mutation 실측")가 `RESOLUTION.md`("7개 지점 전부 개별 RED → 복원 GREEN")로 실제 해소됐는지, 그 주장을 **직접 재실측**했다.

- 대상 파일을 스크래치 디렉토리에 `cp` 로 백업(`git checkout` 미사용).
- 가드/재throw 문 1줄만 주석 처리(`python3` 스크립트로 정확히 해당 줄만 치환, 문맥 확인 후 실행).
- 대상 회귀 테스트만 `npx jest <file> -t "<name>"` 로 실행해 RED 확인.
- `cp` 로 원본 복원 → `git diff --stat` 로 무결성 확인(매 지점마다) → 최종적으로 전체 스펙 재실행.

## 1. CRITICAL C2 재검증 결과 — **RESOLUTION.md 주장 실측 확인, 정확함**

| # | 지점 | 파일:줄 | 대상 테스트 | 실측 결과 |
|---|---|---|---|---|
| 1 | `runNodeDispatchLoop` | `execution-engine.service.ts:1638` | "재개 중 외부 cancel 관측 시 runNodeDispatchLoop..." | RED: `Expected: 1, Received: 2` → 복원 GREEN |
| 2 | `executeInline` | `execution-engine.service.ts:3736` | "...executeInline 이 하류를 dispatch 하지 않고..." | RED: `rejects.toThrow()` 가 resolved 로 통과(취소 미검출) → 복원 GREEN |
| 3 | `runExecution` | `execution-engine.service.ts:4268` | "선형 경로 외부 cancel 전파" (기존) | RED: `Expected: 1, Received: 3` → 복원 GREEN |
| 4 | `executeContainerBody` | `execution-engine.service.ts:6480` | "아이템 경계에서 외부 cancel..." | RED: `Expected: 1, Received: 3` → 복원 GREEN |
| 5 | `executeParallelBranchBody` | `execution-engine.service.ts:7120` | "브랜치 내부 노드 경계에서 외부 cancel..." | RED: `a2Calls` `Expected: 0, Received: 1` → 복원 GREEN |
| 6 | `WorkflowHandler` C1 재throw | `workflow.handler.ts:195-197` | "ExecutionCancelledError re-throw" 2건 | RED: 2건 모두 실패(`SUB_WORKFLOW_FAILED` 로 오분류된 error 포트 객체가 resolve) → 복원 GREEN |
| 7 | `ForEachExecutor` errorPolicy 우회 재throw | `foreach-executor.ts:99-101` | "ExecutionCancelledError bypasses errorPolicy" (stop/skip/continue) | RED: skip·continue 2건 실패(`skipped[]` 로 흡수돼 resolve), **stop 은 기존 switch 방어로 그대로 PASS(의도된 결과, RESOLUTION 서술과 정확히 일치)** → 복원 GREEN |

전부 원복 후 `execution-engine.service.spec.ts`(412) + `workflow.handler.spec.ts`(50) + `foreach-executor.spec.ts`(15) = **477/477 GREEN**, `git status`/`git diff --stat` 무변화 확인.

추가로 RESOLUTION 표에 없는 W2(Background subgraph swallow, `execution-engine.service.ts:6881`)도 동일 방식으로 재검증 — `else if (err instanceof ExecutionCancelledError)` 분기를 `false &&` 로 무력화하니 "swallows ExecutionCancelledError from the body..." 테스트가 `resolves.toBeUndefined()` 기대와 달리 reject 로 RED, 복원 후 GREEN. RESOLUTION 이 언급하지 않은 지점까지 실제로 커버리지가 있음을 확인.

**결론: `RESOLUTION.md`의 "7개 지점 전부 개별 RED → 복원 GREEN" 주장은 정확하다. 직전 라운드 CRITICAL C2 는 실제로 해소됐다.** 모든 실패는 정확한 이유(호출 횟수 불일치, resolved-instead-of-rejected, 잘못된 분기로 흡수)로 발생했고 mock `ReferenceError` 류의 우연한 통과/실패가 아니었다 — vacuous 하지 않다.

## 2. 신규 발견사항

- **[WARNING]** C4("stop 이 쓴 finishedAt/durationMs 가 보존된다") 의 **핵심 배선(raw `save()` → guarded `updateExecutionStatus()` 전환)에 대한 회귀 테스트가 없다** — 직접 뮤테이션으로 확인
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:4524-4538` (`runExecution` catch, C4). `finalizeResumedExecutionOutcome`(`:2619-2638`)도 동일 패턴이라 같은 갭.
  - 상세: `runExecution` catch 를 C4 이전 동작(무조건 `savedExecution.finishedAt = new Date()` 재계산 + `this.executionRepository.save(savedExecution)` 직접 호출, guarded `updateExecutionStatus()` 미경유)으로 되돌려 실측했다 — **전체 스펙 412/412 GREEN, 회귀 미검출**. 원인: 기존/신규 어떤 테스트도 "이미 CANCELLED 인 행에 대해 `finishedAt`/`durationMs` 가 재마킹되지 않는다"(guarded UPDATE 의 `status IN (비-terminal)` 가드가 실제로 0행 매칭해 no-op 이 되는지)를 직접 단언하지 않는다. C2 테스트들은 `emitExecutionEvent` 호출 여부·핸들러 호출 횟수만 검증하고, `emitCancellationEvent` 는 `updateExecutionStatus` 의 반환값과 무관하게 무조건 호출되므로 이 경로가 raw `save()` 든 guarded UPDATE 든 emit 단언은 동일하게 통과한다. `updateExecutionStatus` 의 guarded-UPDATE **원시 메커니즘** 자체(`status IN ('pending','running','waiting_for_input')` SQL 텍스트, 0행→false 반환)는 `execution-engine.service.spec.ts:4801-4835` 에서 일반적으로(다른 상태 전이 케이스로) 잘 고정돼 있으나, **이 두 `ExecutionCancelledError` catch 가 실제로 그 함수를 경유한다는 배선 자체**는 어느 테스트도 지키지 않는다.
  - 참고: `RESOLUTION.md` 조치표는 C4 를 `코드`(코드만, 테스트 아님)로 정직하게 분류해뒀다 — 즉 이 갭은 RESOLUTION 이 은폐한 것이 아니라 스스로 인정한 미완결 항목이다. 다만 developer 관점에서 "closed" 로 plan 에 기록되기 전에 인지할 필요가 있어 별도로 재확인했다.
  - 제안: `runExecution`/`finalizeResumedExecutionOutcome` 각각에 "Execution 행이 이미 `finishedAt`/`durationMs` 를 포함한 `CANCELLED` 로 커밋된 상태에서 catch 진입 시, `mockExecutionRepo.query`(guarded UPDATE)가 실행되더라도 `stop()` 이 쓴 값이 최종 emit/영속에 반영된다"를 단언하는 회귀 테스트 1~2건 추가 권장(예: `mockExecutionRepo.query.mockResolvedValueOnce([])` 로 0행-매칭을 시뮬레이션한 뒤, 후속 로직이 stale 값으로 아무것도 재저장하지 않음을 확인).

- **[INFO]** W3("`cancelledBy` 계약 통일") — 신규 C2/C3 테스트는 `emitExecutionEvent` 가 `'execution.cancelled'` 타입·`status:'cancelled'` 로 호출됐음만 단언하고 `cancelledBy:'user'` 필드 자체는 어느 신규 테스트에서도 명시적으로 검증하지 않는다(`execution-engine.service.spec.ts` 의 C2/C3 신규 5건 전부 `expect.objectContaining({ status: 'cancelled' })` 까지만 확인). `emitCancellationEvent` 헬퍼 자체의 `cancelledBy` 계약은 다른(이 PR 과 무관한) 호출부 테스트(`:3043` 등)에서 고정돼 있어 위험은 낮지만, 이 PR 이 새로 그 헬퍼로 갈아탄 지점(runExecution/finalizeResumedExecutionOutcome/runNodeDispatchLoop 최종 emit)에서 인자가 올바르게 전달되는지는 간접 커버리지에 의존한다.

- **[INFO]** `ExecutionCancelledError` 커스텀 `message` 파라미터(`workflow-errors.ts:327`) 전용 테스트 여전히 없음 — 직전 라운드(`11_48_55/testing.md`)에서 이미 지적된 항목이 이번 라운드에도 변화 없이 남아 있다. 위험도 낮음(단순 로직, `instanceof` 분류와 무관).

- **[INFO]** `LoopExecutor` 는 §2.3 컨테이너 확장에 대한 전용 회귀 테스트가 없다 — `loop-executor.ts:76-80` 의 주석("per-iteration try/catch 가 없어 재throw 불요")은 코드를 직접 읽어 사실임을 확인했다(`executeBody` 호출을 감싸는 `catch` 없이 `finally` 만 존재 → 예외가 그대로 전파). 구조적으로 안전하지만, `executeContainerBody`(C3) 의 컨테이너-경계 회귀 테스트는 ForEach 픽스처만 사용해 Loop 경로 자체를 통과시키는 end-to-end 테스트는 없다. 위험 낮음(swallow 로직이 아예 없으므로 회귀 여지가 구조적으로 작음).

## 3. 그 외 테스트 품질 관점

- **격리**: `beforeEach`(line 245)가 매 테스트 module/service 를 재생성해 `mockExecutionRepo.findOneBy` 등에 건 `mockImplementation`/`mockResolvedValueOnce` 오버라이드가 다음 테스트로 누수되지 않는다. C3 신규 테스트들이 "바디 핸들러가 실제로 호출된 뒤" override 를 지연 적용하는 패턴(주석으로 이유 명시: 조기 override 시 worker 브릿지의 자체 재조회가 손상된 row 를 받아 그래프 로드 자체가 실패)도 실측 근거가 주석에 남아 있어 신뢰할 수 있다.
- **Mock 적절성**: `WorkflowHandler` 는 `WorkflowExecutor` 인터페이스를 생성자 주입받아 테스트가 그 인터페이스(`executeInline`/`executeAsync`)만 mock — 구현 세부사항이 아닌 실제 DI 경계를 모킹해 테스트 용이성이 좋다. `mockExecutionRepo.findOne` 이 `findOneBy` 로 위임하는 것은 실제 TypeORM 컬럼 투영을 흉내내지 않지만, W1 주석이 그 근거(기존 테스트 재사용 목적)를 명시해 실제 동작과의 괴리를 스스로 문서화했다.
- **가독성**: 신규 테스트명이 전부 한국어 서술형("...하면 ...하지 않는다")이고 spec 섹션(§2.3/C1/C2/C3) 참조를 포함해 의도와 배경(왜 이 테스트가 필요한지)이 코드만으로 파악된다.
- **회귀**: 최종 전체 재실행(477/477) 및 mutation 원복 후 `git diff --stat` 무변화로, 기존 테스트가 이번 변경으로 깨지지 않았음을 확인했다.
- **e2e**: `node-cancellation-propagation.e2e-spec.ts` 의 관측 시점 수정(고정 `waitForTerminalStatus` 직후 조회 → 노드 A 실제 종료 폴링 후 조회)은 이전 결함(가드 없이도 타이밍 우연으로 통과)의 근본 원인을 정확히 짚었다. 직접 e2e 를 재실행하진 않았으나(Docker 인프라 필요, 이번 재검증 범위 밖), 코드 정독상 폴링 기반이라 견고하다.

## 요약

직전 라운드 CRITICAL C2("가드 3곳 중 2곳 회귀 커버리지 0")는 **실측으로 해소가 확인됐다** — 7개 가드/재throw 지점을 전부 개별적으로 `cp` 백업 후 뮤테이션 → 정확한 이유로 RED → 복원 GREEN 으로 직접 재현했고, `RESOLUTION.md` 의 서술(ForEachExecutor stop 정책만 기존 switch 로 방어돼 뮤테이션에도 PASS 하는 세부사항 포함)과 정확히 일치했다. RESOLUTION 이 언급하지 않은 W2(Background subgraph swallow) 도 별도로 뮤테이션 검증해 실제 커버리지가 있음을 확인했다. 신규 테스트는 이전 라운드가 우려했던 "mock ReferenceError 로 엉뚱하게 통과" 패턴이 아니다 — 전부 정확한 단언 실패로 RED 를 낸다. 다만 재검증 과정에서 **새로운(직전 라운드 미지적) 갭**을 발견했다: C4("stop 이 쓴 finishedAt/durationMs 보존") 의 실제 배선(raw save → guarded UPDATE 전환)을 되돌려도 전체 스펙이 그대로 GREEN 이었다 — 이 보존 로직은 코드상 올바르게 구현돼 있지만(guarded-UPDATE 원시 메커니즘 자체는 다른 케이스로 일반적으로 테스트돼 있음) 이 두 catch 가 그 메커니즘을 실제로 사용한다는 배선 자체는 어느 테스트도 지키지 않는다. `RESOLUTION.md` 는 C4 를 "코드"(테스트 아님)로 정직하게 분류해뒀으므로 은폐는 아니지만, 향후 리팩토링이 이 배선을 실수로 되돌려도 현재 스위트로는 검출 불가능하다는 점은 열린 채로 남아 있다.

## 위험도

MEDIUM — 최우선 재검증 대상(CRITICAL C2)은 확인 결과 PASS(해소됨, 위험 없음). 전체 위험도가 NONE 이 아닌 이유는 이번 재검증 과정에서 직접 실측·확정한 신규 WARNING(C4 배선 회귀 커버리지 0) 때문이며, 이는 활성 버그가 아니라 향후 유지보수 시 조용히 재발할 수 있는 커버리지 공백이다.
