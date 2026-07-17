# 요구사항(Requirement) 리뷰 — webchat-boot-single-flight

## 0. 리뷰 범위에 대한 선행 확인 (중요 — 아래 발견사항을 읽기 전에 필수)

`prompt_file` 이 나열한 37개 파일 중 **31개는 이 브랜치의 실제 변경이 아니다.** `git diff origin/main
HEAD`(2-dot, 현재 origin/main 기준 전체 트리 차이) 로 payload 가 생성된 것으로 보이는데, 이 브랜치의
base(`14bc86a53`) 직후 `origin/main` 에 `#966`(report-paths-shared, `.claude/_shared/report_paths.py`
등)이 머지돼 브랜치가 그보다 1커밋 뒤처져 있다(`git status`: `ahead 4, behind 1`). 그 결과 `.claude/_shared/**`·
`review_guard.py`·두 orchestrator·`sidebar-test-utils.tsx`·`review/code/.../15_48_02/**`(별개 리뷰 세션
산출물) 등이 "삭제됨" 으로 나타나지만, 실측(`git diff 14bc86a53..HEAD --stat`, 3-dot 방식과 동치)하면 이
브랜치의 4개 자체 커밋은 `.claude/**` 를 **전혀 건드리지 않는다.**

```
$ git diff 14bc86a53..HEAD --stat
 .../channel-web-chat/src/lib/widget-state.test.ts  |  12 +
 codebase/channel-web-chat/src/lib/widget-state.ts  |  15 ++
 .../src/widget/use-widget-eager-start.test.ts      | 265 ++++++++++++++++++++-
 codebase/channel-web-chat/src/widget/use-widget.ts | 127 ++++++++--
 plan/in-progress/webchat-boot-single-flight.md     | 203 ++++++++++++++++
 spec/7-channel-web-chat/2-sdk.md                   |   4 +
 6 files changed, 596 insertions(+), 30 deletions(-)
```

이하 모든 분석은 이 **6개 파일**(실제 diff)을 대상으로 한다. 나머지 31개는 diff 오염이며, 정상적인 GitHub
PR(3-dot) 또는 `git merge`/`rebase` 는 자체적으로 이 오염을 재현하지 않지만(둘 다 merge-base 기준 3-way
방식이라 origin/main 전용 변경을 되돌리지 않음), 이 저장소는 "rebase 안 한 채 PR → 머지 PR silent
revert" 사례가 실제 기록돼 있다(`ensure-worktree stale base` 사례). PR 생성/머지 전에 `git fetch && git
rebase origin/main` 을 권장한다 — 이건 코드 결함이 아니라 스코프 판정 정확성을 위한 절차 노트다.

---

## 발견사항

- **[CRITICAL]** §106("위젯은 **마지막** wc:boot 의 config 를 적용") 위반이 재현 가능하다 — 복원 분기의
  belated 종료 감지가 world 축을 오염시켜, 아직 살아있는 **진짜 마지막** 부팅 시도까지 함께 무효화한다
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts` — `isAttemptStale`(266-270) · `beginBootAttempt`(261-264) ·
    `applyConfig` 복원 분기(839-883, 특히 첫 재검증 849·`establishConfig`+`loadSession`+`dispatch(RESTORED)` 857-863·
    두번째 재검증 879) · `seedWaitingFromStatus`(445-499, terminal 분기 464-467) · `teardownSession`(282-316, `worldGenRef.current++` 312)
  - 상세: 시나리오 — (1) 부팅 A 가 `isEmbedAllowed` 통과 후 `establishConfig`→저장 세션 발견→복원 분기 진입,
    `sessionRef.current = saved`·`dispatch(RESTORED)` 는 **자신의 두 번째 재검증(879) 이전에 무조건 실행**된다.
    (2) A 의 `seedWaitingFromStatus`(getStatus) 가 in-flight 인 동안 부팅 B(재전송, §106 상 이겨야 할 "마지막
    wc:boot")가 도착 — `beginBootAttempt()` 가 `bootGenRef` 를 올려 A 를 boot 축에서 정상적으로 superseded 시킨다
    (A 자신은 다음 await 뒤에나 이를 안다). (3) A 의 getStatus 가 뒤늦게 `status:"completed"`(terminal) 로 resolve
    → `seedWaitingFromStatus` 내부 `isStale(gen)`(458, world 축만 봄) 은 아직 통과 → `finalizeEnded`(465) →
    `teardownSession`(312) → **`worldGenRef.current++`**. 이 자체는 정당한 이벤트다(해당 세션이 실제로 서버에서
    끝났으므로). (4) 그런데 `isAttemptStale` 은 `worldGenRef.current !== attempt.world || bootGenRef.current
    !== attempt.boot` 로 **두 축을 OR** 로 묶는다. B 가 `beginBootAttempt()` 로 캡처해 둔 `attempt.world` 는 (3)의
    bump **이전** 값이라, B 가 나중에 `isAttemptStale(attemptB)` 를 검사하면 **boot 축은 여전히 자신이 최신인데도
    world 축 하나 때문에** stale 판정을 받고 bail 한다. (5) 결과: B(진짜 마지막 wc:boot)는 `establishConfig` 를
    한 번도 실행하지 못하고 조용히 사라지고, 최종 `config` 는 A(먼저 보낸, §106 상 이겨선 안 될 부팅)의 값에
    영구 고착된다. `beginBootAttempt` 의 JSDoc(207-209행, "부팅 시도는 세계를 바꾸지 않는다")은 이 상호작용
    경로에서는 사실이 아니다 — 부팅 A의 **복원 분기**가 나중에 자기 세션의 종료를 발견하면 세계를 바꾼다.
    이 상호작용은 plan 의 A-5 mutation 매트릭스로는 잡히지 않는다(매트릭스는 가드를 *제거*했을 때 무엇이
    잡히는지를 보는 것이고, 이 버그는 가드가 *의도대로 작동하는 중*에 두 정당한 이벤트가 상호작용해서
    생긴다) — 이 review 세션과 동시에 실행된 sibling `concurrency` 리뷰어가 격리 워크트리에서 실제 vitest 로
    재현했다(`bootWithPlan("A")`→복원 진입→getStatus in-flight 고정→`bootWithPlan("B")`→A 의 getStatus 를
    `completed` 로 resolve→B 의 embed-config 를 allow 로 resolve→최종 `config.profile.plan === "A"`, 기대값
    `"B"`). 본 리뷰어는 코드 정독으로 동일 메커니즘을 독립적으로 추적해 그 재현이 논리적으로 타당함을 확인했다.
    **결론: plan 문서의 "§106 위반 해소 확인" 은 완전하지 않다** — 단순 resolve-순서 역전 시나리오(§106 첫 회귀
    테스트가 덮는 범위)에서는 해소됐지만, 복원 분기가 개입하는 상호작용 시나리오에서는 여전히 위반된다.
  - 제안: `isAttemptStale` 을 단순 OR 이 아니라 "이 attempt 가 캡처된 **이후** 발생한 world 무효화만 stale 로
    친다" 는 시점 비교로 재설계하거나(예: world 무효화 이벤트에 boot 세대를 함께 태그해 "그 이벤트가 내
    attempt.boot 이후에 발생한 boot 로 인한 것인지" 구분), 최소한 복원 분기의 `seedWaitingFromStatus` terminal
    감지가 **자기보다 최신인 boot 세대를 죽이지 않도록** 별도 처리 필요. spec §106 자체는 문제없다 — 구현이
    그 계약을 온전히 못 지키는 사례이므로 developer 트랙(코드 fix) 대상이며 spec 수정 불필요.

- **[CRITICAL]** A-6 은 **화면(phase)만** 막고 `applyConfig` 복원 분기의 **실제 네트워크·세션 부작용은 막지
  못한다** — spec `1-widget-app.md §3.1`(109-116행)이 명시한 불변식 위반
  - 위치: `codebase/channel-web-chat/src/lib/widget-state.ts` L136(`RESTORED` 가드)·L142(`BOOTED` 가드) —
    이번 PR 로 신설. vs `codebase/channel-web-chat/src/widget/use-widget.ts` L579-615(`sendCommand` 의
    `ERROR` 분기, `catch` 블록 `else` 지점, 599-611 — **`teardownSession()`/`finalizeEnded()` 를 호출하지
    않음**) · L839-883(`applyConfig` 복원 분기, 리듀서 가드 여부와 무관하게 계속 실행).
  - 상세: spec `spec/7-channel-web-chat/1-widget-app.md` L109-116 은 명문으로 이렇게 정한다 — "단, 스냅샷이
    이미 terminal 이면 종료로 확정한다: ... 이 경우 위젯은 표면 시드 대신 **세션 정리 + `[ended]` 전이 + host
    `conversationEnded` 통지**를 수행한다. ... **같은 판정은 세션 복원 시점(§3.1 재open 복원)에도 적용되며,
    종료로 확정되면 SSE 재오픈·토큰 갱신 예약을 하지 않는다(무효 토큰 스트림·종료 세션 storage 부활 방지).**"
    그런데 `ERROR` 액션(명령 500 등 비-410 실패, `sendCommand` catch 의 `else` 분기)은 리듀서를 `phase:
    "ended"` 로 보내면서도 **`teardownSession`/`clearSession` 을 거치지 않는 유일한 종료 경로**다(다른 4개
    종료 진입점은 전부 `finalizeEnded()` 경유). 그래서 `sessionStorage` 에 세션이 남고, host 가 `wc:boot` 을
    재전송하면 `applyConfig` 복원 분기가 `loadSession()` 으로 그 세션을 그대로 읽어 `dispatch(RESTORED)` 를
    호출한다. 이번 PR 의 리듀서 가드(`if (state.phase === "ended") return state;`)는 이 dispatch 를 no-op 으로
    만들어 **화면은 정확히 지킨다** — 그러나 `applyConfig` 자신은 리듀서의 결정을 알지 못한 채(React state 가
    아니라 ref/storage 만 보고) 계속 진행해 `seedWaitingFromStatus`(실제 `GET /api/external/executions/:id`
    발사) → (soft-fail 이든 `"continue"` 든) `openStream(saved, "0")`(옛 토큰으로 **새 SSE 연결을 실제로 연다**)
    → `scheduleRefresh()`(토큰 자동 갱신 예약, `saveSession()` 으로 storage 만료시각을 계속 연장)까지 전부
    수행한다. 즉 화면은 "종료됨" 을 보여주지만, 그 세션은 백그라운드에서 계속 backend 에 재조회되고 토큰이
    자동 갱신되며 살아있게 유지된다 — spec 이 금지한 정확히 그 부작용이다. 부수적으로
    `widget-state.ts` 의 `AI_MESSAGE`(170-176행) 리듀서 케이스는 `WAITING`/`RESTORED`/`BOOTED` 와 달리 `ended`
    가드가 없어, 재오픈된 스트림이 `waiting_for_input` 보다 `ai_message` 를 먼저 받으면 "대화 종료" 화면에
    유령 assistant 메시지가 실제로 append 될 이론적 경로도 남는다.
  - 제안: `start()`/`sendCommand()` 의 `ERROR` 디스패치 두 지점을 다른 4개 종료 진입점과 동일하게
    `teardownSession()`+`clearSession()`(또는 에러 메시지 보존이 필요하면 `finalizeEnded` 변형 헬퍼)을 거치게
    해 storage 를 원천에서 비우는 근본 수정을 권장한다 — 그러면 다음 `wc:boot` 의 `loadSession()` 이 애초에
    `null` 을 반환해 복원 분기 전체가 스킵되고, 리�블 가드는 순수 defense-in-depth 로 남는다. 부가로
    `AI_MESSAGE`/`execution.message` 케이스에도 `ended` 가드 추가를 검토.
  - **참고(중요)**: 본 리뷰 진행 중 이 워크트리에서 정확히 이 방향(`sendCommand` 의 `ERROR` 분기에
    `teardownSession()` 호출 추가)의 **미커밋 수정**이 관측됐다 — 본 리뷰어가 만든 변경이 아니며, 이미
    누군가(원 세션) 이 근본 원인을 인지하고 고치는 중일 가능성이 높다. 다만 **본 리뷰가 대상으로 받은
    diff(commit `215cd1c3f`, `prompt_file` payload)에는 포함돼 있지 않다** — 최종 커밋에 이 수정이 실제로
    반영됐는지, 그리고 `AI_MESSAGE` 가드까지 포함하는지 반드시 재확인 필요.

- **[WARNING]** `widget-state.ts` 의 `WAITING` 케이스 주석이 stale — "가드 범위는 WAITING 뿐" 이라고
  서술하지만 바로 위 `RESTORED`/`BOOTED` 케이스는 **이번 PR 로 동일한 `ended` 가드를 얻었다**
  - 위치: `codebase/channel-web-chat/src/lib/widget-state.ts` L155-159(`WAITING` 케이스 주석) vs L126-136(`RESTORED`
    가드, 신규) · L138-142(`BOOTED` 가드, 신규).
  - 상세: L155-159 는 "**가드 범위는 WAITING 뿐이다** — `RESTORED`/`BOOTED`/`USER_MESSAGE` 도 `state.phase` 를
    검사하지 않고 무조건 전이하므로, 'ended 를 벗어나는 액션'의 리듀서 레벨 불변식은 아직 없다" 고 명시한다.
    그런데 바로 위 `RESTORED`(136)·`BOOTED`(142) 는 이번 PR 로 정확히 그 불변식(`if (state.phase === "ended")
    return state;`)을 얻었다 — 주석이 갱신되지 않아 파일 내부적으로 자기모순이다. 이 파일은 스스로
    "가드는 규율이 아니라 구조" 를 반복 강조하는데, 정작 "무엇이 이미 가드됐는지" 를 알려주는 주석이
    낡으면 다음 변경자가 "RESTORED 는 원래 무가드" 라고 오인해 규모 축소/재도입 실수를 할 위험이 있다 —
    이 파일이 반복적으로 겪은 실패 유형(비대칭 가드 누락)과 정확히 같은 클래스.
  - 제안: L155-159 를 "가드 범위는 WAITING·RESTORED·BOOTED 셋(USER_MESSAGE 는 미가드)" 으로 갱신.

- **[WARNING]** 후발(=마지막) `wc:boot` 의 `embed-config` 조회가 타임아웃 없이 hang 하면, 이번 PR 도입
  이후엔 **이미 유효하게 resolve 한 이전 config 조차 영구히 적용되지 못할 수 있다** — strict last-wins 이
  가져온 새 liveness 트레이드오프
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts` L31-47(`fetchEmbedConfig`, `fetch()` 에
    timeout/AbortController 없음) · L261-270(`beginBootAttempt`/`isAttemptStale`).
  - 상세: PR 이전엔 여러 겹친 `applyConfig` 가 world 축(신규 wc:boot 도착만으로는 안 바뀜)만 봤으므로, 먼저
    보낸 boot 의 embed-config 가 resolve 되면 그것으로 config 가 적용됐다 — "의도한 마지막" 은 아니었지만
    **부팅 자체는 멈추지 않았다**. PR 이후엔 `bootGenRef` 가 매 wc:boot 마다 증가하므로, **가장 최근에 보낸
    시도만** config 를 적용할 자격이 있다 — 그 시도의 `isEmbedAllowed` 호출이 네트워크 지연·hang 으로 오래
    걸리면(브라우저 fetch 는 명시 timeout 없이는 매우 오래/무기한 대기할 수 있음) 이미 정상 resolve 한 **모든
    이전 시도가 조용히 폐기된 채** 위젯이 boot 을 완료하지 못하는 상태로 머문다. §106 정합성(정확성)을 얻는
    대가로 가용성(liveness) 리스크가 새로 생긴 것 — 관리자 라이브 미리보기가 색상 슬라이더 등으로 짧은
    간격에 반복 재전송하는 실사용 패턴(2-sdk.md L114 "외형 폼 변경 시 이 경로로 재전송")과 결합하면 발생
    가능성이 이론적 수준을 넘는다.
  - 제안: `fetchEmbedConfig` 에 합리적 timeout(AbortController) 추가를 검토. 최소한 알려진 트레이드오프로
    plan/JSDoc 에 기록 권장(현재 어디에도 언급 없음).

- **[WARNING]** spec `1-widget-app.md §3.1` 표에 "명령이 비-410 오류(예: 500)로 실패 → `ERROR` → `[ended]`"
  전이가 다른 종료 경로들과 달리 **별도 행으로 명시돼 있지 않다**
  - 위치: `spec/7-channel-web-chat/1-widget-app.md` L84-92(§3.1 표 — "닫기"·"대화 종료"·"새 대화"·"토큰
    만료/서버 타임아웃"·"페이지 새로고침/이동" 5행만 존재).
  - 상세: 코드의 `ERROR` 액션(`use-widget.ts` L575 `start()` catch, L610 `sendCommand()` catch 의 `else`)은
    `[ended]` 로 가는 **여섯 번째 경로**이고 위 CRITICAL 두 번째 항목에서 보듯 다른 경로들과 세션 정리 방식이
    다르다(teardownSession 미경유). 그런데 §3.1 표는 이 경로를 별도 행으로 다루지 않는다 — "대화 종료" 행은
    사용자 트리거·`completed` 만 다루고, 이 경로(클라이언트가 관찰한 명령 실패)의 EIA 처리·위젯 상태 조합을
    명시하지 않는다. `code:` 증거 규칙상(`spec/conventions/spec-impl-evidence.md`) 이것이 즉시 빌드 가드
    위반은 아니지만(글롭 매치만 검증), §3.1 표가 "SoT" 를 자처하는 만큼(L82 "§3.1 표가 SoT 다") 실제 구현이
    갖는 여섯 번째 종료 경로가 표에 없는 것은 spec 완전성 갭이다. 위 CRITICAL(A-6) fix 가 정해지면(즉
    ERROR 도 teardownSession 을 거치도록 바뀌면) 그 최종 동작을 반영해 표에 행을 추가하는 것이 적절하다 —
    지금 상태로 행을 추가하면 "세션 정리 안 함" 이라는, 스스로 위반하는 규칙을 명문화하게 되므로 코드
    fix 와 순서를 맞춰야 한다(spec 수정은 `project-planner` 트랙).
  - 제안: A-6 근본 fix(위 CRITICAL) 반영 후, §3.1 표에 "명령 실패(비-410)" 행 추가.

- **[INFO]** spec `code:` frontmatter 보강(`2-sdk.md` 에 `host-bridge.ts`·`use-widget.ts` 추가) 판단은
  `spec-impl-evidence.md` 와 정합하고 타당하다
  - 위치: `spec/7-channel-web-chat/2-sdk.md` L4-9(frontmatter) vs `spec/7-channel-web-chat/1-widget-app.md`
    L4-5(`code: codebase/channel-web-chat/**`) vs `spec/conventions/spec-impl-evidence.md` §R-1·R-6.
  - 상세: `spec-impl-evidence.md` 에는 "한 코드 파일이 여러 spec 의 `code:` 에 동시에 등재될 수 없다" 는
    배타 규칙이 없다 — R-1(글롭 채택 근거)·R-6("각 spec 이 *약속한 surface* 의 구현 책임")은 오히려 한
    구현 파일이 여러 spec 문서의 서로 다른 약속을 동시에 충족할 수 있음을 전제한다. `1-widget-app.md` 의
    `codebase/channel-web-chat/**` 글롭은 이미 두 파일을 포함하므로(구현 존재 가드는 이미 통과), 이번 추가는
    "빠진 증거를 채움" 이 아니라 "§106 이라는 named contract 의 SoT 문서(2-sdk.md)에 더 정밀한 증거 링크를
    추가함" 이다 — 타당한 강화다. 다만 근거 주석("1-widget-app.md 는 재전송을 서술하지 않는다")은 리터럴
    하게는 맞지만(§3.1 은 "wc:boot 재전송" 이라는 용어를 쓰지 않음) 뉘앙스가 살짝 과하다 — `1-widget-app.md`
    §3.1(L109-116, 위 CRITICAL 항목이 인용한 그 문단)은 "세션 복원 시점" 이라는 이름으로 **같은 코드
    경로**(`applyConfig` 복원 분기)가 지켜야 할 불변식을 이미 서술하고 있어, "전혀 무관" 은 아니다. 조치
    불요(INFO) — 문서 정확성의 사소한 뉘앙스 차이일 뿐 정정을 강제할 사안은 아니다.

- **[INFO]** plan/RESOLUTION 의 정량 주장을 독립 재현·검증 완료 — 전부 정확하다 (이 저장소의 과거 수치
  과대 이력에 대한 명시적 검증 요청 응답)
  - 위치: `plan/in-progress/webchat-boot-single-flight.md` L149-158("A-5 mutation 매트릭스") · L160-161("world
    가드 A/B") · L163("channel-web-chat 379 passed").
  - 상세: `git worktree add --detach`(리뷰 대상 워크트리 비수정, 종료 후 `git worktree remove` 로 제거) 로
    격리한 사본에서 `use-widget-eager-start.test.ts`(48 tests) 를 대상으로 6가지 mutation 을 직접 적용해
    재현했다:
    | mutation | plan 주장 | 실측 |
    |---|---|---|
    | 베이스라인(무변경) | 0 | **0/48** 확인 |
    | boot 축 무력화(`isAttemptStale` 에서 boot 비교 제거) | 4 | **4 failed** 확인 |
    | 첫 지점만 제거(L849) | 3 | **3 failed** 확인 |
    | 둘째 지점만 제거(L879) | 1(신규 테스트로 닫음) | **1 failed**, 정확히 그 신규 테스트("§106: 복원 seed 중
    재전송으로 대체된 시도는 SSE 를 열지 않는다") 확인 |
    | world 축 무력화(`isAttemptStale` 에서 world 비교 제거) | 1(신규 테스트로 닫음) | **1 failed**, 정확히 그
    신규 테스트("embed-config 왕복 중 언마운트...") 확인 |
    | 세대 미증가(`++bootGenRef.current` → `bootGenRef.current`) | 4 | **4 failed** 확인 |

    추가로 "`applyConfig` 의 world 가드는 한 번도 고정된 적이 없었다(origin/main 코드로 A/B 확인, 제거해도
    44건 전부 통과)" 주장도 pre-PR 커밋(`14bc86a53`) 을 별도로 checkout 해 `applyConfig` 의 두 `isStale(gen)`
    체크를 모두 제거하고 재현 — **44/44 그대로 통과**, 주장과 일치. `mutation 매트릭스(4/3/1/1/4/0)` 와
    "둘째 지점·world 축이 직전엔 0(무방비)이었다" 는 A/B 주장 모두 **과장 없이 정확하다.** 단, mutation
    매트릭스는 "가드 유무" 만 측정하므로 위 첫 번째 CRITICAL(가드가 *존재하는 채로* 상호작용해서 나는 버그)
    은 이 매트릭스의 설계 범위 밖이다 — 수치가 정확한 것과 "§106 위반이 완전히 해소됐다" 는 plan 의 정성적
    결론이 별개라는 뜻이다.
  - 제안: 없음(검증 목적 finding). mutation 매트릭스류 검증은 "가드 제거 시 탐지" 만 보장하고 "가드 간
    상호작용" 은 별도 시나리오 테스트가 필요하다는 점을 팀 관행에 참고 권장.

- **[INFO]** 매 `wc:boot` 재전송(설정이 완전히 동일해도)마다 `getStatus` 재조회 + SSE 재오픈(close→reopen)
  + `dispatch(RESTORED)` 가 무조건 실행된다 — "멱등 재설정" 표현과 정확히 부합하는지는 spec 이 침묵하는
  영역
  - 위치: `use-widget.ts` L888-890(`bridge.onBoot` 핸들러, config 동일성 검사 없이 매번 `applyConfig` 호출) ·
    L858-883(복원 분기, `saved` 존재 시 무조건 재조회+재오픈).
  - 상세: `2-sdk.md` L110 은 이 재전송 경로를 "`wc:boot` 재전송(**멱등 재설정**)" 이라 명명한다. "멱등"은
    보통 "여러 번 적용해도 1회 적용과 같은 최종 상태로 수렴" 을 뜻하며 "부작용이 전혀 없다" 를 강제하진
    않으므로, 현재 동작(재조회·재연결은 일어나지만 최종 phase 는 다시 원래대로 수렴)이 이 표현을 위반한다고
    단정하기는 어렵다. 다만 `awaiting_user_message` 중 재전송이 오면 `RESTORED` 가 무조건 `phase: "streaming"`
    으로 전이시켜(`widget-state.ts` L137) 잠시 스피너가 뜨는 flicker 가 관측될 수 있다 — plan 의 Rationale
    (L130)도 이 flicker 를 "이월된, ⑨-4 이전부터 존재" 로 인지하고 있다. 이 동작은 이번 PR 이 만든 것이
    아니라(브랜치 자체 diff 에 `applyConfig` 의 이 분기 로직 자체 변경 없음, staleness 재검증 방식만 교체)
    변경 범위 밖이다.
  - 제안: 조치 불요. 향후 admin 라이브 미리보기의 빈번한 재전송이 실제 UX flicker 를 유발하는지 별도
    관찰 권장(현재는 관리자 전용 경로라 사용자 영향 낮음, plan Rationale L131 과 동일 판단).

- **[INFO]** 나머지 체크리스트 항목은 이상 없음을 확인
  - TODO/FIXME/HACK/XXX: 브랜치 자체 diff(`git diff 14bc86a53..HEAD`)에 0건.
  - 반환값: `establishConfig`(`"reset"|"continue"` 모든 경로에서 명시 반환) · `beginBootAttempt`/`isAttemptStale`
    모두 일관된 값 반환 확인.
  - 인접 불변식 보존: locale-freeze(`widget-app.tsx` L30-35, `wc:boot` 재전송으로 UI 언어가 바뀌지 않음 —
    §106 명시 요구와 일치) · origin-pin(`host-bridge.ts` L52-58, 첫 `wc:boot` origin 만 핀 — §106 명시 요구와
    일치) 모두 이번 PR 로 변경되지 않았고 코드 확인 결과 정상 동작.

---

## 요약

이번 PR(6개 실파일: `use-widget.ts`/`use-widget-eager-start.test.ts`/`widget-state.ts`/`widget-state.test.ts`/
`webchat-boot-single-flight.md`/`2-sdk.md`)은 spec §106("마지막 wc:boot 적용")을 향한 **부분적** 개선이다.
(1) `bootGenRef`/`beginBootAttempt`/`isAttemptStale` 라는 supersede 메커니즘은 "resolve 순서 역전" 이라는
핵심 회귀 시나리오는 정확히 고치고(직접 코드 추적 + 재현 테스트로 확인), 동기 구간을 non-async 함수로
추출해 컴파일러 강제로 바꾼 `establishConfig` 는 이 파일이 반복 겪어온 "규율 vs 구조" 교훈을 잘 반영한
견고한 설계다 — plan 문서의 mutation 매트릭스(4/3/1/1/4/0)와 "world 가드가 pre-PR 에 전혀 고정 안 돼
있었다"는 A/B 주장은 격리 워크트리에서 독립 재현한 결과 **수치까지 전부 정확했다.** 그러나 (2) world 축과
boot 축을 단순 OR 로 묶은 `isAttemptStale` 은, 복원 분기가 개입해 "이미 확립된(그러나 곧 superseded 될)
시도가 belated 종료를 감지해 world 를 무효화" 하는 상호작용 시나리오에서 **살아있는 진짜 마지막 wc:boot 을
잘못 폐기**한다 — 이는 plan 의 "§106 위반 해소 확인" 이라는 결론이 완전하지 않음을 뜻하는 CRITICAL
반례이며, 동일 시각 병행된 concurrency 리뷰가 실측 재현했고 본 리뷰어도 코드 추적으로 독립 확인했다.
(3) A-6("ERROR 로 종료된 대화가 재부팅으로 부활") fix 는 spec `1-widget-app.md §3.1`(L114-116)이 명문화한
"확정 종료 시 SSE 재오픈·토큰 갱신 예약 금지" 불변식을 리듀서 레벨(화면)에서만 지키고, 근본 원인(`ERROR`
가 `teardownSession` 을 거치지 않아 세션이 storage 에 남는 것)은 그대로 둔다 — 화면은 정확히 "종료됨" 을
보여주지만 백그라운드에서 SSE 재연결·토큰 자동갱신이 계속된다. 이 gap 을 겨냥한 듯한 미커밋 수정이 리뷰
도중 워크트리에서 관측됐으나 리뷰 대상 diff(`215cd1c3f`)에는 포함되지 않아 최종 반영 여부 재확인이
필요하다. (4) spec `code:` frontmatter 보강은 컨벤션과 정합하고 타당하나, A-6 의 근본 fix 가 확정되기
전까지는 `1-widget-app.md §3.1` 표에 "명령 실패(비-410) → ERROR → ended" 행이 없다는 완전성 갭도 함께
남아있다. 마지막으로, `prompt_file` 이 나열한 37개 파일 중 31개는 이 브랜치 diff 가 아니라 stale-base
로 인한 `origin/main` 대비 오염(직전 머지된 `#966` 되돌림처럼 보임)이므로, 실제 PR 생성/머지 전 rebase 를
권장한다(코드 결함 아님, 절차 노트).

## 위험도

HIGH
