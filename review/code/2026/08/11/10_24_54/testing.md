# 테스트(Testing) Review

대상: `claude/webchat-reload-rest-branches` 누적 diff(`origin/main` 대비). 이번 라운드는 직전
`10_02_22` 라운드의 WARNING — "`applyConfig` 진입점(`runApplyConfig`)에 회귀가 없다" — 을 반영해
추가된 신규 회귀(`use-widget-eager-start.test.ts:768`)를 **직접 재현**해 검증하는 것이 지시받은
과제다. **repo 밖 scratch 사본**(`/private/tmp/.../scratchpad/mutation-test/channel-web-chat`,
`node_modules` 만 symlink)에서 두 종의 뮤테이션을 걸었다. 원본 worktree 는 `git status` clean 을
전 과정에서 유지했다(건드린 파일 없음).

## 발견사항

- **[INFO]** 신규 `applyConfig` 회귀가 `dispatch` 제거 뮤턴트를 실제로 잡는다 — vacuous 아님(직접 재현 완료)
  - 위치: `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts:768-799`
    (`it("§보안·§고착: 복원 경로의 스트림 오픈 실패 — 토큰 미노출 + ERROR 전이", ...)`).
    대응 소스: `codebase/channel-web-chat/src/widget/use-widget.ts:1262-1274`
    (`runApplyConfig`, `dispatch({ type: "ERROR", message: errMessage(e) })` 는 `:1272`).
  - 상세: scratch 사본에서 `:1272` 의 `dispatch(...)` 줄을 주석(no-op)으로 치환하는 뮤테이션을
    걸었다. **치환 전에 `grep`으로 원본 문자열이 정확히 그 줄에 있음을 확인**했고, 치환 직후 다시
    `grep`으로 마커(`// MUTATED: dispatch removed`)가 그 파일에 실제로 앉았음을 재확인한 뒤에만
    테스트를 돌렸다(지시받은 "뮤턴트가 실제로 앉았는지 확인" 절차 준수). 이 상태로
    `vitest run ... -t "복원 경로의 스트림 오픈 실패"` 를 실행하자 **RED**:
    `expected 'streaming' to be 'ended'` — `result.current.state.phase` 단언(`:793`)에서 실패했다.
    `dispatch` 를 지우면 `catch` 가 오류를 삼키고 `RESTORED`(phase→`streaming`)가 먼저 dispatch된
    상태 그대로 남아 스피너에 영구 고착되는데, 이 테스트가 정확히 그 상태를 잡는다. 뮤테이션
    적용 전 베이스라인은 동일 커맨드로 1 passed 를 확인했다.
  - 추가 확인: 뮤테이션이 오직 `:1272` 한 줄만 바꿨고 형제 진입점(`start()` 쪽 `dispatch` 2곳,
    `:890`·`:934`)은 그대로임을 `grep` 으로 대조해, "다른 경로가 우연히 이 테스트를 통과시킨 것"
    이 아니라 이 테스트 자체가 `applyConfig` 경로를 겨냥하고 있음을 확인했다.
  - 제안: 없음(참고용) — 회귀가 유효함을 재현으로 확인했다.

- **[WARNING]** `sseErrorDetail` 신규 헬퍼는 직접 회귀가 전혀 없다 — 핵심 로직(readyState 추출)을
  통째로 제거해도 전체 스위트가 GREEN
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:459-477`
    (`sseErrorDetail` 함수 본문은 `:470-477`), 호출부 `:496-500`(`openStream` 의 `onError` 콜백).
    유일하게 인접한 테스트는
    `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts:801-831`
    (`it("§보안: SSE onError 는 원본 이벤트를 찍지 않는다 — e.target.url 로 새던 자리", ...)`).
  - 상세: `sseErrorDetail` 은 §직전 라운드(`10_02_22`)의 side_effect·requirement 지적 — "`e.type` 만
    남기면 정보량이 0이라 CORS/네트워크 차단 진단이라는 원래 로그의 존재 이유가 사라진다" —
    을 고치려고 `readyState` 를 뽑아 `error (readyState=N)` 형태로 복원한 자리다. 그런데 인접
    테스트(`:801`)는 **토큰 비노출만** 단언한다(`expect(logged).not.toContain("iext_sse")`) —
    `readyState` 값이 로그에 실제로 포함되는지는 어디서도 단언하지 않는다.
    직접 재현: scratch 사본에서 `sseErrorDetail` 본문을 `return "error";` 로 완전히 뭉개
    (`target`/`readyState` 추출 로직 삭제) — 마커(`// MUTATED: readyState extraction removed`)가
    실제로 앉았음을 `grep` 으로 재확인한 뒤 `use-widget-eager-start.test.ts` 전체(75건)를 재실행:
    **75 passed, 0 failed**. `:801` 테스트를 포함해 어떤 테스트도 이 축소를 감지하지 못했다.
    자매 파일 `src/lib/eia-client.test.ts` 의 `onError` 관련 테스트(`:160`)도 확인했는데, 그건
    `EiaClient.openStream` 이 raw event 를 콜백에 그대로 전달하는지를 보는 **다른 seam**(소비자인
    `use-widget.ts` 가 아니라 발신자인 `eia-client.ts` 쪽)이라 이 갭을 메우지 않는다.
  - 이 갭이 문제인 이유: `sseErrorDetail` 자체가 "이전 라운드에 진단 정보를 날린 결함을 고치려고
    만든" 헬퍼인데, 그 고침에 오라클이 없다. 지금 이 파일이 반복해 겪은 형태 — "코드는 고쳤는데
    검증이 안 따라간다" — 가 축(`applyConfig` redaction → `sseErrorDetail` readyState)만 바뀐 채
    다시 나타난 것이다. 다만 이 갭이 노출하는 리스크는 **보안(토큰)은 아니다** — 토큰 비노출은
    `:801` 이 여전히 지킨다. 노출면은 "CORS/네트워크 차단 진단 정보가 조용히 다시 죽 필드로
    퇴화해도 아무도 모른다"는 진단 품질 저하다.
  - 제안: `:801` 테스트를 확장하거나 신규 `it` 을 추가해, `emitError({ type: "error", target: { url, readyState: 2 } })`
    형태로 주입한 뒤 `expect(logged).toContain("readyState=2")` (또는 `error (readyState=2)`)를
    단언할 것. `readyState` 가 없는 경우(`target` 자체가 없거나 필드 부재)의 폴백("error" 단독)도
    별도 케이스로 가르면 `readyState === null ? "error" : ...` 삼항의 두 분기 모두 뮤테이션
    사각지대에서 벗어난다.

- **[INFO]** `isTerminalAuthError`·`redactToken` 신규 헬퍼(`eia-client.ts`)는 직접 단위 테스트가
  충분함 — duck-typing 축까지 가름
  - 위치: `codebase/channel-web-chat/src/lib/eia-client.test.ts:266-300`.
  - 상세: `isTerminalAuthError` 는 401/410/500/non-EiaError 4가지 값 축에 더해, `.status` 를 가진
    비-`EiaError` 객체(`Object.assign(new Error(...), { status: 401 })`, `{ status: 410 }`)로
    `instanceof` 가드 자체가 장식이 아님을 검증한다 — JSDoc(`:274-280`)이 그 축을 뮤턴트로
    실측했다고 명시한다. `redactToken` 도 "지울 것만 지운다"(인접 파라미터 보존)와 "토큰이 없으면
    그대로 둔다" 두 경계를 모두 덮는다. 실사용처(`use-widget.ts:558`, `use-token-refresh.ts:186`)
    양쪽에서 호출됨을 `grep` 으로 대조 확인했고, `use-token-refresh.test.ts:253` 주석이 "이
    파일에 401 만 두면 다른 파일의 402 커버리지에 의존하게 된다"는 인식까지 명시적으로 적어 둬
    분기 매트릭스 사각지대를 스스로 경계하고 있다. 추가 조치 불요.
  - 제안: 없음(참고용).

- **[INFO]** `applyRefreshedToken`(`session-store.ts:125`)은 전용 unit 테스트가 없고 호출부
  회귀에만 얹혀 간접 커버됨 — 이번 라운드의 새 지적은 아님
  - 위치: `codebase/channel-web-chat/src/lib/session-store.ts:109-133`
    (`applyRefreshedToken` export), `codebase/channel-web-chat/src/lib/session-store.test.ts`
    (`describe("session-store", ...)` 안에 해당 함수를 겨냥한 case 없음 — `grep` 결과 0건).
  - 상세: 이 함수는 `use-widget.ts:542`·`use-token-refresh.ts:151` 두 호출부에서만 쓰이고,
    두 호출부의 회귀(§R4 낙관적 refresh 성공 경로, 주기 갱신 성공 경로)가 간접적으로 이 함수를
    지나간다. 직전 라운드(`16_09_40`) RESOLUTION 이 "뮤테이션 RED 2건"으로 검증했다고 기록한
    지점과 같아, **오늘 처음 드러난 갭이 아니라 이미 판정이 끝난 기존 상태**다. 재지적하지
    않는다 — 다만 `session-store.test.ts` 자체에는 여전히 이 함수를 직접 겨냥한 case 가 없다는
    사실만 참고로 남긴다(간접 커버로 충분하다는 기존 판정을 뒤집을 근거는 이번 조사에서
    찾지 못했다).
  - 제안: 없음 — 재판정 불요.

## 요약

지시받은 핵심 과제 — "`applyConfig` 진입점 회귀가 `dispatch` 제거 뮤턴트를 잡는가" — 는 **잡는다**로
직접 재현 확인했다. scratch 사본에서 `runApplyConfig` 의 `dispatch({ type: "ERROR", ... })` 한 줄을
제거하는 뮤테이션을 걸었고, 치환 전/후 모두 `grep` 으로 실제 반영을 확인한 뒤(뮤테이션 미반영으로
인한 거짓 판정을 배제) 테스트를 실행해 `phase` 단언에서 RED 를 관측했다. 형제 진입점(`start()`)의
`dispatch` 는 손대지 않아 대조군도 확보했다. 이 부분은 `10_02_22` WARNING 이 온전히 해소됐다.

다만 지시받은 두 번째 확인 — `sseErrorDetail` 신규 헬퍼 — 에서는 정확히 예상된 다음 갭을 찾았다.
`readyState` 추출 로직 전체를 `return "error"` 로 뭉개도 위젯 스위트 75건이 전부 GREEN 이다. 인접한
"SSE onError 는 원본 이벤트를 찍지 않는다" 테스트는 **토큰 비노출**만 보고 **진단 정보(readyState)가
실제로 로그에 실리는지**는 보지 않는다. 이 헬퍼 자체가 "직전 라운드에 진단 정보를 날린 결함"을
고치려고 만들어졌다는 점에서, 그 고침에 오라클이 없는 것은 `applyConfig`/`dispatch` 갭과 같은
클래스의 재발이다 — 다만 노출면은 보안(토큰)이 아니라 진단 품질 저하로 한정된다.

## 위험도

MEDIUM — `applyConfig` 회귀는 검증됐고 현재 동작 결함도 없다. 그러나 이 브랜치가 "코드는 네 곳
모두 고쳤지만 검증은 세 곳만 따라갔다"(`10_02_22`)를 겪은 지 한 라운드 만에, 같은 형태가
`sseErrorDetail` 에서 다시 나타났다 — 조용히 재발하는 패턴 자체가 반복되고 있다는 신호로 본다.
