# Testing Review — webchat-boot-single-flight (A-5/A-6 검증)

> 범위: `codebase/channel-web-chat/src/lib/widget-state.{ts,test.ts}`,
> `codebase/channel-web-chat/src/widget/use-widget{.ts,-eager-start.test.ts}`,
> `spec/7-channel-web-chat/2-sdk.md`, `plan/in-progress/webchat-boot-single-flight.md` §A-5/A-6.
> 검증 방법: `git worktree add --detach <tmp> HEAD`(commit `74662e3b2`) 격리 워크트리에서 실제
> mutation 을 코드에 주입해 `vitest run`(channel-web-chat 전체 382건)을 반복 실행, 결과 확인 후 즉시
> `git checkout --`/`git worktree remove`로 원복·제거. 공유 워크트리는 읽기 전용으로만 사용했다(작업
> 도중 공유 트리에 다른 프로세스의 커밋/미커밋 변경이 실제로 발생하는 것을 관측 — 아래 "검증 방법론
> 비고" 참조).

## 발견사항

- **[INFO]** mutation 매트릭스 6개 값 전부 독립 재현 — 보고값과 완전 일치
  - 위치: `use-widget.ts:261-270`(`beginBootAttempt`/`isAttemptStale`), `:835-846`(1차 재검증), `:868`(2차 재검증)
  - 상세: 격리 워크트리에서 각 mutation 을 직접 주입해 전체 스위트(382건)를 돌렸다.
    - boot 축 무력화(`isAttemptStale`에서 `bootGenRef` 비교 제거) → **4건 실패**(보고값 일치, 실패 테스트명도 동일)
    - 세대 미증가(`beginBootAttempt`의 `++bootGenRef.current`→`bootGenRef.current`) → **4건 실패**(위와 동일한 4개 테스트 — 두 mutation 이 사실상 같은 방어선을 서로 다른 지점에서 무력화함을 확인)
    - 1차 재검증 지점(`:838`)만 제거 → **3건 실패**(2차 지점을 전용으로 타겟팅한 §106 테스트는 실패하지 **않음** — 두 지점이 서로 다른 코드 구간을 독립적으로 방어한다는 주석의 주장과 일치)
    - 2차 재검증 지점(`:868`, 복원 분기)만 제거 → **1건 실패**, 그 1건은 정확히 신규 테스트 `"§106: 복원 seed 중 재전송으로 대체된 시도는 SSE 를 열지 않는다"`. 이 테스트만 `it.skip`으로 빼고 같은 mutation 을 다시 걸어보면 **나머지 381건 전원 통과** — "이 테스트 도입 전엔 이 지점이 무방비였다"는 주장을 재확인.
    - world 축 무력화(`isAttemptStale`에서 `worldGenRef` 비교 제거) → **1건 실패**, 정확히 신규 테스트 `"embed-config 왕복 중 언마운트 → 지연 응답이 세션·SSE 를 되살리지 않는다"`. 코드 추적으로 이유까지 확인: 이 mutation 은 1차/2차 두 지점에 공유되는 `isAttemptStale` 자체를 건드리므로 원칙적으로 두 지점 모두 영향받아야 하는데, 실제로 걸리는 시나리오가 "1차 대기 중 언마운트"(1차 지점) 하나뿐인 것은 2차 지점의 world 성분이 `seedWaitingFromStatus` 자체의 기존 `isStale(gen)` 내부 검사와 시간적으로 겹쳐 항상 선점되기 때문(아래 "남은 사각지대" 참조 — 실제 갭 아님, 별도 확인).
    - 베이스라인(무변경) → **0건 실패**(382 passed 그대로).
    - 추가로, pre-PR 코드(commit `5de44d4d6`, `isAttemptStale` 도입 전의 `isStale(gen)` 단일축 체계)를 별도로 체크아웃해 2차 지점의 `isStale(gen)` 을 제거해봤다 — 그 시절 테스트(44건, 이 파일 단독) **전부 통과**. "world 가드가 이 지점에서 한 번도 고정된 적이 없었다"는 plan 의 주장도 코드 자체로 별도 재현했다.
  - 제안: 없음 — 보고된 수치·주장 모두 실측과 일치.

- **[INFO]** 회귀 테스트 2건의 기대값 변경 — 둘 다 실측으로 정당성 확인
  - 위치: `use-widget-eager-start.test.ts:2275-2344`("겹친 부팅의 결과가 갈릴 때…"), `:2359-2441`("겹친 부팅에서 나중 진입이 차단으로 먼저…")
  - 상세:
    - 첫 번째 테스트: `expect(...).not.toBe("blocked")` 로 뒤집은 것이 실제로 boot 축 mutation 을 잡는 유효 단언인지 assertion 단위로 확인했다 — boot 축을 무력화하면 정확히 이 줄(`AssertionError: expected 'blocked' not to be 'blocked'`)에서 실패한다. 즉 이 assertion 은 단순 "따라간" 전제 수정이 아니라 그 자체로 "superseded 시도는 BLOCKED 를 디스패치하지 않는다"는 새 불변식을 실제로 검증한다. 최종 단언(`hookPosts===1`)은 그대로다.
    - 두 번째 테스트가 더 중요한 검증 대상이었다 — plan 이 명시한 4개의 과거 실패 설계 중 하나("BLOCKED 한정 폐기": 이번 시도가 BLOCKED 로 끝나면 `pendingResetRef`를 지운다)를 실제로 코드에 재구성해 두 가지로 확인했다.
      1. **현재 테스트(후속 이월 확인 포함)** 로 실행 → 정확히 걸린다(`await waitFor(() => expect(hookPosts).toBe(1))` 타임아웃). 같은 mutation 을 스위트 전체로 돌리면 기존 순차 케이스 테스트("차단된 부팅 중의 resetSession…")도 독립적으로 걸려 2건 실패 — 주석이 말하는 "의도치 않은 이중 방어선"이 실제로 작동함을 확인.
      2. **후속 이월 확인(라인 2432-2440)만 제거한 truncated 버전을 그 테스트 단독으로 실행** → 같은 mutation 을 걸어도 **통과**해버린다. 즉 `expect(hookPosts).toBe(0)` 단독으로는 "이월"(정상)과 "소실"(버그)을 구분하지 못한다는 plan 의 주장을 직접 재현했다 — 후속 단언이 순수 사족이 아니라 이 테스트의 실질적 탐지력 원천이다.
  - 제안: 없음 — 두 변경 모두 방어력 저하가 아니라 순수 정제(plan 표현 그대로)임을 확인.

- **[INFO]** A-6 가드(`RESTORED`/`BOOTED`) mutation — 보고값과 일치
  - 위치: `widget-state.ts:125-143`, `widget-state.test.ts` 신규 `it.each` 블록
  - 상세: `RESTORED` 가드(`:136`) 제거 → unit(`it.each` "RESTORED: …") + 통합("ERROR 로 종료된 대화는…") **2건** 실패. `BOOTED` 가드(`:142`) 제거 → unit **1건만** 실패(통합 테스트는 오늘 `BOOTED`가 `ended`에서 도달 불가하다는 주석과 일치 — `START`(→booting) 직후에만 오므로 이 시나리오를 만들 진입점이 없다).
  - 제안: 없음.

- **[INFO]** 부분 가드(partial-guard) mutation — `executionId` 누출은 어떤 테스트도 잡지 못함(낮은 실질 위험)
  - 위치: `widget-state.ts:136`(`if (state.phase === "ended") return state;`)
  - 상세: 가드를 완전히 제거하는 대신 `phase`는 정확히 지키되 `executionId`만 갱신하는 "부분 가드" — `if (state.phase === "ended") return { ...state, executionId: action.executionId };` — 로 바꿔 실행했더니 **382건 전원 통과**했다. 신규 `it.each` 테스트는 `s.phase`만 검사하고 `executionId`(또는 참조 동일성)는 검사하지 않기 때문이다. 다만 `grep -rl executionId src --include="*.tsx"` 결과 `WidgetState.executionId` 필드는 어떤 렌더 컴포넌트에서도 소비되지 않는다(write-only) — 오늘 시점 사용자 영향은 없다. 같은 파일의 기존 `WAITING` 가드 테스트(`ENDED 이후 WAITING → 무시…`, 이번 라운드 이전부터 존재)는 `pending`/`messages`("유령" 메시지 미혼입)까지 검사해 이 파일 자체의 선례보다 새 테스트가 더 얕다는 비대칭이 있다.
  - 제안: `reduce`로 ended 스냅샷을 별도로 캡처해 `expect(s).toBe(endedSnapshot)`(참조 동일성)로 강화하거나, 최소 `expect(s.executionId).toBeUndefined()` 한 줄 추가 권장. 급하지 않음 — 이 파일이 "가드는 규율이 아니라 구조" 원칙을 반복 강조하는 만큼 다음에 `executionId`가 어딘가에서 소비되기 시작하면 이 갭이 조용히 실제 버그로 전환될 수 있다는 점만 기록해 둔다.

- **[INFO]** 문서 drift — `WAITING` 케이스 주석이 A-6 이후 갱신되지 않음
  - 위치: `widget-state.ts:155-156`
  - 상세: "**가드 범위는 WAITING 뿐이다** — `RESTORED`/`BOOTED`/`USER_MESSAGE` 도 `state.phase` 를 검사하지 않고 무조건 전이하므로…" 라는 주석이 A-6 이후에도 그대로 남아 있다. 그런데 바로 위 125-143행에서 `RESTORED`/`BOOTED`는 이미 가드가 생겼다(A-6). 테스트 자체엔 영향 없지만, 다음 라운드 작업자가 이 주석만 보고 "RESTORED/BOOTED 미가드"로 오판해 이미 닫힌 갭을 다시 조사하거나, 반대로 정말 남은 `USER_MESSAGE` 갭을 "3개 다 안 막혔다"는 낡은 프레임으로 오인할 위험이 있다.
  - 제안: "가드 범위는 `WAITING`·`RESTORED`·`BOOTED` — `USER_MESSAGE` 만 남았다" 로 갱신.

- **[INFO]** 남은 사각지대 탐색 결과 — 실질적 신규 갭 미발견(가설 1건은 반증)
  - "2차 지점(복원 분기)에서 world 축만 별도로 취약한 시나리오가 있는가"를 직접 구성해 확인했다 — 언마운트 시점을 embed-config 왕복 중이 아니라 **seed(getStatus) 왕복 중**으로 옮긴 프로브 테스트를 작성해 (a) 베이스라인에서 통과, (b) world 축 무력화 mutation 에서도 여전히 통과함을 확인했다. 이유는 `seedWaitingFromStatus` 자신의 `gen` 캡처가 언마운트 **이후**에 일어나는 1차-지점 시나리오와 달리, 2차-지점 시나리오에서는 `seedWaitingFromStatus`의 자체 `isStale(gen)` 내부 검사(2차 지점 신설 이전부터 존재)가 언마운트를 먼저 잡아 `outcome !== "continue"`로 조기 반환하고, 그 뒤에는 `isAttemptStale`까지 도달할 await 지점이 없어(동기 연속) 두 검사가 시간적으로 겹칠 수 없기 때문이다. 즉 처음엔 그럴듯해 보였지만 실제로는 갭이 아니었다 — 별도 테스트 불필요.
  - `USER_MESSAGE`(및 `RESTORED`/`BOOTED` 외 나머지 액션)의 `ended` 미가드는 plan 이 "실패 사례 없이 확대하지 않는다"고 명시적으로 보류한 기존 결정이며 이번 라운드가 새로 만든 공백이 아니다. `submitMessage` 호출부가 dispatch 전에 `state.phase === "awaiting_user_message"`를 확인해 오늘은 도달 불가 — 다만 위 문서 drift 항목 때문에 이 논리가 다음 라운드에 흐려질 위험은 있다.
  - Test 1(`겹친 부팅의 결과가 갈릴 때…`)의 `not.toBe("blocked")` 지점에서 실제 `phase` 값을 직접 로깅해 확인했더니 `"panel"`로 고정돼 있었다. 음성 단언(`not.toBe`) 대신 사전에 캡처한 phase 스냅샷과의 동일성(또는 최소 `toBe("panel")`)으로 바꾸면 "이 시도는 아무 디스패치도 하지 않았다"는 의도를 더 정확히 표현할 수 있다 — 사소한 개선 여지이며 현재도 오탐/누락 없이 정상 동작한다.

- **[INFO]** `establishConfig` 비동기-금지 불변식의 컴파일러 강제 — 별도 재현으로 확인
  - 위치: `use-widget.ts:809-825`
  - 상세: B 단계가 "회귀 테스트 대신 컴파일러가 막는다"고 주장한 부분을 두 가지 방식으로 직접 재현했다. (1) 함수를 `async`로 바꾸면 호출부 `establishConfig(cfg) === "reset"` 비교에서 `TS2367`(겹치는 타입 없음)로 즉시 깨진다. (2) 비-async 상태에서 `await`를 억지로 삽입하면 `TS1308`("await" expressions are only allowed within async functions)로 파서 단계에서 막힌다. 두 경로 모두 `tsc --noEmit`으로 확인 — 별도 회귀 테스트가 불필요하다는 주장은 타당하다(CI 가 `tsc`/build 를 항상 돌린다는 전제 하에).
  - 제안: 없음.

- **[INFO]** 테스트 격리·가독성·설계 — 특이사항 없음(양호)
  - 신규 6건 모두 파일 전역 `beforeEach`(sessionStorage.clear, EventSource stub)/`afterEach`(unstubAllGlobals, useRealTimers, restoreAllMocks, referrer 원복)을 상속해 기존 45건과 동일한 격리 규율을 따른다. 각 테스트가 `waitFor`로 "전제"(embed-config in-flight 개수, resolveStatus 존재 등)를 먼저 고정한 뒤 조작하는 패턴이 일관돼, 과거 3회 지적된 "전제 미고정" 패턴을 신규 테스트들이 스스로 재발시키지 않았다(Test E의 `sessionStorage.getItem(...).toContain("e1")` 전제 단언은 별도로 mutation 주입해 "이 단언이 없으면 세션-정리-변경 같은 무관한 리팩터로도 조용히 vacuous pass 한다"까지 재현 확인). 신규 프로덕션 코드(`beginBootAttempt`/`isAttemptStale` 토큰화, `establishConfig` 동기 추출)는 오히려 테스트 용이성을 개선한 사례 — 축이 늘어도 호출부 패턴이 안 늘고, 규율 의존 구간을 타입 시스템으로 대체했다.
  - 제안: 없음.

## 검증 방법론 비고

작업 도중 공유 워크트리(`webchat-boot-single-flight-8c92b4`)에서 다른 프로세스가 커밋(`74662e3b2`→`215cd1c3f`, 실제로는 rebase — `git diff 5de44d4d6..74662e3b2`와 `git diff 14bc86a53..215cd1c3f`가 리뷰 대상 4개 파일에 대해 바이트 단위로 동일함을 확인)과 미커밋 변경을 동시에 발생시키는 것을 관측했다. 지시받은 대로 모든 mutation 실험을 격리 워크트리에서만 수행했기 때문에 이 동시 편집의 영향을 받지 않았고, rebase 전후 diff 동일성 확인으로 본 리뷰의 근거(commit `74662e3b2` 스냅샷)가 현재 HEAD(`215cd1c3f`)에도 그대로 유효함을 검증했다.

## 요약

`plan/in-progress/webchat-boot-single-flight.md` §A-5가 보고한 mutation 매트릭스 6개 수치(boot축 무력화 4·1차 지점만 제거 3·2차 지점만 제거 1·world축 무력화 1·세대 미증가 4·베이스라인 0)를 격리 워크트리에서 전부 독립 재현했으며, 실패한 테스트명까지 일치한다. 특히 "2차 지점·world 축이 이 라운드 전엔 무방비였다"는 핵심 주장은 신규 테스트만 skip한 상태로도, pre-PR 커밋을 직접 체크아웃한 상태로도 별도로 재확인했다. 기존 회귀 테스트 2건의 기대값 변경은 둘 다 방어력 약화가 아니라 정당한 의미 정제였다 — 특히 "소실 vs 이월" 구분 단언은 그것을 제거하면 실제로 과거 실패 설계(BLOCKED 한정 폐기) 재도입을 놓친다는 것을 직접 mutation 으로 재현해 확인했다. A-6 가드의 mutation 탐지 수도 정확히 일치한다. 발견된 두 가지 잔여 이슈 — `RESTORED`/`BOOTED` 가드의 `executionId` 부분 누출 미검증, `WAITING` 케이스 주석의 A-6 이후 drift — 는 모두 현재 사용자 영향이 없거나(전자, 필드 미소비) 테스트 자체에는 영향 없는 문서 정합성 문제(후자)로, 이번 라운드가 주장한 검증 결과의 신뢰도를 훼손하지 않는다. "전제 미고정" 패턴(과거 3회 지적)이 신규 6건에서 재발했는지도 개별 확인했고, 재발 사례는 없었다 — 오히려 Test E는 그 교훈을 스스로 적용해 전제 단언을 선제적으로 넣었고, 그 단언이 실제로 load-bearing 함을 별도 mutation 으로 확인했다.

## 위험도

LOW
