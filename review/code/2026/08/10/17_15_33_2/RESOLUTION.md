# RESOLUTION — `17_15_33_2` 라운드

forced 7명. **Critical 2 · WARNING 2 전부 처분.**

## 1. 보강을 한쪽에만 했다 (testing CRITICAL)

직전 라운드에서 "정상 streaming 과 고착 streaming 을 못 가른다" 를 고치며 **네트워크-오류
케이스만** 보강했다. `500` 케이스는 **같은 코드 경로**를 검증하는데 그대로 뒀고, reviewer 가
repo 밖 scratch 사본에서 같은 뮤턴트의 **생존**을 실측했다.

이 세션에서 반복한 "가드를 한쪽에만" 형태가 이번엔 **테스트 축**에서 났다. 같은 보강 적용,
뮤테이션 **2건 RED**(이전 1건).

## 2. `refresh_deferred` 는 고착의 절반만 닫는다 (side_effect CRITICAL)

**판정: 유효.** 실측으로 확인했다 — `openStream` 호출부는 2곳뿐이고 **둘 다 그 값에서
건너뛰며**, `use-token-refresh` 는 `openStream` 을 아예 부르지 않는다(grep 0건).
`sessionRef` 는 `useRef` 라 갱신돼도 effect 가 재실행되지 않는다.

**처분: plan 등재 + 이 PR 의 범위를 명시.** 처방이 설계 선택 3택이고 표면이 다 다르다 —
(a) `useTokenRefresh` 에 스트림 열기 주입(단일 책임 훼손) (b) 복구 대기 phase 신설
(`widget-state`·`panel` 까지 번짐) (c) 종료로 되돌리기(`webchat-boot-single-flight` 사고의
재발이라 반대 방향으로 틀림).

**닫은 것과 안 닫은 것을 갈라 적었다.** 종전 대비 악화는 아니다 — 종전에도 그 경로는 죽은
토큰으로 SSE 를 열어 같은 스피너였고 지금은 죽은 토큰을 안 쓴다.

## 3. 게이팅 관용구 추출 (maintainability)

reviewer 가 **fail-closed 임을 확정**했다(화이트리스트라 갈래가 늘면 기본이 중단) 하고,
네 갈래가 부작용 조합상 겹치지 않아 자의적 분화가 아님도 확인했다. 그 위에서 "두 호출부에
리터럴 복제" 만 지적했으므로 `shouldAbortAfterSeed` 로 뽑았다.

**뮤테이션(화이트리스트→블랙리스트)은 초록이다** — 현재 갈래 넷에 대해 두 식이 동치라
동등 뮤턴트다. 이 헬퍼가 막는 것은 "지금 틀림" 이 아니라 "다음에 갈라짐" 이고, 그건 테스트가
아니라 구조로 막는다. 그 사실을 JSDoc 에 남겼다(생존이 정상임을 기록).

## 4. 두 검증 요청에 대한 답

- **배선 착지**(security): `refresh_deferred` 가 HEAD 에 실렸음을 `git show` 로 확인.
  두 번 유실됐던 수정이라 필요한 검증이었다.
- **산출물 정합**(scope): 직전 CRITICAL(거짓 완료 주장) 정정이 실제 커밋과 일치함을 재판정.

## 검증

- 위젯 **417 passed** · `tsc` **0 errors** · 문서 가드 **2876 passed**
- 뮤테이션 누적 14종
