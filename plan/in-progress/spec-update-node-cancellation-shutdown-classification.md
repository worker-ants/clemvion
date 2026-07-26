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
의 **4번째 항목만** 해당하며, 나머지 항목(MakeShop·Cafe24 signal 전파, IE resume — chat-channel 은 won't-do, 추가 위임 #5 참조)
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

---

## ~~추가 위임 (2026-07-25) — §6 표 두 행 갱신 (SPEC-DRIFT)~~ → **이행 완료 (2026-07-26)**

> **처리됨**: MakeShop·Cafe24 행을 `✓` 로 갱신했다. 아래 ⚠ 승격 전 확인 조건("handler 가 실제로
> propagate 하는지")은 `cafe24.handler.spec.ts:750` · `makeshop.handler.spec.ts:577` 의
> `rethrows AbortError so the ENGINE can classify the node as cancelled` 테스트로 실증했고,
> 지시대로 문면에서 "§2.2 사전 체크" 표현은 뺐다. `frontmatter.code:` 확장은 기존 부분 등재
> 관행(`spec-impl-evidence.md` 는 최소 1개 매치만 요구)을 유지해 보류.
> 초안: [`spec-draft-node-cancellation-chat-channel-correction.md`](spec-draft-node-cancellation-chat-channel-correction.md).

`review/code/2026/07/25/21_02_33` WARNING 2 (requirement·documentation 중복 지적).

MakeShop·Cafe24 signal 전파가 **구현 완료**됐는데 §6 구현 현황 표는 여전히 `— 미구현 (Planned)`
다. 이 저장소는 같은 클래스(라벨 vs 본문 불일치)를 이미 3명에게 지적받은 이력이 있다.

```
| MakeShop 노드 signal 전파 | — | 미구현 (Planned) — … cascade(§4)·사전 체크(§2.2) 모두 없음 |
| Cafe24 노드 signal 전파   | — | 미구현 (Planned) — MakeShop 과 동일 상태 |
```

**제안**: 두 행을 `✓` 로, 근거는 두 client 의 §4 cascade **와 두 handler 의 §5.1 재throw
가드**(둘 다 있어야 성립한다 — client 만으로는 엔진이 `cancelled` 로 분류하지 못한다).

> ⚠ **승격 전 확인**: `--impl-done`(2026-07-25 21_58_52) 이 잡았듯, 처음에는 client 만 고쳐서
> handler 가 AbortError 를 삼키고 있었다. §6 을 `✓` 로 올릴 때는 **handler 가 실제로
> propagate 하는지**(`*.handler.spec.ts` 의 "rethrows AbortError so the ENGINE can classify"
> 테스트)까지 확인할 것 — 그러지 않으면 미충족 계약을 "구현됨" 으로 기록하는 새 SPEC-DRIFT 가 된다. 문면의 "§2.2 사전 체크" 표현은 **빼는 것이 맞다** — §2.2 는 CPU 바운드/
즉시 완료 노드 절이라 HTTP client 와 무관하고(같은 리뷰 WARNING 3), 실제로 구현한 것은 §4 의
already-aborted 분기다.

`frontmatter.code:` 에 두 client 를 추가할지도 함께 판단 대상(현재는 `http-request`·
`database-query` handler 만 등재).

> developer 는 `spec/` 쓰기 권한이 없어 제안만 남긴다. 본 PR 은 코드·테스트·plan 만 담는다.

---

## 추가 위임 (2026-07-25 #2) — §4 예시 코드가 **누수 버그**를 정답으로 제시한다

`review/code/2026/07/25/21_35_11` WARNING 1 (SPEC-DRIFT, requirement·documentation 중복 지적).

§4 의 cascade 예시는 cleanup 을 `controller.signal` 의 `abort` 이벤트에 건다:

```ts
controller.signal.addEventListener(
  'abort',
  () => upstream.removeEventListener('abort', onAbort),
  { once: true },
);
```

그리고 *"상하 모두 abort 시 fetch 가 즉시 throw — cleanup 의무는 fetch API 가 보장"* 이라고
서술한다. **둘 다 사실이 아니다**:

- **성공한 요청은 controller 를 abort 하지 않는다.** 그러니 저 `abort` 이벤트가 영영 발화하지
  않고, 리스너는 execution-wide `abortSignal` 에 **영구 잔존**한다.
- 실측: 성공 응답 후 `upstream.abort()` 를 하면 이미 끝난 요청의 controller 가 abort 된다
  (= 리스너 생존). mutation 으로도 확인했다.
- 재시도 경로(`executeWithRetry`/`executeWithRateLimit` 는 429/401 에 **재귀**)에서는 완료된
  attempt 마다 하나씩 쌓인다 → `MaxListenersExceededWarning`.

**제안**: §4 예시를 `finally` 기반 정리로 교체한다 —

```ts
let onAbort: (() => void) | undefined;
if (upstream) {
  if (upstream.aborted) controller.abort();
  else { onAbort = () => controller.abort(); upstream.addEventListener('abort', onAbort, { once: true }); }
}
try { /* fetch */ } finally {
  clearTimeout(timer);
  if (upstream && onAbort) upstream.removeEventListener('abort', onAbort);
}
```

그리고 "cleanup 의무는 fetch API 가 보장" 문장을 삭제 또는 정정.

**동반 대상**: `http-request.handler.ts` 는 지금도 spec 원문 그대로라 **같은 누수가 살아있다**
(선재). spec 갱신과 함께 그 파일도 고칠지 판단 필요 — 본 PR 은 commerce 2건 범위라 손대지 않았다.

> 이 항목은 "구현이 spec 을 앞선" 경우다. 코드가 옳고 spec 이 낡았으므로 **코드를 되돌리지
> 않는다**(SPEC-DRIFT 정식 경로).


---

## 추가 위임 (2026-07-25 #3) — `http-request` / `text-classifier` 도 같은 검증이 필요하다

`--impl-done` 권고 6. §6 표에서 이미 `✓` 인 노드들이 **§5.1(handler 가 AbortError 를 엔진까지
propagate)을 실제로 만족하는지 검증된 적이 없다**. commerce 2건에서 정확히 그 갭이 나왔으므로
(client 는 옳고 handler 가 삼킴), 기존 `✓` 행들도 같은 축으로 확인할 값이 있다.

- `http-request.handler.ts` — §4 cascade 는 있으나 리스너 누수(§4 예시 그대로) + handler
  propagate 미검증.
- `text-classifier.handler.ts` — 동일 확인 필요.

developer 범위로 처리 가능한 부분(코드+테스트)과 spec 표 갱신을 planner 가 함께 판단할 것.

---

## 추가 위임 (2026-07-25 #4) — `--impl-done` 22_28_51 이 찾은 spec 자체 불일치 2건

두 건 모두 **이번 PR 이 만든 것이 아니라 선재**이며, `spec/` 쓰기 권한 밖이라 위임한다.

### (1) `error.code: 'AbortError'` 가 명명 규약 예외인데 등재돼 있지 않다

`node-output.md §3.2` 는 error code 를 `UPPER_SNAKE_CASE` 로 정하고, `error-codes.md §1/§3` 은
예외를 **명시 등재**하도록 요구한다. `AbortError` 는 둘 다 어긋난다(`node-cancellation.md §5.1`,
`5-system/6-websocket-protocol.md §4.1` 에서 사용).

- **(a) 저비용**: `error-codes.md §3` 예외 레지스트리에 historical-artifact 로 등재 + 근거.
- **(b)**: `NODE_CANCELLED` 류로 교체 — 코드·테스트·두 spec 동반 갱신 필요.

이미 구현·테스트가 붙어 있어 (a) 가 현실적이라는 것이 checker 의견이다.

### (2) §5.1 의 `meta.success = false` 서술이 구현·WS 페이로드와 어긋난다

`execution-engine.service.ts` 의 AbortError catch 는 **`meta` 를 설정하지 않는다**(실측:
`meta:` 설정은 parallel clampedConcurrency 경로 한 곳뿐). `6-websocket-protocol.md §4.1` 페이로드
정의에도 그 필드가 없다.

→ 문구를 삭제하거나, 엔진에 실제로 넣고 WS 표를 함께 갱신하거나 — **셋 중 하나로 통일**해야 한다.

### (3) (낮은 우선순위) stale plan 포인터

`4-nodes/3-ai/1-ai-agent.md:1374` 가 이미 `plan/complete/` 로 간
`node-cancellation-infrastructure` 를 가리킨다 → 실제 추적처는
`node-cancellation-residual-signal-propagation`.


---

## ~~추가 위임 (2026-07-25 #5) — §6 표의 `chat-channel 노드` 행은 **범주 오류**다~~ → **이행 완료 (2026-07-26)**

> **처리됨**: 아래 제안의 두 옵션("행 삭제" vs "성격을 바꿔 기재") 중 **후자**를 택했다 — 행을
> 지우면 재발 시 근거가 남지 않기 때문이다. §6 행을 `N/A`(범주 오류로 철회)로 재기재하고 §6
> 범례에 `N/A` 항목을 신설했으며, §1 나열에서 `chat-channel` 을 제거했다. 같은 오분류가 있던
> `spec/4-nodes/1-logic/10-parallel.md:244` 도 함께 정정했다.
> 초안: [`spec-draft-node-cancellation-chat-channel-correction.md`](spec-draft-node-cancellation-chat-channel-correction.md).

착수 전 프로브에서 전제가 반증됐다. **chat-channel 노드는 존재하지 않는다**:

- `codebase/backend/src/nodes/` 전 카테고리(ai·core·data·flow·integration·logic·presentation·
  trigger) 전수 확인 — `chat` 이름의 노드 파일 **0건**.
- `node-types.constants.ts` 에도 미등록.
- 실체는 **`webhook` 트리거의 `config.chatChannel` 변형**(`1-data-model.md:230`), 구현은
  `modules/chat-channel/**` 어댑터(SoT: `5-system/15-chat-channel.md`).

그리고 그 어댑터는 §4 cascade 대상이 **될 수 없다** — `executionEvents$` 를 **구독해 외부
채널로 발송**하는 outbound 방향이고(CCH-AD-05), `abortSignal` 참조가 0건이며, 취소된 실행은
오히려 `execution.cancelled` 를 **발송해야** 한다.

**제안**: §6 표에서 `| chat-channel 노드 signal 전파 | — | 미구현 (Planned) |` 행을 **삭제**
하거나, 남긴다면 "노드 아님 — 트리거 어댑터, cascade 대상 아님" 으로 성격을 바꿔 기재.
§1 의 대상 나열(`... / chat-channel / ...`)도 같은 이유로 정정 대상이다.

`node-handler.interface.ts` 의 JSDoc(같은 오류를 복제하고 있었다)은 코드라 이번 PR 에서
정정했다 — spec 과 어긋난 채로 두지 않기 위해 근거를 주석에 함께 남겼다.

---

## 추가 위임 (2026-07-26 #6) — §2.3/§5.1/§6: 노드 경계 Execution-cancel 재확인 가드가 spec 에 없다

`review/code/2026/07/26/11_48_55` WARNING 6 (documentation·requirement).
[`node-cancellation-residual-signal-propagation.md`](node-cancellation-residual-signal-propagation.md)
의 "선형 경로 cancel 전파의 기전 규명 + 결정적 고정" 항목(2026-07-26 완료)에 대한 위임 —
자매 항목(MakeShop·Cafe24·chat-channel, 위 #2·#5)과 동일하게 developer 는 `spec/` 쓰기 권한이
없어 제안만 남긴다.

### 무엇이 새로 생겼나

`ExecutionEngineService.assertExecutionNotCancelled()` — 노드 경계(순회 루프 3곳: `runExecution`
· `runNodeDispatchLoop` · `executeInline`, 이어서 컨테이너/Parallel 로도 확장:
`executeContainerBody`·`executeParallelBranchBody`)마다 Execution 행을 다시 읽어 외부
cancel(`POST /executions/:id/stop`)을 관측하고 `ExecutionCancelledError` 로 dispatch 를
중단하는 **Execution-레벨 가드**다.

**본 문서 §2.3 (`abortSignal` 생산자 목록) · §5.1 (`AbortError` 분류) 이 다루는 사전 체크와는
다른 메커니즘**이다:

| | 기존 §2.3/§5.1 서술 | 신규(2026-07-26) |
| --- | --- | --- |
| 신호 | `context.abortSignal` (표준 `AbortSignal` API) | Execution 행의 `status` 컬럼 재조회 |
| 관측 방식 | 노드 핸들러가 `signal.aborted`/`throwIfAborted()` 를 읽거나 SDK/fetch 에 전파 | 엔진 dispatch 루프가 노드 경계마다 DB 를 재조회 |
| 왜 별도로 필요한가 | `abortSignal` 은 `ParallelExecutor`(cancel-others-on-fail)가 branch context 에만 주입 — **선형 경로에선 항상 `undefined`** | 사용자 Stop 버튼은 `AbortController`/job cancel 없이 DB row 만 UPDATE 하므로, 선형 경로가 취소를 관측할 유일한 방법이 재조회다 |
| throw 하는 에러 | `error.name === 'AbortError'` (핸들러가 던짐) | `ExecutionCancelledError` (엔진이 던짐, `workflow-errors.ts`) |

### 현재 spec 서술이 오해를 유발한다

- §6 표 `:140` 행 `"...dispatch 사전 abort 체크..."✓` 는 **노드-레벨 `abortSignal` 사전 체크**
  (§5.1 문장)만 가리키는데, 이번 리뷰에서 이 행이 "그러니 Stop 버튼도 이미 커버된다" 로
  오독될 수 있음이 드러났다(실제로 `node-cancellation-residual-signal-propagation.md` 초안
  단계에서 그렇게 오독된 이력 — 원 티켓 문제 제기 참조). 신규 메커니즘을 **별도 행**으로
  분리해야 이 오독이 재발하지 않는다.
- `:60` 행 `"사용자 cancel 버튼 (구현됨 2026-05-31)"` 은 "실행을 중단" 이라고만 적어, 그
  "중단" 이 (a) DB row 를 terminal 로 UPDATE 하는 것과 (b) 진행 중인 dispatch 루프를 실제로
  멈추는 것 **둘 다**를 가리키는지 모호했다 — 실제로는 이번 PR 전까지 (a) 만 참이었다. 신규
  가드를 언급해 (b) 도 이제 참임을 명시해야 한다.

### 제안 변경

1. **§2.3 에 새 bullet 추가** (기존 4개 생산자 항목 뒤):
   > **노드 경계 Execution-cancel 재확인** (구현됨 2026-07-26) — `ExecutionEngineService`
   > 의 dispatch 루프(선형 3곳 + 컨테이너/Parallel 반복)가 노드 경계마다 Execution 행을
   > 다시 읽어 외부 cancel 을 관측하고 `ExecutionCancelledError` 를 throw 한다.
   > `context.abortSignal` 과 달리 **DB 재조회가 유일한 관측 수단**이다(사용자 cancel 버튼이
   > signal 을 생성하지 않으므로) — `assertExecutionNotCancelled()`.
2. **§5.1 에 단락 추가**: `ExecutionCancelledError`(엔진 자체 발생)도 `error.name ===
   'AbortError'`(핸들러 발생)와 동일하게 `NodeExecution.status = cancelled`/`Execution.status
   = cancelled` 로 귀결됨을 명시하고, 두 에러가 서로 다른 발생 지점(핸들러 vs 엔진 dispatch
   루프)이라는 점을 각주.
3. **§6 표에 새 행 추가**:
   ```
   | 노드 경계 Execution-cancel 재확인 가드 (`assertExecutionNotCancelled`, §2.3) | ✓ | `execution-engine.service.ts` — 선형 3곳(`runExecution`/`runNodeDispatchLoop`/`executeInline`) + 컨테이너(`executeContainerBody`, 아이템 경계)/Parallel(`executeParallelBranchBody`, 노드 경계) 반복 루프. mutation 검증 완료 |
   ```
   기존 `:140` 행 비고에서 "dispatch 사전 abort 체크" 앞에 "(노드-레벨 `abortSignal`)" 을
   덧붙여 신규 행과 명확히 구분.
4. **`frontmatter.code:`** 에 `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`
   추가 (현재 미등재 — W1 SUMMARY 지적).
5. **`:60` 행 비고 갱신**: "REST API `POST /executions/:id/stop` 가 실행을 중단" 뒤에
   "(Execution 행 UPDATE. 진행 중 dispatch 루프의 실제 중단은 위 신규 행의 노드 경계 가드가
   담당 — 2026-07-26 이전엔 이 가드가 없어 하류 노드가 계속 dispatch 됐다)" 를 추가.

### Rationale (developer 관점)

이 항목은 SPEC-DRIFT(코드가 spec 을 의도적으로 앞선 경우)가 아니라 **spec 서술 자체가
두 메커니즘을 하나로 뭉뚱그려 커버리지 오독을 유발한 경우**다 — §6 `:140` 행이 실제로는
"노드-레벨 abortSignal 사전 체크"만 가리키는데 "그러니 Stop 도 이미 커버" 로 읽힐 여지를
남겼고, 그 오독이 이 PR 이 고친 실제 결함(하류 노드 계속 dispatch)의 배경이었다. spec 을
바로잡지 않으면 향후 리뷰가 같은 혼동을 반복할 위험이 있어 project-planner 위임으로
남긴다. 코드·테스트·plan 갱신은 이번 PR(developer 범위)에서 완료했다.

### #6 보강 (2026-07-26, impl-done `review/consistency/2026/07/26/16_28_26`)

impl-done 5개 checker 가 위 #6 제안의 **범위 누락**을 지적했다. planner 는 반영 시 아래를 함께 처리해야 한다 — 그러지 않으면 SoT 만 최신이 되고 미러 문서들이 즉시 stale 해진다.

**(1) `spec_impact` 확장 — `cancelled` 생산자 서술이 4곳에 복제돼 있다** (cross_spec)

`node-cancellation.md` 만 고치면 아래 3곳은 자동 정합되지 않는다. 전부 "생산자: Parallel `cancel-others-on-fail` / 사용자 cancel" 만 나열하고 새 생산자(§2.3 노드 경계 가드)를 빠뜨린다.

- `spec/5-system/4-execution-engine.md:114` — §1.2 NodeExecution 상태 표의 `cancelled` 행
- `spec/1-data-model.md:546` — `NodeExecution.status` enum 설명(handler-throw 단일 경로만 서술)
- `spec/data-flow/3-execution.md:282` — §3.2 mermaid 상태 다이어그램의 `running --> cancelled` 엣지 레이블. 바로 다음 줄이 "엔진 코드 경로의 **관찰 요약**" 이라 코드 정확성을 자임하므로 특히 중요. **엣지 추가는 불요** — 같은 전이의 세 번째 사유이므로 라벨에 원인만 추가하면 된다.

**(2) §5.2 예외 명문화** (convention_compliance · rationale_continuity 수렴)

§5.2 표는 `errorPolicy === 'continue'` 를 "cancelled 기록 후 후속 분기 계속" 으로 서술한다. 그러나 `ForEachExecutor`·`ParallelExecutor` 는 `ExecutionCancelledError` 를 **errorPolicy 판정 이전에 무조건 우회 재throw** 한다(`skip`/`continue` 여도 계속하지 않는다). 설계 의도는 "Stop 을 continue 정책이 무효화하면 안 된다" 로 타당하나 문면에 없다.

→ §5.2 에 각주 추가: **`AbortError`(핸들러 발생)는 기존 표대로 errorPolicy 를 따르고, `ExecutionCancelledError`(엔진 발생, §2.3 가드)는 errorPolicy 무관 항상 우회 재throw** 한다. 두 sentinel 의 governance 차이를 표에 명시할 것.

**(3) 250ms 스로틀 Rationale 이관** (rationale_continuity)

#6 의 §6 표 제안은 "아이템 경계" 라는 구분만 언급하고 `CONTAINER_CANCEL_CHECK_THROTTLE_MS = 250` 과 그 근거(카운트 기반 대안 기각, ForEach 아이템 수 상한 부재)를 담지 않는다. 그대로 병합하면 근거가 spec 에서 영구 누락된다. 상세는 `node-cancellation-residual-signal-propagation.md` "트레이드오프 — 아이템 경계 cancel 가드 스로틀 (W10)" 절에 있으니 `node-cancellation.md ## Rationale` 로 이관할 것.

**(4) WS 프로토콜 — `execution.node.cancelled` 생산자·`error` 필드** (cross_spec, 이 항목은 그동안 `plan/` 어디에도 없어 유실 위험이 있었다)

`spec/5-system/6-websocket-protocol.md:186` 은 생산자를 "Parallel `cancel-others-on-fail` / 사용자 cancel" 2개로 나열하고 `error` 를 **상시 존재**하는 것으로 서술한다. 이번 구현으로 **세 번째 생산자**(§2.3 가드 → `executeNode` 취소 분기)가 생겼고, 그 경로는 내부 message(executionId 포함) 노출을 막기 위해 **`error` 를 싣지 않는다**.

→ 생산자 목록에 §2.3 노드 경계 가드 추가 + `error` 를 **optional** 로 서술. 런타임 영향은 없다(현재 소비자 전부 방어적 처리) — 문서만 어긋난 상태.

**(5) `error-codes.md` — `AbortError` 미등재** (convention_compliance)

`AbortError` 는 PascalCase 라 §1 `UPPER_SNAKE_CASE` 위반이고 §3 예외 레지스트리에 미등재다. 값 자체는 선재이나 이번 구현이 `markNodeCancelled` 공유 헬퍼로 재사용 지점을 늘렸다. 위 "추가 위임 (2026-07-25 #4)" 항목 (1) 과 동일 건 — 함께 처리할 것.
