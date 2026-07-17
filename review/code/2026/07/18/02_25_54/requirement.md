# 요구사항(Requirement) 리뷰 — webchat-boot-single-flight (02_25_54, `77805bd32` 이중 EventSource fix 검증)

> 지시받은 핵심 검증 대상: 이중 EventSource fix(`77805bd32`, `openStream` 직전 `sessionEstablished()` 게이트
> 추가 — `01_44_21` 라운드가 발견한 MEDIUM 을 해소)가 (1) 원래 3개 결함(00_51_53 고착·23_58_23/18_39_11
> 되감기 2건)을 여전히 다 고치는지, (2) 새 회귀를 만들지 않는지, (3) spec §3(재전송)·§3.1 과 정합하는지.
> 이 자리가 4연속 발견(18_39_11→23_58_23→00_51_53→01_44_21)을 낸 지점이라는 지시에 따라 격리 detached
> worktree 에서 신규 시나리오를 실제 코드로 재현·mutation 테스트했다(작업 후 worktree 제거, 원본 worktree
> 무변경 확인 — `git status --short`/`git diff --stat` 모두 무출력).

## 사전 확인 — payload 한계

`prompt_file` 의 "리뷰 대상 파일" 목록은 `01_44_21` 라운드의 산출물(`meta.json`/`requirement.md`/`scope.md`/
`security.md`/...)이며, 이번 라운드가 실제로 검증해야 할 `77805bd32`(+ 후속 주석정리 `0020f9106`)의 코드
diff 자체는 payload 에 없다. 호출자 지시대로 `git log`/`git show 77805bd32`로 대상 커밋을 직접 확정해
분석했다 — payload 미신뢰, git history 직접 확인 원칙 적용. (`01_44_21` scope 리뷰어가 독립적으로 같은
payload-truncation 패턴을 지적한 바 있다 — 이번 라운드도 동일 계열의 한계.)

## 검증 방법

1. `git log --oneline -30` 로 커밋 그래프 확정: `cffee0d28`(00_51_53 fix, boot축→`sessionEstablished()`
   재설계) → `77805bd32`(01_44_21 fix, `openStream` 직전 짝 게이트 추가) → `0020f9106`(stale 주석 정리) →
   `262ef8e5b`(01_44_21 SUMMARY+RESOLUTION, 현재 HEAD). `git show 77805bd32` 전체 diff(2파일, 104+/3-)를
   직접 읽고 `use-widget.ts` 전문(1106행)을 trace-through 했다.
2. 원본 worktree에서 기존 회귀 스위트 실행: `tsc --noEmit` 클린, `vitest run` **393 passed**(22파일) —
   커밋 메시지 수치와 일치.
3. **격리 detached worktree**(`git worktree add --detach`, HEAD `262ef8e5b` pinned)에서 부트스트랩: 이번
   라운드는 `codebase/channel-web-chat/node_modules` 를 실카피했더니 내부 상대 심링크(`../../../node_modules/
   .pnpm/...`, pnpm isolated node-linker)가 새 worktree 루트에 `.pnpm` 저장소가 없어 깨졌다 — 저장소 루트
   `node_modules`(1.2GB, `.pnpm` 저장소 보유)를 심링크로 추가 연결해 해소(`channel-web-chat/node_modules`
   자체는 실카피 유지 — turbopack 이 최상위 심링크를 거부하는 기존 제약과 별개 문제). `vitest run`/`tsc`
   정상 동작 확인 후 진행.
4. 격리 worktree 에서 **Mutation A**(신규 게이트 2곳 — `use-widget.ts:673`(`start()`)·`:1018`
   (`applyConfig`) — 동시 제거) → 전체 스위트 중 **정확히 3건** 실패: 커밋이 신설한 회귀 테스트
   (`두 복원 seed 가 같은 flush 에서 resolve 해도 EventSource 는 하나만 생성된다`) + 내가 독립 작성한
   신규 PROBE 2건(아래 발견사항 참조) — 나머지 392건 무영향. 커밋 메시지의 "mutation: 게이트 2곳 제거 →
   정확히 double-stream 테스트만 실패" 주장을 재확인했다.
5. **비대칭 mutation**(게이트 1곳씩 개별 제거)으로 두 게이트가 각각 독립적으로 테스트에 의해 고정돼
   있는지 검증 — 아래 핵심 발견사항 참조(결과: 아니오, `start()` 쪽 게이트는 기존 스위트 어떤 테스트로도
   검출되지 않는다).
6. mutation 전부 원복 후 `git status --short`(신규 probe 파일 2개만 표시) + `git diff --stat`(무출력, 원본
   추적 파일 byte-identical) 확인, `npx tsc --noEmit`(exit 0) 재확인, worktree 제거.

## 발견사항

- **[INFO] (핵심 확인 1) 이중 EventSource 재현 시나리오가 실제로 해소됐다 — code trace + 기존 회귀테스트
  + mutation + 신규 PROBE 3건 모두 수렴**
  - 위치: `use-widget.ts:669-675`(`start()` 내 신규 게이트) · `:1014-1020`(`applyConfig` 복원분기 내
    신규 게이트) · `use-widget-eager-start.test.ts:3388-3471`(기존 회귀).
  - 상세: `01_44_21` 이 지적한 근본 원인(`await seedWaitingFromStatus` 반환과 호출부 `openStream` 사이의
    microtask 경계 — 겹친 두 seed 가 같은 flush 에서 resolve 하면 둘 다 seed 시점엔 스트림 미열림을 보고
    통과해 각자 `openStream` 을 부름)을 `openStream` 직전 `if (sessionEstablished()) return;` 로 막는다.
    기존 회귀 테스트(esCount=1 단언) 그린 확인 + 격리 worktree 에서 독립 작성한 PROBE 3건 — **3-way race**
    (`start()` + 겹친 재전송 2건, 뒤 재전송이 앞 재전송을 boot 세대로 추월)와 **divergent-content race**
    (스트림-미확립 창에서 두 seed 가 서로 다른 노드를 반환)까지 — 전부 `esCount===1`, 크래시 없음으로
    수렴 확인. Mutation A(게이트 2곳 동시 제거)로 정확히 이 3건 테스트(기존 1 + 신규 PROBE 2)만 깨지고
    나머지 392건 무영향임을 실측했다 — 커밋의 mutation 주장과 완전히 일치.
  - 제안: 없음.

- **[INFO] (핵심 확인 2) 원래의 3개 결함(00_51_53 고착·23_58_23/18_39_11 되감기 2건)이 여전히 차단된다
  — `77805bd32` 는 seed 게이트(`sessionEstablished()` in `seedWaitingFromStatus`) 자체를 건드리지 않는다**
  - 위치: `seedWaitingFromStatus:568`(`if (!opts?.allowWhileStreaming && sessionEstablished()) return
    "stale";` — 이번 diff 밖, `cffee0d28` 부터 무변경) · 전체 회귀 스위트.
  - 상세: `git show 77805bd32` 의 diff hunk 는 오직 `openStream` **직전**(seed 반환 **후**) 두 지점에만
    있다 — 되감기/고착 방어의 핵심인 seed 함수 내부 WAITING 게이트(3개 시나리오 모두 이 게이트가
    막는다)는 손대지 않았다. `vitest run` 393 passed 에 00_51_53/23_58_23/18_39_11 각 재현 회귀 테스트가
    포함돼 그린임을 원본 worktree 에서 재확인했다. 구조적으로 두 신규 게이트는 seed 게이트를
    **통과한 뒤**(WAITING 이미 dispatch 됐거나 시드할 게 없는 경우)에만 도달하는 **후행** 체크라
    seed 게이트의 판정에 개입할 수 없다.
  - 제안: 없음.

- **[INFO] (핵심 확인 3) spec 정합 — `2-sdk.md §3(재전송)`·`3-auth-session.md §3.1`·`1-widget-app.md §3.1
  (replay_unavailable)`·`§R9(single-flight coalesce)` 어디에도 "EventSource 개수"/"이중 스트림 방지"에 대한
  본문 규정이 없다 — spec 침묵 영역(fidelity 위반 아님)**
  - 위치: `spec/7-channel-web-chat/{1-widget-app,2-sdk,3-auth-session}.md` 전체 grep(`EventSource`·
    `이중 스트림`·`단일 스트림`·`single-flight`) — 매칭은 전부 `§R9`(booting 중 webhook POST 중복 방지,
    **웹훅 POST** 단일화이지 SSE 스트림 개수와는 무관한 별개 메커니즘)뿐.
  - 상세: `77805bd32` 가 막는 것은 "같은 세션에 대해 낭비성으로 두 번째 EventSource 가 생성"되는 구현
    세부이며, spec 은 재전송이 "config 만 갱신하고 활성 대화를 방해하지 않는다"는 **관찰 가능한 행동
    계약**만 규정한다(`01_44_21` requirement.md 핵심 확인 3 과 동일 결론 — 이번 라운드도 독립 재확인).
    `sessionEstablished()` 나 그 파생 게이트의 구체 메커니즘은 spec 이 의도적으로 열어둔 구현 디테일이다.
    project-planner 위임 불요.
  - 제안: 없음.

- **[WARNING] (신규 발견) 두 신규 게이트 중 `start()` 쪽(`use-widget.ts:673`)은 기존 회귀 스위트 어떤
  테스트로도 개별 검증되지 않는다 — 비대칭 mutation 으로 실증, 이 파일의 "비대칭 가드 누락" 반복
  실패 패턴과 동일 계열**
  - 위치: `use-widget.ts:673`(`start()` 게이트) vs `:1018`(`applyConfig` 게이트) ·
    `use-widget-eager-start.test.ts:3399-3471`(유일한 회귀 테스트, `statusResolvers[0]`(=`start()` 의
    자기 seed, C)를 항상 `statusResolvers[1]`(=재전송의 복원 seed, D)보다 **먼저** resolve 하는 고정
    순서만 검증).
  - 상세: 격리 worktree 에서 `use-widget.ts:673`(`start()` 쪽 게이트) **한 곳만** 주석 처리하고
    `:1018`(`applyConfig` 쪽)은 그대로 둔 채 전체 스위트를 실행 — **59+2 = 61건 전부 통과, 0건 실패**
    (기존 double-EventSource 회귀 테스트 포함). 원인: 그 테스트는 항상 C(=`start()` 자신) 가 먼저
    resolve 하도록 고정돼 있어 `start()` 가 경쟁에서 항상 "먼저 여는 쪽"이 된다 — `start()` 자신이
    스트림을 열 때 `sessionEstablished()` 는 어차피 `false`(자기가 첫 오프너이므로)이기 때문에, 그
    게이트가 있든 없든 `start()` 의 동작은 이 테스트 순서에서 바뀌지 않는다. 즉 이 테스트는 **오직
    `applyConfig` 쪽 게이트만** 실질적으로 행사한다.

    이것이 실제 위험인지 확인하기 위해 **순서를 뒤집은** 신규 PROBE(`재전송의 seed(D)가 start() 의
    seed(C)보다 먼저 resolve`)를 독립 작성해 검증했다 — 실서비스에서 이 순서 역전은 충분히 현실적이다
    (C·D 는 같은 `GET /api/external/executions/e1` 에 대한 **별개의 동시 HTTP 요청**이라, 요청 발행
    순서가 응답 도착 순서를 보장하지 않는다). 결과:
    - **`start()` 게이트만 제거한 상태**로 이 역전-순서 PROBE 실행 → **`esCount=2` 로 실패**(정확히
      `77805bd32` 가 고치려던 바로 그 이중 EventSource 재현).
    - **원복된(실제 배포될) 코드**로 동일 PROBE 실행 → `esCount=1` 통과.

    즉 `start()` 쪽 게이트는 **실제로 필요**하고 현재 코드에서는 **정상 동작**하지만, 그 필요성을
    독립적으로 증명하는 회귀 테스트가 스위트에 없다 — 커밋 메시지의 "mutation: 게이트 2곳 제거 → 정확히
    double-stream 테스트만 실패"는 **두 게이트를 함께** 제거했을 때의 결과만 확인했을 뿐, **개별** 게이트의
    load-bearing 여부는 검증하지 않았다. 이 파일 자신의 JSDoc(`use-widget.ts:260-265`)이 "비대칭 가드
    누락으로 CRITICAL 을 여러 번 냈다"고 명시하고, `plan/in-progress/webchat-boot-single-flight.md:149-161`
    의 §A-5 mutation 매트릭스가 정확히 "첫째 지점만 제거"/"둘째 지점만 제거"를 **별도 행**으로 요구하는
    이 프로젝트 자체의 확립된 관행인데, 이번 신규 대칭 게이트 쌍에는 그 규율이 적용되지 않았다. 지금
    당장의 기능 결함은 아니다(코드는 정확하다, 재확인됨) — 그러나 향후 리팩토링(예: 두 게이트를 헬퍼로
    통합하다 한쪽 조건을 놓치거나, merge 충돌 해소 중 한 줄만 유실)이 `start()` 쪽만 깨뜨려도 현재
    스위트는 **탐지하지 못한다** — 이 파일이 4라운드 연속 겪은 바로 그 실패 형태(비대칭 누락)가 코드가
    아니라 **테스트의 커버리지**에서 재발할 수 있는 잔여 창이다.
  - 제안: `use-widget-eager-start.test.ts` 의 기존 double-EventSource 테스트 옆에 순서를 뒤집은 대칭
    테스트를 추가 — `statusResolvers[1]`(재전송 D)을 `statusResolvers[0]`(start C)보다 먼저 resolve 하고
    `esCount===1` 을 단언(격리 worktree 에서 검증된 최소 스켈레톤):
    ```ts
    await act(async () => {
      statusResolvers[1](waitingAt("n1")); // D 먼저(재전송이 이긴다)
      statusResolvers[0](waitingAt("n1")); // C 나중(start() 자신 — 게이트가 없으면 여기서 또 연다)
      await flushAsync();
    });
    expect(esCount).toBe(1);
    ```
    이 한 건이면 `start()` 게이트가 독립적으로 mutation 에 잡힌다(격리 worktree 에서 직접 확인 완료).
    긴급도는 낮음(현재 코드는 정확함) — 다음 이 파일을 건드리는 라운드에서 함께 처리해도 무방.

- **[WARNING] (경미, 문서 정합) `plan/in-progress/webchat-boot-single-flight.md:388` 이 `77805bd32` 로
  반증된 주장을 아직 담고 있다 — 코드 JSDoc 은 이미 정정됐으나 plan 진행기록은 미정정**
  - 위치: `plan/in-progress/webchat-boot-single-flight.md:388`(`### 최종 불변식 — boot 축을 버리고
    sessionEstablished() 로` 문단, "후속 (23_58_23 · 00_51_53 처리 — 2026-07-18)" 섹션 — `cffee0d28` 당시
    작성).
  - 상세: 해당 줄은 "`openStream` 이 seed 반환 직후 동기 실행이라 이중 스트림도 원천 차단." 이라고
    적혀 있다. 이는 `77805bd32` 커밋 메시지가 명시적으로 "오판이었다(11번째 거울상)" 라고 정정한 바로
    그 주장이다(microtask 경계를 간과 — 실제로는 겹친 두 seed 가 같은 flush 에서 resolve 하면 이중
    EventSource 가 생성될 수 있었다, `01_44_21` 3인 재현). `use-widget.ts` 의 JSDoc(`:518-525`)은
    `77805bd32` 가 이미 정확히 정정했고, `CHANGELOG.md:9`(항목 3)는 애초에 이 특정 주장을 반복하지 않아
    무사하다 — 문제는 **plan 파일에만** 국한된다. 이 plan 은 라운드마다 "후속 (...)" 진행기록을 남기는
    확립된 자체 관행이 있는데(`plan/in-progress/webchat-boot-single-flight.md:206,272,292,298,306,354,362`
    등), `01_44_21`(이중 EventSource 발견) → `77805bd32`/`0020f9106`(fix) 사이클에 대응하는 진행기록
    항목이 아직 추가되지 않았다 — `git show --stat` 확인 결과 두 커밋 모두 `use-widget.ts`+테스트 파일만
    건드리고 plan 파일은 건드리지 않았다. 기능 결함은 아니며 `plan/` 은 `developer` 가 직접 쓸 수 있는
    영역(`spec/` 아님)이라 project-planner 위임도 불필요하다. 다만 이 발견사항 자체가 지적하는 위험(신규
    발견 WARNING)과 정확히 같은 종류의 위험을 문서 층위에서도 보여준다 — 반증된 불변식이 "권위 있는
    설계 기록"으로 남아있으면, 향후 이 파일을 다루는 누군가가 그 문장을 근거로 "게이트가 이미 원천
    차단하니 필요 없다"고 오판해 게이트를 제거할 유인이 생긴다.
  - 제안: plan 에 짧은 "후속 (01_44_21 처리 — 2026-07-18)" 항목 추가 — 이중 EventSource 발견·근본원인
    (microtask 경계)·`77805bd32` fix·`:388` 문장의 정정("동기 실행이라 원천 차단"은 틀렸고, 실제로는
    `openStream` 직전 명시적 재확인이 필요)을 1~2문단으로 기록. 급하지 않음, 다음 plan 갱신 시 처리 가능.

- **[INFO] (경미, 코드 위생) `77805bd32` 가 `start()` useCallback 의존성 배열에 `sessionEstablished` 를
  빠뜨렸다 — 기능적으로 무해하나 신규 ESLint 경고**
  - 위치: `use-widget.ts:673`(신규 `sessionEstablished()` 참조) · `:685`(`start` useCallback 닫는
    의존성 배열 `[openStream, persist, seedWaitingFromStatus, scheduleRefresh, isStale]`).
  - 상세: `npx eslint src/widget/use-widget.ts src/widget/use-widget-eager-start.test.ts` 실행 결과
    `react-hooks/exhaustive-deps`: "Hook useCallback has a missing dependency: 'sessionEstablished'" 경고
    1건(exit code 0 — `lint` 스크립트는 여전히 PASS, `RESOLUTION.md` 의 "lint: PASS" 주장과 모순 아님).
    `sessionEstablished` 는 `77805bd32` 이전엔 `start()` 본문에서 참조된 적이 없어(그 전엔
    `seedWaitingFromStatus` 내부에서만 쓰였다) 이 경고는 이 커밋이 새로 만든 것이다. `applyConfig`
    쪽(`:1018`)은 `useEffect(() => {...}, [])` 내부 정의라 이미 파일 최하단(`:1084`)의 블랭킷
    `eslint-disable-next-line react-hooks/exhaustive-deps` 로 가려져 별도 경고가 뜨지 않는다. **기능
    영향 없음** — `sessionEstablished` 자체가 `useCallback(() => streamRef.current !== null, [])` 로
    빈 의존성 배열을 가져 컴포넌트 생명주기 동안 참조가 절대 바뀌지 않으므로(`seedWaitingFromStatus` 의
    `:598` 의존성 배열엔 이미 정상적으로 포함돼 있어 그쪽은 이 문제가 없다), stale closure 로 이어질 수
    없다. 다만 이 파일 자신이 "가드는 규율이 아니라 구조여야 한다" 는 철학을 반복 명시하는데(`:927-929`
    등), 정적 분석이 잡아주는 경고를 방치하는 것은 그 철학과 결이 어긋난다.
  - 제안: `start` 의존성 배열에 `sessionEstablished` 추가 — `[openStream, persist, seedWaitingFromStatus,
    scheduleRefresh, isStale, sessionEstablished]`. 1줄 수정, 다음 이 파일을 건드리는 라운드에서 함께
    처리해도 무방(긴급도 최저).

- **[INFO] TODO/FIXME/HACK/XXX 없음, 반환값 전 경로 명시 확인**
  - 위치: `git show 77805bd32`/`0020f9106` 전체 diff.
  - 상세: `git show <commit> | grep '^+' | grep -iE "TODO|FIXME|HACK|XXX"` 양쪽 모두 무매칭. 신규 게이트
    2곳 모두 `if (sessionEstablished()) return;` 형태로 반환 경로가 명시적이며, 함수 전체(`start()`·
    `applyConfig`)의 다른 반환 경로(옵션 outcome, isStale/isAttemptStale 등)와 동일한 관용구를 따른다 —
    새로 추가된 반환 경로가 기존 함수의 반환값 계약(`void`, 모든 경로 암묵적 `undefined`)을 깨지 않는다.
  - 제안: 없음.

## 요약

지시받은 핵심 검증 대상 `77805bd32`(이중 EventSource fix — `openStream` 직전 `sessionEstablished()` 짝
게이트)는 원래 3개 결함(00_51_53 고착·23_58_23/18_39_11 되감기 2건)을 전혀 건드리지 않고(diff 가 seed
게이트 자체가 아니라 그 **이후** 지점에만 있음, 회귀 스위트 393 passed 로 재확인) 이중 EventSource 문제를
해소한다 — 기존 회귀 테스트 + 내가 격리 worktree 에서 독립 작성한 신규 PROBE 3건(3-way race, divergent-
content race, 순서-역전 race)까지 전부 `esCount===1` 로 수렴했고, mutation A(게이트 2곳 동시 제거)는
커밋 메시지가 주장한 대로 정확히 이 3건 테스트만 깨뜨렸다. spec 정합도 문제없다 — `2-sdk.md §3(재전송)`·
`3-auth-session.md §3.1`·`1-widget-app.md §3.1` 어디도 "EventSource 개수"를 규정하지 않는 spec 침묵
영역이다. 다만 이번 라운드에서 지시대로 능동적으로 신규 시나리오를 재현한 결과, **비대칭 mutation**(두
게이트를 개별적으로 제거)을 시도하자 `start()` 쪽 게이트(`:673`)가 기존 스위트 어떤 테스트로도 검출되지
않는다는 사실을 발견했다 — 기존 유일한 회귀 테스트가 `start()` 자신이 항상 경쟁에서 먼저 이기는 고정
순서만 검증하기 때문이다. 순서를 뒤집은 신규 PROBE 로 확인한 결과 **현재 코드는 그 역전 순서에서도
정확히 동작**하지만(esCount=1), 그 정확성을 독립적으로 고정하는 테스트가 없어 향후 리팩토링이 그 축만
조용히 깨뜨려도 스위트가 통과할 수 있는 회귀 안전망 공백이다 — 이 파일이 4라운드 연속 겪은 "비대칭 가드
누락" 패턴이 이번엔 코드가 아니라 테스트 커버리지에서 반복될 수 있는 잔여 형태다. 부수적으로 plan
진행기록(`:388`)에 `77805bd32` 로 반증된 주장이 미정정 상태로 남아있고, `start()` useCallback 의존성
배열에 `sessionEstablished` 가 누락된 신규 ESLint 경고(기능 무해)가 있다 — 둘 다 경미하고 급하지 않다.
4번째 CRITICAL 은 발견하지 못했으며, 코드 자체는 견고하다(tsc 클린, 전체 스위트 그린, mutation 검증
완료) — 유일한 실질 지적은 회귀 테스트의 대칭성 공백이다.

## 위험도

LOW — 현재 코드에 기능 결함 없음(실측 확인, 신규 PROBE 3건 포함 전부 수렴). CRITICAL 미발견. 유일한 실질
발견(비대칭 mutation 커버리지 공백)은 "지금 버그"가 아니라 "향후 회귀에 대한 안전망 공백"이라 WARNING 이
적절하며, 구체적 재현·제안 테스트 코드까지 검증 완료해 후속 조치가 명확하다. 나머지(plan 문서 drift,
ESLint 경고)는 기능 무영향의 경미한 위생 이슈다.

STATUS=success requirement PATH=/Volumes/project/private/clemvion/.claude/worktrees/webchat-boot-single-flight-8c92b4/review/code/2026/07/18/02_25_54/requirement.md risk=LOW
