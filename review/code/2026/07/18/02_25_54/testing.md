# 테스트(Testing) 리뷰 — webchat-boot-single-flight (02_25_54)

## 스코프 정정 (payload 한계)

`prompt_file`(`_prompts/testing.md`, 2467줄)의 "리뷰 대상 파일" 15건은 이번 라운드가 검증해야 할 실제
코드 diff(`77805bd32` 이중 EventSource fix + `0020f9106` 주석 정리)를 담지 않고, 직전 라운드
(`01_44_21`)의 review 산출물 6건 + consistency 산출물 6건 + `2-sdk.md` frontmatter 뿐이었다 — 같은
라운드의 scope·maintainability 리뷰어도 독립적으로 동일 payload 결함을 지적했다(스냅샷이 한 라운드
지연된 것으로 보인다, 과거 "ai-review Workflow router empty"·"Consistency/ai-review Workflow FS-write
flakiness" 메모리와 같은 계열). 호출자 지시대로 payload 를 신뢰하지 않고 `git show 77805bd32` 로 대상
커밋을 직접 확인해 분석했다.

## 검증 방법

1. `git show 77805bd32`(전체 diff) 확보 — `use-widget.ts`(+23/-3: JSDoc 갱신 + `openStream` 직전 게이트
   2줄 추가) + `use-widget-eager-start.test.ts`(+84: 신규 회귀 테스트 1건). 동반 커밋 `0020f9106`(순수
   주석 정리, 런타임 무영향)도 `git show` 로 확인.
2. `use-widget.ts` 현재 전문(1106행) Read — `sessionEstablished`(`:325`)·`seedWaitingFromStatus`
   (`:474-599`)·`start()`(`:630-685`)·`applyConfig` 복원분기(`:964-1022`) 를 직접 대조.
3. `use-widget-eager-start.test.ts` 의 관련 4개 race 테스트 전문 대조: `:3052`(대체된 시도의 지연
   getStatus — applyConfig 되감기), `:3223`(start() 의 지연 seed — start 되감기), `:3316`(webhook
   in-flight 중 재전송 — no-op 고착), `:3402`(신규, 두 복원 seed 동시 flush — double-stream).
4. **격리 detached worktree** 4개를 순차 생성·제거(`git worktree add --detach`; `node_modules` 는 root
   symlink 시도가 pnpm isolated 모드에서 부적절해 `pnpm install --filter channel-web-chat...
   --frozen-lockfile`(매회 ~2.2초, pnpm 스토어 재사용)로 부트스트랩). 각 worktree 에서:
   - baseline `vitest run`(393 passed) + `tsc --noEmit`(클린) 확인.
   - mutation 적용(`sed` 로 특정 라인만 `if (false) return;` 치환 — 라인 수 불변으로 후속 mutation
     라인 번호 안정) → `vitest run` → 실패 테스트 정밀 대조 → baseline 백업으로 원복 → `diff`(무출력)로
     byte-identical 확인.
   - 최종 `git status --short codebase/`(공유/main worktree)로 오염 없음을 매회 확인 후
     `git worktree remove --force`.
   - 총 6종 mutation(양쪽 게이트 동시 제거·개별 제거 2종·seed 게이트 제거·opt-in 제거·
     `sessionEstablished` 상시-true) + 순서-반전 프로브 1건(격리 worktree 에만 임시 추가, 검증 후
     worktree 통째 폐기 — 공유 worktree 에는 흔적 없음).

## 발견사항

- **[INFO] 신규 회귀 테스트가 지시받은 mutation(openStream 직전 게이트 2곳 무력화)을 정밀하게 잡는다 —
  교차오염 없음**
  - 위치: `use-widget.ts:673`(`start()` 의 openStream 직전 게이트) · `:1018`(`applyConfig` 복원분기의
    짝) · `use-widget-eager-start.test.ts:3402-3471`(신규 테스트).
  - 상세: 두 게이트를 동시에 `if (sessionEstablished()) return;` → `if (false) return;` 로 무력화하고
    전체 스위트(22 파일, 393건)를 실행 — **정확히 1건만 실패**(`두 복원 seed 가 같은 flush 에서
    resolve 해도 EventSource 는 하나만 생성된다`, `AssertionError: expected 2 to be 1`, `:3469`),
    나머지 392건(다른 3종 race 테스트 포함)은 전원 그린. 커밋 메시지의 "mutation: 게이트 2곳 제거 →
    정확히 double-stream 테스트만 실패" 주장을 오늘 코드 기준으로 독립 재현·확증했다 — false-positive
    회귀 테스트가 아니다.
  - 제안: 없음(검증 통과).

- **[WARNING] 신규 회귀 테스트가 두 게이트 중 하나(`applyConfig` 쪽, `:1018`)만 실질적으로 검증한다 —
  `start()` 쪽 게이트(`:673`)는 전체 393건 스위트 어디에서도 검출되지 않는 완전한 커버리지 공백**
  - 위치: `use-widget.ts:673`(미검증 게이트) · `:1018`(검증됨) ·
    `use-widget-eager-start.test.ts:3402-3471`(신규 테스트, resolve 순서가 `statusResolvers[0]`(C,
    `start()` 자신) 먼저 → `statusResolvers[1]`(D, 재전송) 나중으로 고정).
  - 상세: 두 게이트를 **개별로** 무력화해 관찰:
    - `:1018`(applyConfig 게이트)만 제거 → 신규 테스트 실패(`esCount=2`), 전체 393건 스위트 기준으로도
      정확히 이 1건만 깨짐 — 정상 검출.
    - `:673`(`start()` 게이트)만 제거 → 신규 테스트를 포함한 **전체 393건 전원 통과**(단일 파일
      기준 5회 반복 재실행 + 전체 스위트 재확인으로 결정론적임을 검증 — flaky 아님). 즉 이 게이트는
      현재 스위트 전체에서 **커버리지 0%** 다.

    원인: 테스트가 `statusResolvers[0]`(C, `start()` 자신의 seed)를 `statusResolvers[1]`(D, 재전송의
    복원 seed)보다 항상 먼저 resolve 하도록 고정 구성돼 있다. 이 순서에서는(두 응답의 fetch/JSON
    promise 체인 형태가 C·D 동형이라) **C 의 continuation 이 항상 먼저 `sessionEstablished()` 를
    통과해 스트림을 연다** — `:673` 의 존재 여부와 무관하게 C 는 항상 "이기는" 쪽이라 그 게이트가
    한 번도 실제로 트리거되지 않는다. 반대로 D 는 항상 "나중"이라 `:1018` 이 매번 실제로 D 를 막는다.
    즉 테스트 이름("두 복원 seed 가 같은 flush 에서 resolve 해도...")은 일반적인 양방향 경쟁을
    검증하는 것처럼 읽히지만, 구조적으로는 **단 하나의 고정된 방향**만 재현한다.

    실제 서비스에서 반대 방향("D 가 먼저 응답해 스트림을 열고, C 가 뒤늦게 도착")이 일어나지 않는다는
    보장은 코드 어디에도 없다 — 두 `getStatus` 호출은 별개의 네트워크 왕복이라 응답 순서는 실제
    타이밍에 좌우된다. 이 파일은 스스로 "비대칭 가드 누락"으로 반복 CRITICAL 을 낸 이력이 있고
    (`beginBootAttempt` JSDoc, `0020f9106` 이 갱신한 문단), 이번 fix 가 도입한 "짝을 이루는 대칭
    게이트" 자체가 바로 그 교훈에 대한 답이므로, 그 짝의 절반이 테스트로 전혀 검증되지 않는 것은 이
    코드베이스에 특히 더 위험한 종류의 공백이다(maintainability.md 가 이번 라운드에 독립적으로 지적한
    "짝 불변식이 구조가 아니라 주석·복붙 규율에 의존한다" WARNING 과 같은 뿌리이지만, 이쪽은 "구조적
    위험"이 아니라 "이미 존재하는 실측 테스트 갭"이라는 점에서 더 구체적이고 즉시 조치 가능하다).

    **재현·해소 검증**: 동일 테스트를 복제해 resolve 순서만 뒤집은(`statusResolvers[1]` 먼저 →
    `statusResolvers[0]` 나중) 프로브를 격리 worktree 에 작성해 (a) 원본 코드(양쪽 게이트 존재)에서
    정상 통과(`esCount=1`), (b) `:673` 만 제거하면 **정확히 이 프로브만** 실패(`esCount=2`)함을
    확인했다. 이 프로브는 반대로 `:1018` 제거에는 반응하지 않는다(원본 테스트와 정확히 상호 보완 —
    둘을 합치면 두 게이트를 각각 독점 커버). 즉 순서를 뒤집은 대칭 테스트 1건을 추가하는 것만으로
    갭이 완전히 닫힌다는 것을 실제로 실행해 검증했다(프로브 자체는 격리 worktree 폐기와 함께
    제거했고 공유 worktree 에는 반영하지 않았다 — 코드 변경은 developer 트랙 소관).
  - 제안: 기존 테스트(`:3402`) 바로 다음에 resolve 순서만 뒤집은 대칭 케이스를 추가할 것 — 동일 mock
    셋업을 재사용하면 15줄 미만 증분으로 충분하고, 위 프로브로 정확한 동작을 이미 확인했다. `it.each`
    로 두 순서(`[0,1]`/`[1,0]`)를 한 케이스로 파라미터화하는 방법도 고려할 수 있다(단, 이 파일은 mock
    셋업 자체가 테스트마다 인라인 복제되는 기존 습관이 있어 — maintainability.md WARNING 참조 — 공유
    헬퍼 추출과 함께 처리하면 더 깔끔하다). 급하지는 않다 — 현재 프로덕션 코드는 두 게이트 모두
    존재해 정상 동작하므로 이 갭은 "지금 깨져 있다"가 아니라 "다음에 깨져도 못 잡는다"는 성격이다.

- **[INFO] 나머지 3종 race 테스트는 서로 다른, 상호 독립적인 메커니즘으로 고정된다 — 교차오염 없음**
  - 위치: `use-widget.ts:568`(seed WAITING-dispatch 게이트, `if (!opts?.allowWhileStreaming &&
    sessionEstablished()) return "stale";`) · `use-widget-eager-start.test.ts:3052`(대체된 시도의 지연
    getStatus — applyConfig 되감기) · `:3223`(start() 의 지연 seed — start 되감기) · `:3316`(no-op
    고착).
  - 상세:
    - **되감기 2건**(`:3052`, `:3223`): `:568` 의 조건을 `if (false) return "stale";` 로 무력화(구
      "Mutation A")하면 전체 393건 중 **정확히 이 2건만** 실패(391 통과) — 01_44_21 라운드의 claim 을
      오늘 코드로 재확인. 반대로 `:673`/`:1018`(openStream 직전 게이트) 를 둘 다 제거하는 mutation
      에는 **전혀 반응하지 않는다**(두 되감기 테스트 모두 두 응답을 순차 `act()` 로 분리 resolve 하므로,
      늦게 도착하는 쪽이 도착할 시점엔 이미 다른 쪽이 스트림을 열어 전진시킨 뒤라 `:568` 에서 먼저
      "stale" 로 막히고 `:673`/`:1018` 까지 도달하지 않는다).
    - **no-op 고착**(`:3316`): 이번 라운드 diff(`77805bd32`)가 추가한 두 게이트(`:673`/`:1018`)와
      **무관**하다 — 이 시나리오에서는 애초에 아무도 스트림을 열지 않으므로 두 게이트를 토글해도(양쪽
      동시 제거 mutation 확인 — 전체 393건 중 no-op 고착 테스트는 그린 유지) 영향이 없다. 이 테스트가
      실제로 보호하는 메커니즘("`start()` 의 seed 호출에 boot-axis 비교를 넣지 않는다")은 **전전
      커밋 `cffee0d28`** 에서 이미 확립된 것이며, `77805bd32` 는 그 부분을 전혀 수정하지 않았다(diff
      확인 — `:568`·`:990`·`sessionEstablished` 정의 모두 이번 커밋의 hunk 밖). 즉 "4종 race
      테스트"를 전부 이번 diff 전용 회귀 테스트로 취급하면 오분류다 — no-op 고착은 이전 라운드의
      회귀 가드이고, 이번 라운드는 나머지 3종(되감기 2건 + double-stream)에만 실질적으로 관여한다.
  - 제안: 없음(정보성). 리뷰/plan 문서에서 "4종 race 테스트"를 이번 diff 의 검증 대상으로 뭉뚱그려
    서술할 경우, no-op 고착은 범위 밖임을 명시하면 다음 라운드의 스코프 혼동을 줄일 수 있다.

- **[INFO] Mock 설계 — 기존 대비 변경 없이 동일 패턴 재사용, 실제 async 계약과 정합**
  - 위치: `use-widget-eager-start.test.ts:3402-3445`(신규 테스트의 `EventSource`/`fetch` stub).
  - 상세: `esCount`/`latestEs` 카운팅 `EventSource` stub, `webhookResolvers`/`statusResolvers`
    수동-resolve 배열 패턴 모두 직전 두 테스트(`:3223`·`:3316`)와 **byte-identical**(같은 라운드
    maintainability 리뷰어가 `git log -S` 로 독립 확인한 사실과 일치)하게 재사용됐다 — 응답 도착
    순서를 테스트 코드가 명시 제어하는 설계 덕에 이번 검증(개별 게이트 분리, 순서 반전 프로브)도
    기존 구조를 그대로 복사해 수 분 안에 구성할 수 있었다. `fetch`/`EventSource` 를 실제
    Promise/콜백 의미론 그대로 유지한 채 타이밍만 제어하는 정직한 mock 이라 실제 동작과의 괴리가
    없다.
  - 제안: 없음(긍정적 관찰). 이 43줄 블록이 세 커밋 연속 복제된 것은 maintainability 리뷰어가 이미
    별도 WARNING(공유 헬퍼 추출 권고)으로 지적했으므로 본 리뷰에서 중복하지 않는다.

- **[INFO] 테스트 격리 — 전역 `beforeEach`/`afterEach` 로 상태 누수 없음, 신규 테스트도 동일 보호 아래**
  - 위치: `use-widget-eager-start.test.ts:185-199`(`beforeEach`: `sessionStorage.clear()` + 기본
    `EventSource` stub 설치 / `afterEach`: `vi.unstubAllGlobals()` + `vi.useRealTimers()` +
    `vi.restoreAllMocks()`).
  - 상세: 신규 테스트는 이 전역 훅 아래에서 실행되며 `esCount`/`latestEs`/`webhookResolvers`/
    `statusResolvers` 를 전부 테스트-로컬 클로저로 선언해 다른 테스트로 상태가 새지 않는다. 격리
    worktree 4개에서 전체 스위트를 반복 실행(baseline 각 2회 + mutation 6종 + 단일 테스트 5회 반복)
    하는 동안 순서·반복에 따른 flake 를 전혀 관측하지 못했다(총 370회 이상의 개별 테스트 실행 누적,
    전부 결정론적).
  - 제안: 없음.

- **[INFO] 회귀 테스트 유효성 — 기존 스위트 전수 재확인, 원복 후 byte-identical, 공유 worktree 무오염**
  - 위치: 격리 worktree(`scratchpad/isolated-testing-review`, `-review2`, `-review3`, `-review4` —
    총 4개, 순차 생성·검증·제거) 전체.
  - 상세: 원본(mutation 없음) 기준 `vitest run` **393 passed**(22 파일), `tsc --noEmit` 클린 — 커밋
    메시지 수치와 일치. 각 mutation 뒤 파일을 baseline 백업으로 원복하고 `diff`(무출력)로
    byte-identical 확인, 매 라운드 종료 시 공유(main) worktree 를 `git status --short codebase/`
    무출력으로 재확인한 뒤에야 다음 mutation 으로 진행했다. 최종적으로 4개 격리 worktree 모두
    `git worktree remove --force` 로 제거, 공유 worktree 는 세션 시작부터 끝까지 `codebase/` 변경
    이력이 전혀 없다.
  - 제안: 없음.

## 요약

지시받은 핵심 검증 — 신규 회귀 테스트("두 복원 seed 가 같은 flush 에서 resolve 해도 EventSource 는
하나만 생성된다")가 실제로 `77805bd32` 의 결함(이중 EventSource)을 잡는지 — 는 **확증됐다**: openStream
직전 게이트 2곳을 동시에 무력화하면 393건 중 정확히 이 1건만 실패하고, 다른 3종 race 테스트를 포함한
나머지 392건은 교차오염 없이 그린이다. 다만 게이트를 **개별로** 분리해 보니 실질적으로 검증되는 것은
`applyConfig` 쪽(`:1018`) 뿐이고, `start()` 쪽(`:673`)은 전체 393건 스위트 어디에서도 검출되지 않는
완전한 커버리지 공백임을 확인했다 — 원인은 테스트가 두 `getStatus` 응답을 항상 같은 순서(`start()`
먼저)로 resolve 하도록 고정돼, 구조적으로 한쪽 방향의 경쟁만 재현하기 때문이다(반복 실행으로
결정론적임을 확인, flaky 아님). 이 갭이 실제로 닫힐 수 있음은 resolve 순서만 뒤집은 프로브를 직접
작성·실행해 검증했다(원본에서 통과, `:673` 제거 시에만 실패, `:1018` 제거에는 무반응 — 기존 테스트와
정확히 상호 보완). 나머지 두 되감기 테스트는 별도의 seed 게이트(`:568`)로, no-op 고착 테스트는 이번
diff 가 전혀 건드리지 않은 전전 커밋(`cffee0d28`)의 메커니즘으로 각각 고정되며 서로 교차오염이 없다 —
단 "4종 race 테스트"를 전부 이번 라운드의 산물로 묶어 보면 no-op 고착은 범위 밖이라는 점은 문서화 시
유의할 만하다. Mock 설계·테스트 격리는 기존 수준을 그대로 유지해 문제 없다.

## 위험도

MEDIUM — 지시받은 mutation 검증 자체는 정확히 통과했고 현재 프로덕션 코드는 두 게이트 모두 실제로
존재해 정상 동작한다(양쪽을 함께 제거할 때만 결함이 재현되며, 그 결함도 원 커밋 자신의 평가대로
correctness 훼손이 아닌 낭비성 재연결이다). 그러나 발견된 커버리지 갭(`start()` 쪽 게이트가 393건
전체에서 0% 커버리지)은 이 파일이 반복적으로 겪어온 "비대칭 가드 누락" 패턴과 정확히 같은 모양의
맹점이라 방치 시 재발 위험이 실질적이다 — 다만 갭이 노출할 수 있는 최악의 결과(낭비성 EventSource
재연결, `closeStream→set` 으로 자가 수렴, 데이터 손상·유실 없음)는 원래 결함 자체와 동급으로 낮은
severity 라 CRITICAL 로 올리지는 않는다.

STATUS=success testing PATH=/Volumes/project/private/clemvion/.claude/worktrees/webchat-boot-single-flight-8c92b4/review/code/2026/07/18/02_25_54/testing.md risk=MEDIUM
