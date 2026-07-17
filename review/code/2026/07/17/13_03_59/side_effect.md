# 부작용(Side Effect) Review — 2026-07-17 13_03_59

대상: `codebase/channel-web-chat/src/widget/use-widget.ts`(`bootGenRef` 신설 — `pendingResetRef` 폐기 조건을
"BLOCKED 분기" 에서 "BLOCKED 분기 **+ 자신이 여전히 최신 부팅 시도일 때**"로 좁힘, `if (bootGenRef.current === bootGen)
pendingResetRef.current = false;`) + `use-widget-eager-start.test.ts`(혼합 순서 회귀 테스트 1건 신규) + 직전 라운드
(`12_34_03`) 산출물 5개(RESOLUTION/SUMMARY/side_effect/testing/meta·retry_state, 전부 신규 파일).

이 델타는 직전 라운드(`12_34_03`)에서 본 리뷰어(side_effect)와 testing 이 **독립적으로 순서-대조 재현**한 세
번째 거울상 결함("겹친 두 부팅의 결과가 갈리고 BLOCKED 가 먼저 resolve 하면 정당한 리셋이 소실된다")에 대한
**구조적 근본 수정**이다. 지시받은 대로 이번 라운드는 되돌리지 않고 세대 카운터(`bootGenRef`)로
`pendingResetRef` 의 소유권을 명시했다.

## 검증 방법

정적 추적에 더해, **직전 두 라운드가 보고한 mutation 매트릭스를 격리 worktree(`git worktree add --detach`)에서
직접 재현**했고, 거기에 더해 이번 fix 가 명시적으로 검증하지 않은 확장 케이스 3종(3중 겹침·비대칭 순서·
언마운트/재마운트)을 신규 probe 테스트로 작성해 실측했다. 전 과정 `git worktree remove --force` 로 제거,
공유 worktree(`funny-mahavira-50d003`)는 `git status --short` 로 `review/code/2026/07/17/13_03_59/`
신규 디렉터리 외 오염 없음을 재확인했다. `node_modules` 는 공유 worktree 의 실제 디렉터리를 symlink 재사용
(vitest 전용, Turbopack/Next 미관여).

## 발견사항

- **[INFO]** 질문 1 — 세 방향(①유령 리셋 ②리셋 소실 ③혼합 순서)이 실제로 동시에 닫혔는지: **독립 mutation
  매트릭스로 재확인, YES**
  - 위치: `use-widget.ts:742-767`(`bootGen` 캡처·소유권 조건), `:2101`·`:2197`·`:2269`(테스트 3건,
    파일 `use-widget-eager-start.test.ts`)
  - 상세: 직전 라운드가 보고한 표를 **신뢰하지 않고 격리 worktree 에서 직접 재현**했다.

    | mutation | 실측 실패 | 오케스트레이터 보고와 일치 |
    |---|---|---|
    | A. 세대 조건 제거(`if (bootGenRef.current === bootGen)` 삭제, 무조건 폐기 — `12_34_03` 상태로 회귀) | **"겹친 부팅의 결과가 갈릴 때..." 1건만** 실패(`hookPosts` 기대 1, 실제 0) | 일치 |
    | B. BLOCKED 폐기 자체 제거(그 줄을 주석 처리) | **"차단된 부팅 중의 resetSession..." 1건만** 실패(구 세션 `forced-new` 로 오염) | 일치 |
    | C. entry-clear 재도입(`bootGen` 캡처 직후 무조건 `pendingResetRef.current = false;` 추가, `12_04_49` 의 잘못된 fix) | **"겹친 부팅(boot 재전송)..." + "겹친 부팅의 결과가 갈릴 때..." 2건** 실패, ①은 그대로 통과 | 일치 |

    세 mutation 각각 정확히 대응하는 방향만 깨뜨리고 나머지는 42/43 그대로 통과했다 — RESOLUTION 의 주장과
    내 독립 실측이 완전히 일치한다.

- **[INFO]** 질문 2 — 네 번째 방향이 있는지(특히 `bootGenRef` 단조 증가·비-리셋, 언마운트/재마운트 동작):
  **정적 추적 + 3종 신규 probe 실측으로 탐색, 발견 못함(아래 관련 관찰 1건은 있으나 이 fix 가 만든 결함은 아님 — 다음 항목 참조)**
  - **PROBE-1(3중 겹침, out-of-order resolve)**: boot#1(BLOCKED)·boot#2(BLOCKED)·boot#3(ALLOWED) 를
    이 순서로 진입시키되(모두 겹침, `bootGen` 은 1·2·3), **resolve 는 boot#2 → boot#1 → boot#3 순으로
    완전히 뒤섞었다**. 결과 `hookPosts===1`(PASS) — `bootGenRef.current` 는 boot#3 진입 이후 계속 3 으로
    고정되므로, boot#1·boot#2 는 **어떤 순서로 resolve 하든** 자신이 소유자가 아님을 정확히 판별해 폐기를
    스킵했고, 최종적으로 boot#3(진짜 최신, 그러나 resolve 순서상으로는 마지막)이 `bootGenRef.current===3`
    조건을 만족해 정상 소비했다. 즉 소유권 판정은 **"resolve 시점의 순서"가 아니라 "entry 시점에 확정된
    최신성"** 을 기준으로 하며, 이는 2-way 케이스를 넘어 N-way 로도 대칭적으로 성립함을 확인했다.
  - **PROBE-2(비대칭 순서: ALLOWED 가 먼저 소비, 그 뒤 stale BLOCKED)**: boot#1(ALLOWED, 먼저 resolve →
    `pendingResetRef` 를 소비해 `newChat()` 호출 → `worldGenRef` bump)·boot#2(BLOCKED, 나중에 resolve).
    결과 `state.phase` 는 `"streaming"` 유지(`"blocked"` 로 전혀 전이하지 않음), `sessionStorage` 도
    `"fresh"` 유지(PASS). ALLOWED 분기의 소비 라인(`:779-780`)에는 `bootGen` 조건이 **의도적으로 없는데**,
    이는 위험하지 않다 — boot#2 는 자신의 **첫 `isStale(gen)` 체크**(`:749`, `!allowed` 판정보다 앞)에서
    이미 stale 로 걸러져 `!allowed`/폐기-조건/`dispatch(BLOCKED)` 어느 라인에도 도달하지 못한다. 즉 ALLOWED
    분기는 `bootGen` 없이도 기존 `worldGen` 자기치유만으로 완전히 보호된다는 설계 의도가 실측과 일치했다.
  - **PROBE-3(부팅 중 언마운트 → 재마운트)**: 구 마운트에서 boot#1 in-flight 중 `resetSession` 도착
    (`pendingResetRef.current=true`) → **소비되기 전에 unmount**. 구 마운트의 지연 응답은 `worldGenRef`
    가 언마운트에서 이미 bump 돼 무해(기존 "webhook POST in-flight 중 언마운트" 테스트와 동일 축, `hookPosts`
    0 유지로 확인). **재마운트**(완전히 새 `useWidget()` 인스턴스 — `bootGenRef`/`pendingResetRef` 모두
    `useRef` 재초기화)는 구 마운트의 리셋 의도를 전혀 물려받지 않고 구 세션을 정상 복원했다(`hookPosts===0`,
    `sessionStorage` 에 `"old"` 유지, `state.phase==="streaming"`) — `useRef` 는 hook 인스턴스(React
    fiber) 스코프이므로 언마운트 시 이전 인스턴스의 `bootGenRef`/`pendingResetRef` 값 자체가 함께 소멸한다.
    **다만 이 특성 자체("언마운트 전 미이행 리셋은 재마운트로 이월되지 않는다")는 `bootGenRef` 도입 이전부터
    있던 `pendingResetRef`(09_36_01 도입)의 원래 설계이며, 이번 diff 가 새로 만들거나 악화시킨 게 아니다** —
    세 라운드 전부 `pendingResetRef` 를 in-memory `useRef` 로만 다뤘고 `sessionStorage` 등으로 마운트 경계를
    넘겨 영속화한 적이 없다.
  - grep 전수: `bootGenRef` 는 `use-widget.ts` 안 정확히 3곳(선언·증가·소유권 판독)에서만 참조되고 다른
    파일(예: `use-token-refresh.ts`)에는 전혀 노출되지 않는다 — `worldGenRef` 와 달리 외부로 주입되지 않는
    순수 로컬 상태라 교차 모듈 side effect 경로 자체가 없다.

- **[INFO]** 질문 3 — `pendingResetRef` 가 소비되지 않고 남는 경로가 있는지, 있다면 해로운지: **존재하나 전부
  무해함을 확인**
  - 상세: `teardownSession()` 의 pre-boot no-op 분기(`:253`)가 유일한 set 지점이고, 소비는 `:765`(BLOCKED,
    조건부)·`:779-780`(ALLOWED, 무조건) 둘뿐(불변, 직전 라운드 grep 과 일치). 소유권 조건 도입으로 인해
    "BLOCKED 인데 소유자가 아니라 폐기를 건너뛰는" 경우가 새로 생겼는데, 이 경우 플래그는 **다음에 도착하는
    부팅**(같은 마운트 안에서 더 최신이거나, 이후 새로 도착하는 `wc:boot`)이 소비하거나, 끝내 아무 성공한
    부팅도 없으면 그 마운트가 끝날 때까지(=PROBE-3) 그냥 `true` 로 남는다. 후자가 해로운 이유가 없는 것은:
    (a) 그 시점까지 `configRef.current` 가 계속 null 이라는 뜻이므로 지킬 세션 자체가 없고, (b) 다음 성공한
    부팅이 나타나면 그때 정확히 "지금까지 밀린 리셋 의도를 이행"하는 것이 원래 설계 의도(`teardownSession`
    JSDoc)와 정확히 일치하기 때문이다. `!cfg.apiBase` 조기 return·첫 `isStale` 조기 return 두 곳은 이번
    라운드에도 `pendingResetRef` 를 전혀 참조하지 않아(직전 라운드 INFO 그대로 유효) 논외.

- **[INFO]** 질문 4 — INFO#3 이월("겹친 시도 중 어느 config 가 최종 적용되는가는 resolve 순서가 정한다", spec
  `2-sdk.md:106` 갭)이 이 fix 로 악화됐는지: **악화되지 않음, 다만 관련 사실 하나를 새로 확인(WARNING 아님)**
  - 상세: config 확립 라인(`configRef.current = cfg; setConfig(cfg); clientRef.current = new EiaClient(...)`,
    `:769-771`)은 이번 diff 에서 **한 글자도 바뀌지 않았다** — `bootGenRef` 는 오직 `pendingResetRef` 폐기
    조건에만 관여하고 config 선택 로직과는 완전히 분리된 축이다(JSDoc 도 "축이 다르다" 고 명시). PROBE-2 로
    "먼저 resolve 하는 ALLOWED 가 (구세대라도) config 를 확정하고 나머지는 stale 화" 되는 기존 동작이 그대로
    보존됨을 재확인했다.
  - **새로 확인한 관련 사실**: 겹친 두 부팅이 **BLOCKED 가 먼저** resolve 하는 순서(이번 라운드가 정확히
    고치는 그 순서)에서는, `pendingResetRef` 처리와는 별도로 `dispatch({type:"BLOCKED",...})`(`:766`)가
    **소유권 조건 없이 무조건** 발사된다 — 이 라인은 이번 diff 가 손대지 않았다. 임시 PROBE-4 로 확인한 결과
    boot#1(BLOCKED) resolve 직후 `state.phase` 가 `"blocked"` 로 **일시 전이**했다가, boot#2(ALLOWED) 가
    이어서 resolve 하며 `newChat()`→`start()` 경로의 연쇄 dispatch 로 `"streaming"` 으로 **자가 복구**됐다
    (사용자에게는 최악의 경우 한 embed-config 왕복 시간만큼의 짧은 "차단됨" 화면 플리커로 보일 수 있다).
    **이 flicker 는 이번 diff 가 만든 게 아니다** — 동일 PROBE 를 mutation A(=`12_34_03` 의 무조건-폐기
    코드)에 대해서도 실행해 **완전히 동일한 flicker** 를 확인했다(`bootGenRef` 유무와 무관, `dispatch` 라인이
    애초에 미변경이므로 당연한 결과). 이는 직전 라운드 side_effect 가 이미 이월한 "겹친 두 boot, 결과가
    다르고 **BLOCKED 가 나중에** resolve 하면 phase 가 영구적으로 덮인다"는 INFO 의 **거울상**(BLOCKED 가
    **먼저** resolve 하면 일시적·자가복구성 flicker)이며, 두 사례를 합치면 "single-flight 부재" 갭이
    resolve 순서에 따라 (a) 영구 덮어씀 또는 (b) 일시 플리커 두 형태로 나타난다는 조금 더 완전한 그림이
    된다. `pendingResetRef` 소유권과는 독립된 축(리셋 여부와 무관하게 발생 — PROBE-4 는 리셋 없이도 동일)
    이므로 이번 라운드의 WARNING 대상은 아니라고 판단한다.
  - 제안: 이월된 INFO#3(또는 그 하위 backlog 항목)에 "BLOCKED 가 먼저 resolve 하면 phase 가 일시
    flicker(자가복구) / 나중에 resolve 하면 영구 덮어씀"이라는 두 방향을 함께 명시해 두면, 다음에 이
    single-flight 구조를 실제로 설계할 때 커버해야 할 케이스 목록이 더 완전해진다. 이번 라운드에서 조치할
    필요는 없다(리셋 안전성과 무관한 별개 축이고, 이미 알려진 구조적 갭의 재확인일 뿐).

- **[INFO]** 그 외 표준 부작용 축 — 전부 깨끗함
  - **시그니처/공개 인터페이스**: `applyConfig` 는 여전히 `useEffect` 내부 비-export 로컬 클로저.
    `useWidget()` 반환 shape(`state, config, actions`) 불변. `bootGenRef` 는 어떤 콜백/훅에도 파라미터로
    주입되지 않는다(`worldGenRef` 는 `useTokenRefresh` 에 주입되는 것과 대조적).
  - **전역 변수**: 없음. `bootGenRef` 는 `useRef(0)` 로 신설된 **hook-인스턴스 스코프** 상태 — 모듈 스코프
    변수·`window`/`globalThis` 부착 없음. 이번 delta 로 도입된 전역 변수는 0개.
  - **파일시스템/환경변수**: 프로덕션·테스트 모두 관여 없음(review 문서 자체의 파일 생성은 리뷰 파이프라인의
    정상 산출물).
  - **네트워크 호출**: 신규 프로덕션 호출 없음. 신규 테스트가 쓰는 `vi.stubGlobal("fetch", ...)` 는 파일 내
    기존 다수 테스트와 동일 패턴이고 전역 `afterEach`(`vi.unstubAllGlobals()`, 이번 diff 밖)가 격리를
    담당 — 신규 테스트가 이 격리를 깨는 새 전역을 추가하지 않았다.
  - **이벤트/콜백**: `dispatch`/`bridgeRef.current?.sendEvent` 호출 지점 자체는 변경 없음(`dispatch({type:
    "BLOCKED"...})` 도 라인 자체는 기존과 동일 위치·동일 무조건 호출 — 위 질문4 항목에서 별도로 다룸).
    변경된 것은 오직 "`pendingResetRef` 를 지우는 조건" 하나뿐이라 이벤트 발생 총량·타입 자체는 시나리오별로
    직전 라운드와 동일하다.

## 질문별 결론

1. **세 방향 동시 폐쇄 여부** → 확인됨(mutation A/B/C 독립 재현, 오케스트레이터 보고와 완전 일치).
2. **네 번째 방향 존재 여부** → 3종 확장 probe(3중 겹침·out-of-order / ALLOWED-먼저+trailing BLOCKED /
   부팅중 언마운트-재마운트) 전부 안전 확인, 새 결함 없음. `bootGenRef` 의 단조 증가·비-리셋 특성은
   hook-인스턴스 스코프(`useRef`)라 언마운트로 자동 소멸하며 문제 없음.
3. **`pendingResetRef` 미소비 잔존 경로** → 존재하나(다음 부팅 대기 또는 부팅이 끝내 안 오는 마운트 잔여
   구간) 세션이 아직 없거나 인스턴스가 소멸하는 경우라 전부 무해.
4. **INFO#3 이월 갭 악화 여부** → 악화 아님(config 선택 로직 무변경). 다만 리셋과 무관한 별개 관찰(BLOCKED-
   먼저 순서의 일시 phase flicker, 이 fix 이전부터 존재)을 확인해 backlog 보강을 제안.

## 요약

이번 `bootGenRef` 도입은 직전 라운드가 순서-대조로 재현한 세 번째 거울상 결함(혼합 순서에서 정당한 리셋 소실)
을 구조적으로 닫는다 — 격리 worktree 에서 오케스트레이터가 보고한 mutation 매트릭스(세대 조건 제거→③만 실패
/ BLOCKED 폐기 제거→①만 실패 / entry-clear 재도입→②③ 실패)를 독립적으로 그대로 재현해 확인했다. 여기 더해
이번 fix 가 명시적으로 커버하지 않는 확장 케이스 3종 — 3중 겹침에서의 완전 out-of-order resolve, ALLOWED 가
먼저 소비한 뒤 뒤이은 BLOCKED 판정의 안전성, 부팅 도중 언마운트 후 재마운트의 인스턴스 격리 — 를 신규 probe
테스트로 작성해 실측했고 셋 다 안전함을 확인했다. `pendingResetRef` 가 소비되지 않고 남는 경로는 여전히
존재하지만(다음 부팅 대기, 또는 마운트 종료까지 미이행) 모두 "지킬 세션이 아직 없다"는 이유로 무해하다.
INFO#3(single-flight 부재) 이월 갭은 config 선택 로직이 이번 diff 로 전혀 손대지지 않아 악화되지 않았다.
다만 검증 중 리셋과 무관한 별도 관찰 하나(겹친 두 부팅이 BLOCKED 를 먼저 resolve 하면 `state.phase` 가
`"blocked"` 로 일시 전이했다가 자가복구되는 짧은 flicker)를 발견했는데, 동일 관측을 `bootGenRef` 도입 이전
코드에서도 재현해 **이번 diff 가 만든 게 아님**을 확인했다 — 리셋 안전성과 독립된, 이미 이월된 구조적 갭의
또 다른(그러나 이번엔 자가복구성인) 표현이라 WARNING 이 아닌 INFO 로 분류하고 backlog 보강만 제안한다.
시그니처/공개 인터페이스·전역 변수·파일시스템·환경변수·네트워크·이벤트 발생 총량 등 표준 부작용 축은 이번
delta 로 전혀 훼손되지 않았다 — `bootGenRef` 는 어떤 다른 모듈에도 노출되지 않는 순수 로컬 `useRef` 이고
신규 전역 변수는 0개다.

## 위험도

LOW
