# 요구사항(Requirement) 리뷰 — webchat-boot-single-flight (01_44_21, `cffee0d28` 재설계 검증 라운드)

> 지시받은 핵심 검증 대상: 커밋 `cffee0d28`(되감기 방어를 boot 축 → `sessionEstablished()` 로 재설계 —
> 직전(00_51_53) 내가 재현한 "no-op 재전송이 `start()` 를 스피너에 영구 고착시키는" CRITICAL 의 fix).
> 4가지를 검증한다: (1) 00_51_53 고착 시나리오 해소 여부, (2) 원래 되감기(23_58_23 start / 18_39_11
> applyConfig)가 여전히 막히는지, (3) spec §3(재전송)·`3-auth-session.md`·`1-widget-app.md` 정합 및
> `replay_unavailable` 미파손, (4) 이 자리(3연속 CRITICAL)에 또 다른 반대 구멍이 있는지 — 격리
> detached worktree(`git worktree add --detach`, node_modules 심링크로 부트스트랩)에서 신규 시나리오를
> 실제 코드로 재현·mutation 테스트했다(작업 완료 후 worktree 제거, 공유 worktree 무변경 확인).

## 사전 확인 — payload 한계

prompt_file 의 "리뷰 대상 파일" 목록은 이번 라운드 실제 코드 diff(`cffee0d28`, `use-widget.ts` +
`use-widget-eager-start.test.ts`)를 포함하지 않고 무관한 3개 파일(consistency 산출물 2건 +
`2-sdk.md` frontmatter 4줄)만 담고 있었다(scope.md 리뷰어도 독립적으로 동일 지적 — 53개 파일 중 3개만
포함). 호출자 지시대로 `git log`/`git show cffee0d28`로 실제 target 커밋을 직접 확정해 분석했다 —
payload 미신뢰, 디스크(git history) 직접 확인.

## 검증 방법

1. `git show cffee0d28`(전체 diff) + 현재 `use-widget.ts` 전문(1088행) Read — 코드 trace-through 으로
   00_51_53/23_58_23/18_39_11 세 시나리오를 새 게이트(`sessionEstablished()`)로 재추적.
2. 기존 회귀 스위트 실행(원 worktree): `tsc --noEmit` 클린, `vitest run` **392 passed**(커밋 메시지 수치와
   일치).
3. **격리 detached worktree**(`/private/tmp/.../scratchpad/isolated-review`, HEAD `2b4f198c1` pinned,
   node_modules 심링크 부트스트랩)에서:
   - 신규 4건 PROBE 테스트 작성(2-way/3-way "동일 microtask wave" 동시-resolve race, `replay_unavailable`
     양성 대조, world-축 종료확정 교차검증) → 전원 통과 확인.
   - **Mutation A**(`sessionEstablished()` 게이트 무력화) → 전체 스위트 중 **정확히 2건** 실패
     (`대체된 시도의 지연 getStatus...` + `start() 의 지연 seed...`) — 내 신규 PROBE 4건은 **전원 유지**
     (근거: PROBE 는 동일-콘텐츠 동시 race 라 게이트 유무와 무관하게 수렴 — 아래 발견사항 참조).
   - **Mutation B**(`allowWhileStreaming` opt-in 제거) → 기존 `replay_unavailable 수신 → getStatus
     재조회로 현재 표면 재동기화` **및** 내 신규 PROBE-3 **둘 다** 실패 — opt-in 이 load-bearing 임을
     독립 재확인.
   - mutation 원복 후 `git diff --stat` 무출력(원본과 byte-identical) 확인, worktree 제거.
   - 커밋 메시지가 주장한 "mutation A→2건 실패 / mutation B→replay 실패"를 **독립적으로, 별도 작성한
     테스트로** 재확인했다 — 개발자 자체 검증과 다른 실험(다른 테스트 코드)이 같은 결론에 도달.

## 발견사항

- **[INFO] (핵심 확인 1) 00_51_53 이 재현한 고착 시나리오가 실제로 해소됐다 — code trace + 기존
  회귀테스트 그린 + mutation 으로 이중 확인**
  - 위치: `use-widget.ts:621-671`(`start()`) · `:528-590`(`seedWaitingFromStatus`, 특히 `:559`
    `if (!opts?.allowWhileStreaming && sessionEstablished()) return "stale";`) ·
    `use-widget-eager-start.test.ts:3315-3388`(신규 고착 재현 회귀 테스트).
  - 상세: 00_51_53 시나리오(webhook in-flight 중 아무것도 복원 못 하는 재전송 → `bootGenRef` 만 헛되이
    올라 `start()` 자신의 정당한 seed 가 거짓 stale 처리 → WAITING·openStream 둘 다 스킵 → 영구 고착)를
    새 게이트로 재추적: no-op 재전송의 `applyConfig` 는 `sessionEstablished()===false`(스트림 미확립)라
    `loadSession`에 성공은 하지만 **storage 가 비어있어 `saved===null`**(persist 전이므로) → 복원 분기
    자체를 안 타 세션/스트림을 전혀 건드리지 않는다. 이후 `start()` 자신의 seed 가 응답할 때, 아무도
    스트림을 안 열었으므로 `sessionEstablished()===false` → 게이트를 통과해 정상적으로 `WAITING` dispatch
    + `openStream` 을 수행한다 — 더 이상 boot 세대 비교에 의존하지 않으므로 "세대만 오른 무해한
    재전송"에 오염되지 않는다. 원 worktree에서 `vitest run`(392 passed, 고착 재현 테스트 포함)으로
    실측 확인, 격리 worktree 의 mutation A(게이트 제거)에서 이 정확한 테스트가 실패로 돌아가는 것도
    확인해 이 방어가 우연이 아니라 load-bearing 임을 재확인했다.
  - 제안: 없음 — 지시받은 핵심 검증 대상은 신뢰 가능.

- **[INFO] (핵심 확인 2) 원래의 두 CRITICAL(23_58_23 start 무방비 되감기, 18_39_11 applyConfig 함수경계
  안쪽 되감기)이 재설계 후에도 여전히 차단된다 — 두 시나리오 모두 code trace 로 재확인, 대응 회귀
  테스트 그린 + mutation A 로 정확히 이 2건만 깨짐을 확인**
  - 위치: `use-widget-eager-start.test.ts:3051-3102`(18_39_11 `applyConfig`-vs-`applyConfig` 되감기
    테스트), `:3222-3302`(23_58_23 `start()`-vs-재전송 되감기 테스트) · `seedWaitingFromStatus` 게이트
    `:559`.
  - 상세: 18_39_11 시나리오(겹친 두 `applyConfig` 복원이 각자 `getStatus` 를 내고 **먼저 응답한 쪽이
    스트림을 열어 SSE 로 전진**시킨 뒤 **대체된 쪽의 지연 응답**이 옛 노드로 화면을 되돌리는 것)와
    23_58_23 시나리오(`start()` 자신의 seed 가 재전송의 복원-오픈-전진 이후 옛 스냅샷으로 응답)를
    새 게이트로 재추적했다 — 두 경우 모두 **"늦게 도착하는 응답이 resolve 하는 시점에는 이미 다른
    시도가 스트림을 열어놓은 뒤"**이므로 `sessionEstablished()===true` 가 되어 게이트가 정확히
    차단한다(`"stale"` 반환, `WAITING` dispatch 없음). 이 메커니즘은 "boot 세대가 더 최신인 시도만
    보호"하던 이전 설계와 달리 **"누가 열었든 스트림이 열려 있으면 무조건 후순위"** 라는 더 강한
    불변식이라, `start()`(boot 축 대상이 아니었던 18_39_11/23_58_23 구멍의 근본 원인)도 별도 토큰
    전달 없이 자동으로 보호된다 — 세 호출부(`applyConfig` 복원 분기·`start()`·`replay_unavailable`
    폴백) 전부가 하나의 무조건 기본 가드를 공유하므로, 18_39_11 이 지적한 "boot 게이트가 세 호출부 중
    한 곳에만 배선"됐던 비대칭 자체가 설계적으로 재발 불가능해졌다. 원 worktree `vitest run` 로 두
    회귀 테스트 그린 확인 + 격리 worktree mutation A 에서 **정확히 이 2건만** 실패로 돌아가는 것을
    재확인(다른 60건은 무영향) — 커밋 메시지의 "mutation A → 되감기 2건 실패" 주장과 완전히 일치.
  - 제안: 없음.

- **[INFO] (핵심 확인 3) spec 정합 — `2-sdk.md §3(재전송)`·`3-auth-session.md §3.1`·`1-widget-app.md
  §3.1(replay_unavailable)` 과 line-level 로 어긋나지 않는다. `sessionEstablished()` 자체는 spec 이
  규정하지 않는 구현 세부(spec 침묵 영역, fidelity 위반 아님)**
  - 위치: spec `spec/7-channel-web-chat/2-sdk.md:637-642`("wc:boot 재전송" 조항) ·
    `spec/7-channel-web-chat/3-auth-session.md:60-79`(§3.1 재로드 복원 시퀀스 + storage 정리 조건 열거)
    · `spec/7-channel-web-chat/1-widget-app.md:99-116`(§3.1 SSE 재연결/버퍼만료 재동기화 산문).
  - 상세: (a) "위젯은 마지막 wc:boot 의 config 를 적용" — `bootGenRef`/`beginBootAttempt`/
    `cannotApplyConfig`/`isAttemptStale`(checkpoint 1·2)이 이번 커밋에서 **전혀 변경되지 않았다**(diff
    확인 — 이 네 심볼은 diff hunk 밖). config 적용 축과 이번에 바뀐 "표면 갱신/스트림 오픈" 축은
    설계상 분리돼 있어(JSDoc `:276-281` "bootGenRef 는 applyConfig 의 config 적용 경합에만 쓴다") 이
    계약은 그대로 유지된다. (b) "동일 triggerEndpointPath 재부팅은 진행 중 execution 을 중복 시작하지
    않는다" — `saved = sessionEstablished() ? null : loadSession(...)`(`:976`)이 스트림 확립 후
    재전송의 복원 분기 자체를 스킵시켜 이 계약을 지킨다(이 라인도 이번 diff 밖, 18_39_11 부터 존재).
    (c) `3-auth-session.md §3.1-3` storage 정리 조건 열거(SSE terminal·복원시 200+terminal/404/복구불가
    401·명령 410)는 `finalizeEnded`/world 축이 담당하며 이번 재설계가 건드리지 않은 축이다(JSDoc 표
    `:502-505` "종료 확정=world 만"). (d) `1-widget-app.md:104-107` "위젯은 이 이벤트(`replay_unavailable`)
    를 받으면 getStatus snapshot 으로 폴백해 현재 표면을 재동기화한다... 기본적으로 스트림·세션은
    유지"는 `{ allowWhileStreaming: true }` opt-in 과 정확히 대응한다(핵심 확인 4 참조). `sessionEstablished()`
    라는 구체 판정 메커니즘 자체는 spec 어디에도 명명되지 않는데, 이는 **spec 이 관찰 가능한 행동
    계약(마지막 config 적용·재전송이 활성 대화를 안 건드림·재동기화 시 스트림 유지)만 규정하고 클라
    이언트 내부 동시성 방어 기법은 의도적으로 열어두기 때문**이다(`1-widget-app.md:94` "구현 상태" 각주도
    "client 측 A/B-1" 처럼 **행동**(single-flight coalesce)만 명명하지 내부 predicate 이름은 언급 안 함
    — 동일 패턴). 회색지대(INFO)로 분류하며 spec 갱신 불요.
  - 제안: 없음.

- **[INFO] (핵심 확인 4) `replay_unavailable`(§3.1 버퍼 만료 재동기화)이 깨지지 않았다 — 기존 회귀
  테스트 + 독립 작성한 신규 PROBE 둘 다 그린, mutation B 로 두 테스트 모두 정확히 깨지는 것을 확인**
  - 위치: `use-widget.ts:424-437`(`handleEiaEvent` 의 `execution.replay_unavailable` 분기,
    `{ allowWhileStreaming: true }` 전달) · `use-widget-eager-start.test.ts:1240`(기존 회귀) ·
    격리 worktree 신규 `probe-sessionEstablished.test.ts` PROBE-3(양성 대조, 스트림 열린 채 노드가
    n1→n2 로 재동기화되는지 검증).
  - 상세: 게이트는 `!opts?.allowWhileStreaming && sessionEstablished()` 이므로 `replay_unavailable`
    폴백만 `allowWhileStreaming:true` 로 스트림이 열려 있어도 재동기화를 통과시키고, `applyConfig`/
    `start()` 는 옵션을 넘기지 않아(기본값) 여전히 "스트림 열렸으면 스킵" 이 적용된다. 원 worktree
    기존 테스트(`replay_unavailable 수신 → getStatus 재조회로 현재 표면 재동기화`) 그린 확인 + 격리
    worktree 에서 **독립적으로 새로 작성한** PROBE-3(스트림 확립 후 `replay_unavailable` emit →
    getStatus 가 n1→n2 로 응답 → 화면이 실제로 n2 로 갱신되는지 assert)도 통과. mutation B(opt-in
    제거, 게이트를 무조건 `sessionEstablished()` 로) 적용 시 **기존 테스트와 내 PROBE-3 둘 다** 정확히
    실패(`expected 'n1' to be 'n2'` / `expected false to be true`)로 돌아가는 것을 확인 — 서로 다른
    두 테스트 코드가 같은 결론에 수렴해, opt-in 이 우연이 아니라 실제로 필요함을 이중 확증했다.
  - 제안: 없음.

- **[INFO] 새 반대 구멍 탐색 — 격리 worktree 에서 능동적으로 4개 신규 시나리오를 실제 코드로 재현,
  전원 안전하게 수렴함을 확인(4번째 CRITICAL 미발견)**
  - 위치: 격리 worktree(`git worktree add --detach`, 검증 후 제거) 신규
    `codebase/channel-web-chat/src/widget/probe-sessionEstablished.test.ts`(PROBE-1~4, 4건 전원 통과).
  - 상세 — 시도한 시나리오와 결론:
    1. **PROBE-1(2-way "동일 microtask wave" 동시-resolve)**: 기존 회귀 테스트는 두 `getStatus`
       resolver 를 **각각 별도 `act()` 블록**(중간 flush 있음)으로 순차 resolve 한다. 이 테스트는 두
       resolver 를 **같은 동기 블록 안에서 연달아 호출**해, 두 응답의 continuation 이 서로의 caller
       (`openStream` 호출)가 실행되기 **전에** 둘 다 `sessionEstablished()` 를 검사하게 만드는
       microtask 순서를 의도적으로 유도했다(이론상 둘 다 "스트림 없음"으로 보고 둘 다 WAITING 을
       그릴 수 있는 창). 실측 결과 최종 상태는 항상 일관됐다 — EventSource 는 `closeStream()` 이
       매 `openStream()` 앞에 동기 실행되므로 **동시에 2개 살아있는 상태는 구조적으로 불가능**하고
       (직렬 close→open), 두 응답이 같은 세션의 같은 스냅샷(n1)을 담으므로 이중 dispatch 도 idempotent
       하다. 즉 이 race 는 존재하지만 **관측 가능한 harm 이 없다** — 18_39_11 side_effect 리뷰어가
       이미 유사 패턴(중복 `getStatus`)을 "최종 수렴·멱등" 으로 low-severity 이월 처리한 것과 같은
       결론이다.
    2. **PROBE-2(3-way: `start()` 자기 seed + 재전송 2건이 동일 동기 블록에서 resolve)**: 00_51_53·
       23_58_23 두 시나리오를 하나로 합쳐 `start()`(persist 후 seed) + 재전송(persist 후 도착, 복원
       seed)의 두 응답을 동시에 resolve 시킨 뒤 SSE 로 화면이 n2 로 전진해도 되감기가 없는지 확인 —
       통과. 화면은 SSE 전진값을 유지했고 EventSource 총량도 통제 범위(≤2) 안이었다.
    3. **PROBE-3**: 핵심 확인 4 참조(양성 대조, mutation-검증됨).
    4. **PROBE-4(world 축 상호작용 교차검증)**: 재전송 복원 seed 가 in-flight 인 상태(스트림 아직
       미확립, `RESTORED` dispatch 후 `streaming` phase)에서 그 세션이 실제로 종료됐다는 스냅샷
       (`completed`)이 도착하면, 새 `sessionEstablished()` 게이트(표면 갱신 축)와 무관하게 world 축
       (`finalizeEnded`)이 여전히 정상적으로 종료를 확정하고 storage 를 정리하는지 확인 — 통과(이
       두 정책이 이번 재설계 후에도 독립적으로 공존함을 재확인, JSDoc 표 `:502-505` 그대로).
    - 근본적으로, 이 재설계가 견고한 이유는 게이트가 "캡처된 토큰과 현재 세대 비교"(비교 시점이
      호출마다 다를 수 있어 순서에 취약했던 이전 두 설계의 공통 실패 패턴)가 아니라 "현재 스트림
      존재 여부"라는 **부작용(openStream 이 `streamRef` 를 쓰는 것) 자체를 관찰하는 라이브 predicate**
      라는 데 있다 — `openStream` 이 동기이므로 "누가 먼저 스트림을 열었는가" 라는 사실 자체가 이후
      모든 경쟁자에게 즉시 일관되게 보인다.
  - 제안: 없음(코드 fix 불요). 다만 JSDoc `:516`의 "이중 스트림도 원천 차단"이라는 표현은 문자 그대로는
    참(동시에 2개 살아있는 상태는 불가능)이나, PROBE-1 이 보여주듯 극히 좁은 동시-resolve 창에서는
    "낭비성 close→reopen 1회"가 발생할 수 있다(관측 가능한 피해는 없음, 같은 세션이라 idempotent) —
    필수 아니지만 원한다면 JSDoc 에 "동시에 2개 **유지**되는 상태는 없다(단, 동일 microtask 에서 여러
    응답이 겹치면 close→reopen 이 한 번 더 일어날 수 있음, 무해)" 정도로 표현을 살짝 정밀화할 여지는
    있다 — INFO, 우선순위 낮음.

- **[INFO] 코드 위생 — TODO/FIXME/HACK/XXX 없음, 반환값 전 경로 명시, stale 심볼 참조 없음**
  - 위치: `use-widget.ts` 전문, `seedWaitingFromStatus`(`SeedOutcome` 반환 4개 코드경로 — terminal→
    `"ended"`, isStale(2곳)→`"stale"`, WAITING 게이트→`"stale"`, 성공→`"continue"`, catch soft-fail→
    `"continue"`/`"stale"` — 전부 명시 반환 확인).
  - 상세: grep 으로 TODO/FIXME/HACK/XXX 전무 확인. 제거된 `attempt`/`bootAtStart` 매개변수의 잔존 참조도
    없음(`cannotApplyConfig` 자신의 `attempt: { boot: number }` 파라미터만 남아있고 이는 `applyConfig`
    checkpoint 1/2 용으로 이번 diff 와 무관하게 유지되는 정상 심볼). `seedWaitingFromStatusRef` 의
    ref 타입 시그니처(`:226-233`)도 실제 함수 시그니처(`client, session, opts?`)와 일치.
  - 제안: 없음.

## 요약

지시받은 핵심 검증 대상 `cffee0d28`(되감기 방어 boot 축 → `sessionEstablished()` 재설계)은 네 가지
검증축 모두 통과했다. (1) 내가 직전 라운드(00_51_53)에 재현한 "webhook in-flight 중 아무것도 복원 못
하는 재전송이 `start()` 를 스피너에 영구 고착시키는" CRITICAL 은 code trace·기존 회귀테스트·mutation A
세 가지 방법 모두로 해소가 확인됐다. (2) 원래의 두 되감기 CRITICAL(23_58_23 `start()` 무방비, 18_39_11
`applyConfig` 함수경계 안쪽)도 여전히 차단된다 — 새 게이트가 "boot 세대 비교"라는 불완전한 proxy 대신
"스트림이 이미 열렸는가"라는 직접 신호를 쓰기 때문에, 종전에 `start()` 만 무방비였던 **비대칭 자체가
설계적으로 사라졌다**(세 호출부가 하나의 무조건 기본 가드를 공유). (3) spec `2-sdk.md §3(재전송)`·
`3-auth-session.md §3.1`·`1-widget-app.md §3.1(replay_unavailable)` 과 line-level 로 대조한 결과 어긋남이
없다 — config-적용 축(`bootGenRef` 계열)과 종료-확정 축(world)은 이번 diff 밖에서 불변이고,
`sessionEstablished()` 라는 구체 메커니즘 자체는 spec 이 명명하지 않는 구현 세부(관찰가능 행동 계약만
규정)라 fidelity 위반이 아니다. `replay_unavailable` 재동기화는 기존 회귀 테스트와 내가 격리 worktree
에서 독립적으로 새로 작성한 PROBE 테스트 둘 다로 정상 확인했고, mutation B(opt-in 제거)로 둘 다 정확히
깨지는 것까지 재확인해 "우연히 통과"가 아님을 이중 확증했다. (4) 이 자리가 3연속 CRITICAL 이 난 지점
이라는 지시에 따라 격리 detached worktree 에서 신규 시나리오 4건(2-way/3-way "동일 microtask wave"
동시-resolve race, replay_unavailable 양성 대조, world-축 교차검증)을 실제 코드로 능동 재현했으나
4번째 CRITICAL 은 발견하지 못했다 — 유일하게 발견한 이론적 잔여 창(극히 좁은 동시-resolve 시 낭비성
close→reopen 1회)은 관측 가능한 피해가 없고(같은 세션이라 idempotent, EventSource 동시 2개 유지는
구조적으로 불가능) 18_39_11 이 이미 유사 패턴을 low-severity 로 분류한 것과 같은 결론이라 INFO 로
남긴다. 4개의 완료된 병렬 sibling 리뷰(scope·security·documentation·maintainability)도 모두 LOW 위험도로
독립 수렴했다(security.md 는 신규 인증/토큰 표면 없음을, scope.md 는 boot 인자 제거가 정의 1곳+호출
3곳에 정확히 국소화됨을 각각 확인).

## 위험도

LOW — CRITICAL 미발견. 지시받은 검증 대상은 견고하고(mutation 양방향 load-bearing 확인), 3연속
CRITICAL 이 난 자리에 대한 능동적 신규 시나리오 탐색도 4번째 CRITICAL 을 찾지 못했다. 유일한 잔여
관찰(극히 좁은 동시-resolve 시 낭비성 close→reopen, 무해)은 JSDoc 정밀화 제안 수준의 INFO 다.

STATUS=success requirement PATH=/Volumes/project/private/clemvion/.claude/worktrees/webchat-boot-single-flight-8c92b4/review/code/2026/07/18/01_44_21/requirement.md risk=LOW
