# 테스트(Testing) Review

대상: `claude/webchat-reload-rest-branches` 누적 diff(`18_51_07` 라운드까지 반영된 상태). 이 라운드는
직전 `18_51_07` SUMMARY 가 스스로 지목한 두 확인 요청 — (1) `use-token-refresh.test.ts` 의
`shouldAdvanceTime` 제거가 "마진 확대" 아닌 "원인 제거" 로 충분한가, (2) 신규 회귀 2건이 vacuous 가
아닌가 — 를 **repo 밖 scratch 사본**(`/private/tmp/.../scratchpad/webchat-mutate`, `node_modules` 만
symlink)에서 직접 뮤테이션해 재현했다. 원본 repo 파일은 전 과정에서 변경하지 않았다(`git status`
clean 확인).

## 발견사항

- **[INFO]** `use-token-refresh.test.ts` 의 `shouldAdvanceTime` 제거는 "원인 제거" 로 충분함을 재현 확인
  - 위치: `codebase/channel-web-chat/src/widget/use-token-refresh.test.ts:66-79` (JSDoc 주석 + `vi.useFakeTimers()`)
  - 상세: 이 파일 전체(`grep waitFor` 결과 0건)에 `waitFor` 폴링이 없고, 모든 시간 전진이
    `vi.advanceTimersByTimeAsync(...)` 명시 호출로만 일어난다 — 즉 `shouldAdvanceTime: true`(가상
    시계를 실경과시간에 얹는 옵션)가 관여할 지점 자체가 없다. **자매 파일(`use-widget-eager-start.test.ts`)의
    원 CRITICAL(`18_23_54`, 콜드 캐시 4/4 FAIL·웜 10/10 PASS)이 딱 이 옵션 때문**이었던 것과 달리,
    여기서는 이 옵션이 애초에 사용처가 없어 "마진을 넓히는" 임시방편이 아니라 결합 자체를 제거하는
    근본 수정이다.
  - 검증: scratch 사본에서 `useTokenRefresh` 의 실패-재예약 라인
    (`codebase/channel-web-chat/src/widget/use-token-refresh.ts:191-192`,
    `scheduleWithDelay(retryDelayMs(failuresRef.current))`)을 제거하는 뮤테이션을 걸고
    `use-token-refresh.test.ts` 를 재실행 — **"일시적 실패(네트워크) → 백오프로 재예약" 테스트가
    RED**(`toHaveBeenCalledTimes(2)` 기대에 실측 1)로 즉시 잡혔다. 전체 스위트는 21/21→20/21(1
    failed)로 정확히 그 테스트만 갈렸다. `shouldAdvanceTime` 을 뺀 뒤에도 오라클이 신뢰 가능함을
    직접 재현으로 확인했다(실행 23ms — 실경과시간 결합이 0이라는 서술과 일치).
  - 제안: 없음(참고용). 이 파일 안에서는 추가 조치 불요.

- **[INFO]** 신규 회귀 2건(`start()` 경로 토큰 미노출·SSE `onError` 원본 이벤트 미로깅) 모두 뮤테이션 RED 재현 성공 — vacuous 아님
  - 위치: `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts:716`(`start()` 회귀),
    `:752`(`onError` 회귀). 대응 소스: `codebase/channel-web-chat/src/widget/use-widget.ts:1325-1330`
    (`errMessage` 의 `redactToken` 적용), `:477-481`(`onError` 핸들러의 `e.type` 전용 로깅).
  - 검증 1 — `start()` 경로: `errMessage()` 의 `redactToken(...)` 호출을 제거하는 뮤테이션을 걸자
    "§보안: `start()` 경로의 스트림 오픈 실패가 토큰을 콘솔에 남기지 않는다" 가 RED —
    `expect(logged).not.toContain("iext_leaky")` 가
    `"...token=iext_leaky&lastEventId=0"` 원문을 그대로 잡아 실패했다. 뮤테이션 원복 후 재확인,
    소스 파일이 원본과 byte-identical 함을 `diff` 로 검증.
  - 검증 2 — SSE `onError`: 핸들러를 `e.type` 대신 원본 이벤트(`e`)를 그대로 찍도록 되돌리는
    뮤테이션을 걸자 "§보안: SSE `onError` 는 원본 이벤트를 찍지 않는다" 가 RED —
    로그에 `"...target":{"url":"...token=iext_sse..."}"` 가 그대로 실려
    `not.toContain("iext_sse")` 가 실패했다. 뮤테이션 원복 후 재확인, `diff` 로 원본과 일치 확인.
  - 검증 3 — RESOLUTION 이 서술한 "처음 이렇게 썼다가 빈 로그로 발각" 삽화도 재현: `start()` 테스트의
    `await waitFor(() => expect(result.current.config).not.toBeNull());` 가드(`:739-741`)를 제거하고
    재실행하면 `start()` 가 `!cfg` 로 조기 return 해 `warn` 이 한 번도 안 불리고, 바깥
    `waitFor(() => ...toContain("token="))` 가 **타임아웃으로 실패**했다(`Expected: "token=" / Received:
    ""`). 즉 이 가드가 없으면 "조용히 항상 통과"가 아니라 "명백히 실패"로 드러나는 구조라 — vacuous-pass
    형태가 아님을 확인했다. 원복 후 원본과 `diff` 로 재확인.
  - 결론: 두 회귀 모두 실제 결함을 잡는 살아있는 오라클이며, `18_51_07` RESOLUTION 의 "뮤테이션 2종
    RED" 주장이 이 세션에서도 독립 재현된다.

- **[WARNING]** `applyConfig` 자체의 redaction 진입점(`runApplyConfig`)이 어떤 테스트로도 겨냥되지 않는다 — 뮤테이션이 전체 스위트(435건)를 통과했다
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:1243-1247`
    (`runApplyConfig` 헬퍼, `redactToken(...)` 호출은 `:1245`). 이 헬퍼는 이번 브랜치가 `18_51_07`
    라운드에서 새로 만든 코드다 — 원래 `void applyConfig(...)` 에 `catch` 자체가 없어 **unhandled
    rejection**으로 토큰이 실린 URL 이 브라우저 기본 로거에 그대로 찍히던 C2 를 고친 자리다
    (RESOLUTION 원문: "애플리케이션 레벨 redaction 이 개입할 자리조차 없는 구조").
  - 상세: `openStream` 진입점은 셋 — `start()`(`:860`, `errMessage()` 경유), SSE `onError`(`:477`),
    `resumeDeferredStream`(`:771`, `use-token-refresh.ts` 의 `onRefreshed` try/catch 경유) — 은 각각
    `use-widget-eager-start.test.ts:716`·`:752`·`~680`("재개 시도 → throw") 세 곳에서 개별 회귀로
    덮여 있다(`throwOnce` 사용처 `grep` 결과 정확히 이 두 지점뿐). 그런데 `applyConfig` 가 **직접**
    복원 세션으로 `openStream` 을 여는 네 번째 지점(`:1223`, `const claim = openStream(live, "0");`)이
    던지면 `runApplyConfig` 의 `catch`(`:1244-1246`)로 흘러가는데, 이 경로를 겨냥한 테스트가
    없다 — `grep -rn "boot config 적용 실패|runApplyConfig" src/widget/*.test.ts` 결과 0건.
  - 검증: scratch 사본에서 `runApplyConfig` 의 `redactToken(...)` 호출을 제거하는 뮤테이션(문자열
    그대로 `console.warn` 하도록 되돌림)을 걸고 위젯 전체 스위트(23 파일·435 테스트)를 재실행 —
    **435/435 전부 GREEN**. 즉 이 라운드가 막 고친 C2 의 핵심(토큰 redaction)이 지금 이 자리에서
    다시 사라져도 CI 는 조용히 통과한다. 뮤테이션 원복 후 원본과 `diff` 로 재확인,
    435 passed 재확인.
  - 제안: `start()`/`onError`/`resumeDeferredStream` 세 회귀와 같은 형태로 네 번째 회귀를 추가할 것 —
    저장된 세션이 있는 상태로 boot 하고(재전송이 아닌 최초 복원 경로, 즉 `sessionEstablished()` 가
    아직 false 인 시점) `throwOnce=true` 로 `openStream` 이 동기 throw 하게 만든 뒤
    `console.warn` 로그에 `token=<redacted>` 는 있고 원본 토큰 값은 없음을 단언하면 된다. 이
    브랜치 자신이 "진입점 셋 중 하나만 고치면 다음 '한쪽만' 이 된다" 를 두 라운드(`16_09_40`→
    `18_51_07`)에 걸쳐 반복 학습했는데, 이번엔 코드는 넷을 다 고쳤지만 **테스트가 셋만** 따라갔다 —
    같은 형태가 검증 축에서 재발한 것이다.

## 요약

지시받은 두 확인 사항은 모두 뮤테이션 재현으로 긍정 확인됐다 — `use-token-refresh.test.ts` 의
`shouldAdvanceTime` 제거는 그 파일이 `waitFor` 를 전혀 안 쓴다는 사실에 정확히 근거한 원인 제거이며
백오프 재예약 로직 삭제 뮤턴트가 여전히 RED 로 잡힌다. `start()`/SSE `onError` 신규 회귀 2건도 각각
독립 뮤테이션으로 RED 를 재현했고, "config 미확립 시 조기 return" 실패 모드도 vacuous-pass 가 아니라
가시적 타임아웃 실패로 드러남을 확인했다. 다만 이 과정에서 지시받지 않은 새로운 커버리지 갭을
찾았다 — 같은 라운드가 새로 추가한 `applyConfig` 자체의 redaction(`runApplyConfig`)은 네 진입점 중
유일하게 회귀가 없고, 뮤테이션으로 그 사실을 435-테스트 전체 스위트 기준으로 재현했다. 이 브랜치가
"진입점 하나만 고치고 다음에 또 걸린다"를 이미 두 번 반복한 이력을 감안하면, 이번엔 코드는 네 곳
모두 고쳤으나 검증(테스트)이 세 곳에만 따라간 형태로 같은 패턴이 재발한 것이라 판단한다.

## 위험도

MEDIUM — 현재 동작 결함은 없다(코드는 이미 옳다). 그러나 회귀 방지망이 진입점 하나에서 완전히
비어 있고, 그 자리가 바로 이 브랜치가 두 라운드에 걸쳐 "unhandled rejection으로 토큰 노출" CRITICAL
을 냈던 코드라는 점에서 향후 리팩터링·이관 시 조용히 재발할 실질적 위험이 있다.
