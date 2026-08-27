# 정식 규약 준수 검토 — `spec/5-system/` (impl-done, diff-base origin/main)

## 스코프 확인

- `git diff origin/main...HEAD` 결과, **`spec/` 트리는 diff 0** — 이번 PR 은
  `codebase/frontend/src/lib/websocket/use-execution-events.ts` 와 그 테스트
  (`__tests__/use-execution-events.test.ts`) **2개 코드 파일**만 변경한다.
- 따라서 본 검토는 "코드 변경이 이미 존재하는 `spec/5-system/` 서술을 정확히 구현하는가",
  그리고 그 서술이 정식 규약(`spec/conventions/**`)과 정합하는가를 확인하는 데 집중했다.
- 변경 내용: `execution.node.failed` / `execution.node.completed` 이벤트에서
  `system_error` 인라인 배너를 만드는 `extractNodeErrorPayload` 를 `output.output.error`
  (wrapper 한 겹 아래)를 읽도록 정정 + 테스트 fixture 를 production shape 으로 교체.

## 대조한 SoT

- `spec/5-system/6-websocket-protocol.md` §4.1-a (`execution.node.failed` 의
  `error`/`output` — 실측 정정, 2026-08-24) — **직접 원문 확인**: `error` 는 문자열
  (message only), 구조화 객체는 `output.output.error` 에만, `output` 은 error-port 종결·
  AI turn 종결 2경로에서만 동봉. 코드 변경(`extractNodeErrorPayload(rawOutput)` 이
  `asRecord(rawOutput)?.output` → `.error` 를 읽고, 두 호출부가 `payload.output` 만 넘김)이
  이 서술과 **정확히 일치**한다.
- `spec/conventions/node-output.md` Principle 0 (`NodeHandlerOutput` 5필드 불변 +
  "wire envelope 은 이 래퍼를 통째로 싣는다 — 도메인 값은 한 겹 아래다") — 코드 JSDoc 의
  인용과 원문이 일치. Principle 8.1 의 금지 패턴(`output.output.extracted.*`, 핸들러
  반환값 **내부** 이중 래핑)과의 혼동 가능성은 Principle 0 자신이 이미 명시적으로
  분리해 둔다("Principle 8.1 의 금지 패턴과 혼동하지 말 것 — 그쪽은 핸들러 반환값
  내부, 여기는 전송 봉투와 래퍼").
- `spec/conventions/conversation-thread.md` §1.2.1 (`system_error` data shape) —
  `code`/`message`/`retryable`/`retryAfterSec`/`nodeId`/`nodeLabel`/`nodeExecutionId`
  필드 집합이 `makeSystemErrorItem`(변경 없음, 기존 구현) 과 1:1 일치.
- `spec/conventions/conversation-thread.md` §9.7 / §9.10 (CT-S9/CT-S10/CT-S11) —
  diff 의 주석 인용이 실제 절 제목·행 내용과 일치 (§9.10 "회귀 차단 시나리오" 표에
  CT-S9/S10/S11 실존).
- `spec/conventions/node-output.md` Principle 3.2 (`output.error` 표준 형태 —
  `code`/`message`/`details`, `code` 는 `UPPER_SNAKE_CASE`) — 테스트 fixture 의
  `LLM_RATE_LIMIT`/`LLM_CALL_FAILED`/`LLM_OVERLOADED`/`HTTP_5XX` 모두 `spec/5-system/
  3-error-handling.md` §1.4 등록 코드 표기와 일치. §3.2.1 의 `retryAfterSec` invariant
  (`retryable === true` 일 때만 set) 도 새 fixture 전부가 준수.

## 이력 확인 — "자기-반증형 소정정" 적용 이력

`§4.1-a` 서술 자체는 이번 diff 가 아니라 **선행 커밋 `99b9bd908` (#1209)** 에서 작성됐다.
그 커밋은 `impl-prep` 게이트가 CRITICAL 을 낸 사안 — "`conversation-thread.md` 의 상태
예고 문장 정정에는 자기-반증형 소정정 예외를 적용했고, `EIA §R17`/`WS §4.1` 같은 API
계약 서술 정정은 별도 `(planner 턴)` 체크박스로 처리했다" — 를 이미 거쳐 Critical 0 으로
수렴한 기록이 있다(`spec_impact` 2-블록 분리, 체크박스 동기화). 이번 diff 는 그 결과물
(§4.1-a, node-output.md Principle 0)을 **읽기만** 하고 코드를 맞추는 후속 PR 이라, 동일
쟁점을 다시 끌어올 근거가 없다.

## 발견사항

없음 — CRITICAL/WARNING 없음.

- **[INFO]** `spec/5-system/6-websocket-protocol.md` 는 명시적 `## Overview` 절 없이
  타이틀 직후 바로 `## 1. 연결` 로 진입한다 (`spec/5-system/1-auth.md`,
  `3-error-handling.md` 는 `## Overview` 를 갖는 반면 `2-api-convention.md` 도 동일하게
  없음). CLAUDE.md 의 "Overview/본문/Rationale 3섹션 **권장**"에는 못 미치지만,
  이는 이번 diff 가 만든 것이 아니라 `spec/5-system/` 전반의 기존 관행(파일별로
  일관되지 않음)이며 본 PR 의 변경 범위 밖이다. 별도 planner 턴에서 `spec/5-system/`
  전체 톤을 맞출지 여부만 판단하면 되고, 이번 PR 을 막을 사유는 아니다.

## 요약

이번 PR 은 `spec/` 을 전혀 건드리지 않고, 이미 정합화된 `spec/5-system/
6-websocket-protocol.md` §4.1-a 와 `spec/conventions/node-output.md` Principle 0 을
코드가 실제로 구현하도록 맞추는 프론트엔드 버그 수정이다. 함수 시그니처 변경
(`extractNodeErrorPayload(rawOutput)`)·테스트 fixture(production shape) 모두 인용된
SoT 원문과 정확히 일치하며, 에러 코드 명명(`UPPER_SNAKE_CASE`)·`system_error` data
shape 필드 집합·`retryable`/`retryAfterSec` invariant 등 명명·출력 포맷 규약도 위반이
없다. `§4.1-a` 서술 자체의 "자기-반증형 소정정 vs API 계약" 적용 범위 쟁점은 선행
커밋(#1209)에서 이미 게이트를 거쳐 Critical 0 으로 해소된 이력이 있어 재론할 근거가
없다. 발견된 유일한 항목은 `6-websocket-protocol.md` 에 명시적 `## Overview` 절이
없다는 INFO 성 관찰이며, 이는 이번 diff 범위 밖의 기존 상태다.

## 위험도

NONE
