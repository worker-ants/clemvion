# RESOLUTION — WS 이월 INFO 정리 리뷰 1라운드

대상 SUMMARY: 위험도 **MEDIUM** · Critical **0** · Warning **3** · INFO 9

**WARNING 3건 + INFO 3건 조치.** W1 은 **5명이 독립 발견**했고, W3 은 *같은 라운드에 내가 세운
기준을 한 단계 아래에서 못 지킨 것*이었다.

## W1·W2 — JSDoc 오귀속. 삽입 위치를 잘못 잡았다

새 심볼을 **기존 JSDoc 과 그 대상 선언 사이**에 끼워 넣었다. 결과:

| 파일 | 고아가 된 JSDoc | 그것을 떠안은 것 |
|---|---|---|
| `websocket.gateway.ts` | `armExpiryTimers` 의 §1.2 설계 근거 **15줄** | `clearExpiryTimers`(단순 해제 헬퍼) |
| `websocket-events.types.ts` | `AuthTokenExpiredPayload` 의 wire 계약 설명 | `MSG_AUTH_TOKEN_EXPIRING` |

`armExpiryTimers` 는 **인접 JSDoc 이 전혀 없는 상태**가 됐다 — revoke 카브아웃·`exp` 부재
처리 같은 이 기능의 핵심 근거가 통째로 다른 함수를 설명하는 것처럼 보였다.

**5개 reviewer(architecture·requirement·scope·maintainability·documentation)가 독립적으로
같은 지점을 짚었다** — 이번 라운드에서 가장 강하게 corroborate 된 발견이다.

둘 다 신규 심볼을 **대상 선언 뒤로** 옮겨 원래 인접성을 복원했다.

## W3 — 조기 `return` 이 선제 해제보다 먼저 돌고 있었다

`exp` 없는 토큰으로 재무장하면 `armExpiryTimers` 가 조기 `return` 해 **옛 타이머 쌍이 그대로
남는다.** 내가 방금 닫은 누수가 좁은 조합에서 살아 있었다.

> **이번 커밋이 5건을 닫은 기준이 "도달 불가와 검증 불가는 다르다" 였는데**, 그 기준을 한 단계
> 아래에서 못 지켰다. 새 rearm 테스트도 양쪽 다 `exp` 있는 경우만 덮었다.

테스트를 먼저 써서 **실제로 관측**했다 — 옛 타이머가 emit 1회를 냈다. 해제를 조기 `return`
**앞**으로 옮기고, 되돌리는 뮤턴트로 **RED**를 확인했다.

> 첫 시도의 RED 는 **거짓이었다** — `jwtService` 가 스코프에 없어 `ReferenceError` 로 죽은
> 것이었다. setup 오류로 인한 RED 를 증거로 쓰지 않고, 이 파일의 실제 mock 접근 방식
> (`module.get(JwtService)`)으로 고쳐 진짜 RED 를 받았다.

## 조치한 INFO

- **#1** `expiryTimers` 필드에 신·구 JSDoc **두 블록**이 겹쳐 있었다(내가 추가하며 옛 것을
  안 지웠다) — 하나로 병합했다.
- **#5** unref 테스트가 `length >= 2` + `slice(-2)` 로 느슨했다 — 타이머가 늘어도 통과해
  "둘 다 unref" 를 더는 보장하지 않는다. `toHaveLength(2)` + 전수 순회로 정밀화.
- **#6** `jest.spyOn(global, 'setTimeout')` 이 `mockRestore()` 에만 의존 — `try/finally` 로 감쌌다.

## 미조치 (판단 유지)

- **#2·#3** `unref()` 와 그레이스풀 셧다운 상호작용 — reviewer 도 *"의도된 개선, 배포 런북에서
  별도 추적 중"* 으로 적었다. 런북 항목은 이미 plan 에 있다.
- **#4** rearm 테스트가 현재 도달 불가 경로를 검증 — 그게 **의도**다. `connectionStateRecovery`
  를 켜는 날 load-bearing 이 된다.
- **#7** `MSG_AUTH_TOKEN_EXPIRING`(진행형) vs `AUTH_TOKEN_EXPIRED`(완료형) 시제 불일치 —
  이벤트명은 **wire 계약이라 바꿀 수 없고**(spec §4.6), 상수명만 맞추면 오히려 "통지 시점은
  아직 만료 전" 이라는 사실이 흐려진다. 현행 유지.
- **#8·#9** additive 확인 / `connectionStateRecovery` 가정 — 조치 불요.

## 검증

lint · unit(backend **9,232**) **PASS** · backend ratchet **198/37** ·
websocket gateway **71/71** · 뮤테이션 **4축 RED**(선제 해제 · unref · 메시지 상수 · W3 위치).
