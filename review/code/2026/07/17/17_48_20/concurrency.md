# 동시성(Concurrency) 리뷰 — webchat-boot-single-flight (2026-07-17 17_48_20)

## 검증 방법

- prompt_file 의 diff 33개 파일을 전수 확인한 결과, 이 브랜치(HEAD)가 실제로 만든 변경은 **4개뿐**임을 git 으로 실측했다(스코프 노트 참조). 그 4개는 diff hunk 가 아니라 **현재 파일 전문**을 Read 해 문맥 전체(`use-widget.ts` 957줄 전체, `widget-state.ts` 223줄 전체)를 파악했다.
- 이 파일은 동일 메커니즘(부팅 중 리셋 이행)에서 **4라운드 연속 CRITICAL/WARNING**을 낸 hotspot이다. 이전 두 라운드(`review/code/2026/07/17/13_03_59/`, `14_30_15/`) 의 `concurrency.md`·`RESOLUTION.md` 전문을 읽고, 그 두 라운드가 검증한 `bootGenRef` 는 **구설계**(`pendingResetRef` 소유권 폐기 스코프용, 13_03_59 에서 결함 발견 → 사용자 결정으로 전면 폐기)였고 이번 PR 이 재도입한 `bootGenRef` 는 **완전히 다른 목적**(`applyConfig` 시도 대체/§106 준수)으로 신설된 것임을 확인했다 — 즉 이번 PR 의 메커니즘은 과거 두 라운드 어느 쪽도 검증한 적 없는 **신규 코드**라 처음부터 독립적으로 재검증했다.
- `plan/in-progress/webchat-boot-single-flight.md` 의 A-5 mutation 매트릭스(개발자 자가검증 6종)를 실제 소스 구조와 대조해 재현 가능성을 코드 레벨로 확인했다.
- `host-bridge.ts` 의 `onBoot` 배선(`win.addEventListener("message", ...)` → `bootCb?.(...)` 1회 호출)을 확인해, "진입 순서 = 도착 순서"라는 질의 4 답변의 전제가 `postMessage`/`message` 이벤트의 매크로태스크 직렬 처리(동일 source→target 간 FIFO 순서 보장, HTML 표준)에 근거함을 검증했다.
- `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts`(2692줄) 에서 boot-generation 관련 테스트 8건의 실제 assertion 을 읽어 개발자의 자가검증 claim 을 코드로 대조했다.

## 스코프 노트 — 리뷰 대상 재정의 (중요)

- **[INFO]** prompt_file 의 33개 파일 중 29개는 이 브랜치의 변경이 아니라 **미리베이스 브랜치의 diff 생성 아티팩트**
  - 위치: 파일 1~12·17~21·23~33 (`.claude/_shared/**`, `review_guard.py`, 두 orchestrator, `harness-checks.yml`, sidebar 테스트 3개, `plan/complete↔in-progress/harness-report-contract-followups.md`, `review/code/2026/07/17/15_48_02/**` 등)
  - 상세: `git log HEAD..origin/main --oneline` = `67871ffbd fix(harness): report-path 규칙을 공유 모듈로... (#966)` 단 1건(2026-07-17 17:47:29 병합). `git ls-tree -r HEAD --name-only | grep report_paths` = 0건인 반면 `git ls-tree -r origin/main`에는 존재 — 즉 `.claude/_shared/report_paths.py` 등은 **이 브랜치가 지운 게 아니라 애초에 만든 적이 없다**. 이 review 세션(17_48_20)은 PR #966 병합 51초 뒤에 생성됐는데, 이 브랜치(`14bc86a53`에서 분기)가 그 위로 리베이스되지 않은 채 두 트리를 직접 비교하는 방식으로 diff 가 만들어져, origin/main 전용 커밋의 추가분이 HEAD 기준 "삭제"로 반전 표시됐다. `git log origin/main..HEAD --oneline` 으로 확인한 이 브랜치의 실제 커밋은 4개뿐이다: `1e0de3e5b`(plan)·`68ff69ba7`(feat: single-flight)·`b8ea32b63`(refactor: establishConfig 추출)·`215cd1c3f`(fix: ERROR 부활 방지).
  - 해당 29개 파일은 실제 변경이었다 해도 순수 동기 단일 프로세스 Python/YAML/MD/JSON(threading·asyncio·lock 미사용, 기존 13_03_59/14_30_15 리뷰와 별개로 직접 훑어 확인)이라 동시성 위험도는 어차피 NONE 이다. 아래 모든 발견사항은 **실제 이 브랜치의 변경분**(파일 13~16 `widget-state.ts`/`.test.ts`, `use-widget.ts`, `use-widget-eager-start.test.ts` + 파일 22 plan)에만 해당한다.
  - 제안: SUMMARY 집계 시 이 스코프 재정의를 반영할 것 — scope/architecture 등 다른 리뷰어도 같은 29개 파일을 "실제 변경"으로 오인해 무관한 지적을 냈을 가능성이 있다. 가능하면 `origin/main` 리베이스 후 diff 재생성을 권고(단, 이 PR 자체를 막을 사유는 아님 — 실 변경분엔 이 오염이 없다).

## 발견사항 — orchestrator 질의 5건

- **[INFO]** 질의 1 — `worldGenRef`/`bootGenRef` 두 축은 모순되지 않는다 (반증 시도, 실패)
  - 위치: `use-widget.ts:161`(`worldGenRef` 선언)·`214`(`bootGenRef` 선언)·`241`(`isStale`)·`261-270`(`beginBootAttempt`/`isAttemptStale`)·`282-316`(`teardownSession`)·`809-825`(`establishConfig`)
  - 상세: 두 축은 **트리거 도메인이 겹치지 않는다** — world 는 `teardownSession`(config 확립 후)·`start()`·언마운트 3곳에서만 bump, boot 는 `beginBootAttempt()`(=`applyConfig` 진입, 유효 필드 확인 후) 1곳에서만 bump. `isAttemptStale` 은 이 둘을 OR 로 묶는데(`worldGenRef.current !== attempt.world || bootGenRef.current !== attempt.boot`), 이 OR 가 "모순"을 만들려면 (a) 두 축이 같은 이벤트에 대해 반대 신호를 내거나 (b) 한 축의 bump 가 다른 축이 지켜야 할 불변식을 깨야 하는데, 코드 전체(grep 완료 — 두 ref 를 쓰는 지점은 선언 포함 각 3곳/2곳뿐)에서 그런 지점을 찾지 못했다.
  - **교차 지점 하나를 특정해 검증**: `establishConfig`(`:809-825`) 의 리셋 소비 분기(`pendingResetRef.current` true 일 때)는 `apiRef.current.newChat()` 을 호출하고, 이는 `resetSessionRefs()`→`teardownSession()`을 거쳐 **world 를 bump 한다** — 즉 boot 축 코드(establishConfig)가 world 축에 부수효과를 낸다. 이것이 "같은 attempt 를 되물어 자기모순을 낳는지" 확인했다: `establishConfig(cfg) === "reset"` 이면 `applyConfig` 는 **그 자리에서 즉시 return**하고(`:846`), 이후 그 attempt 자신의 코드에는 `await` 도 재검증도 없다 — 즉 이 world bump 는 **호출한 자기 자신을 다시 검사하지 않으므로** 자기모순이 발생할 수 없다. 리셋을 소비하지 않는 경로(`"continue"`)에서는 world 를 건드리지 않는다. 두 케이스 모두 안전하다.
  - **왜 합치지 않는 것이 옳은가**: JSDoc(`:207-209`) 이 명시하듯 "부팅 시도는 세계를 바꾸지 않는다" — 실제로 `teardownSession` 의 pre-boot no-op 분기(`:305-308`)가 **의도적으로** world 를 안 올리는 이유가, 합쳤을 때 "부팅 중 `applyConfig` 를 죽여 패널이 영원히 안 열리는" 회귀를 냈기 때문이라고 코드 자신이 기록한다(구 `cancelled` 플래그 시절 우연히 안전했던 경로를 세대 단일화가 깨뜨린 사례, `08_29_33` CRITICAL#1). 두 축을 물리적으로 분리해 둔 지금 구조가 그 회귀를 구조적으로 막는다.
  - 결론: 질의 1 이 우려한 "모순·겹침"은 찾지 못했다 — 두 축은 트리거가 disjoint 하고, 유일한 교차 지점(establishConfig 의 world bump)은 같은 attempt 의 후행 코드가 없어 자기참조 문제가 원천적으로 발생하지 않는다.

- **[INFO]** 질의 2 — `applyConfig` 만 두 축, `start`/`sendCommand`/`seedWaitingFromStatus` 는 world 축만 — 비대칭은 정당함. `start()` 도 boot 축이 필요한 시나리오는 못 찾음(단, 인접 시나리오 하나는 §106 과 별개 축으로 이미 알려진 gap, 아래 참고)
  - 위치: `use-widget.ts:445-499`(`seedWaitingFromStatus`, world 만)·`530-577`(`start`, world 만)·`579-604`(`sendCommand`, world 만)
  - 상세: 이 세 함수는 전부 **config·client·session 이 이미 확립된 뒤**에만 실행 가능하다(`start` 는 `if (!cfg || !client) return`, `sendCommand` 는 `if (!session || !client) return`). "boot generation" 이라는 개념은 `applyConfig` 가 config 를 확립하기 **이전** 구간(embed-config 왕복 중, 어느 `wc:boot` 이 이길지 아직 안 정해진 구간)에만 의미가 있고, 이 세 함수는 정의상 그 구간이 끝난 뒤에만 호출되므로 boot 축을 참조할 대상 자체가 없다.
  - `start()` 가 boot 축을 봐야 하는 경우를 직접 구성해 반증 시도: 재전송 `wc:boot`(cfg2, re-config)이 embed-config 왕복 중일 때 사용자가 패널을 열어 `open()`→`start()` 가 먼저 실행되면, `start()` 는 `configRef.current` 의 **그 순간 값**(아직 cfg1)을 스냅샷해 webhook POST 를 보낸다 — cfg2 가 나중에 확립돼도 이미 나간 POST 의 profile 은 소급되지 않는다. 이것은 **boot 축 부재 때문이 아니라**, `updateProfile`(`:776-782`)의 JSDoc 이 이미 명문화한 기존 계약("진행 중 execution 의 기전송 profile 은 소급 변경 불가 — 다음 시작에만 반영")과 정확히 같은 성격이다. `start()` 가 boot 축을 봤다 해도 "지금 이 순간 config 가 안정된 것으로 확정됐는가"를 판정할 수 없다(그건 여전히 미래의 `applyConfig` resolve 순서에 달려 있다) — 즉 boot 축을 추가해도 이 스냅샷 지연 자체는 해소되지 않는다. 비대칭은 정당하다.
  - 제안: 없음(판단 확인됨). 코드 변경 불필요.

- **[INFO]** 질의 3 — `!cfg.apiBase` 조기 return 이 세대를 올리지 않는 판단은 정확함. 올렸을 때의 구체적 파국 시나리오까지 확인
  - 위치: `use-widget.ts:830`(조기 return) · `835`(`beginBootAttempt` 호출, 조기 return **뒤**)
  - 상세: 만약 조기 return 이 `beginBootAttempt()` **이전**으로 옮겨지지 않고 세대를 올리는 쪽으로 바뀐다면 — 정상 진행 중인 attempt A(boot=1, `isEmbedAllowed` await 중)가 있을 때, 필드 누락된 malformed `wc:boot`(예: `configFromQuery` fallback 실패, 또는 host 초기화 버그로 인한 불완전 payload)가 도착하면 그 즉시(동기 구간, await 없이) `beginBootAttempt()` 호출 → `bootGenRef.current`→2 → 곧바로 return. 이제 A 가 나중에 `isEmbedAllowed` 를 resolve 해도 `isAttemptStale` 에서 `bootGenRef.current(2) !== attempt.boot(1)` → 영구 stale. **이 malformed "시도"는 이후 아무 것도 하지 않으므로**(config 확립도, 세션 복원도, 추가 wc:boot 트리거도 없음) 후속 legit `wc:boot` 이 다시 오지 않는 한(직접 로드/샘플 시나리오처럼 wc:boot 재전송이 없는 경우가 실사용의 대다수) **위젯이 영구적으로 config 를 확립하지 못해 패널이 열리지 않는 파국**이 된다 — 이는 이 파일이 반복 경계해 온 "죽은 소유자가 살아있는 시도를 밀어낸다"류 회귀와 정확히 같은 형태다. 현재 코드는 조기 return 을 `beginBootAttempt()` **앞**에 둬 이 malformed 요청이 `bootGenRef`/`worldGenRef` 어느 쪽과도 상호작용하지 않게 막았다 — 판단이 정확하다.
  - 제안: 없음(판단 확인됨).

- **[INFO]** 질의 4 — 3개 이상 겹치는 부팅과 모든 resolve 순서 조합에서 §106 이 성립함(대수적 증명 + N=2 mutation 테스트로 뒷받침)
  - 위치: `use-widget.ts:214`(`bootGenRef` 선언, 파일 전체에서 증가만 함 — 감소·리셋 지점 0건, grep 재확인)·`261-264`(`beginBootAttempt`)·`266-270`(`isAttemptStale`)
  - 상세(증명): `bootGenRef.current` 는 `beginBootAttempt()` 에서만 `++` 되고 그 외 어디서도 감소·초기화되지 않는다(마운트 생애주기 동안 단조증가). N 개의 유효한(malformed 아닌) 시도가 순서대로 진입하면 `attempt_k.boot = k`(k=1..N) 이고 전원 진입 완료 시점의 `bootGenRef.current = N`. `isAttemptStale` 은 **호출 시점의 현재값과 비교**하므로, k < N 인 모든 attempt 는 **attempt N 이 진입한 순간부터 영구적으로** `bootGenRef.current(N) !== attempt_k.boot(k)` 가 성립해 이후 언제 resolve 하든(가장 나중에 resolve 해도) stale 로 판정된다. 즉 **"누가 이길 수 있는가"는 오직 진입 순서로 결정되고 resolve 순서와는 무관** — resolve 순서는 N!(순열) 가지가 있어도 "이길 자격이 있는 attempt" 후보는 언제나 정확히 1개(마지막 진입자)로 좁혀진다.
  - 마지막 진입자가 실제로 이기는지는 그 자신의 `isEmbedAllowed`/world 상태에 달려 있다(BLOCKED 이거나 world-stale 이면 아무도 config 를 적용 못 함) — 이것이 §106 "**마지막** wc:boot 의 config 를 적용"의 정확한 의미론이다(마지막 것이 거부되면 그보다 이전 것이 대신 적용되어서는 안 된다 — 그렇지 않으면 다시 "resolve 순서가 승자를 정하는" 구조로 퇴화). `use-widget-eager-start.test.ts:2275`(혼합순서, 자연순)·`:2359`(혼합순서, 역순 — 14_30_15 가 권고한 "5번째 테스트"가 실제로 커밋됨)·`:2449`(§106, resolve 역전) 세 테스트가 이 두 성질(마지막 진입자만 승자 후보 / 승자가 거부되면 아무도 적용 안 됨)을 N=2 로 mutation-검증(plan §A-5: boot 축 무력화 4건 실패·비대칭 각 지점 1·3건 실패·세대 미증가 4건 실패)한다.
  - 진입 순서가 도착 순서와 일치한다는 전제(위 "검증 방법" 참조: `host-bridge.ts` 의 `onBoot` 콜백은 `message` 이벤트당 1회, 매크로태스크 직렬 처리 + 동일 source→target FIFO)도 확인했다 — 두 개의 `applyConfig` 호출이 "동시에" 진입해 `beginBootAttempt()` 호출 순서가 뒤바뀌는 시나리오는 브라우저 이벤트 루프 모델상 존재하지 않는다.
  - N=3 이상은 위 증명이 그대로 귀납적으로 확장되며(추가 진입자마다 이전 "최신"이 즉시 밀려남), 새로운 실패 축을 만들 여지가 없다 — 13_03_59 가 구설계에서 실측으로 반증했던 "먼저 진입했지만 아직 살아있는 시도"류 문제는, 그 설계가 **별도 플래그(`pendingResetRef`)를 조건부로 지우는 부수효과**를 가졌기 때문에 발생했던 것이고, 이번 설계는 `isAttemptStale` 자신에게만 쓰이는 **자기완결적 비교**라 그 실패 형태가 구조적으로 재현될 수 없다.
  - 제안(방어적 제안, 필수 아님): 현재 N=2 조합 테스트가 이미 충분한 수학적 근거를 대수적으로 뒷받침하지만, 이 파일의 반복된 회귀 이력(4라운드)을 감안하면 N=3 겹침(예: 진입 1→2→3, resolve 3→1→2 등 진입·resolve 모두 뒤섞인 조합) 을 6번째 regression 테스트로 추가해 "진입 순서만이 유효하다"는 불변식을 living documentation 으로 고정해두는 것을 권고한다. 이는 안전성 결함이 아니라 회귀 방지 견고성 제안이다.

- **[INFO]** 질의 5 — `establishConfig` 비-async 추출은 런타임 동시성 동작을 바꾸지 않으며, 오직 "강제 메커니즘"만 규율→구조로 전환한다
  - 위치: `use-widget.ts:809-825`(`establishConfig`)·`843-846`(호출부)
  - 상세: JS 에서 일반(비-async) 함수 호출은 그 자체로 yield point 가 아니다 — `establishConfig(cfg)` 를 `applyConfig` 내부에서 호출하는 것은 그 로직을 인라인해 둔 것과 **실행 순서·원자성 면에서 100% 동치**다. `establishConfig` 내부에서 호출하는 `apiRef.current.newChat()` 도 완전히 동기적으로 반환함을 확인했다(`newChat`→`resetSessionRefs`→`teardownSession` 전부 비동기 없음; `void client.interact(...)`·`void start()` 는 fire-and-forget 이라 `newChat()` 자체의 반환을 막지 않음). 따라서 이 추출이 새로 여는 race window 는 없다.
  - 진짜 가치는 **컴파일러 강제**다: `establishConfig` 가 `async` 가 아니므로 내부에 `await` 을 쓰면 `error TS1308` 로 빌드가 막힌다(plan §B 진행기록에서 실측 확인됨: 인라인 시절엔 이 구간에 `await Promise.resolve()` 를 삽입해도 44/44, 나아가 A 도입 후에도 379/379 전부 통과 — "이 구간엔 await 이 없다"는 게 테스트로 전혀 고정되지 않는 성질이었다). 이 파일의 반복된 실패 패턴("주석은 메커니즘이 아니다" — 이번 리뷰의 다른 diff 파일들, 예: `review_guard.py` 의 "fail loudly" 주석 부정확 사례에서도 동일 교훈이 반복됨, 스코프 노트 참고)에 정확히 대응하는 구조적 해법이다.
  - 부수 확인: `establishConfig` 는 `useCallback(fn, [])` 로 고정되고 클로저가 참조하는 것은 전부 ref(`configRef`/`clientRef`/`pendingResetRef`/`apiRef`)와 `setConfig`(stable state setter)뿐이라 依존성 배열이 `[]` 라도 stale closure 위험이 없다. `establishConfig` 자신이 외부(예: `apiRef`)에 노출되지 않아 재진입 경로도 없다.
  - 제안: 없음(추출이 안전함을 확인). 코드 변경 불필요.

## 그 외 확인 사항 (질의 5건 외, 독립적으로 발견해 반증 시도)

- **[INFO]** `widget-state.ts` 의 `RESTORED`/`BOOTED` `ended` 가드 확대는 async 레이스 자체를 막는 게 아니라 데이터 위생 결함(ERROR 가 `teardownSession` 을 안 거치는 유일한 종료 경로)의 이펙트를 리듀서 단에서 방어하는 것 — 새 동시성 리스크 없음
  - 위치: `widget-state.ts:125-137`(`RESTORED`) · `138-143`(`BOOTED`) · 기존 `144-169`(`WAITING`, 대칭 패턴)
  - 상세: 이 두 가드가 막는 실제 근본 원인은 "두 비동기 작업이 경합"하는 고전적 race 가 아니라, `ERROR` 액션(`use-widget.ts` 의 `start()` catch 블록, dispatch 만 하고 `finalizeEnded`/`teardownSession` 을 거치지 않음)이 `phase: "ended"` 로 전이하면서도 `sessionStorage` 를 지우지 않는 **상태-정리 누락**이다. 그 잔존 세션이 **완전히 정상적인(=non-stale) 후속** `wc:boot` 재전송의 복원 분기에서 `loadSession()` 으로 다시 발견돼 `RESTORED` 를 트리거하는 것이므로, 이 경로는 async staleness 가드(`isAttemptStale`)로는 막을 수 없는 종류다(그 attempt 자체가 stale 하지 않다 — 정당하게 이긴 최신 attempt이기 때문). 리듀서 레벨 가드(defense-in-depth, `WAITING` 의 기존 패턴과 동형)로 막는 것이 올바른 계층이다. 두 가드 모두 단순 상태 비교(`state.phase === "ended"`)이고 비동기·공유자원 접근이 없어 그 자체로는 concurrency 표면이 없다.
  - 이 발견은 "동시성 결함"이 아니라 "async 경로(재전송)를 통해 노출되는 비-동시성 결함"이라는 점을 명확히 하기 위한 것 — SUMMARY 집계 시 다른 리뷰어(side_effect/requirement)가 이미 이 결함의 근본 원인(ERROR 의 teardown 누락)을 다루고 있을 가능성이 높다.
  - 제안: 없음(concurrency 관점에서 조치 불요).

- **[INFO]** 사전 존재·미악화 엣지 케이스 — 확립된 세션에 대한 `resetSession` 이 진행 중인 재구성(reconfig) `wc:boot` 을 world 축으로 밀어내는 상호작용(§106 과 별개 인터랙션, 이번 diff 로 신설·악화되지 않음)
  - 위치: `use-widget.ts:693-716`(`newChat`, B-1 확립 세션발 분기)·`530-539`(`start`, `gen = ++worldGenRef.current`)
  - 상세: 세션이 이미 확립된 상태에서 host 가 재구성 `wc:boot`(cfg2, 예: 외형 갱신)을 보내 `applyConfig(cfg2)` 가 `isEmbedAllowed` await 중일 때, 같은 host 가 `resetSession` 을 보내면 `newChat()` 이 (booting-coalesce 조건이 거짓이므로) `resetSessionRefs()`→`teardownSession()`(world bump)→`start()`(world 재차 bump, **아직 확립 안 된 cfg2 대신 확립돼 있던 cfg1 로 새 execution 시작**)를 수행한다. 뒤이어 cfg2 의 `applyConfig` 가 resolve 하면 `isAttemptStale`(world 축)에 걸려 cfg2 는 결코 `establishConfig` 에 도달하지 못하고 조용히 폐기된다 — 형식적으로는 cfg2 가 "마지막 wc:boot" 이었으므로 §106 의 문언과 어긋나는 결과다.
  - 그러나 이는 **boot 축·world 축의 조합이 만든 새 문제가 아니다**: `bootGenRef` 유무와 무관하게, 종전(이 PR 이전)에도 `applyConfig` 는 `worldGenRef` 만으로 staleness 를 판정했고 동일한 재구성 attempt 는 동일하게 world-stale 로 폐기됐을 것이다(world bump 는 boot 축과 독립적으로 발생). 즉 이번 diff 가 만들거나 악화시킨 gap 이 아니라 `resetSession`↔재구성-`wc:boot` 사이의 **기존에도 존재했던 별개 인터랙션**이다. 실사용 도달 경로도 14_30_15 가 확인한 것과 동일하게 관리자 라이브 미리보기 1인 조작으로 한정되고(§106 재전송의 유일한 경로), 손상은 "이번 라운드의 외형 갱신 등 config 변경 1건이 반영 안 됨"(재시도로 복구 가능)에 그친다.
  - 제안: 이번 PR 의 결함으로 취급할 필요는 없음. `plan/in-progress/webchat-boot-single-flight.md` 나 후속 followups 문서에 이미 추적 중인 "cross-endpoint 리셋 번짐"(14_30_15 W2/INFO) 항목과 유사한 성격이므로, 별도 항목으로 명시 추가할지는 developer 판단에 맡긴다 — concurrency 관점에서 이번 PR 을 막을 사유는 아니다.

## 요약

이번 PR 이 실제로 변경한 동시성 관련 코드는 `codebase/channel-web-chat/src/widget/use-widget.ts`(`beginBootAttempt`/`isAttemptStale`/`establishConfig` 신설 + `applyConfig` 재배선)와 `codebase/channel-web-chat/src/lib/widget-state.ts`(`RESTORED`/`BOOTED` 종료-가드 확대) 뿐이며, prompt_file 의 나머지 29개 파일은 이 브랜치가 `14bc86a53` 이후 리베이스되지 않은 상태에서 그 사이 origin/main 에 병합된 무관한 PR(#966, report-paths-shared)이 반대 방향 diff 로 섞여 들어간 아티팩트임을 git 실측으로 확인했다(스코프 노트). 실제 변경분에 대해 orchestrator 의 5개 질의를 모두 반증 시도했으나 실패했다 — 오히려 각 판단이 사려 깊게 옳음을 확인했다: (1) `worldGenRef`/`bootGenRef` 는 트리거 도메인이 겹치지 않고 유일한 교차 지점(`establishConfig` 의 리셋-소비발 world bump)은 같은 attempt 의 후행 코드가 없어 자기모순이 불가능하다, (2) `start`/`sendCommand`/`seedWaitingFromStatus` 가 boot 축을 안 보는 비대칭은 이 세 함수가 정의상 config 확립 **이후**에만 실행되어 boot 축이 참조할 대상이 없기 때문에 정당하다, (3) `!cfg.apiBase` 조기 return 이 세대를 안 올리는 판단은 올렸을 경우 "패널이 영구적으로 안 열리는" 구체적 파국까지 추적해 확인했다, (4) `bootGenRef` 가 단조증가 카운터 + "현재값과 비교"라는 성질로부터 N≥2 겹침에서 오직 최종 진입자만 승자 후보가 됨을 대수적으로 증명했고 이는 resolve 순서·N 크기와 무관해 N=3 이상으로 자연 확장된다(N=2 mutation 테스트 6종이 이를 뒷받침), (5) `establishConfig` 비-async 추출은 함수 호출 자체가 yield point 가 아니므로 런타임 동작을 전혀 바꾸지 않고 "구간에 await 없음"이라는, 종전엔 주석으로만 존재하며 테스트로도 고정되지 않던 불변식을 컴파일러 강제로 전환한다. 추가로 독립 조사한 두 항목 — widget-state.ts 가드가 막는 것은 async race 가 아니라 ERROR 의 teardown 누락이라는 점, 그리고 확립 세션에 대한 resetSession 이 진행 중인 재구성 wc:boot 를 world 축으로 밀어내는 인터랙션 — 모두 신규 결함이 아니거나(전자) 이번 diff 로 신설·악화되지 않는 기존 gap(후자)임을 확인했다. 이 파일의 4라운드 회귀 이력에 비춰 이례적으로, 이번 라운드는 **국소 패치가 아니라 (a) 자기완결적 단조 카운터로 전환 + (b) 컴파일러 강제 추출**이라는 구조적 접근을 택했고, 그 구조 자체가 과거 실패 패턴("한 호출부는 재검증, 다른 곳은 누락" 비대칭 / "폐기 로직의 조건부 부수효과")이 재발할 여지를 만들지 않는다는 것이 이번 독립 검증의 핵심 결론이다.

## 위험도

LOW
