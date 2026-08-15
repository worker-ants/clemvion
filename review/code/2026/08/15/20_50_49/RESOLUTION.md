# RESOLUTION — `20_50_49` (branch `claude/ws-event-types-extract`)

Critical **0** · Warning **1** · INFO 14. Warning 반영, INFO 3건 반영.

---

## Warning (testing) — `require()` 미검출 · **반영하되 네 번째 패치가 아니라 구조 변경으로**

리뷰어가 프로브(`const { ExecutionEventType } = require('…/websocket.service')`)로
**5/5 GREEN — 미검출**을 재현했다. 지적이 맞다.

리뷰어가 붙인 한 문장이 이번 처분을 갈랐다:

> `import`/`export from`/별칭 오판정에 이어 **4번째로 재발**한 "식별 기준을 한 칸 좁게 잡은" 결함.

맞다. 그리고 **네 번 같은 자리에서 재발했다면 고칠 것은 그 형태가 아니라 구조다.**
`require` 분기 하나를 더 붙이면 다섯 번째가 온다.

### 진짜 원인 — 간선 열거가 두 벌이었다

| 함수 | 성격 | 쓰는 곳 |
|---|---|---|
| `moduleSpecifiersOf` | 완전 (다섯 형태) | 첫 번째 테스트 |
| `valueEdgeToWebsocketService` | **손으로 다시 짠 좁은 판** | 세 번째 테스트 |

리뷰가 매 라운드 찾아낸 건 전부 후자가 놓친 형태였다. 리뷰어의 제안("`moduleSpecifiersOf` 의
분기를 공유/재사용")이 정확히 이 지점을 짚었고, 그대로 따랐다 — 둘을 `moduleRefs` **하나**로
합쳤다. 각 테스트는 그 결과를 **거르기만** 한다. 새 문법이 생겨도 고칠 곳은 한 곳이다.

### 그리고 판별 기준을 형태 목록에서 **의미**로 바꿨다

형태를 나열하는 한 목록은 계속 낡는다. 이 가드가 막는 건 "모듈 평가 시점에 아직 안 채워진 값을
읽는 것" 이므로, 물어야 할 것은 **즉시 해석되는가(eager)** 다:

| 형태 | 판정 |
|---|---|
| `import` · `export … from` · `import x = require()` · **top-level `require()`** | eager |
| 함수 본문 안 `require()` · 동적 `import()` | **lazy — 결함 아님** |

lazy 를 결함으로 세면 정당한 지연 로드를 오탐한다. 리뷰어가 선례로 든
`bootstrap/undici-dispatcher.spec.ts:32` 를 열어 보니 **함수 본문 안**의 `require` 였다 —
즉 그 선례는 "위험하다" 가 아니라 "여기서 오탐하면 안 된다" 는 근거다. 그래서 `insideFunction`
으로 갈랐다.

단 **타입 모듈 자신**은 어떤 형태로도 간선이 없어야 하므로 거기서는 lazy 도 센다.

### 재구성이 예전 커버리지를 깼는지 — 전 뮤턴트 재실행

**17 RED / 5 GREEN**, 원복 후 baseline GREEN.

| | 뮤턴트 |
|---|---|
| 타입 모듈 자신 | M1 import · M2 `export…from` · M3 동적 import · **M15 함수 안 require** |
| 선언 이동 | M4 개명 |
| 값 간선 | M7 `export…from` · M8 `export *` · M9 namespace · M10 side-effect · M11 `import=require` · M12 FN 별칭 · M13 별칭 세탁 재수출 · **M16 top-level require 구조분해** · **M17 require 별칭 세탁** · **M18 bare require** |
| 타입 표시 | M14 |
| allowlist | M6 |
| **음성 대조 (GREEN 이 정답)** | N1 `import type` · N2 `WebsocketService` 별칭 · N3 인라인 type · **N4 함수 안 require** · **N5 동적 import** |

M16/M17/M18 이 이번 지적을 닫고, N4/N5 가 **과잉 방어가 아님**을 고정한다. M17 은 리뷰어가
지목하지 않았지만 별칭 세탁이 `require` 쪽에도 있으므로 함께 막았다(구조분해 프로퍼티 키 기준).

---

## INFO

| # | 처분 |
|---|---|
| 7 plan 의 "타입 9" 오기 | **반영** — 파서로 재측정: 값 4 + **타입 8**. plan 정정 |
| 11 `originalName` 이 2곳 중복 | **반영** — 모듈 스코프 함수로 승격, 두 지점이 공유 |
| 12 파일 순회 boilerplate 중복 | **반영** — `collectOffenders(probe)` 로 추출 |
| 13 공허 방지 단언이 `toBeGreaterThan(N-1)` | **반영** — `toBeGreaterThanOrEqual(N)` |
| 3 `error` 새니타이징 전수 | 등재됨 (plan 후속, 기존 설계) |
| 5 re-export 3중 수동 동기화 | 무조치 — `tsc` fail-closed. barrel 단일화는 다섯 번째 테스트의 판별을 흐린다 |
| 6 lint 계층 승격 | 무조치(후속 검토) — 뮤테이션으로 실효를 실증했다. 유한한 문제를 무한한 문제와 바꾸지 않는다 |
| 10 `TERMINAL_SHAPE` 전제 의존 | 무조치 — 리뷰도 "위 WARNING 해소가 실질 방어선" 으로 결론 |
| 1·2·4·8·9·14 | 확인용 기록, 조치 없음 |

---

## 검증

| 스테이지 | 결과 |
|---|---|
| lint | PASS (`--max-warnings 0`) |
| unit | PASS — backend **426 suites / 8742 tests** |
| build | PASS |
| e2e | PASS — 276 |
