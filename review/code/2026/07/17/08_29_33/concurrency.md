# 동시성(Concurrency) Review

대상: `codebase/channel-web-chat/src/widget/use-widget.ts`, `use-widget-eager-start.test.ts` (+ plan 문서, 코드 아님).
본 변경은 위젯의 비동기 staleness 가드를 `startGenRef`(세대, `start()` 전용) / `sessionRef` 동일성(`seed`·`sendCommand`) /
`cancelled` 지역 플래그(`applyConfig` 초기 부팅) 3종에서 **단일 `worldGenRef` 세대 카운터**로 통합하는 리팩터다.
React 훅 기반 JS 단일 스레드 코드이므로 전통적 mutex/데드락/스레드풀 항목은 해당 없고, **async 경합(stale
resolve)·원자성·이벤트 루프/Promise 체인 관리**가 핵심 점검 축이다.

## 발견사항

- **[WARNING]** `worldGenRef` JSDoc 계약이 실제 무효화 지점 수를 과소 서술(2곳 명시, 실제 3곳)
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:140-142` (JSDoc) vs `use-widget.ts:402` (`start()` 내부)
  - 상세: `worldGenRef` JSDoc 은 "무효화 지점은 두 곳뿐이다 — `teardownSession()`과 언마운트 cleanup"이라고 명시한다.
    그러나 `start()` 자신도 `const gen = ++worldGenRef.current;` (line 402)로 세대를 **증가**시킨다(주석상 "start 는
    세계를 교체하므로 진행 중인 다른 비동기도 함께 무효화해야 한다"는 의도적 설계 — 그 자체는 타당). 즉 실제
    증가 지점은 `teardownSession()`(178-186) · `start()`(402) · 언마운트 cleanup(746) 3곳인데 계약 문서는 2곳만
    나열한다. 이 refactor 의 존재 이유 자체가 "가드가 3종으로 흩어져 대칭이 깨졌던 것"을 "하나의 신뢰 가능한
    계약"으로 정리하는 것이었는데, 그 계약 문서 자체가 이미 부정확하면 다음 유지보수자가 "gen 이 바뀌는 경우는
    teardown/unmount 뿐"이라 잘못 가정하고 신규 호출부를 작성할 위험이 있다(예: "start 도 무효화 지점"이라는
    사실을 놓치고 start 경합 시나리오를 재검증에서 빠뜨림).
  - 제안: JSDoc 을 "세 곳" 으로 정정하고 `start()`(세계 교체) 를 `teardownSession()`/언마운트와 나란히 명시.

- **[WARNING]** `applyConfig()` 복원 경로가 스스로 명시한 "모든 await 뒤 재검증" 계약을 어김 — `start()`와 비대칭
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:682-689` (`applyConfig`) vs `:425-430` (`start()`, 대칭 지점)
  - 상세: `start()`는 `seedWaitingFromStatus()` await 이후 **두 겹**으로 가드한다 — `outcome !== "continue"`
    체크(426)에 더해 별도의 `if (worldGenRef.current !== gen) return;`(428)까지 명시하고, 주석(420-424)으로
    "outcome 체크와 gen 체크는 축이 다르다"고 방어한다. 반면 `applyConfig()`의 동일 지점(682-689)은
    `seedWaitingFromStatus()` 결과의 `outcome !== "continue"` 체크(686)만 있고, 그 직후 `openStream(saved,
    "0")`/`scheduleRefresh()`(688-689) 호출 전에 **`worldGenRef` 재검증이 없다**. 코드를 직접 추적하면
    `seedWaitingFromStatus` 는 자신의 내부 gen 체크(328) 통과 이후 추가 `await` 없이 동기적으로
    `"continue"`/`"ended"` 를 반환하므로, **현재 구현 한정** `outcome==="continue"` 는 gen 불변과 사실상 동치이고
    실제로 재현 가능한 활성 버그는 아니다. 그러나 이는 `seedWaitingFromStatus` 내부에 await 이 더 없다는
    **암묵적·문서화되지 않은 불변식**에 의존하는 취약한 안전성이다 — 그 함수 내부에 향후(예: 추가 검증 호출)
    await 한 홉만 더 생겨도 `applyConfig` 의 이 누락은 바로 실질 회귀로 전환된다. 더 중요한 건 `scheduleRefresh`
    (`use-token-refresh.ts`)가 **자체적으로는 unmount 스코프의 `cancelledRef` 만 갖고 `worldGenRef` 인지가
    전혀 없다는 점**(아래 참고) — 호출 시점에 `sessionRef.current` 를 그대로 읽어 타이머를 예약하고,
    갱신 성공 시 `saveSession()` 으로 storage 에 재기록한다. `teardownSession()` 은 의도적으로 `sessionRef`
    를 null 하지 않으므로(`worldGenRef` JSDoc 145-148 에 명시된 바로 그 특성), 만약 `applyConfig` 가 stale
    상태에서 `scheduleRefresh()` 를 부르게 되면 — 바로 이 refactor 가 잡으려 한 "clearSession() 한 storage 를
    종료된 세션으로 되살리는" CRITICAL 버그 클래스(`applyConfig` 의 `02_04_13 CRITICAL#1` 주석, 664-681)가
    재발한다. 즉 `start()` 에는 있고 `applyConfig()` 에는 없는 이 한 줄이, 이 refactor 가 스스로 정의한
    안전망을 비대칭하게 유지하고 있다.
  - 제안: `applyConfig` 의 `if (outcome !== "continue") return;` 직후에도 `start()` 와 동일하게
    `if (worldGenRef.current !== gen) return;` 를 추가해 대칭을 맞춘다. 오늘 당장 동작을 바꾸지 않는(사실상
    no-op) 변경이지만, `seedWaitingFromStatus` 내부 구현이 바뀌어도 계약이 스스로를 지키게 만드는 방어적
    코딩이며, 이 파일의 반복된 "대칭 가드 누락" 이력(plan 문서 자체가 인정하는 4라운드 리뷰)을 고려하면
    지금 고치는 비용이 매우 낮다.

- **[INFO]** `widget-state.ts` reducer 의 `WAITING` 액션이 `ended` 가드 없이 무조건 전이 — 방어가 호출부의 gen 체크 단일 지점에 전적으로 의존
  - 위치: `codebase/channel-web-chat/src/lib/widget-state.ts:129-137` (`case "WAITING"`, 본 diff 미포함·참조용)
  - 상세: 실제 파일을 확인한 결과 `case "WAITING": return { ...state, phase: "awaiting_user_message", ... };` 는
    `state.phase === "ended"` 여부를 전혀 검사하지 않는다. plan 문서(`spec-sync-external-interaction-api-gaps.md`)
    자신도 "`widget-state.ts` 의 `WAITING` 이 `ended` 가드 없이 무조건 전이하는 것이 직접 원인"이라고 명시한다.
    이번 fix 는 이 문제를 **reducer 자체를 방어적으로 만드는 대신, 그 앞단(호출부)에서 stale dispatch 가 아예
    발사되지 않도록** `worldGenRef` 로 막는 방식을 택했다. 이 접근 자체는 유효하지만, 이는 "이후 등장하는 모든
    호출부가 gen 체크를 빠짐없이·정확히 건다"는 단일 방어선에 전적으로 의존한다는 뜻이다(바로 위 WARNING
    항목처럼 그 단일 방어선에도 비대칭이 남아 있었다). 이 파일이 정확히 이 실패 유형(비대칭 가드)으로 4라운드
    연속 리뷰에서 문제가 발견된 이력을 감안하면, reducer 레벨에도 `state.phase === "ended"` 일 때 `WAITING`
    (및 유사한 재활성화형 액션)을 무시하는 구조적 방어선을 하나 더 두는 편이 "caller discipline" 하나에만
    의존하는 현재 설계보다 견고하다.
  - 제안(선택 사항, 구조 개선): `widgetReducer` 의 `WAITING`(및 필요 시 `AI_MESSAGE`/`BOOTED`/`RESTORED`)에
    `if (state.phase === "ended") return state;` 형태의 defense-in-depth 를 추가하는 후속 검토를 권장.
    현재 fix 로 재현된 버그 자체는 닫혔으므로 차단 사유는 아니다.

- **[INFO]** 신규 회귀 테스트의 수동 마이크로태스크 카운팅(`await Promise.resolve()` × 2)이 `seedWaitingFromStatus` 내부 await 홉 수에 암묵 결합
  - 위치: `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts:101-116` (신규 테스트
    "seed in-flight 중 SSE terminal → stale 응답이 ended 위젯을 부활시키지 않는다")
  - 상세: stale `getStatus` 응답을 수동 resolve 한 뒤 `await Promise.resolve(); await Promise.resolve();` 로
    두 번 마이크로태스크를 흘려보내고 나서 `state.phase` 가 여전히 `"ended"` 인지 확인한다. 이는 현재
    `seedWaitingFromStatus`/`getStatus()` 구현의 정확한 await 홉 수에 의존하는 타이밍 가정이다(테스트 목적이
    "아무 일도 일어나지 않았음"을 확인하는 부정 단언이라 `waitFor` 로 대체하기 어려운 것은 이해되며, 파일 내
    다른 유사 테스트도 같은 패턴을 이미 쓰고 있어 새로 도입된 안티패턴은 아니다). 다만 위 WARNING 항목에서
    지적한 대로 `seedWaitingFromStatus` 에 await 홉이 하나 더 생기는 변경이 일어나면, 이 테스트는 (조기
    단언으로 인해) 회귀를 놓치고 계속 그린으로 남을 수 있다.
  - 제안: 현 상태로 두어도 무방하나, 향후 `seedWaitingFromStatus` 내부 구조를 바꿀 때는 이 테스트의 microtask
    flush 횟수도 함께 재검토할 것.

- **[INFO]** `applyConfig()` 동시 이중 호출에 대한 상호배제 부재 — 본 diff 로 도입/악화된 것 아님(사전 존재)
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:693-733` (`bridge.onBoot` 핸들러 + query-param
    fallback 이 모두 `applyConfig` 를 호출할 수 있는 지점)
  - 상세: `bridge.onBoot(...)` 콜백과 URL query-param fallback 경로가 **둘 다** 조건을 만족하면(예: 미리보기/
    테스트 환경에서 iframe URL 에 `apiBase`/`trigger` 쿼리가 남아있는 채로 host 가 `wc:boot` 도 보내는 경우)
    `applyConfig()` 가 사실상 동시에 두 번 실행될 수 있다. `applyConfig` 자신은 `worldGenRef` 를 증가시키지
    않으므로(오직 `teardownSession()`/`start()`/언마운트만 증가) 두 인스턴스가 서로를 gen 으로 무효화하지
    못하고, 두 번째 실행이 `clientRef.current`(EiaClient 재생성)·`sessionRef.current`·`startedRef.current` 를
    덮어쓸 수 있다. 이 특성은 리팩터 이전의 `cancelled` 불리언 플래그(언마운트 전용, 동일하게 이중 호출은
    못 막음)에서도 동일했으므로 본 diff 가 새로 만든 문제는 아니다. 다만 이번 refactor 가 "위젯의 모든 비동기
    경로의 staleness 를 단일 진실로 통합"을 표방한 만큼, 이 특정 축(동시 config 적용)은 그 범위 밖에 남아있다는
    점은 기록해 둘 가치가 있다.
  - 제안: 차단 사유 아님. 필요 시 `applyConfig` 진입부에 `configuredRef`류 1회성 가드를 추가하는 후속 검토
    후보로만 기록.

## 긍정적으로 확인된 사항 (참고)

- `teardownSession()` 은 `worldGenRef.current++` 를 **부수효과(closeStream/clearRefreshTimer/clearSession) 이전에**
  동기적으로 수행해, 이후 어떤 동시 진행 중인 `await` 재검증도 즉시 새 값을 관측하도록 보장한다 — 순서가 올바르다.
- `finalizeEnded()` 는 `endedRef.current` 체크와 `worldGenRef` 증가(`teardownSession()` 경유)를 **원자적으로(중간에
  await 없이)** 묶어 두어, JS 단일 스레드 실행 모델 하에서 "여러 종료 경로가 동시에 경합"해도 dedup 가드가
  깨지지 않는다(직접 추적: `endedRef.current` 가 `true` 로 바뀌는 유일한 지점은 항상 같은 동기 구간에서
  `teardownSession()`(gen 증가)과 짝을 이룬다).
- `sendCommand()` 는 실패(catch) 경로에서만 gen 을 재검증하는데, 성공 경로는 로컬 상태를 건드리지 않으므로
  이는 정확한 설계다(가드가 불필요한 곳엔 넣지 않음).
- 신규 회귀 테스트(§발견사항 INFO 참고) 자체는 "in-flight seed 가 SSE terminal 이후 늦게 resolve" 라는
  실제로 재현된 경합을 정확히 모사하며, 이 refactor 의 핵심 수정 대상(과거 `sessionRef` 동일성 가드가
  `teardownSession()` 의 non-null 특성 때문에 뚫렸던 경로)을 정밀하게 고정한다.
- `worldGenRef` 로 3종 가드를 통합한 설계 방향 자체(단일 epoch 카운터 + "무효화 지점에서 증가, await 뒤
  재검증" 계약)는 이 클래스의 async staleness 문제에 대한 표준적이고 적절한 해법이다.

## 요약

이번 변경은 위젯의 비동기 staleness 가드를 3종(`startGenRef`/`sessionRef` 동일성/`cancelled` 플래그)에서 단일
`worldGenRef` 세대 카운터로 통합한 리팩터로, 실제 재현된 "seed in-flight 중 SSE terminal 종료 → stale 응답으로
위젯 부활" 버그를 정확히 잡는 회귀 테스트와 함께 도입됐다. `teardownSession()`/`finalizeEnded()`/`sendCommand()`
등 핵심 경로의 gen 증가·재검증 순서는 JS 단일 스레드 실행 모델 하에서 견고하게 설계되어 있다. 다만 리팩터가
스스로 내세운 "모든 await 뒤 재검증" 계약이 실제로는 완전히 대칭적이지 않다 — `start()`는 이중 가드(outcome +
명시적 gen 재검증)를 갖는 반면 `applyConfig()`의 동일 지점은 outcome 체크만 있고, JSDoc 도 실제 세대 증가
지점(3곳)을 2곳으로 과소 서술한다. 현재 구현에서는 `seedWaitingFromStatus`가 내부 gen 체크 이후 추가 await
없이 동기 반환한다는 암묵적 불변식 덕분에 이 비대칭이 활성 버그로 이어지지는 않지만, `scheduleRefresh()`
(`use-token-refresh.ts`)가 `worldGenRef`를 전혀 인지하지 못하고 오직 unmount 스코프의 자체 `cancelledRef`만
갖는다는 점을 고려하면, 이 비대칭은 이 파일이 4라운드에 걸쳐 반복해온 바로 그 실패 유형(비대칭 가드로 인한
storage/스트림 되살리기)이 재발할 수 있는 잠재 지점이다. 아울러 `widget-state.ts` reducer 가 `ended` 이후에도
`WAITING` 전이를 무조건 허용해, 방어가 호출부 gen 체크라는 단일 지점에 전적으로 의존하는 구조적 취약성도
남아있다(reducer 레벨 defense-in-depth 부재).

## 위험도

MEDIUM
