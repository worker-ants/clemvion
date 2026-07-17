# 동시성(Concurrency) Review

대상 파일 중 동시성 관점에서 실질 분석이 필요한 것은 프로덕션 코드인
`codebase/channel-web-chat/src/widget/use-widget.ts` 뿐이다.
`webauthn.controller.spec.ts`(nullable 필드 매핑 테스트 1건 추가)와
`use-widget-eager-start.test.ts`(회귀 테스트 1건 추가)는 순수 테스트 코드로 그 자체는
동시성 문제를 유발하지 않는다. `plan/**`·`review/code/2026/07/17/02_04_13/**`(RESOLUTION,
SUMMARY, 각 reviewer `.md`, `meta.json`, `_retry_state.json`)는 직전 라운드의 리뷰 산출물이
신규 커밋되는 것이라 실행 코드가 아니며 동시성 검토 대상이 아니다.

이번 라운드의 실제 목적은 직전 라운드(`02_04_13`)에서 지적된 concurrency WARNING 2건
(staleness 가드 부재, 중복 종료 통지)과 side_effect/maintainability CRITICAL 1건
(`applyConfig` 복원 경로 무방비)이 `use-widget.ts` 에 올바르게 반영됐는지 검증하고, 그 fix
자체에 새 경합 조건이 생기지 않았는지 재검토하는 것이다.

## 발견사항

- **[WARNING]** `applyConfig`(세션 복원) 경로 — `seedWaitingFromStatus` 가 "stale 폐기"로 인해
  반환하는 `false` 를 "정상 진행" `false` 와 구분하지 않아, `openStream(saved, ...)` 가 여전히
  **stale 한 `saved` 세션으로 실행될 수 있는 좁은 경합**이 남아 있음(전신 CRITICAL 과 같은 함수·같은
  호출부의 잔존 케이스)
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:615-620`(`applyConfig`) vs
    `:371-376`(`start()`), `seedWaitingFromStatus` 정의 `:273-316`(특히 `:282`
    `if (sessionRef.current !== session) return false;` 와 `:264-266` JSDoc
    "`false` = 정상 진행(시드했거나, **stale 폐기**, 또는 soft-fail)")
  - 상세: `seedWaitingFromStatus` 는 자신의 `await client.getStatus(...)` 직후 1회
    `sessionRef.current !== session` staleness 가드를 두고 있다(W2 fix, 정상 동작). 그런데 이
    가드가 걸려 "폐기"됐을 때도, `session` 이 실제로 terminal 이어서 "정상 종료 처리"됐을 때도,
    `waiting_for_input` 을 정상 시드했을 때도 **모두 동일하게 `false`(비-ended)를 반환**한다.
    호출부 중 `start()`(`:371-376`)는 이 `false` 뒤에 **자신만의 독립적인 재검증**
    (`if (startGenRef.current !== gen) return;`, `:374`)을 추가로 두고 있어 안전하다 — staleness
    가드가 걸리는 모든 경우는 `teardownSession()`(`newChat`/`endConversation` 경유)이 먼저
    실행됐다는 뜻이고, `teardownSession()` 은 `startGenRef.current++` 를 수행하므로(`:146`) `gen`
    검사가 반드시 이 상황을 잡아낸다. 반면 `applyConfig`(`:615-620`)는 `ended` 값만 검사하고
    이런 2차 재검증이 없다:
    ```ts
    if (clientRef.current) {
      const ended = await seedWaitingFromStatus(clientRef.current, saved);
      if (ended) return;
    }
    openStream(saved, "0");
    scheduleRefresh();
    ```
    재현 시나리오: 마운트 시 `applyConfig` 가 저장 세션을 복원(`sessionRef.current = saved`,
    `:607`)하고 `getStatus` 왕복을 기다리는 그 짧은 창(host RTT) 안에, host 가 "새 대화"
    (`resetSession`/`newChat`)를 보낸다고 하자. `newChat()`(`:497-520`)은 `startedRef.current=true
    && sessionRef.current` 가 있으므로 A-coalesce 분기가 아니라 **B-1(확립 세션발) 분기**로 가서
    `resetSessionRefs()`(`teardownSession` + `sessionRef.current=null` + `startGenRef++`)를 실행하고
    곧바로 자신의 `start()` 를 새로 돌린다. 이때 `applyConfig` 의 지연 중이던
    `seedWaitingFromStatus` 응답이 나중에 도착하면 `sessionRef.current !== session` 가드가 걸려
    올바르게 `dispatch`/`finalizeEnded` 를 건너뛰고 `false` 를 반환한다 — **여기까지는 W2 fix 가
    정확히 동작**한다. 하지만 `applyConfig` 는 그 `false` 를 "정상 진행"으로 해석해 그대로
    `openStream(saved, "0")` 를 실행한다. `openStream`(`:221-243`)은 인자로 받은 `session` 만
    보고 무조건 `closeStream()` 후 새 `EventSource` 를 여는 함수라 `sessionRef.current` 와의 정합성을
    스스로 검사하지 않는다(`:225-228`). 만약 이 지연된 `openStream(saved,...)` 이 이미 진행 중이거나
    막 열린 새 `start()` 의 정상 스트림보다 **나중에** 실행되면, `closeStream()` 이 그 정상 스트림을
    닫고 **취소된(=stale) 토큰으로 새 EventSource 를 다시 연다** — 방금 시작된 새 대화의 실시간
    업데이트가 끊기는 실질 회귀다. (`scheduleRefresh()` 자체는 `sessionRef.current` 를 호출 시점·
    타이머 발화 시점 모두 다시 읽는 ref 기반 설계(`use-token-refresh.ts:64,70`)라 이 경합에서는
    안전하다 — 스토리지 부활 위험은 이 경로엔 해당 없음. `openStream` 호출 한 곳만 위험.)
  - 제안: `applyConfig` 에도 `start()` 와 대칭인 재검증을 추가한다. 가장 간단한 방법은
    `seedWaitingFromStatus` 호출 직후 `if (sessionRef.current !== saved) return;` 를 `openStream`
    앞에 두는 것(자체 staleness 가드와 동일 조건 재사용). 더 근본적으로는 `seedWaitingFromStatus`
    의 반환 타입을 `"ended" | "stale" | "continue"` 3-state 로 바꾸거나, `startGenRef` 와 유사한
    world-generation 카운터를 `applyConfig`/`start()`/`replay_unavailable` 폴백 세 호출부가 공유하도록
    승격해 "false = 무조건 안전하게 진행 가능" 이라는 계약을 코드로 강제하는 편이 재발을 막는다.
  - 참고: 발생 조건이 "마운트 직후 getStatus 왕복 시간 안에 host 가 새 대화/종료 명령을 보낸다"는
    좁은 타이밍 창이라 실사용 재현 빈도는 낮지만, 결과(정상 새 대화의 SSE 스트림 탈취)는 사용자
    체감이 뚜렷하다. 회귀 테스트(신규 추가된 "복원된 세션이 이미 terminal" 케이스)는 이 특정
    경합(비-terminal stale)까지는 커버하지 않는다.

## 확인 완료 — 직전 라운드 concurrency 지적사항은 올바르게 fix됨

- **W2(staleness 가드 부재) 해소 확인**: `seedWaitingFromStatus` 의 `await` 직후
  `if (sessionRef.current !== session) return false;`(`:282`)가 추가돼, `execution.replay_unavailable`
  fire-and-forget 폴백(`:210`)이 지연 응답으로 최신/교체된 세션에 유령 `WAITING`/오탐 `ENDED` 를
  적용하는 문제가 차단된다. `state`(React state) 가 아니라 `sessionRef`(ref) 비교라 stale-closure
  함정도 없다.
- **W3(중복 종료 통지) 해소 확인**: `finalizeEnded`(`:183-193`)가 `endedRef` 를 이용한
  check-then-set 을 `await` 없이(동기적으로) 수행한다 — JS 단일 스레드 실행 모델상 이 두 줄
  (`if (endedRef.current) return false; endedRef.current = true;`) 사이에 다른 코드가 끼어들 수
  없으므로 SSE terminal 경로(`handleEiaEvent`)와 REST 폴백 경로(`seedWaitingFromStatus`)가 동시에
  `finalizeEnded` 를 불러도 원자적으로 1회만 통과한다. `resetSessionRefs`(`:477`)가 새 대화 시
  `endedRef.current = false` 로 해제하는 것도 올바르다.
- **`start()` 이중 게이팅 확인**: `:371-376` 이 `ended` 반환값 게이트와 기존 `startGenRef` 재검증을
  모두 유지해 두 종류의 staleness(종료됨/세대 교체됨)를 모두 방어한다 — 위 WARNING 은 이 패턴이
  `applyConfig` 에는 절반만(=`ended` 게이트만) 이식됐다는 지적이다.
- `seedWaitingFromStatusRef.current = seedWaitingFromStatus;` 를 render-body 대입에서
  `useEffect(() => {...})`(deps 없음, 매 렌더 실행)로 유지한 것은 기존 `apiRef` 컨벤션과 일치하며
  `seedWaitingFromStatus` 의 `useCallback` deps 가 `[teardownSession]` → `[finalizeEnded]` 로
  바뀐 것도 두 콜백 모두 stable 함수라 참조 안정성에 영향 없다.

## 요약

직전 라운드 CRITICAL(`applyConfig` 가 teardown 직후 무조건 `openStream`/`scheduleRefresh` 하던
회귀)과 concurrency WARNING 2건(staleness 가드 부재, 중복 종료 통지)은 이번 diff 에서 모두
정확히 해소됐다 — `finalizeEnded`+`endedRef` 원자적 1회 가드, `seedWaitingFromStatus` 의
`sessionRef` 기반 staleness 폐기, `Promise<boolean>` 반환 계약과 `start()`/`applyConfig`/폴백 3개
호출부의 게이팅이 모두 확인된다. 다만 그 반환 계약(`false` = "정상 진행")이 "정상 시드"와
"staleness 로 인한 조용한 폐기"를 하나의 값으로 뭉뚱그리고 있어, `start()` 는 자신의 독립적인
`startGenRef` 재검증 덕에 우연히(!) 완전히 보호되는 반면 `applyConfig` 는 그 2차 재검증이 없어
`openStream(saved, ...)` 한 줄이 여전히 좁은 타이밍 창에서 stale 세션으로 실행될 수 있다. 정확히
"함수 안에 넣으면 모든 호출부가 안전하다는 착각"(RESOLUTION.md 교훈)이 이번엔 `start()` 의
우연한 이중 보호에 가려 `applyConfig` 에 다시 한 번(더 좁은 형태로) 남아있는 사례다.
`scheduleRefresh()` 는 호출·발화 양쪽에서 `sessionRef.current` 를 다시 읽는 ref 기반 설계라 이
경합에서 스토리지 부활 위험은 없음을 확인했다 — 위험은 `openStream` 의 스트림 탈취 1건으로 국한된다.

## 위험도

MEDIUM
