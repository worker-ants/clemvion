# 문서화(Documentation) 리뷰 결과

대상: `worldGen` 단일화 리팩터의 후속 fix(C1·W2·W3·W4·W5) + `CHANGELOG.md` 정정(W6) + `08_29_33` 리뷰 라운드
산출물(`RESOLUTION.md`/`SUMMARY.md` 등) 신규 커밋. 추가 지시에 따라 (1) `CHANGELOG.md` 항목4 정정의 정확성,
(2) `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 및 `review/code/2026/07/17/08_29_33/RESOLUTION.md`
기록이 실제 코드와 일치하는지를 코드 직접 대조 + 테스트 실행으로 검증했다.

## 발견사항

- **[INFO]** CHANGELOG 항목4 정정 검증 — **정확함**(요청된 핵심 검증 항목)
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/funny-mahavira-50d003/CHANGELOG.md` L10(항목4) · L11(항목5)
  - 상세: 정정 전 항목4는 "옛 세션의 지연 응답이... 오종료시키거나(410) **유령 표면을 그리지 않는다**"라고 주장했으나, 이 fix(항목5) 이전엔 실제로 재현된 반례("종료된 위젯이 stale seed 응답으로 부활")가 있어 성립하지 않는 문구였다(`review/code/2026/07/17/08_29_33/documentation.md`·`concurrency.md`가 이미 지적). 정정 후 항목4는 "오종료시키지(410) 않는다"만 남기고 유령표면 문구를 제거했으며, 항목5가 "위 4번의 세션 **동일성** 검사는 **교체**는 잡았지만 **종료**는 놓쳤다"로 인수인계를 명시한다. 코드로 대조한 결과 이 구분은 정확하다 — `seedWaitingFromStatus`/`sendCommand`의 옛 `sessionRef.current !== session` 동일성 검사는 `newChat`/`endConversation`의 `resetSessionRefs()`(세션 **교체**, `sessionRef.current`가 실제로 바뀜)는 잡지만, `teardownSession()`(SSE terminal 등 **종료** 경로)은 `sessionRef`를 null하지 않으므로(`use-widget.ts` L187-206, 특히 L205 앞의 조기 return과 L706-707 JSDoc이 이 특성을 명시) 동일성 검사를 통과시켰다. 항목5가 도입한 `worldGenRef`(교체·종료·언마운트를 구분 없이 잡는 단일 세대 카운터)가 이 gap을 닫는다. 정정된 항목4/5의 책임 분리 서술은 코드의 실제 동작과 일치한다.
  - 제안: 없음 — 정정 그대로 유지 권장.

- **[WARNING]** `RESOLUTION.md` 검증 섹션의 `widget-state.test.ts` 테스트 수 표기가 실측과 불일치
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/funny-mahavira-50d003/review/code/2026/07/17/08_29_33/RESOLUTION.md` L98(`"widget-state 31→33(W4 2건)"`)
  - 상세: 직접 실행·비교한 결과 실제 수치는 **37→39**다(31→33 아님). 근거: (1) `git show 42e4346cf^:.../widget-state.test.ts`로 받은 diff 직전 버전은 최상위 `it(...)` 30개 + `it.each`(7행 테이블, `isActiveConversationPhase` 진리표) = **37개**, diff 직후(W4 2건 추가) `it(...)` 32개 + 7 = **39개**. (2) `npx vitest run src/lib/widget-state.test.ts` 실측 결과도 `Tests 39 passed (39)`로 39를 재확인. 흥미롭게도 같은 문서의 바로 위 W4 절(L76 인근 mutation 검증) — "가드 제거 시 **39건** 중 W4 1건만 실패" — 는 정확히 39를 쓰고 있어, 같은 문서 내에서도 서로 다른 두 숫자(31→33 vs 39)가 같은 파일을 가리키는 내부 불일치가 있다. `use-widget-eager-start`(36→39)·`use-token-refresh`(10→11) 두 항목은 동일 방법으로 대조한 결과 모두 정확했다 — 이 한 줄만 오기재로 보인다. 실제 코드/테스트의 정확성 자체에는 영향 없음(회귀 테스트는 실재하고 통과한다) — 감사증적(audit trail) 문서의 수치 정확성 문제.
  - 제안: L98을 `widget-state 37→39(W4 2건)`로 정정.

- **[WARNING]** "`ended` 를 벗어나는 유일한 액션은 `START`" 주석·테스트명이 부정확 — `NEW_CHAT`도 무조건 이탈 가능
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/funny-mahavira-50d003/codebase/channel-web-chat/src/lib/widget-state.ts` L136-137(주석) · L179-184(`case "NEW_CHAT"`, 대조 대상); 테스트명: `/Volumes/project/private/clemvion/.claude/worktrees/funny-mahavira-50d003/codebase/channel-web-chat/src/lib/widget-state.test.ts` L131; 동일 주장이 `/Volumes/project/private/clemvion/.claude/worktrees/funny-mahavira-50d003/review/code/2026/07/17/08_29_33/RESOLUTION.md` L76에도 `(전수 확인)`이라는 명시적 exhaustiveness 클레임과 함께 반복됨
  - 상세: `WAITING` 케이스 가드 주석은 "`ended` 를 벗어나는 유일한 액션은 `START`(→`booting`) 이므로 `ended → WAITING` 이 정당한 경우는 없다"라고 단언하고, 짝을 이루는 테스트명도 "START 는 ended 를 벗어나는 유일한 경로"라 반복한다. 그러나 같은 파일의 `case "NEW_CHAT"`(L179-184)는 `return { ...initialState, open: true, phase: "panel" }`로 **현재 `phase` 값과 무관하게** 무조건 `initialState`로 리셋한다 — 즉 `state.phase === "ended"`인 상태에서 `NEW_CHAT`이 디스패치되면 `START`를 거치지 않고 그 즉시 `ended`를 벗어난다. 이는 이론적 엣지케이스가 아니라 **"대화 종료 후 새 대화 시작"이라는 위젯의 가장 흔한 정상 사용자 흐름 그 자체**다 — `use-widget.ts`의 `newChat()`은 `resetSessionRefs()` 직후(즉 `state.phase`가 여전히 `"ended"`인 시점) `dispatch({ type: "NEW_CHAT" })`을 호출하며, `endConversation()`을 거쳐 종료된 뒤 `startedRef.current`/`sessionRef.current`는 `teardownSession()`만으로는 리셋되지 않으므로 booting-coalesce 분기(A)도 타지 않고 정확히 이 경로를 통과한다. 가드 로직 자체(`if (state.phase === "ended") return state;`, L138)는 여전히 올바르고 안전하다 — 문제는 그 정당화 주석의 "유일한"이라는 단언이 실제로는 반례(NEW_CHAT)가 있다는 점, 그리고 `RESOLUTION.md`가 이를 "(전수 확인)"이라 명시해 검증 완전성을 주장한다는 점이다. 이 프로젝트는 앞선 라운드(`08_29_33`)에서도 "무효화 지점은 두 곳뿐"(실제 세 곳) 같은 동일 유형의 과소 서술을 반복 지적받았고, 이번 건이 같은 패턴의 재발이다.
  - 제안: 주석/테스트명을 "`ended`에서 `WAITING`으로 직접 전이하는 경로는 없다(다른 모든 이탈은 `NEW_CHAT`처럼 상태를 통째로 리셋하거나 `START`를 거친다)"는 취지로 완화하거나, `case "NEW_CHAT"`을 함께 언급해 "정당한 이탈 액션은 `START`와 `NEW_CHAT`(전체 리셋) 뿐"으로 정정. `RESOLUTION.md`의 "(전수 확인)" 표현도 실제로는 `WAITING` 케이스 하나만 확인한 것이므로 재검토 권장.

- **[INFO]** `worldGenRef` "왜 하나로 합쳤나" JSDoc이 이번 라운드에 통합된 4번째 축(`useTokenRefresh`의 `cancelledRef`, W5)을 반영하지 않음
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/funny-mahavira-50d003/codebase/channel-web-chat/src/widget/use-widget.ts` L147-149(`"3종이 각기 다른 무효화 트리거"`) vs L169(`"그 훅의 4번째 독립 가드였던 cancelledRef 를 대체"`, 같은 파일 내 20줄 아래)
  - 상세: `worldGenRef`의 핵심 계약 JSDoc(L133-158)은 "종전에는 세대 카운터(`startGenRef`)·`sessionRef` 동일성·`cancelled` 지역 플래그 **3종**이... 공존했다"고 서술한다. 이 문장은 `3b54c8727`(이전 라운드) 시점 기준으로는 정확했지만, 이번 diff(W5)에서 `useTokenRefresh`의 독립 `cancelledRef`(RESOLUTION.md·CHANGELOG 항목5가 명시하는 "4번째 가드")까지 `worldGenRef`로 통합했음에도 이 상위 JSDoc 단락은 갱신되지 않았다. "4번째 가드" 사실 자체는 근처의 다른 주석(L169)과 `use-token-refresh.ts` L34-42 JSDoc, 그리고 `CHANGELOG.md` 항목5("staleness 가드 4종")에는 정확히 기록돼 있어 정보 손실은 아니지만, 이 리팩터의 "단일 계약" 취지상 가장 먼저 읽히는 최상위 JSDoc 한 곳에는 "3종"이라는 이제-불완전한 역사만 남아 있다.
  - 제안: L147-149에 "(이후 `useTokenRefresh`의 `cancelledRef`까지 포함해 4종, L169 참조)" 정도의 짧은 back-reference를 추가하거나 "3종"을 "4종"으로 갱신.

## 그 외 직접 대조로 확인된 사항 (문제 없음)

- `plan/in-progress/spec-sync-external-interaction-api-gaps.md`의 "신규 회귀 테스트 6건(C1·W2·W3·W5·W4 2건)" — 각 테스트 파일을 직접 열어 대조한 결과 정확히 일치(C1/W2/W3은 `use-widget-eager-start.test.ts`, W5는 `use-token-refresh.test.ts`, W4는 `widget-state.test.ts`에 2건).
- "channel-web-chat 22 파일 370 passed"(plan 문서·RESOLUTION.md 공통) — `npx vitest run` 실행 결과 `Test Files 22 passed (22)` / `Tests 370 passed (370)`로 재확인.
- "`use-widget-eager-start` 36→39"·"`use-token-refresh` 10→11"(RESOLUTION.md) — `git show 42e4346cf^`로 받은 직전 버전과 정적 대조 결과 정확.
- "고정 횟수 microtask flush 관용구(12곳)"(plan 문서·RESOLUTION.md C2) — diff에서 `await Promise.resolve();` 제거 14줄/`await flushAsync();` 추가 15줄(2건은 이중 `Promise.resolve()` → 단일 `flushAsync()` 축약, 나머지는 1:1 교체 10건 + 신규 테스트 3건의 순수 신규 사용) → 교체 인스턴스 수는 정확히 12로 일치.
- "`configRef.current` 는... 할당 2곳·해제 0곳"(RESOLUTION.md C1) — `grep`으로 전수 확인, `updateProfile`·`applyConfig` 2곳 할당, null 대입 0곳으로 일치.
- `startGenRef` 잔존 참조 정리(W7) — 코드베이스 전체에 남은 유일한 참조는 `use-widget.ts` L147의 의도된 과거 서술("종전에는...")뿐이며, `use-widget-eager-start.test.ts`의 죽은 참조는 이번 diff에서 "세대 가드"로 정정 완료.
- `use-token-refresh.test.ts`의 "언마운트 후 타이머 미발화(cancelled 가드)" → "언마운트 후 타이머 미발화" 제목 변경 — `cancelledRef` 자체가 이번 diff로 제거됐으므로 정확한 정정.

## 요약

이번 커밋 세트의 핵심 요청 사항이던 CHANGELOG 항목4 정정("유령 표면을 그리지 않는다"라는 이제는 틀린 주장 제거 + 항목5로 종료 경로 인수인계)은 코드를 직접 대조한 결과 **정확하다** — 옛 `sessionRef` 동일성 검사가 "교체"만 잡고 "종료"(`teardownSession()`이 `sessionRef`를 null하지 않는 특성)는 놓쳤다는 항목5의 설명이 실제 구현과 일치하며, `worldGenRef` 통합이 그 gap을 닫는다는 서술도 정확하다. `plan/in-progress/spec-sync-external-interaction-api-gaps.md`와 `RESOLUTION.md`의 정량적 주장 대부분(신규 테스트 6건 구성, 370 passed, 파일별 테스트 수 증분, flushAsync 12곳 교체, configRef 할당 지점 수, startGenRef 정리)은 실제 실행·git 대조로 재현·확인됐다. 다만 두 가지 실제 오류를 발견했다: (1) `RESOLUTION.md`의 `widget-state` 테스트 수가 "31→33"으로 오기재돼 있으며(정확히는 37→39, 같은 문서 내 다른 절은 39를 올바르게 인용해 자기모순), (2) 리듀서 `WAITING` 가드의 정당화 주석과 대응 테스트명이 "`ended`를 벗어나는 유일한 액션은 `START`"라 단언하지만 실제로는 `NEW_CHAT`(대화 종료 후 새 대화 시작이라는 가장 흔한 사용자 흐름)도 무조건 `ended`를 벗어나며, `RESOLUTION.md`는 이를 "(전수 확인)"이라 명시해 검증 완전성까지 주장하고 있어 이 프로젝트가 반복 지적해온 "JSDoc/주석의 과소·과대 서술" 패턴이 이번에도 재발했다. 두 사안 모두 가드 로직 자체의 정확성이나 회귀 테스트의 유효성에는 영향을 주지 않는(코드는 안전하게 동작한다) 문서/감사기록 정확성 이슈이며, 저비용으로 정정 가능하다. 그 외 `worldGenRef` JSDoc이 이번 라운드에 통합된 4번째 가드(`useTokenRefresh`)를 최상위 "왜 하나로 합쳤나" 단락에 반영하지 않은 점은 정보가 다른 곳(CHANGELOG·인접 주석)에 정확히 남아 있어 경미하다. README·API 문서·설정 문서·예제 코드 갱신은 이번 diff 범위(순수 내부 staleness 가드 리팩터 + 회귀 테스트 + 문서)상 불필요하며 실제로 손대지 않은 것이 맞다.

## 위험도

LOW
