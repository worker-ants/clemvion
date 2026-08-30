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
  - spec/5-system/6-websocket-protocol.md
  - spec/conventions/error-codes.md
  - spec/4-nodes/3-ai/1-ai-agent.md
---

> **#6·#7 은 2026-07-27 이행 완료** (커밋 `e79feae6a`). 아래 두 절과 각 보강은 **이력**으로
> 남긴다. **미결은 이 문서 최상단의 (a)/(b) 택일 결정뿐**이며, 그 결정은 여전히 사용자 몫이다
> (본문 Rationale "왜 developer 가 결정하지 않나" 참조).
>
> 이행 시 위임안을 그대로 따르지 않은 지점이 하나 있다 — #6 제안 1번("§2.3 생산자 목록에
> bullet 추가")은 `--spec` 검토가 **범주 오류**로 지적했다(§2.3 은 signal 생산자 절, 신규
> 가드는 signal 을 만들지 않는 DB 폴링). 별도 **§2.4** 로 분리해 반영했다.

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

### 결정 전에 반드시 읽을 것 (`--spec` 09_16_22 반영, 2026-07-27)

**두 선택지는 대칭이 아니다.** (b) 는 단순 재분류가 아니라 **이미 3곳에 인코딩된 구조적
invariant 를 뒤집는** 선택이다 — `4-execution-engine.md ## Rationale` §4 와 §11, 그리고
`data-flow/3-execution.md` §3.1/§3.2 다이어그램이 모두 **"`NodeExecution.cancelled` 는
abortSignal(및 2026-07-27 이후 DB 관측) 취소 경로 전용"** 을 전제로 서술돼 있다. SIGTERM 발
종료를 `cancelled` 로 옮기면 그 Rationale 항목 **자체를 개정**해야 한다. (a) 는 그 전제를
유지하고 각주만 추가한다. 결정 절이 이 비대칭을 드러내지 않고 있어 명시한다.

- **(a) 채택 시 추가로 필요한 것** — "SIGTERM/timeout 발 abort 만 예외" 를 실제로 강제할
  **producer 구분 메커니즘이 현재 spec·코드 어디에도 없다**(모든 `.abort()` 가 bare 호출,
  `signal.reason` 미사용). §5.1 은 에러 타입만으로 판정하므로, 예외를 문서에만 적으면
  구현이 그것을 구분할 방법이 없다. §2.3/§5.1 에 "SIGTERM/timeout 발 abort 는 `signal.reason`
  등 producer 태그를 실어 §5.1 catch 가 우선 검사한다" 는 판정 규칙을 함께 명문화할 것.
- **(b) 채택 시 "동반 갱신" 목록에 추가할 것**:
  - `node-cancellation-residual-signal-propagation.md` 백로그 — `assertExecutionNotCancelled()`
    관측 대상을 `status IN (CANCELLED, FAILED)` 로 확장할지 여부(그 plan 이 이 결정에 명시적으로
    종속시킨 항목이다)
  - `execution-engine-residual-gaps.md` §G2 의 "현재는 …전부 `failed` 처리" 서술이 stale 해진다
  - `4-execution-engine.md ## Rationale` §4 항목 자체의 개정
- **어느 쪽이든** 채택 후 `node-cancellation.md ## Rationale` 에 **신규 항목**을 남길 것 —
  왜 이 분류인지, §11·data-flow §3.2 기존 서술과 어떤 관계인지. (다른 위임 항목에는 전부
  Rationale 이관 지시가 있는데 이 결정 절에만 빠져 있었다.)
- **명명 주의** — 미채택 대안이던 "`NODE_CANCELLED` 류 error code" 는 기존
  `NodeEventType.NODE_CANCELLED`(WS 이벤트 enum 멤버)와 심벌명이 겹친다. 그 대안을 되살린다면
  `NODE_EXECUTION_CANCELLED` 처럼 구분되는 이름을 쓸 것.
- **참고** — `AbortError` 의 error-codes §3 등재(구 위임 #4 (1) / #6 보강 (5))는 2026-07-27
  에 **이미 이행**했다. 이 결정과 무관하게 처리된 항목이므로 다시 세지 말 것.

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
> 초안: [`spec-draft-node-cancellation-chat-channel-correction.md`](../complete/spec-draft-node-cancellation-chat-channel-correction.md).

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
> 초안: [`spec-draft-node-cancellation-chat-channel-correction.md`](../complete/spec-draft-node-cancellation-chat-channel-correction.md).

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

## 추가 위임 (2026-07-26 #7) — §2.1 IE 행의 "완화됨/응답성 갭" 서술이 실측으로 반증됐다

`--impl-prep` `review/consistency/2026/07/26/19_30_39` plan_coherence WARNING 1·2.
[`ie-resume-turn-boundary-cancel.md`](ie-resume-turn-boundary-cancel.md) 착수 시 **무수정
프로브**로 확인. #6 과 같은 choke point(취소 관측)를 다루므로 함께 반영할 것.

### 무엇이 틀렸나

§2.1 Anthropic SDK 행의 IE 서술은 두 가지를 주장한다:

1. *"resume 경로는 turn 경계에서 abort 체크를 도입하는 별도 작업으로 추적"* — **방향은 맞다.**
   다만 같은 문장이 `ResumableMessageOptions.signal` 을 *"abort 소스 도입 시 resume chat 까지
   signal 이 도달하도록 열어둔 executor-side plumbing"* 이라 설명해, **언젠가 signal 이 생길
   것**처럼 읽힌다. 실측: 엔진 전체에서 `new AbortController()` 는 `parallel-executor.ts:188`
   한 곳뿐이고 사용자 Stop 은 signal 을 만들지 않는다(#6 이 정리한 그 사실). 즉 resume 경로의
   해법은 signal 전파가 아니라 **#6 과 동일한 DB 관측 가드**다.
2. *"defense-in-depth timeout … 위 resume signal gap 과 무관하게 무기한 hang 을 상한한다"*
   → 이를 근거로 부모 plan 은 **"데이터 정합성 위험이 아니라 응답성 갭"** 이라 결론지었다.
   **이 결론이 틀렸다.** 타임아웃은 hang 을 상한할 뿐, 아래 결함을 완화하지 못한다.

### 실제 결함 — park 짝 전이 lost update

`updateExecutionStatus`(상태 전이 단일 choke point) 의 `linkedNodeExec` 분기는 무가드
full-entity save 다. AI multi-turn 턴 진행 중 사용자가 Stop 을 누르면:

1. `stop()` 이 `status IN (RUNNING, PENDING)` 가드 UPDATE 로 DB 를 `CANCELLED` 로 마감
2. 턴이 끝나고 re-park 가 `updateExecutionStatus(savedExecution, WAITING_FOR_INPUT, nodeExec)`
3. orchestrator 는 Execution 을 재로드하지 않아 in-memory 상태가 `RUNNING`(stale) →
   `assertTransition` 통과 → full-entity save 가 `CANCELLED`/`finishedAt` 을 **덮어씀**

결과: 사용자가 누른 Stop 이 **소실**되고 실행이 다시 재개 가능 상태로 보인다. #6 의 노드 경계
가드는 park 가 세그먼트를 끝내므로 이 경로에 닿지 않는다.

### 제안 변경

1. **§2.1 IE 행 재서술** — "signal 미전파(gap)" 프레이밍을 **"resume 경로는 signal 이 아니라
   turn 경계 DB 관측으로 취소를 처리한다"** 로 바꾼다. `ResumableMessageOptions.signal` 은
   *"현재 abort 소스가 없어 항상 undefined 인 plumbing"* 임을 명시(장래 도입 기대를 제거).
2. **완화 서술 삭제·정정** — "데이터 정합성 위험이 아니라 응답성 갭" 문장을 제거하고, 실제
   위험이 **취소 소실(lost update)** 이었음과 그 차단 방식(park 짝 전이의 terminal 가드)을 적는다.
3. **§2.3 에 bullet 보강** — #6 이 추가할 "노드 경계 Execution-cancel 재확인" 옆에 **"turn 경계
   (AI multi-turn resume)"** 도 같은 가드 계열임을 명시.
4. **§6 표에 행 추가** — `AI multi-turn resume turn 경계 cancel 가드 + park 짝 전이 terminal 가드`.
5. **`## Rationale` 이관** — "왜 signal 이 아니라 DB 관측인가"(Stop 은 signal 을 만들지 않는다)와
   "왜 짝 전이 분기에 가드가 없었나"(M-3 이 else 분기만 고치고 짝 전이는 명시적으로 범위 밖으로
   남겼다 — `plan/complete/refactor/05-database.md`) 근거를 남길 것. rationale_continuity WARNING 1
   이 지적한 "과거 결정을 닫으면서 그 근거를 spec 에 남기지 않는" 재발 방지.

### #7 보강 (impl-done 21_06_23 WARNING 1·2·3 반영)

`--impl-done` 검토에서 두 checker 가 독립적으로 **위 "제안 변경" 5개가 불완전**하다고 지적했다.
아래 3건을 #7 처리 시 함께 반영한다 (지적이 실측으로 맞음을 확인 — #7 절 안에
`execution-engine.md`/`§1.1` 문자열 0건이었다).

6. **`spec/5-system/4-execution-engine.md` §1.1(원자성 보장) 보강** — 짝 전이(Execution +
   NodeExecution 단일 트랜잭션)가 **DB 가 이미 terminal 이면 두 save 를 모두 건너뛰고
   `false` 를 반환하는 no-op** 가 될 수 있음을 서술한다. 현재 §1.1 은 "원자적으로 함께
   전이한다" 만 말해, 전이가 **적용되지 않을 수 있다**는 신규 케이스가 빠져 있다.
7. **`cancelled` 생산자 목록 미러 3곳 동기화** — 이번 PR 이 추가한 생산자
   (AI multi-turn turn 경계 / park 짝 전이 terminal 가드 → `markNodeCancelled`)를
   `4-execution-engine.md:114`(§1.2 표) · `1-data-model.md:546`(§2.14) ·
   `data-flow/3-execution.md:282`(§3.2 mermaid) 에 함께 추가한다. #6 은 "§2.3 노드 경계"
   생산자만 다루므로 이 두 번째 생산자가 누락된다.
8. **`EngineDriver` 멤버 수 invariant 정정** — `execution-engine.md ## Rationale` §C-1 이
   기록한 "12 distinct 멤버 / `AiTurnEngineDriver` 7멤버" 가 이번 PR 의 신규 3개
   (`assertExecutionNotCancelled`, `markNodeCancelled`, `assertActiveExecutionAndSaveNodeExec`
   — **4차 라운드에 `tryLockActiveExecutionAndSaveNodeExec` 로 개명, rename-only 이라 멤버
   수는 불변**)로 **distinct 15 / AiTurn 10** 이 됐다. (main 이 인터페이스 파일에서 실측:
   Core 2 + Interaction 1 + Reentry 1 + AiTurn 자체 6 + Retry 자체 5 = 15, AiTurn 합계 =
   2+1+1+6 = 10.) `tryLockActiveExecutionAndSaveNodeExec`(구 `assertActiveExecutionAndSaveNodeExec`)
   는 ai-review WARNING #1(2026-07-26 3차 라운드) fix 로 `finalizeAiNode` RUNNING 유지
   분기의 관측+save 를 형제 분기(`updateExecutionStatus` 의 linkedNodeExec 분기, FOR UPDATE)
   와 동일하게 원자화하며 추가됐다 — **이전 라운드가 위임한 14/9 목표가 이번 라운드에 다시
   15/10 으로 갱신됐다**(같은 항목이 두 라운드 연속 갱신되는 것을 막기 위해, spec 반영 시점에
   코드 실측치를 다시 한 번 확인할 것). 코드 쪽 docstring 은 본 라운드에서
   `engine-driver.interface.ts` 를 직접 정정했으므로, spec Rationale 만 같은 수치로 맞추면
   된다 — **코드 15 vs spec 12 로 갈라지지 않게 같은 턴에 처리할 것**. spec 반영 시
   메서드명은 **개명 후 이름(`tryLockActiveExecutionAndSaveNodeExec`)으로 기록**할 것 —
   4차 라운드 rename 이 코드에 이미 반영돼 있다.

## ~~추가 위임 (2026-07-28 #8) — §1.1 이 "park 없이 종결되면 cancel 무효과" 라는 **반증된 결정**을 아직 단언한다~~ → **이행 완료 (2026-07-28)**

출처: `retry-turn-terminal-guard.md` PR 의 consistency-check `--impl-done`
(`review/consistency/2026/07/28/01_26_40`) WARNING #1·#2. **5개 checker 중 4개가 서로 다른
각도에서 독립 수렴**했고, `rationale_continuity` 는 이 결함 클래스(Stop 이 조용히 소실)가
최근 3 PR(`#1021`~`#1023`) 연속 재발한 이력을 근거로 HIGH 를 매겼다.

**이 모순은 지금까지 어떤 project-planner 추적 문서에도 등재된 적이 없다**(checker 확인).
그래서 본 집계 문서에 #8 로 신규 등재한다 — 등재하지 않으면 다음 planner 스윕이 놓친다.

### 모순의 실체

`spec/5-system/4-execution-engine.md` §1.1 이 다음 **4가지 모두와 정반대**로 서술한다:

| # | 대상 | 위치 | 서술 |
|---|---|---|---|
| 모순 원본 | 상태 전이표 `failed→running` | `4-execution-engine.md:77` (`db496a3c2`, 2026-06-10) | "취소는 다음 `waiting_for_input` park 에서 **비로소 발효**된다" — `cancelParkedExecution` 을 유일 마킹 지점으로 지목 |
| 모순 원본 | Rationale "`failed → running` 재진입 전이" | `4-execution-engine.md:1454` (`5e0c5e449`, 2026-06-06) | "replay 가 park 없이 그 turn 에서 종결되면 cancel 은 **무효과**로 흘려보내진다" |

> **위 두 행은 초판에서 날짜가 맞바뀌고 인용이 오귀속됐다** (`--spec` 검토 WARNING #1 이 `git blame` 으로 검출,
> 실측 확인). 정정: 77행=`db496a3c2`(2026-06-10), 1454행=`5e0c5e449`(2026-06-06). 또한 "무효과" 문장은
> **Rationale 에만** 있고 전이표의 문제는 "비로소 발효" 였다. 두 지점이 날짜가 가깝고 서로 참조하는 관계라
> 사람이 뒤집기 쉬우므로 이후 인용은 **커밋 해시로 앵커링**한다.
| 반대 (a) | 같은 파일 "짝 전이 DB 관측 가드" | `4-execution-engine.md:79-92` (2026-07-27, `#1023`) | "가드가 없으면 Stop 이 소실된다 — terminal 마감 경로도 조건부 UPDATE 를 거친다" |
| 반대 (b) | 자매 컨벤션 | `spec/conventions/node-cancellation.md` §2.4 + Rationale | 동일 |
| 반대 (c) | WS 프로토콜 | `spec/5-system/6-websocket-protocol.md:375` (2026-05-30, **원 기능 도입 시점부터**) | "replay 중 cancel" |
| 반대 (d) | 코드·테스트 | `retry-turn.service.ts` `finalizeGuarded` + 회귀 테스트 (`retry-turn.service.spec.ts:789,805`) | park 도달 여부와 무관하게 먼저 커밋된 CANCELLED 는 이후 어떤 자연 종결로도 덮이지 않음 |

즉 **코드가 옳고 spec §1.1 만 낡았다.** `#1021`/`#1022` 커밋 메시지도 구 동작을 명시적으로
"결함" 으로 규정했다. 코드를 되돌리는 것이 아니라 spec 을 정정하는 SPEC-DRIFT 역류다.

### 위임 항목

- [x] `4-execution-engine.md:77`(전이표)·`:1454`(Rationale)의 "park 없이 종결되면 cancel
      무효과" 서술 삭제 → "DB 에 이미 커밋된 cancel 은 park 도달 여부와 무관하게 항상
      우선하며, 자연 종결은 guarded 쓰기로 스킵된다" 로 정정. 같은 파일 `:81-92` 문구를
      재사용할 수 있다.
- [x] `spec/conventions/node-cancellation.md` §6 구현 현황 표(`:184` 부근)에
      `retry-turn.service.ts`(`finalizeGuarded`) 행 추가 — 현재 `execution-engine.service.ts`
      만 나열해 §2.4 가드의 **3번째 소비자**가 빠져 있다. frontmatter `code:` 목록(`:4-13`)
      에도 등재할 것.
- [x] 위 표에 **메커니즘 차이 각주**: 기존 소비자는 앱 레벨 `??` 병합
      (`finalizeCancelledExecution`), 신규 소비자는 SQL `COALESCE`(`finalizeGuarded` 의
      CANCELLED 멱등 분기 — SELECT~UPDATE 사이 창을 신뢰하지 않기 위해 UPDATE 문 자체에서
      그 순간의 DB 값을 재평가). 같은 계약의 두 구현이므로 표에 드러나야 한다.

### 관련

- 소비 PR: `plan/in-progress/retry-turn-terminal-guard.md` (ai-review 5라운드 수렴,
  코드 측은 완료). 그 plan 의 `spec_impact` 도 본 항목 때문에 `none` → 2개 파일 목록으로
  갱신했다 — **본 #8 이 반영되기 전에는 그 plan 을 `complete/` 로 옮기지 말 것**
  (Gate C 가 `spec_impact` 를 그대로 신뢰한다).

### #8 이행 결과 (2026-07-28)

- `4-execution-engine.md` §1.1 전이표 `failed → running` 행 — "비로소 발효" 를 "기록은 지연되지
  않는다(즉시 커밋) + turn 경계 관측 + park 없이 종결되어도 보존" 으로 정정.
- 같은 파일 Rationale 절 — 제목에 번복 태그, 본문에서 "무효과" 단언 철회 + 철회 근거
  (`#1021`/`#1022`/`#1024` 커밋 사유)를 커밋 해시 앵커와 함께 기록.
- `node-cancellation.md` — frontmatter `code:` 등재 · §2.4 프로즈 4번째 bullet 신설
  (§6 표와 1:1 대응 유지) · §6 표 행 추가 · 배너 날짜 2026-07-28 · `## Rationale` 에
  "왜 취소 시각 보존 메커니즘이 두 가지인가" 서브섹션 신설(표 각주 대신 — 근거를 표에만
  담으면 영구 누락된다는 #6 보강(3) 선례 준용).
- 사전 검토: `--spec` 2라운드. 1R BLOCK: YES(draft frontmatter `worktree:` 누락) → 해소,
  2R **BLOCK: NO** (Critical 0, 5 checker 전원 LOW). draft:
  `plan/complete/spec-draft-cancel-invariant-drift.md`.

## 추가 위임 (2026-07-28 #9) — 경량: cancel 즉시성 서술 정밀도 2건

`#8` 집행 중 `--spec` 검토가 인접 drift 2건을 확인했다. 둘 다 **모순은 아니고 정밀도 문제**라
`#8` 범위에서 제외했으나, "비목표" 절에만 적으면 유실되므로 별 항목으로 등재한다
(이 문서의 `#8` 자신이 한때 그런 유실 사례였다).

- [ ] `spec/5-system/6-websocket-protocol.md` 의 **`- **replay 중 cancel**:`** 항목 —
      **"진행 중 turn 을
      > **위치를 줄번호가 아니라 앵커 문구로 바꿨다 (2026-08-29).** 원래 `:375` 로 적혀
      > 있었는데 지금 그 문구는 **:450** 에 있다. 줄번호는 그 파일에 한 줄만 들어가도
      > 거짓이 되므로(이 저장소가 반복해서 밟은 형태), 이동에 안전한 **항목명 앵커**로
      > 고정한다. 지적 내용(`#8` 이 §1.1 에 확정한 어휘로 통일)은 그대로 유효하고,
      > 문구는 2026-08-29 재확인 시점에도 미정정이다.
      조기 종료"** 표현 — 결론(취소 존중, `execution.cancelled` 만 발사)은 옳으나 "조기 종료" 가
      Execution 상태 차원의 즉시 중단으로 읽힌다. 실제로는 **turn 경계 관측**이고, 진행 중 I/O 는
      §4 cascade 의 `abortSignal` 로 중단될 수 있어 부분적으로만 맞다. `#8` 이 §1.1 에 확정한
      표현("즉시 끊지 않는다 / 기록은 지연되지 않는다")과 같은 어휘로 맞출 것.
- [ ] `spec/3-workflow-editor/3-execution.md §4`(`:170-178` 부근) **"강제 중단(Force, 3초 이상
      누르기)"** 서술 — 2026-03-26 최초 PRD 이후 미갱신이고, `#8` 이 명문화한 "진행 중 turn 즉시
      중단 불가(깨울 in-memory 코루틴 없음)" 아키텍처 제약과 어긋난다. 미구현/Planned 마커를
      붙이거나, 실제 즉시-중단 구현 여부를 결정해 등재할 것.

## 추가 위임 (2026-07-28 #10) — `retry_last_turn` 원자성: 코드와 **동반 필수** spec 갱신

출처: `retry-turn` P1 착수 전 `--impl-prep spec/5-system/`
(`review/consistency/2026/07/28/17_21_27`) CRITICAL #2 — `rationale_continuity` ·
`plan_coherence` 두 checker 가 독립 판정. **코드 방향(원자 claim)은 §7.5 CAS 일반화 원칙과
부합한다고 승인**됐고, 문제는 spec 이 5곳에서 "동일 turn 이중 실행 0" 을 단언하는데 실제
코드가 그것을 충족하지 못한다는 점이다.

> ⚠️ **이 항목은 별 PR 로 처리하지 말 것.** checker 가 "코드와 동반 필수" 로 명시했다.
> **같은 PR(브랜치) 안에서** 반영한다 — 코드 커밋 뒤 spec 커밋을 이어 붙이는 형태도 무방하다.
>
> (2026-07-28 완화. 초판은 "같은 **커밋**" 이라 적었으나 `--impl-prep 19_51_18` WARNING #2 가
> 실측으로 반박했다: 이 문서의 선행 8개 항목(#1/#2/#4~#8)이 **전부** "코드 PR 머지 후 별도
> project-planner 커밋" 으로 처리됐고, `.claude/hooks/` 전수 확인 결과 role 별 `spec/` 쓰기를
> 기술적으로 막는 훅도 없다. 지켜야 할 최소 의도는 **"별도 PR 로 미루지 않는다"** 이므로 그것만
> 명시한다. 리터럴 단일 커밋을 요구하면 developer 세션이 관행을 깨거나 브랜치 내 역할 전환
> 시점을 별도로 정의해야 하는데, 그 이득이 없다.)

- [x] `4-execution-engine.md` §4.1 각주 — 현재 crash re-drive 항목에 연결돼 있어
      `retry_last_turn` 전용 근거로 재연결
- [x] §7.4 / §8 — 신규 claim 위치 반영 + 각주
- [x] §7.5 — "spawn 단계 원자성만으론 불충분한 이유" 대칭 Rationale 항목 신설
- [x] `plan/complete/exec-intake-queue-impl.md` 의 2026-06-06 PASS 판정과 현재 CRITICAL 사이의
      간극 기록

### #10 이행 결과 (2026-07-28, `b351731f0`) — `--spec 12_38_59` WARNING #3 정정

위 체크박스 4개는 **이미 `b351731f0` 에서 전부 반영**됐는데 `[ ]` 로 남아 있었다(§4.1 각주 재연결 ·
§7.4 두 행 · §7.5 대칭 Rationale 신설 · exec-intake PASS 판정 간극 기록 — 전부 diff 확인). stale
체크박스를 먼저 읽으면 "§7.5 섹션이 아직 없다" 고 착오한다.

추가로 **2026-07-30(`--spec 12_38_59`)** 에 그 §7.5 문단의 백스톱 커버리지 서술을 정정했다 —
"복구는 `recoverStuckExecutions` 백스톱이 담당한다" 는 무조건 서술이 이 PR 자신의 실측으로
반증됐다(2차 claim 경로는 닿지 않음). 같은 턴에 §7.3 "orphan row 마감" 에 스코프 각주를 달아
두 서술이 모순으로 오인되지 않게 했고, frontmatter `pending_plans:` 에
`retry-turn-terminal-guard.md` 를 역방향 등재했다.

### 인과는 두 번 틀렸다 — 실측으로 확정한 사실

| 주장 | 출처 | 판정 |
|---|---|---|
| "2026-06-06 PASS 가 DI 리팩터 `#638`(2026-06-19)로 무효화됐다" | `--impl-prep` CRITICAL #2 | **틀림** |
| "배제 로직은 `3213a4a55`(2026-05-30)부터 존재" | `--spec` 검토 WARNING #2 의 정정 | **이것도 틀림** |
| `claimResumeEntry` 는 **2026-07-03 (`44f956e9c`, #791 "06 C-2 재개 진입 DB 원자 claim")** 도입 | `git log -S "claimResumeEntry" -- continuation-execution.processor.ts` | **실측** |

정확한 서술: **2026-06-06 PASS 는 원자 claim 도입(2026-07-03) 이전이라 이 축을 애초에 검증한
적이 없다.** 무효화된 것이 아니라 **스코프 밖**이었다. 2026-05-30 부터 있던 것은
`retry_last_turn` **job type** 이지 배제 조건이 아니다 — 배제 조건은 claim 이 존재해야 성립하므로
2026-07-03 이전에는 있을 수 없다.

**교훈**: 중간 문서를 거친 인과 주장은 **양쪽 다 틀릴 수 있다.** 위 표의 두 주장은 서로를
정정하려 한 것인데 둘 다 빗나갔다. `git log -S` 로 원 도입 시점을 직접 잡는 것 외에 확정
방법이 없다. `#10` 이행 시 이 표를 근거로 쓸 것.

## 추가 위임 (2026-07-28 #11) — 경량: 그래프 시각화 "노드/엣지" 명명 회피 규칙 미문서화

`--impl-prep 19_51_18` WARNING #3. `#8`/`71ce6c12b` 가 방금 고친 `Entity` vs TypeORM `@Entity`
와 **동일 유형의 재발**이다 — 활성 충돌은 없어 CRITICAL 은 아니나 같은 클래스다.

Graph RAG 시각화(KB-GR-UI-07)의 "노드/엣지" 가 워크플로우 캔버스의 실제 타입 식별자
(`@xyflow/react` 의 bare `Node`/`Edge`, 백엔드 `NodeDto`/`EdgeDto`)와 이름이 겹친다. 코드는
이미 두 곳에서 **개별적으로, 문서화 없이** 접두어로 회피했다 — `GraphVizNodeDto`/`GraphVizEdgeDto`,
`Graph3DNode`/`Graph3DLink`.

- [ ] `10-graph-rag.md` KB-GR-UI-07 인근(또는 §2.3~2.5 "구현 식별자 주의" 각주 옆)에
      "시각화 노드/엣지는 워크플로우 캔버스 Node/Edge 와 별개이며 구현은 `GraphViz*`/`Graph3D*`
      접두" 한 줄 병기.
- [ ] **재발 방지 규약 검토** — "프레임워크/도메인 예약어와 겹치는 bare 타입명은 접두어로
      구분한다" 를 명명 규약으로 신설할지. 실례가 이제 둘이다(`Entity`→`Graph*`,
      `Node`/`Edge`→`GraphViz*`/`Graph3D*`).

## 추가 위임 (2026-08-14 #12) — `UPDATE … RETURNING` 튜플 shape 수정의 소급 각주 5건

`plan/in-progress/update-returning-tuple-shape.md` 가 고친 결함(TypeORM 이 UPDATE/DELETE 에
`[rows, rowCount]` 튜플을 돌려주는데 8곳이 행 배열로 다룸)은 **spec 이 서술한 보장 여러 개를
소급으로 무효화**한다. 그 각주가 `update-returning-tuple-shape.md` 자신의 후속 절에만 있어
다음 planner 스윕에서 놓칠 위험이 있다 — 이 집결 티켓에 포인터로 등재한다
(consistency `00_00_45` plan_coherence WARNING 2).

| 대상 | 넣을 caveat |
|---|---|
| `spec/5-system/4-execution-engine.md` §1.1 | admission gate·종결 이벤트 가드가 `8332d9a20`(2026-08-13) 이전엔 실효되지 않았다 |
| `spec/5-system/8-embedding-pipeline.md` §7.3 | KB 재임베딩 CAS 락이 거절한 적 없다 |
| `spec/5-system/10-graph-rag.md` 동시 호출 표 | KB 재추출 CAS 락이 거절한 적 없다 |
| `spec/data-flow/2-auth.md` OAuth state 소비 | 소셜 로그인이 상시 실패였다 |
| `spec/conventions/node-cancellation.md` §2.4 | **행 라벨이 아니라 소비 경로 단위로** — 영향 있음은 반환값으로 분기하는 **11곳 / 3파일**(`execution-engine.service.ts` 6 · `ai-turn-orchestrator.service.ts` 3 · `retry-turn.service.ts` 2), 영향 없음은 반환값을 버리는 9곳 + `assertExecutionNotCancelled`·`linkedNodeExec` `FOR UPDATE`. **`executeSync` 는 영향 없음** — 초판에서 잘못 넣었다. 이 목록을 두 번 틀렸으니(서술형 라벨 → 한 파일만 집계) 각주를 쓸 때 **전수 목록을 다시 열 것**: [`update-returning-tuple-shape.md`](./update-returning-tuple-shape.md) §후속 의 표가 정본 (`00_20_21` side_effect W2) |

**추가 (consistency `00_20_22` cross_spec INFO 2)** — 위 5건과 성격이 다르다. caveat 이 아니라
**신규 카탈로그 항목**이다:

| 대상 | 넣을 것 |
|---|---|
| `spec/5-system/3-error-handling.md` **§1.2 인증/인가 에러** | `OAUTH_STATE_MISMATCH` (400) 등재 + `data-flow/2-auth.md` 상호링크 |

> **⚠️ 위 "§1.2 메인 표" 지시는 그대로 집행하면 안 된다 (2026-08-30 planner 턴 실측).**
> 이 항목을 raw-query 규약 PR 에 얹으려다 두 결함을 발견해 **의도적으로 남겨 뒀다** —
> 제자리에 넣으려면 구조 판단이 필요하고, 그건 이 집결 티켓의 몫이다.
>
> | 확인한 것 | 실측 (2026-08-30) |
> |---|---|
> | **§1.2 메인 표는 400 을 안 받는다** | 메인 = 401×5 · 403×3 · 423×1, **400 은 0건**. 400 둘은 §1.2.1 소재. 문서 자신의 Rationale 이 "§1.2 는 401/403/423, 그 밖 status 는 서브섹션" 을 선례로 명시 |
> | **발행처가 둘이고 의미 폭이 다르다** | 통합 OAuth = `MISMATCH`(4)·`MISSING`(2)·`EXPIRED`(5)·`INVALID`(2) 로 **세분** / 소셜 로그인 = `MISMATCH`(9)·`EXPIRED`(1) — MISMATCH 하나가 missing·expired·consumed 를 **포괄** |
>
> 따라서 필요한 것은 (a) §1.2.1("2FA / WebAuthn / 재인증")이 **아닌** 새 서브섹션, (b) 두
> 발행처의 의미 폭 차이 표기, (c) `2-navigation/4-integration.md §9.4`(통합 쪽 기등재)와의
> 상호링크. `spec_impact` 에 통합 문서 추가 여부도 함께 판단할 것.

> **삽입 위치 정정** — 초판은 "§1.8 인근" 이라고 적었다. §1.8 은 **KB / Graph RAG 도메인 전용**
> 절이라 인증 코드가 갈 자리가 아니다. 자매 코드가 거기 있다는 이유로 위치까지 따라간 것인데,
> 그 자매가 KB 코드였다는 게 요점이었다. 인증 코드의 자리는 §1.2 다
> (`00_54_07` convention_compliance INFO 3).

실측(2026-08-14): `3-error-handling.md` 내 출현 `OAUTH_STATE_MISMATCH` **0** vs
`KB_REEMBED_IN_PROGRESS` **1** · `KB_REEXTRACT_IN_PROGRESS` **1**. 자매 둘은 등재됐는데
이것만 빠졌다.

**이 PR 전에는 등재 가치가 낮았다** — 튜플 shape 오인으로 OAuth state 소비가 항상 실패해
이 코드가 *상시* 발생했기 때문이다. fix 이후에야 "실제 이상 상황에서만 발생하는 코드" 라는
원래 의미로 돌아왔고, 그래서 지금 카탈로그 완결성이 의미를 갖는다.

착수 전 알아야 할 두 가지 (실측):

- **미등재 ≠ 미문서화.** 이 코드는 이미 `spec/2-navigation/4-integration.md:851` 에 `(400)` 으로,
  `spec/conventions/error-codes.md:35` 에 명명 예시로 나온다. 빠진 것은 **중앙 카탈로그** 한
  곳뿐이다 — 새로 정의하지 말고 기존 서술과 status·의미를 맞춰 등재할 것.
- **한 코드가 두 표면을 공유한다.** 로그인 OAuth(`auth-oauth.service.ts`, 이번 PR 이 고친 쪽)와
  서드파티 연동 OAuth(`integration-oauth.service.ts`)가 같은 문자열을 던진다. 위의
  `2-navigation/4-integration.md` 서술은 **연동 쪽**이다. 카탈로그 행은 양쪽을 다 덮게 쓰거나,
  덮지 않는다면 어느 쪽인지 명시할 것 — 한 표면만 보고 적으면 반대쪽이 카탈로그와 어긋난다.

**추가 2 (consistency `01_57_37` convention_compliance WARNING 3)** — 이 PR 과 무관한 별건이나
같은 planner 턴에 묶으면 싸다:

| 대상 | 고칠 것 |
|---|---|
| `spec/data-flow/15-external-interaction.md` §4 (Redis 행, ~L310) | *"§9.1 참고, EIA 키는 아직 미등재다"* 문장이 **stale** 하다. `#1160` 이 `conventions/redis-keys.md` 를 신설하면서 `4-execution-engine.md §9.1` 은 redirect-only 가 됐고 `interaction:idempotency:*` 는 이미 `redis-keys.md §3` 에 등재됐다. → *"키 형태·전역 인벤토리는 `conventions/redis-keys.md` 참고"* 로 정정하고 **"미등재" 구절은 삭제**할 것 |

**부수**: frontmatter `pending_plans:` 에 `update-returning-tuple-shape.md` 등재.
대상은 위 표의 5개 문서 **전부**다 (checker 는 `4-execution-engine.md`·`node-cancellation.md`
둘만 짚었으나, caveat 을 받는 문서는 다섯이고 기준이 같다).

> **✅ 완료 (2026-08-30, planner 턴)** — 등재 가능한 **4곳 전부** 반영했다:
> `node-cancellation.md` · `4-execution-engine.md` · `8-embedding-pipeline.md` ·
> `10-graph-rag.md`. **`data-flow/2-auth.md` 는 제외** — 그 문서는 frontmatter 자체가 없다
> (`# ` 로 시작, 실측). "5개 전부" 라는 지시는 그 한 곳에서 성립하지 않는다.
>
> 소급 각주 5건도 같은 턴에 반영했다(`2-auth.md` 포함 — 각주는 frontmatter 와 무관).

> `spec-pending-plan-existence.test.ts` 는 **한 방향 가드**다 — 등재된 경로가 실존하는지만
> 검사하고, 문서가 관련 plan 을 등재하도록 강제하지 않는다. 즉 이 항목은 **가드가 잡아주지
> 않는 규율**이라 여기 적어두지 않으면 조용히 사라진다.

> 상세 근거·실측: [`update-returning-tuple-shape.md`](./update-returning-tuple-shape.md).
