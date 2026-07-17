# 동시성(Concurrency) Review

**대상**: `codebase/channel-web-chat/src/widget/use-widget.ts`(`pendingResetRef` 지연 이행 플래그 + `isStale(gen)` 추출,
커밋 `54489e618 fix(web-chat): C1 픽스가 남긴 부팅-리셋 소실 gap 봉합 + 세대 가드 isStale 승격`) ·
`use-token-refresh.ts`(영향 없음, 대조 확인) · `widget-state.ts`(`ended` 가드, 재확인) · 대응 테스트
(`use-widget-eager-start.test.ts` 신규 "저장 세션이 있는 채로 부팅 중 resetSession → 옛 대화가 부활하지 않는다"
등). 직전 라운드(`09_36_01`)가 지적한 "C1 fix 가 남긴 부팅-리셋 소실 gap"의 봉합 fix에 대한 재검증이며, orchestrator 가
지정한 3개 질의(재진입 안전성 · 반복 명령 coalesce · `isStale` 추출의 시맨틱 보존)에 집중했다.

**검증 방법**: (1) 5개 변경 소스 파일(`use-widget.ts`·`use-token-refresh.ts`·`widget-state.ts`와 대응 테스트
3종) 전체를 직접 통독해 코드를 추적했다. (2) `git status`/`git log` 로 워크트리가 다른 프로세스에 의해 편집 중이
아닌 안정 상태(커밋 `892151313` HEAD, clean)임을 먼저 확인한 뒤 공유 워크트리에서 관련 테스트 91건을 실측
실행(전부 PASS, 직전 라운드가 지적한 "공유 worktree 동시편집" 오염 없음을 재확인). (3) `git worktree add
--detach`로 **격리 worktree** 를 만들어 (a) Q2 를 직접 실측하는 진단용 회귀 테스트("부팅 중 resetSession 2회
연속 도착 → pendingReset 재생은 1회만")를 추가해 실행하고, (b) fix 를 되돌리는 mutation
(`if (false && pendingResetRef.current)`)으로 그 진단 테스트와 기존 회귀 테스트가 **둘 다 정확히 killed**됨을
확인해 진단 테스트 자체의 유효성(vacuous pass 아님)까지 검증한 뒤, 격리 worktree 를 완전히 제거했다. 공유
워크트리(`funny-mahavira-50d003`)는 시종 읽기 전용으로만 접근했다(편집 없음 — `git status` 로 재확인).

## 발견사항

- **[INFO]** Q1 — `pendingResetRef` 재생 경로는 재진입 안전: 전체 시퀀스가 await 없는 단일 동기 구간 안에서 끝난다
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts` `applyConfig()`의
    `if (pendingResetRef.current) { pendingResetRef.current = false; apiRef.current.newChat(); return; }`
    (L741-745, `configRef.current = cfg;`/`clientRef.current = new EiaClient(...)` 직후) ↔ `newChat()`
    (L619-642) ↔ `teardownSession()`의 pre-config 분기(L231-234) ↔ `start()`의 동기 프리픽스(L456-465).
  - 상세: `applyConfig`가 자신의 `gen`을 캡처하는 시점(L723)은 **첫 번째** `await isEmbedAllowed(...)`
    (L725) **이전**이고, 그 `gen`은 await 직후 `isStale(gen)` 1회 검사(L726)에만 쓰인다 — 이 시점엔 아직
    `configRef.current`가 null이라 어떤 gen 변조도 일어난 적이 없다. 이후
    `configRef.current = cfg; clientRef.current = new EiaClient(...)`부터 `pendingResetRef` 분기의
    `return`까지는 **await 이 하나도 없는 순수 동기 코드**다 — `apiRef.current.newChat()` →
    `resetSessionRefs()` → `teardownSession()`(이제 `configRef.current`가 non-null이라
    `worldGenRef.current++` 1회) → `dispatch(NEW_CHAT)` → `void start()`의 동기 프리픽스
    (`startedRef.current=true`, `const gen = ++worldGenRef.current;` 2회째 증가, `dispatch(START)`,
    `await client.startConversation(...)`에서 비로소 suspend)까지 JS 단일 스레드 run-to-completion 으로
    이어진다. 즉 이 구간엔 **다른 콜백이 끼어들 물리적 여지가 없다**(이벤트 루프에 양보하는 지점이 하나도
    없으므로). 이 구간이 끝나면 `applyConfig`는 `return`으로 즉시 종료되어, 자신의 원래 `gen`을 다시
    참조하는 코드(`loadSession` 분기의 두 번째 `isStale(gen)` 검사, L766)는 **애초에 실행되지 않는다** —
    `pendingResetRef` 경로와 `loadSession` 경로는 상호 배타적(early return)이라 같은 `gen` 변수를 둘러싼
    충돌 자체가 구조적으로 불가능하다.
    (a) **"진행 중인 다른 비동기"와의 충돌**: pre-config 시점엔 `clientRef`/`sessionRef`가 아직 없어
    `start()`/`seedWaitingFromStatus`/`sendCommand`가 그 이전에 실행될 수 없으므로(전부 `configRef.current`
    또는 `clientRef.current`/`sessionRef.current`를 전제) 무효화할 다른 in-flight 비동기 자체가 존재하지
    않는다. 유일한 이론적 예외 — 쿼리-fallback(`configFromQuery`)과 host `wc:boot`가 동시에 두 번째
    `applyConfig`를 유발하는 이중 부팅 레이스는 이 fix 이전부터 있던 별개 경로이며, 코드 추적 결과 오히려
    이번 replay 의 gen 이중 증가가 그 두 번째 호출을 `isStale`로 걸러내는 방향으로 완화 작용한다(먼저
    embed-check 를 마친 쪽이 replay 를 태우면, 나중에 마치는 쪽은 그 사이 오른 gen 때문에 자동 폐기).
    (b) **`applyConfig` 자신의 `gen`과의 충돌**: 위에서 설명한 대로 없음(상호 배타적 경로).
  - 제안: 없음(재진입 안전성 확인). 유일한 잔여 부작용(`NEW_CHAT` 중복 dispatch)은 별도 INFO 항목 참조.

- **[INFO]** Q2 — 부팅 중 `resetSession`이 2회 이상 도착해도 재생은 정확히 1회: `pendingResetRef`가 큐/카운터가
  아니라 **boolean**이라 자연 coalesce 되며, 실측으로 확인
  - 위치: `use-widget.ts` L231-234(`pendingResetRef.current = true`, 매 호출 idempotent 대입) / L741-745
    (소비는 `applyConfig` 실행 중 단 1회뿐인 `if` 문) / 참고: `host-bridge.ts` L45-62(`onMessage`, 단일
    이벤트 리스너로 postMessage 를 순차 처리).
  - 상세: pre-config 구간에서 `newChat()`이 N번 호출돼도 매번 동일한 코드 경로(`teardownSession()`의
    `if (!configRef.current)` 분기)를 타 `pendingResetRef.current = true`를 반복 대입할 뿐 값이 누적되지
    않는다(boolean 은 카운터가 아니다). 소비 측은 `applyConfig`가 config 를 확립하는 **단 한 번의 지점**에서
    플래그를 읽고 즉시 `false`로 되돌리므로, N번의 pre-boot 명령은 항상 1번의 replay
    (`newChat()` 1회 → `start()` 1회 → webhook POST 1회)로 수렴해야 한다. 이는 정적 분석만으론 완전히
    확신하기 어려운 부분이라 격리 worktree 에서 직접 검증했다 — `sendHostCommand("resetSession")`을
    embed-config 미확정 상태에서 **3회 연속** 주입하는 진단 테스트를 추가해 실행한 결과
    `hookPosts === 1`(webhook POST 정확히 1회)로 **통과**했다. 이 진단 테스트가 실제로 유효한지(우연한
    vacuous pass 가 아닌지) 교차검증하기 위해 fix 자체를 비활성화하는 mutation
    (`if (false && pendingResetRef.current)`)을 걸었더니, 이 진단 테스트와 기존
    "저장 세션이 있는 채로 부팅 중 resetSession → 옛 대화가 부활하지 않는다" 테스트(`use-widget-eager-start.test.ts`
    L2016) **둘 다 `executionId` "OLD" 부활로 정확히 실패**함을 확인했고, mutation 원복 후 재실행 시 두
    테스트 모두 다시 통과로 복귀함을 확인했다(공유 워크트리는 이 mutation 실험 동안 전혀 건드리지 않았다 —
    실험은 격리 worktree 안에서만 수행 후 worktree 자체를 제거). 참고로 `host-bridge.ts`의 `onCommand`는
    `window`의 `message` 이벤트를 처리하는 리스너 하나이므로(JS 이벤트 루프상 한 번에 한 핸들러만 실행)
    "명령이 2회 이상 도착"은 진짜 동시(병렬) 도착이 아니라 항상 순차 도착이며, 이 순차성도 위 결론(각 호출이
    이전 호출의 부작용을 그대로 이어받아 idempotent 하게 수렴)과 부합한다.
  - 제안: 없음(coalesce 정상 동작 확인, 실측 완료). 다만 이 boolean coalesce 는 "N번의 resetSession = 1번의
    새 대화"라는 **의도된 정책**(이미 post-config 상태의 "single-flight coalesce" — `newChat()` L620-625
    주석 A — 와 동일한 설계 철학)이라는 점을 기록해 둔다 — 향후 "매 resetSession 마다 서버에 별도 신호를
    보내야 한다"는 요구가 생기면 이 정책을 명시적으로 재검토할 것.

- **[INFO]** Q3 — `isStale(gen)` 추출은 순수 리팩터: 캡처 시점·비교 대상 모두 원본과 동일
  - 위치: `use-widget.ts` L196(`const isStale = useCallback((gen: number) => worldGenRef.current !== gen, []);`)
    ↔ 8개 호출부(L384·416·473·491·499·517·726·766).
  - 상세: `gen`은 **파라미터**로 전달되지 클로저로 캡처되지 않으므로, `useCallback(..., [])`로 함수 참조를
    영구 고정해도 stale-closure 위험이 없다 — 매 호출 시점에 인자로 넘어온 `gen`과 그 시점의
    `worldGenRef.current`(ref 이므로 항상 최신값)를 비교하는 것은 원래의 인라인
    `worldGenRef.current !== gen`과 동치다. 8개 호출부 전부가 여전히 **호출부 자신의 로컬 `gen`**을 자기
    함수 진입 시점(첫 `await` 이전 — `seedWaitingFromStatus` L373, `start` L465, `sendCommand` L510,
    `applyConfig` L723)에 캡처한 뒤 `isStale(gen)`을 호출하는 원래 패턴을 그대로 유지하고 있음을 직접
    대조해 확인했다(치환은 `worldGenRef.current !== gen` → `isStale(gen)` 리터럴 대체뿐, 캡처 위치·비교
    로직의 이동은 없음). `useCallback` 의존성 배열에 `isStale`을 추가한 3곳(`seedWaitingFromStatus`·
    `start`·`sendCommand`)도 `isStale` 자체가 빈 의존성 배열로 영구히 안정된 참조라 이 훅들의 재생성
    빈도에 영향이 없다.
  - 제안: 없음(의미 불변 확인).

- **[INFO]** (참고, 이번 diff 의 핵심은 아님) `pendingResetRef` 소비로 인한 `NEW_CHAT` 중복 dispatch — 기존
  무조건-dispatch 패턴의 재사용이며 상태 오염 없음
  - 위치: `use-widget.ts` `newChat()` L630(`dispatch({ type: "NEW_CHAT" })`, pre-config 최초 호출과 replay
    호출 양쪽에서 도달) ↔ `widget-state.ts` L187-192(`case "NEW_CHAT": return { ...initialState, open: true,
    phase: "panel" };`).
  - 상세: pre-config 시점의 첫 `newChat()` 호출(플래그만 세팅하는 쪽)도 `resetSessionRefs()` →
    `dispatch(NEW_CHAT)`까지는 도달한다(이 dispatch 라인 자체는 이번 diff 가 아니라 기존 코드 경로 — 새로운
    것은 이 라인에 **두 번째로** 도달하는 replay 호출 쪽이다). 따라서 host `resetSession` 1회에 대해
    reducer 는 `NEW_CHAT`을 논리적으로 2번(pre-config 1회 + replay 1회) 받는다. `NEW_CHAT` 케이스가
    `...state`가 아니라 `...initialState`로 상태 전체를 무조건 대입하는 **순수·멱등 전이**이고 그 사이에
    다른 액션이 끼어들 여지도 없으므로(위 Q1 — 동기 구간), 두 번째 dispatch 는 첫 번째와 완전히 같은
    결과값을 다시 계산할 뿐이다. 데이터 손상·경쟁은 없고 React 리렌더 1회가 여분으로 발생하는 정도다.
  - 제안: 없음(정보성, 조치 불요). 굳이 다듬는다면 `applyConfig`의 replay 분기에서 `newChat()` 전체 대신
    `resetSessionRefs()`+`start()`만 직접 호출해 중복 dispatch 를 피할 수도 있으나, 그러면 `newChat()`의
    "정상 경로 전부를 태운다"는 현재 설계 의도(`RESOLUTION.md` `09_36_01` §W1 — "리뷰어 제안보다 한 걸음 더
    갔다")가 흐려지고 향후 `newChat()` 로직이 바뀔 때 이 replay 지점이 자동으로 동기화되는 이점을 잃는다 —
    현재의 소소한 redundant render 가 더 안전한 트레이드오프로 판단된다.

- **[INFO]** 전통적 동시성 축(뮤텍스/데드락/스레드풀/커넥션풀)은 이 코드베이스에 해당 없음 — 재확인
  - 상세: `codebase/channel-web-chat`은 React 훅 기반 단일 스레드 브라우저 SPA 코드이며, 이번 diff 도
    동일하다. 점검 관점 2(데드락)·3(mutex/semaphore)·8(스레드풀/커넥션풀)은 원천적으로 대상이 없다. 실질
    위험은 항상 "비동기 staleness"(async 재검증 누락) 축 하나이며, 이번 delta 는 그 축의 잔여 gap
    (부팅-중-resetSession 의 저장소 축 누락)을 봉합하는 fix 다.

## 요약

부모가 요청한 세 질의에 대한 결론은 다음과 같다. **(1) 재진입 안전성**: `pendingResetRef` replay 경로
(`newChat()` 재호출)는 `applyConfig`가 config 를 확립한 직후부터 `return`까지 **await 없는 단일 동기 구간**에서
전부 처리되어 재진입 안전하다 — 다른 in-flight 비동기와 충돌할 물리적 여지가 없고(pre-config 구간엔 애초에
그런 비동기가 존재할 수 없음), `applyConfig` 자신이 캡처한 `gen`도 replay 이후 다시 참조되지 않아(상호 배타적
early return) 충돌하지 않는다. **(2) 반복 명령**: `pendingResetRef`가 boolean 이라 부팅 중 반복 도착한 리셋
명령은 자연스럽게 coalesce 되어 재생은 항상 1회다 — 정적 분석에 그치지 않고 격리 worktree 에서 "3연타
resetSession → webhook 1회" 진단 테스트로 직접 실측했고, fix 를 되돌리는 mutation 으로 그 진단 테스트 자체의
유효성(vacuous pass 아님)도 함께 확인했다. **(3) `isStale(gen)` 추출**: `gen`을 파라미터로 받는 순수 함수라
클로저 문제가 없고, 8개 호출부 모두 캡처 시점·비교 대상이 원본 인라인 코드와 바이트 단위로 동치다. 세 질의
모두에서 결함을 찾지 못했으며, 유일한 잔여 관찰 사항(`NEW_CHAT` 중복 dispatch)은 상태 오염 없는 여분 렌더
수준이라 조치 불요다. 전통적 mutex/데드락/스레드풀 축은 이 코드베이스(React 훅 기반 단일 스레드 브라우저
코드)에 해당 없음을 재확인했다. 검증 과정에서 공유 워크트리는 읽기 전용으로만 접근했고(관련 테스트 91건 실측
PASS), mutation·진단 테스트는 `git worktree add --detach`로 만든 격리 worktree 안에서만 수행한 뒤 완전히
제거했다 — 직전 라운드가 지적한 "공유 워크트리 동시편집으로 인한 산발 실패" 위험을 이번 검증에서는 만들지
않았다.

## 위험도

LOW
