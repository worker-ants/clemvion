# RESOLUTION — `20_27_08` (branch `claude/ws-event-types-extract`)

Critical **0** · Warning **2** · INFO 7. Warning 2건 전부 반영.

3라운드 연속으로 **가드 자신의 결함**이 나왔다. 발견의 성격이 제품 코드가 아니라 내가 만든
가드 쪽으로 계속 파고들고 있다는 뜻이라, 이번에도 인스턴스가 아니라 부류를 고정했다.

---

## Warning

### W2 (testing) — 예외를 원 식별자가 아니라 별칭으로 판정했다 · **반영**

**지적이 옳고, FN 방향이 특히 나쁘다.** 리뷰어가 양방향을 실측했다고 했고, 내가 무수정 프로브로
그대로 재현했다:

| 프로브 | 고치기 전 | 정답 |
|---|---|---|
| `import { WebsocketService as WS9 }` | **RED** (오탐) | GREEN |
| **`import { ExecutionEventType as WebsocketService }`** | **GREEN (미검출)** | RED |

두 번째가 결정적이다. 그건 **#1174 재발 그 자체**인데 — enum 값을 순환 위 모듈에서 값으로
끌어오는 것 — 이름만 `WebsocketService` 로 바꿔 달면 내 가드가 그냥 통과시켰다. 예외 조항이
"저쪽에서 무엇을 꺼냈나" 가 아니라 "이쪽에서 뭐라고 부르나" 를 보고 있었기 때문이다.

→ `(el.propertyName ?? el.name).text` 로 교정. import·export 양 분기 모두 원 식별자 기준.

**`export … from` 분기에 `WebsocketService` 예외를 두지 않은 것은 의도다 — 리뷰어가 지적한
"비대칭" 을 대칭으로 만들지 않았다.** import 쪽 예외가 존재하는 이유는 *서비스를 주입하려면
클래스를 import 할 수밖에 없다* 는 DI 의 불가피함이다. 재-수출에는 그런 불가피함이 없고,
오히려 제3 모듈에 우회 경로를 만들어 이 가드를 무력화한다. 코드에 근거를 적어 뒀다.

뮤테이션:

| 뮤턴트 | 결과 |
|---|---|
| **M12 `ExecutionEventType as WebsocketService` (FN 경로)** | **RED** |
| M13 `export { ExecutionEventType as Anything } from` (별칭 세탁) | RED |
| N2 `WebsocketService as WS9` — **통과가 정답**(FP 대조) | GREEN |

### W1 (maintainability) — `import type` 미표시 · **반영하되 인스턴스가 아니라 부류로**

2라운드(`20_05_17` W1)에서 3곳, 3라운드에서 다시 4곳. **같은 지적이 연속으로 나온다는 건
인스턴스를 고치고 있다는 신호다.**

리뷰어 목록을 그대로 받지 않고 파서로 전수를 셌더니 **3파일·4심볼이 아니라 5문장**이었고,
빠진 2곳은 spec 파일이었다 (`execution-event-emitter.service.spec.ts:6`,
`websocket.service.spec.ts:2`).

그리고 이건 스타일 문제로 끝나지 않는다 — **세 번째 테스트의 판별 기준이 `isTypeOnly`** 라,
표시가 빠지면 타입 전용 심볼이 값 간선처럼 보인다. 가드의 신호가 흐려지는 것이다.

→ 5문장 전부 인라인 `type` 부여 + **다섯 번째 테스트로 부류 고정**. 값/타입 명단은
하드코딩하지 않고 타입 모듈을 파싱해서 얻으므로 선언이 늘어도 손으로 맞출 필요가 없다.

| 뮤턴트 | 결과 |
|---|---|
| M14 타입 전용 심볼을 `type` 없이 import | RED |
| N3 같은 심볼을 `type` 으로 — **통과가 정답** | GREEN |

---

## INFO

| # | 처분 |
|---|---|
| 1 `payload.error` 새니타이징 전수 | **등재됨** — plan 후속 절 (기존 설계, 이번 diff 무관) |
| 2 re-export facade 3중 수동 동기화 | **무조치** — 누락 시 `tsc` 가 fail-closed 로 잡는다. barrel(`export * from`) 단일화는 오히려 다섯 번째 테스트의 판별을 흐리므로 지금은 택하지 않는다 |
| 3 가드를 lint 계층으로 승격 | **무조치(후속 검토)** — 현재 위치에서 뮤테이션으로 실효를 실증했다. 저장소에 기록된 교훈대로 "유한한 문제를 무한한 문제와 바꾸지" 않는다 |
| 4 `TERMINAL_SHAPE` `Object.freeze` 부재 | **무조치** — 쓰기 경로 없음. 리뷰도 "조치 불요" |
| 5 spec §4.4 / `KbEventType` 6곳 | **등재됨** — planner 턴 (developer 권한 밖) |
| 6 fix 커밋이 지적사항 1:1 대응 | 조치 없음 |
| 7 직전 3라운드 문서화 지적 전부 반영 확인 | 조치 없음 |

---

## 검증

| 스테이지 | 결과 |
|---|---|
| lint | PASS (`--max-warnings 0`) |
| unit | PASS — backend **426 suites / 8742 tests** (가드 5 tests) |
| build | PASS |
| e2e | PASS — 276 |
