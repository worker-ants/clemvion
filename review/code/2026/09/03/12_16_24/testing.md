# 테스트(Testing) 리뷰

## 검증 방법

리뷰 대상 diff(`websocket.gateway.ts`/`websocket.gateway.spec.ts`/`websocket-events.types.ts`)에 대해
직접 뮤테이션 3종을 저장소 파일에 적용 → 대상 테스트 실행 → RED 확인 → `cp` 로 원복 후
`git status --short` 로 잔여물 없음 확인(전 과정 완료, 잔여 변경 없음):

| 뮤테이션 | 대상 | 결과 |
|---|---|---|
| `armExpiryTimers` 의 `clearExpiryTimers(client.id)` 호출을 조기 `return` **뒤로** 이동 | `websocket.gateway.ts` | RED — `exp 없는 토큰으로 재무장해도 옛 타이머는 해제된다` 테스트가 정확히 잡음 |
| `notice.unref()`/`cutoff.unref()` 제거 | `websocket.gateway.ts` | RED — `만료 타이머는 unref 된다` 테스트가 정확히 잡음 |
| `MSG_AUTH_TOKEN_EXPIRING` 리터럴 값 변경 | `websocket-events.types.ts` | RED — `통지 payload 의 message 는 공용 상수와 일치한다` 테스트가 정확히 잡음 |

전체 스위트 `npx jest src/modules/websocket/websocket.gateway.spec.ts` — 뮤테이션 전/후 모두 71/71
(뮤테이션 시 1 FAIL 로 정확히 하락) 확인. plan/RESOLUTION 이 주장하는 "뮤테이션 RED" 는 **vacuous 가
아니라 실제로 문다** — 이번 라운드 신규 테스트 3종은 유효하다.

## 발견사항

- **[INFO]** 재무장(rearm) 테스트가 "옛 타이머 생존 여부"를 **합계(sum)** 로만 단언해 생존자의
  신원(누가 emit 했는지)은 검증하지 않는다.
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.spec.ts:819-829`
    (`같은 client.id 로 재무장하면 옛 타이머를 먼저 해제한다` 테스트)
  - 상세: `expect(oldEmits + newEmits).toBe(1)` / `expect(first.disconnect... + second.disconnect...).toBe(1)`
    형태라, "옛 타이머가 살아남아 중복 발화"하는 결함(리크)은 정확히 잡지만(합이 2가 됨),
    "옛 것이 새 것 대신 발화"하는 방향의 결함은 이론상 이 코드 구조에서는 거의 불가능해도
    테스트 자체는 그 구분을 표현하지 않는다. `oldEmits`/`newEmits` 를 이미 개별 계산해 두고도
    합만 단언하는 점이 아쉽다.
  - 제안: `expect(oldEmits).toBe(0); expect(newEmits).toBe(1);` 로 개별 단언하면 의도("옛 것은
    죽고 새 것만 산다")가 더 명확해지고 회귀 시 실패 메시지도 더 유용해진다.

- **[INFO]** `cutoff` 의 `Math.max(0, untilCutoff)` 음수 분기(이미 만료된 `exp` 로 connect)를
  직접 exercise 하는 테스트가 없다.
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts:212-221` (cutoff clamp),
    테스트 쪽은 `codebase/backend/src/modules/websocket/websocket.gateway.spec.ts` 의
    `connectWithExp` 호출부(732-877행) — 전부 `secondsFromNow > 0`.
  - 상세: `lead time 보다 짧게 남은 토큰은 즉시 통지한다` 테스트(876-888행)는 `secondsFromNow: 30`
    으로 **notice** 클램프(`untilNotice = Math.max(0, …)`)만 건드리고, `untilCutoff` 자체는
    여전히 양수(30s)다. `exp` 가 이미 과거인 경우(`secondsFromNow` 음수)의 cutoff 분기는 코드
    주석이 "방어적으로 다룬다(음수 지연 → 즉시 처리)" 라고 명시한 계약인데, 이를 직접 검증하는
    테스트가 없다. 소스 주석(`gateway.ts:212-214`)은 이 clamp 이 "런타임 구현 세부가 아니라
    이 코드가 표현하려는 계약"이라고 명시적으로 강조하고 있어 테스트 부재가 더 두드러진다.
    (주의: Node 가 음수 delay 를 1ms 로 강제하므로 이 clamp 를 제거하는 뮤테이션 자체는
    죽이기 어렵다고 plan 이 이미 인정했다(M3) — 그렇더라도 "이미 만료된 토큰으로 connect 하면
    즉시 disconnect 스케줄이 걸린다"는 end-to-end 계약은 clamp 유무와 무관하게 여전히
    테스트로 표현할 가치가 있다.)
  - 제안: `connectWithExp('client-exp-past', -10)` 류로 이미 만료된 토큰 connect 시나리오를
    추가해 "연결 즉시 disconnect 가 스케줄된다"를 직접 단언.

- **[INFO]** 같은 라운드의 정량 주장이 문서 간 불일치 — 회귀 근거로 인용될 "N축 RED" 숫자가 흔들린다.
  - 위치: `plan/in-progress/ws-token-expired-socket-lifetime-impl.md` (`뮤테이션 **3축 RED**` 문구,
    diff 상단 근처) vs `review/code/2026/09/03/11_57_58/RESOLUTION.md:62`
    (`뮤테이션 **4축 RED**(선제 해제 · unref · 메시지 상수 · W3 위치)`).
  - 상세: RESOLUTION.md 가 나열한 "선제 해제"와 "W3 위치"는 실제로 같은 코드 지점(`armExpiryTimers`
    진입부 `clearExpiryTimers` 호출을 조기 `return` 앞으로 옮긴 것)을 가리키는 것으로 보여,
    실측 축은 3개(선제 해제/W3 위치, unref, 메시지 상수)로 보이는데 라벨링이 4개로 이중 계산된
    것일 가능성이 높다. 이번 리뷰의 직접 뮤테이션 재현도 3축만 확인됐다(위 표). 테스트 커버리지를
    뒷받침하는 정량 주장이라 문서 간 숫자가 맞아야 다음 사람이 신뢰할 수 있다.
  - 제안: 두 문서 중 하나로 숫자를 통일하고, "선제 해제"/"W3 위치"가 동일 지점인지 여부를 명시.

- **[INFO]** `expSeconds` 가 `NaN`/`Infinity` 인 경우(예: 손상된 JWT payload)의 케이스가 명시
  테스트로 없다.
  - 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts:186`
    (`typeof expSeconds !== 'number' || !Number.isFinite(expSeconds)`)
  - 상세: `exp` 가 없는 경우(undefined)는 `exp 가 없는 토큰이면 타이머를 걸지 않는다` 테스트로
    커버되지만, `Number.isFinite` 가담당하는 `NaN`/`Infinity` 분기는 코드 경로상 `undefined`
    케이스와 동일한 조기 return 을 타므로 우선순위는 낮다.
  - 제안: 우선순위 낮음 — 필요 시 `exp: NaN` 케이스 1개만 추가해 `Number.isFinite` 가드가
    실제로 관여함을 보여도 좋다.

## 긍정적 관찰 (회귀·격리·가독성)

- 신규 테스트 4종(메시지 상수 일치, rearm 시 옛 타이머 해제, exp-less rearm 시 해제, unref) 모두
  `beforeEach`/`afterEach` 로 `jest.useFakeTimers()`/`useRealTimers()` 를 격리하고, 상위
  `beforeEach` 가 `TestingModule` 을 매 테스트마다 재생성해 `expiryTimers` 맵과 mock 상태가
  테스트 간 누수되지 않는다 — 격리 양호.
  (`websocket.gateway.spec.ts:58-165`, `723-729`)
- `jest.spyOn(global, 'setTimeout')` 사용처는 `try/finally` 로 감싸 단언 실패 시에도
  `mockRestore()` 가 보장된다 — 이전 라운드 INFO#6 조치가 실제로 반영돼 있음을 확인.
  (`websocket.gateway.spec.ts:859-874`)
- unref 테스트는 `created.length >= 2` 같은 느슨한 하한 대신 `toHaveLength(2)` 로 정밀화돼
  있어(이전 라운드 INFO#5 조치), 타이머 개수가 늘어도 "둘 다 unref" 보장이 조용히 깨지지
  않는다. 뮤테이션으로 실제 검증 완료.
- 메시지 상수 테스트는 `expect.objectContaining({ message: MSG_AUTH_TOKEN_EXPIRING })` 와
  **별도로** 리터럴 값을 재확인해, "테스트와 소스가 같은 상수만 참조해 값이 통째로 바뀌어도
  같이 움직이는" 자기충족적(self-fulfilling) mock 패턴을 피했다 — 뮤테이션으로 검증 완료.
- Mock 은 `Socket` 의 실사용 표면(`handshake.query`/`auth`, `emit`/`disconnect`/`join`/`leave`/
  `onAny`)만 최소로 흉내내 실제 동작과의 괴리가 작다. `JwtService.verify` 를 `mockReturnValueOnce`
  로 시나리오별 override 하는 패턴도 명확하다.
- 회귀: 전체 스위트 71/71 통과(뮤테이션 전/후 직접 실행 확인), 기존 `handleConnection`/
  `handleDisconnect`/구독 관련 테스트는 이번 diff 로 깨지지 않는다.

## 리뷰 스코프 밖

`review/code/2026/09/03/11_57_58/*.md`, `*.json` (파일 5~19)은 이전 리뷰 라운드의 산출물이며
애플리케이션 코드가 아니어서 테스트 관점 분석 대상이 아니다. `sessions.service.spec.ts`,
`test/users-change-password.e2e-spec.ts` (워크트리에 별도로 존재하는 uncommitted 변경)는 이번
`testing.md` 프롬프트의 리뷰 대상 파일 목록에 포함되지 않아 스코프 밖으로 판단, 분석하지 않았다.

## 요약

WS 토큰 만료 하드닝(§1.2)에 대한 신규 테스트 4종은 실제로 유효하다 — 세 가지 독립 뮤테이션
(선제 해제 순서, `unref`, 메시지 상수)을 직접 저장소에 적용해 각각 정확한 테스트가 RED 로
떨어지는 것을 확인했고(vacuous 아님), 이전 라운드에서 지적된 mock 느슨함(unref 하한, spy
복원)도 이번 diff 에 실제로 반영돼 있다. 격리·가독성·회귀 측면에서 문제는 없다. 다만 (1) rearm
테스트가 생존자 신원 대신 합계만 단언해 식별력이 이론상 약하고, (2) `cutoff` 의 음수-clamp
분기(이미 만료된 토큰으로 connect)를 직접 exercise 하는 테스트가 없으며, (3) 같은 라운드
문서(plan vs RESOLUTION.md) 간 "N축 RED" 수치가 3 대 4로 어긋난다 — 전부 차단 사유는 아닌
INFO 수준의 보완 여지다.

## 위험도
LOW
