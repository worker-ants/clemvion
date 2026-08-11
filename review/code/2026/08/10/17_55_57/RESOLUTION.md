# RESOLUTION — `17_55_57`

Critical 1 / Warning 5 **전부 처분**. 처분 커밋: `36bc55fa5`.

## W1 (side_effect) — 내가 만든 새 고착 경로 → **고침**

`resumeDeferredStream` 이 `openStream` **이전에** `deferredStreamRef` 를 지웠다. 그 호출이 동기
throw 하면(`new URL` 이 손상된 `endpoints.stream`/`apiBase` 조합에 던진다) "미뤄 뒀다" 는 의사가
영구히 사라져, 이후 갱신이 아무리 성공해도 스트림은 다시 열리지 않는다 — 토큰·storage 는 최신인데
화면만 영영 스피너인 조용한 실패다.

**연 뒤에 지운다.** 실패하면 의사가 남아 다음 갱신이 재시도한다.

같은 뿌리로 `useTokenRefresh` 의 `onRefreshed` 호출을 try/catch 로 격리했다. 안 감싸면 소비자의
throw 가 같은 프라미스 체인의 `.catch()` 로 떨어져 **성공한 갱신이 "갱신 실패" 로 오분류**되고,
`isTerminalAuthError` 가 false 라 백오프 카운터까지 오른다. 두 처방 중 하나면 충분하다는
리뷰어 판단에 동의하지만 **둘 다 넣었다** — 하나는 "의사를 잃지 않는다", 다른 하나는 "성공을
실패로 기록하지 않는다" 로 서로 다른 것을 지킨다.

**뮤테이션**: 낙관적 클리어로 되돌리는 뮤턴트 → **RED**(신규 통합 회귀). 예외 격리를 제거하는
뮤턴트 → **RED**(신규 훅 테스트).

## W2 (maintainability) — 내부 인자 노출 → **고침**

내부 `scheduleWithDelay(retryDelay?)` + 무인자 공개 래퍼(`scheduleRefresh: () => void`)로 나눴다.
리뷰어가 제안한 "얇은 public wrapper" 그대로다 — 훅 통합 같은 큰 대안은 나쁘지만 이건 의존
주입 비용이 0 이라는 지적이 옳다. 내 원래 판단("대안이 더 나쁘다")은 큰 대안만 보고 내린 것이라
**부분적으로 틀렸다**.

## W3 (testing) — `410` 축이 다른 파일에 기대고 있었다 → **고침**

`isTerminalAuthError` 에서 `410` 항만 지우는 뮤턴트를 `use-token-refresh.test.ts` 의 9개 신규
테스트가 전부 통과시키고, 완전히 다른 파일의 기존 테스트가 대신 잡고 있었다. 401 테스트 옆에
`410` 짝을 추가했다. **뮤테이션 재확인**: 같은 뮤턴트가 이제 이 파일에서 **RED**.

## W4 (testing) — survivor 두 개 중 한쪽만 기록 → **고침**

`resumeDeferredStream` 의 no-op 가드도 `teardownSession` 의 플래그 해제와 같은 근-등가
survivor 인데(둘 다 `openStream` 내부 `"already_owned"` 게이트에 기대 무해하다) 그쪽만 주석이
있었다. 양쪽에 같은 형식으로 남겼다. **"한쪽만" 이 코드에서 두 번, 이번엔 주석에서 재발했다는
사실 자체가 기록할 가치가 있어** 주석에 그 문장을 넣었다.

## C1 + W5 (documentation · requirement) — plan 이 고친 결함을 미해결로 서술 → **고침**

"## 미해결" 절을 "## 해소됨" 으로 고쳐 쓰되 **진단은 그대로 뒀다** — 왜 그 형태였는지가 기록이다.
추가한 것: (a) 처방 3택 중 **(a) 를 골랐고 반대 근거였던 "단일 책임" 이 콜백 주입으로 해소됐다**는
경위, (b) 체크박스 이행, (c) requirement 가 찾은 두 번째 절반(재예약 소실)이 같은 설계의 반대
쪽 끝이었다는 연결.

그 과정에서 **부수 잔여를 분리 등재**했다 — "지연 갱신이 나중에 진짜 `401`/`410` 을 받아도
storage 를 안 지운다" 는 `refresh_deferred` 고유가 아니라 **주기 갱신 경로 전체**의 성질이고
종전부터 그랬다. `refresh_deferred` 절에 묶어 두면 이 PR 이 안 고친 것처럼 읽힌다.

형제 절(§비-terminal refresh 실패 뒤 만료 토큰 재연결)의 미체크 항목 2건도 함께 종결했다 —
그 절이 남긴 "좁은 질문"("갱신이 복구까지 이어지는가")의 답이 바로 이번 CRITICAL 이었다.
(b)/(c) 선택지는 만료 토큰으로 SSE 를 여는 일 자체가 없어져 **전제가 사라졌음**을 명시했다.

## 검증

- 위젯 vitest **429 passed** (23 files, +3).
- `tsc --noEmit` **0 errors**.
- harness/doc guards **1032 passed / 1128 subtests**.
- 뮤테이션 **누적 9종** — 이번 라운드 3종 추가, 전부 RED.

## 처분하지 않은 것 — 없음

INFO 19건 중 조치를 권한 것은 없다(대부분 "재검증 통과" 의 긍정 확인). side_effect INFO 의
`deferredStreamRef` 선언부 JSDoc 보강 제안은 W4 처분이 같은 내용을 `resumeDeferredStream`
자리에 넣어 흡수했다 — 선언부와 사용부 양쪽에 같은 문단을 두는 것은 다음 drift 지점이 된다.
