# RESOLUTION — `21_14_51` (branch `claude/ws-event-types-extract`)

Critical **0** · Warning **1** · INFO 12. Warning 반영, INFO 2건 반영.

---

## Warning (requirement) — 인라인 `type` 태그를 값 간선으로 오탐 · **반영**

지적이 옳다. 무수정 프로브로 재현했다:

```ts
import { type ExecutionChannelEvent as Q1 } from '../websocket/websocket.service';
```
→ `modules/chat-channel/chat-channel.dispatcher.ts → import (no names)` 로 offender 판정.

원인은 `value` 를 **선언 레벨** `isTypeOnly` 로만 계산한 것이다. 그러면 두 상황이 구분되지 않는다:

| 상황 | 선언 `isTypeOnly` | 값 이름 수 | 옳은 판정 |
|---|---|---|---|
| `import { type Foo }` | false | 0 | 간선 **없음** |
| `import './x'` · `import X from` · `import * as X` | false | 0 | 간선 **있음** |

둘 다 "false + 0" 이라 뭉뚱그려졌다. `leavesValueEdge(declTypeOnly, hasNamedBindings, valueNameCount)`
로 **세 상태**를 가르도록 정정. import·export 양 분기 모두 적용.

리뷰어가 짚은 자기모순도 그대로다 — 세 번째 테스트는 이 형태를 offender 로 잡는데 다섯 번째
테스트는 **바로 그 스타일을 권장**하고 있었다.

### 진짜 교훈은 대조군이었다

이번 결함이 안 잡힌 이유는 **내 음성 대조가 좁았기 때문**이다. N1 은 선언 레벨
`import type { … }` 만 확인했고 인라인 태그는 보지 않았다. **뮤턴트는 계속 넓히면서 대조군은
안 넓혔다** — 오탐은 뮤턴트가 아니라 대조군이 잡는 것인데.

그래서 이번엔 대조군을 뮤턴트만큼 넓혔다. 결과 **뮤턴트 19 RED / 음성 대조 9 GREEN**:

| | |
|---|---|
| 타입 모듈 자신 | M1 import · M2 `export…from` · M3 동적 import · M15 함수 안 require · **M19 `import type`**(타입 모듈엔 타입 간선도 금지) |
| 선언 이동 | M4 개명 |
| 값 간선 | M7·M8·M9·M10·M11 · M12 FN 별칭 · M13 별칭 세탁 재수출 · M16 require 구조분해 · M17 require 별칭 세탁 · M18 bare require · **M20 값+타입 혼합** |
| 타입 표시 | M14 |
| allowlist | M6 |
| **음성 대조 (GREEN 이 정답)** | N1 선언 레벨 `import type` · **N6 인라인 `type`** · **N7 인라인 여럿** · **N8 `export type … from`** · **N9 `export { type … }`** · N2 `WebsocketService` 별칭 · N3 인라인 type(types 모듈) · N4 함수 안 require · N5 동적 import |

M20 이 경계도 고정한다 — 한 문장에 값과 타입이 섞이면 **값이 하나라도 있으므로** 간선이다.

---

## INFO

| # | 처분 |
|---|---|
| 8 `SERVICE_MODULE`/`EVENT_MODULES` 무주석 | **반영** — 두 상수에 근거 주석. `EVENT_MODULES` 가 `websocket.service` 도 매치하는 이유(re-export 경유 import 도 같은 규칙)를 명시 |
| 3 `TERMINAL_SHAPE` 리네이밍 제안 | **무조치** — `TERMINAL_TYPE_TO_WIRE_SHAPE` 는 더 길기만 하다. 바로 위 JSDoc 첫 줄이 이미 "`type` → wire 이벤트명·`status`" 로 정확히 그 말을 한다 |
| 6 가드 스위트 스코프 (318줄) | **사용자 승인 획득** — 아래 |
| 7 `no-restricted-imports` 승격 | 무조치(후속) — 뮤테이션으로 실효를 실증했다 |
| 9 `originalName`/`destructuredKeys` 개념 중복 | 무조치 — 리뷰도 "중복 비용 낮음" |
| 10 mock `as unknown as` | 범위 밖 — 저장소 전반 컨벤션 |
| 11 `error` 새니타이징 | 등재됨 (plan 후속) |
| 1·2·4·5·12 | 확인용 기록 |

### INFO 6 — 정책 판단은 사용자에게 물었다

리뷰가 "병합 전 사람 리뷰어가 명시 승인 권장" 이라고 한 항목이라 내가 결정하지 않고 물었다.
**답: 현재대로 함께 머지.**

근거로 제시한 것 — 이 가드는 임의로 자란 게 아니라 **리뷰가 매 라운드 찾아낸 실제 결함에
대응하며** 자랐고, 그 결함들이 전부 이 PR 의 불변식(순환 재편입 금지)을 겨냥한다. M12(별칭
FN)·M17(require 세탁)처럼 **가드 없이는 조용히 통과할 경로**를 19 뮤턴트로 고정했다.

---

## 5라운드 수렴 판정

발견의 성격이 이렇게 이동했다:

| 라운드 | 발견 |
|---|---|
| `19_27_37` | **제품 코드** — gateway 가 순환에서 안 빠졌다 |
| `20_05_17` | 가드가 `export … from` 미검출 |
| `20_27_08` | 가드가 별칭으로 예외 오판정 (FN) |
| `20_50_49` | 가드가 `require()` 미검출 → **구조 통합** |
| `21_14_51` | 가드가 인라인 `type` 오탐 (FP) → **대조군 확장** |

제품 코드 결함은 1라운드가 마지막이고, 이후 넷은 전부 가드 자신이다. 그리고 4라운드에서
열거를 하나로 합친 뒤 5라운드 발견은 **미검출(FN)이 아니라 오탐(FP)** 으로 성격이 뒤집혔다 —
구조 통합이 실제로 효과가 있었다는 신호다.

---

## 검증

| 스테이지 | 결과 |
|---|---|
| lint | PASS (`--max-warnings 0`) |
| unit | PASS — backend **426 suites / 8742 tests** |
| build | PASS |
| e2e | PASS — 276 |
