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

---

## 추가 위임 (2026-07-25) — §6 표 두 행 갱신 (SPEC-DRIFT)

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
