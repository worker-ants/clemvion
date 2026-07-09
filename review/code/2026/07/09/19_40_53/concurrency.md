# 동시성(Concurrency) Review 결과

> 대상: 웹채팅 위젯 세션 컨트롤(새 대화/대화 종료) + `getStatus` durable `conversationThread` 새로고침
> 히스토리 복원. 본 라운드(19_40_53)의 직접 diff 는 review 산출물(md/json)·spec 문서뿐이었으나, 그 diff 가
> 참조하는 실제 코드 변경(`codebase/channel-web-chat/src/widget/use-widget.ts` 의 `startGenRef` 세대
> 토큰·`resetSessionRefs`·`endConversation`·`newChat`)은 이전 3개 라운드(18_44_10/19_06_55/19_26_15) 어느
> 곳에서도 `concurrency` 리뷰어가 실제 산출물을 내지 않았다(라우터 후보 목록엔 있었으나 강제/자동선정에서
> 이번까지 빠짐 — 커버리지 공백). 이에 `git diff origin/main...HEAD -- codebase/` 로 실제 코드 변경분을
> 직접 확인해 독립적으로 재검증했다(메모리: "리뷰 changeset이 직전 검토 코드 제외" 오판 방지).

## 발견사항

- **[WARNING]** `start()` 의 `catch` 블록이 `startGenRef` 세대 검사를 하지 않아, 무효화된(superseded)
  in-flight `start()` 의 실패가 최신 대화 상태를 되돌려 쓸 수 있음
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:274-307`(`start`), 특히 `:303-306`(`catch` 블록).
    비교: `:289`, `:299` 는 `if (startGenRef.current !== gen) return;` 로 gen 을 검사하지만 `catch` 는 검사 없음.
  - 상세: `start()` 는 `booting` 중 `newChat`/`endConversation` 이 호출돼 옛 execution 이 되살아나는 race 를
    막기 위해 `startGenRef` 세대 토큰을 도입했고, `try` 블록 내부 두 지점(webhook POST 응답 직후·`getStatus`
    시드 직후)에서는 `startGenRef.current !== gen` 이면 즉시 반환해 stale 결과를 폐기한다. 그러나 **`catch`
    블록에는 동일한 gen 검사가 없다** — `client.startConversation(...)` 자체가 reject(네트워크 오류·비-2xx
    → `EiaError`, `eia-client.ts:65-68`)하면 gen 과 무관하게 항상:
    1. `startedRef.current = false;` — 실행 순서: `newChat()`/`endConversation()` → `resetSessionRefs()`
       (`teardownSession` 이 gen 증가) → `startedRef.current = false` → `void start()`(새 gen 캡처,
       `startedRef.current = true`). 이 새 `start()` #2 가 아직 자신의 webhook POST 를 await 중일 때, **옛(gen
       불일치) `start()` #1** 의 POST 가 뒤늦게 실패해 `catch` 에 진입하면 `startedRef.current` 를 다시
       `false` 로 되돌린다 — `start()` #2 가 여전히 진행 중(또는 방금 성공)인데도 재진입 가드가 무력화된다.
       이 시점에 `open()`(재open)·host `resetSession` 커맨드 등 외부 트리거로 `start()` 가 재호출되면
       `sessionRef.current` 도 아직 null(persist 전)이라 가드(`:278`)를 통과 — **3번째 webhook POST(중복
       execution 시작)** 가 발생할 수 있다. 이는 `start()` JSDoc 자신이 명시한 §R6/W10 불변식("1회만 시작 —
       재open·중복 open 에서 재시작 방지")을 정확히 이 신규 도입된 gen-guard 패턴의 사각지대에서 위반한다.
    2. `dispatch({ type: "ERROR", message: errMessage(e) })` — `widgetReducer` 의 `ERROR` 케이스
       (`codebase/channel-web-chat/src/lib/widget-state.ts:152-153`)는 `phase` 를 **무조건** `"ended"` 로
       설정한다(현재 phase 가 무엇이든). 옛 `start()` #1 의 실패가 새 `start()` #2 성공(`BOOTED`/`WAITING` 이미
       dispatch 됨) **이후**에 도착하면, 이미 정상 진행 중인 새 대화의 `phase` 를 옛 실패의 일반화 에러
       메시지와 함께 `"ended"` 로 덮어쓴다. `start()` #2 의 `sessionRef`/`streamRef` 는 그대로 살아있어
       SSE 는 계속 수신되지만(다음 `WAITING`/`AI_MESSAGE` 이벤트가 도착해야 phase 가 다시 갱신됨), 그
       사이 사용자는 정상 진행 중인 대화를 "종료됨/오류" 화면으로 오인하게 된다(sticky, 다음 이벤트
       도착까지 지속 가능).
  - 이 race 는 `endConversation`/`newChat` 이 **사용자가 언제든 즉시 트리거**할 수 있는 UI 컨트롤로
    이번 diff 에서 신규 노출됐기 때문에(이전엔 SSE terminal 이벤트·마운트 시 1회뿐), 실제로 부딪힐 확률이
    이번 changeset 으로 유의미하게 올라간다(예: booting 중 네트워크 지연/일시적 5xx 상황에서 사용자가 "새
    대화"를 누르는 흔한 시나리오).
  - 재현 스케치: `client.startConversation` 을 pending 상태로 만든 뒤 `open()` → `booting` 확인 → `newChat()`
    호출(내부적으로 새 `start()` #2 트리거, `booting` 유지) → 이제 `resolveWebhook(reject)` 로 **#1 을
    실패시킴** → `startedRef.current` 가 false 로 되돌아가고 `phase` 가 `"ended"`+에러로 강제 전환되는지
    확인. 현재 저장소의 `use-widget-eager-start.test.ts:664-726` 테스트는 이 **성공-지연** 케이스만 커버하고
    (`resolveWebhook` 를 202 로 resolve), **실패-지연**(reject) 케이스는 다루지 않아 이 회귀가 그린 상태로
    유입됐다.
  - 제안: `catch` 블록 최상단에 `if (startGenRef.current !== gen) return;` 을 추가해 `try` 블록의 두 검사와
    대칭을 맞춘다(가장 낮은 리스크의 최소 수정). 회귀 테스트로 "booting 중 새 대화 → 옛 webhook 이 **실패**로
    뒤늦게 resolve → `startedRef`/`phase` 무변화(이미 새 시도가 소유)" 케이스를 `use-widget-eager-start.test.ts`
    에 추가 권장(기존 664행 테스트의 reject 버전).

- **[INFO]** `sendCommand`(기존 코드, 이번 diff 대상 아님)도 동일 계열의 "stale 비동기 실패가 최신 상태를
  덮어씀" 패턴을 가지고 있으나, 이번 changeset 으로 노출 빈도가 올라갈 수 있어 참고 기록
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:309-326`(`sendCommand`, 무변경).
  - 상세: `submitMessage`/`clickButton`/`submitForm` 이 호출하는 `sendCommand` 는 세션/클라이언트 참조를
    캡처한 뒤 `client.interact(...)` 실패 시 세션 동일성(gen 또는 `sessionRef` 재확인) 없이 `dispatch({
    type: "ENDED" | "ERROR", ... })` 를 발사한다. 이전에는 명령 in-flight 중 세션이 바뀔 방법이 SSE terminal
    이벤트뿐이었지만, 이번 diff 로 사용자가 명령 in-flight 중에도 `endConversation`/`newChat` 을 즉시 호출할
    수 있는 헤더 컨트롤이 추가돼, 옛 명령의 지연 실패(예: 410/네트워크)가 **새로 시작된 대화**의 phase 를
    `"ended"`/`"error"` 로 되돌려 쓸 여지가 pre-existing 대비 커진다. 이번 diff 자체가 만든 결함은 아니지만
    (코드 변경 없음), 위 `start()` WARNING 과 동일 근본 원인(비동기 콜백의 세션/세대 식별 누락)이라 함께
    고치는 편이 일관적이다.
  - 제안: 이번 PR 필수 아님. 후속으로 `sendCommand` catch 에도 "이 명령이 겨냥한 `session.executionId` 가
    현재 `sessionRef.current?.executionId` 와 같을 때만 dispatch" 가드를 추가하는 걸 권장(백로그).

- **[INFO]** `Panel` 확인(confirm) 다이얼로그의 "확정" 버튼 — 극히 좁은 이론적 재진입 창(실사용 리스크 낮음)
  - 위치: `codebase/channel-web-chat/src/widget/components/panel.tsx`(`CONFIRM_COPY[confirming].action(actions)`
    → `setConfirming(null)`).
  - 상세: 확정 클릭이 `action(actions)`(async, 반환값 미대기)과 `setConfirming(null)`(동기)을 같은 핸들러에서
    실행한다. React 커밋 전에 같은 버튼이 두 번째 클릭 이벤트를 받으면 `endConversation()`/`newChat()` 이
    두 번 트리거될 수 있으나, `endConversation()` 자체는 첫 호출에서 이미 `dispatch({type:"ENDED"})` 를
    동기적으로 먼저 실행하므로(await 지점 이전) 실제 이중 클릭 타이밍(수십~수백ms)에서는 재현 가능성이
    낮다. 별도 조치 불필요(참고로만 기록).

## 요약

이번 라운드의 직접 diff(review 산출물 + spec 문서)만 놓고 보면 동시성 관련 코드는 없다. 그러나 `concurrency`
리뷰어가 이 feature 의 실제 코드(3개 커밋에 걸친 `use-widget.ts` 변경)를 지금까지 어느 라운드에서도 검토한
적이 없었다는 커버리지 공백을 확인해 `git diff origin/main...HEAD -- codebase/` 로 직접 검증했다. 그 결과
신규 도입된 `startGenRef` 세대 토큰 가드가 `start()` 의 성공 경로(두 await 지점)에는 정확히 적용됐지만
**실패(`catch`) 경로에는 적용되지 않아**, teardown 으로 무효화된 옛 `start()` 시도의 지연 실패가 (1) 재진입
가드(`startedRef`)를 되돌려 잠재적 중복 execution 시작을 열고 (2) 이미 정상 진행 중인 새 대화의 phase 를
`"ended"`+에러로 강제 전환할 수 있는 실질적 race condition 을 발견했다(WARNING). 이는 이번 diff 가 새로
노출한 사용자 트리거(헤더 "새 대화"/"대화 종료" 버튼)로 인해 실제로 부딪힐 확률이 올라간 회귀이며, 기존
테스트(`use-widget-eager-start.test.ts:664-726`)는 성공-지연 케이스만 커버해 이 gap 을 놓쳤다. 수정은
`catch` 블록 최상단에 기존 두 지점과 동일한 gen 검사 한 줄을 추가하는 낮은 리스크의 패치로 해소 가능하다.
그 외 데드락·락 경합·스레드풀·이벤트루프 블로킹 관련 이슈는 없다(브라우저 단일 스레드 + React ref/reducer
기반, 백엔드 `getStatus()` 변경은 요청-스코프 순차 read-only 조회로 신규 동시성 위험 없음).

## 위험도
MEDIUM
