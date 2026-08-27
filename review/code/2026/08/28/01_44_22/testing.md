# 테스트(Testing) 리뷰 — `system_error` 배너 라이브 WS 복구

## 발견사항

- **[WARNING]** `extractNodeErrorPayload` 의 malformed 구조화 에러 가드가 테스트 커버리지 0 — 뮤테이션으로 실증
  - 위치: `codebase/frontend/src/lib/websocket/use-execution-events.ts:94` (`if (!code || !message) return null;`)
  - 상세: `output.output.error` 는 도달했지만 `code`/`message` 가 문자열이 아니거나 누락된 "malformed 백엔드 payload" 를 막는 방어 가드다. 그런데 테스트 스위트(CT-S9/S10/S15, node.completed, 신규 캐너리 2건 포함) 의 모든 fixture 가 `code`+`message` 를 항상 완전하게 채워 보낸다. 직접 뮤테이션으로 실증: `if (!code || !message) return null;` → `if (false) return null;` 로 치환 후 재실행해도 **87/87 GREEN** 유지(원본 파일은 확인 후 즉시 복원, `git diff` 로 clean 확인 완료). 이 PR 이 바로 위(W4, `direct` 분기 제거)에서 "커버리지 0인 방어 분기는 계약을 잘못 인코딩할 위험이 있다"는 판단을 스스로 적용해 놓고, 같은 함수 안의 다른 방어 가드에는 동일 기준을 적용하지 않은 셈이다.
  - 제안: `code`/`message` 중 하나가 없거나 비문자열인 `output.output.error` fixture 로 "배너가 안 뜬다" 를 확인하는 음성 테스트 1건 추가. 도달 불가능이 확실하다면(백엔드가 항상 두 필드를 채운다는 계약이 문서화돼 있다면) W4 와 동일한 논리로 가드 자체를 제거하는 것도 대안.

- **[INFO]** `details` 필드가 아예 없는(`undefined`) 구조화 에러 조합 미검증
  - 위치: `codebase/frontend/src/lib/websocket/use-execution-events.ts:95-98` (`const details = source.details && typeof source.details === "object" ? ... : undefined;`)
  - 상세: 현재 fixture 전부(CT-S9/S10/S15, node.completed, 캐너리)가 `details` 객체를 동봉한다. `details` 키 자체가 없는 경우의 `undefined` fallback 과, 그 결과 `retryable` 이 `false` 로 defaulting 되는 경로(`errorPayload.details?.retryable` optional chaining)가 명시적으로 검증되지 않는다. 우선순위는 낮음 — 코드 로직이 단순하고 다른 계열(예: `typeof source.details === "object"` false 케이스)과 동일 패턴.
  - 제안: `details` 키를 아예 생략한 구조화 에러 1건을 CT-S9/S10 근처에 추가해 `retryable: false` / `retryAfterSec: undefined` 로 안전하게 fallback 됨을 고정.

- **[INFO]** 두 건의 "does NOT APPEND" 테스트가 새 production shape(string `error`) 대신 옛 object-shape `error` fixture 를 그대로 씀 — 결함은 아니지만 이 PR 이 세운 "fixture=production shape" 원칙과 어긋남
  - 위치: `codebase/frontend/src/lib/websocket/__tests__/use-execution-events.test.ts` — `"non-AI node failure does NOT APPEND system_error"` (`error: { code: "HTTP_5XX", message: "Server error" }`), `"AI node failure without prior conversation context does NOT APPEND (single-turn case)"` (`error: { code: "LLM_RATE_LIMIT", message: "429" }`)
  - 상세: 두 테스트 모두 `isMultiTurnAiContext`(nodeType≠ai_agent, 또는 conversationMessages 빈 상태) 게이트에서 조기 차단되므로 `extractNodeErrorPayload` 경로 자체를 타지 않아 **거짓 GREEN 은 아니다**(공허 테스트 아님, 게이트 로직을 정확히 검증). 다만 이번 PR 의 핵심 교훈("fixture 가 production shape 을 못 따라가 결함을 가렸다")과 대조하면, 이 두 곳만 옛 object-shape `error` 를 남겨 둔 것이 다음 사람에게 "object error 도 여전히 쓰인다"는 오해를 줄 수 있다.
  - 제안: 문자열 `error` + `output` 미동봉(또는 nodeType/컨텍스트로만 차단되는) 형태로 교체해 전체 스위트의 fixture 일관성을 맞추면 향후 drift 재발을 더 줄일 수 있다. 급하지 않음.

- **[INFO]** 상위 describe 블록 주석이 여전히 "output.error"(1단계)로 남아 있음 — RESOLUTION 이 이미 고친 것과 같은 클래스의 잔여
  - 위치: `codebase/frontend/src/lib/websocket/__tests__/use-execution-events.test.ts:1965` (`// — node.failed / node.completed (with output.error) → system_error APPEND`)
  - 상세: 이 diff 대상이 아닌 pre-existing 주석이라 diff 에는 안 걸렸지만, 이번 PR 이 정확히 "한 겹 얕은 서술이 결함을 낳았다"를 주제로 삼았고 테스트 제목(INFO#5, `01_26_11`)도 같은 이유로 고쳤던 만큼 이 섹션 헤더 주석도 함께 `output.output.error` 로 정정하는 편이 일관적이다.
  - 제안: `output.error` → `output.output.error` 로 교체.

## 긍정 평가 (회귀·격리·가독성)

- **회귀 방지 설계가 탄탄함**: 결함의 정확한 shape(top-level `error`=문자열 + 구조화 값은 `output.output.error`)을 그대로 인코딩한 캐너리 테스트(`"[캐너리] 문자열 error + 래퍼 output 조합에서 배너가 뜬다"`)와, `output` 미동봉 2경로가 정상임을 고정하는 짝 테스트가 추가됐다. 두 캐너리 모두 왜 필요한지(이전 CT-S9/S10 이 `direct` 분기로 새 채로 통과했던 이유)를 JSDoc 으로 명시해 "왜 이 테스트가 존재하는가"가 코드에 남는다.
- **fixture 헬퍼 추출**: `wrapNodeHandlerOutput()` 빌더가 5곳 전부에서 재사용됨을 grep 으로 확인(`config: {}, meta: {}` 리터럴이 빌더 정의부 1곳에만 존재) — 이 PR 자신의 근본 원인("래퍼를 손으로 복제하면 drift 재생산")을 실제로 해소했다.
- **뮤테이션 증거 문서화**: `plan/in-progress/system-error-banner-live-ws.md` 및 `RESOLUTION.md` 에 M1~M3 뮤테이션의 예측/실측을 모두 기록(M3: 빌더에서 wrapper 를 벗기는 뮤테이션 → 예측 4 failed = 실측 4 failed). 예측을 미리 적어 둔 뒤 실측과 대조하는 방식으로, "GREEN 자체는 증거가 아니다"라는 프로젝트 관례를 그대로 실천했다.
- **테스트 격리 확인**: `describe("system_error inline marker …")` 내 모든 테스트가 `startExecution("exec-1")` 을 선두에서 호출하고, `startExecution` 이 `CLEAR_CONVERSATION_SNAPSHOT` (`conversationMessages: []`) 을 포함해 매 테스트 독립적으로 실행됨을 스토어 구현(`execution-store.ts:534-548`)에서 직접 확인. 상위 `beforeEach` 가 `conversationMessages` 를 명시적으로 리셋하지 않지만 이로 인한 실질적 누수는 없다.
- **`direct` 분기 제거는 타당한 판단**: 이전 라운드(`01_26_11` WARNING#4)에서 커버리지 0으로 지적된 객체-형태 `error` 분기를 코드에서 완전히 제거하고 시그니처도 `extractNodeErrorPayload(rawOutput)` 로 좁혔다 — "도달 불가능 + 버그를 낳은 계약을 인코딩" 이라는 근거가 실측(호출부 2곳 전수 확인)에 기반해 명확하다.
- **테스트 재실행 확인**: 87/87 GREEN 을 본 리뷰에서도 직접 재확인(`pnpm exec vitest run src/lib/websocket/__tests__/use-execution-events.test.ts`). 위 WARNING 의 뮤테이션 검증도 동일 스위트로 수행 후 원본 파일 복원 및 `git diff` clean 확인 완료.

## 요약

핵심 버그(WS 라이브 경로에서 `system_error` 배너가 한 번도 뜨지 않던 문제)의 근본 원인 — fixture 가 production shape 을 못 따라가 결함을 가림 — 을 정확히 짚고, 그 교훈을 fixture 빌더 추출·캐너리 테스트·뮤테이션 검증으로 구조적으로 반영한 좋은 회귀 테스트 작업이다. 다만 같은 함수 안에서 이번에 새로 손댄 malformed-payload 가드(`!code || !message`)는 정작 무테스트 상태이며, 뮤테이션으로 직접 실증(가드 무력화 후에도 87/87 GREEN)했다 — 이 PR 이 방금 다른 분기(`direct`)에 적용한 "커버리지 없는 방어 분기는 위험하다"는 원칙이 이 가드에는 적용되지 않은 셈이라 WARNING 으로 표기한다. 그 외에는 `details` 부재 조합 미검증, 일부 "no APPEND" 테스트의 fixture 가 옛 object-shape `error` 를 남긴 점, 상위 섹션 주석의 잔여 "output.error" 표기 등 낮은 우선순위의 INFO 항목뿐이며 전반적으로 회귀·격리·가독성 측면에서 모범적인 수준이다.

## 위험도

LOW
