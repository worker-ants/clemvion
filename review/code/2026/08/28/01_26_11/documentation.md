# 문서화(Documentation) 리뷰

### 발견사항

- **[WARNING]** `extractNodeErrorPayload` 의 JSDoc 헤더가 이번에 고친 함수 본문과 어긋난다 (오래된 주석)
  - 위치: `codebase/frontend/src/lib/websocket/use-execution-events.ts:52-59`
  - 상세: 함수 바로 위 JSDoc(51~60행)은 "Extract a structured `output.error` payload... regardless of whether it arrived on the `error` (failed) or `output.error` (completed-with-error) field" 라고 서술하고, SoT 를 "WebSocket Protocol §4.1 error payload shape" 로 인용한다. 그러나 이번 diff 로 함수 본문(83~90행)은 `rawOutput.output.error` (래퍼 한 겹 아래)를 읽도록 고쳐졌고, 인용도 `§4.1-a` (2026-08-24 실측 정정)로 바뀌었다. 즉 함수 몸통의 인라인 주석 3곳은 전부 갱신됐는데 그 위 JSDoc 헤더만 옛 문구(`output.error`, `§4.1`)를 그대로 남겼다. 또한 JSDoc 55행은 문자열 `error` 를 "legacy" 로 표현하는데, 이번 PR 의 조사 결과(plan 문서 및 본문 76~78행 주석)는 문자열이 오히려 **현재 production 이 실제로 보내는 형태**이고 객체 형태가 사실상 안 탄다는 것을 확인했다 — "legacy" 라는 표현이 이제 실태와 반대다.
  - 근거: plan 문서(`plan/in-progress/system-error-banner-live-ws.md`) 자체가 "종전 주석이 이 파일의 결함을 낳았다" 고 명시한다(`use-execution-events.ts:847-849` 참고). 같은 파일에 또 다른 오래된 주석(이번엔 JSDoc)을 남겨두는 것은 동일 클래스의 재발 위험을 그대로 안고 가는 것이다.
  - 제안: JSDoc 을 본문 주석과 동일하게 "top-level `error` 는 문자열, 구조화 객체는 `output.output.error` 에만 있다 (§4.1-a)" 로 갱신하고, "legacy" 표현을 삭제하거나 "일반적인(공통) 형태"로 정정한다.

- **[WARNING]** 자매 호출부(`handleNodeCompleted`) 의 주석이 이번 수정에서 갱신되지 않아 `handleNodeFailed` 주석과 불일치한다
  - 위치: `codebase/frontend/src/lib/websocket/use-execution-events.ts:808-811`
  - 상세: `handleNodeFailed` 위 주석(842~849행)은 이번 PR 에서 "구조화 객체는 `output.output.error` 에만 있다" 로 정확히 고쳐졌다. 그러나 거의 동일한 목적으로 `extractNodeErrorPayload(undefined, payload.output)` 를 호출하는 `handleNodeCompleted` 위의 주석(808~811행, "port: 'error' 로 종결되면 `output.error` 를 운반한다")은 이번 diff 대상이 아니어서 옛 표현(`output.error`, 한 겹 얕음)을 그대로 유지한다. 헬퍼 자체가 전역적으로 고쳐졌으므로 이 호출부의 동작은 정상이지만, 주석은 여전히 틀린 shape 을 서술한다.
  - 제안: 같은 diff 에서 `handleNodeFailed` 주석에 적용한 정정("`output.output.error`")을 `handleNodeCompleted` 쪽 주석에도 동일하게 반영한다.

- **[INFO]** 기존 테스트 제목이 갱신된 fixture shape 과 어긋난다 (living documentation 불일치)
  - 위치: `codebase/frontend/src/lib/websocket/__tests__/use-execution-events.test.ts:2150`
  - 상세: `it("node.completed with output.error APPENDs system_error (multi-turn AI port=error)", ...)` 의 payload 는 이번 diff 로 `output: { output: { error: {...} } } }` (래퍼 한 겹 추가)로 바뀌었지만, 테스트 제목은 여전히 "output.error" 라고만 표기한다. 바로 아래 새로 추가된 캐너리 테스트는 동일 shape 을 "래퍼 한 겹 아래(`output.output.error`)"로 정확히 서술하고 있어(2183행), 인접한 두 테스트 사이에 표현이 어긋난다.
  - 제안: 제목을 `"node.completed with output.output.error APPENDs system_error ..."` 등으로 갱신해 실제 payload shape 과 맞춘다.

- **[INFO]** README/CHANGELOG/설정 문서/API 문서 — 해당 없음
  - 상세: 이번 변경은 프런트 WS 이벤트 핸들러 내부 버그 수정이며 새 환경변수·설정·공개 API·엔드포인트 추가가 없다. spec(`spec/5-system/6-websocket-protocol.md §4.1-a`)은 이미 2026-08-24 에 정정되어 있고 이번 코드 변경은 그 spec 을 뒤늦게 따라잡는 것이므로 추가 spec 문서 작업도 불필요하다(plan 파일의 `spec_impact: none` 과 일치, 실제로 spec 파일이 이번 diff 에 없음을 확인).
  - 근거: `grep`으로 spec 파일에 `§4.1-a` 섹션이 이미 존재함을 확인(`spec/5-system/6-websocket-protocol.md:239` "#### 4.1-a `execution.node.failed` 의 `error`/`output` — 실측 정정 (2026-08-24)").

- **[INFO]** `plan/in-progress/system-error-banner-live-ws.md` 는 모범적인 변경 이력 기록이다
  - 상세: 결함의 정확한 실측(emit 4곳 좌표), 테스트가 결함을 가리게 된 이유, 스코프 밖 항목까지 명시한 신규 plan 문서로 이번 PR 의 "why" 를 충실히 남긴다. 프로젝트 컨벤션(CHANGELOG 대체)에 부합하며 추가 조치 불필요.

### 요약
이번 diff 의 인라인 주석(핵심 로직 바로 옆)은 매우 꼼꼼하다 — 옛 주석을 취소선으로 남기고 왜 틀렸는지까지 설명하는 등 사후 이력 보존이 우수하다. 다만 그 세심함이 함수 전체에 균일하게 적용되지 않았다: `extractNodeErrorPayload` 위의 공개 JSDoc 헤더와 `handleNodeCompleted` 쪽 자매 주석은 옛 shape(`output.error`, "§4.1", "legacy" 문자열)을 그대로 남겨 방금 고친 코드와 모순된다. 이 PR 의 plan 문서가 스스로 "틀린 주석이 이 결함을 낳았다"고 진단한 만큼, 같은 파일에 남은 두 군데의 낙후된 서술은 향후 유지보수자를 다시 같은 함정으로 이끌 위험이 있다. 테스트 제목 하나도 새 fixture shape 을 반영하지 못해 living documentation 으로서의 정확도가 떨어진다. README·API 문서·설정 문서·CHANGELOG 관점에서는 추가 조치가 필요 없다.

### 위험도
LOW
