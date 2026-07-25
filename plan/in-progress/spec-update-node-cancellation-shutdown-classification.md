---
title: spec 갱신 제안 — SIGTERM/timeout 유발 abort 의 최종 상태 분류 (cancelled vs failed)
worktree: (unstarted)
started: 2026-07-25
owner: project-planner
priority: P2
spec_impact:
  - spec/conventions/node-cancellation.md
  - spec/5-system/4-execution-engine.md
  - spec/1-data-model.md
  - spec/data-flow/3-execution.md
---

## Overview

`developer` 는 `spec/` 쓰기 권한이 없어 **제안만** 남긴다.
`review/consistency/2026/07/25/19_13_33` **Critical (BLOCK: YES)** 에서 분리 —
[`node-cancellation-residual-signal-propagation`](node-cancellation-residual-signal-propagation.md)
의 **4번째 항목만** 해당하며, 나머지 항목(chat-channel·MakeShop·Cafe24 signal 전파, IE resume)
은 이 결정과 무관하게 진행 가능하다.

## 문제 — 같은 트리거가 두 개의 최종 상태를 쓰려 한다

잔여 plan 의 "Workflow 단위 timeout / graceful shutdown 의 **노드 abort 통합**" 을 문면대로
구현하면, 같은 row 를 두고 두 메커니즘이 경합한다:

| 경로 | 최종 상태 | 근거 |
| --- | --- | --- |
| `node-cancellation.md` §5.1 일반 규칙 | `AbortError` throw → **`cancelled`** | 본 문서 |
| `ShutdownStateService` (SIGTERM grace-timeout) | bulk `UPDATE … SET status='failed', error.code='SERVER_INTERRUPTED' WHERE status='RUNNING'` | 구현·회귀 테스트 완비 |
| `assertActiveTimeWithinLimit` (workflow timeout) | `EXECUTION_TIME_LIMIT_EXCEEDED` → **`failed`** | execution-engine §8 |

**실측**: `shutdown-state.service.ts` 는 `abortSignal`/`AbortController` 를 **한 번도 참조하지
않는다**(grep 0건). 즉 지금은 두 경로가 만나지 않아 충돌이 없다. 잔여 plan 대로 여기에
`abortSignal.abort()` 를 연결하는 순간, 가드가 `WHERE status='RUNNING'` 선착순이라 **어느 쪽이
이기든 타이밍에 좌우되는 비결정적 상태 분류**가 된다.

## 결정이 필요하다 (택일)

- [ ] **(a) 기존 `failed` 계약 유지** — SIGTERM/timeout 유발 `AbortError` 를 §5.1 일반 규칙의
      **명시적 예외**로 각주하고, `abortSignal` 은 in-flight 외부 I/O 를 빨리 풀어주는
      **부수효과로만** 격리한다(표준 분류 경로로 새지 않게). 문서 변경 최소.
- [ ] **(b) `cancelled` 로 재정의** — 이 경로도 `cancelled` 로 통일하고
      `execution-engine.md` §8·§11 · `1-data-model.md` · `data-flow/3-execution.md` ·
      `shutdown-state.service.spec.ts` 를 **동반 갱신**. 일관성은 높지만 변경 표면이 넓다.
- [ ] 어느 쪽이든 §5.2 errorPolicy 표에 **SIGTERM shutdown · workflow timeout 두 트리거를
      별도 행**으로 명문화 (현재 `stop` 분기가 workflow timeout 을 원인으로 열거하지 않아,
      노드 abort 통합 후 이 조합이 §5.2 만 봐서는 드러나지 않는다 — 같은 검토의 WARNING 2).

## 관련

- `plan/in-progress/execution-engine-residual-gaps.md` **G2** — 같은 `shutdown-state.service.ts`
  · 같은 SIGTERM 흐름을 다루는 BLOCKED plan(defer 확정 2026-07-03)인데 상호 참조가 없었다.
  착수 시 G2 상태를 먼저 확인할 것 (같은 검토의 WARNING 1).

## Rationale

**왜 developer 가 결정하지 않나.** 이건 "노드가 취소됐을 때 실행이 어떤 상태로 끝나는가" 라는
**제품 계약**이고, 이미 구현·테스트된 `failed` 계약을 뒤집을지의 판단이다. 배선 작업이 아니다.

**왜 나머지 항목은 막히지 않나.** commerce/chat-channel signal 전파는 `context.abortSignal`
이 **이미 존재할 때** 그것을 하위 I/O 로 흘려보내는 배선이고, 그 signal 의 생산자는 현재
`ParallelExecutor`(cancel-others-on-fail)와 사용자 cancel 버튼이다. 둘 다 §5.1 의 `cancelled`
분류가 이미 정답인 경로라 본 충돌과 무관하다.
