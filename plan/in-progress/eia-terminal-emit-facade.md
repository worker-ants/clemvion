---
worktree: eia-r8-cache-scope-4ae434
started: 2026-08-15
owner: developer
branch: claude/eia-terminal-emit-facade
spec_impact:
  - spec/5-system/14-external-interaction-api.md
---

# 종결 emit 에 타입 초크포인트 세우기

## 다른 plan 과의 관계

정본 트래커는 [`spec-sync-external-interaction-api-gaps.md`](./spec-sync-external-interaction-api-gaps.md)
이고, 이 작업은 그 문서의 *"종결 이벤트 emit 에 타입 초크포인트가 없다"* 항목
(2026-08-15 등재, `11_59_09` architecture W1) 을 집행한다. **구현 커밋과 같은 턴에 양쪽을 닫는다.**

### `retry-turn-terminal-guard.md` #2 를 흡수한다 (`17_20_28` plan_coherence W1)

`retry-turn.service.ts:989` 의 CANCELLED 분기는 **`cancelledBy` 를 채우지 않는다** — 그
결함은 [`retry-turn-terminal-guard`](./retry-turn-terminal-guard.md) #2(P2, 미해결)가
소유하고, spec §6 `result.cancelledBy` 행이 *"경로 1곳 누락"* 각주로 그쪽을 가리킨다.

**파사드가 `cancelledBy` 를 필수 필드로 만들면 컴파일러가 그 결함을 드러낸다** — 이 리팩터의
가치를 가장 잘 보여주는 자리라 **이번 PR 에서 흡수**한다(그 plan #2 + spec 각주 동시 정리).

**값은 `'user'`** — 근거:

- 이 분기는 `ExecutionCancelledError` 로 트리거되는데, 두 throw 지점 모두 **DB 가 이미
  CANCELLED 인 것을 관측**했을 때 던진다. 즉 **누가 취소했는지는 알 수 없다**
- 그러나 spec §6.5 가 파생 규칙을 준다 — *"시스템 취소는 `error` 를 동행, 일반 user cancel
  에는 `error` 키가 없다"*. 이 경로는 **의도적으로 `error` 를 싣지 않으므로**(W16) `'user'` 가
  **payload 자체와 자기정합적**이다
- 동일 트리거를 처리하는 자매 `finalizeCancelledExecution` 도 `'user'` 를 쓴다

> **정확도의 한계를 적어 둔다**: 실제 원인이 timeout/system 이었다면 `cancelledBy` 와 `error`
> 부재가 **함께** 틀린다. 이는 자매와 공유하는 **선존 부정확성**이고 이 PR 이 만들지 않는다.
> DB 의 `error.code` 로 원인을 파생하는 개선은
> [정본 트래커에 등재했다](./spec-sync-external-interaction-api-gaps.md) —
> **처음엔 "등재한다" 는 미래형으로만 써 두고 하지 않았고**(`18_29_21` W3·W7 이 실측 반증,
> 이 형태가 다섯 번째다) 지적을 받고서야 실제로 등재했다.

## 왜 이걸 하는가 — 이 세션의 결함 대부분이 여기서 나왔다

`ExecutionEventEmitter.emitExecution(executionId, eventType, payload: unknown)` —
**payload 가 `unknown`** 이라 종결 이벤트의 형태를 컴파일러가 강제하지 않는다. 그래서 필드
하나를 호출부마다 손으로 스레딩해야 하고, 한 곳을 빠뜨려도 아무도 안 잡는다.

이번 세션의 PR 3개가 전부 그 자리에서 나왔다:

| PR | 결함 | 파사드가 있었다면 |
|---|---|---|
| #1169 | `llmCalls` strip 을 **세 출구 중 하나씩** 놓침 | — (다른 층) |
| #1170 | `error` 를 **네 emit 중 문자열로** 실음 | `error` 타입 강제 |
| #1171 | `durationMs` 를 **16 경로 어디서도** 안 실음 | `durationMs` 필수 필드 |
| #1172 | `cancelledBy` 계약 | `cancelledBy` 필수 필드 |

리뷰어가 매 라운드 *"이 PR 반복 결함의 구조적 원인"* 으로 지목했다.

## 실측 — 직접 호출 11곳

| 형태 | 곳 | payload |
|---|---|---|
| `EXECUTION_COMPLETED` | 6 | `{status, durationMs}` |
| `EXECUTION_FAILED` | 3 | `{status, durationMs, error}` |
| `EXECUTION_CANCELLED` | 2 | `{status, durationMs, result:{cancelledBy}}` + 조건부 `error` |

> 정본 트래커가 *"16 호출부"* 라 적은 것은 **`durationMs` 를 스레딩하는 경로** 수다.
> `emitExecution` **직접 호출**은 11곳이고 나머지는 `emitCancellationEvent` 경유다.
> 그 수치도 이 문서에서 정정한다.

## 설계

`emitTerminalExecution(executionId, payload)` — **판별 union**
(`TerminalEventPayload` — `TerminalErrorPayload` 를 **포함**하는 관계라 이름을 그와 한 단어
차이로 두지 않는다, `17_20_28` naming W1):

```ts
type TerminalEventPayload =
  | { type: 'completed'; durationMs: number | null }
  | { type: 'failed';    durationMs: number | null; error: TerminalErrorPayload | null }
  | { type: 'cancelled'; durationMs: number | null;
      cancelledBy: 'user' | 'system' | 'timeout';
      error?: { code: string; message: string } };
```

파사드가 `status` 와 `ExecutionEventType` 을 **type 에서 파생**한다 — 둘이 어긋날 수 없다.

**이 설계가 잡는 것**: `durationMs` 누락(필수) · `error` 누락 on failed(필수) ·
`cancelledBy` 누락 on cancelled(필수) · `status`↔이벤트 타입 불일치(파생).

## 이 리팩터가 종전의 사고와 다른 이유

이 계열에서 **넓은 일괄 편집이 대상 밖 8곳을 조용히 바꿔 전량 되돌린** 전례가 있다.
그건 정규식 치환이라 **아무도 안 잡았다.**

타입 파사드는 반대다 — 호출부를 옮기면 **`tsc` 가 전수로 검사**한다. 빠뜨리면 컴파일이
깨지지 실행 중에 조용히 틀리지 않는다. 그래서 이 항목만 넓은 편집을 허용한다.

## 조치

- [x] `ExecutionEventEmitter.emitTerminalExecution` 추가 (판별 union)
- [x] 직접 호출 **11곳 → 0곳** (스크립트로 잔여 실측)
- [x] `emitCancellationEvent` 도 파사드 경유
- [x] wire 형태 회귀 테스트 **4건** — emitter spec 에 (completed/failed/cancelled + user cancel 의 `error` **키 부재**)
- [x] 판별력 — `cancelledBy` 제거 → **TS2345**, `durationMs` 제거 → **TS2345**
- [x] 정본 트래커 닫기 + 수치 정정 + 자매 plan #2 흡수 + spec §6 각주 해소

## 구현 중 잡은 것 — 순환 import

`type` → 이벤트명·`status` 매핑을 **모듈 스코프 상수**로 뒀더니 **72 suites 가
`Cannot read properties of undefined` 로 터졌다.** 이 파일은 ws.service↔gateway↔
event-emitter ES-module 순환 위에 있어(생성자의 `forwardRef` 가 같은 이유), 모듈 평가
시점에 `ExecutionEventType` 이 아직 `undefined` 다.

**파일 자신의 JSDoc 이 그 순환을 경고하고 있었는데 내가 읽고도 놓쳤다.** 파생을 호출 시점으로
옮겨 해소하고, 그 사유를 코드에 적었다. `tsc` 는 이걸 못 잡는다 — 테스트가 잡았다.

## 범위 밖

- `emitNode` (노드 이벤트) — 종결 계약과 다른 표면
- 관용구 헬퍼 추출(`extractReturnedDurationMs` 등) — 별도 항목
- 단일 emit 관문 · 실 DB e2e · lock order — 전부 정본 트래커 등재됨

## `/ai-review` (`17_54_32`) 이 잡은 것 — CRITICAL 0 / WARNING 7

가장 아픈 건 **내가 클래스 JSDoc 을 지운 것**이다(W4). 타입 JSDoc 을 클래스 위에 넣으면서
기존 문서("C-6 strangle step 1" · 24곳 직접호출 이력 · 향후 비-WS 채널 노트)를 밀어냈고,
원문이 저장소 어디에도 남지 않았다. `git show origin/main:` 으로 복구했다.

**판별력 주장도 틀렸었다**(W6). `@ts-expect-error` 테스트를 넣고 *"ts-jest 가 타입체크한다"*
고 주석에 적었는데, 뮤테이션이 반증했다 — **jest 는 타입을 strip 해 9/9 GREEN 이었다.**
실제 강제 주체는 **타입 래칫 게이트**(`tsc`)다: 같은 뮤턴트에서 199 → 200. 주석을 정정했다.
지시문 위치도 틀렸었다 — 여러 줄 리터럴은 에러가 **속성 줄**에 보고돼, 객체 위에 둔 2건이
`Unused '@ts-expect-error'` 로 잡혔다(래칫 203).

## 체크리스트

- [x] `--impl-prep` (`17_20_28`) **BLOCK: NO** — WARNING 4 중 2건 반영(#2 흡수·타입명), 2건은 선존 spec drift
- [x] 자매 트래커 동시 갱신 (구현 커밋과 같은 턴)
- [x] TEST WORKFLOW 4스테이지 — **최종 커밋(`b7c22d922`) 기준 재실측**:
      lint / unit(백엔드 425 suites·**8737**) / build / **e2e 276 passed** 전부 PASS
      > 첫 e2e 시도는 **`no space left on device`** 로 실패했다 — 코드 실패가 아니라 Docker
      > 빌드 캐시 39GB 였다. `docker builder prune -af` 후 통과. 백엔드 Jest 자체는 그
      > 실패 실행에서도 276/276 이었고, 깨진 건 그 뒤 Playwright 러너 컨테이너 생성이다.
- [ ] `/ai-review` CRITICAL 0
- [ ] `--impl-done` BLOCK: NO
- [ ] push 게이트 통과 → PR
