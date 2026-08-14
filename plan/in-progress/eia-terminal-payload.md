---
title: 종결 이벤트 payload 일괄 정리 — error 객체 형태 + durationMs + result.outputs
worktree: eia-r8-cache-scope-4ae434
started: 2026-08-14
owner: developer
status: in-progress
priority: P2
spec_impact:
  - spec/5-system/14-external-interaction-api.md
---

> **워크트리 이름이 작업과 무관하다.** `eia-r8-cache-scope-4ae434` 는 재사용된 것이고
> 실제 브랜치는 `claude/eia-terminal-payload` 다. 세션이 이 워크트리에 고정돼 있어
> 이동할 수 없었다 — [`update-returning-tuple-shape.md`](./update-returning-tuple-shape.md)
> §후속에 등재한 harness 항목(프롬프트에 박히는 절대경로가 검토 대상을 오염시킴)의
> **예고된 재발**이다. consistency 라운드에서 같은 오탐이 나오면 그 항목을 참조할 것.

## Overview

`update-returning-tuple-shape.md` 의 후속 ③. 착수 전 재판정에서 **원래 서술이 두 군데
어긋나 있었다.**

## 재판정 (2026-08-14, origin/main `f9d31041d` 기준)

### ① "외부 계약 위반이다" — 아니다

`durationMs`·`result.outputs` 는 `#1166` 이 EIA §6 을 단일 SoT 로 재작성하면서 이미
**`미구현 (Planned)`** 으로 표시했다. spec 이 약속하지 않으므로 계약 위반이 아니라
**미구현 기능**이다. 그래서 이 작업은 버그 수정이 아니라 기능 완성이고, spec 의
`Planned → 구현됨` 상태 전환이 동반돼야 한다(권한 밖 → planner 위임).

### ② "5곳 전부 문자열이다" — 틀렸다. 4곳이다

**내 실측이 틀렸다.** 감사 스크립트가 "리터럴이 `{` 로 시작하는가" 라는 **구문 프록시**로
분류해서, 타입이 객체인 변수(`opts.error: { code, message }`)를 문자열로 찍었다.
타입으로 다시 세니 spec 의 *"일부 경로는 string"* 이 **맞았다**.

| 지점 | emit 형태 | 같은 자리에 이미 있는 객체 |
|---|---|---|
| `execution-engine.service.ts:659` (`failFirstSegmentSetup`) | 문자열 | `row.error = { message }` (`:629`) |
| `execution-engine.service.ts:1084` (`emitCancelled`) | **객체** ✓ 손댈 것 없음 | — |
| `execution-engine.service.ts:3301` (`finalizeStalledExhausted`) | 문자열 리터럴 | ~~없음~~ → **있다** (재판정 ③) |
| `execution-engine.service.ts:4862` (`finalizeFailedExecution`) | 문자열 | `savedExecution.error = { message, code? }` (`:4829`) |
| `retry-turn.service.ts:963` | 문자열 | `execution.error = { message }` (`:937`) |

**핵심**: 4곳 **전부** 객체를 이미 만들어 DB 에 저장하고 있고 emit 만 그걸 버린다
(재판정 ③ 에서 3→4 로 정정). 새로 만들 객체는 **0개**다.

> **교훈(재발)**: "실측했다" 가 또 프록시였다. 구문 형태(`{` 로 시작)로 타입 질문에
> 답했다. 값의 **타입**을 물어야 했다.

## 재판정 ③ (2026-08-14, `origin/main` `589914d6d` — #1169 머지 후)

착수 직전 전제를 다시 실측했다. **세 군데가 틀렸고, 그중 하나는 이미 spec 본문에 전파됐다.**

### ③-a stalled 경로에 객체가 "없다" — 거짓. 있다

`execution-engine.service.ts:3263-3270` 이 DB 에 이미 객체를 쓴다:

```ts
error: { code: 'WORKER_HEARTBEAT_TIMEOUT',
         message: 'Execution failed: worker crash (stalled 재배달 attempts 소진)' }
```

그런데 `:3302-3305` 의 emit 은 그 message 를 **손으로 다시 적는다** — 그 과정에서
`attempts` 가 빠져 **DB 와 wire 의 문구가 이미 어긋나 있다**. 객체를 그대로 실으면
이 불일치도 함께 사라진다.

### ③-b "`code` 를 만드는 건 sentinel 뿐" — 거짓. 그리고 **spec 에 전파됐다**

`WORKER_HEARTBEAT_TIMEOUT` 은 **조건 없이** 붙고(`:3266`·`:3289` 두 곳), cancelled 계열도
`RESUME_*`·`EXECUTION_QUEUE_WAIT_TIMEOUT`·`WEBCHAT_IDLE_TIMEOUT` 을 만든다 — 뒤 셋은
**같은 문서 §6.5 행동 계약 표가 직접 열거하는 코드**다.

이 문장이 planner 턴을 거쳐 `14-external-interaction-api.md` §6.4 Rationale 로 들어갔다:

> "종결 `error` 를 싣는 4개 지점 중 실제로 코드를 만드는 것은 sentinel 경로뿐"

**결론(`code` nullable)은 그대로 서지만 근거가 사실과 다르다.** planner 턴으로 정정한다 —
틀린 근거를 남겨 두면 다음 사람이 그걸 인용해 또 틀린다. (이번 브랜치가 정확히 그 경로였다:
plan 의 오판 → planner 턴 → spec 본문.)

### ③-c `durationMs` 를 "종결 3종" 에 채우는 것은 작지 않다

plan 은 `error` 와 묶어 "새로 계산할 것이 없다" 고 했는데 **`durationMs` 는 다르다.**

| 경로 | emit 시점 접근 |
|---|---|
| completed 6곳 | **전부 있다** — 직전 줄에서 계산 |
| `finalizeFailedExecution` · `failRetryExecution` | 있다 |
| `failFirstSegmentSetup` | 조건부 (`if (row.startedAt)` 안) |
| `finalizeStalledExhausted` | **없다** — 엔티티 미로드 raw UPDATE, `durationMs` 계산·저장 안 함 |
| `emitCancellationEvent` | **없다** — 시그니처에 없고, 호출 5곳 중 4곳은 `durationMs` 를 영속조차 안 함 |

즉 §6 표의 *"데이터는 emit 직전 존재한다"* 도 **completed 에 대해서만 참**이다.
cancel 계열에 채우려면 DB write 5곳 + `emitCancellationEvent` 시그니처를 넓혀야 한다.

### ③-d `EiaFailedEvent` 가 #1169 이후 **새로** 어긋났다

`chat-channel/types.ts:392-401` 은 `code: string`(non-nullable)·`nodeId?: string | null` 인데,
#1169 이 spec §6.4 를 `code: … | null`·`nodeId: "uuid" | null` 로 바꿨다. `error` 객체화 시
이 타입도 함께 고쳐야 한다. **plan 이 등재하지 않았던 항목**이다.

### ③-e 부재 표현이 "키 생략" 이 아니라 **명시적 `null`** 로 확정됐다

#1169 이 §6.4 를 그렇게 못박았는데, emit 후보인 4개 DB 객체는 **전부 키를 생략**한다.
그대로 실으면 spec 위반이다 — **emit 시점에 `code: null`/`nodeId: null` 을 보충**해야 한다.
plan 이 기대한 "그걸 싣기만 하면 된다" 보다 한 단계 더 있다.

> `nodeId` 는 어느 경로도 `Execution.error` 에 쓰지 않으므로 전 경로 `null` 이 된다.
> data-model 의 "최초 failed NodeExecution 의 에러 정보를 복사" 는 `nodeId` 에 한해
> 구현이 없다. spec 상 `null` 은 합법이다.

## 재판정 ③ 에 따른 범위 조정

`error` 와 `durationMs` 는 **비용이 다르다**(③-c). 한 PR 로 묶으면 잘 이해된 `error` 정정이
`durationMs` 의 cancel-경로 배관에 발목잡힌다. **나눈다**:

- **이번 PR** — `error` 객체화 4곳 + `null` 정규화 + `types.ts` drift + dispatcher wrap 정리
  + spec 근거 문장 정정(③-b). 하나의 관심사다
- **다음** — `durationMs`(cancel 배관 포함) + `result.outputs`

## `nodeId` — 이미 답이 있었다 (해소)

spec §6.4 가 **`"nodeId": "uuid" | null`** 로 nullable 을 선언한다(`9a4d3e32b` = #1166).
즉 worker 크래시처럼 노드가 없는 경로는 `null` 이 정답이고, planner 에스컬레이션이 필요 없다.
**확보 가능한 경로에만 채우고 나머지는 `null`.**

> 내가 "필수면 만족 불가능" 이라며 미해결로 열어 둔 항목인데 **문서가 이미 답한 상태**였다
> (`07_44_12` plan_coherence INFO 4). 착수 전에 target 문서를 끝까지 안 읽은 것이다.

## 🚫 구현 차단 — `--impl-prep` `07_44_12` **BLOCK: YES**

`spec/` 쓰기는 developer 권한 밖이라 **구현을 멈추고 planner 로 넘긴다** (CLAUDE.md §Skill 체계).

### CRITICAL — §6.2 webhook 예시가 자기 문서의 봉투 규칙을 어긴다

**직접 검증했다.** §6 도입부가 "채널별 봉투(normative)" 로 webhook 은
`{type,…,payload:{…}}` 라 선언하고 §6.3/§6.4 는 그대로 따르는데(각각 `"payload": {` +
`// webhook 봉투 기준…` 주석), **§6.2 만 `node`/`interaction`/`context` 를 최상위에 flat**
으로 늘어놓는다. 구현도 `notification-fanout.service.ts:134` 이 `payload: event.payload` 로
**모든 이벤트를 감싼다.**

→ 그 예시대로 파서를 짠 외부 통합자는 `waiting_for_input` 에서 실패한다.
→ planner 가 §6.2 jsonc 를 §6.3/§6.4 와 같은 구조로 재작성 + 같은 주석 부착 (3~4줄).

### 함께 넘기는 spec 항목

| 항목 | 내용 |
|---|---|
| `1-data-model.md` §2.14 | `Execution.error` 구조 행에 nullable `nodeId` 미반영 — `{nodeId: "uuid"\|null, code, message, details?}` 로 갱신 (W1) |
| §6.2 URL 4줄 | `/v1/` 버전 세그먼트 + 실재하지 않는 `api.clemvion.ai` 도메인. `2-api-convention.md §1`("버전은 URL 경로에 미포함") 위반이고 `spec/**` 에서 이 4줄에만 등장 (W3) |
| §6 `error.code` | 스키마가 `code` 를 "항상 존재" 로 전제하는데 **실제 4개 지점 중 2곳은 `code` 를 만든 적이 없다**(`failFirstSegmentSetup`·`failRetryExecution`). 아래 §결정 참조 (W2) |
| 인용 오귀속 (L472·673) | "Conversation Thread §4.4.6" 이 실제로는 `6-websocket-protocol.md` 헤딩을 가리킨다 (INFO 3) |

## 결정 — `error.code` 를 어떻게 채울 것인가 (W2)

실측: 4개 emit 지점 중 `code` 를 실제로 갖는 것은 `finalizeFailedExecution` 의
sentinel 경로(`ErrorPortFallbackError`/`ExecutionTimeLimitError`)뿐이다.

**(b) 를 택한다 — spec 에서 `code` 를 옵셔널로 정정**(planner). 이유:
일반 `catch (err)` 에 fallback code(`EXECUTION_FAILED` 류)를 넣으면 **의미 없는 코드가
의미 있는 코드와 같은 자리에 섞여** 수신자가 분기할 수 없게 된다. "코드가 없다" 는 정보를
`code` 부재로 정직하게 전달하는 편이 낫다. 있는 곳에서는 그대로 싣는다.

## 범위 (사용자 결정: "둘 다 — 종결 payload 일괄 정리")

> **범위가 재판정 ③ 으로 나뉘었다** — 아래 durationMs·result.outputs 는 **다음 PR 로 이연**.
> 이번 PR 은 `error` 한 관심사다 (`22_29_16` plan_coherence W5).

### 이번 PR

- [ ] `error` 객체 형태 — **4곳** (`:659` · `:3301` · `:4862` · `retry-turn:963`).
      `:1084` 은 이미 객체라 손대지 않는다. **4곳 전부 DB 객체가 이미 있다**(재판정 ③-a)
- [ ] **`null` 정규화** — emit 시점에 `code: null`/`nodeId: null` 보충. DB 객체는 키를
      생략하는데 §6.4 는 명시적 `null` 을 요구한다 (재판정 ③-e)
- [ ] **동반 필수** (`07_44_12` plan_coherence W5, developer 권한 내):
  - `chat-channel.dispatcher.ts:535~568` — string/object back-compat wrap 이 **존재한 적 없는
    plan 이름**을 주석으로 가리킨다. `error` 가 전 경로 객체가 되면 이 wrap 의 존재 이유가
    바뀌므로 함께 정리
  - `chat-channel/types.ts:386~390` — `EiaCompletedEvent.result` 가 §6 이 "설계된 적 없다" 고
    명시한 `finalNodeId`/`finalPort` 를 **여전히 선언**한다(유령 타입 필드)
  - **`chat-channel/types.ts:392~401`** — `EiaFailedEvent.error` 의 `code: string`(non-nullable)·
    `nodeId?` 가 #1169 이 만든 §6.4 `| null` 계약과 어긋난다 (재판정 ③-d).
    **재판정에서 "미등재" 라 적어 놓고 정작 이 체크리스트에 안 넣었다** (`22_29_16` W4) —
    지적하는 것과 등재하는 것은 별개의 동작이다

### 다음 PR (이연)

- [ ] `durationMs` — 종결 3종. **취소 경로 배관 필요**(재판정 ③-c): `finalizeStalledExhausted`
      raw UPDATE + `emitCancellationEvent` 시그니처 + 호출 5곳 중 4곳의 DB write
- [ ] `result.outputs` — `completed`

## 차단 해제 조건

이 plan 의 `--impl-prep` BLOCK: YES 를 실제로 푸는 것은
[`spec-draft-eia-62-waiting-payload.md`](./spec-draft-eia-62-waiting-payload.md) 다 —
§6.2 봉투·`error.code` 옵셔널·data-model nullable `nodeId` 를 담은 **정본 planner draft**.
그쪽이 spec 에 반영돼야 여기가 진행된다 (`10_32_29` plan_coherence W4 — 자신을 풀어 줄
문서를 정작 참조하지 않고 있었다).

## 다른 plan 과의 관계 (W4·W6 — 교차 참조 없이 등재했었다)

이 작업을 이미 추적 중인 plan 이 셋 있다. 구현 후 **그쪽 체크박스가 stale 로 남지 않게**
동시 갱신할 것:

- [`spec-sync-external-interaction-api-gaps.md`](./spec-sync-external-interaction-api-gaps.md) — **정본**
- [`spec-draft-eia-notification-payload-contract.md`](./spec-draft-eia-notification-payload-contract.md)
- [`backend-lint-gate-broken-on-main.md`](./backend-lint-gate-broken-on-main.md) (774~791행)

그리고 [`retry-turn-terminal-guard.md`](./retry-turn-terminal-guard.md) `#2`(`cancelledBy` 추가)가
**같은 코드 블록**(`retry-turn.service.ts` `failRetryExecution` `:956~965`)을 겨냥한다 —
같은 턴에 함께 처리하거나 순서를 맞출 것.

## 체크리스트

- [x] 착수 전 재판정 (원래 서술 2건 정정 — 계약위반 아님 / 4곳이지 5곳 아님)
- [x] `--impl-prep` 실행 → **BLOCK: YES** (spec CRITICAL 1건, 권한 밖)
- [x] `nodeId` 미해결 항목 해소 (spec 이 이미 nullable 선언)
- [x] **planner 턴 완료** (`4b13ca5ae`) — §6.2 봉투 래퍼 · `interaction` Planned 표기 ·
      URL 상대경로 · blockquote 양변 교체 · `error.code` nullable · data-model §2.14 ·
      §R17/WS §4.4 strip 범위. `--impl-done` `15_36_59` **BLOCK: NO**.
      → **이 plan 의 차단이 풀렸다.** 종결 payload 구현(`error` 객체화·`durationMs`·
      `result.outputs`)을 이제 착수할 수 있다
- [x] `--impl-prep` 재실행 **BLOCK: NO** (`22_29_16`)
- [x] 구현 + 테스트 (`6aa0699b8` + 리뷰 fix) — `error` 객체화 4곳 · `toTerminalErrorPayload`
      15 tests · chat-channel 동반 3건 · 프런트엔드 소비자 갱신
- [x] `/ai-review` `22_55_51` — **CRITICAL 1**(프런트엔드 미갱신) 포함, 조치 완료
- [ ] `/consistency-check --impl-done`
- [ ] 위 3개 plan 체크박스 동시 갱신

> **CRITICAL 이 잡은 것**: 이 plan 의 "동반 필수" 목록이 **백엔드 소비자만** 셌다.
> 같은 wire 이벤트를 내부 에디터 WS 채널이 소비하는데(`use-execution-events.ts`),
> `data as { error?: string }` 는 **캐스팅이지 검증이 아니라** 타입체커가 침묵했고,
> `{item.error}` 가 JSX child 로 렌더돼 React 가 던지는 경로였다.
> **wire 형태를 바꿀 때 세어야 하는 것은 "백엔드 소비자" 가 아니라 "그 wire 를 읽는 전부" 다.**
