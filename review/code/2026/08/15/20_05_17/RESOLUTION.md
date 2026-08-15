# RESOLUTION — `20_05_17` (branch `claude/ws-event-types-extract`)

Critical **0** · Warning **2** · INFO 5. Warning 2건 반영, INFO 1건 반영 + 4건 무조치/등재.

직전 라운드(`19_27_37`) Warning 5건은 8개 reviewer 가 소스 직접 대조로 전부 반영 확인.

---

## Warning

### W2 (testing) — 내가 방금 쓴 경고를 같은 파일 안에서 어겼다 · **반영**

**지적이 옳고, 이번 라운드에서 가장 아픈 발견이다.**

전 커밋 메시지에 이렇게 썼다:

> W5 가드는 import 한 줄만 세지 않는다. 모듈 간선은 export-from · import=require · 동적
> import · require 로도 생기므로 TS 파서로 전부 센다. **여기서 한 칸 좁게 잡는 것이 내 반복
> 실패 형태다.**

그래 놓고 같은 파일의 **세 번째 테스트는 `ts.isImportDeclaration` 만 순회**했다. 첫 번째
테스트는 `moduleSpecifiersOf` 로 다섯 형태를 다 세는데, 세 번째만 손으로 좁게 다시 짠 것이다.
리뷰어가 실제 프로브(`export { ExecutionEventType } from '…/websocket.service'`)로 **4/4
GREEN — 미검출**을 재현해 보였다.

내가 세어 보니 누락은 리뷰어가 지목한 `export … from` **하나가 아니라 다섯 형태**였다.
`NamedImports` 분기 하나만 보고 있었으니 default·namespace·side-effect·`export *`·
`import = require` 가 전부 빠져 있었다.

→ `valueEdgeToWebsocketService(st)` 헬퍼로 통합. 뮤테이션:

| 뮤턴트 | 결과 |
|---|---|
| **M7 `export … from` (리뷰어 프로브 그대로)** | **RED** |
| M8 `export * from` | RED |
| M9 namespace import (`* as`) | RED |
| M10 side-effect import | RED |
| M11 `import x = require()` | RED |
| N1 `import type` — **통과가 정답** (음성 대조) | GREEN |

기존 M1~M6 도 원복 후 baseline GREEN 재확인.

**동적 `import()` 는 일부러 세지 않는다.** 지연 평가라 모듈 스코프 평가 순서를 깨지 않으므로
이 가드가 막으려는 결함이 아니고, 넣으면 정당한 lazy loading 을 오탐한다. 반면 타입 모듈
자신(첫 테스트)은 간선이 **아예** 없어야 하므로 거기서는 센다. 이 비대칭은 의도이며 코드에
근거를 적어 두었다.

### W1 (maintainability) — `import type` 누락 3곳 · **반영**

`ExecutionChannelEvent` 는 순수 interface인데 3곳이 값 import 형태였다. 자매 파일
`interaction-stream.controller.ts:25` 는 올바른 형태라는 지적도 맞다 — 내 split 스크립트가
원본에 인라인 `type` 이 있을 때만 보존해서 생긴 비대칭이다.

컴파일·런타임 영향은 없지만, **이 PR 이 세운 원칙이자 새 가드의 판별 기준(`isTypeOnly`)**
이므로 신호를 흐리게 두면 안 된다. 3곳 모두 `import type` 으로 통일.

---

## INFO

| # | 처분 |
|---|---|
| 1 stale "바로 아래 KB union 문서" 주석 | **반영** — 그 KB union 은 이제 다른 파일에 있다. 파일-불변 표현으로 고치고 이동 사실을 명시 |
| 2 `10-graph-rag.md:552` canonical 위치 | **등재 확장** — `20_05_19` plan_coherence W1 이 이게 사례 하나뿐임을 지적. 실측해 **6곳**으로 확장 (아래) |
| 3 `TERMINAL_SHAPE` 모듈 스코프 부활 | **무조치** — 리뷰도 "순환 밖 확인·기록 목적" |
| 4 두 번째 테스트가 편도 검사 | **무조치** — 의도한 설계다. `EXPECTED_EXPORTS` 는 "간선 0" 이 공허해지지 않게 하는 하한이지 export 화이트리스트가 아니다 |
| 5 1,230 파일 파싱 성능 | **무조치** — 실측 약 1초 |

---

## `20_05_19` consistency (`--impl-done`) — **BLOCK: NO**

5 checker 전원 Critical 0. WARNING 1건이 실질적이었다.

### plan_coherence W1 — 부류가 아니라 사례 하나만 등재했다 · **반영**

`KbEventType` 정본 위치 stale 서술을 `10-graph-rag.md:552` **한 줄만** 등재했는데, 체커가
더 있다고 지적했고 실측하니 맞았다. **놓친 이유가 중요하다 — 같은 사실이 두 철자로 쓰여 있다:**

| 철자 | 곳 |
|---|---|
| `` `websocket.service.ts` 의 `KbEventType` `` (파일 경로) | 1 |
| `` `WebsocketService` 의 `KbEventType` `` (클래스명) | 4 |

내 grep 은 `websocket.service` 였으니 **클래스명 표기 4곳을 통째로 못 봤다.** 이 저장소에 이미
기록된 실패 형태다. 심볼(`KbEventType`) 기준 전수로 다시 세어 plan 후속에 6곳을 등재했고,
제외 판정한 3곳(언급만 하거나 취소선 이력)도 근거와 함께 적어 두었다.

### naming INFO7 — "개명은 별도 항목" 이라고 써 놓고 항목을 안 만들었다 · **반영**

`NotificationEventType` disambiguation JSDoc 에 "개명은 별도 항목" 이라고 적었는데,
`grep -rn "NotificationEventType" plan/` 하면 그 항목이 **없다**. 체커가 등재 여부 확인을
요구해서 발각됐다. 이 브랜치에서 반복된 "등재했다" 거짓의 또 한 사례라 실제로 등재했다.

나머지 INFO(§4.4 Rationale 후속 bullet, `3-execution.md` frontmatter `code:`,
`data-flow/0-overview.md:110` R10 인용)도 planner 턴 항목으로 등재.

---

## 검증

| 스테이지 | 결과 |
|---|---|
| lint | PASS (`--max-warnings 0`) |
| unit | PASS — backend **426 suites / 8741 tests** |
| build | PASS |
| e2e | PASS — 276 |
