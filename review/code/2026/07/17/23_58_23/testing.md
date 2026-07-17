# 테스트(Testing) 리뷰 — webchat-boot-single-flight (23_58_23)

이번 라운드 핵심 요청: 직전 라운드(`18_39_11`)에서 testing 리뷰어가 지목한 블라인드 스팟 2건의 fix,
그리고 그 fix 를 고정한 신규 회귀 테스트 5건(②`unmountedRef`, A-6 되돌림 관련 2건, concurrency 2건)이
**실제로 결함을 잡는지**를 mutation 으로 직접 검증했다. 공유 워크트리는 읽기 전용으로 두고, 별도
detached worktree(`/private/tmp/.../scratchpad/testing-review-isolated`, HEAD `3f55ee000` 기준)를
만들어 `node_modules` 를 참조 워크트리에서 symlink 로 연결(vitest 단독 실행이라 turbopack 제약과
무관)한 뒤 5개 코드 지점을 개별 mutate → 전체 스위트(`vitest run`, 22 files) 실행 → 실패 테스트 정확히
확인 → 원복(diff 0 확인) 을 반복했다. 검증 후 `git worktree remove --force` 로 제거했다(`git worktree
list` 에 잔재 없음 확인). 베이스라인은 mutate 전/후 모두 **390 passed / 22 files** 로 일치.

## 발견사항

- **[INFO]** 요청된 5건 회귀 테스트 — mutation 매트릭스 전수 재현, 개발자 claim 과 **정확히 일치**
  - 위치: `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts:2881,2966,3042,3104,3160`
  - 상세: 아래 표는 각 결함 코드를 **정확히 그 한 줄만** mutate 한 뒤 전체 스위트를 돌려 얻은 결과다(모두 독립 재현, claim 재인용 아님).

    | # | mutate 지점 | 예상(개발자 claim) | 실측(본 리뷰 재현) |
    | --- | --- | --- | --- |
    | ① `unmountedRef` 축 제거 | `use-widget.ts:288` `cannotApplyConfig` — `unmountedRef.current \|\|` 삭제 | 1건 실패 | **1건 실패**: `언마운트 후 도착한 embed 응답은 새 execution 을 시작하지 않는다`(389/390) |
    | ② A-6 `teardownSession()` 재주입 | `use-widget.ts:672-692` `sendCommand` 비-410 catch 분기에 `teardownSession();` 재삽입 | 2건 실패 | **2건 실패**: `일시적 명령 실패(500)는 저장 세션을 지우지 않는다…`, `일시적 명령 실패(500) 후 새로고침하면 살아있는 대화가 복원된다`(388/390) |
    | ③ WAITING 분기 boot 가드 제거 | `use-widget.ts:538-541` `seedWaitingFromStatus` 의 `if (attempt && cannotApplyConfig(attempt)) return "stale";` 삭제 | 1건 실패 | **1건 실패**: `대체된 시도의 지연 getStatus 가 살아있는 화면을 옛 노드로 되감지 않는다`(389/390) |
    | ④ 종료 확정에 boot 가드 오추가(반대 방향) | `use-widget.ts:534-537` terminal 분기에 `if (attempt && cannotApplyConfig(attempt)) return "stale";` 삽입 | 1건 실패 | **1건 실패**: `대체된 시도가 발견한 종료는 그대로 확정된다 (종료 확정은 boot 축을 보지 않는다)`(389/390) |
    | ⑤(보너스, `widget-state.test.ts`) `RESTORED`/`BOOTED` 에 `ended` 가드 재도입 | `widget-state.ts:126-146` 두 case 에 `if (state.phase === "ended") return state;` 재삽입 | (미요청, 직접 확인) | **2건 실패**: `it.each` 의 `RESTORED`/`BOOTED` 케이스 둘 다(388/390) |
    | baseline | mutate 없음 | 0건 실패 | **0건 실패**(390/390), mutate 전후 5회 모두 동일 |

    각 mutation 은 **정확히 예상된 테스트만** 깨뜨렸다 — 다른 385~389건은 매번 그대로 통과해, 이
    회귀 테스트들이 넓은 범위의 우발적 통과(예: 타이밍 의존 flake)가 아니라 해당 코드 라인에
    **정밀 귀속**됨을 확인했다. mutation ①②③④는 diff 자체 파일(`use-widget.ts`)만 건드렸고, ⑤는
    페어 파일(`widget-state.ts`)로 커버리지 지도가 소스 대칭과 일치한다.
  - 제안: 없음 — 검증 통과. 향후 유사 축 추가 시 이 매트릭스 형식(지점→예상 실패 테스트명→실측)을
    재사용하면 "무방비 축" 재발을 빠르게 자가진단할 수 있다.

- **[INFO]** "`일시적 명령 실패(500)는 저장 세션을 지우지 않는다`" 의 `phase: "ended"` 단언이 실제
  동작과 정합함을 코드로 교차 확인 — 오더케스트레이터가 명시적으로 확인 요청한 항목
  - 위치: `codebase/channel-web-chat/src/lib/widget-state.ts:190-191`(`case "ERROR"`), 테스트 단언
    `use-widget-eager-start.test.ts:2957-2959`
  - 상세: 리듀서의 `ERROR` case 는 `teardownSession()` 이 있었던 시절에도 없어진 지금도 항상
    `{ ...state, phase: "ended", pending: null, error: action.message }` 를 반환한다 — A-6 되돌림이
    건드린 것은 `use-widget.ts` 의 `sendCommand` catch 분기(session 정리 여부)뿐이고, `dispatch({type:
    "ERROR"})` 자체·리듀서의 phase 전이는 불변이다. 따라서 "**세션은 보존**되지만(storage 안 지움) **phase 는
    `ended`** 로 남고 **SSE 는 계속 열려있다**(`sendCommand` catch 분기가 `closeStream`/`teardownSession`
    어느 쪽도 호출하지 않음)" 라는, 얼핏 모순돼 보이는 조합이 실제 코드 3곳(리듀서·sendCommand·SSE
    close 부재)의 교차로 정확히 재현되는 상태다. 테스트가 `statusCalls`/`getEs()` 불변과 `phase===
    "ended"` 를 함께 단언하는 것은 과장도 축소도 아니다. 이 "SSE 켜진 채 ended" 불일치 자체는 테스트
    주석과 `plan/in-progress/webchat-command-failure-is-not-termination.md` 양쪽에서 이 PR 이전부터의
    gap 으로 정직하게 이월돼 있어 은폐가 없다.
  - 제안: 없음 — 확인 완료.

- **[WARNING]** "`일시적 명령 실패(500) 후 새로고침하면 살아있는 대화가 복원된다`" 테스트가 자신의
  주석이 주장하는 "SSE 재연결"을 단언하지 않는다
  - 위치: `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts:2995-3030`
  - 상세: 테스트는 `const { getEs } = installControllableEventSource();` 로 최신 `EventSource` 인스턴스에
    접근할 수단을 마련해 두고, 새로고침 **전** SSE 이벤트 주입(`getEs()?.emit(...)`, L3007)에는 쓰지만
    새로고침 **후**에는 `getEs()` 를 한 번도 다시 호출하지 않는다. 단언은 `phase === "streaming"` 과
    `executionId === "e1"` 뿐이다(L3029-3030). 그런데 그 직전 주석은 "**§3.1-2: 200 + running → 복원.
    대화가 돌아온다**" 라고 SSE 재연결까지 포함하는 복원을 서술한다. 코드 추적상(`use-widget.ts`
    `applyConfig` 복원 분기 — `isAttemptStale(attempt)` 통과 후 `openStream(saved, "0")` 이 무조건
    실행됨, 이 시나리오엔 겹친 부팅이 없어 `isAttemptStale` 이 항상 false) 실제로 새 `EventSource` 가
    열릴 것으로 판단되나, **이 테스트 자체는 그것을 검증하지 않는다** — `phase==="streaming"` 은
    `RESTORED` dispatch(SSE 오픈보다 **먼저** 실행됨, `use-widget.ts:959`)만으로도 달성되므로, 가령
    이 restore 경로에 한정된 미래 회귀로 `openStream` 호출이 스킵돼도 이 테스트는 통과한 채로 남는다.
    (다만 `openStream` 자체는 이 restore 분기를 공유하는 다른 기존 테스트들, 예: `§3(재전송): 대체된
    시도가 연결 전에 물러나도 살아있는 시도가 연결을 세운다` 류가 이미 `getEs()` 로 별도 검증하므로
    전사적 위험은 낮다 — 이 테스트 하나만의 self-containment 갭이다.)
  - 제안: `await waitFor(() => expect(getEs()).not.toBeNull());` 한 줄을 마지막 두 단언 사이에 추가해
    주석이 약속하는 범위와 테스트 커버리지를 일치시킬 것.

- **[INFO]** `ERROR` catch 분기가 `endedRef` 를 세우지 않는 기존 gap — 새 테스트가 이를 확대 은폐하지
  않고 정직하게 처리하나, 그 상호작용 자체를 커버하는 테스트는 없음
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:652-697`(`sendCommand`), 대조:
    `finalizeEnded`(`endedRef.current = true` 설정, L379-380)
  - 상세: `ERROR` 로 종료 표시된 뒤에도 `endedRef.current` 는 `false` 로 남는다(`finalizeEnded` 를
    거치지 않으므로). 만약 이후 실제 SSE terminal 이벤트가 도착하면 `handleEiaEvent` 가
    `finalizeEnded` 를 (아직 `false` 이므로) 정상 실행해 `teardownSession()`(세션 정리) +
    `dispatch({type:"ENDED"})`(에러 메시지를 덮어씀, `ended` 케이스가 `error` 필드를 안 지우지만
    `ENDED` reducer 는 애초에 `error` 를 안 건드림 — 실은 무해) + host `conversationEnded` 재통지를
    수행한다. 이 이중 정리/통지 시나리오(ERROR 후 실제 terminal SSE 도착) 자체를 exercising 하는
    테스트는 이번 diff 에도 기존에도 없다. 다만 이는 이 PR 이 만든 회귀가 아니라(A-6 도입 전부터
    `ERROR` 는 `finalizeEnded` 를 쓰지 않았다 — `use-widget.ts` 의 "`finalizeEnded` 를 쓰지 않는 이유"
    주석 참조) 범위 밖이고, 새로 이월된 `webchat-command-failure-is-not-termination.md` plan 이 `ERROR`
    자체의 재설계를 다룰 예정이라 지금 테스트를 추가하면 그 plan 이 뒤집을 가능성이 높다 — 지금
    추가하지 않은 판단은 합리적이다.
  - 제안: 조치 불필요(정보성). 해당 plan 이 착수되면 "ERROR 뒤 실제 terminal SSE 도착" 시나리오를
    새 설계에 맞춰 테스트할 것.

- **[INFO]** 비-410 실패 대표값(500)만 테스트 — 코드가 단일 분기라 실질 커버리지 갭 아님
  - 위치: `use-widget-eager-start.test.ts:2881,2966` (둘 다 `status: 500`)
  - 상세: `sendCommand` 의 catch 분기는 `e.status === 410` 여부만으로 분기하고 그 외(409·4xx·5xx·순수
    네트워크 실패)는 전부 같은 `else` 코드를 실행한다(`use-widget.ts:671-693`, 상태코드를 검사하지
    않음). 즉 500 하나가 "410 아닌 모든 경우" 를 대표하는 것이 코드 구조상 타당하며, 409/4xx 를
    별도로 테스트해도 같은 코드 경로를 재실행할 뿐 새 분기를 노출하지 않는다.
  - 제안: 조치 불필요. 향후 이 분기가 오류 종류별로 갈라지면(이월된 plan 의 옵션 C) 그때 대표값을
    늘릴 것.

## 테스트 품질 관찰 (참고, 발견사항 아님)

- **격리**: 파일 전역 `beforeEach`(EventSource stub, `sessionStorage.clear()`) / `afterEach`
  (`vi.unstubAllGlobals()`, `vi.useRealTimers()`, `vi.restoreAllMocks()`, `document.referrer` 복원,
  `use-widget-eager-start.test.ts:185-202`)가 안전망으로 갖춰져 있어, 이번에 5회 연속 mutate→풀스위트
  실행→원복을 반복하는 동안 어떤 교차 오염도 관측되지 않았다(매 회 실패 건수가 예상과 정확히 일치).
- **결정성**: 신규 테스트들은 `embedResolvers`/`statusResolvers` 배열로 resolve 순서를 명시 제어해
  겹친 비동기 경쟁을 재현한다(`waitFor` 로 개수 확정 후 특정 인덱스만 resolve) — 실제 타이밍에
  의존하는 `setTimeout` 류 flaky 패턴이 없다.
- **테스트 용이성**: 프로덕션 코드가 `beginBootAttempt`/`cannotApplyConfig`/`isAttemptStale` 를
  토큰 기반 predicate 로 이름 붙여 분리해 둔 덕에, 각 축을 독립적으로 mutate 해도 영향 범위가
  코드 리딩만으로 예측 가능했다(예상과 실측이 매번 일치) — 회귀 테스트 설계·본 리뷰의 mutation
  검증 모두 이 구조에 크게 의존한다.

## 요약

이번 라운드의 핵심 산출물인 신규 회귀 테스트 5건(②`cannotApplyConfig` 의 `unmountedRef` 축, A-6
되돌림 관련 저장세션 보존 2건, concurrency C2 짝 2건) 을 격리 detached worktree 에서 정확히 그
결함 코드 한 줄씩 mutate 하여 독립 재현한 결과, 개발자가 SUMMARY/RESOLUTION/커밋 메시지에 기록한
mutation 매트릭스와 **완전히 일치**했다 — 각 mutation 은 정확히 의도된 테스트만 깨뜨렸고 다른
385~389건은 매 회 그대로 통과했으며, 베이스라인은 mutate 전후 5회 모두 390/390 로 재현됐다.
`widget-state.test.ts` 의 페어 `it.each` 회귀(리듀서 레벨)도 추가로 mutate 검증해 2건 정확히
귀속됨을 확인했다. 오더케스트레이터가 특별히 지목한 "`일시적 명령 실패(500)는 저장 세션을 지우지
않는다`" 의 `phase==="ended"` 단언은 리듀서의 `ERROR` case 가 세션 정리 여부와 무관하게 항상
`ended` 로 전이하는 코드와 정확히 정합함을 교차 확인했다 — SSE 가 열린 채 phase 만 종료로 보이는
조합은 모순이 아니라 3개 코드 지점(리듀서·`sendCommand`·close 부재)이 만드는 정확한 현재 동작이며,
테스트 주석도 이를 "이 PR 이전부터의 gap" 으로 정직하게 이월 처리해 은폐가 없다. 유일한 실질
발견은 새로고침 복원 테스트 하나가 자신의 주석("SSE 재연결")을 완전히 단언하지 않는 self-containment
갭(WARNING, 전사 위험은 낮음 — 같은 코드 경로가 다른 기존 테스트로 커버됨)이며, 나머지는 향후
참고용 INFO 다. 전반적으로 이번 라운드의 테스트 작업은 정밀 귀속·양방향 mutation(정상 방향 제거 +
반대 방향 오추가) 검증·정직한 이월 문서화를 갖춘 모범적 사례다.

## 위험도

LOW
