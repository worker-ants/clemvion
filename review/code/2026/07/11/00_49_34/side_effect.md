# 부작용(Side Effect) 리뷰 — EIA/WS 대기 노드 표면 매트릭스 가드 (ai-review 반영 후속)

검토 대상: `resolveWaitingNodeExecutionId` 를 `find()` + `nodeRepository.findOne()` 2왕복에서
단일 `createQueryBuilder().innerJoin('ne.node').getRawMany()` 로 재작성한 커밋
(`2244539a9`, 직전 `9ba336453` 위에 얹힌 ai-review #1/#2/#5 fix) + `hooks.service.ts` 의
`readErrorBody` 신설. 지시된 3개 관점을 코드·테스트를 직접 추적해 검증했다
(diff base `origin/main` = `9ba336453`, 두 커밋 전체를 함께 검토).

## 발견사항

- **[INFO] (1) 3개 진입점 raw-row 필드 형태 — 정합 확인됨**
  - 위치: `execution-engine.service.ts:5187-5244`(`resolveWaitingNodeExecutionId`),
    `interaction.service.ts:410-418`(EIA `dispatchContinuation`),
    `websocket.gateway.ts:889-901`(WS ack), `executions.controller.ts:174-181`(REST `/continue`)
  - 상세: `.select('ne.id','id').addSelect('ne.node_id','nodeId').addSelect('n.type','nodeType')
    .addSelect(COALESCE(...),'interactionType')` 로 명시적 alias 를 지정해 `getRawMany<WaitingNodeRow>()`
    의 반환 행 키가 `WaitingNodeRow`(`id`/`nodeId`/`nodeType`/`interactionType`)와 정확히 일치한다.
    `ne.node_id`/`ne.started_at` 처럼 프로퍼티명이 아닌 raw snake_case 컬럼명을 select 문자열에 직접
    쓰는 방식은 TypeORM 이 `alias.property` 매칭에 실패하면 리터럴로 그대로 통과시키는 특성에 기대는
    것인데, 이 패턴은 같은 서비스 파일의 기존 코드(`recordNodeLatencyMetrics`, line 7860 부근)와
    `interaction-token.service.ts:391`/`executions.service.ts:686` 등 여러 곳에 이미 선례가 있어
    신규 리스크가 아니다. `resolveWaitingNodeExecutionId(executionId, expectedCommand)` 시그니처
    확장은 `private` 메서드라 외부 호출자 영향 없음 — 같은 파일 내 4개 호출부(`continueExecution`→
    `'form_submitted'`, `continueButtonClick`→`'button_click'`, `continueAiConversation`→
    `'ai_message'`, `endAiConversation`→`'ai_end_conversation'`) 모두 갱신됨(grep 으로 정의 1 + 호출
    4, 누락 없음 확인). EIA REST(`dispatchContinuation`)·WS gateway(`buildContinuationErrorAck` 계열,
    파일 변경 없음)·REST `/continue`(`InvalidExecutionStateError`→422 `INVALID_STATE`) 세 진입점
    모두 신규 코드 추가 없이 기존 `InvalidExecutionStateError` 매핑을 그대로 재사용하므로 자동
    정합. `RESOLUTION.md` 가 주장하는 "e2e 로 실 Postgres 검증"(`_test_logs/e2e-20260711-004340.log`,
    251 pass, form+buttons 표면 회귀 포함)도 이 raw select 가 실전에서 올바르게 필드를 매핑함을
    뒷받침한다. 회귀 없음.

- **[INFO] (2) 노드 삭제 극단 케이스(`innerJoin` 탈락) — 3개 진입점 모두 동일하게 거부되나 서버 로그 진단 정보는 축소됨**
  - 위치: `execution-engine.service.ts:5192-5237`(0건 분기), 비교 대상: `9ba336453` 커밋의 구
    `assertCommandMatchesWaitingSurface`(`nodeRepository.findOne` null 분기, `git diff 9ba336453
    2244539a9` 로 직접 대조)
  - 상세: 구 코드는 WAITING row 를 먼저 `find()` 로 확정한 뒤 `nodeRepository.findOne({where:{id:
    row.nodeId}})` 가 `null` 이면 별도로 `InvalidExecutionStateError('waiting node ${nodeId} not
    found for execution=...')` 를 던졌다. 신 코드는 `innerJoin('ne.node','n')` 이 이 케이스를 SQL
    단에서 걸러 `rows.length === 0` 이 되므로, "정상적으로 대기 행이 없음" 분기(`no
    WAITING_FOR_INPUT NodeExecution for execution=...`)로 수렴한다. 두 경로 모두 최종적으로
    같은 `InvalidExecutionStateError`(`code: INVALID_EXECUTION_STATE`)를 던지고, 그 `message` 는
    클래스 생성자가 강제하는 고정 문자열(`'Execution is not waiting for input.'`,
    `workflow-errors.ts:117`)이라 EIA 409 `STATE_MISMATCH` / WS ack `INVALID_EXECUTION_STATE` /
    REST 422 `INVALID_STATE` 세 진입점의 **client 관측 동작은 완전히 동일**하다. 전용 회귀
    테스트도 존재(`execution-engine.service.spec.ts:2247` "대기 node 정의 부재(JOIN 탈락) → 0건과
    동일하게 INVALID_EXECUTION_STATE"). 다만 **서버 로그(`serverDetail`)의 진단 정밀도는
    축소**된다 — 구 코드는 "node not found"(어떤 nodeId 가 없는지)를 명시적으로 `logger.warn`
    했으나, 신 코드는 이 케이스를 "0건" 분기의 `logger.debug`(경고가 아닌 디버그 레벨)로 뭉개
    "WAITING_FOR_INPUT NodeExecution 없음"만 남기고, 그것이 "execution 이 다른 상태"인지 "노드
    정의가 사라진 상태"인지 서버 로그만으로 구분할 수 없게 됐다. 기능적 회귀는 아니나(node FK 는
    `onDelete:'CASCADE'` 라 정상 운영에서는 거의 도달 불가한 방어적 코너케이스), 만약 실제로
    이 케이스가 발생한다면(예: FK 미적용 레거시 데이터, 수동 DB 조작) 원인 진단이 한 단계 더
    어려워진다는 점만 기록.

- **[WARNING] (3) `readErrorBody` 는 다른 `HttpException` 사용처와는 격리돼 있으나, 정작 이 fix 가 겨냥한 신규 chokepoint(표면 불일치) 원인에 대해서는 진단 메시지를 여전히 못 담는다 — 회귀 테스트가 이 갭을 실제로는 검증하지 못함**
  - 위치: `hooks.service.ts:748-768`(`readErrorBody`) + `:726-739`(호출부) / `interaction.service.ts:410-418`(`dispatchContinuation`) / `workflow-errors.ts:113-119`(`InvalidExecutionStateError`) / `hooks.service.spec.ts:516-546`(회귀 테스트)
  - **격리성**: `readErrorBody` 는 module-private 함수(`export` 없음, `hooks.service.ts` 안에서
    line 730 단 한 곳에서만 호출됨 — grep 으로 확인)라 파일 내 다른 8개 `catch` 블록이나 다른
    모듈의 `HttpException` 사용처에 전혀 영향을 주지 않는다. 이 부분은 지시된 "신규 함수, 격리"
    전제와 일치하며 안전하다.
  - **그러나 실효성 갭**: 이번 fix(RESOLUTION #1)의 목적은 "`err.getResponse().error.message` 를
    읽어 실제 진단 메시지를 로깅"하는 것이었다. 그런데 이 chokepoint 를 실제로 트리거하는
    `InvalidExecutionStateError`(`resolveWaitingNodeExecutionId`/`assertCommandMatchesWaitingSurface`
    가 던짐)는 `ExecutionError` 계약상 `message` 가 **항상 고정 client-safe 상수**
    (`'Execution is not waiting for input.'`, `workflow-errors.ts:117`)이고, 0건/다중-row/표면
    불일치 세 원인별로 실제 다른 문구("no WAITING_FOR_INPUT NodeExecution...", "multiple (N)
    ... invariant violation", "command '...' is not allowed while waiting on a '...'
    interaction")는 전부 `serverDetail`(클라이언트 비노출 전용, `workflow-errors.ts:36-41`)에만
    담긴다. `interaction.service.ts:416` 의 `dispatchContinuation` 은
    `ConflictException({error:{code:'STATE_MISMATCH', message: err.message}})` 로 **`err.message`**
    (고정 상수)를 body 에 싣지 `err.serverDetail`(실제 원인)은 싣지 않는다. 따라서 chat-channel
    forwarding 경로가 실제로 이 chokepoint 를 거쳐 거부될 때, `readErrorBody(err).message` 로
    추출되는 값은 세 원인 모두 동일하게 `'Execution is not waiting for input.'` 이 된다 — "이번엔
    'Conflict Exception' 대신 진짜 원인이 로그에 남는다"는 RESOLUTION 의 취지가 **표면
    불일치/0건/다중-row 세 케이스에 대해서는 실제로 실현되지 않는다** (단, `assertWaiting()` 이
    직접 던지는 STATE_MISMATCH — 즉 execution 이 애초에 waiting 상태가 아닌 일반 케이스 — 는
    `message` 에 `current=${execution.status}` 를 포함하므로 그 경우엔 readErrorBody 가 실제로
    유의미한 정보를 남긴다. 개선 효과가 원인별로 비대칭적이다).
  - **테스트가 이 갭을 가리지 못함**: `hooks.service.spec.ts:516-527` 의 회귀 테스트는
    `interactionService.interact` 자체를 `jest.Mocked` 로 완전히 모킹하고
    `new ConflictException({error:{code:'STATE_MISMATCH', message:'surface mismatch'}})` 라는
    **임의로 지어낸 message** 를 직접 reject 시킨다 — 실제 `dispatchContinuation` 코드 경로를
    전혀 통과하지 않으므로, 프로덕션에서 이 메시지가 고정 상수로 수렴한다는 사실을 검증하지
    못한다(unit 테스트가 "이상화된" 메시지로 통과하는 false-confidence 케이스). 이 경로를
    실제로 왕복 검증하는 e2e 도 없다(`grep forwardToInteractionService|handleWebhook`
    `codebase/backend/test/` 0건).
  - 영향: 기능/보안 회귀는 아니다(swallow-or-rethrow 판정은 여전히 `code` 필드만 보고 정확히
    수행됨, client 응답도 변경 없음). 다만 이 fix 가 명시적으로 해결하려던 "운영 로그에서 표면
    불일치 원인을 구분할 수 없다"는 관측가능성(observability) 문제가 세 신규 원인 케이스에
    대해서는 사실상 재발한다 — 이번엔 `err.message` 가 `'Conflict Exception'` 대신
    `'Execution is not waiting for input.'` 이라는, 조금 더 그럴듯하지만 여전히 무차별한 고정
    문구로 수렴할 뿐이다.
  - 제안: (a) 즉시 조치가 필요하지는 않음(보안 정책상 `serverDetail` 을 client 응답/hooks 로그로
    노출하는 것은 §7.5.2 의 의도적 차단이므로, hooks.service 쪽에서 그 값을 얻으려면 별도
    server-side correlation 이 필요). 최소한 (i) hooks.service.spec.ts 의 mock message 를
    `'Execution is not waiting for input.'` 같은 실제 프로덕션 값으로 교체해 테스트가 실제
    갭을 은폐하지 않도록 하거나, (ii) JSDoc(`hooks.service.ts:658-674`)의 "원인 구분은 아래
    로그의 서버측 message 가 담는다" 문구를 "표면 불일치/0건/다중-row 세 원인은 이 로그만으로
    구분되지 않는다 — 필요 시 `execution-engine.service.ts` 의 `resolveWaitingNodeExecutionId`
    로그(같은 executionId)와 상관관계로 엮을 것"으로 정정할 것을 권장.

- **[정보 확인 — 회귀 없음] AI 표면의 기존 defensive 관용(stale `button_click` graceful re-park) 보존**
  - `SURFACE_ALLOWED_COMMANDS.ai_conversation` 이 4종을 모두 허용해 `assertCommandMatchesWaitingSurface`
    를 그대로 통과시키고, 하류 `dispatchResumeTurn`/`processAiResumeTurn` 의 no-op re-park 로직은
    이 diff 가 전혀 건드리지 않는다(파일 변경 없음). `it.each(['ai_conversation','ai_form_render'])`
    (execution-engine.service.spec.ts:2216) 가 4종 명령의 publish 도달을 명시적으로 검증.

- **[정보 확인 — 회귀 없음] 파일시스템·환경변수·전역 상태·네트워크 호출 없음**
  - 리뷰 대상 diff 전체(운영 코드 4개 파일: `execution-engine.service.ts`, `waiting-surface-guard.ts`,
    `interaction.controller.ts`/`interaction.service.ts`(JSDoc/설명 문자열만), `hooks.service.ts`)에
    새 전역 변수, 파일 I/O, `process.env` 참조, 외부 HTTP 호출이 없다. `waiting-surface-guard.ts` 는
    순수 함수 모듈(부수효과 없음, 상수 export 뿐)이라 안전.

## 요약

CRITICAL 급 부작용은 없다. `resolveWaitingNodeExecutionId` 의 `find()` → 단일 JOIN
`getRawMany()` 재작성은 raw 행 필드명이 `WaitingNodeRow` 타입과 정확히 일치하고, 기존
snake_case-alias 셀렉트 패턴이 코드베이스 여러 곳에 이미 선례가 있으며 e2e(251 pass, 실
Postgres)로 실증됐으므로 3개 진입점(EIA REST/WS gateway/REST `/continue`)의 관측 가능한 동작은
동일하게 유지된다. `innerJoin('ne.node')` 도입으로 노드 삭제 극단 케이스는 "0건" 분기로
자연스럽게 수렴해 종전과 동일한 `InvalidExecutionStateError`→409/ws-ack/422 매핑을 유지하며
전용 회귀 테스트도 있다(서버 로그 진단 정밀도만 소폭 축소, client 비관측). `readErrorBody` 는
다른 `HttpException` 사용처로부터 완전히 격리된 신규 private 함수라 그 자체로는 안전하지만,
이 fix 가 겨냥한 "chat-channel warn 로그의 진단 정보 유실" 문제는 `InvalidExecutionStateError.
message` 가 원인 불문 고정 client-safe 상수라는 상위 계약 때문에 신규 3원인(0건/다중-row/표면
불일치)에 대해서는 실질적으로 재발하며, 이를 검증한다고 주장하는 unit 테스트는 실제 코드
경로를 타지 않는 지어낸 메시지로 통과해 그 갭을 가린다 — 기능/보안 회귀는 아니지만 운영
가시성 측면에서 fix 의 실효성이 문서·테스트가 시사하는 것보다 좁다.

## 위험도

LOW — 기능적·보안적 side effect 회귀는 발견되지 않았다. WARNING 1건은 로그 진단 정보의
실효성이 claim 보다 좁다는 관측가능성(observability) 이슈로, 다음 라운드에 테스트 mock
현실화 + JSDoc 정정을 권고한다.
