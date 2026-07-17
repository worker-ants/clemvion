# 동시성(Concurrency) 리뷰 — webchat-boot-single-flight

대상: `codebase/channel-web-chat/src/widget/use-widget.ts`(핵심) · `src/lib/widget-state.ts` ·
`src/widget/use-widget-eager-start.test.ts` · `src/lib/widget-state.test.ts` ·
`plan/in-progress/webchat-boot-single-flight.md` · `spec/7-channel-web-chat/2-sdk.md`(§106)

검증 방법: 정적 추적만으로는 확신이 서지 않는 두 가지 축-상호작용 가설을, 공유 워크트리를 건드리지 않고
`git worktree add --detach`로 격리한 임시 워크트리에서 재현 테스트를 작성·실행해 확인했다(작업 종료 후
`git worktree remove`로 제거, 소스는 무수정). 아래 CRITICAL·WARNING 두 건은 **가설이 아니라 실측 재현**이다.

---

## 발견사항

- **[CRITICAL]** 복원 분기의 "종료 감지"가 world 축을 오염시켜, **대체(superseded)된 부팅이 아직 살아있는 진짜 마지막 부팅까지 함께 무효화** — §106 위반을 실측 재현 (Q1·Q4 관련)
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:848-872`(`applyConfig` 복원 분기) ·
    `:445-499`(`seedWaitingFromStatus`, 특히 `:458`·`:464-467` terminal 분기) ·
    `:282-316`(`teardownSession`, `:312` `worldGenRef.current++`) ·
    `:261-270`(`beginBootAttempt`/`isAttemptStale`)
  - 상세:
    `beginBootAttempt`의 JSDoc(`:207-209`)은 "**부팅 시도는 세계를 바꾸지 않는다**"고 단언하지만, 이는
    복원 분기에서는 사실이 아니다. 흐름:
    1. 부팅 A(먼저 보낸 `wc:boot`)가 `isEmbedAllowed` 재검증(`:838`)을 통과해 `establishConfig`를
       실행하고, 저장된(이전 마운트가 남긴) 세션을 발견해 복원 분기(`:849-872`)로 진입한다.
       `sessionRef.current = saved`·`dispatch(RESTORED)`는 **자신의 두 번째 staleness 재검증(`:868`)
       이전에 무조건 실행**된다.
    2. A의 `seedWaitingFromStatus`(getStatus)가 in-flight인 동안 부팅 B(재전송, §106상 이겨야 할
       "마지막 wc:boot")가 도착 — `beginBootAttempt()`가 `bootGenRef`를 올려 A를 boot 축에서
       **정상적으로** superseded 상태로 만든다(아직 A 자신은 이를 모른다 — 다음 await 뒤에나 확인).
    3. A의 getStatus가 뒤늦게 `status: "completed"`(terminal)로 resolve. `seedWaitingFromStatus`
       내부의 `isStale(gen)`(`:458`, world 축만 봄)은 아직 world가 안 바뀌었으므로 통과 →
       `finalizeEnded`(`:465`) 호출 → `teardownSession`(`:312`) → **`worldGenRef.current++`**.
       이 세션이 실제로 서버에서 끝난 게 맞으므로 이 자체는 "정당한" 이벤트다.
    4. 그런데 `isAttemptStale`(`:266-269`)은 `worldGenRef.current !== attempt.world || bootGenRef.current
       !== attempt.boot`로 **두 축을 OR로 묶는다**. B가 이미 `beginBootAttempt()`로 캡처해 둔
       `attempt.world`는 3단계의 bump **이전** 값이므로, B가 나중에 `isAttemptStale(attemptB)`를
       검사하면 **boot 축은 여전히 자신이 최신인데도 world 축 하나 때문에** stale 판정을 받고 bail한다.
    5. 결과: B는 `establishConfig`(따라서 `configRef`/`setConfig`/`useWidget().config`)를 **한 번도
       실행하지 못한 채** 조용히 사라진다. 최종 `config`는 A(먼저 보낸, 이겨선 안 될 부팅)의 값에
       영구 고착되고, 이를 되돌릴 후속 이벤트가 없다(다음 `wc:boot`이 오기 전까지).

    **실측 재현**(임시 워크트리, vitest): `bootWithPlan("A")` → embed-config 허용 → 복원 진입,
    getStatus in-flight로 고정 → `bootWithPlan("B")` 전송(embed-config 미해결로 대기) → A의 getStatus를
    `status:"completed"`로 resolve → 이 시점 로그 `config.plan=A, phase=ended` → B의 embed-config를
    허용으로 resolve → **최종 로그 `config.plan=A`**(기대값은 spec §106에 따라 `B`). 즉
    `expect(result.current.config?.profile?.plan).toBe("B")`가 **재현 가능하게 실패**한다.

    이 시나리오는 plan의 A-5 mutation 매트릭스("world 축 무력화")와 다르다 — 매트릭스는 *가드를 없앴을
    때* 무엇이 잡히는지를 본 것이고, 이 버그는 *가드가 의도대로 작동하는 중*에 두 정당한 이벤트(축 대체
    A, world 무효화 B)가 상호작용해 생긴다. 새로 추가된 두 §106 테스트("resolve 순서 역전"·"복원 seed
    중 재전송") 중 후자는 정확히 이 모양이지만 status를 `"running"`(비-terminal)으로만 검증해 이 갭을
    비켜갔다 — 즉 **테스트 스위트가 이 실패 유형을 아직 고정하지 않았다**.

    도달 가능성에 대한 참고: plan은 "오늘의 유일한 재전송 경로는 관리자 라이브 미리보기"라고 적었지만,
    이 버그의 전제 (a) 이전 마운트에서 SSE 연결이 끊긴 채(백그라운드 tab 등) 서버 쪽에서 종료된 세션이
    `sessionStorage`에 남아있는 것, (b) 초기화 중 `wc:boot`을 짧은 간격으로 두 번 보내는 것(예: 익명
    config 선-부팅 → 프로필 조회 후 재전송) 은 관리자 미리보기에 국한되지 않는 흔한 SDK 통합 패턴이며,
    §106 자체가 "host는 iframe을 재생성하지 않고 wc:boot을 다시 보낼 수 있다"고 명시적으로 허용한다.
  - 제안:
    복원 분기 전용으로 `seedWaitingFromStatus`의 terminal 부수효과(`finalizeEnded` 호출)를 boot 토큰과
    함께 게이팅하는 방향을 검토할 것 — 예를 들어 restore 분기 전용 래퍼가 getStatus 응답을 받은
    "직후"(내부에서 `finalizeEnded`를 호출하기 **직전**) boot 축만 재검사해(world는 이 시점에 아직
    의미가 없다 — 지금 이 호출이 world를 바꾸려는 참이므로) 이미 대체된 시도라면 그 부수효과 자체를
    억제하는 것. 단 `seedWaitingFromStatus`는 `start()`·`replay_unavailable` 폴백에서도 호출되므로
    boot 토큰이 없는 그 두 호출부는 그대로 두고, `applyConfig` 복원 분기 호출에만 옵션 파라미터/래퍼로
    적용해야 한다. 최소한, 위에서 재현한 시나리오를 정식 회귀 테스트로 고정할 것(§106 두 번째 테스트의
    `status: "running"`을 `"completed"`로 바꾼 변형).

- **[WARNING]** `applyConfig` 복원 분기의 `openStream`/`scheduleRefresh`는 `state.phase`를 전혀 보지 않는다 — A-6 reducer 가드는 **가시적 phase만** 보호하고, 그 아래 SSE 연결·갱신 타이머는 무방비 (재현 완료)
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:849-872`(특히 `:870-871` `openStream`/
    `scheduleRefresh`) · `codebase/channel-web-chat/src/lib/widget-state.ts:125-143`(A-6 `RESTORED`/
    `BOOTED` 가드)
  - 상세:
    A-6이 막는 것은 "리듀서가 `ended`에서 `RESTORED`/`BOOTED`를 받아 `streaming`으로 전이하는 것"
    뿐이다. 그런데 `applyConfig`의 복원 분기에서 `openStream(saved, "0")`+`scheduleRefresh()`
    (`:870-871`)를 실행할지 결정하는 조건은 `outcome !== "continue"`와 `isAttemptStale(attempt)`
    뿐이며, **`state.phase`나 리듀서가 그 dispatch를 실제로 받아들였는지는 전혀 확인하지 않는다.**
    즉 리듀서가 "무시했다"고 해서 `use-widget.ts`의 명령형 부수효과(EventSource 생성, 토큰 갱신
    타이머 예약)까지 멈추지는 않는다.

    **실측 재현**: `ERROR`로 종료(세션은 정리되지 않음, 이 diff의 A-6이 다루는 정확히 그 케이스) →
    `wc:boot` 재전송(같은 endpoint, non-terminal getStatus 응답) → 최종 `state.phase === "ended"`는
    유지되지만(A-6 성공) `getEs()`가 **null이 아닌 살아있는 EventSource 인스턴스**를 반환 — 즉 "종료됨"
    으로 표시된 위젯 아래에서 실제로는 죽은 execution을 향한 SSE 연결이 새로 열리고 갱신 타이머도
    예약된다.
  - 제안:
    A-6은 이 diff의 범위 밖(사전 존재하는 `sendCommand`의 "ERROR는 teardown 안 함" 설계)에 대한
    부분적 완화이므로 지금 당장 막을 필요는 없을 수 있으나, "재현 확인" 완료 상태로 plan에 남은
    A-6의 검증 서술이 "부활 방지"를 **가시적 phase 기준으로만** 검증했다는 점은 명시해 둘 필요가
    있다. 최소 조치로 `openStream`/`scheduleRefresh` 직전에 `state.phase !== "ended"`(또는 동등한
    ref 기반 신호) 재검사를 추가하거나, 후속 이슈로 `sendCommand`의 ERROR 경로 자체가 teardown을
    생략하는 이유를 재검토할 것을 권한다.

- **[INFO]** Q2 — `start()`/`sendCommand`/`seedWaitingFromStatus`가 world 축만 보는 비대칭은 타당하나, 근거가 `beginBootAttempt` 쪽에 명시돼 있지 않다
  - 위치: `use-widget.ts:530-577`(`start`) · `:161-196`(`worldGenRef`/`pendingResetRef` JSDoc) ·
    `:243-260`(`beginBootAttempt` JSDoc)
  - 상세: `start()`는 호출 시작 시 `cfg = configRef.current`/`client = clientRef.current`를 **지역
    클로저로 캡처**해 이후 끝까지 그 값을 쓴다. 따라서 boot A로 시작된 `start()`가 webhook POST
    왕복 중일 때 boot B가 `establishConfig`로 `configRef`/`clientRef`를 덮어써도, 그 `start()`는
    world 축(`isStale(gen)`)만으로 충분히 안전하다 — crash나 세션 뒤섞임은 없다. 다만 **이미 발사된
    webhook은 A의 `triggerEndpointPath`/`profile`을 담고 있으므로, "적용된 config"는 B인데
    "실제로 시작된 execution"은 A의 페이로드를 반영하는 미묘한 괴리**가 생길 수 있다. 이는 새로운
    구멍이 아니라, 코드가 이미 `updateProfile`(§3.2 "진행 중 execution의 기전송 profile은 소급 변경
    불가")과 `pendingResetRef`의 "불변식 의존 주의"(재전송 호출부가 endpoint를 안 바꾼다는 전제)에서
    인정하고 있는 것과 **동일한 경계**에 기대고 있다. 즉 `start()`가 boot 축을 볼 필요는 없다는 판단은
    맞지만, 그 안전성의 근거(동일 endpoint 무재마운트 재전송 전제)가 `pendingResetRef` JSDoc에만
    있고 `beginBootAttempt`/`start()` 쪽에는 교차 참조가 없다.
  - 제안: `beginBootAttempt` JSDoc 또는 `start()` JSDoc에 "이 함수가 boot 축을 보지 않아도 안전한
    이유는 `pendingResetRef`가 이미 기대는 동일-endpoint 재전송 전제와 같다"는 한 줄 교차 참조를
    추가하면, 향후 그 전제가 깨질 때(예: 리마운트 없는 endpoint 전환 지원) 함께 재검토해야 할 지점이
    한 곳 더 늘어난다는 사실이 누락되지 않는다.

- **[INFO]** Q3 — `!cfg.apiBase` 조기 return이 세대를 안 올리는 판단은 코드로 확인, 문제 없음
  - 위치: `use-widget.ts:830`(guard) vs `:835`(`beginBootAttempt()` 호출)
  - 상세: guard가 `beginBootAttempt()` 호출보다 앞서 있어, 잘못된/불완전한 `wc:boot`은 `bootGenRef`를
    전혀 건드리지 않는다. 따라서 (a) 유효한 부팅이 무효한 재전송에 의해 밀려나지 않고, (b) 무효한
    부팅이 먼저 오고 유효한 부팅이 뒤에 와도 세대 번호에 구멍이 생기지 않는다. JSDoc의 주장("올리면
    죽은 대체자가 살아있는 시도를 밀어낸다")과 실제 구현이 일치한다.

- **[INFO]** Q4 — 3개 이상 겹친 부팅 + 임의 resolve 순서에서 §106: "boot 축만 고려하면" 성립을 증명 가능하나, 위 CRITICAL과 결합하면 깨진다
  - 상세: `bootGenRef`는 `wc:boot` **수신 순서**대로(각 `onBoot` 콜백은 메시지 이벤트마다 동기 실행)
    단조 증가하고, `isAttemptStale`의 boot 비교는 항상 **현재(최신) 값**과의 부등호 비교이므로, N개의
    부팅이 모두 수신된 시점 이후로는 N번째(마지막으로 보낸) 시도의 `attempt.boot`만이 다시 일치할 수
    있다 — 이는 각 시도의 `isEmbedAllowed`/`seedWaitingFromStatus`가 어떤 순서로 resolve하든
    무관하다(boot 축만 놓고 보면 순서-불변 증명 가능). 그러나 위 CRITICAL 발견이 보여주듯, N-1개의
    "패배할" 시도 중 **하나라도** 복원 분기에서 terminal 세션을 발견하면 세계 축이 오염되어 진짜
    승자(N번째)까지 죽일 수 있다 — 겹친 부팅 수가 늘수록 그런 후보가 늘어나므로 이 조건부 실패는 N이
    커질수록 오히려 더 잘 트리거된다. 즉 "3개 이상, 모든 resolve 순서"라는 질의에 대한 정확한 답은:
    **boot 축 자체의 승자 결정은 순서 불변으로 성립하지만, §106이 실제로 지켜지는지는 그렇지 않다** —
    위 CRITICAL이 그 반례다.

- **[INFO]** Q5 — `establishConfig` 비-async 추출은 동시성 관점에서 인터리빙을 바꾸지 않는다(순수 구조적 강제)
  - 위치: `use-widget.ts:809-825`(`establishConfig`) · `:693-716`(`newChat`, 호출 시 관여) ·
    `:846`(호출부)
  - 상세: 일반(비-async) 함수 호출은 마이크로태스크 경계를 만들지 않으므로, 이 추출은 인라인 코드였을
    때와 **정확히 동일한 인터리빙 특성**을 가진다 — 변하는 것은 오직 "이 구간에 `await`를 넣으면
    `TS1308`로 컴파일이 막힌다"는 컴파일 타임 보장뿐이다. `establishConfig → (조건부)
    apiRef.current.newChat() → resetSessionRefs()/teardownSession() → dispatch(NEW_CHAT) →
    start()의 첫 `await` 직전까지`가 **하나의 동기 실행-완료(run-to-completion) 블록**으로 유지됨을
    추적 확인했다 — 즉 B가 추가하기 전부터 있던 "config 확립 + 리셋 재생"의 원자성이 이 추출로 인해
    깨지거나 넓어지지 않는다. `useCallback(establishConfig, [])`의 빈 deps도 오직 ref/`setState`
    setter만 참조하므로 stale closure 위험이 없다(다른 `useCallback`들과 동일 패턴). 이 항목은
    안전하며, 오히려 "규율이 아니라 구조" 원칙의 좋은 예시로 판단된다 — 부작용 없음.

- **[INFO]** `widget-state.ts`의 A-6 리듀서 가드(`RESTORED`/`BOOTED`에 `ended` 조기 return, `:136`·`:142`) 자체는 순수 동기 리듀서 코드라 동시성 원시 개념(락/원자성 등)이 적용되지 않는다. 다만 위 WARNING이 보여주듯, 이 가드는 "리듀서에 도달하는 모든 dispatch가 통과하는 단일 지점"이라는 장점이 있는 동시에, **정확히 그 이유로 리듀서 도달 이전에 이미 실행된 부수효과(SSE open 등)는 막지 못한다**는 한계를 태생적으로 갖는다. 새 `it.each` 테스트(`widget-state.test.ts`)는 리듀서 단위로는 견고하지만, 통합 테스트가 "phase는 지켜졌다"만 보고 "부수효과도 없었다"까지는 확인하지 않는 사례가 위 WARNING이다.

---

## 질의 대응 요약

1. **두 축 모순/중첩 반증** — CRITICAL 발견으로 반증됨: `isAttemptStale`의 OR 결합 때문에, 대체된
   (boot-stale) 시도가 자신도 모르는 사이 발생시키는 *정당한* world 이벤트(복원 분기의 terminal 발견
   → `finalizeEnded`)가 아직 살아있는 최신 시도까지 함께 죽인다. 실측 재현 완료.
2. **`applyConfig`만 두 축인 비대칭** — 타당함. `start()`가 boot 축을 안 봐도 안전한 이유는
   클로저 캡처 + `pendingResetRef`가 이미 기대는 "동일 endpoint 무재마운트 재전송" 전제와 같은
   경계다. 다만 그 교차 근거가 문서에 명시돼 있지 않다(INFO).
3. **`!cfg.apiBase` 조기 return 비-카운트** — 코드로 확인, 정확함. 문제 없음.
4. **3개 이상 부팅 + 모든 resolve 순서** — boot 축 단독으로는 순서-불변 승자 결정이 증명 가능하지만,
   CRITICAL 발견과 결합하면 §106이 깨질 수 있다. N이 커질수록 오염 후보가 늘어 오히려 더 잘
   트리거된다.
5. **`establishConfig` 비-async 추출의 동시성 영향** — 없음(순수 컴파일타임 강제, 인터리빙 불변).
   안전하고 유익한 구조적 개선으로 판단.

## 요약

이 diff의 핵심 메커니즘(`bootGenRef`/`beginBootAttempt`/`isAttemptStale` 토큰화, `establishConfig`
동기 추출)은 설계 의도(§A-0 토큰 캡슐화, §B 컴파일타임 강제) 그대로 잘 구현돼 있고, 새로 추가된
§106 회귀 테스트 두 건과 A-6 리듀서 가드도 각자 명시된 시나리오에서는 정확히 작동함을 코드 추적과
실행으로 확인했다. 그러나 "`worldGenRef`와 `bootGenRef`는 축이 다르므로 합치지 않는다"는 이 diff의
핵심 설계 원칙은, `isAttemptStale`이 두 축을 OR로 묶어 재검증하는 지점(applyConfig 복원 분기)에서
**의도와 달리 서로를 오염시킬 수 있음**을 재현 테스트로 확인했다 — 대체된(패배할) 부팅 시도가 복원
분기에서 이미 종료된 세션을 발견하면, 그 정당한 세계-무효화가 아직 살아있는 진짜 마지막 부팅까지
함께 죽여 §106을 위반한 채(오래된 config가 영구 고착) 조용히 끝난다. 관련해서 A-6 리듀서 가드도
"가시적 phase"만 지킬 뿐 그 아래 SSE 연결·갱신 타이머 예약까지는 막지 못함을 별도로 확인했다.
두 발견 모두 이 파일이 반복적으로 겪어 온 "비대칭/누락 가드" 계열과는 다른 새로운 하위 유형
(가드 자체는 각각 정상 작동하지만 **둘의 상호작용**이 새는 경우)이며, 기존 mutation 매트릭스(단일
가드 제거 시 탐지력 확인)로는 애초에 잡히지 않는 성질이라 이번 라운드에 처음 드러났다고 판단한다.
나머지 질의(2·3·5)에 대해서는 코드가 이미 올바르게 설계돼 있음을 확인했다.

## 위험도

CRITICAL
