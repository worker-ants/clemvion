# 유지보수성(Maintainability) Review

대상: `codebase/channel-web-chat/src/{lib/widget-state.ts,lib/widget-state.test.ts,widget/use-token-refresh.ts,widget/use-token-refresh.test.ts,widget/use-widget.ts,widget/use-widget-eager-start.test.ts}`,
`CHANGELOG.md`, `plan/in-progress/spec-sync-external-interaction-api-gaps.md`, `review/code/2026/07/17/08_29_33/*`(직전 라운드 산출물 커밋).

본 diff 는 직전 리뷰(`08_29_33`)의 Critical#1(C1, 부팅 중 명령 → 위젯 영구 정지) · W2(applyConfig 세대 재검증 비대칭) ·
W5(`useTokenRefresh` 4번째 독립 가드) · W4(리듀서 defense-in-depth) · W1(JSDoc 무효화 지점 수) · W7(죽은 `startGenRef`
참조) · C2(고정 횟수 microtask flush) 를 반영한 후속 fix다. 지시받은 대로 **주석·JSDoc 이 실제 코드와 일치하는지**를
diff 만이 아니라 파일 전체를 읽어 대조 검증했다.

## 검증 결과 — `worldGenRef` "무효화 지점 셋" 주장

**정확함.** `grep -n "worldGenRef.current++\|++worldGenRef.current"` 로 `use-widget.ts` 전수 확인한 결과 실제 증가
지점은 정확히 3곳이다 — `teardownSession()`(L202, `if (!configRef.current) return;` no-op 가드 통과 후) ·
`start()`(L429, `const gen = ++worldGenRef.current;`) · 언마운트 cleanup(L778). JSDoc(L140-145)의 (1)(2)(3) 서술과
정확히 일치한다. W1 조치는 유효하다. 아래 WARNING 3 은 이와 별개로, 이번에 새로 든 인접 주장("ended 를 벗어나는
유일한 액션은 START")의 정확도 문제다.

## 발견사항

- **[WARNING]** 신규 테스트가 기존 spec 불변식 ID `"C1"` 과 리터럴 충돌 — 같은 파일 안에 무관한 두 주제가 같은 라벨을 공유
  - 위치: `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts:1947-1954`
    (`it("C1: embed-config in-flight 중 host resetSession → config 확립(패널 정상 개방)"`)
  - 상세: `"C1"` 은 이 코드베이스에서 이미 **공식 spec 불변식 ID** 다 — `spec/7-channel-web-chat/1-widget-app.md:19`
    가 "C1 보류 메시지 큐 게이팅"으로 명시하고, `use-widget.ts:496`("C1(§R6) 보류 메시지 큐"), `use-pending-message-queue.ts`,
    `use-pending-message-queue.test.ts`, `components/panel.tsx`, 그리고 바로 이 테스트 파일 자신의 기존 테스트 2건
    (L298 `"C1: open 직후(booting) submitMessage → ..."`, L353 `"C1 폐기: open 직후 큐된 텍스트는 ..."`) 이 이미 이
    라벨을 "보류 메시지 큐" 의미로 5개 파일에 걸쳐 참조한다. 이번 diff 가 추가한 새 테스트는 이 라운드
    (`08_29_33`)의 "Critical #1"(부팅 중 명령 → 영구 정지)을 가리키는 **완전히 무관한 의미**로 동일 리터럴
    `"C1"` 을 재사용했다 — 결과적으로 이 파일 안에 `"C1"` 로 시작하는 테스트 제목이 3개(L298·L353·L1954)
    생겼고 그중 하나만 최근 버그를 가리킨다. 게다가 이 신규 테스트의 리드 코멘트(L1947-1953) 자신도 헤더는
    `"C1 —"` 라 쓰고 말미 인용은 `"(ai-review 2026-07-17 08_29_33 CRITICAL#1)"` 이라 써 **같은 문단 안에서
    같은 대상을 가리키는 라벨이 두 번 바뀐다**(RESOLUTION.md/plan 문서가 새로 도입한 "C1" 축약이 SUMMARY.md
    원문의 "Critical #1" 표기와 불일치). `grep "C1"` 로 이 기능 영역을 찾으려는 향후 유지보수자나 spec-coverage
    류 도구가 두 무관한 항목을 혼동할 실질적 위험이 있다.
  - 제안: 이 회귀 테스트의 라벨을 spec 불변식과 겹치지 않게 바꾼다(예: 다른 W-라벨들처럼 라운드 타임스탬프를
    포함해 `"08_29_33-CRIT1"` 또는 그냥 `"CRIT1"`). 최소한 리드 코멘트 안에서는 `"C1"`/`"CRITICAL#1"` 표기를
    하나로 통일할 것.

- **[WARNING]** `worldGenRef` 세대 가드(capture+recheck) 관용구가 손으로 12회 복제 — 이번 diff 가 고친 버그 자체가 이 복제 누락에서 비롯
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts` — capture(`const gen = worldGenRef.current;`
    류) 4곳: L337·L429·L474·L687. recheck(`if (worldGenRef.current !== gen) return ...;`) 8곳: L348·L380·L437·
    L455·L463·L481·L690·L718. (+ `use-token-refresh.ts:92` 1곳, 합 9곳 recheck)
  - 상세: 이 2줄짜리 "세대 캡처 → await → 재검증" 관용구가 4개 함수에 걸쳐 완전히 손으로 복제돼 있다. 이번
    diff 가 고친 W2(`seedWaitingFromStatus` catch 분기에 recheck 누락)·`applyConfig` 비대칭 자체가 "새 호출부가
    이 관용구를 빠뜨림"으로 생긴 버그였고, plan 문서(`spec-sync-external-interaction-api-gaps.md`)도 스스로
    "가드는 규율이지 구조가 아니다 (이 라운드의 교훈)"이라 적었다. 그런데도 이번 fix 는 그 규율을 구조(작은
    헬퍼)로 승격하지 않고 recheck 지점을 2곳(catch 분기, `applyConfig`) **또** 손으로 추가하는 방식을 택했다.
    다음에 새 비동기 호출부가 추가되면 다시 이 관용구를 빠뜨릴 위험이 구조적으로 남아 있다.
  - 제안: 최소 `function isStale(gen: number) { return worldGenRef.current !== gen; }` 같은 named predicate 로
    추출해 최소한 의도가 이름으로 드러나고 grep 으로 전 지점을 한 번에 찾을 수 있게 한다. 여유가 있다면 "await
    후 자동 재검증"을 캡슐화하는 작은 유틸(`guardedAwait(gen, promise)`) 도입을 후속 검토.

- **[WARNING]** "`ended` 를 벗어나는 유일한 액션은 `START`" 주장 — reducer 전수 확인 결과 정확한 불변식이 아님(RESTORED/BOOTED 도 무조건 전이)
  - 위치: `codebase/channel-web-chat/src/lib/widget-state.ts:136-137`(WAITING 케이스 코멘트) vs `:125-128`
    (`RESTORED`/`BOOTED` 케이스); `widget-state.test.ts:131`(테스트 제목); `review/code/2026/07/17/08_29_33/RESOLUTION.md`
    §W4 "(전수 확인)"
  - 상세: `widgetReducer` 를 전수 확인한 결과 `RESTORED`(`return { ...state, executionId, phase: "streaming" }`)
    와 `BOOTED`(동일 패턴)도 `state.phase` 를 전혀 검사하지 않고 무조건 `"streaming"` 으로 설정한다 — 이번에
    `ended` 가드를 새로 단 `WAITING` 이 고쳐지기 전과 정확히 같은 "무조건 전이" 패턴이다. 즉 reducer 코드
    자체의 불변식으로는 "ended 를 벗어나는 유일한 액션은 START" 가 아니다. 현재는 호출부(`start()`/
    `applyConfig()`)가 `state.phase==="ended"` 상태에서 이 두 액션을 실제로 디스패치하지 않아(직접 호출
    그래프로 확인) 활성 버그는 아니지만, 그건 다시 "호출부 규율"에 의존하는 것이고 — 이번 라운드가 리듀서에
    defense-in-depth 를 추가한 바로 그 이유(비대칭 가드가 4라운드 연속 재발)와 동일한 취약 유형이다.
    `RESOLUTION.md` 가 이 대목에 "(전수 확인)"이라는 강한 표현을 쓰는데, 실제로 전수 확인된 것은 "reducer
    action 정의" 가 아니라 "현재 호출 그래프에서 도달 가능한 경로"다 — 표현이 검증 범위를 실제보다 넓게
    주장한다.
  - 제안: 주석/RESOLUTION 문구를 "현재 호출부 기준 유일"로 한정하거나, 비용이 낮으므로 `RESTORED`/`BOOTED`
    에도 동일 `if (state.phase === "ended") return state;` 가드를 적용해 문구를 문자 그대로 참으로 만들 것.

- **[INFO]** 동일 인과 서사(C1·W2)가 코드 주석·테스트 리드 코멘트·RESOLUTION.md·plan 문서에 3~4중으로 거의 동일하게 반복 서술
  - 위치: 예) `use-widget.ts:188-197`(teardownSession no-op 가드, 10줄) ↔ `use-widget-eager-start.test.ts:1947-1953`
    (C1 테스트 리드, 7줄) ↔ `RESOLUTION.md` §C1(9줄) ↔ plan 문서 C1 항목(동일 인과 사슬). W2 도 동형 —
    `use-widget.ts` 2곳(`seedWaitingFromStatus` catch L374-379, `applyConfig` L714-717) + 테스트 리드
    (L1654-1661) + `RESOLUTION.md` §W2.
  - 상세: 지시받은 "주석 밀도가 높다"는 우려에 해당하는 지점이다. 버그 재발 이력(4라운드 연속 비대칭 가드)을
    고려하면 각 지점에 국소 컨텍스트를 남기는 것 자체는 정당화되나, 4곳에 걸쳐 같은 인과 사슬("teardownSession
    무조건 증가 → applyConfig stale 화 → config 미확립 → 런처만 뜨고 영구 정지")을 세부까지 반복 서술하면
    향후 이 로직이 다시 바뀔 때 4곳을 동기화해야 하는 부담이 생긴다 — 이 라운드의 근본 원인 자체가 "여러
    곳에 흩어진 규율의 비동기화"였다는 점과 구조적으로 유사한 리스크다.
  - 제안: 코드 주석은 "무엇을·왜"의 최소치만 남기고, 전체 인과 서사는 RESOLUTION.md/plan 문서 한 곳를 SoT 로
    삼아 코드 주석에서는 그 문서를 참조하는 정도로 축약하는 것을 고려. 차단 사유 아님 — 현재도 각 사본이
    서로 모순되지는 않는다.

- **[INFO]** `RESOLUTION.md` 테스트 카운트 산정 기준이 파일별로 다름(`widget-state` 행만 `it.each` 확장 미반영)
  - 위치: `review/code/2026/07/17/08_29_33/RESOLUTION.md` "검증" 절, "widget-state 31→33(W4 2건)"
  - 상세: 직접 실행 확인 결과(`npx vitest run`) `widget-state.test.ts` 는 리뷰 대상 커밋(`3b54c8727`)에서 실제
    **37개**, 이번 fix 이후 **39개** 테스트를 실행한다("31"/"33" 은 소스의 `it(` 리터럴 개수만 센 값으로 보이며,
    `isActiveConversationPhase` 의 `it.each` 1줄이 7개 phase 로 확장되는 것을 반영하지 못했다). 나머지 두 파일
    (`use-token-refresh`: 10→11, `use-widget-eager-start`: 36→39)은 `it.each` 가 없어 우연히 리터럴 개수 = 실제
    테스트 개수라 정확하다. 델타(+2)는 맞고, 최종 합계("channel-web-chat 22 파일 370 passed")도 직접 재실행해
    정확함을 확인했다(`22 passed / 370 passed`) — 다만 중간 표의 절대값 산정 기준이 행마다 다르다. 참고로
    같은 문서의 W2 mutation 표("7개→8개→9개" gen 검사 개수)는 `use-widget.ts` 8곳 + `use-token-refresh.ts`
    1곳 = 9 로 직접 재계산해도 정확히 맞아떨어져, 이 문서 전반의 신뢰도 자체는 높다.
  - 제안: 기능 영향 없음, 차단 불요. 향후 유사 표는 `vitest run` 실측 수치를 직접 인용해 산정 기준을
    일관되게 가져갈 것을 권장.

- **[INFO]** 신규 회귀 테스트(C1·W2·W3)가 파일의 기존 fetch-mock 보일러플레이트 반복 패턴을 그대로 답습
  - 위치: `use-widget-eager-start.test.ts` 신규 3테스트(L1662-1731 W2, L1900-1945 W3, L1954-2008 C1) 각각이
    `embed-config` reject·webhook/`interact` 202 envelope 분기를 가진 `vi.fn((url, init) => {...})` 를 인라인
    재정의.
  - 상세: 이번 diff 가 새로 만든 안티패턴이 아니라 파일 전체의 기존 관행(직전 라운드 SUMMARY.md INFO#3 에서
    이미 지적·"급하지 않음"으로 유예됨)을 답습한 것이다. 새 테스트 3건이 그 부채를 조금 더 늘렸을 뿐이다.
  - 제안: 이전 라운드 권고와 동일 — `installFetchWithStatusSequence(responses)` 류 공유 헬퍼 도입 시 반복
    축소 가능하나 급하지 않음.

## 요약

이번 diff 는 직전 리뷰의 W1(JSDoc 무효화 지점 수)·W5(`useTokenRefresh` 4번째 가드 미통합)·W7(죽은 `startGenRef`
참조) 지적을 실제로 정확히 반영했다 — `worldGenRef` JSDoc 의 "무효화 지점 셋" 주장은 코드 전수 확인 결과 정확했고,
`cancelledRef` 는 `worldGenRef` 로 완전히 대체돼 codebase 전체에 죽은 참조가 남지 않았으며, 타입체크·lint(사전에
공개된 기존 warning 1건 제외)·전체 vitest 스위트(22 파일 370 테스트) 가 실측으로도 깨끗하다. 다만 지시받은 "주석·
JSDoc 정확성" 관점에서 두 건의 실질적 문제를 새로 찾았다 — (1) 신규 회귀 테스트가 이 코드베이스의 **공식 spec
불변식 ID `"C1"`** 을 무관한 의미로 재사용해 같은 파일 안에서 3개의 `"C1:"` 테스트가 두 주제를 가리키는 혼동
소지를 만들었고, (2) `widget-state.ts`/`RESOLUTION.md` 의 "ended 를 벗어나는 유일한 액션은 START(전수 확인)"
주장이 `RESTORED`/`BOOTED` 케이스가 동일하게 무조건 전이한다는 사실과 배치된다(현재는 호출 그래프상 도달 불가라
활성 버그는 아님). 아울러 이 라운드가 고친 버그(C1·W2)의 근본 원인이 "세대 가드 관용구가 호출부마다 손으로
복제되는 구조"였음에도, 이번 fix 도 그 관용구를 헬퍼로 구조화하지 않고 2곳 더 손으로 추가해 향후 동일 클래스
버그 재발 가능성을 완전히 닫지는 못했다. 나머지는 재발 방지를 위한 상세 인과 주석이 코드·테스트·리뷰 문서에
3~4중으로 반복되는 점, `RESOLUTION.md` 의 테스트 카운트 한 행이 `it.each` 확장을 반영하지 못한 점 등 저위험
INFO 다.

## 위험도

LOW
