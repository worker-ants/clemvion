# 테스트(Testing) 리뷰 — node-cancellation-propagation e2e (2차 라운드)

## 배경

본 라운드는 `claude/node-cancel-e2e-98b61f` 브랜치 전체 diff(1차 리뷰 `20_36_21`의 조치 결과 + 그 리뷰
산출물 자체의 커밋 + 잔여 plan 문서)를 대상으로 한다. 핵심 신규 코드는
`codebase/backend/test/node-cancellation-propagation.e2e-spec.ts` (신규, 336줄) 하나이며, 1차 라운드
RESOLUTION 이 기록한 W3(헬퍼 추출)·W4(배제→허용집합 양성 비교)·W5(주석 값 정정)는 실제 파일에서 확인된다
(`waitForNodeRunning` 헬퍼 도입, `expect([null, 'cancelled']).toContain(downstream)`, `INFLIGHT_WINDOW_MS`
직접 참조). 1차 라운드 testing 리뷰의 지적 사항(배제 방식 assertion)은 정확히 해소됐다.

## 발견사항

- **[WARNING]** 1차 라운드 RESOLUTION §C1 이 CRITICAL 을 반증하며 제시한 "기전"(guarded UPDATE) 이 실제로는
  이 e2e 시나리오가 타는 코드 경로가 아니다 — 핵심 계약("하류 노드는 dispatch 되지 않는다")이 여전히 코드
  상 확인되지 않는다
  - 위치: `review/code/2026/07/24/20_36_21/RESOLUTION.md:36`-`41`(§C1 "기전" 문단, `ResumeClaimExecTerminalError`/
    `execution-engine.service.ts:313` 를 근거로 인용) vs 실제 소스
    `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` 의 `runExecution`(1행: 4134),
    `executeNode`(5442), `executeWithRetry`(6042 부근, `context.abortSignal?.throwIfAborted()` 는 6058),
    `createNodeExecution`(8001), `assertActiveTimeWithinLimit`(7747), 그리고
    `codebase/backend/src/modules/executions/executions.service.ts` 의 `stop()`(732-802).
  - 상세: RESOLUTION 이 인용한 `execution-engine.service.ts:313` 근방 `ResumeClaimExecTerminalError` 는
    §7.5 durable-resume(재개, `WAITING_FOR_INPUT` claim) 전용 sentinel 이다(직접 `Read` 로 확인 — 클래스
    주석이 "§7.5 재개 진입 원자 claim" 이라고 명시). 그런데 이 e2e 의 워크플로(trigger → code → code, 두
    노드 모두 `code.schema.ts:116` 의 `executionMetadata: { kind: 'standard' }`)는 park/resume 을 전혀
    타지 않는 순수 선형 `runExecution` 디스패치 루프(4134-4454)로만 처리된다. 이 루프·`executeNode`·
    `executeWithRetry`·`createNodeExecution`·`assertActiveTimeWithinLimit` 를 전부 직접 읽었으나, 노드 A
    완료 후 B 를 dispatch 하기 전에 **부모 Execution 의 최신 DB 상태를 재조회하거나 취소 여부를 확인하는
    코드는 어디에도 없었다**(`assertActiveTimeWithinLimit` 는 누적 실행시간만 검사, 취소와 무관).
    `context.abortSignal` 은 `parallel-executor.ts:245` 에서만 값이 할당되므로(grep 전수 확인) 이 선형
    경로에서는 항상 `undefined` — 1차 라운드 requirement reviewer 의 CRITICAL 정적 분석이 지목한 정확한
    코드 갭이 실제로 존재한다. `stop()`(`executions.service.ts:780-792`) 역시 조건부 `UPDATE` 로 Execution
    행만 바꿀 뿐, in-process `runExecution` 코루틴에 신호를 보내는 어떤 메커니즘도 없다.
  - 즉 RESOLUTION 이 "반증"으로 제시한 실측(e2e 3회 green + 대조군 차별화)은 관측으로서는 유효할 수 있으나,
    "왜" 통과하는지에 대한 설명은 서로 다른 서브시스템(§7.5 resume claim)을 잘못 인용한 것으로 보인다.
    그 설명이 틀렸다면, 지금 통과가 (a) 아직 특정되지 않은 다른 실제 가드에 의한 것인지, (b) A 의 5초
    busy-wait 과 `stop()` 처리 타이밍이 우연히 겹쳐 B 가 아직 사실상 dispatch 되지 않은 것뿐인지 구분할
    근거가 이 리뷰의 범위 안에 없다. 이 파일 스스로가 세운 원칙("무수정 프로브로 전제를 먼저 실증", 대조군
    으로 vacuity 차단)과 정확히 같은 축의 문제가 **반대 방향**(설명되지 않은 채 통과가 유지되는 잠재적
    취약성)으로 남아 있다.
  - 제안: (a) 실제 실행에서 B 의 dispatch 를 실제로 막는 코드 지점을 로그/디버거로 직접 특정하거나, (b)
    `execution-engine.service.spec.ts` 수준의 엔진 단위 테스트로 "선형 두 노드 사이에 Execution 이 외부에서
    cancelled 로 바뀌면 두 번째 노드가 dispatch 되지 않는다"를 mock 기반 수 ms 내에 결정적으로 고정 — 이는
    15초 busy-wait 없이 정확한 계약 지점을 잠그고 "왜 통과하는지 모른다"는 잔여 불확실성을 제거한다. (c)
    최소한 이 e2e 를 CI 에서 여러 차례(`--repeat`/반복 실행) 추가로 돌려 견고성 신뢰도를 높일 것. (d)
    RESOLUTION §C1 의 "기전" 문단을 정정(§7.5 인용이 이 시나리오에 적용되지 않음을 명시)해 향후 재조사 시
    잘못된 근거로 재종결되지 않게 할 것.

- **[INFO]** 진행 중이던 노드 A(`slowNodeId`) 자신의 최종 `node_execution.status` 는 어떤 테스트에서도
  단언되지 않는다
  - 위치: `codebase/backend/test/node-cancellation-propagation.e2e-spec.ts:253`-`287` (첫 번째 `it`) —
    `waitForNodeRunning(executionId, slowNodeId)`(259행)로 'running' 진입만 관측하고, A 의 최종 상태를
    확인하는 assertion 은 없음.
  - 상세: `executeNode` 의 정상 완료 기록(`execution-engine.service.ts:5645`-`5651`)은 부모 Execution 의
    현재 상태와 무관하게 무조건 `.save()` 한다. 즉 A 는 busy-wait 종료 후 Execution 이 이미 `cancelled` 여도
    `node_execution.status = 'completed'` 로 저장될 가능성이 높다 — Execution 전체는 `cancelled` 인데 그
    안에서 실제로 실행 중이던 노드 자신은 `completed` 로 남는 비대칭 결과가 실제로 발생하는지 이 테스트가
    고정하지 못한다. 프론트엔드 실행 상세 화면이 이 값을 그대로 노출한다면 "취소된 실행인데 노드는 정상
    완료로 표시" 되는 사용자 혼란 표면이 될 수 있다.
  - 제안: 테스트 종료 직전 `nodeStatus(executionId, slowNodeId)` 를 조회해 현재 실제 동작 값(추정
    `'completed'`)을 명시적으로 고정하면, 향후 리팩터가 이 비대칭을 의도치 않게 바꿔도 회귀로 잡힌다.

- **[INFO]** WS 이벤트(`execution.node.cancelled`/`execution.cancelled`) 발행 미검증 — 1차 라운드에서
  이미 지적됐고 이번 라운드에서도 그대로 남아 있음(조치 항목 표에 미포함)
  - 위치: `codebase/backend/test/node-cancellation-propagation.e2e-spec.ts` 전체(REST/DB 폴링만 사용).
  - 상세: `spec/conventions/node-cancellation.md` §5.1 이 명시하는 WS emit 표면은 이 e2e 로도, 저장소
    전체에서도 아직 잠겨 있지 않다. 스코프 확장을 요구하는 수준은 아니나 여전히 열린 갭이라는 점만 재확인.
  - 제안: 별도 조치 불요(이미 인지됨). 후속 plan 항목으로 명시 고려.

- **[INFO]** 코드 내 인라인 주석이 특정 리뷰 라운드의 발견 번호를 직접 인용
  - 위치: `codebase/backend/test/node-cancellation-propagation.e2e-spec.ts:283` (`...ai-review testing
    WARNING 4).`)
  - 상세: `review/code/**` 산출물이 보존되는 한 유효하지만, 그 산출물이 향후 아카이브/정리되거나 리뷰 번호
    체계가 바뀌면 코드에 박힌 인용이 누구도 풀 수 없는 dangling 참조가 된다. 기능 영향 없음, 우선순위 매우
    낮음.
  - 제안: 필요 시 "이전에 배제 방식이 거짓 양성 위험을 가졌던 사례" 정도로 리뷰 번호 없이 자기완결적으로
    바꿔도 무방.

## 회귀·격리·가독성 (양호 — 재확인)

- 1차 라운드 WARNING(배제 방식 assertion), Maintainability WARNING(폴링 블록 중복), Documentation
  WARNING(주석 값 8s→5s) 모두 실제 파일에서 해소가 확인된다(`:246-251`/`:286` 대응 `waitForNodeRunning` 헬퍼,
  `:281-286` 허용집합 비교, JSDoc·주석의 "5초" 서술 일치).
- 각 `it` 이 `createTwoStepWorkflow()` 로 독립된 워크플로/실행을 생성해 테스트 간 데이터 의존이 없다.
  `beforeAll` 공유 owner/workspace 는 읽기 전용이라 안전 — 테스트 격리 양호.
  Mock 미사용은 이 e2e 목적(엔진 실제 dispatch 검증)에 적절한 선택.
- 신규 파일이며 기존 테스트에 회귀 영향 없음.

## 요약

W3~W5 조치는 정확히 반영됐고 테스트 엔지니어링 스타일(결정적 하네스, 대조군, 격리)은 여전히 양호하다.
다만 이번 라운드에서 직접 코드를 재확인한 결과, 1차 라운드 RESOLUTION 이 CRITICAL 을 반증하며 제시한
"guarded UPDATE" 기전은 이 e2e 가 실제로 타는 선형(non-parallel, non-resume) 디스패치 경로와 무관한
서브시스템(§7.5 resume claim)을 인용한 것으로 보인다. `runExecution`/`executeNode`/`executeWithRetry`/
`createNodeExecution`/`assertActiveTimeWithinLimit` 전부를 직접 읽었지만 노드 A→B 사이 Execution 상태
재확인 로직을 찾지 못했다 — 즉 이 테스트의 핵심 계약("하류 노드는 dispatch 되지 않는다")이 실제로 어느
코드에 의해 보장되는지는 이번 조사로도 여전히 미확인 상태다. e2e 실측(3회 green + 대조군)은 유효한 관측
이지만, 그 원인 설명이 틀렸다면 통과가 구조적으로 보장된 것인지 타이밍에 우연히 의존한 것인지 구분할 수
없다. 엔진 레벨 단위 테스트로 이 계약 지점을 직접 mock 하여 결정적으로 고정할 것을 권고한다. 그 외에는
A 자신의 최종 상태 미검증(INFO), WS 이벤트 미검증(INFO, 기존 지적 유지), 리뷰-번호 인용 주석(INFO) 등
경미한 잔여 사항뿐이다.

## 위험도

MEDIUM
