# 부작용(Side Effect) 리뷰 — webchat-boot-single-flight (23_58_23)

> 범위: `git merge-base origin/main HEAD`(`29aa918a6`)`..HEAD`(`3f55ee000`). 이번 라운드 지시에 따라
> ① `sendCommand` 비-410 경로가 `teardownSession()` 없이 `dispatch({type:"ERROR"})` 만 하는 것이 SSE
> 잔존이라는 새 부작용을 만드는지, `sessionEstablished()` 복원-스킵이 그 부작용(재전송 시
> `getStatus`·SSE 재발사)을 실제로 막는지, ② `seedWaitingFromStatus` 의 신규 `attempt` 파라미터를
> 안 받는 두 호출부(`start()`, `execution.replay_unavailable` fire-and-forget 폴백)가 world 축만으로
> 정말 안전한지를 **실측**했다. 격리 detached worktree(`git worktree add --detach`, 커밋
> `3f55ee0001c485f4b83e162962085f18ef3cc5c0`, 공유 worktree 는 읽기전용 유지)에서 node_modules 를
> 부트스트랩(root 는 symlink, `codebase/channel-web-chat/node_modules` 는 `cp -a`)해 vitest 를 실행했고,
> 검증 후 `git worktree remove --force` 로 제거했다(공유 worktree 는 무변경 확인).

## 발견사항

- **[CRITICAL]** `start()`(eager 시작)의 `seedWaitingFromStatus` 호출은 `attempt` 를 넘기지 않아 boot 축
  상호배제에서 완전히 빠져 있다 — 겹친 `wc:boot` 재전송이 이미 SSE 로 전진시킨 화면을 뒤늦게
  되감을 수 있다(§106/C2 와 동일 증상 클래스). **isolated worktree 에서 직접 재현해 확인.**
  - 위치:
    - `codebase/channel-web-chat/src/widget/use-widget.ts:504-505`(JSDoc — "`start()`... 는 world 축만
      필요하므로... 생략한다" 주장)
    - `codebase/channel-web-chat/src/widget/use-widget.ts:511-572`(`seedWaitingFromStatus` 정의,
      특히 `541`행 `if (attempt && cannotApplyConfig(attempt)) return "stale";`)
    - `codebase/channel-web-chat/src/widget/use-widget.ts:603-650`(`start()`), 특히 `635`행
      `const outcome = await seedWaitingFromStatus(client, session);` — 2-인자 호출
    - 대조: `codebase/channel-web-chat/src/widget/use-widget.ts:955-975`(`applyConfig` 복원 분기 —
      `966`행 3-인자 호출 + `975`행 `isAttemptStale(attempt)`)
    - `isAttemptStale(` 사용처는 저장소 전체에서 `975`행 단 한 곳뿐(재확인:
      `grep -n "isAttemptStale(" use-widget.ts`).
  - 상세:
    1. **메커니즘**: 이번 diff 가 신설한 `bootGenRef`/`beginBootAttempt`/`cannotApplyConfig`/
       `isAttemptStale`(concurrency C2 fix)는 "겹친 두 `wc:boot`(둘 다 `applyConfig` 경유)" 사이의
       경합만 해소한다. `seedWaitingFromStatus` 내부의 `WAITING` dispatch 분기(`544-553`행)는
       `attempt` 가 **주어졌을 때만** boot 재검증을 하고(`541`행), `attempt` 가 `undefined` 면 그
       조건이 항상 거짓이라 검증 자체가 없다.
    2. **`start()` 가 이 검증에서 원천적으로 제외된 이유**: `start()`(`635`행)는 `attempt` 를 만들지도
       (`beginBootAttempt()` 호출 없음) 넘기지도 않는다 — "`start()`/`sendCommand`/
       `seedWaitingFromStatus` 는 world 축만 필요"(JSDoc `504-505`행, `plan/in-progress/
       webchat-boot-single-flight.md:91,141` 도 동일 서술)라는 **설계 전제** 때문이다.
    3. **그 전제가 깨지는 좁은 창**: `start()` 는 `persist()`(세션을 storage 에 동기적으로 씀,
       `session.ts` 저장 로직 재사용)와 자기 자신의 `seedWaitingFromStatus` 호출(getStatus 발사) 사이에
       `await` 경계가 없어 보이지만, `persist()` **이후** `await seedWaitingFromStatus(...)` 가 뜬
       시점부터 그 응답이 돌아오기 전까지는 `streamRef.current` 가 여전히 `null` 이다(`openStream` 은
       이 함수 반환 **이후**에만 호출됨, `639`행). 이 구간에 `wc:boot` 재전송이 도착하면, 그
       `applyConfig` 는 `sessionEstablished()`(`streamRef.current !== null`, `314`행)가 아직 `false` 라
       복원 분기(`955`행)에 **정당하게** 진입한다 — `loadSession()` 이 방금 `start()` 가 쓴 세션을
       그대로 읽어오기 때문이다. 이 재전송은 자신만의 `attempt` 토큰(boot 축 최신)을 들고 자신만의
       `getStatus`(호출 B)를 또 낸다 — `start()` 의 원래 호출(호출 A)과 **같은 세션에 대한 두 번째
       `getStatus`**.
    4. **레이스**: B(boot 토큰 보유)가 먼저 응답해 `WAITING(n1)` + `openStream` 으로 스트림을 세우고,
       그 위에서 SSE 로 대화가 실제로 `n2` 까지 전진한 **뒤**, A(`start()` 소유, `attempt` 없음)가
       뒤늦게 옛 스냅샷(`n1`)으로 응답하면 — A 의 `WAITING` dispatch 는 `attempt` 가 없어 boot
       재검증을 건너뛰고, world 도 이 시나리오 내내 안 바뀌었으므로(`528`행 `isStale(gen)` 도 통과)
       **무조건 실행돼 화면을 `n2` → `n1` 로 되감는다**. 리듀서의 `ended` 가드(`widget-state.ts:165`)도
       이 시점 phase 가 `awaiting_user_message` 라 적용되지 않는다.
    5. **실측 재현**(격리 worktree, `use-widget-eager-start.test.ts` 에 임시 probe 테스트 추가 후 실행,
       확인 뒤 제거 — 공유 worktree 는 건드리지 않음):
       ```
       boot() → embed 허용 → config 확립(저장 세션 없음)
       open() → start(): webhook 202 → persist() 로 세션 storage 기록 → 자신의 getStatus(A) 발사(in-flight)
       boot() 재전송 → applyConfig: sessionEstablished()===false(스트림 미확립) → loadSession 성공
         → 복원분기 진입 → 자신의 getStatus(B, attempt 보유) 발사(in-flight)
       B 응답(waiting_for_input n1) → WAITING(n1) dispatch, openStream() → pending.nodeId === "n1"  ✓ 통과
       SSE 로 n2 emit → pending.nodeId === "n2"                                                      ✓ 통과
       A 응답(옛 스냅샷 n1) → WAITING(n1) dispatch(attempt 없어 무검증) → pending.nodeId === "n1"
       최종 단언 expect(pending.nodeId).toBe("n2") → FAIL: "expected 'n1' to be 'n2'"
       ```
       마지막 단언 직전까지 모든 중간 단언(`n1` 표면 확립, 스트림 open, `n2` 로 전진)이 **먼저
       통과**한 뒤 최종 단언만 실패해, 트레이스 각 단계 가정이 정확함을 코드가 직접 확인해 줬다.
       재현 후 probe 테스트는 제거, 전체 스위트(390 passed/22파일 — RESOLUTION.md 수치와 일치)
       재확인, 격리 worktree 는 `git worktree remove --force` 로 삭제했다.
    6. **결과가 "단순 flicker" 가 아닌 이유**: C2 CRITICAL 과 동일 근거 — 되감긴 `n1` 표면에 사용자가
       응답하면 `sendCommand` 가 이미 지나간 `nodeId` 로 명령을 보내 백엔드가 거부/무시할 수 있다
       (고착). 부수적으로 `start()` 는 이후 `isStale(gen)` 도 통과해 `openStream`/`scheduleRefresh` 를
       한 번 더 실행한다 — `scheduleRefresh` 는 `clearRefreshTimer()` 를 먼저 호출해 자체 idempotent
       (`use-token-refresh.ts:74`, 타이머 누수 아님)하고 `openStream` 도 `closeStream()` 을 먼저 호출해
       (`438`행) EventSource 누수는 아니지만, 방금 세운 연결을 곧바로 재개설하는 낭비 왕복이 추가된다.
    7. **이 diff 의 자기-검증 실패**: 이 finding 은 (a) 코드 JSDoc 의 명시적 안전 주장(`504-505`행),
       (b) plan 문서의 동일 주장(`webchat-boot-single-flight.md:91,141`), (c) 직전 라운드
       concurrency 리뷰의 명시적 종결(`review/code/2026/07/17/18_39_11/concurrency.md` INFO —
       "`start()`(eager 부팅) 진행 중과 `wc:boot` 재전송이 겹치는 경로도... 위 CRITICAL 의 수정...
       이 경로도 함께 닫는다 — 별도 수정 불필요") 세 곳 모두와 **정면으로 배치**된다. 세 곳 다 코드
       추적 기반 결론이었고 실측(재현 테스트)이 없었다 — concurrency.md 자신도 "두 번째 실행 환경에서
       실측하진 않았으나" 라고 명시했다. 이번에 직접 실행해 반증했다.
    8. **origin/main 대비 "신규" 인지 재확인**: `merge-base` 이전 코드는 `sessionEstablished()` 개념
       자체가 없어 **모든** 재전송이 무조건 복원 분기에 진입했다(재전송이 스트림 확립 훨씬 이후에
       와도 매번 재진입) — 즉 이 클래스의 경합 창은 origin/main 쪽이 오히려 더 넓었다. 이번 diff 는
       그 창을 `sessionEstablished()` 로 크게 좁혔지만(진짜 개선), `start()` 쪽 사각지대 하나를
       남긴 채 "안전하다" 고 **새로 문서화**했다 — "이미 존재하던 위험을 그대로 뒀다" 가 아니라
       "위험을 줄이면서 동시에 남은 부분을 안전하다고 잘못 선언한 것" 이라 side_effect 관점에서
       독립적으로 지적할 가치가 있다고 판단했다.
  - 제안: `start()` 도 `beginBootAttempt()` 로 시도 토큰을 받아 자신의 `seedWaitingFromStatus` 호출에
    넘겨 동일한 boot 축 상호배제에 참여시키는 방향을 우선 검토(파일이 이미 확립한 "토큰 하나로
    축을 묶는" 관용구와 일관). 대안으로 `seedWaitingFromStatus` 의 `WAITING` 분기에서 `attempt` 유무와
    무관하게 "함수 시작 이후 `streamRef.current` 가 이미 채워졌는가"(자신이 유일한 확립자인지)를
    한 번 더 재검증하는 방법도 가능. 어느 쪽을 택하든 JSDoc(`504-505`행)과 plan 문서(`91`,`141`행)의
    "world 축만으로 충분" 서술도 함께 정정 필요(아래 두 번째 INFO 항목과 근거가 다르므로 뭉뚱그리지
    말 것). `open()`+즉시 `wc:boot` 재전송 조합의 회귀 테스트 추가를 권장(현재 스위트에 없음 —
    §106 계열 테스트는 전부 `boot()` 대 `boot()` 조합만 다룬다).

- **[INFO]** `sendCommand` 비-410 `ERROR` 이후 SSE 가 열린 채 남는 것은 이번 diff 가 새로 만든
  부작용이 아니며, `sessionEstablished()` 복원-스킵이 재전송 시 `getStatus`/SSE 재발사를 실제로
  막는다 — 기존 회귀 테스트를 격리 환경에서 직접 실행해 재확인.
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:652-697`(`sendCommand`, 특히
    `682-691`행 주석 + `692`행 `dispatch({type:"ERROR",...})`), `314`행(`sessionEstablished`),
    `955`행(재전송 skip 조건), `widget-state.ts:190-191`(`ERROR` case). 테스트 증거:
    `use-widget-eager-start.test.ts:2881-2960`("일시적 명령 실패(500)는 저장 세션을 지우지 않는다"),
    `:2966-3031`("...새로고침하면 살아있는 대화가 복원된다").
  - 상세: `merge-base`(`29aa918a6`) 대비 `sendCommand` catch 블록의 비-410 분기를 diff 로 직접
    대조하면 **주석만 추가**됐고 `dispatch({type:"ERROR", message: errMessage(e)})` 자체는 문자 그대로
    불변이다(A-6 이 `teardownSession()` 을 추가했다가 되돌려 순변경 0 — RESOLUTION.md 자체 서술과
    일치). 즉 "ERROR 후 SSE 가 안 닫힌다" 는 origin/main 부터의 기존 동작이고 이번 diff 의 신규
    side effect 가 아니다. 다만 이번 diff 가 새로 도입한 `sessionEstablished()`(스트림 non-null
    검사)가 정확히 이 상황(phase=`ended` 인데 `teardownSession` 미실행으로 `streamRef` 는 여전히
    non-null)에서도 재전송의 복원 분기를 올바르게 skip 시키는지가 핵심 질문이었다 — 격리
    worktree 에서 위 두 테스트를 `vitest run ... -t "일시적 명령 실패"` 로 단독 실행해 **PASS**
    확인(`statusCalls` 불변, `getEs()` 가 동일 인스턴스 유지, phase 는 `ended` 로 남음 — 즉 추가
    `getStatus` 도 SSE 재오픈도 없음). "ended 인데 스트림이 살아있다" 는 잔여 상태 자체의 근본
    정리(예: `ERROR`→`ended` 재설계)는 이미 `plan/in-progress/
    webchat-command-failure-is-not-termination.md` 로 별도 planner 트랙에 정확히 분리·추적되고
    있어 이번 diff 범위에서 추가 조치가 필요하지 않다고 판단했다.
  - 제안: 없음(확인됨).

- **[INFO]** `execution.replay_unavailable` fire-and-forget 폴백이 `attempt` 없이 부르는 것은 안전하다
  — 도달조건이 재전송 복원 분기와 상호배타적임을 코드로 확인.
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:415-425`(특히 `423`행
    `void seedWaitingFromStatusRef.current?.(client, session);`), `314`행(`sessionEstablished`),
    `955`행(재전송 진입 조건).
  - 상세: `execution.replay_unavailable` 은 오직 **이미 열려 있는** SSE 스트림의 이벤트 리스너
    (`handleEiaEvent`, `openStream` 의 `onEvent`)에서만 발화한다 — 이 폴백이 트리거되는 시점엔
    정의상 `streamRef.current` 가 non-null 이다. 반대로 재전송의 복원 분기(`955`행)는 정확히
    `sessionEstablished()===false`(= `streamRef.current===null`) 일 때만 진입한다. 두 조건이
    상호배타적이므로, 이 폴백의 `getStatus` in-flight 구간에 형제 복원 분기가 **같은 세션**에 대해
    동시에 `seedWaitingFromStatus` 를 호출하는 경로는 존재하지 않는다(스트림이 그 사이 다른 사유로
    닫히는 경로 — `teardownSession()`, 언마운트 — 는 전부 world 축 무효화 또는 storage 소거를
    동반해 `isStale(gen)`/`loadSession()` 이 각각 안전하게 처리함도 함께 확인). `start()` 케이스와
    달리 이 폴백은 위 CRITICAL 의 재현 조건(같은 세션에 대해 attempt-보유 호출과 attempt-미보유
    호출이 **동시에** in-flight) 자체가 성립하지 않는다.
  - 제안: 없음. 다만 JSDoc(`504-505`행)이 `start()`와 이 폴백을 한 문장으로 묶어 "둘 다 world 축만
    필요"라 서술하는데, 근거는 서로 다르다(하나는 상호배제로 참, 하나는 위 CRITICAL 로 거짓) — 향후
    유지보수자가 "이미 같이 검증된 짝"으로 오인하지 않도록 두 근거를 분리 서술하면 좋겠다
    (documentation 성격의 참고 제안).

- **[INFO]** `AI_MESSAGE` 리듀서 케이스에 `ended` 가드가 없어, ERROR 이후 잔존한 SSE(위 두 번째
  항목)로 추가 이벤트가 오면 "ended" 로 보이는 위젯에도 메시지가 계속 쌓일 수 있다 — 이번 diff 의
  신규 부작용은 아니며 이미 별도 plan 대상.
  - 위치: `codebase/channel-web-chat/src/lib/widget-state.ts:174-180`(`AI_MESSAGE` case, `phase`
    미검사), 대조 `165`행(`WAITING` 의 `ended` 가드).
  - 상세: `merge-base` 대비 `AI_MESSAGE` case 는 이번 diff 에서 전혀 수정되지 않았다(무변경 확인).
    잔존 스트림에 `execution.ai_message`/`execution.message` 류가 도달하면 `phase` 검사 없이
    `messages` 에 append(+ `open===false` 면 `unread` 증가)한다. 이미 `webchat-command-failure-is-not-
    termination.md` 의 결정 대상(`ERROR`→`phase:"ended"` 자체의 재설계)에 자연히 포섭되는 사안이라
    이번 diff 가 새로 만든 갭은 아니다.
  - 제안: 없음(참고). 위 planner 트랙 plan 처리 시 함께 고려 권장.

- **[INFO]** 신규 심볼(`bootGenRef`/`unmountedRef`/`beginBootAttempt`/`cannotApplyConfig`/
  `isAttemptStale`/`sessionEstablished`, `seedWaitingFromStatus` 의 신규 3번째 인자)은 전부
  `useWidget()` 클로저 내부 전용 — 전역변수·공개 인터페이스·시그니처·환경변수·파일시스템·네트워크
  엔드포인트·host 콜백 어느 쪽에도 예상 밖 부작용 없음.
  - 위치: 선언부 `use-widget.ts:182`(`bootGenRef`), `184`(`unmountedRef`), `274`(`beginBootAttempt`),
    `287`(`cannotApplyConfig`), `292`(`isAttemptStale`), `314`(`sessionEstablished`),
    `515`(`seedWaitingFromStatus` 3번째 파라미터).
  - 상세: `grep -rn` 으로 저장소 전체를 확인한 결과 위 심볼은 모두 `use-widget.ts` 밖에서 참조되지
    않는다(`widget-state.test.ts` 의 1건은 주석 속 언급일 뿐 실제 import/사용이 아님을 직접 확인).
    `export` 된 곳도 없다. `useWidget()` 이 반환하는 공개 API(`apiRef` = `open`/`close`/
    `submitMessage`/`closeStream`/`show`/`hide`/`updateProfile`/`newChat`, `879-881`행)는 이번 diff 로
    멤버 목록·시그니처 모두 불변(merge-base 와 동일 라인 확인). `wc:boot`/`wc:command`/`wc:event`
    postMessage 프로토콜 형태도 불변. `seedWaitingFromStatus` 의 신규 파라미터는
    `attempt?: {boot:number}` — optional 이라 기존 2-인자 호출부(`start()`, replay_unavailable
    폴백)와 하위호환. diff 전체에 `process.env` 읽기/쓰기, 파일시스템 API 호출은 없음(코드 diff
    재확인). 새 module-level(전역) 변수도 없음 — 전부 `useRef`/`useCallback` 클로저 지역. host
    콜백(`bridgeRef.current?.sendEvent(...)`) 중복 발사 여부도 위 CRITICAL 재현 경로에서 함께
    확인했다 — `start()` 의 `conversationStarted` 는 boot#2(재전송 restore 분기)에서 재호출되지
    않고(그쪽은 `BOOTED` 가 아니라 `RESTORED` 를 dispatch, 후자엔 대응 `sendEvent` 없음), 위 CRITICAL
    레이스 도중 `conversationEnded` 가 이중 발사되는 경로도 없음(그 경로엔 `finalizeEnded` 호출이
    전혀 없다).
  - 제안: 없음(체크리스트 2·3·4·5·6·7 항목 모두 clear).

## 요약

`sendCommand` 비-410 경로가 `teardownSession()` 없이 `ERROR` 만 dispatch 하는 것 자체는 origin/main
부터의 기존 동작(A-6 는 추가했다 되돌려 순변경 0)이며, 이번 diff 가 새로 도입한
`sessionEstablished()` 복원-스킵이 그로 인한 SSE 잔존 상태에서도 재전송의 `getStatus`/SSE 재발사를
실제로 막는다는 것을 기존 회귀 테스트(격리 재실행, PASS)로 확인했다 — 이 축은 새로운 부작용이
없다. `execution.replay_unavailable` 폴백이 `attempt` 없이 `seedWaitingFromStatus` 를 부르는 것도
도달조건의 상호배제로 안전함을 코드 추적으로 확인했다. 그러나 같은 문장으로 "안전하다" 고 묶인
세 번째 호출부 `start()` 는 다르다 — eager 시작의 세션-persist 직후·자기 `getStatus` 응답 전이라는
좁은 창에서 `wc:boot` 재전송이 새로 도입된 boot 축 재검증을 정당하게 받으며 같은 세션에 개입할 수
있는데, `start()` 자신의 `seedWaitingFromStatus` 호출은 그 축에 전혀 참여하지 않아 재전송이 이미
SSE 로 전진시킨 화면을 뒤늦게 되감을 수 있음을 격리 worktree 에서 직접 재현했다(중간 단언까지 전부
통과 후 최종 단언만 실패 — 트레이스 정확성 확인됨). 이는 이 diff 자신의 JSDoc·plan 문서의 명시적
안전 주장, 그리고 직전 라운드 concurrency 리뷰가 코드 추적만으로 내렸던 "별도 수정 불필요" 종결
판정과 정면으로 배치되는 실측 결과다 — origin/main 대비 경합 창 자체는 이번 diff 로 크게 좁아졌지만
(진짜 개선), 남은 좁은 창을 "닫혔다" 고 문서화한 것이 새로운 문제다. 그 외 신규 ref/콜백은 전부
`useWidget()` 클로저 내부에 완전히 격리돼 있어 전역 상태·공개 인터페이스·환경변수·파일시스템·host
콜백 축에서는 예상 밖 부작용을 찾지 못했다.

## 위험도

CRITICAL

STATUS=success side_effect PATH=/Volumes/project/private/clemvion/.claude/worktrees/webchat-boot-single-flight-8c92b4/review/code/2026/07/17/23_58_23/side_effect.md risk=CRITICAL
