STATUS=success plan_coherence review complete — 1 WARNING, 1 INFO
===REPORT_MARKDOWN_BELOW===
# Plan 정합성 검토 — `spec-draft-eia-notification-payload-contract.md`

## 발견사항

### [WARNING] `execution.cancelled` "이미 정합" 전제가 `retry-turn.service.ts` 경로에서 거짓이다 — 실측이 `execution-engine.service.ts` 로 좁게 잡혔다

- **target 위치**:
  - "실측" 표 (`## 왜` 절, `execution.cancelled` emit 행 — "`{ status, result: { cancelledBy }, error? }` — 유일하게 부분 정합")
  - `### 3. §6.5 execution.cancelled — nested 로 통일` ("execution.cancelled 는 **이미** `result.cancelledBy` (nested) 로 emit 된다")
  - `## 후속 (developer)` 목록 (durationMs·result.outputs 채우기 항목의 대상 파일 나열)

- **관련 plan**: `plan/in-progress/retry-turn-terminal-guard.md`
  - L272-278 `- [ ] **W1(api_contract) — `EXECUTION_CANCELLED` payload 에 `cancelledBy` 누락.**` (미체크, open)
    > "`failRetryExecution` 의 payload 는 `{ status }` 뿐이다. **pre-existing 확인**... 자매 경로는
    > `emitCancellationEvent` 공유 헬퍼로 이미 통합돼 있다(`cancelledBy` 계약 W3). 소비자
    > (`chat-channel.dispatcher.ts`)는 `result` 부재를 `{}` 로 방어해 크래시는 없으나 값이 유실된다."
  - L329 (종합 표 #2, 동일 항목 P2 · "5R W1 (+ impl-done cross_spec 독립 확인)")

- **상세**: target 의 "실측" 은 `execution-engine.service.ts` 만 감사했다(표에 그렇게 명시:
  "`execution-engine.service.ts` 4곳"). 그러나 같은 세 이벤트 타입(`EXECUTION_COMPLETED`/
  `EXECUTION_FAILED`/`EXECUTION_CANCELLED`)을 emit 하는 **또 다른 서비스**
  `retry-turn.service.ts` 가 존재하고, 직접 코드 확인 결과:
  - `retry-turn.service.ts:956-965` (`failRetryExecution`) — `EXECUTION_CANCELLED` 를
    `{ status: finalStatus }` 로만 emit 한다. `result`/`cancelledBy` **자체가 없다** (nested 는
    커녕 flat 도 아니다). 이는 `retry-turn-terminal-guard.md` 가 이미 알고 있고 **여전히
    미해결(open checkbox)** 로 등재한 결함(W1 api_contract)과 정확히 같은 지점이다.
  - `retry-turn.service.ts:723-727`, `:883-901` (`completeRetryExecution` / 자연 종결) —
    `savedExecution.outputData`/`durationMs` 를 DB 저장 직전엔 채우면서도 emit payload 는
    `{ status: ExecutionStatus.COMPLETED }` 뿐이다. target 의 "후속 — durationMs·result.outputs
    채우기" 항목이 나열한 대상 라인(`execution-engine.service.ts` L2356·2520·3452·4616·2360)에
    이 두 지점이 빠져 있다.
  - `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.ts:531`·`:581` 은
    `result: (...).result ?? {}` 로 **이미 방어 코드가 있다** — target 이 §6.4 의 dispatcher
    back-compat wrap(L535-560)은 인용했으면서, 같은 파일 몇 줄 아래(`execution.cancelled` case,
    L570-585)의 같은 성격의 방어는 못 보고 지나갔다. 방어 코드의 존재 자체가 이 gap 이 실전에서
    발생함을 방증한다.

  target 은 "이미 result.cancelledBy 로 emit 된다" 를 **WS §4.1 을 nested 로 고치는 근거**로
  삼는다. 그런데 그 전제가 `retry-turn.service.ts`(AI multi-turn retry 취소 경로) 에서는
  성립하지 않고, 그 gap 은 자매 plan 이 **아직 열어 둔 채**(P2, 미체크) 추적 중이다. 이 draft 가
  전제를 검증 없이 "이미 정합" 으로 서술하고 merge 되면, 방금 새로 쓴 §6.5 문장이 최소 한
  코드 경로(retry-turn AI 대화 취소)에 대해 **즉시 다시 거짓**이 된다 — 이 문서 전체가 고치려는
  결함 클래스("문서가 거짓이면 연동하는 쪽이 존재하지 않는 필드를 기다린다")를 그대로 재생산한다.

- **제안**: 아래 중 하나(또는 둘 다) 반영.
  1. target 의 "실측" 표·§6.5 절에 "단, `retry-turn.service.ts` 의 `failRetryExecution` 경로는
     `cancelledBy` 자체를 emit 하지 않는다(선재 결함, `retry-turn-terminal-guard.md` W1 로 추적
     중)" 캐비엇을 추가해 "이미 정합" 을 "부분 정합(대부분 경로)" 으로 정밀화.
  2. `## 후속 (developer)` 목록에 `retry-turn.service.ts` 의 세 지점(723-727 · 883-901 · 956-965)을
     명시적으로 추가하거나, 최소한 `retry-turn-terminal-guard.md:272` 의 W1 항목을 교차 참조해
     "이 draft 의 §6.3/§6.5 후속과 같은 작업" 임을 밝힌다 — 두 plan 이 같은 결함을 각자 반쪽씩
     추적하다 어느 쪽도 완결하지 못하는 상황을 방지.

### [INFO] `plan/in-progress/spec-draft-eia-r8-alignment.md` 가 전 항목 완료 상태로 남아 있다

- **target 위치**: target frontmatter `worktree: eia-r8-cache-scope-4ae434` — 이 worktree 이름이
  가리키는 이전 작업(`spec-draft-eia-r8-alignment.md`, worktree `eia-spec-r8-alignment-fff754`)이
  같은 물리 worktree 를 재사용한 것으로 보인다.
- **관련 plan**: `plan/in-progress/spec-draft-eia-r8-alignment.md` — 체크리스트 전 항목 `[x]`,
  2026-08-12 완료 기록까지 있음에도 `plan/complete/` 로 이동하지 않았다.
- **상세**: target 의 본 작업과 직접 충돌·의존은 없다(별개 spec 절 — idempotency 캐시 대상 vs
  outbound notification payload). 다만 완료된 plan 이 `in-progress/` 에 남아 있으면 다음 번
  plan-coherence 스캔이 "아직 진행 중" 으로 오인해 불필요하게 재확인 비용을 지운다.
- **제안**: 이 draft 와 무관하게, 별도 턴에서 `plan/complete/` 로 이동 처리 권장(target 범위 밖 —
  차단 사유 아님).

## 요약

target 의 §6.3~6.5 재작성 방향(얇은 envelope + 지킬 수 있는 필드만 채움 + finalNodeId/finalPort
철회)은 다른 `plan/in-progress/**` 의 미해결 결정과 직접 충돌하지 않는다 — `spec-sync-external-
interaction-api-gaps.md`·`spec-sync-websocket-protocol-gaps.md`·`spec-draft-eia-r8-alignment.md`
등 인접 plan 은 다른 축(분산 fan-out, WS 미구현 이벤트, idempotency 캐시 대상)을 다루며 겹치지
않는다. 유일한 실질 결함은 target 의 "실측" 이 `execution-engine.service.ts` 로 범위를 좁게
잡아, 같은 세 이벤트를 emit 하는 자매 서비스 `retry-turn.service.ts` 의 `EXECUTION_CANCELLED`
경로(cancelledBy 완전 부재 — `retry-turn-terminal-guard.md` 가 이미 미해결로 추적 중인 W1)를
놓친 것이다. 이 전제 위에서 "execution.cancelled 는 이미 정합" 이라고 WS §4.1 을 고치면, 새로
쓴 spec 문장이 그 경로에서 즉시 다시 거짓이 되어 이 문서가 고치려는 문제를 재생산한다 — target
갱신(캐비엇 추가 또는 후속 목록 확장)이 필요하다.

## 위험도

MEDIUM
