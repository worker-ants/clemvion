---
title: node-cancellation 잔여 — 채널/커머스 노드 signal 전파 + workflow-timeout 노드 abort
worktree: (unstarted)
started: 2026-07-24
owner: developer
status: in-progress
priority: P3
---

## Overview

`spec/conventions/node-cancellation.md` §6 구현 현황 표가 **미구현(Planned)** 으로 남겨 둔
항목들의 추적 plan. 종전에는 `node-cancellation-infrastructure.md` 가 추적한다고 적혀
있었으나 **그 plan 은 2026-06-28 에 완료·이동**했고, 그 뒤 `node-cancellation-inflight-followups.md`
도 2026-07-24 에 완료되면서 **잔여 4항목을 추적하는 활성 plan 이 전무**해졌다.

> 출처: `review/code/2026/07/24/20_36_21` WARNING 2 — scope·side_effect·documentation
> **3명이 중복 지적**. `status: implemented` 승격과 §6 본문의 "미구현 4건" 이 어긋난다는 지적.
> 사용자 결정 **(A) 잔여 추적 plan 신설 + `status: partial` 유지**.

## 왜 spec 이 `partial` 로 되돌아가는가

`spec-status-lifecycle` 가드는 두 규칙을 함께 건다:

- (b) `partial` 은 **비어 있지 않은** `pending_plans` 를 가져야 한다
- (c) `partial` 의 `pending_plans` 가 **전부** `plan/complete/` 로 가면 `implemented` 로 승격해야 한다

2026-07-24 에 마지막 pending plan 이 완료되며 (c) 가 발동해 `implemented` 로 승격됐는데,
정작 §6 본문에는 미구현 4건이 남아 있었다 — 라벨과 본문의 불일치. 본 plan 이 신설되어
`pending_plans` 가 다시 채워지므로 (b) 를 만족하며 `partial` 로 되돌린다. **되돌림이 아니라
누락됐던 추적을 복원하는 것**이다.

## 잔여 항목 (§6 표 기준)

- [ ] **chat-channel 노드 signal 전파** — `context.abortSignal` cascade(§4) 미배선
- [ ] **MakeShop 노드 signal 전파** — `makeshop-api.client.ts` 는 자체 timeout 용
      `AbortController` 만 사용. `context.abortSignal` cascade(§4)·진입 직전 사전 체크(§2.2)
      **둘 다 없음**
- [ ] **Cafe24 노드 signal 전파** — `cafe24-api.client.ts`, MakeShop 과 동일 상태
- [ ] **Workflow 단위 timeout / graceful shutdown 의 노드 abort 통합** — 워크플로 시간 한도
      자체는 PR2a 로 구현 완료(active-running 누적 타임아웃 `assertActiveTimeWithinLimit`,
      **노드 경계 판정**). 잔여는 **진행 중 노드의 in-flight 외부 I/O 즉시 중단**뿐
- [ ] **IE multi-turn resume 경로 signal 미전파** (§2.1 표) — `information-extractor` 의
      `processMultiTurnMessage`(resume/continuation)는 abort 컨텍스트가 없어 signal 이 닿지
      않는다. 초기 실행 경로(`executeMultiTurn`)만 전파됨. turn 경계 abort 체크 도입이 방향.
      **완화 있음**: AI Agent 의 app-level 타임아웃(`AI_AGENT_LLM_CALL_TIMEOUT_MS`, 자체
      `AbortController`)이 signal 갭과 무관하게 무기한 hang 을 상한한다 → 데이터 정합성 위험이
      아니라 응답성 갭.
      > 리뷰어가 지목한 4항목(§6 표) 밖이지만 **동일 결함 클래스**라 함께 담는다 — §2.1 의
      > 추적 포인터도 완료된 `node-cancellation-infrastructure.md` 를 가리키고 있었다.

- [ ] **선형 경로 cancel 전파의 기전 규명 + 결정적 고정** (2026-07-24 ai-review 2R,
      독립 reviewer 3명 수렴) — e2e `node-cancellation-propagation.e2e-spec.ts` 가 "stop 후
      하류 노드 미도달" 을 **3회 재현 + 대조군**으로 관측했으나, **어느 코드가 그것을 보장하는지
      특정되지 않았다**. 두 후보가 모두 반증됐다: `context.abortSignal?.throwIfAborted()` 는
      `abortSignal` 대입이 `parallel-executor.ts`(parallel 전용) 한 곳뿐이라 선형 경로에서
      항상 undefined 고, "guarded UPDATE(`:313`)" 는 §7.5 resume-claim 전용 sentinel 이다.
      → **엔진 단위 테스트(mock, ms 단위)** 로 "선형 두 노드 사이 Execution 이 외부에서
      cancelled 로 바뀌면 다음 노드가 dispatch 되지 않는다" 를 직접 고정할 것. 그때까지 e2e 의
      단언은 **관측된 계약**으로만 유효하며(타이밍 우연 배제 못 함), 그 한계는 파일 JSDoc 과
      `review/code/2026/07/24/20_36_21/RESOLUTION.md` §C1 에 명시돼 있다.

### 해당 없음 (추적 대상 아님)

- **MongoDB driver `signal` 전달** — 현 DB 노드는 pg/mysql 만 지원하고 **mongo 미도입**이다.
  몽고 도입 시점에 함께 설계할 항목이라 본 plan 의 잔여로 세지 않는다(§6 표의 해당 행도
  "mongo 미도입" 을 사유로 명시).

## 선행 판단 (착수 전)

- **§2.2(사전 체크)와 §4(cascade)는 난이도가 다르다.** 사전 체크는 각 핸들러 진입부 1줄로
  끝나지만, cascade 는 클라이언트가 요청마다 signal 을 받아 전달하도록 배선해야 한다.
  **사전 체크만 먼저 하는 부분 이행**도 §5 계약을 충족한다(spec 이 best-effort 를 명시).
  전량-or-무 로 접근하면 3개 노드가 계속 미착수로 남는다 — 실제로 그렇게 남아 있었다.
- **best-effort 경계 재확인**: driver/transport 가 in-flight 중단을 지원하지 않으면 사전
  체크까지만 하고 spec 에 best-effort 로 남기는 것이 이 저장소의 확립된 처분이다
  (send-email `transporter.close()` 미채택 선례 — `node-cancellation-inflight-followups.md` §2).

## 관련

- `spec/conventions/node-cancellation.md` §2.2 · §4 · §6 (SoT)
- `codebase/backend/src/nodes/integration/makeshop/`·`cafe24/` (API 클라이언트)
- chat-channel 노드 핸들러
- 선행 완료: [`node-cancellation-infrastructure.md`](../complete/node-cancellation-infrastructure.md)(인프라) ·
  [`node-cancellation-inflight-followups.md`](../complete/node-cancellation-inflight-followups.md)(DB in-flight·e2e)

## Rationale

**왜 별 plan 인가.** §6 이 "추적 plan" 을 이름으로 가리키는데 그 대상이 완료 이동해 버리면
포인터가 죽는다 — 이번에 실제로 그렇게 됐고, 리뷰어 3명이 그 결과(라벨/본문 불일치)를
지적했다. 활성 plan 을 하나 두면 (b)/(c) 가드가 그 불일치를 **구조적으로** 막는다.

**왜 P3 인가.** 세 노드 모두 **사전 abort 체크조차 없어** cancel 시 진입을 막지 못하지만,
cancellation 자체는 Execution 레벨에서 `cancelled` 로 확정되고(§5) 하류 dispatch 도 멈춘다
— 즉 데이터 정합성 문제가 아니라 **불필요한 외부 호출 1회**가 발생하는 낭비다. 실제 피해가
관측되면 승급할 것.
