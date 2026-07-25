---
title: spec 초안 — node-cancellation §1·§6 에서 chat-channel 범주 오류 제거 + commerce 2행 상태 갱신
worktree: node-cancel-chat-9f3e
started: 2026-07-26
owner: project-planner
priority: P1
spec_impact:
  - spec/conventions/node-cancellation.md
  - spec/4-nodes/1-logic/10-parallel.md
---

## Overview

`plan/in-progress/spec-update-node-cancellation-shutdown-classification.md` 의 **추가 위임 #5**
(chat-channel 범주 오류) 와 **추가 위임 2026-07-25** (§6 commerce 2행 staleness) 를 실제 spec
편집으로 집행하는 초안이다. 두 위임 모두 **제품 결정이 필요 없는 사실 정정**이라 같은 초안으로 묶는다.

같은 위임 문서의 나머지 항목(#1 SIGTERM/timeout 최종 상태 분류 (a)/(b), #2 §4 예시 누수, #3
http-request/text-classifier 검증, #4 AbortError 명명 예외)은 **택일 결정이 필요**하므로 본 초안
범위 밖이다 — 그 문서에 그대로 남는다.

## 착수 사유 — impl-done 이 이 drift 를 Critical 로 판정해 push 가 막혀 있다

`review/consistency/2026/07/26/00_08_39` **BLOCK: YES**. 유일한 Critical 이 아래 변경 1 이고,
`review/code/2026/07/26/00_02_08` 도 같은 항목을 SPEC-DRIFT 로 냈다(코드 Critical/Warning 은 0).

## 변경 1 — chat-channel 은 노드가 아니다 (Critical)

**근거(실측, 2026-07-25 프로브)**:

- `codebase/backend/src/nodes/` 전 카테고리에 `chat` 이름의 노드 파일 **0건**,
  `node-types.constants.ts` 미등록.
- 실체는 `webhook` 트리거의 `config.chatChannel` 변형 — `spec/1-data-model.md` §2.8.
- 구현은 `modules/chat-channel/**` 어댑터. SoT `spec/5-system/15-chat-channel.md` **CCH-AD-05**:
  `ChatChannelDispatcher` 는 `executionEvents$` 를 **구독해 외부 채널로 발송**하는 outbound
  어댑터다. `context.abortSignal` 을 받는 node dispatch 대상이 아니고 `abortSignal` 참조 0건.
- 즉 §4 cascade 대상이 **될 수 없다**. 취소된 실행에 대해 이 어댑터가 할 일은 오히려
  `execution.cancelled` 를 **발송**하는 것이다.

### 1-a. `spec/conventions/node-cancellation.md` §1 (24행)

```diff
-장기 외부 I/O 를 수행하는 노드 (HTTP / DB / AI / Email / chat-channel / 이커머스 통합 Cafe24·MakeShop) 가
+장기 외부 I/O 를 수행하는 노드 (HTTP / DB / AI / Email / 이커머스 통합 Cafe24·MakeShop) 가
```

### 1-b. `spec/conventions/node-cancellation.md` §6 (137행)

행을 **삭제하지 않고 성격을 바꿔 남긴다** — 삭제하면 "왜 빠졌는지" 가 사라져 같은 오분류가
재도입될 여지가 있다(이 저장소는 실제로 JSDoc·spec 양쪽에 같은 오류를 복제한 이력이 있다).

```diff
-| chat-channel 노드 signal 전파 | — | 미구현 (Planned) |
+| ~~chat-channel 노드 signal 전파~~ | N/A | **범주 오류로 철회** — chat-channel 은 노드가 아니라 `webhook` 트리거의 `config.chatChannel` 변형이며, 구현체 `modules/chat-channel/**` 는 `executionEvents$` 를 구독하는 **outbound 어댑터**(CCH-AD-05)라 §4 cascade 대상이 아니다. 취소 시 이 어댑터의 책임은 `execution.cancelled` **발송**이다 |
```

### 1-c. `spec/4-nodes/1-logic/10-parallel.md` (244행)

같은 오분류 + 별개의 staleness("signal-aware 는 HTTP 노드만")가 함께 있다. 현행 §6 표와 일치시킨다.

```diff
-본 PR 기준 signal-aware 는 HTTP 노드만 — DB / AI / Email / chat-channel 은 후속 PR.
+signal-aware 노드는 HTTP · DB · AI · Cafe24 · MakeShop (Email 은 사전 abort 체크만 — in-flight SMTP 중단은 의도적 미채택). chat-channel 은 노드가 아니라 트리거 어댑터라 대상이 아니다.
```

## 변경 2 — §6 commerce 2행이 이미 병합된 구현과 어긋난다 (Warning)

`origin/main` 커밋 `e83da5052` (#1019) 가 MakeShop·Cafe24 의 §4 cascade + §5.1 재throw 를
구현·병합했는데 §6 표는 `— 미구현 (Planned)` 로 남아 있다.

**위임 문서의 승격 전 확인 조건을 실측으로 충족했다** — client 뿐 아니라 **handler 가 실제로
AbortError 를 propagate** 해야 한다는 조건:

```
cafe24.handler.spec.ts:750      it('rethrows AbortError so the ENGINE can classify the node as cancelled')
makeshop.handler.spec.ts:577    it('rethrows AbortError so the ENGINE can classify the node as cancelled')
cafe24-api.client.spec.ts:137   it('rethrows AbortError and does NOT count a network failure ...')
makeshop-api.client.spec.ts:136 (동일)
```

위임 문서 지시대로 문면에서 **"§2.2 사전 체크" 표현은 뺀다** (§2.2 는 CPU 바운드/즉시 완료 노드
절이라 HTTP client 와 무관하고, 실제 구현한 것은 §4 의 already-aborted 분기다).

```diff
-| MakeShop 노드 signal 전파 | — | 미구현 (Planned) — ... cascade(§4)·진입 직전 사전 체크(§2.2) 모두 없음 |
-| Cafe24 노드 signal 전파 | — | 미구현 (Planned) — MakeShop 과 동일 상태 |
+| MakeShop 노드 signal 전파 | ✓ | `makeshop-api.client.ts` 의 §4 cascade(already-aborted 분기 포함) **와** `makeshop.handler.ts` 의 §5.1 AbortError 재throw — 둘 다 있어야 엔진이 `cancelled` 로 분류한다 |
+| Cafe24 노드 signal 전파 | ✓ | MakeShop 과 동일 구조 (`cafe24-api.client.ts` · `cafe24.handler.ts`) |
```

## 범위 밖 (의도적)

- `spec/4-nodes/3-ai/1-ai-agent.md:1374` stale plan 포인터 — INFO, 위임 #4(3) 에 이미 추적 중.
- 위임 #1~#4 의 택일 결정 항목 — 제품 결정이 필요해 본 초안에 포함하지 않는다.
- `frontmatter.code:` 에 commerce client/handler 등재 여부 — 현재 `http-request`·`database-query`
  handler 만 등재된 기존 방침을 이번 초안에서 바꾸지 않는다.

## 집행 결과 (2026-07-26)

`consistency-check --spec` (`review/consistency/2026/07/26/02_52_18`) **BLOCK: NO** — Critical 0,
WARNING 2, INFO 5. 두 WARNING 을 모두 반영한 뒤 집행했다.

| 검토 지적 | 처리 |
| --- | --- |
| **WARNING 1** — §6 표에 범례 없는 `N/A` 값 도입 (convention_compliance) | 범례 줄(123행)에 `N/A = 범주 오류로 대상에서 철회(애초에 노드가 아님)` 신설. 갱신 일자도 `2026-06-03` → `2026-07-26` |
| **WARNING 2** — 집행 후 위임 원본 plan 포인터가 "대기 중"으로 남음 (plan_coherence) | `node-cancellation-residual-signal-propagation.md` 2곳(L45, 잔여 목록)과 `spec-update-node-cancellation-shutdown-classification.md` 2개 위임 절 헤딩에 "이행 완료" 표기 |
| INFO 3 — `10-parallel.md` 구분자를 `·` 로 전면 승격하면 §1 표기와 불일치 | 슬래시 유지로 변경 (`HTTP / DB / AI / 이커머스 통합 Cafe24·MakeShop`) |
| INFO 1·5 — §6 신규 셀에 SoT 링크·R1 근거 명시 권장 | `1-data-model.md §2.8` · `15-chat-channel.md`(CCH-AD-05, Rationale R1) 링크 추가 |
| INFO 2·4 — `code:` 보류 근거 한 줄, 변경 2 라인 번호 | 미반영 (선택 사항, 결론 불변) |

실제 편집: `spec/conventions/node-cancellation.md` (§1 24행 · §6 범례 123행 · §6 137~139행),
`spec/4-nodes/1-logic/10-parallel.md` (244행).

## Rationale

**왜 삭제가 아니라 철회 표기인가.** 표에서 행을 지우면 "chat-channel 도 cascade 해야 하는 것
아닌가" 라는 질문이 재발했을 때 근거가 남지 않는다. 이 저장소는 같은 오분류를 spec 과
`node-handler.interface.ts` JSDoc 양쪽에 복제한 이력이 있어, **반증된 전제를 명시적으로 묘비로
남기는** 편이 재발 비용이 낮다.

**왜 두 변경을 한 초안으로 묶나.** 같은 표(§6)의 같은 결함 클래스(문서가 코드 현실과 어긋남)이고,
둘 다 제품 결정이 아니라 실측으로 결론이 확정된 사실 정정이다. 분리하면 planner 턴이 두 번 필요하다.

**기각한 대안 — impl-done Critical 을 우회한다.** `BYPASS_REVIEW_GUARD=1` 또는 summary 재량
하향으로 push 하는 길이 있었다. 기각한 이유는 `plan/in-progress/harness-consistency-summary-downgrade-rule.md`
가 지적한 그대로다 — 그 하향은 현행 규약에 조항이 없고(`.claude/agents/consistency-summary.md`
"Critical 1건이라도 있으면 BLOCK: YES"), 한 번 관행이 되면 진짜 Critical 도 하향될 여지가 생긴다.
근본 원인이 3줄짜리 사실 정정이라 우회보다 정정이 싸다.
