# 동시성(Concurrency) 리뷰 — webchat-boot-single-flight (03_04_45, `94b66b212` 테스트 전용 + dep 1줄 라운드)

> 지시받은 검증 범위: 이번 라운드는 **프로덕션 런타임 로직 무변경**(테스트 커버리지 갭 대칭 고정
> 헬퍼 + `start()` useCallback dep 1줄)이라는 전제를 세 항목으로 독립 검증한다 — (1) dep 추가가
> 런타임 동작을 바꾸지 않는가, (2) 신규 companion 테스트가 실제로 `start()` 게이트 경로를
> 재현하는가, (3) 직전 라운드(`02_25_54`)에 수용 처리한 "3-way 순간 표면 콘텐츠 race" 가 이번
> 변경으로 달라지지 않았는가. `git show 94b66b212` 로 실제 코드를 직접 확인하고, 격리 detached
> worktree 에서 mutation 재현 + eslint 전후 대조로 실측했다.

## 방법 — 격리 worktree

`git worktree add --detach .../scratchpad/concurrency-review-wt 94b66b21270b05bba4015e78d964371bf053abb8`
(공유 worktree `webchat-boot-single-flight-8c92b4` 와 별도). `node_modules` 는 공유 worktree 루트를
심링크, `codebase/channel-web-chat/node_modules` 는 `rsync -a` 로 실제 복사(pnpm isolated 구조 —
개별 패키지 항목은 상대경로 심링크 `../../../node_modules/.pnpm/...` 라 이 조합으로 해소됨, memory
"Worktree node_modules bootstrap" 관례와 일치). 검증 후 `git worktree remove --force` 로 제거,
`git status --porcelain`(공유 worktree) 로 자기 리뷰 산출물 디렉터리 외 무변경 확인 완료.

## 발견사항

- **[INFO] (검증 1) `start()` useCallback deps 에 `sessionEstablished` 추가는 런타임 동작을 바꾸지
  않는다 — eslint 경고 해소 목적의 순수 lint-only fix, 코드·실측 이중 확인**
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:685`(`start` useCallback deps 배열),
    `:325`(`sessionEstablished = useCallback(() => streamRef.current !== null, [])`).
  - 상세: `git show 94b66b212 -- codebase/channel-web-chat/src/widget/use-widget.ts` 로 확인한 이번
    커밋의 프로덕션 코드 diff 는 정확히 1줄(`[openStream, persist, seedWaitingFromStatus,
    scheduleRefresh, isStale]` → 끝에 `sessionEstablished` 추가)뿐이다. `sessionEstablished` 자신의
    `useCallback` 두 번째 인자가 `[]`(빈 배열)이므로 이 콜백의 참조 identity 는 컴포넌트 마운트
    생애주기 동안 **한 번도 바뀌지 않는다** — React 의 `useCallback` 재생성 판정(`Object.is` 비교)은
    참조가 실제로 달라질 때만 발동하므로, 참조가 불변인 값을 다른 `useCallback` 의 deps 에 추가해도
    그 `useCallback`(`start`)의 재생성 빈도·타이밍에 어떠한 영향도 없다. `start` 는 여전히
    `openStream`/`persist`/`seedWaitingFromStatus`/`scheduleRefresh`/`isStale` 5개의 실제 변경
    가능한 의존성에 의해서만 재생성된다(그마저도 이들도 각각 안정적인 콜백일 가능성이 높지만 이번
    검증 범위 밖).
  - 실측(격리 worktree, eslint 9.39.4 직접 실행): (a) 현재 커밋 상태(dep 포함) → `eslint
    use-widget.ts` **0 문제**. (b) dep 배열에서 `sessionEstablished` 만 제거한 시뮬레이션(원본
    fix 이전 상태 재현) → 정확히 `react-hooks/exhaustive-deps` 경고 1건
    (`685:6 warning React Hook useCallback has a missing dependency: 'sessionEstablished'.`)
    발생. 이는 커밋 메시지의 "새로 추가한 `sessionEstablished()` 호출이 deps 배열에 누락 → 신규
    ESLint 경고 → deps 에 추가 → eslint 클린" 서술을 코드·툴 양쪽에서 독립 재현한 것이다. 원복 후
    `diff` 로 byte-identical 확인.
  - 전체 스위트: 격리 worktree `vitest run`(전체) → **394 passed** — 커밋 메시지 수치와 일치.
  - 결론: 이 dep 추가는 "무해한 lint 경고 해소"이며 재생성 유발이 아니다 — 호출자 질문에 **그렇다,
    무해하다**로 답한다.
  - 제안: 없음(확인 목적).

- **[INFO] (검증 2) 신규 companion 테스트("재전송 먼저 — start() 게이트")는 실제로 `start()` 의
  openStream 직전 게이트(:673)를 재현한다 — 양방향 mutation 으로 비대칭 정밀도 독립 확인**
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:673`(`start()` 게이트,
    `if (sessionEstablished()) return;` → `openStream(session, "0")`), `:1018`(`applyConfig` 복원
    분기 게이트, 동일 패턴 → `openStream(saved, "0")`).
    `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts:3402`
    (`raceStartVsResendSingleStream(resendResolvesFirst)` 공용 헬퍼), `:3479`(기존 테스트, `false`
    = C(start) 먼저 resolve), `:3485`(신규 companion, `true` = D(재전송) 먼저 resolve).
  - 시나리오 확인: `boot()` → `start()` 진입 → webhook 202 → `persist()`(세션을 storage 에 저장) →
    자기 `getStatus` C 발신. 이어서 재전송(`boot()` 재호출) → 이 시점 `sessionEstablished()` 는
    아직 `false`(스트림 미확립)이므로 `applyConfig` 는 `loadSession()` 으로 방금 저장된 세션을
    읽어 **복원 분기**에 진입해 자기 `getStatus` D 를 발신. `raceStartVsResendSingleStream(true)`
    는 `statusResolvers[1]`(D)을 `statusResolvers[0]`(C)보다 **먼저** 같은 동기 블록에서
    resolve 시킨 뒤 `flushAsync()` 한다 — 이 경우 D 의 continuation 이 먼저 seed 게이트(:568)와
    `applyConfig` checkpoint 2(:1012)를 통과해 `:1018` 게이트에서도 아직 `sessionEstablished()===false`
    라 통과, `openStream()` 을 먼저 호출한다. 뒤이어 C 의 continuation 이 `:673` 에 도달하는
    시점엔 D 가 이미 스트림을 열어 `sessionEstablished()===true` → `start()` 가 여기서 조기
    반환한다. 즉 "재전송이 먼저 열고 `start()` 가 자기 게이트에 막힌다"는 커밋 메시지 서술과
    정확히 일치하는 경로다.
  - **mutation A(격리 worktree, `:673` 게이트만 주석 처리)** → `vitest run
    use-widget-eager-start.test.ts` 결과 **정확히 companion 테스트 1건만 실패**
    (`두 복원 seed 가 같은 flush 에서 resolve — 재전송 먼저 열려도 하나만 생성된다 (start() 게이트)`,
    `expected 2 to be 1`), 기존 테스트(C 먼저)를 포함한 나머지 59건은 무영향. 원복 확인.
  - **mutation B(:1018 게이트만 주석 처리)** → **정확히 기존 테스트 1건만 실패**
    (`두 복원 seed 가 같은 flush 에서 resolve 해도 EventSource 는 하나만 생성된다 (start 먼저 —
    applyConfig 게이트)`, `expected 2 to be 1`), companion 테스트를 포함한 나머지 59건은 무영향.
    원복 확인.
  - 이 양방향 정밀도(mutation A → companion 만 죽음, mutation B → 기존만 죽음, 교차 오염 없음)는
    두 테스트가 각각 정확히 자신이 겨냥한 게이트에만 결합돼 있고, 어느 쪽도 우연히 통과하는
    vacuous 테스트가 아님을 실증한다 — 커밋 메시지의 "mutation 개별 검증: start 게이트만 제거 →
    companion 만 실패 / applyConfig 게이트만 제거 → 기존만 실패" 주장을 별도 세션에서 독립
    재현했다.
  - 결론: 호출자 질문에 **그렇다, 이 시나리오에서 재전송이 먼저 openStream 하고 start 가 게이트에
    막히는 것이 맞고, companion 테스트는 그 경로를 정확히·유일하게 재현한다**로 답한다.
  - 제안: 없음(확인 목적).

- **[INFO] (검증 3) 직전 라운드(`02_25_54`)가 WARNING 으로 수용한 "3-way 이상 겹침에서 boot 축
  pruning 대상 재전송의 콘텐츠가 순간적으로 표면을 차지할 수 있다" 는 이번 변경으로 달라지지
  않았다 — 해당 코드 경로 자체가 이번 diff 범위 밖**
  - 위치: `use-widget.ts:564-568`(`seedWaitingFromStatus` 내부 WAITING dispatch 게이트,
    `sessionEstablished()` 만 보고 boot 축은 의도적으로 안 봄) · `:990-1018`(`applyConfig` 의
    seed→checkpoint2 순서, seed 의 `dispatch` 가 boot 축 checkpoint 2 보다 먼저 실행되는 구조) —
    두 구간 모두 `git show 94b66b212 -- use-widget.ts` 의 diff hunk(`682,7 → 682,7`, `start()`
    deps 배열 1줄)에 포함되지 않는다.
  - 상세: 이번 커밋이 건드린 프로덕션 코드는 `start()` 의 deps 배열 1줄이 유일하다(검증 1). 3-way
    표면 콘텐츠 race 의 근본 원인은 `seedWaitingFromStatus` 의 WAITING dispatch 가
    `sessionEstablished()`(스트림 축)만 보고 boot 축(`isAttemptStale`)을 보지 않는 **설계**(JSDoc
    표, `:504-507`)와, `applyConfig` 가 seed(내부에서 dispatch)를 boot 축 checkpoint 2(`:1012`)
    **보다 먼저** await 하는 **순서**에 있다 — 두 지점 다 이번 diff 의 어떤 hunk 도 스치지 않았다.
    신규 companion 테스트도 순수 2-way(C vs D, 겹치는 시도가 정확히 둘)만 파라미터화한 것이라
    3-way(겹치는 재전송이 셋 이상) 시나리오를 새로 도입하거나 건드리지 않는다 — 헬퍼
    `raceStartVsResendSingleStream` 자체가 정확히 두 개의 `getStatus` 응답(C, D)만 다루도록
    구조화돼 있다(`:3402` 시그니처, `statusResolvers` 배열 길이 2 로 고정된 흐름).
  - 결론: 호출자 질문에 **그렇다, 무영향이 맞다** — `02_25_54` WARNING(스트림 개수와 독립된 표면
    콘텐츠 잔여 창, self-healing, plan 잔여 항목으로 이월)은 이번 라운드의 테스트/dep 변경과
    직교하며 재평가가 필요한 새 정보가 없다. 재확인만 하고 새 WARNING 으로 재기록하지 않는다(이미
    `02_25_54/concurrency.md` 에 추적 중, 중복 방지).
  - 제안: 없음(이월 항목 그대로 유지, 이번 라운드 조치 불필요).

- **[INFO] 데드락·리소스 풀링·이벤트 루프 블로킹 — 해당 없음, 이번 diff 범위 재확인**
  - 위치: 파일 전체(`use-widget.ts` diff 1줄, `use-widget-eager-start.test.ts` diff — 헬퍼 추출 +
    테스트 1건 추가).
  - 상세: 프로덕션 diff 는 O(1) 배열 리터럴 원소 추가뿐이라 블로킹·락·풀 인프라와 무관하다. 테스트
    diff 는 기존 43줄 mock 셋업을 `resendResolvesFirst: boolean` 파라미터를 받는 함수로 추출한
    리팩토링 + 그 함수를 호출하는 `it` 블록 2개(기존 1 + 신규 1)로, 비동기 제어 흐름(`act`/
    `flushAsync`/`waitFor`) 자체는 기존 패턴을 그대로 재사용한다 — 신규 await 누락·Promise 체인
    오류 없음(격리 worktree 전체 스위트 394 passed 로 확인).
  - 제안: 없음.

## 요약

이번 라운드(`94b66b212`)는 오케스트레이터 지시대로 프로덕션 런타임 로직을 바꾸지 않았다 — 실제 코드
diff 는 `start()` useCallback deps 배열에 `sessionEstablished` 1줄을 추가한 것이 전부다. `git show`
로 이를 직접 확인했고, `sessionEstablished` 자신이 `useCallback(..., [])`(deps 없음)라 참조가
마운트 생애주기 내내 불변이므로 이 추가는 `start` 의 재생성 시점·빈도에 어떤 영향도 주지 않는다 —
격리 worktree 에서 이 dep 을 제거한 시뮬레이션이 정확히 `react-hooks/exhaustive-deps` 경고 1건을
발생시키고 원복 시 클린해짐을 eslint 로 직접 재현해, 이 fix 가 "무해한 lint 경고 해소" 목적의
lint-only 변경임을 실증했다(런타임 동작 변화 없음). 신규 companion 테스트("재전송 먼저 —
`start()` 게이트")는 시나리오·mutation 양쪽으로 검증했다 — D(재전송)를 C(start 자신)보다 먼저
resolve 시키면 재전송의 `applyConfig` 복원 분기가 먼저 `openStream` 하고 `start()` 자신은 `:673`
게이트에서 막히는 경로가 실제로 트리거되며, 격리 worktree 에서 두 게이트(`:673`/`:1018`)를 각각
개별 주석 처리하는 양방향 mutation 이 정확히 대응하는 테스트 1건만 깨뜨리고(교차 오염 없음) 나머지
59건은 무영향임을 확인해 커밋의 "비대칭 커버리지 갭이 대칭으로 고정됐다" 주장을 독립 재현했다.
마지막으로, 직전 `02_25_54` 라운드가 WARNING(자가치유적, 이월 항목)으로 수용한 "3-way 이상 겹침의
순간 표면 콘텐츠 race" 는 그 근본 원인 코드(`seedWaitingFromStatus` 의 WAITING dispatch 게이트,
`applyConfig` 의 seed→checkpoint2 순서)가 이번 diff 의 유일한 hunk(deps 배열 1줄) 밖에 있고 신규
companion 테스트도 순수 2-way 시나리오만 다뤄, 이번 변경으로 달라지지 않았음을 재확인했다(새
WARNING 재기록 없이 이월 상태 유지). 신규 CRITICAL·WARNING 없음.

## 위험도

LOW — 이번 라운드는 테스트 전용 변경 + 런타임 무해 dep 1줄로, 세 검증 항목(dep 무해성·companion
테스트 유효성·3-way race 무영향) 모두 격리 worktree 의 직접 mutation/eslint 실측으로 확인됐고
반증되지 않았다. 신규 결함 없음. 유일한 개방 항목은 `02_25_54` 가 이미 plan 잔여로 이월한 3-way
표면 콘텐츠 WARNING 뿐이며 이번 라운드가 그 상태를 악화시키지 않았다.
