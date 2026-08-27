# 요구사항(Requirement) Review — `system_error` 배너 라이브 WS 경로 복구 (round 5, `02_57_18`)

## 검증 방법

`git diff origin/main...HEAD` 로 코드 변경 3파일(`use-execution-events.ts`,
`use-execution-events.test.ts`, `plan/in-progress/system-error-banner-live-ws.md`)을 직접
Read/Grep 하고, 아래를 소스 레벨로 독립 재검증했다 (review/ 하위 4라운드 산출물은 신뢰하지
않고 각 주장을 재실측):

- `pnpm vitest run src/lib/websocket/__tests__/use-execution-events.test.ts` → **95/95 GREEN**
- `pnpm exec tsc --noEmit -p .` → 클린(에러 0)
- `spec/5-system/6-websocket-protocol.md` §4.1 / §4.1-a, `spec/conventions/node-output.md`
  Principle 0 을 열어 함수 본문·JSDoc·인라인 주석과 line-level 대조
- 백엔드 emit 4곳 전수를 좌표까지 열어 확인: `execution-engine.service.ts:6284-6307`
  (pre-flight/stop, `error` 문자열·`output` 키 없음), `:6339-6386`(`finalizeErrorPortNode`,
  `error` 문자열·`output: nodeExecution.outputData`), `:7982-8024`(container 실패, `error`
  문자열·`output` 키 없음), `ai-turn-orchestrator.service.ts:1449-1543`(AI turn FAILED,
  `error` 문자열·`output: nodeExec.outputData`, 백엔드 자신도 `outputData.output.error` 로
  읽음) — plan 문서가 인용한 4개 좌표와 정확히 일치함을 확인
- `extractNodeErrorPayload` 유일 호출부 2곳(`handleNodeCompleted:813`, `handleNodeFailed:909`)
  외 다른 소비처 없음을 grep 으로 확인 — 시그니처 축소(`rawError, rawOutput` → `rawOutput`)의
  영향 범위가 diff 안에 닫혀 있음

## 발견사항

없음 (CRITICAL/WARNING 0). 이전 4라운드(`01_26_11`→`01_44_22`→`02_02_18`→`02_21_19`→
`02_39_10`)가 지적한 모든 항목이 현재 HEAD 에 반영돼 있음을 직접 대조로 확인했다:

- `extractNodeErrorPayload` JSDoc 이 §4.1-a·`output.output.error`·`asRecord` 정의 위치와
  일치 (`use-execution-events.ts:56-80`, `asRecord` 는 함수 바로 위 51-54행)
- `handleNodeCompleted`(808-811행 부근) 주석도 `output.output.error` + 래퍼 근거로 정정돼
  `handleNodeFailed` 주석과 대칭
- `direct`(객체 `error`) 분기 완전 제거, 시그니처 `extractNodeErrorPayload(rawOutput)` 로
  좁혀짐, 호출부 2곳 모두 동반 수정
- fixture 전량이 production shape(top-level `error`=문자열, 구조화 값은
  `wrapNodeHandlerOutput()` 빌더로 만든 `{output, config:{}, meta:{}}` 래퍼 안의
  `output.error`)로 정정 — 5곳 손복제 대신 공유 빌더 1곳
- 캐너리 2건("문자열 error + 래퍼 output 조합에서 배너가 뜬다" / "`output` 미동봉 경로는
  배너가 안 뜬다") + `||` 좌/우항 분리 가드 2건 + `details` 타입 drift 가드 3건(양쪽 핸들러
  대칭) + `isMultiTurnAiContext` "이전 대화 없음" 분기를 실제로 태우는 테스트 — 전부 현재
  파일에 존재하고 GREEN

## 요구사항 충족 평가

핵심 결함("`system_error` 재시도 배너가 라이브 WS 경로에서 한 번도 뜨지 않는다")과 그 원인
(정정 전 §4.1 문구를 믿은 `extractNodeErrorPayload` 의 얕은 `rawOutput.error` 접근 +
`handleNodeFailed` 의 `undefined` 인자)이 정확히 식별·수정됐다. 백엔드 emit 4곳 전수를
좌표 단위로 직접 열어본 결과 top-level `error` 는 예외 없이 **문자열**이고 구조화 값은
`output.output.error`(래퍼 한 겹 아래)에만, 그것도 2경로(error-port 종결·AI turn 종결)에서만
동봉된다는 plan 문서의 주장이 소스와 **정확히 일치**한다. 이는 `spec/5-system/
6-websocket-protocol.md` §4.1-a(2026-08-24 실측 정정) 및 `spec/conventions/node-output.md`
Principle 0 의 문구와도 line-level 로 일치 — spec 이 이미 정정돼 있었고 코드가 그것을
뒤늦게 따라잡은 것이므로 spec 수정 대상은 없다. `handleNodeCompleted` 경로(AI Agent
`node.completed` + `port:'error'`)의 실제 production 도달 가능성은 이번 검증에서도
100% 확증되지 않았으나(`finalizeAiNode` 의 `NODE_COMPLETED` emit 은 `!isFailed` 분기에서만
발생하는 것으로 실측), 이는 이 PR 이 신규로 만든 경로가 아니라 기존 호출부의 동작을
고친 것이고 4라운드 연속 INFO 로 판정된 사안이라 이번에도 회귀/결함 아님(INFO 성격)으로
본다 — 별건 백엔드 조사이며 이 PR 과 직교.

테스트 스위트 95/95 GREEN, `tsc --noEmit` 클린을 직접 실행해 확인했다(문서 주장을 재현이
아니라 실행으로 검증). TODO/FIXME/HACK/XXX 신규 도입 없음. 반환값·엣지케이스(빈 컬렉션
`details` 부재, non-object `details`, 배열 `output`, `code`/`message` 각각 단독 부재)
전부 명시적으로 방어되고 fixture 로 고정돼 있다.

## 위험도

NONE
