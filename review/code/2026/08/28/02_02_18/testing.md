# 테스트(Testing) 리뷰 — `system_error` 배너 라이브 WS 복구 (재검토, `02_02_18`)

## 발견사항

- **[WARNING]** `isMultiTurnAiContext`의 "이전 대화 없음(`conversationMessages.length > 0` → `false`)" 분기가 이번 PR 의 시그니처 변경 이후 **어떤 테스트로도 검증되지 않는다** — 뮤테이션으로 직접 실증
  - 위치: `codebase/frontend/src/lib/websocket/__tests__/use-execution-events.test.ts:2323` (`it("AI node failure without prior conversation context does NOT APPEND (single-turn case)", ...)`, `describe("system_error inline marker (CT-S9 / CT-S10 / CT-S11)")` 블록 내부). 대상 소스: `codebase/frontend/src/lib/websocket/use-execution-events.ts:150-153`(`isMultiTurnAiContext`), 호출부 `:814`·`:910`(`errorPayload && isMultiTurnAiContext(...)`)
  - 상세: 이 테스트는 `seedConversation()` 을 호출하지 않고 `error: { code: "LLM_RATE_LIMIT", message: "429" }` 만 보내며 `output` 필드를 아예 싣지 않는다. **이 PR 이전**에는 `extractNodeErrorPayload(payload.error, undefined)` 호출 시 `rawError` 가 객체였으므로 `direct` 분기가 잡아 `errorPayload` 가 non-null 이 됐고, 그래서 이 테스트는 정말로 `isMultiTurnAiContext` 의 "대화 없음 → false" 분기를 검증했다. **이 PR 이후**에는 헬퍼가 `extractNodeErrorPayload(payload.output)` 로 바뀌었는데, 이 fixture 에는 `output` 자체가 없으므로 `asRecord(undefined)?.output` → `undefined`, `source` 도 `null` — `errorPayload` 가 **이미 `null`** 이다. 호출부 조건이 `errorPayload && isMultiTurnAiContext(...)` 이므로 JS 의 `&&` 단락 평가 규칙상 `errorPayload` 가 falsy 인 순간 `isMultiTurnAiContext` 는 **호출조차 되지 않는다**. 즉 이 테스트는 제목이 주장하는 "이전 대화가 없어서 배너가 안 뜬다" 를 더 이상 검증하지 않고, 우연히 "output 이 없어서 배너가 안 뜬다"(다른 테스트가 이미 커버하는 경로)와 같은 이유로 통과한다.
  - 근거(직접 실측, mutation): `isMultiTurnAiContext` 의 `return useExecutionStore.getState().conversationMessages.length > 0;` 를 `return true;` 로 치환(원본 파일은 확인 직후 `cp` 로 즉시 복원, 복원 후 `diff` 로 원본과 바이트 단위 일치 확인)하고 스위트를 재실행 → **89/89 GREEN 유지**(치환 전에도 89/89). `conversationMessages` 가 비어 있어도 `isMultiTurnAiContext` 가 항상 `true` 를 반환하도록 뮤테이션했는데도 전체 스위트가 이 결함을 잡지 못한다 — 이 특정 분기의 커버리지가 실측으로 0 임을 확인.
  - 왜 중요한가: 이 게이트는 "단일 턴 AI Agent 실패 시 무의미한 인라인 마커를 안 띄운다"는 명시적 UX 계약(코드 주석 141-148행)을 지킨다. 이 게이트가 깨지면(예: 항상 `true`) 대화 스레드가 없는 단일 턴 실행에서도 `system_error` 배너가 뜨게 되는데, 지금 스위트는 이를 감지하지 못한다.
  - 참고: 직전 라운드(`01_44_22`) 의 testing 리뷰는 이 테스트를 두고 *"`isMultiTurnAiContext` 게이트에서 조기 차단되므로... 거짓 GREEN 은 아니다(공허 테스트 아님)"* 라고 판정했다. 그 판정은 **`&&` 단락 평가 순서를 놓쳤다** — `isMultiTurnAiContext` 가 아니라 `errorPayload` 쪽에서 먼저 막힌다. 실측(위 뮤테이션)이 그 판정을 반증한다.
  - 제안: 이 테스트의 fixture 에 `output: wrapNodeHandlerOutput({ error: { code: "LLM_RATE_LIMIT", message: "429" } })` 를 추가해 `errorPayload` 가 non-null 이 되도록 하고, `seedConversation()` 을 호출하지 않은 채로 유지해 `isMultiTurnAiContext` 가 실제로 `conversationMessages.length > 0 === false` 분기를 타서 배너를 억제하는지를 검증한다. 같은 게이트가 `handleNodeCompleted`(`:814`)에도 있으므로, 여력이 있다면 `node.completed` 쪽에도 "구조화 에러는 있으나 이전 대화 없음" 케이스 1건을 추가해 두 호출부 모두 커버하는 것을 권장한다.

- **[INFO]** 동일 describe 블록 내 또 다른 fixture(`node.failed on a NON-AI node also carries output into outputData`)도 이 PR 이 세운 "fixture = production shape" 원칙(문자열 `error`)과 다르게 `error` 를 객체로 보낸다 — 직전 두 라운드(`01_26_11`, `01_44_22`) 리뷰가 지목한 2건(`non-AI node failure does NOT APPEND system_error`, `AI node failure without prior conversation context...`)과 별개의 세 번째 사례
  - 위치: `codebase/frontend/src/lib/websocket/__tests__/use-execution-events.test.ts:2136` (`error: { code: "HTTP_500", message: "Internal Server Error" }`)
  - 상세: 이 테스트는 `nodeType: "http_request"` 이므로 `isMultiTurnAiContext` 가 `nodeType !== "ai_agent"` 로 즉시 `false` 를 반환해 `system_error` 로직 자체와 무관하다 — 공허 테스트는 아니다(`errorPayload` 는 `httpOutput.output.error` 를 통해 실제로 non-null 이 되고, `isMultiTurnAiContext` 의 "AI 아님" 분기를 정확히 태운다). 다만 `error` 필드는 이제 `handleNodeFailed` 의 `errorMessage` 계산(`typeof payload.error === "string" ? ... : payload.error?.message`)에만 쓰이므로 문자열이든 객체든 결과가 같아 기능적 결함은 아니다. 다만 이 PR 이 다른 4곳에서 명시적으로 "fixture 를 production shape 으로" 교정한 것과 대비하면 일관성이 떨어지고, 다음 사람이 "객체 `error` 도 흔한 shape" 로 오독할 여지를 남긴다.
  - 제안: 급하지 않음. 여력이 있을 때 `error: "Internal Server Error"` 로 바꿔 스위트 전체의 fixture 일관성을 맞춘다.

- **[INFO]** 이번 라운드에서 추가된 캐너리·가드 테스트는 실제로 뮤테이션에 반응함을 직접 재확인함(회귀 방지 유효성 검증)
  - 위치: `codebase/frontend/src/lib/websocket/__tests__/use-execution-events.test.ts:2236` (`it("[가드] 구조화 에러에 code/message 가 없으면 배너를 안 띄운다", ...)`)
  - 상세: 직전 라운드(`01_44_22` WARNING)가 커버리지 0 으로 지목했던 `if (!code || !message) return null;`(`use-execution-events.ts:94`) 가드를 이번 라운드가 `if (false) return null;` 로 뮤테이션(원본은 확인 직후 즉시 복원, `diff` 로 바이트 일치 확인)했을 때 새로 추가된 이 가드 테스트가 **정확히 실패**함을 직접 재현했다(`AssertionError: expected length 3, got 4`). 지적됐던 갭이 실제로 닫혔음을 확인.
  - 조치 불필요 — 확인 기록.

## 긍정 평가 (회귀·격리·가독성)

- `wrapNodeHandlerOutput()` 빌더로 production shape(`NodeHandlerOutput` 래퍼) fixture 를 5곳 이상에서 재사용 — 이 PR 의 근본 원인("fixture 가 production shape 을 못 따라가 결함을 가림")이 재발할 표면을 실제로 줄였다.
- 캐너리 테스트(`[캐너리] 문자열 error + 래퍼 output 조합에서 배너가 뜬다`)가 라이브 WS 의 정확한 결함 조합(문자열 top-level `error` + 2단 래퍼 `output`)을 최소 형태로 고정해, 회귀 시 원인이 한 줄로 드러나게 설계됨.
- `startExecution` 이 매 테스트 선두에서 `conversationMessages` 를 포함한 스토어를 리셋하므로(`execution-store.ts` 의 `CLEAR_CONVERSATION_SNAPSHOT`), 테스트 간 상태 누수 없이 독립 실행 가능함을 직접 확인.
- `direct` 분기 제거(도달 불가능 + 버그를 낳은 계약을 그대로 인코딩)와 `code`/`message` 누락 가드에 대한 신규 양성/음성 테스트 추가는 모두 실측(뮤테이션)으로 뒷받침됨 — "GREEN 자체는 증거가 아니다" 원칙이 이 PR 전반에 일관되게 적용됨.

## 요약

핵심 회귀 방지 설계(캐너리 + 가드 테스트 + fixture 빌더)는 뮤테이션으로 직접 재검증했을 때 실제로 유효했다. 다만 이 PR 의 `extractNodeErrorPayload` 시그니처 변경(`rawError` 파라미터 제거)이 `&&` 단락 평가 순서를 통해 기존의 `"AI node failure without prior conversation context does NOT APPEND (single-turn case)"` 테스트를 조용히 공허하게 만들었다 — 직전 라운드 리뷰가 "공허 테스트 아님"으로 오판했던 지점이며, 실측(뮤테이션)으로 반증했다. `isMultiTurnAiContext` 의 "이전 대화 없음" 분기 자체는 현재 스위트 어디에서도 `errorPayload` 가 non-null 인 상태로 검증되지 않는다. 이 외에는 fixture 일관성(잔여 객체-shape `error` 1곳)에 관한 낮은 우선순위 정리만 남는다.

## 위험도
LOW
