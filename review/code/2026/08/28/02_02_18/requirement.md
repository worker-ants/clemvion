# 요구사항(Requirement) Review — `system_error` 배너 라이브 WS 경로 복구 (3라운드 종합)

## 검증 방법

diff 대상(CHANGELOG.md, `use-execution-events.test.ts`, `use-execution-events.ts`,
`plan/in-progress/system-error-banner-live-ws.md`)에 더해, 이전 두 라운드(`01_26_11`,
`01_44_22`)의 RESOLUTION 이 주장한 정정이 **현재 소스에 실제로 반영됐는지**를 직접
재확인했다:

- `codebase/frontend/src/lib/websocket/use-execution-events.ts` 전문 Read — `asRecord`
  위치, JSDoc 본문, `handleNodeCompleted`/`handleNodeFailed` 양쪽 주석·호출부.
- 백엔드 emit 4곳 전수를 소스 레벨로 직접 열람해 §4.1-a 서술과 대조:
  - `execution-engine.service.ts:6284-6310` (pre-flight/stop) — `error` 문자열, `output` 키 **없음** 확인.
  - `execution-engine.service.ts:6339-6391` (`finalizeErrorPortNode`) — `error` 문자열, `output: nodeExecution.outputData`(래퍼) 확인.
  - `execution-engine.service.ts:7978-8025` (container 실패) — `error` 문자열, `output` 키 **없음** 확인.
  - `ai-turn-orchestrator.service.ts:1513-1547` (AI turn FAILED) — `error` 문자열, `output: nodeExec.outputData`(래퍼), 백엔드 자신도 `outputData.output.error` 로 읽음(1513-1516) 확인.
- `spec/5-system/6-websocket-protocol.md` §4.1(188-189행)·§4.1-a(239-262행), `spec/conventions/node-output.md` Principle 0(20-45행) 을 코드·테스트와 line-level 대조.
- `use-execution-events.test.ts` 의 `system_error inline marker` describe 블록 전문(1964-2320행대) 재확인 — `wrapNodeHandlerOutput` 빌더, 캐너리 2건, 가드 2건, fixture 전환.

## 발견사항

- **[INFO]** 인접 테스트("node.failed on a NON-AI node also carries output into outputData")가 이번 PR 이 세운 "fixture = production shape" 원칙을 적용받지 못한 채 여전히 `error` 를 객체로 보낸다
  - 위치: `codebase/frontend/src/lib/websocket/__tests__/use-execution-events.test.ts:2136` (테스트 시작 2119, `output` 필드는 2125)
  - 상세: 이 테스트는 diff 밖(변경되지 않은 pre-existing 코드, PR #959 유래)이다. 바로 아래 "non-AI node failure does NOT APPEND system_error" 테스트(2302행대)는 이번 diff 에서 정확히 같은 이유("이 PR 이 세운 원칙을 음성 테스트에도 적용")로 `error: "Server error"` 문자열 + `wrapNodeHandlerOutput` 로 정정됐는데(`01_44_22` INFO #8), 이름이 비슷한 이 형제 테스트는 그 정정에서 누락돼 `error: { code: "HTTP_500", message: "Internal Server Error" }` 객체 형태를 그대로 쓴다. §4.1-a 실측(emit 4곳 전수 문자열)과 맞지 않는 shape 이다.
  - 근거: 기능적 위험은 낮다 — 이 테스트가 검증하는 것은 `outputData` 영속(`result?.outputData`)뿐이고, `error` 필드는 `updateNodeStatus` 의 `errorMessage = typeof payload.error === "string" ? payload.error : payload.error?.message` 로 문자열/객체 양쪽을 이미 수용하며 `extractNodeErrorPayload` 는 애초에 `payload.error` 를 보지 않으므로 이 fixture 의 shape 이 틀려도 회귀를 가리지 않는다. 순수 문서 정합(살아있는 fixture 가 production shape 을 서술한다는 이 PR 의 원칙) 문제.
  - 제안: 여유가 있으면 `error: "Internal Server Error"` 로 정정해 이 PR 이 확립한 "fixture = production shape" 원칙을 파일 전체에 일관 적용. diff 범위 밖이라 이번 PR 의 블로커는 아님.

- **[INFO]** `handleNodeCompleted` 분기의 실제 production 도달 가능성은 이번 검증에서도 100% 확증되지 않음 (신규 발견 아님 — `01_26_11` INFO #3 의 승계)
  - 위치: `codebase/frontend/src/lib/websocket/use-execution-events.ts:813-814`
  - 상세: 백엔드에서 "AI turn 이 `error` 포트로 종결"되는 경로(`ai-turn-orchestrator.service.ts:1499-1547`)는 `finalStatus === 'FAILED'` 일 때만 `NODE_FAILED` 를 단발 emit 하며(1527-1532 "AI_MESSAGE 양발사 안 함" 주석과 §3 인용), 이번 조사 범위에서 `execution.node.completed` 에 구조화 `output.output.error` 가 실리는 실제 프로덕션 트리거를 별도로 특정하지 못했다. 이는 이번 diff 가 새로 만든 갭이 아니라(오히려 `payload.output` 을 올바른 2단 언래핑으로 고쳐 이 분기가 **더 정확해졌다**), 코드/테스트 모두 방어적으로 대비해 둔 상태이며 이전 라운드도 동일하게 "회귀/결함 아님" 으로 판정하고 넘겼다. 재지적 목적이 아니라 3라운드 누적 확인 기록.
  - 제안: 조치 불요 (기존 판정 유지). 필요 시 후속으로 백엔드 도달 가능성 조사는 별건.

## 요구사항 충족 평가

핵심 결함(§4.1 정정 전 문구를 믿은 `extractNodeErrorPayload` 가 `payload.error` 를 객체로,
`payload.output` 을 `undefined` 로 다뤄 `system_error` 배너가 라이브 WS 경로에서 한 번도
뜨지 않음)과 원인이 정확히 식별·수정됐다. 현재 코드는 `spec/5-system/6-websocket-protocol.md`
§4.1(189행)·§4.1-a(239-262행)와 `spec/conventions/node-output.md` Principle 0(20-45행)의
문구를 그대로 구현한다 — `asRecord(rawOutput)?.output` → `asRecord(...)?.error` 2단
언래핑, `code`/`message` 필수 가드, `retryable` 미확정 시 `false` 폴백이 각각 spec/테스트
기대와 정확히 일치. 이를 백엔드 emit 소스 4곳(파일:줄) 전수를 직접 열람해 "top-level
`error` 는 항상 문자열, 구조화 객체는 `output` 동봉 2경로(`finalizeErrorPortNode`, AI turn
FAILED)에만 `output.output.error` 로 존재" 서술이 실제 구현과 정확히 일치함을 재확인했다.

이전 두 라운드(`01_26_11`, `01_44_22`)가 지적한 JSDoc 낙후·자매 주석 불일치·`direct` 분기
커버리지 0·fixture 5곳 복제·형제 가드(`!code||!message`) 무테스트·CHANGELOG 누락이 전부
현재 소스에 실제로 반영돼 있음을 직접 대조 확인했다(JSDoc §4.1-a 인용 갱신, `asRecord` 위치
이동, `wrapNodeHandlerOutput` 빌더로 5곳 통합, 가드 2종 신규 테스트, CHANGELOG 항목 추가).
남은 발견사항 2건은 모두 INFO — 하나는 diff 밖 pre-existing 테스트의 fixture shape 잔류
(기능적 회귀 은폐 없음), 다른 하나는 기존에 이미 확인·승인된 도달 가능성 미확증 사항의
승계 기록이다. CRITICAL/WARNING 없음.

## 위험도

NONE
