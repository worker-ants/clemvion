# Cross-Spec 일관성 검토 — `spec/conventions/` (--impl-done, `node-output-envelope`, 재실행 `12_24_55`)

## 컨텍스트 (검토자가 확인한 사실)

- 프롬프트 번들은 컨텍스트 예산 초과로 `spec/conventions/node-output.md` 를 포함한 대다수 conventions
  파일과 git diff 가 생략됐다. 워킹트리(`/Volumes/project/private/clemvion/.claude/worktrees/node-output-envelope-458f05`)
  를 절대경로로 `git diff origin/main...HEAD`/`Read`/`grep` 하여 직접 보완했다.
- HEAD 는 `40ff94307`(`12_13_36` CRITICAL "같은 파일 안의 미러를 놓쳤다 — `chat-channel-adapter.md` §3
  매핑표" 정정 커밋)이다. `grep -n "output\.rendered" spec/conventions/chat-channel-adapter.md` 로
  재확인 — §3 표 행은 이제 `output.output.rendered` 로 정정돼 있고, §1.3 의 유일한 남은 히트는
  정정문 안의 인용(`~~output.rendered~~`)뿐이다. **직전 CRITICAL 은 해소 확인**.
- diff 범위는 `spec/5-system/{14-external-interaction-api,15-chat-channel,6-websocket-protocol}.md`,
  `spec/conventions/{chat-channel-adapter,conversation-thread}.md`,
  `codebase/backend/src/modules/websocket/websocket.service{.ts,.spec.ts}` 다. 코드 diff
  (`allowlistFanoutNodeOutput`/`narrowTopLevelNodeOutput`)와 `NODE_OUTPUT_ALLOWED_KEYS`
  (`shared/utils/node-output-allowlist.ts`)를 직접 읽어 spec 의 "같은 chokepoint, 같은 목록"
  주장이 코드와 정합함을 확인했다(문제 없음).
- `extractRendered`(discord/slack/telegram `*-message.renderer.ts`)가 `rendered → payload.rendered
  → output.rendered` 세 후보를 훑는다는 §3 표 각주도 코드로 확인 — 정합.
- 이번 라운드에서 **새로 발견한 것**은 아래 CRITICAL 1건이다 — 이번 diff 가 만든 결함은 아니지만,
  이번 diff 가 정확히 그 문제의 행(WS §4.1 `execution.node.failed` row)을 편집하면서 **같은 행 안의
  인접 클레임을 검증 없이 재확산**시켰다(직전 라운드가 지적한 "같은 파일 안의 미러 누락"과 같은
  계열의 결함 — 이번엔 "같은 행 안의 다른 클레임").

---

## 발견사항

### [CRITICAL] `execution.node.failed.error` "전체 구조" 클레임이 전 emit 경로에서 반증됨 — `conversation-thread.md` 의 system_error 재시도 배너가 라이브 WS 경로에서 작동 불가

- **target 위치**: `spec/5-system/6-websocket-protocol.md` §4.1, `execution.node.failed` row (이번
  diff 가 `output` 필드 존재를 추가하며 편집한 바로 그 행) —

  > `error` 는 `output.error` 전체 구조 — `{ code: string, message: string, details?: {
  > retryable?: boolean, retryAfterSec?: number, ... 노드별 } }` ([CONVENTIONS Principle
  > 3.2](../conventions/node-output.md#32-outputerror-표준-형태))

  이 클레임(이번 diff 이전부터 존재 — diff 는 앞에 `output` 필드 설명만 추가하고 이 문장은
  그대로 재인용/확산시켰다)은 **wire top-level `error` 필드가 `{code, message, details}` 객체
  형태로 온다**는 뜻이다.

- **충돌 대상**:
  1. `spec/conventions/conversation-thread.md` §1.1.1 / §8.3 / §9.7 / §1.2.1 — `system_error`
     인라인 배너(`[다시 시도]` 버튼 + `retryAfterSec` 카운트다운)가 "WS `execution.node.failed`
     … 수신 시" `output.error` 로부터 합성된다고 명시. §1.2.1 은 `data.retryable`/
     `data.retryAfterSec` 가 이 구조에서 나온다고 규정.
  2. `spec/conventions/node-output.md` §3.2/§3.2.1 — `output.error` 표준 형태 정의(같은 구조).
  3. **실제 backend 구현** — `execution.node.failed` 를 emit 하는 **4곳 전부**를 확인했다
     (`grep -rn "NodeEventType.NODE_FAILED" codebase/backend/src --include="*.ts" | grep -v spec.ts`
     로 소진 확인):
     - `execution-engine.service.ts:6297` (continue-on-error `stop`/`default` 분기) —
       `error: err instanceof Error ? err.message : String(err)` (**string**)
     - `execution-engine.service.ts:6372` (`finalizeErrorPortNode`, D4 error-port 라우팅) —
       `error: errorMessage`(`clampNodeErrorMessage(errorEnvelope?.message ?? …)`, **string**)
     - `execution-engine.service.ts:8013` (container-level 실패) — `error: message` (**string**)
     - `ai-turn-orchestrator.service.ts:1532` (AI multi-turn `endReason: 'error'` 종결,
       `finalizeAiNode(..., 'FAILED')`) — `error: errorMessage`(`errFromOutput?.message` 추출값,
       **string**)

     **4곳 전부 top-level `error` 를 `.message` 만 뽑은 평문 string 으로 보낸다.** 구조화 객체
     (`{code, message, details}`)는 어느 emit 사이트에도 없다 — 전부 **같은 payload 안의
     `output` 필드**(`nodeExecution.outputData`, 즉 `NodeHandlerOutput` 래퍼) **두 겹 아래**인
     `output.output.error` 에만 존재한다.

- **상세 — frontend 소비 코드가 이 gap 을 그대로 상속해 기능이 죽어 있다**:
  `codebase/frontend/src/lib/websocket/use-execution-events.ts` 의 `handleNodeFailed` 는
  `extractNodeErrorPayload(payload.error, undefined)` 를 호출한다 — **`rawOutput` 인자를
  `undefined` 로 고정**(892행 근방). `extractNodeErrorPayload` 내부:
  ```
  const direct = rawError && typeof rawError === "object" ... ? rawError : null;
  const nested = rawOutput && typeof rawOutput === "object" && "error" in rawOutput ... : null;
  const source = direct ?? nested;
  ```
  `rawError`(=`payload.error`)가 **항상 string**이므로 `typeof rawError === "object"` 는 항상
  `false` → `direct = null`. `rawOutput` 이 `undefined` 로 고정돼 있으므로 `nested` 도 항상
  `null`. 즉 **`errorPayload` 는 `execution.node.failed` 라이브 이벤트에서 항상 `null`** 이고,
  `if (errorPayload && isMultiTurnAiContext(...))` 블록(`system_error` APPEND)이 **한 번도
  실행되지 않는다.** fallback 도 없다 — `errorPayload` 가 null 이면 그 자리에 아무 대체 item 도
  추가하지 않는다.

  frontend 테스트(`use-execution-events.test.ts`)가 이 오판을 그대로 코드화한 증거까지 있다:
  - `CT-S9`/`CT-S10`(1986행/2026행)은 `failed?.({ error: { code, message, details: {...} } })`
    로 **객체 shape** fixture 를 주입해 배너가 뜨는 것을 단언한다 — 그러나 이 shape 은 실제
    backend 4개 emit 사이트 중 **어느 것도 만들지 않는다.**
  - `"legacy string error (no structured shape) does NOT APPEND system_error"`(2150행)은
    string `error` 를 **"옛 backend 호환"**(주석 원문)이라 부르며 배너 미표시를 **의도된
    동작**으로 단언한다. 그런데 이 "legacy" shape 이 바로 **현재 backend 의 유일한 실제
    출력**이다 — "옛" 이 아니라 "지금"이다.

  결과: 멀티턴 AI Agent 가 retryable 에러(예: `LLM_RATE_LIMIT` 429)로 종결돼도, **라이브
  실행 화면에서 `[다시 시도]` 재시도 배너가 뜨지 않는다** — `conversation-thread.md` §8.3 이
  명시한 핵심 UX(§402행 "retryable 무관으로 확장한 근거")가 이 경로에서 죽어 있다.
  (완화 요인 — `NodeExecution.outputData` 는 DB 에 정상 영속되므로, 새로고침 후 이력
  재구성 뷰(`conversation-thread.md` §9.7 "실행 이력 복원" 행, DB 직접 읽기)는 정상 동작할
  가능성이 높다 — 이 CRITICAL 은 **라이브 세션 경로에 한정**된다. 이 완화까지 확인하려면
  frontend 이력 뷰 코드를 추가로 열어야 하며 이번 검토 범위 밖이라 단정하지 않는다.)

- **이 diff 와의 관계**: 이 gap 자체는 이번 diff 가 만든 것이 아니다(4개 emit 사이트, frontend
  소비 코드, 테스트 모두 diff 밖). 그러나 이번 diff 는 **정확히 이 행**(`execution.node.failed`
  row)을 편집하면서 인접한 "error 는 output.error 전체 구조" 클레임을 검증 없이 그대로
  재확산시켰다 — `12_13_36` CRITICAL 이 잡은 "같은 파일 안의 미러 누락"과 같은 계열의 결함이
  이번엔 "같은 행 안의 인접 클레임 미검증"으로 재발한 것이다.

- **제안**:
  1. `spec/5-system/6-websocket-protocol.md` §4.1 `execution.node.failed` row 의 "error 는
     `output.error` 전체 구조" 문구를 실측에 맞게 정정 — top-level `error` 는 **항상 string
     (message only)**, 구조화 객체는 **`output.output.error`**(diff 가 이미 확립한 래퍼 2단
     구조) 에만 존재.
  2. `codebase/frontend/.../use-execution-events.ts` 의 `handleNodeFailed` 가
     `extractNodeErrorPayload(payload.error, payload.output)` 로 `rawOutput` 도 전달하도록
     수정(2단 nested 접근 `rawOutput.output.error` 로 `extractNodeErrorPayload` 의 `nested`
     분기 자체도 동시 정정 필요 — 현재는 1단만 봄, `handleNodeCompleted` 호출부도 동일 결함).
  3. `CT-S9`/`CT-S10` fixture 를 실제 backend shape(`error: string`, `output.output.error` 에
     구조화 객체)로 교체하고 "legacy string" 코멘트를 정정.
  4. 이 항목들은 `codebase/**` 변경(frontend 로직 + 백엔드 선택)이라 `developer` 스코프이며,
     spec 문구 정정은 §4.1 row 에 국한된 좁은 정정이라 planner 턴 또는 developer 자기-반증형
     조건 검토 대상 — 단 이 문장은 developer 가 이번 PR 에서 쓴 것이 아니라 **자기-반증형
     소정정 요건 (조건 1: 대상 문장을 developer 자신이 그 문서에 썼다) 미충족**이므로 안전하게는
     planner 턴 권장.

---

### [WARNING] `execution.node.failed` 의 "output 도 함께 실린다" 클레임이 emit 사이트 절반에서만 성립

- **target 위치**: 같은 row — 이번 diff 가 신규 추가한 문장: "**`output` 도 함께 실린다**(=
  `NodeExecution.outputData` 전체, completed 와 같은 래퍼) — 종전 표에 누락돼 있었다 …
  실측: `execution-engine.service.ts` 의 `finalizeErrorPortNode` 가 `output:
  nodeExecution.outputData` 를 동봉)."
- **충돌 대상**: 위에서 열거한 4개 emit 사이트 중 **2곳**(`execution-engine.service.ts:6297`
  continue-on-error 분기, `:8013` container-level 실패)은 emit payload 에 `output` 키 자체가
  없다. 근거로 인용된 것은 `finalizeErrorPortNode`(`:6372`) **한 곳**뿐이라, "output 도 함께
  실린다"는 이 행의 **일반 클레임**(모든 `execution.node.failed` 인스턴스에 적용되는 것처럼
  읽힘)이 실제로는 **error-port 라우팅 + AI multi-turn 종결 두 경로 한정**이다.
- **상세**: 기능적으로는 무해하다 — `narrowTopLevelNodeOutput` 가 `value === null ||
  typeof value !== 'object'` 가드로 `output` 부재를 안전하게 통과시킨다(코드 확인). 순수
  문서 정확도 이슈.
- **제안**: 행 문구를 "error-port 종결(`finalizeErrorPortNode`)·AI turn 종결(`ai-turn-
  orchestrator`)은 `output` 동봉, 일반 pre-flight throw/container 실패 경로는 미동봉"으로
  세분화. 또는 4개 emit 사이트 전부가 `output` 을 동봉하도록 코드를 통일(더 큰 변경, 별건
  권장).

---

## 요약

target 커밋(`40ff94307`)은 직전 라운드(`12_13_36`)가 잡은 CRITICAL("같은 파일 안의 미러 누락",
`chat-channel-adapter.md` §3)을 정확히 해소했다 — 확인 완료. `allowlistFanoutNodeOutput`/
`NODE_OUTPUT_ALLOWED_KEYS` 코드도 spec 의 "같은 chokepoint" 주장과 정합한다. 다만 이번 diff 가
편집한 바로 그 행(WS §4.1 `execution.node.failed`)에서 **새로운 CRITICAL 1건**을 발견했다 —
"`error` 는 `output.error` 전체 구조" 클레임이 실제 4개 emit 사이트 전부(string 만 보냄)와
모순되고, 이 gap 이 `conversation-thread.md` 가 명시한 `system_error` 재시도 배너를 라이브 WS
경로에서 non-functional 하게 만든다(frontend 코드·테스트가 잘못된 가정을 그대로 코드화한
증거 포함). 부수적으로 "output 도 함께 실린다" 클레임도 emit 사이트 절반에서만 성립하는
WARNING 1건. 데이터 모델(§R17 allowlist)·요구사항 ID·RBAC·계층 책임 관점에서는 추가 충돌
없음.

## 위험도

HIGH
