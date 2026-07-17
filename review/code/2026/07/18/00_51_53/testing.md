# 테스트(Testing) 리뷰 — webchat-boot-single-flight (00_51_53)

## 검증 방법

`prompt_file` 의 diff 는 `use-widget-eager-start.test.ts`/`use-widget.ts` 전체 diff 를 payload
크기 제한으로 생략했으므로, 저장소의 현재 파일과 `git log`/`git show` 로 실제 코드·커밋을 직접
읽었다. 지시대로 mutation 은 **격리 worktree** 에서 수행했다 — 원본 리뷰 worktree
(`webchat-boot-single-flight-8c92b4`, HEAD `5eed8cf96`)는 건드리지 않고, `git worktree add
--detach <scratchpad>/<name> HEAD` 로 별도 워크트리를 만든 뒤 `node_modules`(top-level +
`codebase/channel-web-chat/node_modules`)만 원본으로 심링크해 `vitest` 를 그대로 구동했다. 각
mutation 뒤에는 파일을 원복하고 스위트를 재실행해 391 passed 로 복귀함을 확인했으며, 종료 시
`git worktree remove --force` 로 정리했다(원본 worktree 는 실측 전후 `git status` 로 무변경
확인).

## 발견사항

- **[INFO]** 핵심 요청 검증 — 신규 회귀 테스트가 mutation 으로 정확히, 단독으로 실패함을 확인
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:651`
    (`const outcome = await seedWaitingFromStatus(client, session, { boot: bootAtStart });`),
    테스트: `use-widget-eager-start.test.ts:3223` `"start() 의 지연 seed 가 재전송이 전진시킨
    화면을 되감거나 두번째 스트림을 열지 않는다"`
  - 상세: 베이스라인(391 passed, 22 files, 원본 RESOLUTION.md 의 "391 passed(22파일)" 주장과
    일치) 확인 후, 651행에서 세번째 인자 `{ boot: bootAtStart }` 를 제거하는 mutation 을
    적용했다. 결과: **정확히 신규 테스트 1건만 실패**(`AssertionError: expected 'n1' to be
    'n2'` — 되감김 증상 그대로 재현), 나머지 390건은 영향 없음. `RESOLUTION.md` §CRITICAL —
    `start()` 무방비 의 "mutation: 그 인자 제거 → 정확히 이 테스트만 실패(n1)" 주장과 실측이
    정확히 일치한다. `widget-state.test.ts` 의 새 reducer 테스트(RESTORED/BOOTED `it.each`,
    `ended` 가드 재삽입 mutation)도 같은 기법으로 별도 검증해 **정확히 2건만**(RESTORED,
    BOOTED 각 1) 실패함을 확인했다 — 두 파일 모두 교차오염 없음.
  - 제안: 없음 — 검증 통과.

- **[INFO]** 정정된 테스트 주석("§3(재전송): 대체된 시도의 종료 확정이 마지막 부팅을 죽이지
  않는다")이 실제 코드 동작과 일치
  - 위치: `use-widget-eager-start.test.ts:2536-2547`(주석), 대응 코드
    `use-widget.ts:290-293`(`cannotApplyConfig` — boot 축만, world 미검사),
    `use-widget.ts:543-546`(`seedWaitingFromStatus` 종료 확정 분기 — `attempt` 파라미터 자체를
    참조하지 않음, WAITING 분기만 `attempt` 를 봄)
  - 상세: `git show a2cd6ebb7 -- use-widget-eager-start.test.ts` 로 이번 라운드의 정정 diff 를
    직접 대조했다. 정정 후 주석이 서술하는 "checkpoint 1(`cannotApplyConfig`)이 boot 축
    전용이라 1차의 world 증가가 2차 config 적용을 막지 않는다" + "종료 확정 자체는 대체된
    1차가 world 축으로 그대로 한다"는 두 주장 모두 코드와 정확히 일치한다(JSDoc 의 "이 함수
    안에는 staleness 정책이 두 개 공존" 표와도 부합). 되돌리기 전 구주석("대체된 시도의 seed
    는 종료를 확정하지 않는다")은 현재 코드와 정반대였는데, 이번 diff 가 정확히 그 지점을
    고쳤다.
  - 제안: 없음.

- **[INFO]** 새로고침 복원 테스트에 추가된 EventSource 단언 — 원리는 유의미하나, 이 테스트
  구조상 굵은 단위 회귀에 대해서는 "첫 실패 지점"이 되지 못함(실측 확인)
  - 위치: `use-widget-eager-start.test.ts:3021-3039`(`esBeforeReload`/`esAfterReload` 단언),
    대응 코드 `use-widget.ts:993`(`openStream(saved, "0")`, `applyConfig` 복원 분기)
  - 상세: 이 테스트는 세션을 사전에 `sessionStorage` 에 심어 두므로 **1차 마운트도 2차(새로고침)
    마운트와 동일한 `applyConfig` 복원 분기(993행)를 그대로 탄다.** 격리 worktree 에서
    `openStream(saved, "0")` 호출 자체를 주석 처리하는 mutation 을 적용해 실행한 결과, 신규
    추가된 2차 마운트의 `esAfterReload` 단언이 아니라 **그보다 앞선 기존 1차 마운트 단언**
    (3017행 `waitFor(... "awaiting_user_message")` — SSE emit 을 받을 스트림이 없어 타임아웃)
    에서 먼저 실패했다. 즉 "복원이 openStream 자체를 안 부른다" 부류의 전역적 회귀는 새 단언이
    없어도 이미 잡히고 있었다 — 새 단언의 "독점적" 방어 범위는 "2차 마운트에서만 재연결이
    스킵/재사용되는"(예: 캐싱·재사용 버그) 더 좁은 회귀로 한정된다. 단언 자체가 틀렸거나
    무의미하다는 뜻은 아니며, 커밋 메시지의 "SSE 재연결 여부를 처음으로 검증" 이라는 프레이밍이
    "이 mutation 기준 첫 실패 지점" 이라는 의미는 아니라는 정도의 정밀도 차이다.
  - 제안: (선택) 굳이 강화하려면 1차 마운트 없이 2차(새로고침) 마운트만 검증하는 최소 테스트로
    분리하면 실패 시 진단이 더 정확해진다. 필수는 아님.

- **[INFO]** 신규 `start()` 테스트의 `esCount` 단언도 같은 종류의 순서 이슈 — 현재 순서로는
  식별된 CRITICAL mutation 아래서 도달되지 않지만, 단독으로는 실제로 유효함을 확인
  - 위치: `use-widget-eager-start.test.ts:3300-3302`
    (`expect(nodeId).toBe("n2"); expect(esCount).toBe(1);`)
  - 상세: `expect().toBe()` 는 실패 시 즉시 예외를 던지므로, 651행 mutation 아래서는 `nodeId`
    단언이 먼저 실패해 다음 줄의 `esCount` 단언은 실행되지 않는다(vitest 리포트에 실패 1건만
    표시된 것과 일치). 두 단언 순서를 바꿔(esCount 를 먼저) 별도로 재실행한 결과 `esCount` 도
    독립적으로 `2`(기대 `1`)로 깨짐을 확인했다 — 주석이 말하는 "개수 단언이 화면 노드 단언과
    함께 이 fix 를 이중으로 고정한다"는 의도는 실제로 유효하다(두 증상 모두 진짜로 발생).
    다만 현재 작성 순서 때문에 **한 번의 실패 리포트에서는 두 증상 중 하나만 보인다** — 진단
    편의 관점의 사소한 개선 여지.
  - 제안: (선택) 두 값을 객체로 묶어 한 번에 단언(`expect({nodeId, esCount}).toEqual({...})`)
    하면 실패 시 두 증상을 동시에 보여줄 수 있다. 필수는 아님 — 현재도 결함을 정확히 잡는다.

- **[CRITICAL]** `start()` 의 이번 라운드 boot 스냅샷 보호가 "재전송 이후" 창만 막고, 그보다
  **이른** 창(webhook POST in-flight, 세션 미persist)은 새로 무방비 — 위젯이 SSE 연결 0개로
  **영구 고착**되는 미테스트 경로를 독립 재현으로 확인
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts` — `start()`
    (622-628행 `bootAtStart` 캡처, 651행 호출) + `applyConfig`
    (945-996행, 특히 951행 `beginBootAttempt()` 호출과 971행 `loadSession` 판정의 시간차)
  - 상세: **시나리오** — (1) `wc:boot` #1 → config 확립(저장 세션 없음) → 패널 `open()` →
    `start()` 진입, `bootAtStart = bootGenRef.current`(=1) 캡처 후 webhook POST 발사(in-flight,
    세션 아직 storage 에 없음). (2) **webhook 이 미해결인 이 창**에서 `wc:boot` #2(재전송)
    도착 → `applyConfig` 가 `beginBootAttempt()` 로 `bootGenRef` 를 1→2 로 올리지만, 951행
    이후 971행 `loadSession(...)` 이 **아직 아무 세션도 못 찾아**(`start()` 가 아직
    persist 하지 않음) 972행 `if (saved)` 블록(복원+seed+`openStream`)을 통째로 스킵하고
    조용히 반환한다 — `bootGenRef` 증가만 "헛되이" 남는다. (3) webhook 이 뒤늦게 해결 →
    `start()` 가 세션을 persist 하고 `seedWaitingFromStatus(client, session, {boot:
    bootAtStart=1})` 호출(651행) → getStatus 가 `waiting_for_input(n1)` 로 응답해도,
    `cannotApplyConfig({boot:1})` 가 `bootGenRef.current(2) !== 1` 로 **`"stale"` 을 반환** →
    WAITING dispatch 도, `openStream` 도 일어나지 않는다. **이번엔 그 무엇도 스트림을 열지
    않는다** — 2단계의 `applyConfig` 도 이미 복원 분기를 스킵하고 끝났기 때문이다.
    결과: `phase: "streaming"`("AI 응답 중" 스피너) 로 **영구 고착**, SSE 연결 0개, WAITING
    표면 없음, `console.warn` 조차 없는 완전 침묵(soft-fail 경로가 아니라 `"stale"` 조기
    반환이라 로그가 없다), 후속 `open()` 도 `startedRef.current === true` 라 no-op — 페이지
    새로고침 외 복구 수단이 없다.
  - **독립 재현**: 원본 코드(HEAD `5eed8cf96`, **무변경**)를 심링크한 격리 detached
    worktree 에서 위 시퀀스를 그대로 구현한 자체 재현 테스트를 작성·실행해 확인했다 —
    `phase="streaming", pending=null, esCount=0`. **음성 대조군**(재전송 없이 동일 시퀀스)은
    정상적으로 `phase="awaiting_user_message", pending.nodeId="n1", esCount=1` 로 착지해
    재현 하네스 자체의 건전성도 확인했다. 나아가 이번 라운드 fix 의 651행 인자(`{boot:
    bootAtStart}`)만 제거해(즉 직전 라운드 `18_39_11` 상태로) 같은 시나리오를 재실행하면
    **정상 착지**(`esCount=1`, 정상 WAITING) 한다 — 즉 이번 라운드가 "재전송 이후" 되감기를
    막은 대신, 인접한 "재전송 이전" 구간에 **새로운 영구 고착**을 트레이드오프로 들여왔다.
  - **커버리지**: 이번 라운드에 추가된 유일한 회귀 테스트(`"start() 의 지연 seed 가..."`)는
    재전송이 `start()` 의 persist 이후(= 자신의 getStatus 콜이 이미 in-flight) 도착하는 창만
    시나리오화한다. persist **이전**(webhook 미해결 중) 창은 391건 어디에도 커버되지 않는다.
  - **참고(투명성)**: 이 조사 도중, 같은 원본 worktree 에서 **동시에 진행 중이던 별개
    프로세스**가 정확히 같은 가설("webhook in-flight 중 재전송이 아무것도 복원 못 하면
    start() 도 boot 축으로 스킵돼 스트림 미오픈 상태로 고착되는가")을 탐색하는 미커밋
    `[PROBE]` 테스트·`use-widget.ts` 수정 흔적을 관찰했다(`git status` 에 나만 건드리지 않은
    `use-widget-eager-start.test.ts`/`use-widget.ts` 수정이 나타남, scratchpad 에도 다른
    세션의 `probe-test-snippet-v2/v3.ts` 등 잔존). **이 파일들은 건드리지 않았고**, 위 결론은
    전적으로 내가 별도 격리 worktree(HEAD 고정, 원본 작업트리와 무관)에서 처음부터 다시 작성한
    재현·대조군·트레이드오프 검증 3종으로 독립 확정한 것이다. 다만 다른 프로세스가 이미 같은
    결함을 포착·수정 중일 가능성이 높으므로, 최종 처리 시 중복 여부를 먼저 확인할 것.
  - 제안: `applyConfig` 복원 분기가 `saved` 를 못 찾고 되돌아 나갈 때 자신이 이미 발생시킨
    `beginBootAttempt()` 부작용(`bootGenRef` 증가)을 어떻게 다룰지 재설계가 필요하다. 예:
    (a) `loadSession` 으로 실제 세션 존재를 먼저 확인한 뒤에만 `beginBootAttempt()` 를
    호출하도록 순서를 바꾸거나(단 checkpoint 1 의 "즉시 대체" 의미·`applyConfig` 의 다른 조기
    분기와의 상호작용을 함께 재검토해야 함), (b) `start()` 쪽에서 "내 seed 가 stale 판정을
    받았는데 아무도 스트림을 안 열었다" 를 감지해 최소한 진단 로그·폴백 재시도를 추가하거나,
    (c) 최소한 이 창을 실패로 고정하는 회귀 테스트부터 추가해 회귀를 막을 것. 설계 결정은 이
    PR 범위를 넘을 수 있으나(개발자/사용자 판단 필요), **테스트 관점에서는 이 경로가 전혀
    커버되지 않는다는 사실 자체가 이번 라운드 산출물의 유의미한 갭**이며, 병합 전 최소한
    회귀 테스트(실패로 우선 고정) 또는 fix 중 하나는 필요하다고 판단한다.

## 일반 체크리스트 메모 (부가)

- **테스트 격리**: `beforeEach`(EventSource 스텁·`sessionStorage.clear()`)와
  `afterEach`(`vi.unstubAllGlobals()`/`vi.useRealTimers()`/`vi.restoreAllMocks()`)가 전역
  상태를 assert 실패 여부와 무관하게 되돌린다 — mutation 실험에서 baseline↔mutated↔revert
  전환마다 391/390 건 수가 정확히 예측대로 나온 것이 이 격리의 실효성을 방증한다.
- **Mock 적절성**: `CountingES`/`ControllableEventSource` 패턴은 기존 `installControllableEventSource`
  관용구를 재사용(`no-this-alias` 회피까지 일치)해 이 파일의 다른 테스트와 일관적이다. 수동
  resolver 배열(`webhookResolvers`/`statusResolvers`)로 race 타이밍을 완전히 결정적으로
  제어해 실제 네트워크 타이밍에 의존하지 않는다 — flaky 위험이 낮다.
- **가독성**: 신규 테스트의 Korean 인라인 주석이 "호출 C/D" 처럼 각 getStatus 호출을 명명해
  경합 순서를 명확히 서술한다 — 이 파일의 기존 컨벤션(예: "부팅#1"/"부팅#2")과 일관되고,
  코드 트레이스와 1:1 대조가 쉬웠다.
- **테스트 용이성**: `useWidget()` 훅 하나가 boot/world 이중 세대·세션 복원·SSE·토큰갱신을
  모두 캡슐화해(현재 1080행) 테스트가 매번 `renderHook`+수동 resolver+`waitFor` 조합의 무거운
  통합 시나리오를 새로 구성해야 한다(이번 CRITICAL 재현도 예외 없이 ~90행 소요). 이미 별도
  plan(`webchat-usewidget-extraction.md`)이 `useEiaSession` 분리를 제안 중이며, 이번 라운드에
  또 하나의 거울상(persist 이전 창)이 나온 것은 그 plan 의 "세션 라이프사이클 응집도 부족이
  반복 결함의 온상" 진단과 정합적이다.
- **회귀 테스트 유효성**: 리듀서(`widget-state.test.ts`)·훅 통합(`use-widget-eager-start.test.ts`)
  기존 스위트는 이번 diff 이후에도 391건 전부 유효(격리 재실행으로 확인). 신규 테스트가 기존
  테스트를 무효화하거나 우연히 가려버리는 현상은 없었다.

## 요약

요청받은 핵심 검증 — 신규 회귀 테스트(`"start() 의 지연 seed 가..."`)가 `start()` 의 boot
스냅샷 인자를 제거하는 mutation 에 대해 **정확히, 단독으로** 반응함 — 은 격리 worktree
실측으로 확정 통과했고(교차오염 없음, `esCount` 단언까지 별도 확인상 유효), 이번 라운드가
정정한 테스트 주석 및 새로고침 복원 테스트의 EventSource 단언도 코드와 부합하거나 원리적으로
유의미함을 확인했다(다만 후자 둘은 "가장 먼저 실패하는 지점"이 아닐 수 있다는 정밀도 차이가
있어 INFO 로 기록). 그런데 이 검증 과정에서, 같은 mutation-재현 기법을 인접한 미검증 시나리오
(재전송이 `start()` 의 webhook POST 미해결 중, 즉 persist 이전에 도착하는 경우)에 적용해 보니
**독립적으로 재현 가능한 신규 CRITICAL 결함**을 발견했다 — 위젯이 SSE 연결 없이 영구 고착되고
어떤 테스트도 이 경로를 실행하지 않는다. 대조군과 트레이드오프 반증까지 확보해 이것이 이번
라운드 자체의 fix(651행 boot 스냅샷)가 만든 부작용임을 확정했다. 요청된 검증 자체는 완전히
통과했으나, 그 검증 기법을 한 걸음 더 밀어붙인 결과 이번 PR 의 테스트 커버리지에 실질적인 갭이
남아 있음이 드러났으므로, 전체 위험도는 그 발견을 반영해 판단해야 한다.

## 위험도

CRITICAL
