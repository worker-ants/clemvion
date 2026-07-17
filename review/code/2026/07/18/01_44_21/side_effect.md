# 부작용(Side Effect) 리뷰 — webchat-boot-single-flight (01_44_21)

## 조사 방법 / payload 한계 고지

`prompt_file` 이 담은 diff(변경 유형 "Review")는 `review/consistency/2026/07/17/19_46_54/{plan_coherence,rationale_continuity}.md`
신규 생성과 `spec/7-channel-web-chat/2-sdk.md` frontmatter `code:` 4줄 추가뿐이며, 호출자가 지시한 검증 대상인 실제
코드 변경(`codebase/channel-web-chat/src/widget/use-widget.ts`, 커밋 `cffee0d28`)을 포함하지 않았다(diff-scope 산정
이슈로 추정 — `git diff $(git merge-base origin/main HEAD)..HEAD --stat` 로 직접 확인한 결과 이번 라운드 범위에
`use-widget.ts`/`use-widget-eager-start.test.ts` 가 포함되어 있음에도 payload 에는 review 산출물 문서만 실렸다).
payload 를 신뢰하지 않고 `git show cffee0d28` 로 실제 diff 를 직접 확보해 아래 분석을 수행했다.

**격리 검증**: `.claude/worktrees/webchat-boot-single-flight-8c92b4`(공유, 다른 리뷰어 동시 사용 중)는 읽기 전용으로만
썼다. 실제 mutation testing·레이스 재현은 `git worktree add --detach`(scratchpad 하위)로 만든 두 개의 격리
워크트리에서 수행하고 검증 후 `git worktree remove --force` 로 제거했다(`git status --porcelain` 로 공유 워크트리
무변경 확인 완료). 두 워크트리:
- `side-effect-review-wt` — `cffee0d28`(이번 라운드, sessionEstablished 축) 체크아웃.
- `side-effect-review-wt-boot-axis` — `7cfbf2557`(직전 라운드, boot 축) 체크아웃 — 회귀 여부 교차비교용.

node_modules 는 원본 공유 워크트리의 루트를 심링크, `codebase/channel-web-chat/node_modules` 는 `rsync -a` 실카피로
부트스트랩(pnpm isolated 구조, MEMORY 의 "심링크 통짜 금지"는 앱 디렉토리 자체에 한정 — 개별 항목 심링크는 문제 없음을
실측 확인).

---

## 발견사항

- **[CRITICAL]** `sessionEstablished()` 축 교체가 근접-타이밍(TOCTOU) 레이스에서 이중 SSE 스트림 오픈을
  재도입 — boot 축 대비 실측 회귀
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:559`(WAITING 게이트),
    `:653-660`(`start()` 의 seed 호출 + `openStream`), `:986-1000`(`applyConfig` 복원 분기의 seed 호출 +
    `openStream`), JSDoc 주장부 `:507-516`("openStream 은 seed 반환 직후 동기 실행이라... 이중 스트림도
    원천 차단").
  - 실측 재현: 격리 워크트리(`cffee0d28`)에서 `start()` 자신의 `getStatus`(C)와 재전송 복원 분기의
    `getStatus`(D)가 동시에 in-flight 인 상태를 만든 뒤, **두 `resolve()` 를 같은 동기 블록 안에서 순서대로**
    (`statusResolvers[1](...)` D 먼저 → `statusResolvers[0](...)` C 그 직후) 호출하고 `flushAsync()`
    (macrotask 1틱, 그 시점 microtask 큐 전량 배출) 한 결과:
    ```
    [PROBE] esCount = 2   // EventSource 생성자가 두 번 호출됨 = 이중 스트림 오픈
    AssertionError: expected 2 to be 1
    ```
    **동일 프로브를 이 커밋의 직전 설계(boot 축, 커밋 `7cfbf2557`)에서 실행하면 `esCount = 1`(정상, 테스트
    통과)** — 즉 이 레이스는 이번 커밋이 boot 축을 버리고 `sessionEstablished()` 로 교체하면서 새로
    도입한 회귀임을 두 워크트리 교차비교로 확인했다. (프로브 스크립트는 검증 후 제거 — 아래 "검증 파일" 참조)
  - 근본 원인(TOCTOU): `sessionEstablished()`(`streamRef.current !== null`)는 **체크 시점의 동적 상태**를
    관찰한다. 그 체크(`seedWaitingFromStatus` 내부, 559행)와 체크 결과에 따른 행동(호출부의 `openStream()`
    호출, 660행/1000행)은 서로 다른 async 실행 경로에 분리돼 있고 그 사이 mutual exclusion 이 없다. 두
    경쟁 시도(C, D) 각각이 "아직 아무도 스트림을 안 열었다"를 **둘 다 사실이었던 시점**에 관찰하면, 그
    관찰에 따라 순차적으로 각자 `dispatch`+`openStream` 을 실행해 **둘 다 통과**한다.
    반면 이전 boot 축(`bootGenRef.current !== attempt.boot`, `cannotApplyConfig`)은 "정적 스냅샷(자기 시도
    시작 시점의 세대값)"과 "단조증가 카운터(현재 세대)"를 비교하므로 **관찰 시점과 무관하게 항상 정확**했다
    (race-free) — `attempt.boot` 은 시도 시작 시 고정되고 `bootGenRef.current` 는 오직 "새 시도 시작"이라는,
    getStatus 응답 타이밍과 완전히 독립적인 이벤트에서만 갱신되기 때문이다. 이번 교체가 그 정적 비교의
    안전성을 "경쟁자 자신도 아직 실행 중일 수 있는 동적 상태 관찰"로 바꾸며 이 안전성을 잃었다.
  - JSDoc/커밋 메시지 주장의 반증 범위: "먼저 resolve 한 것이 스트림을 열고 나머지는 다음 microtask 에서
    이 가드에 걸린다"는 주장은 **한 시도가 완전히 처리(getStatus 2단계 await + dispatch + openStream)를
    마친 뒤에야 다른 시도가 처리되는 순차 케이스**에서만 성립한다. 기존 회귀 테스트
    (`use-widget-eager-start.test.ts:3222` "start() 의 지연 seed가 재전송이 전진시킨 화면을 되감거나
    두번째 스트림을 열지 않는다")도 정확히 이 순차 케이스만 검증한다 — D 를 `flushAsync()` 로 완전히
    처리(`esCount===1` 확정)한 **뒤에야** C 를 resolve 시킨다(3288행 vs 3297행, 별개의 `act` 블록). "근접
    동시" 케이스(두 fetch 응답의 처리가 서로를 가로지르는 타이밍)는 어떤 기존 테스트도 커버하지 않는다.
  - 되감기(화면이 옛 노드로 되돌아가는 것) 동반 여부는 별도 실험을 시도했으나 **재현에 실패**했다 —
    두 번째 프로브에서 `await Promise.resolve()` 한 틱만으로 SSE emit 을 시도했더니 `latestEs` 가 여전히
    `null`(D 의 getStatus→`res.json()` 2단계 await 가 아직 안 끝남)이라 emit 자체가 no-op 이었고, 최종
    "n1" 결과는 되감기가 아니라 단순히 "SSE 전진이 애초에 없었던 상태에서 C 가 뒤늦게 그렸을 뿐"이었다
    (로그로 직접 확인: `latestEs set? false`). **이 부분은 미확정으로 정직하게 보고한다** — 이중 스트림
    문제와 혼동해 과잉 보고하지 않았다.
  - 실사용 영향: (a) EIA 서버에 SSE 연결이 순간적으로 2개 열림(`openStream` 내부가 매번
    `closeStream()` 선행이라 최종적으로 1개만 남지만, 두 번째가 열리는 그 찰나 서버 쪽에 여분 연결이
    발생). (b) 두 스트림이 조금이라도 겹쳐 살아있으면 동일 SSE 이벤트가 두 스트림 각각의
    `handleEiaEvent` 로 전달돼 중복 `dispatch` 가능성 — 이번 실측 범위 밖의 이론적 우려로 남긴다. (c)
    `scheduleRefresh()` 는 매 호출 시 `clearRefreshTimer()` 를 선행하는 idempotent 구조(`use-token-refresh.ts:73-74`)
    임을 코드로 확인 — C·D 양쪽이 각자 호출해도 중복 타이머는 발생하지 않는다(이 경로는 안전, 별도 조치 불요).
  - 발생 조건의 현실성: 두 `getStatus` 응답이 마이크로태스크 인터리빙 창 이내로 근접해야 한다. spec
    (`2-sdk.md §3(재전송)`)이 명시하듯 관리자 라이브 미리보기는 폼 변경마다 **디바운스 없이** 재전송하므로,
    "패널을 막 연 직후(start() 의 자기 getStatus 미해결) 폼을 연타로 바꾸는" 사용 패턴에서 이 창에 들어갈
    **기회 자체**는 드물지 않다. 다만 응답이 정확히 그 좁은 창 안에 도착해야 하므로 결정적 버그(매번
    재현)는 아니라 확률적 레이스다. 그럼에도 이 파일이 스스로 "이 클래스의 8번째 거울상"(plan 329행)이라
    자평할 만큼 반복 재발해 온 동시성 결함과 정확히 동형(같은 파일, 같은 두 호출부, 같은 "누가 스트림을
    소유하는가" 판정 로직)이므로 CRITICAL 로 분류한다.
  - 제안: (a) 체크(`sessionEstablished`)와 행동(스트림 오픈 자격 확정)을 하나의 원자적 **동기** 지점으로
    합칠 것 — 예: `seedWaitingFromStatus` 가 WAITING dispatch 를 결정하는 그 동기 구간 안에서 "내가 스트림을
    열 유일한 소유자"임을 그 자리에서 즉시 표시(예: 새 ref 를 그 지점에서 set)하고, 호출부는 그 표시가
    자신의 것인지 재확인한 뒤에만 `openStream` 하게 해 관찰-행동 갭을 없앨 것. (b) 또는 이전 boot 축의
    "정적 스냅샷 비교" 성질(race-free)을 유지하면서 00_51_53/18_39_11 이 지적한 두 결함(함수 경계 미도달,
    no-op 재전송 거짓 stale)만 boot 축 안에서 별도로 봉합하는 대안을 재검토할 것. (c) 최소한, 이번에
    실측한 "근접 동시 resolve" 케이스를 명시적으로 재현하는 회귀 테스트를 추가할 것 — 현재
    `use-widget-eager-start.test.ts:3222` 는 순차 케이스만 커버해 이 회귀를 잡지 못한다.

- **[정상 확인]** `replay_unavailable` opt-in(`{ allowWhileStreaming: true }`)은 실제로 load-bearing —
  mutation 으로 제거 시 재동기화가 정확히 no-op 이 됨을 실측 확인
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:437`(opt-in 호출부),
    `:559`(가드 소비 지점).
  - 실측: 격리 워크트리에서 437행의 `{ allowWhileStreaming: true }` 인자를 제거하는 mutation 을 적용하고
    전체 스위트를 재실행한 결과, `use-widget-eager-start.test.ts` 의 "replay_unavailable 수신 → getStatus
    재조회로 현재 표면 재동기화(스트림 유지)" 단 1건만 정확히 실패했다:
    ```
    AssertionError: expected false to be true
    ❯ use-widget-eager-start.test.ts:1306:87  (messages.some(m => m.text === "버퍼 만료 후 복구된 메시지"))
    ```
    mutation 원복 후 58/58 재통과 확인. 커밋 메시지의 "mutation B(opt-in 제거)→replay 재동기화 실패" 주장과
    정확히 일치한다.
  - 이 opt-in 은 `handleEiaEvent` 의 `replay_unavailable` 분기(SSE 이벤트 핸들러)에서만 쓰이는데, 이
    분기는 정의상 스트림이 이미 열려 있어야 발화한다(`sessionEstablished()` 는 사실상 항상 `true`) — opts
    없이 호출했다면 559행 가드에 항상 걸려 이 기능 전체가 조용히 no-op 이 됐을 것이다. 단일 옵션 하나가
    기능 전체의 존재를 좌우하는 지점이라 취약성 자체는 있으나, mutation 테스트가 정확히 이를 감시하고
    있어 향후 실수로 제거되면 즉시 잡힌다 — 별도 조치 불요.

- **[정상 확인]** `seedWaitingFromStatus` 게이트(559행) 자체 — mutation 으로 완전히 제거 시 되감기
  회귀 2건이 정확히 실패함을 실측 확인 (순차 케이스 한정)
  - 위치: `:559`.
  - 실측: 559행 전체를 주석으로 치환(게이트 무력화)하고 전체 스위트 재실행 → "대체된 시도의 지연
    getStatus 가 살아있는 화면을 옛 노드로 되감지 않는다"·"start() 의 지연 seed 가 재전송이 전진시킨
    화면을 되감거나 두번째 스트림을 열지 않는다" 정확히 2건만 실패(둘 다 `n1`↔`n2` 되감김 단언 실패).
    커밋 메시지의 "mutation A(게이트 제거)→되감기 2건 실패" 주장과 일치. 단, 이 결과는 **순차 처리
    케이스**에 대한 것이며, 위 CRITICAL 항목이 지적하듯 게이트가 있어도 근접-동시 케이스에서는 무력화된다.

- **[정상 확인]** seed 호출부 3종(`start`/`applyConfig`/`replay_unavailable`)의 부작용 차이는 명확 —
  시그니처·호출부·JSDoc·deps 배열 모두 일관되게 갱신됨
  - 위치: `:226-233`(`seedWaitingFromStatusRef` 타입), `:518-522`(`@param opts.allowWhileStreaming` JSDoc),
    `:589`(`useCallback` deps `[finalizeEnded, isStale, sessionEstablished]`), 세 호출부
    (`:437`, `:656`, `:989`).
  - `start()`(656행)과 `applyConfig` 복원(989행)은 `opts` 생략(기본값 = 스트림 열렸으면 스킵) — 두 경로
    모두 "자신은 seed **이후에** 스트림을 연다"는 불변식을 공유하므로, seed 호출 시점에 스트림이 이미
    열려 있다면 그건 항상 "다른 시도"의 것이라는 논리가 성립한다. `handleEiaEvent`(437행)만 opt-in —
    이 경로는 "자기 스트림이 이미 열린 채" 호출된다는 점에서 나머지 둘과 구조적으로 다르다. 세 호출부
    모두 새 시그니처로 일관 갱신됐고 `seedWaitingFromStatusRef` 타입도 함께 갱신돼 드리프트 없음
    (구 시그니처 `attempt?: { boot: number }` 잔재 0건, grep 으로 확인). `sessionEstablished` 는
    `useCallback(() => streamRef.current !== null, [])` 로 deps 빈 배열이라 stable — `cannotApplyConfig` →
    `sessionEstablished` deps 교체가 정확하다.
  - **인터페이스/시그니처 영향 없음**: `seedWaitingFromStatus` 는 module-private(export 없음, `useWidget`
    훅 내부 클로저)이므로 세 번째 인자의 shape 변경(`attempt` → `opts`)이 외부 호출자에 영향을 주지
    않는다. `useWidget()` 자체의 공개 반환 shape(`state`/`config`/`actions`)도 이번 diff 로 변경되지
    않았다(grep 대조 확인). 공개 API·환경변수·네트워크 호출 대상·전역 변수 도입은 이번 diff 범위에 없다.

## 검증 파일(제거 완료)

프로브 테스트 3개(`use-widget-race-probe.test.ts`, `use-widget-race-probe2.test.ts` 및 개정판)를 격리
워크트리에서만 작성·실행했고, 실측 확보 후 `git worktree remove --force` 로 워크트리 전체를 삭제해 제거했다.
공유 워크트리(`webchat-boot-single-flight-8c92b4`)에는 어떤 파일도 생성·수정하지 않았다(`git status --porcelain`
로 코드 변경 없음 확인, `review/code/2026/07/18/01_44_21/` 만 이 리뷰 세션 자체의 산출물로 존재).

## 요약

호출자가 명시한 세 검증 항목 중 (2) replay_unavailable opt-in 과 (3) 세 호출부의 부작용 분리는 mutation
testing 과 코드 대조로 **정상 확인**됐다 — opt-in 제거 시 재동기화가 정확히 no-op 되고, 세 호출부는 시그니처·
JSDoc·deps 배열이 일관되게 갱신돼 있으며 module-private 이라 외부 인터페이스 영향도 없다. 그러나 (1) "이중
스트림 방어가 다 유지되는가"는 **부분적으로만 사실이다**: 순차 처리(한 시도가 완전히 끝난 뒤 다음 시도가
처리되는 케이스, 기존 회귀 테스트가 커버하는 범위)에서는 유지되지만, 두 개의 `getStatus` 응답이 근접한
타이밍에 도착하는 경쟁 상황에서는 **이중 SSE 스트림 오픈이 실측으로 재현됐다**(`esCount=2`). 이 커밋의
직전 설계(boot 축)에서 동일 프로브가 통과(`esCount=1`)함을 교차 확인했으므로, 이는 `sessionEstablished()`
축으로의 교체가 **새로 도입한 회귀**다. 근본 원인은 TOCTOU 패턴 — "체크(스트림 열림 관찰)"와 "행동(스트림을
실제로 여는 것)"이 서로 다른 비동기 경로에 분리되어 있어 두 경쟁자가 서로의 진행 상태를 아직 못 본 채 동시에
"안전하다"고 판단할 수 있다. 반면 이전 boot 세대 비교는 정적 스냅샷과 단조증가 카운터의 비교라 관찰 시점과
무관하게 항상 정확했다(race-free) — 이번 교체가 그 안전성을 대가로 18_39_11/00_51_53 의 두 함수-경계·고착
결함을 고친 트레이드오프로 보인다. 되감기 동반 여부는 재현을 시도했으나 실험 설계 문제로 확정하지 못해
미확정으로 남긴다(과잉 보고 방지). 이 파일이 스스로 "8번째 거울상"이라 부를 만큼 반복돼 온 동시성 결함
클래스와 정확히 같은 형태이므로, 이번 발견도 CRITICAL 로 분류해 후속 라운드에서 반드시 처리할 것을 권고한다.

## 위험도

CRITICAL
