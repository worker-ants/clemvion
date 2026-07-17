# 테스트(Testing) Review — webchat-boot-single-flight (01_44_21)

## 스코프 정정 (payload 한계)

`prompt_file`(`_prompts/testing.md`)에 담긴 diff 는 review 아티팩트 2건(consistency 산출물)과
`spec/7-channel-web-chat/2-sdk.md` frontmatter 4줄뿐이었다 — 이번 라운드 핵심으로 명시된 재설계
(`cffee0d28` "되감기 방어를 boot 축 → sessionEstablished 로")의 실제 코드/테스트 diff 가 빠져 있었다.
`git log`/`git show cffee0d28`로 대상 커밋을 직접 확인해(diff-scope 가 untracked review 산출물만
집었을 가능성 — 기존에 알려진 "diff-scope 오염" 패턴과 일치) 아래 분석은 payload 대신 **실제 커밋
`cffee0d28`**(`codebase/channel-web-chat/src/widget/use-widget.ts` + `use-widget-eager-start.test.ts`,
392 테스트 중 152줄 변경)을 대상으로 수행했다.

## 검증 방법

`git worktree add`로 완전 격리된 임시 worktree(`scratchpad/testing-review-wt`, 현재 worktree 와
동일 HEAD `2b4f198c1`)를 만들고 `pnpm install --filter channel-web-chat...`(2.2초, pnpm 스토어
재사용)로 부트스트랩한 뒤 모든 mutation·실행·복원을 그 안에서 수행했다. 매 mutation 마다 원본을
백업(md5 대조로 원복 확인) → 패치 → `vitest run` → 원복 → 다음 mutation 순으로 진행했고, 최종
`git diff --stat`(빈 결과)로 오염 없음을 확인한 뒤 worktree 를 제거했다. 공유(main) worktree 는
전혀 건드리지 않았다.

## 발견사항

- **[INFO]** 신규 회귀 테스트가 실제로 "스피너 고착" 버그를 잡는지 mutation 으로 확인 — **정확히 검증됨**
  - 위치: `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts:3315`
    (`it("webhook in-flight 중 아무것도 복원 못 하는 재전송이 start() 를 스피너에 고착시키지 않는다")`)
  - 상세: 프로덕션 코드(`use-widget.ts`)를 `cffee0d28`의 **부모 커밋**(`5eed8cf96`, boot-스냅샷 방식)
    으로 되돌리고 테스트 파일은 그대로(신규 테스트 포함) 둔 채 이 테스트 하나만 실행했다. 결과:
    `expected 'streaming' to be 'awaiting_user_message'`로 **실패**. `phase: "streaming"`은
    `dispatch({type:"START"})` 직후의 초기 phase(`widget-state.ts:143/146` — WAITING dispatch 전까지
    유지)이므로 커밋 메시지가 말하는 "스피너 영구 고착"과 정확히 일치하는 실패 모드다(esCount 단언까지
    가지 못하고 첫 단언에서 막힘 — 스트림도 안 열렸다는 뜻과 정합). fix 를 원복하면 이 테스트가
    load-bearing 하게 실패한다는 것이 확인됐다 — false-positive 회귀 테스트가 아니다.
  - 제안: 없음(검증 통과). 이 결과를 커밋 메시지의 "검증" 절에 인용 가능한 독립 재현으로 남긴다.

- **[INFO]** Mutation A(`sessionEstablished()` 게이트 제거) — 예측한 정확히 2건만 실패, 정밀함 확인
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:559`
    (`if (!opts?.allowWhileStreaming && sessionEstablished()) return "stale";` → `if (false) return "stale";`)
  - 상세: 게이트를 무력화한 상태로 `use-widget-eager-start.test.ts` 58건 전체 실행 →
    **정확히 2건만 실패**, 나머지 56건 그린:
    - `대체된 시도의 지연 getStatus 가 살아있는 화면을 옛 노드로 되감지 않는다` (3051행)
    - `start() 의 지연 seed 가 재전송이 전진시킨 화면을 되감거나 두번째 스트림을 열지 않는다` (3222행)
    호출자가 예측한 "되감기 2건"과 완전히 일치한다. 다른 56건(신규 고착 테스트·replay_unavailable
    재동기화·겹친 부팅·resetSession 계열 등)은 이 게이트에 얹혀가지 않는다는 뜻이므로, 이 게이트가
    **정확히 저 2개 시나리오만을 위한 것**이라는 설계 의도가 테스트로 정밀하게 고정돼 있다(과잉도
    과소도 아님).
  - 제안: 없음(검증 통과).

- **[INFO]** Mutation B(`allowWhileStreaming` opt-in 제거, 항상 게이트) — 예측한 정확히 1건만 실패, 정밀함 확인
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:559`
    (`if (!opts?.allowWhileStreaming && sessionEstablished())` → `if (sessionEstablished())`)
  - 상세: opt-in 을 제거해 스트림이 열려 있으면 무조건 게이팅하도록 만든 상태로 58건 실행 →
    **정확히 1건만 실패**, 57건 그린: `replay_unavailable 수신 → getStatus 재조회로 현재 표면
    재동기화(스트림 유지)` (1240행). `AssertionError: expected false to be true`(메시지 텍스트 매칭
    실패 — 재동기화가 no-op 이 됐다는 뜻)로, 호출자가 예측한 정확히 그 시나리오다. 이 opt-in 이
    `replay_unavailable` 폴백 **하나만을 위한 것**이라는 설계 의도도 정밀하게 고정돼 있다.
  - 제안: 없음(검증 통과).

- **[CRITICAL]** 커버리지 갭 — 근접-동시 `getStatus` 응답 해석 시 이중 `EventSource` 오픈(TOCTOU), JSDoc
  이 명시한 "이중 스트림도 원천 차단" 불변식이 실측으로 반증됨. **재설계가 새로 만든, 현재 미커버 경로.**
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:559`(게이트) 및 `:448-467`(`openStream`)·
    `:325-328`(`closeStream`). 이 게이트에 의존하는 두 호출부: `:656`(`start()`)·`:989`(`applyConfig`
    복원 분기). JSDoc 주장 위치: `:507-511`("openStream 은 seed 반환 직후 동기 실행이라 ... 이중
    스트림도 원천 차단").
  - 상세: `start()`의 지연 seed(C)와 `wc:boot` 재전송의 복원 seed(D)가 **같은 세션**을 대상으로 각자
    `getStatus`를 낸 상태(3222행 테스트와 동일 셋업)에서, 두 응답을 **하나의 `act()` 안에서
    `flushAsync()` 없이 연달아**(`statusResolvers[1](...); statusResolvers[0](...); await flushAsync();`)
    resolve 시키는 프로브를 격리 worktree 에서 구성해 3회 반복 실행했다 — **매번 결정적으로**
    `esCount === 2`(두 번째 `EventSource` 생성)를 관측했다(flaky 아님). 원인: 새 게이트는
    `streamRef.current !== null`(부수효과로 설정되는 상태)을 보는데, `openStream()`은
    `seedWaitingFromStatus`가 **반환된 뒤** 그 caller 의 이어지는 microtask 에서 호출된다 — 즉 C 와
    D 양쪽의 `sessionEstablished()` 검사가 **둘 다 아직 아무도 `streamRef.current`를 안 채운 시점**에
    순차 microtask 로 통과할 수 있는 창이 실제로 존재한다. `openStream()`이 내부에서 `closeStream()`을
    먼저 호출하므로(:452) 최종적으로 살아남는 스트림은 하나뿐이지만(영구 이중 스트림은 아님), (1) 코드
    자신이 명시한 "이중 스트림 원천 차단" 불변식은 falsify 됐고, (2) 첫 번째로 연 스트림은 열리자마자
    닫히는 낭비(불필요한 SSE 핸드셰이크 왕복)이며, (3) 이 창에서 **어느 쪽이 최종 스트림을 소유하는지가
    microtask 스케줄링 우연에 좌우**돼 JSDoc 이 말하는 "마지막 부팅이 스트림을 소유"라는 소유권 계약이
    이 경로에서 보장되지 않는다(실제 서버 이벤트가 그 좁은 창에 끼어들 경우의 메시지 유실/중복 여부는
    이번 프로브로는 확정하지 못했다 — 별도 조사 필요). **비교 대조**: 동일 프로브를 `cffee0d28`의
    부모 커밋(구 boot-축 코드)에 적용하면 `esCount === 1`로 통과한다 — boot 세대 비교는
    `beginBootAttempt()`가 **동기적으로** 카운터를 올리는 스냅샷 비교라 microtask 순서에 무관하게
    결정적으로 오래된 쪽을 걸러내기 때문이다. 즉 이 TOCTOU 창은 **이번 재설계가 boot 축(경합-무관 카운터
    비교)을 sessionEstablished 축(부수효과 상태 비교)으로 바꾸며 새로 연 경로**이고, 기존 58건 어느
    테스트도 "두 getStatus 가 같은 flush 안에서 함께 해소"되는 순서를 연습하지 않는다(기존 테스트는
    모두 `await act(...); await flushAsync();`를 **각 resolve 마다 별도로** 감싸 순차적 완전-해소를
    강제한다 — 근접-동시 해소 자체가 미탐사 영역).
  - 제안: (a) 최소한 이 시나리오를 고정하는 회귀 테스트를 추가할 것(본 리뷰가 쓴 프로브 패턴 재사용
    가능 — 두 `statusResolvers`를 같은 `act()`에서 `flushAsync()` 없이 연달아 resolve). 현재 동작을
    "허용 가능"으로 판단한다면 그 결정과 근거(어느 쪽이 이겨도 되는 이유, `closeStream()` 선-호출로
    관측 가능한 피해가 없는 이유)를 테스트 주석과 JSDoc 양쪽에 명시할 것 — 지금처럼 "원천 차단"이라고
    **틀리게** 문서화된 채로 두면 다음 라운드에 다시 반증돼 9번째 회귀가 된다(plan 이 스스로 "8번째
    거울상"이라 부른 바로 그 패턴). (b) 근본 수정을 원한다면, `seedWaitingFromStatus`가 waiting_for_input
    을 그리기로 **결정한 시점**(`sessionEstablished()` 통과 직후, `dispatch`/`return "continue"` 이전)에
    `streamRef.current`에 sentinel 값을 동기적으로 세팅하거나, 별도의 "예약(claim)" ref 를 두어 경합하는
    다음 continuation 이 그 시점 이후엔 gate 에 걸리도록 하는 방향을 검토할 것(단, 그 attempt 가 나중에
    `isStale`/`isAttemptStale`로 취소되는 경우 예약 해제가 필요 — concurrency/requirement 리뷰어와
    설계를 조율할 사안이라 본 리뷰에서는 테스트 커버리지 갭으로만 제기한다).

- **[WARNING]** Stale 문서 — "대체된 시도의 지연 getStatus" 테스트의 헤더 주석이 여전히 "(boot 축)"
  라벨을 달고 있음 — 실제 게이트는 이번 커밋이 `sessionEstablished()`로 바꿈(Mutation A 로 실측 확인)
  - 위치: `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts:3042`
    (`// **대체된 부팅 시도의 지연 getStatus 가 살아있는 화면을 되감지 않는다** (boot 축).`) 및
    같은 파일 3106행(`// ... 같은 함수 안에서 표면 갱신은 boot 축을 보고(대체된 시도는 그리지 않음)`).
  - 상세: 이 헤더가 붙은 테스트(3051행)는 Mutation A 로 **`sessionEstablished()` 게이트에 의해서만
    보호됨**이 실측 확인됐다 — `isAttemptStale`/boot 세대 비교가 아니다. 그런데 바로 다음 짝 테스트
    (3222행, `start() 의 지연 seed...`)의 헤더 주석은 이번 `cffee0d28` diff 에서 명시적으로 개정돼
    "가드는 `sessionEstablished()`(...)다 — ... (23_58_23 은 이 자리에 boot 스냅샷을 썼다가 ...
    00_51_53 에서 sessionEstablished 로 교체했다)"로 정정됐다(diff 확인). 즉 **같은 커밋이 짝 테스트
    2개 중 1개(3222행)만 갱신하고 3042행은 손대지 않아**, 지금 두 테스트가 서로 다른(그리고 하나는
    틀린) 메커니즘 라벨을 달고 있다. 3106행은 같은 문단 안에서조차 "boot 축을 보고"(3106행)와
    "`sessionEstablished()` 스킵으로"(3108-3109행)가 공존해 내부적으로 모순된다. 실행에는 영향 없지만
    (테스트 자체는 정확히 검증하는 대상을 검증함), 이 코드 영역은 plan 이 스스로 "8번째 거울상"이라 부를
    만큼 반복 회귀 이력이 있는 자리라 — 다음에 이 테스트를 유지보수할 사람이 "boot 축" 라벨을 믿고
    `isAttemptStale`을 건드리면 이 테스트의 실제 보호 메커니즘과 어긋난 수정을 할 위험이 있다.
  - 제안: 3042행 라벨을 `(boot 축)` → `(sessionEstablished — 이전엔 boot 축이었으나 00_51_53 에서 교체)`
    류로, 3106행의 "boot 축을 보고"를 "`sessionEstablished()` 를 보고"로 정정할 것. 3222행에 이미 쓴
    패턴(역사 vs 현재 메커니즘 분리 서술)을 그대로 재사용하면 된다 — 별도 조사 불요, 기계적 정정.

- **[INFO]** Mock 품질 — 이번 검증을 가능케 한 구조적 강점
  - 위치: `use-widget-eager-start.test.ts` 전역의 `webhookResolvers`/`statusResolvers` 배열 +
    수동 resolve 패턴, `installControllableEventSource`/인라인 `vi.stubGlobal("EventSource", ...)`.
  - 상세: `fetch`를 즉시 resolve 하는 대신 resolver 함수를 배열에 쌓아 **테스트 코드가 응답 도착
    순서를 명시적으로 제어**하게 한 설계 덕분에, 이번 리뷰가 "두 응답을 같은 flush 안에서 해소"하는
    프로브를 기존 테스트 구조를 그대로 복사해 수 분 안에 구성할 수 있었다(신규 mock 인프라 불필요).
    이는 이 프로젝트의 EIA client(`@workflow/sdk`)의 실제 async 계약(fetch Promise)과 괴리 없이
    타이밍만 제어하는 좋은 패턴이다 — 다른 채널의 concurrency 테스트에도 재사용 권장.
  - 제안: 없음(긍정적 관찰).

## 회귀 테스트 유효성 — 기존 스위트 전수 확인

원본 코드(mutation 없음) 상태로 `channel-web-chat` 전체 스위트(22 파일)를 이 리뷰의 격리
worktree 에서 재실행 — **392 passed**, 커밋 메시지가 주장한 수치와 정확히 일치. `tsc` 는 별도로
재확인하지 않았으나(시간 예산상 vitest 런타임 검증에 집중) mutation 세 건 모두 타입 에러 없이
컴파일·실행됐으므로 이 변경이 타입 표면을 깨지 않았다는 간접 증거는 있다.

## 요약

`cffee0d28`("boot 축 → sessionEstablished")의 세 가지 핵심 검증 주장 — (1) 신규 고착 회귀 테스트가
fix 되돌리면 실패, (2) 게이트 제거 mutation 이 정확히 예측된 2건(대체된 시도 getStatus·start() 지연
seed)만 깨뜨림, (3) opt-in 제거 mutation 이 정확히 예측된 1건(replay_unavailable 재동기화)만
깨뜨림 — 전부 격리 worktree 에서 독립적으로 재현·확인했다. 커밋 메시지의 "검증" 절은 정확하고
과장이 없다. 다만 이 세 mutation 이 다루지 않은 **네 번째 시나리오**를 직접 프로브로 구성해보니,
`sessionEstablished()`를 상태 기반(부수효과) 축으로 쓰면서 새로 열린 TOCTOU 창 — 두 개의 지연
`getStatus`가 같은 microtask flush 안에서 함께 해소되면 `EventSource`가 두 번 생성된다 —
이 있고, 이는 코드 자신의 JSDoc 이 "원천 차단"이라 명시한 바를 반증한다. `openStream()`의 선행
`closeStream()` 덕에 영구적 이중 활성 스트림은 아니지만, 문서화된 불변식이 거짓이고 이를 잡는
테스트가 전무하다는 점에서 이는 "재설계로 새로 생긴, 현재 미커버 경로"에 정확히 해당한다 — 이
파일이 이미 8차례 같은 계열의 회귀를 겪은 이력을 감안하면 방치 시 재발 위험이 실질적이다. 부수적으로
짝을 이루는 두 회귀 테스트 중 하나(3042행)의 헤더 주석이 이번 개정에서 갱신되지 않아 실제 보호
메커니즘과 어긋난 라벨("boot 축")을 달고 있는 점도 발견했다(실행에는 무해, 유지보수 시 오도 위험).

## 위험도

HIGH
