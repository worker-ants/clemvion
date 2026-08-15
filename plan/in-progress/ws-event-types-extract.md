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
- [x] `websocket.service.ts` re-export — **값 4 + 타입 8** (`20_50_49` INFO7 이 "타입 9" 오기를
      지적. 파서로 재측정해 정정)
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

      **그리고 그 가드가 바로 그 실수를 저지르고 있었다** (`20_05_17` testing W2). 첫 판은
      세 번째 테스트만 `ts.isImportDeclaration` 으로 좁혀 놨다 — 커밋 메시지에 "한 칸 좁게
      잡는 것이 내 반복 실패 형태다" 라고 써 놓고 **같은 파일 안에서** 그걸 했다. 리뷰어가
      `export { ExecutionEventType } from '…/websocket.service'` 프로브로 4/4 GREEN(미검출)을
      실증했다. 세어 보니 누락은 그 하나가 아니라 **다섯 형태**였다:

      | 뮤턴트 | 결과 |
      |---|---|
      | **M7 `export … from` (리뷰어 프로브)** | **RED** |
      | M8 `export * from` | RED |
      | M9 namespace import (`* as`) | RED |
      | M10 side-effect import | RED |
      | M11 `import x = require()` | RED |
      | N1 `import type` — **통과가 정답**(음성 대조) | GREEN |

      동적 `import()` 는 일부러 뺐다 — 지연 평가라 모듈 스코프 순서를 깨지 않는다. 타입 모듈
      자신(첫 테스트)은 간선이 아예 없어야 하므로 거기선 센다. 비대칭은 의도다

      **3라운드(`20_27_08` W2)가 또 잡았다 — 이번엔 판별 기준 자체가 틀렸다.** `WebsocketService`
      예외를 **원 export 식별자가 아니라 로컬 별칭 이름**으로 비교하고 있었다. 양방향 실측:

      | 뮤턴트 | 결과 |
      |---|---|
      | **M12 `ExecutionEventType as WebsocketService`** (FN — 재발 그 자체) | **RED** (고치기 전 GREEN) |
      | M13 `export { ExecutionEventType as Anything } from` (별칭 세탁) | RED |
      | M14 타입 전용 심볼을 `type` 없이 import (5번째 테스트) | RED |
      | N2 `WebsocketService as WS9` — **통과가 정답** (FP 대조) | GREEN (고치기 전 RED) |
      | N3 같은 심볼을 `type` 으로 — **통과가 정답** | GREEN |

      `(el.propertyName ?? el.name).text` 로 교정. `export … from` 분기에 `WebsocketService`
      예외를 **두지 않은 것은 의도**다 — import 쪽 예외는 "주입하려면 클래스를 import 할 수밖에
      없다" 는 DI 의 불가피함 때문인데, 재-수출은 불가피하지 않고 오히려 제3 모듈에 우회 경로를
      만들어 이 가드를 무력화한다

- [x] **`import type` 미표시를 부류로 고정** — 리뷰 2·3라운드가 연속으로 같은 지적을 냈다
      (`20_05_17` W1 3곳 → `20_27_08` W1 4곳). 지목된 곳만 고치면 네 번째가 온다.
      실측하니 리뷰어 목록(3파일·4심볼)보다 넓은 **5문장**이었고 spec 2곳이 빠져 있었다.
      다섯 번째 테스트로 부류를 고정한다 — 값/타입 명단은 하드코딩하지 않고 **타입 모듈을
      파싱해서** 얻으므로 선언이 늘어도 손으로 맞출 필요가 없다.
      이건 스타일 문제가 아니다: 세 번째 테스트의 판별 기준이 `isTypeOnly` 라 표시가 빠지면
      **가드의 신호 자체가 흐려진다**

- [x] **네 번째 재발에서 패치를 멈추고 구조를 고쳤다** (`20_50_49` W1). 이번엔 `require()`
      미검출이었고, 리뷰어가 프로브로 5/5 GREEN 을 재현했다. 형태별로 세면
      `export … from` → 별칭 → `require()` 로 **네 라운드 연속** 같은 실패 모드다.

      원인은 그 형태들이 아니라 **열거가 두 벌이었다는 것**이다 — 완전한 `moduleSpecifiersOf`
      와 손으로 다시 짠 좁은 `valueEdgeToWebsocketService`. 후자가 매 라운드 새 형태를 놓쳤다.
      다섯 번째를 기다리지 않고 `moduleRefs` **하나**로 합쳤다. 각 테스트는 그 결과를 거르기만
      한다.

      동시에 **판별 기준을 형태 목록에서 의미로 바꿨다** — "즉시 해석되는가(eager)". 그래야
      새 문법이 생겨도 답이 정해진다:

      | 형태 | 판정 |
      |---|---|
      | `import` · `export … from` · `import x = require()` · **top-level `require()`** | eager |
      | 함수 본문 안 `require()` · 동적 `import()` | **lazy — 결함 아님** |

      lazy 를 결함으로 세면 정당한 지연 로드를 오탐한다(저장소에 선례가 있다).
      단 타입 모듈 자신은 어떤 형태로도 간선이 없어야 하므로 거기서는 lazy 도 센다.

      **재구성이 예전 커버리지를 깼는지 확인하려고 전 뮤턴트를 다시 돌렸다** — 17 RED / 5 GREEN:

      | | 뮤턴트 |
      |---|---|
      | 타입 모듈 자신 | M1 import · M2 `export…from` · M3 동적 import · **M15 함수 안 require** |
      | 선언 이동 | M4 개명 |
      | 값 간선 | M7 `export…from` · M8 `export *` · M9 namespace · M10 side-effect · M11 `import=require` · M12 FN 별칭 · M13 별칭 세탁 재수출 · **M16 top-level require 구조분해** · **M17 require 별칭 세탁** · **M18 bare require** |
      | 타입 표시 | M14 |
      | allowlist | M6 |
      | **음성 대조(GREEN 이 정답)** | N1 `import type` · N2 `WebsocketService` 별칭 · N3 인라인 type · **N4 함수 안 require** · **N5 동적 import** |

- [x] **5라운드(`21_14_51` W1) — 이번엔 오탐이었고, 원인은 내 대조군이었다.**
      `import { type Foo } from '…'`(인라인 태그)을 값 간선으로 오탐했다. `value` 를 **선언
      레벨** `isTypeOnly` 로만 계산해서 두 상황이 뭉뚱그려진 탓이다:

      | 상황 | 선언 `isTypeOnly` | 값 이름 수 | 옳은 판정 |
      |---|---|---|---|
      | `import { type Foo }` | false | 0 | 간선 **없음** |
      | `import './x'` · default · `* as` | false | 0 | 간선 **있음** |

      `leavesValueEdge()` 로 세 상태를 갈랐다.

      > **안 잡힌 이유는 대조군이 좁아서다.** N1 은 선언 레벨 `import type` 만 봤다.
      > **뮤턴트는 계속 넓히면서 대조군은 안 넓혔다** — 오탐은 뮤턴트가 아니라 대조군이
      > 잡는 것인데. 이번엔 대조군을 뮤턴트만큼 넓혔다: **19 RED / 9 GREEN**
      > (추가 뮤턴트 M19 타입모듈 `import type` · M20 값+타입 혼합,
      > 추가 대조 N6 인라인 · N7 인라인 여럿 · N8 `export type … from` · N9 `export { type … }`)

- [x] **6라운드(`21_49_51` W1) — 내 FP 수정이 새 FN 을 만들었다.**
      `import Def, { type Bar } from '…'` 이 "네임드 있음 + 값 이름 0" 이라 통과했다(미검출).
      5라운드에서 인라인 `type` 오탐을 고치며 도입한 판정이 default 바인딩을 안 봤기 때문이다.

      > **조건을 하나씩 덧대는 한 이 진자(FN↔FP)는 멈추지 않는다.** 그래서 이번엔 넓히지 않고
      > **소진했다** — `ImportClause` 는 부분이 셋뿐이다(clause 부재 · default `name` ·
      > `namedBindings`). 유한하므로 전수로 훑을 수 있고, 훑고 나면 새 경우가 생기려면 **TS 문법이
      > 바뀌어야 한다.**

      `importLeavesValueEdge` / `exportLeavesValueEdge` 로 소진. INFO1(두 분기 로직 중복)도 같이
      닫혔다 — 공통부는 `namedBindingValueNames` 하나.

      소진이 실제로 완전한지 **형태별 전수 뮤테이션 20 RED / 8 GREEN**:

      | 축 | 뮤턴트 | 음성 대조 |
      |---|---|---|
      | `ImportClause` 전수 | clause 부재 · default 단독 · **default+전부type(M21)** · default+값named · default+namespace · namespace 단독 · 값named 단독 | 선언 `import type` · 인라인 단독 · 인라인 여럿 · `WebsocketService` 네임드 |
      | `export … from` | `export *` · `export * as ns` · 값 named · `export { WebsocketService }` | `export type … from` · `export { type … }` |
      | require/동적 | top-level require 구조분해 · `import = require` | 함수 안 require · 동적 import |
      | 타입 모듈·표시 | 타입모듈 import · 타입모듈 함수 안 require · 타입 전용을 `type` 없이 | — |
      | **새 캐너리** | 타입모듈 `export default` · 서비스 `export default` · `export` 키워드 제거 · allowlist 죽은 경로 | — |

- [x] **`export default` 없음 전제를 캐너리로** (`21_49_51` W1 제안) — 세 번째 테스트의
      `WebsocketService` 예외는 네임드 바인딩만 면제하므로, 대상 모듈에 default export 가 생기면
      `import Anything from '…'` 이 새 우회로가 된다. 전제가 깨지면 즉시 RED
- [x] **선언 "존재" 가 아니라 `export` 여부까지** (`21_49_51` INFO4) — `ts.getModifiers` 로 확인

## 수렴 판정 (6라운드)

| 라운드 | 발견 | 성격 |
|---|---|---|
| `19_27_37` | gateway 가 순환에서 안 빠졌다 | **제품 코드** |
| `20_05_17` | 가드가 `export … from` 미검출 | 가드 FN |
| `20_27_08` | 가드가 별칭으로 예외 오판정 | 가드 FN |
| `20_50_49` | 가드가 `require()` 미검출 → **열거 통합** | 가드 FN |
| `21_14_51` | 가드가 인라인 `type` 오탐 → **대조군 확장** | 가드 FP |
| `21_49_51` | 가드가 default 바인딩 미인식 → **형태 소진** | 가드 FN (내 FP 수정의 부산물) |

제품 코드 결함은 1라운드가 마지막이다. 이후 다섯은 전부 가드 자신이고, 세 번의 구조 조치
(열거 통합 → 대조군 확장 → **형태 소진**)를 거쳤다.

**이번 조치가 앞선 둘과 다른 점**: 앞의 둘은 커버리지를 *넓힌* 것이라 "또 뭔가 빠졌을 수 있다" 가
남았지만, 이번은 **유한한 AST 형태를 전수로 소진**했다. 같은 축에서 더 나올 형태가 없다는 것이
문법상 보장된다.

가드 스위트를 이 PR 에 함께 넣는 것은 **사용자 명시 승인**을 받았다 (`21_14_51` INFO6 이
정책 판단을 요구).

## 체크리스트

- [x] `--impl-prep` (`18_53_27`) **BLOCK: NO** — WARNING 3 + INFO 1 전부 반영
- [x] 자매 트래커 동시 갱신 (구현 커밋과 같은 턴)
- [x] TEST WORKFLOW 4스테이지 — lint / unit(백엔드 425·8737) / build / **e2e 276** 전부 PASS
- [x] `/ai-review` **7라운드** — `19_27_37` → `20_05_17` → `20_27_08` → `20_50_49` →
      `21_14_51` → `21_49_51` → **`22_13_48` Critical 0 · Warning 0 (수렴)**.
      각 라운드 `RESOLUTION.md` 작성
- [x] `--impl-done` (`20_05_19`) **BLOCK: NO** — plan_coherence W1 + naming INFO7 반영
- [ ] push 게이트 통과 → PR

## 후속 (이 PR 범위 밖)

### planner 턴 — 이동한 심볼의 "정본 위치" 서술 stale (전수)

처음엔 `10-graph-rag.md:552` **한 줄만** 등재했다. `20_05_19` plan_coherence W1 이 그게
사례 하나일 뿐이라고 지적했고, 실측하니 맞았다. **놓친 이유가 중요하다 — 같은 사실이 두 철자로
쓰여 있었다**:

| 철자 | 곳 |
|---|---|
| `` `websocket.service.ts` 의 `KbEventType` `` (파일 경로) | 1 |
| `` `WebsocketService` 의 `KbEventType` `` (클래스명) | 4 |

내 grep 은 `websocket.service` 였으니 **클래스명 표기 4곳을 통째로 못 봤다.** 이 저장소에 이미
기록된 실패다 — 한 철자만 보면 다른 표현을 놓친다. 그래서 아래는 심볼(`KbEventType`) 기준 전수다.

- [ ] `spec/5-system/10-graph-rag.md:552` — "`websocket.service.ts` 의 `KbEventType` union"
- [ ] `spec/5-system/8-embedding-pipeline.md:276` — "backend 권위 정의는 `WebsocketService`"
- [ ] `spec/5-system/6-websocket-protocol.md:740` — 동일 문구
- [ ] `spec/5-system/6-websocket-protocol.md:1034` — **부분만 stale**. `WebsocketService.emitKbEvent`
      는 여전히 맞다(메서드는 안 옮겼다). union 의 소재만 갱신 대상
- [ ] `spec/data-flow/6-knowledge-base.md:288` — "`WebsocketService` 의 `KbEventType` union"
- [ ] `spec/data-flow/0-overview.md:110` — "`websocket.service.ts` 헤더 주석, EIA §R10" 인용.
      R10 문구는 `websocket-events.types.ts:26` 으로 이관됐다 (`20_05_19` cross_spec INFO1)

> 제외 판정한 것도 적어 둔다 — `8-embedding-pipeline.md:285`·`:411`,
> `data-flow/6-knowledge-base.md:416` 은 union 을 **언급만** 하거나 취소선 이력이라 위치 주장이
> 아니다. re-export 가 살아 있으므로 위 문장들도 **거짓은 아니고**, 정본 소재만 낡았다.

### 그 밖

- [ ] **`NotificationEventType` 개명** — `triggers/dto/notification-config.dto.ts` 의 동명 타입과
      충돌한다. 이번엔 disambiguation JSDoc 으로 막았고 그 주석에 "개명은 별도 항목" 이라고 썼는데,
      **정작 그 항목을 만들지 않았다** (`20_05_19` naming INFO7 이 등재 여부 확인을 요구해 발각).
      이 브랜치에서 반복된 "등재했다" 거짓의 또 한 사례라 여기 실제로 등재한다
- [ ] `spec/3-workflow-editor/3-execution.md` frontmatter `code:` 에
      `websocket-events.types.ts` 등재 — `NodeEventType` 을 인용하면서 자매 spec
      (`6-websocket-protocol.md`)과 비대칭 (`20_05_19` cross_spec INFO2)
- [ ] `spec/5-system/4-execution-engine.md` §4.4 Rationale 에 이번 추출로 **순환 참여자 집합이
      축소**됐다는 후속 한 줄 (`20_05_19` rationale INFO4). 봉인 기법·단일 sink 정책 자체는 불변
- [ ] `TerminalErrorPayload` 를 채우는 호출부의 `sanitizeErrorMessage` 경유 여부 전수 확인
      (`19_27_37` INFO2 — 기존 설계이고 이번 diff 와 무관)
- [ ] **export-default 캐너리가 `export { X as default } from` 별칭을 못 본다**
      (`22_13_48` INFO2). **방어는 완전하고 캐너리만 좁다** — 진짜 방어선인 세 번째 테스트가
      `import D from '…'` 를 default 바인딩 값 간선으로 잡는다(형태별 뮤테이션 "default 단독"
      RED 로 실증). 자기점검의 완전성만 남은 문제라 라운드를 하나 더 도는 값을 못 한다
- [ ] `ts.getModifiers(st as ts.HasModifiers)` → `ts.canHaveModifiers(st)` 가드
      (`22_13_48` INFO3 — 순수 스타일, 런타임 위험 없음)

> **CHANGELOG 항목은 불필요하다 — 다만 근거를 정정한다** (`22_13_48` INFO1). 이전 리뷰
> 3라운드가 "이 저장소는 `CHANGELOG.md` 를 쓰지 않는다" 를 근거로 써 왔는데 거짓이다
> (1,137줄 활성, 선행 커밋 `8e0728a90` 도 갱신). 실측하면 `## Unreleased` **85건이 전부 행동
> 변화**이고 순수 내부 리팩터 항목은 0건이다. 즉 불필요한 진짜 이유는 **이 PR 에 행동 변화가
> 0** 이라서다. 결론이 맞다고 근거까지 맞은 건 아니었다.
