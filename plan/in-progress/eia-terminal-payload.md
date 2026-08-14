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
| `execution-engine.service.ts:3301` (stalled 재배달 소진) | 문자열 리터럴 | **없음** — 새로 만들어야 |
| `execution-engine.service.ts:4862` (`finalizeFailedExecution`) | 문자열 | `savedExecution.error = { message, code? }` (`:4829`) |
| `retry-turn.service.ts:963` | 문자열 | `execution.error = { message }` (`:937`) |

**핵심**: 4곳 중 3곳은 **객체를 이미 만들어 DB 에 저장하고 있고 emit 만 그걸 버린다.**
새로 계산할 것이 없어 작업이 작고 안전하다.

> **교훈(재발)**: "실측했다" 가 또 프록시였다. 구문 형태(`{` 로 시작)로 타입 질문에
> 답했다. 값의 **타입**을 물어야 했다.

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

- [ ] `error` 객체 형태 — **4곳** (`:659` · `:3301` · `:4862` · `retry-turn:963`).
      `:1084` 은 이미 객체라 손대지 않는다
- [ ] `durationMs` — 종결 3종
- [ ] `result.outputs` — `completed`
- [ ] **동반 필수** (`07_44_12` plan_coherence W5, developer 권한 내):
  - `chat-channel.dispatcher.ts:535~568` — string/object back-compat wrap 이 **존재한 적 없는
    plan 이름**을 주석으로 가리킨다. `error` 가 전 경로 객체가 되면 이 wrap 의 존재 이유가
    바뀌므로 함께 정리
  - `chat-channel/types.ts:386~390` — `EiaCompletedEvent.result` 가 §6 이 "설계된 적 없다" 고
    명시한 `finalNodeId`/`finalPort` 를 **여전히 선언**한다(유령 타입 필드)

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
- [ ] **planner 턴** — §6.2 봉투 + data-model §2.14 + §6.2 URL + `error.code` 옵셔널
- [ ] `--impl-prep` 재실행 BLOCK: NO
- [ ] 구현 + 테스트
- [ ] `/ai-review` + `/consistency-check --impl-done`
- [ ] 위 3개 plan 체크박스 동시 갱신
