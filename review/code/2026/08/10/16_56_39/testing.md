# 테스트(Testing) Review

## 검증 방법

정적 리뷰만으로는 "vacuous 여부"를 판정할 수 없어(이 세션의 반복 교훈 — GREEN 은 증거가 아니다),
실제로 로컬에서 뮤테이션 테스트를 재현했다. 이 워크트리는 다른 세션과 공유되므로
`git checkout`/`stash`/`reset` 을 쓰지 않고 `cp` 로 백업 → Python 문자열 치환으로 뮤테이션 →
`npx vitest run` → `cp` 로 원복 → `diff` 로 바이트 동일성 확인, 총 3회 반복했다. 원복은 매번
byte-identical 을 `diff` 로 직접 확인했고, 최종적으로 `npx vitest run`(70/70) ·
`npx tsc --noEmit`(0 errors) 로 원 상태 복귀를 재확인했다.

검증 도중 이 워크트리가 **다른 세션에 의해 실시간으로 계속 수정되고 있음**을 발견했다
(`git log --oneline -1` 이 세션 도중 `c591566e4` → `3d0cec69b` 로 바뀌었고, working tree 에는
`recoverFromExpiredToken` 의 non-terminal 분기를 `"stale"` → 4번째 `SeedOutcome` 값으로
재설계 중인 미완성 diff 가 실시간으로 나타났다 사라졌다 한다 — `documentation` reviewer 도 같은
현상을 독립적으로 확인했다). 내 뮤테이션 백업은 세션 시작 시점(`c591566e4` 기준 uncommitted
diff, 즉 이 프롬프트가 가리키는 스냅숏)에서 뜬 것이고, 각 원복 뒤 `diff` 로 바이트 동일성을
확인했으므로 다른 세션의 커밋(`3d0cec69b`)이나 그 이후 작업을 덮어쓰지 않았다. 아래 판정은
**이 리뷰 프롬프트가 가리키는 diff 스냅숏**(`use-widget.ts` non-terminal 분기가 `"stale"` 을
반환하는 상태) 기준이다.

## 발견사항

- **[CRITICAL]** 신규 REST-오류 회귀 2건의 단언이, 이번 라운드가 새로 만든 CRITICAL(non-terminal
  refresh 실패 시 `scheduleRefresh()` 가 영원히 예약되지 않아 `streaming` 스피너에 영구 고착)을
  통과시킨다 — `security`·`side_effect`·`scope`·`requirement`·`documentation` **5명**이 코드
  추적으로 이미 독립 수렴한 것과 별개로, 테스트 설계 관점에서 근본 원인을 짚는다.
  - 위치: `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts:448`(`it("§R4: refresh
    가 **네트워크 오류**로 실패하면 종료로 확정하지 않는다"`, 단언은 `:482`)와 `:487`(`it("§R4: refresh
    가 \`500\` 으로 실패해도 종료로 확정하지 않는다 — 상태 **필터** 축"`, 단언은 `:518`) — 두 테스트
    모두 `expect(result.current.state.phase).not.toBe("ended")` 하나로 "종료로 오판하지 않았다"를
    검증한다. 원인 쪽: `codebase/channel-web-chat/src/widget/use-widget.ts:448`(`if (!terminal) { ...;
    return "stale"; }`), 호출부 게이트 `:699`(`start()` — `if (outcome !== "continue") return;`)/`:715`
    (`scheduleRefresh();` — 도달 못 함) 및 `:1051`(`applyConfig()` 동형 게이트)/`:1067`(마찬가지로
    도달 못 함).
  - 상세: `applyConfig()`(재로드 복원 경로)는 세션을 storage 에서 읽자마자
    `dispatch({ type: "RESTORED", ... })` 로 `phase` 를 즉시 `"streaming"` 으로 만든다(REST 검증은
    그 **뒤**에 일어난다). 이후 `getStatus` 가 `401` 을 주고 `recoverFromExpiredToken` 의 refresh
    자체가 네트워크 오류/`500`(비-`401`/`410`) 으로 실패하면 `"stale"` 이 반환되고, 호출부는
    `outcome !== "continue"` 를 보고 `openStream` **과 `scheduleRefresh` 를 함께** 건너뛴 채
    `return` 한다. `scheduleRefresh`(`use-token-refresh.ts`)는 스스로 최초 1회 실행되지 않으므로
    (JSDoc 자체가 "시작/세션복원 직후 1회 호출해 예약 개시"라 명시), 이 경로로 빠진 세션은 **그
    프로세스 생애주기 동안 다시는 refresh 를 시도하지 않는다** — `phase` 는 `"streaming"` 에,
    SSE 는 없이, 에러 배너도 없이(예외를 던지지 않으므로) 영구 고착된다. 두 신규 회귀 테스트는
    정확히 이 상태(`phase === "streaming"`)에서 `expect(...).not.toBe("ended")` 를 평가하는데,
    `"streaming" !== "ended"` 는 **항상 참**이므로 이 CRITICAL 이 있어도 없어도 똑같이 통과한다 —
    이 단언은 버그를 검출할 능력이 원천적으로 없다(뮤테이션이 필요 없다, 리뷰 대상 diff 의 코드
    자체가 이미 이 상태다). 직접 실행으로 확인: `npx vitest run
    src/widget/use-widget-eager-start.test.ts` → **70/70 passed**(버그가 존재하는 스냅숏에서).
  - 왜 vacuous 형태로 분류하는가: 오케스트레이터가 지시한 "waitFor 조건이 t=0 에 이미 참"과는
    다른 하위 형태다 — 여기선 **wait 조건 자체는 non-vacuous**(직전 항목에서 뮤테이션으로 확인)
    하지만, 그 뒤에 오는 **단언이 두 갈래(정상 vs 고착)를 구분 못 하는 너무 약한 술어**다. "기다림"
    과 "단언"을 분리해서 봐야 하는 이유가 정확히 이 사례다 — 대기는 제대로 됐는데 그 뒤 물음이
    잘못됐다.
  - 제안: `phase === "streaming"` 을 **명시** 단언(현재 값이 무엇인지 드러내는 게 "종료 아님"보다
    강한 신호)하고, `vi.useFakeTimers()` 로 `scheduleRefresh` 가 실제로 재시도 타이머를 걸었는지
    (예: 지연 후 `refresh-token` 재호출 관측)까지 확인하도록 두 테스트를 보강할 것. 코드 쪽 수정
    (예: `recoverFromExpiredToken` 의 non-terminal 분기가 직접 `scheduleRefresh` 를 걸거나 새
    outcome 을 신설)이 선행되면 그에 맞춰 단언 대상만 바뀌면 된다 — 다른 4개 리포트의 제안과 같은
    방향이다.

- **[검증 결과]** 오케스트레이터 지시 — "다른 테스트들에도 같은 형태의 헛대기(`waitFor` 조건이
  boot 전에 이미 참)가 없는지 전수 확인" — 뮤테이션 3종으로 직접 검증, **추가 vacuous wait 없음**
  - 위치: `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts` 신규 `it` 8건
    (`:258` 404 · `:277` 401-성공 · `:330`대 세계-변경 경합 · `:390`대 401-재실패 · `:410`대 410-실패
    · `:448` 네트워크-오류 · `:487` 500-필터 · `:527`대 일반 500-soft-fail — 정확한 시작 줄은
    프롬프트 diff 게이트, 현재 파일 기준으로는 이 순서로 연속 배치돼 있음)
  - 상세: 각 테스트의 `waitFor` 술어가 t=0 에 이미 참일 수 있는지 하나씩 대조했다 — `getEs()`(신선한
    스텁, 항상 `null` 시작) · `result.current.state.phase`(초기값 `"collapsed"`, `initialState`,
    `codebase/channel-web-chat/src/lib/widget-state.ts:66`) · `releaseRefresh`(클로저 내
    `let ... = null` 시작) · `fetchMock.mock.calls.some(...)`(빈 배열 시작) 넷 다 boot 이전에는
    거짓/`null`이다 — 이전 라운드(`16_42_07`→`16_56_39` 이 diff)가 겪은 `storage != null`(boot 전에
    이미 seed 돼 있어 t=0 에 참) 형태는 재발하지 않았다. 다음 3건을 직접 뮤테이션해 각각을 겨냥한
    테스트만 RED, 나머지 69건은 GREEN 임을 실측했다(복원은 매번 `cp`+`diff` 로 확인):
    1. `terminal` 판정에서 `instanceof EiaError &&` 만 제거(상태-필터 축 제거) →
       "§R4: refresh 가 `500` 으로 실패해도..." 1건만 RED. 네트워크-오류 테스트는 영향 없음(축이
       다름을 재확인).
    2. `terminal = true`(조건 전체 제거) → 네트워크-오류·500-필터 **2건** RED, 나머지 GREEN.
    3. 성공 분기 첫 번째 `isStale(gen)` 제거(`use-widget.ts:414`) → "§R4: refresh 왕복 중 세계가
       바뀌면..." 1건만 RED(늦게 도착한 토큰이 종료된 storage 를 되살림), 나머지 GREEN.
    세 뮤테이션 모두 의도한 테스트만 RED 로 갈렸고 다른 68~69건은 흔들리지 않아 테스트 격리도
    함께 확인됐다. `waitFor(fetchMock.mock.calls.some(...))` 뒤 `await act(async () => { await
    Promise.resolve(); })` 한 틱만으로 충분한지도 실측으로 확인했다 — `waitFor` 는 첫 동기 체크가
    실패하면 매크로태스크(기본 `setInterval`) 단위로 재확인하므로, 조건이 참이 되는 시점엔 이미
    현재 마이크로태스크 큐(순수 이미 정착된 Promise 체인)가 전부 비워진 뒤다. 실측(위 뮤테이션 1·2)
    이 이를 뒷받침한다 — 한 틱만으로 두 갈래(terminal/non-terminal)가 정확히 갈렸다.
  - 결론: **오케스트레이터가 지목한 형태의 vacuous wait 는 신규 8건 중 더 이상 없다.** 다만
    바로 위 CRITICAL 항목에서 보듯, "대기는 맞는데 단언이 약한" **다른 형태**의 테스트 실효성
    문제가 2건 남아 있다.

- **[INFO]** `applyRefreshedToken`(공유 헬퍼) 직접 단위 테스트 부재 — `16_42_07` testing 라운드가
  이미 지적했고 이번 라운드에도 그대로 남아 있음(우선순위 낮음, 재확인만)
  - 위치: `codebase/channel-web-chat/src/lib/session-store.ts:125-133`(정의) / 호출부
    `codebase/channel-web-chat/src/widget/use-token-refresh.ts:93-97`(간접 커버)
  - 상세: `grep -n "applyRefreshedToken" session-store.test.ts use-token-refresh.test.ts` 결과
    양쪽 모두 매치 없음 — 여전히 두 호출부 테스트의 간접 커버리지에만 의존한다. 실패 시 "공유
    헬퍼 버그"와 "호출부 배선 버그"를 구분하려면 두 테스트 파일을 오가야 하는 비용은 그대로다.
  - 제안: 우선순위 낮음(3라운드 연속 이월 — 실제 회귀 위험은 낮음). `session-store.test.ts` 에
    "기존 필드 보존 + token/expiresAt 교체 + saveSession 호출"을 직접 단언하는 테스트 1건을
    추가하면 국지화 비용이 준다.

- **[INFO]** 테스트 격리·가독성 — 신규 8건 양호, 위 뮤테이션 3종이 교차오염 없음을 실측으로
  뒷받침
  - 위치: 전역 `beforeEach`/`afterEach`(파일 상단, 이번 diff 밖 — `sessionStorage.clear()` +
    `EventSource` 스텁 재설치 / `vi.unstubAllGlobals()` 등)
  - 상세: 뮤테이션 3종 각각에서 겨냥한 테스트 외 68~69건이 항상 GREEN 으로 유지된 것이 격리의
    실측 증거다. 신규 테스트들의 주석은 "왜 이 케이스가 필요한가"(어느 뮤턴트를 겨냥하는지,
    어느 이전 라운드의 지적을 닫는지)를 각 `it` 상단에 명시해 의도가 뚜렷하다.

## 요약

오케스트레이터가 명시한 검증 항목(이전 라운드의 `waitFor(storage != null)` 류 헛대기가 신규
테스트 다른 곳에도 있는가)은 뮤테이션 3종의 직접 실측으로 **없음**을 확인했다 — 8건의 `waitFor`
술어 모두 boot 이전엔 거짓/`null`이고, 겨냥한 뮤턴트만 정확히 RED 로 갈린다. 그러나 그 검증
과정에서 **다른 형태**의 테스트 실효성 문제를 발견했다: 신규 회귀 2건("네트워크 오류"·"500 필터")은
대기 자체는 올바르지만 그 뒤 단언(`phase !== "ended"`)이 이번 라운드가 새로 만든 CRITICAL(옛
CRITICAL을 "continue"→"stale" 로 막으며 `scheduleRefresh` 예약까지 함께 없앤 것)의 두 결과
상태("정상 streaming" vs "영구 고착된 streaming")를 구분하지 못해 무력하다 — 이 코드베이스
자신의 diff 스냅숏에서 실측으로 확인(70/70 passed, 버그 존재 상태에서). 이 CRITICAL 자체는
`security`·`side_effect`·`scope`·`requirement`·`documentation` 5명이 이미 코드 추적으로 독립
수렴했으므로 여기서는 "왜 테스트가 못 잡았는가"와 "어떻게 잡게 고칠 것인가"만 테스트 관점으로
더한다. 그 외 갭(공유 헬퍼 직접 단위 테스트 부재)은 3라운드째 낮은 우선순위로 이월 중이며 이번
라운드에도 실질 위험 변화 없다.

## 위험도

CRITICAL
