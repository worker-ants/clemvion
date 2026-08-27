# 요구사항(Requirement) Review — system_error 배너 라이브 WS 경로 복구

## 검증 방법

diff 3개 파일(`use-execution-events.test.ts`, `use-execution-events.ts`, `plan/in-progress/system-error-banner-live-ws.md`)에 더해, plan 문서가 인용한 근거를 전부 소스 레벨로 재검증했다:

- `spec/5-system/6-websocket-protocol.md` §4.1 / §4.1-a (2026-08-24 실측 정정)
- `spec/conventions/node-output.md` Principle 0 / 3.2 / 3.2.1
- 백엔드 emit 4곳 실제 코드: `execution-engine.service.ts:6284-6307`(pre-flight/stop, `output` 키 없음), `:6339-6386`(`finalizeErrorPortNode`, `output: nodeExecution.outputData`=래퍼), `:8009-8024`(container 실패, `output` 키 없음), `ai-turn-orchestrator.service.ts:1449-1543`(AI turn 종결, `output: nodeExec.outputData`=래퍼 + 백엔드 자신도 `outputData.output.error` 로 읽음)
- `pnpm vitest run` 로 대상 테스트 파일 직접 실행 — **87/87 GREEN** (plan 이 주장한 "frontend 87" 과 일치)

## 발견사항

- **[WARNING]** `extractNodeErrorPayload` 최상단 JSDoc 이 이번 수정과 모순되는 옛 서술을 그대로 두고 있다 — 바로 이 서술이 원래 결함의 원인이었다.
  - 위치: `codebase/frontend/src/lib/websocket/use-execution-events.ts:52-59`
  - 상세: 함수 본문(52-59 바로 아래, 76-90번 줄)은 이번 PR 에서 §4.1-a 인용 + "`rawOutput` 은 `NodeHandlerOutput` 래퍼, 도메인 에러는 `output.output.error`" 로 정확히 갱신됐다. 그런데 52-59번 줄의 함수 최상단 JSDoc 은 그대로다:
    - 52-54번 줄: "regardless of whether it arrived on the `error` (failed) or `output.error` (completed-with-error) field" — `error` 필드 자체가 구조화 객체일 수 있다는 뉘앙스, 그리고 `output.error`(한 겹)를 위치로 지목한다. 실제로는 §4.1-a 에 따라 `error` 는 **항상 문자열**이고 구조화 값은 `output.output.error`(두 겹, 래퍼 통과)에만 있다.
    - 55-56번 줄: "including the legacy `error: string` case" — `error: string` 을 "legacy" 로 서술한다. §4.1-a 실측(emit 4곳 전수)에 따르면 문자열이 **레거시가 아니라 현재의 유일한 정상 형태**다. 이 표현 그대로면 다음 사람이 다시 "옛 backend 호환" 취급으로 오독할 여지가 있다 — 이번 PR 이 정확히 그 오독(구 테스트 라벨 "옛 backend 호환")을 고친 대상이다.
    - 58-59번 줄: "Spec WebSocket Protocol §4.1 error payload shape" — 갱신된 권위 절은 §4.1(2026-08-24 이전 서술)이 아니라 **§4.1-a**다. 함수 본문 주석(77, 86번 줄)은 이미 §4.1-a 를 정확히 인용하는데 최상단 JSDoc 만 낡았다.
  - 제안: JSDoc 을 §4.1-a 인용 + "`error` 는 문자열, 구조화 값은 `output.output.error`" 로 갱신. 코드 동작 자체는 정확하므로 spec 수정이 아니라 **주석 정합화**(같은 PR 범위, developer 권한 내)로 충분.

- **[INFO]** `handleNodeCompleted` 의 기존 호출부(`extractNodeErrorPayload(undefined, payload.output)`, 미변경)도 이번에 바뀐 `nested` 접근 규칙(`rawOutput.output.error`)의 영향을 받는다.
  - 위치: `codebase/frontend/src/lib/websocket/use-execution-events.ts:812` (호출부는 diff 밖, 공유 헬퍼의 의미가 diff 안에서 바뀜)
  - 상세: 이 호출부 코드 자체는 diff 에 없지만 공유 헬퍼의 `nested` 해석이 한 겹 더 깊어졌으므로 동작이 함께 바뀐다. 테스트 `"node.completed with output.error APPENDs system_error (multi-turn AI port=error)"`(`use-execution-events.test.ts:2150` 부근)가 새 래퍼 shape 으로 갱신돼 있고 GREEN 이며, plan 문서가 뮤테이션 테스트로 이 경로가 실제로 RED 를 내는(공허하지 않은) 것을 확인했다고 기록한다. 다만 백엔드 `isErrorPortRouted` 판정(엔진 레벨 `port:'error'` 라우팅)은 오류 종결을 `NODE_FAILED` 로만 finalize 하므로(`execution-engine.service.ts:6085-6099`), 이 `handleNodeCompleted` 분기가 실제 production 이벤트로 도달 가능한지는 이번 검증 범위에서 100% 확증하지 못했다 — 회귀는 아니고 기능 결함도 아니므로 INFO 로만 남긴다.

## 요구사항 충족 평가

핵심 결함("system_error 재시도 배너가 라이브 WS 경로에서 한 번도 뜨지 않는다")과 그 원인(정정 전 §4.1 문구를 그대로 믿은 `extractNodeErrorPayload` 의 얕은 `rawOutput.error` 접근 + `handleNodeFailed` 의 `undefined` 인자)이 정확히 식별되고 고쳐졌다. 수정은 `spec/5-system/6-websocket-protocol.md` §4.1-a(2026-08-24 실측 정정) 및 `spec/conventions/node-output.md` Principle 0 의 래퍼/도메인 구분과 line-level 로 일치하며, 이를 백엔드 emit 소스 4곳(파일:줄 단위)까지 직접 대조해 검증했다 — 문자열 `error` + 2경로만 `output`(래퍼) 동봉이라는 서술이 실제 코드와 정확히 일치한다. 테스트 fixture 전량이 production shape(`error: string`, `output: {output: {...}, config, meta}`)으로 교체됐고, "output 미동봉 경로는 배너 미표시" 캐너리와 "문자열 error + 래퍼 output 조합에서 배너가 뜬다" 캐너리 양쪽이 명시적으로 추가돼 회귀 경계를 고정한다. 대상 테스트 파일을 직접 실행해 87/87 GREEN 을 확인했다. 유일한 흠은 함수 최상단 JSDoc 이 이번에 고친 바로 그 착각(구조화 에러가 `error` 필드 자체거나 `output.error` 한 겹에 있다는 서술, `error: string` 을 "legacy" 로 표기)을 그대로 남겨 다음 회귀의 씨앗이 될 수 있다는 점이며, 이는 사소한 문서 정합 이슈로 기능에는 영향이 없다.

## 위험도

LOW
