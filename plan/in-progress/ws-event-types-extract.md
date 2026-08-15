---
worktree: eia-r8-cache-scope-4ae434
started: 2026-08-15
owner: developer
branch: claude/ws-event-types-extract
spec_impact: none
---

# `websocket.service` 의 런타임 값을 의존성-프리 모듈로 분리

## 다른 plan 과의 관계

정본 트래커는 [`spec-sync-external-interaction-api-gaps.md`](./spec-sync-external-interaction-api-gaps.md)
이고, 이 작업은 그 문서의
*"`websocket.service` 가 값(enum)과 서비스를 함께 export 해 순환을 만든다"* 항목
(2026-08-15 등재, `17_54_32` architecture W7) 을 집행한다. **구현 커밋과 같은 턴에 양쪽을 닫는다.**

## 왜 — 이건 이론이 아니다

직전 PR(#1174)이 `type` → 이벤트명 매핑을 **모듈 스코프 상수**로 뒀더니
**72 suites 가 `Cannot read properties of undefined` 로 터졌다.** `ExecutionEventType` 이
모듈 평가 시점에 아직 `undefined` 였기 때문이다 —
`websocket.service ↔ websocket.gateway ↔ execution-engine/retry-turn ↔ event-emitter`
ES-module 순환 위에 있어서다. 생성자의 `forwardRef` 도 같은 이유로 있다.

그때는 **호출 시점 지연 평가**로 우회했다. 근본 원인은 남았고, `tsc` 는 이 클래스를 못 잡는다.

### §4.4 가 유예한 것과 이건 다른 층위다 (`18_53_27` rationale_continuity W1)

[`4-execution-engine.md` §4.4](../../spec/5-system/4-execution-engine.md) Rationale(PR #638)이
이 순환을 명시적으로 다룬다:

> *"위 순환 자체를 **이벤트 기반 디커플링 등으로 근본 축소**하는 것은 별도 대규모 리팩터링
> backlog 다 — 현재는 두 기법(`forwardRef`/`ModuleRef strict:false`)으로 **봉인**한 상태를
> 유지한다."*

**유예된 것은 DI 순환의 근본 축소**(이벤트 기반 디커플링)다. 이 작업은 그게 아니다:

| | §4.4 가 유예한 것 | 이 작업 |
|---|---|---|
| 대상 | **DI 그래프** (주입 관계) | **ES-module 값 평가 순서** |
| 수단 | 이벤트 기반 디커플링 | 값/타입 선언을 의존성-프리 모듈로 이동 |
| `forwardRef` | 제거 대상 | **불변** (건드리지 않는다) |
| emit 경로 | — | **불변** — §4.4 "단일 sink" 정책 그대로 |

즉 **봉인 기법을 대체하지 않는 보완 조치**다. 이동하는 것은 값/타입 정의뿐이고 emit 경로는
하나도 안 바꾼다 — 후속 리뷰가 "sink 분리 시도" 로 오탐하지 않도록 여기 적어 둔다.

## 실측

`websocket.service` 를 import 하는 **25 곳**:

| 무엇을 가져가나 | 곳 |
|---|---|
| **타입/enum 만** (서비스 없이) | **12** |
| `WebsocketService` 포함 | 13 |

그리고 **선언 블록(`:6`~`:340`)은 파일의 import 를 하나도 쓰지 않는다** — `Injectable`·
`Logger`·`Observable`·`Subject`·`WebsocketGateway`·`ExecutionSeqAllocator`·
`stripExternalOnlyFields` 전부 **0회**. 즉 의존성-프리 모듈로 **그대로** 옮길 수 있다.

타입만 가져가는 12곳이 정확히 순환 위의 파일들이다 — `execution-engine.service` ·
`retry-turn.service` · `ai-turn-orchestrator` · `form/button-interaction` ·
`external-interaction` 3곳 · `ai-turn-executor` 등.

## 조치

- [x] `websocket-events.types.ts` 신설 — **import 0줄 · 구현 0개** (실측)
- [x] `websocket.service.ts` re-export (값 4 + 타입 9)
- [x] 타입만 쓰는 12곳 전환 — **그리고 그것만으로는 안 끊겼다.** 정작 버그가 났던
      `event-emitter` 는 `WebsocketService` 도 주입받아 내 규칙이 건너뛰었다.
      **둘 다 필요한 9곳의 import 를 갈라야** 했다
- [x] 실측 — import 문 **25 → 13**. ~~타입만 가져가는 곳 **0**~~ → **이 숫자가 틀렸다**.
      TS 파서 전수(1,230 파일) 재측정 결과 **1곳**이며, 그건 re-export facade 를 검증하는
      `websocket.service.spec.ts` 라 의도된 커버리지다. 아래 ③ 참조
- [x] **역재현** — 12곳만 옮긴 뒤 **66 suites 실패**(안 끊김) → 9곳 가른 뒤 **425/425 통과**.
      이 실증이 없었으면 "고쳤다" 로 넘어갔다. 우회를 되돌려 모듈 스코프 파생을 **캐너리**로 남겼다
- [x] **하위 라인 인용 재확인** (`18_53_27` plan_coherence W2) — in-progress 3곳 심볼 기준 전환 —
      `websocket.service.ts:<line>` 를 **절대 라인 번호로** 인용하는 다른 3개 in-progress plan
      (`node-output-redesign/background.md` · `spec-draft-eia-62-waiting-payload.md` ·
      `spec-draft-eia-notification-payload-contract.md`)이 이 이동으로 조용히 stale 해진다.
      `grep -rn 'websocket\.service\.ts:' plan/ spec/` 로 전수 확인하고 **심볼 기준**으로 갱신
      (이 저장소가 이미 기록한 교훈 — 라인 인용은 리팩터마다 stale 해진다)
- [x] **`NotificationEventType` disambiguation JSDoc** (`18_53_27` naming W3) —
      `triggers/dto/notification-config.dto.ts` 에 **같은 이름의 다른 타입**이 이미 있다
      (WS 인앱 알림 벨 enum vs webhook 구독 화이트리스트). 이름이 "이벤트 타입 정본" 처럼
      보이는 공유 모듈로 옮기면 오import 위험이 커지므로 선언 위에 구분 주석을 단다
- [x] `6-websocket-protocol.md` frontmatter `code:` 등재 (`18_53_27` INFO4)

## 이 리팩터의 검증 가능성

**`tsc` 가 전수 검사한다.** import 경로를 옮기면 빠뜨린 곳은 컴파일이 깨진다. 그리고
72 suites 사고의 **역재현**이 가능하다 — 분리 후 `event-emitter` 에서 매핑을 다시 모듈
스코프로 올려도 터지지 않아야 한다. 그게 이 작업의 성공 기준이다.

## 범위 밖

- `WebsocketService` 자체의 책임 분리 — 이번은 **값/타입만** 떼어낸다
- `forwardRef` 제거 — 순환이 끊겼는지 확인한 뒤 별도 판단(성급히 빼면 다른 경로가 남았을 때 터진다)

## 구현 중 잡은 것 — 내 실측이 두 번 불완전했다

**① "선언 블록은 파일의 import 를 안 쓴다" 는 반쪽이었다.** 그건 확인했는데 **클래스 본문이
그 블록의 비-export 헬퍼를 쓰는지**는 안 봤다 — `sanitizePayloadForWs` 등 5개가 딸려 가
컴파일이 깨졌다. 구현 세부는 서비스에 남기고 타입 모듈은 **export 된 값·타입만** 갖는다.

**② 이동 규칙 "서비스를 쓰면 제외" 가 너무 거칠었다.** 정작 72 suites 를 터뜨렸던
`event-emitter` 가 그 규칙에 걸려 제외됐고, 역재현이 **66 suites 실패**로 그걸 드러냈다.
둘 다 필요한 파일은 import 를 갈라야 한다 — 그런 파일이 9곳이었다.

> **역재현을 성공 기준으로 미리 정해 둔 것이 이 작업을 구했다.** 안 했으면 "12곳 옮겼고
> 타입이 통과한다" 로 끝냈을 것이고, 순환은 그대로였을 것이다.

**③ 그런데 역재현도 다 못 잡았다 — 리뷰(`19_27_37` W1)가 나머지를 찾았다.** 같은 스크립트에
제외 규칙이 **두 개** 있었다. ② 는 `"WebsocketService" in names → skip`, ③ 은
`f.name.startswith("websocket.") → skip` 이다. 후자가 **`websocket.gateway.ts` 를 통째로**
들어냈는데, gateway 는 `websocket.service` 와 **직접 2-노드 순환**을 이루는 당사자다
(`websocket.service.ts:3` → gateway, `websocket.gateway.ts:23` → service).

역재현이 이걸 못 잡은 이유는 gateway 의 사용처가 함수 본문 안(`:400`)이라 **지연 평가**되기
때문이다. 즉 오늘 안 터진 것이지 끊긴 것이 아니었다.

> **더 나쁜 건 내 검증이었다.** "타입만 가져가는 곳 0" 이라고 쓴 grep 이 **편집 스크립트와
> 똑같은 제외를 물려받았다** — 안 옮긴 파일을 세지 않는 자로 "다 옮겼다" 를 재고 있었다.
> 검증 쿼리가 편집 규칙의 제외를 상속하면 그 제외는 **영원히 관측되지 않는다.**
> 그래서 재측정은 grep 이 아니라 **TS 파서로 1,230 파일 전수**로 했다.

- [x] `websocket.gateway.ts` 의 `ExecutionEventType` 를 `websocket-events.types` 로 전환
- [x] **불변식을 이름 있는 테스트로 고정** — `websocket-events.types.spec.ts` (4 tests).
      `^import` 만 세지 않는다: `export … from` · `import = require` · 동적 `import()` ·
      `require()` 까지 **TS 파서로** 센다(모듈 간선은 그 다섯으로 생긴다). 여기서 한 칸 좁게
      잡는 것이 이 저장소에 반복 기록된 내 실패 형태다.
      뮤테이션 6/6 RED — 그중 **M5 는 W1 결함 상태 그대로의 재현**이다:

      | 뮤턴트 | 결과 |
      |---|---|
      | M1 평범한 `import` 추가 | RED |
      | M2 `export … from` 추가 (`^import` 로는 안 잡힘) | RED |
      | M3 동적 `import()` 추가 | RED |
      | M4 선언 하나 개명 (간선 0 이 공허해지는 경로) | RED |
      | **M5 gateway import 를 결함 상태로 되돌림** | **RED** |
      | M6 allowlist 를 죽은 경로로 (예외가 공짜가 되는 경로) | RED |

## 체크리스트

- [x] `--impl-prep` (`18_53_27`) **BLOCK: NO** — WARNING 3 + INFO 1 전부 반영
- [x] 자매 트래커 동시 갱신 (구현 커밋과 같은 턴)
- [x] TEST WORKFLOW 4스테이지 — lint / unit(백엔드 425·8737) / build / **e2e 276** 전부 PASS
- [x] `/ai-review` (`19_27_37`) **CRITICAL 0** · Warning 5 전부 반영 → `RESOLUTION.md`
- [ ] fresh `/ai-review` (fix 이후)
- [ ] `--impl-done` BLOCK: NO
- [ ] push 게이트 통과 → PR

## 후속 (이 PR 범위 밖)

- [ ] **planner 턴** — `spec/5-system/10-graph-rag.md:552` 가 `KbEventType` 정본 선언 위치를
      아직 `websocket.service.ts` 로 서술한다. re-export 덕에 문장 자체는 참이지만 정본은
      `websocket-events.types.ts` 로 옮겨졌다. spec 본문은 developer 권한 밖이라 별도 턴
      (`19_27_37` INFO1 · `18_53_27` consistency 도 동일 항목을 자체 식별)
- [ ] `TerminalErrorPayload` 를 채우는 호출부의 `sanitizeErrorMessage` 경유 여부 전수 확인
      (`19_27_37` INFO2 — 기존 설계이고 이번 diff 와 무관)
