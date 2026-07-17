# 동시성(Concurrency) 리뷰 — webchat-boot-single-flight (02_25_54, `77805bd32` openStream 게이트 fix 검증 라운드)

> 지시받은 핵심 검증 대상: 직전(01_44_21) concurrency 라운드가 재현·직접 fix 까지 적용했던 "이중
> EventSource"(seed 게이트와 openStream 사이 microtask 경계 창) 를 커밋 `77805bd32` 가 `start()`·
> `applyConfig` 의 `openStream` **직전**에 `if (sessionEstablished()) return;` 을 추가해 고쳤다. 이번
> 라운드는 그 fix 가 **실제로 커밋된 코드**에서 (1) 문제를 닫았는지 mutation 으로 재확인하고, (2) 반대
> 구멍(거짓 스킵으로 인한 새 고착)을 능동적으로 반증하고, (3) 3-way 이상 겹침·임의 resolve 순서에서
> 수렴을 확인하고, (4) 불변식이 완결됐는지(잔여 race 표면 여부) 판단하는 데 집중했다.

## 사전 확인 — payload 한계

`_prompts/concurrency.md` 는 2469줄로 잘려(93746 토큰, 25000 캡) 파일 4(`security.md`)까지만 확인했고
이번 라운드의 실제 target 커밋(`77805bd32`)의 코드 diff 자체는 payload 미확인 구간에 있을 가능성이 높다
— 과거 라운드(01_44_21)에서도 동일 패턴(payload 에 review 산출물만 담기고 실제 코드 diff 는 누락)이
scope.md·requirement.md 리뷰어에 의해 독립 지적된 바 있다. 호출자 지시대로 `git show 77805bd32`·
`git log`·현재 `use-widget.ts`/`use-widget-eager-start.test.ts` 전문을 디스크에서 직접 읽어 분석했다 —
payload 미신뢰, git 실측 우선.

## 검증 방법 — 격리 detached worktree

`git worktree add --detach /private/tmp/.../scratchpad/isolated-concurrency-review HEAD`
(HEAD=`262ef8e5b`, 공유 worktree 와 동일 커밋 pinned). node_modules 는 root 를 심링크, `codebase/
channel-web-chat/node_modules` 는 실제 복사(memory `Worktree node_modules bootstrap` 관례 — pnpm
isolated node-linker 의 상대 심링크가 `../../../node_modules` 를 참조하므로 root 심링크만 있으면
package-level 디렉터리는 그대로 복사해도 해소된다). 검증 후 `git worktree remove --force` 로 제거,
공유 worktree(`git status --short`/`git diff -- use-widget.ts`)가 byte-identical 로 무변경임을 확인했다.

1. **baseline**: 격리 worktree `vitest run` → **393 passed**(커밋 메시지 수치와 일치). `tsc --noEmit`
   은 공유 worktree(read-only, 파일 변경 없음)에서 별도로 exit 0 확인.
2. **Mutation A(양쪽 게이트 동시 무력화)**: `use-widget.ts:673`·`:1018` 두 `if (sessionEstablished())
   return;` 을 `if (false && sessionEstablished()) return;` 로 무력화 → `vitest run` 결과 **정확히 1건**
   실패(`두 복원 seed 가 같은 flush 에서 resolve 해도 EventSource 는 하나만 생성된다`,
   `expected 2 to be 1`), 나머지 **392건 전원 유지**. mutation 원복 후 `diff` 무출력(byte-identical)
   확인.
3. **신규 PROBE 8건**(`probe-concurrency-0225.test.ts`, 격리 worktree 전용 — 검증 후 파일·worktree
   전체 삭제): 반대 구멍(거짓 스킵) 탐색 2건 + 고착 무영향 1건 + 3-way 동시 resolve 4건(임의 순서
   parametrize) + 3-way straggler 되감기 1건. 전원 HEAD(post-fix) 에서 통과.
4. **parent-commit 대조(`2b4f198c1`, `77805bd32` 이전)**: 동일 PROBE 를 `use-widget.ts` 만 부모 커밋
   버전으로 스왑해 재실행 → 3-way PROBE 4건 전원 **`esCount=2`로 실패**(fix 이전엔 3-way 에서도
   재현됨을 독립 확인), straggler PROBE 는 그 특정 인터리빙에서 우연히 통과(2-way 로 축소되는 경로라
   무관). 이후 HEAD 버전으로 복원, 전체 스위트 401 passed(393+PROBE 8) 재확인.

## 발견사항

- **[INFO] (핵심 확인 1) 이중 EventSource 가 실제로 닫혔다 — mutation 이 신규 테스트 정확히 1건만
  실패시킴(과소·과다 킬 없음)**
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:673`(`start()`)·`:1018`(`applyConfig`
    복원 분기), 대응 회귀 `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts:3402-3471`
    (`두 복원 seed 가 같은 flush 에서 resolve 해도 EventSource 는 하나만 생성된다`).
  - 상세: `openStream` 의 두 호출부(`start()`/`applyConfig` 복원 분기, 이 파일 안 유일한 두 호출부 —
    `grep -n "openStream("` 로 전수 대조) 모두 **직전**에 `sessionEstablished()` 재확인이 추가됐다.
    Mutation A(양쪽 동시 무력화)는 393건 중 **정확히 신규 테스트 1건만** 깨뜨렸다(`esCount: expected
    2 to be 1`) — 커밋 메시지의 "mutation: 게이트 2곳 제거 → 정확히 double-stream 테스트만 실패" 주장을
    독립 재현했다. 이 정밀도(정확히 1건, 나머지 392건 무영향)는 fix 가 필요-충분하게 좁게 겨냥됐다는
    강한 증거다.
  - 제안: 없음 — 지시받은 핵심 검증 대상은 신뢰 가능.

- **[INFO] (핵심 확인 2) 반대 구멍(거짓 스킵으로 인한 새 고착) 없음 — 구조적 논증 + 능동 PROBE 로
  반증 시도, 발견 못 함**
  - 위치: `use-widget.ts:325`(`sessionEstablished = () => streamRef.current !== null`)· `:450-472`
    (`openStream`, `streamRef.current` 를 쓰는 유일한 지점)·`:327-330`(`closeStream`, null 하는 유일한
    지점). 신규 PROBE `probe-concurrency-0225.test.ts` `PROBE-A`(solo start)·`PROBE-B`(solo applyConfig
    복원)·`PROBE-C0`(아무도 seed 에 응답 안 함).
  - 상세: `streamRef.current` 를 **쓰는** 곳은 `openStream` 단 한 곳, **null 하는** 곳은 `closeStream`
    단 한 곳뿐이다(전수 grep 확인) — 즉 "스트림이 열렸다" 는 사실과 `sessionEstablished()===true` 는
    구조적으로 동치이고, 다른 경합자가 전혀 없는 solo 호출이 자기 자신의 과거 호출로 이 값을 거짓
    `true` 로 관측할 경로가 없다. PROBE-A(경쟁자 없는 단독 `start()`)·PROBE-B(경쟁자 없는 단독
    `applyConfig` 복원) 모두 `esCount===1`(게이트가 막지 않음)로 통과했고, PROBE-C0(seed 가 영원히
    미해결)은 게이트 도달 자체가 없어 `esCount===0`(정상 대기, 새로운 고착 아님)을 확인했다. 별도로
    `use-token-refresh.ts` 를 grep 해 `streamRef`/`openStream`/`EventSource` 어느 것도 참조하지 않음을
    확인 — 토큰 갱신 축은 이 두 게이트와 완전히 무관해 상호작용 리스크가 없다.
  - 제안: 없음.

- **[INFO] (핵심 확인 3) 3-way 이상 겹침·임의 resolve 순서에서도 스트림은 정확히 1개로 수렴 —
  4개 임의 순서 전원 확인 + parent-commit 대조로 fix 의 일반성 재확인**
  - 위치: `use-widget.ts:298-307`(`cannotApplyConfig`/`isAttemptStale`, boot 축 checkpoint 2)·`:673`·
    `:1018`(신규 스트림 게이트). PROBE `probe-concurrency-0225.test.ts` `PROBE-C`(it.each 4 순서:
    C,A,B / B,C,A / A,B,C / B,A,C).
  - 상세: `start()`(boot 축 없음, 자기 자신은 `startedRef` 로 마운트당 1회만 존재) + 겹친 재전송 2건
    (resend#2 boot=2, resend#3 boot=3 — resend#2 는 resend#3 이 발사되는 순간 `bootGenRef.current` 가
    3 으로 올라 **checkpoint 2 에서 항상 pruning**됨, resolve 순서와 무관)의 getStatus 응답 3개를 같은
    flush 에서 임의 순서로 resolve 시켜도 **4개 순서 전원 `esCount===1`**. 같은 PROBE 를 `77805bd32`
    이전(`2b4f198c1`)의 `use-widget.ts` 로 스왑해 재실행하면 **4개 순서 전원 `esCount===2`로 재현** —
    fix 가 커밋에 포함된 2-way 회귀 테스트 하나에만 우연히 맞는 게 아니라 **3-way 겹침에도 일반화**됨을
    독립적으로, 별도 작성한 시나리오로 재확인했다.
  - **구조적 통찰(부가 발견)**: `applyConfig` checkpoint 2(boot 축)가 오래된 재전송 시도를 openStream
    게이트 도달 전에 항상 pruning 하므로, 실제로 openStream 결정 지점에 동시 도달할 수 있는 "진짜
    경쟁자" 수는 **최대 2 로 구조적으로 상한**된다 — (a) 마운트당 유일한 `start()` 실행(`startedRef`
    가 첫 await 이전에 동기 set) + (b) 현재 최신 boot 세대를 가진 단 하나의 `applyConfig` 시도.
    "N-way 겹침" 은 in-flight 요청 개수 기준으로는 3개 이상 가능하지만, **실제 openStream 을 다투는
    지점**에서는 결코 2를 넘지 않는다 — 게이트가 2곳(1 vs 1 페어)으로 충분한 이유가 여기 있다. 이
    성질은 코드 읽기로 도출한 가설이었고 mutation/PROBE 로 실증했다.
  - 제안: 없음 — 필요하다면 이 "최대 2-way 로 상한" 논거를 `beginBootAttempt`/`sessionEstablished`
    JSDoc 에 한 줄 추가하면 향후 리뷰어가 "3-way 는 어떻게 되나"를 다시 재현하지 않아도 된다(선택,
    문서 개선 수준).

- **[WARNING] 잔여 표면 — 3-way 이상 겹침에서 boot 축으로 이미 죽은(checkpoint 2 pruning 대상) 재전송의
  `getStatus` 내용이 최종 `WAITING` 표면을 순간적으로 차지할 수 있다(스트림 개수와는 독립된 별개
  축, `77805bd32` 도입 아님 — `cffee0d28` 부터 존재하는 pre-existing 특성)**
  - 위치: `use-widget.ts:564-568`(`seedWaitingFromStatus` 의 `WAITING` dispatch 직전 게이트 —
    `sessionEstablished()` 만 보고 boot 축은 안 봄, JSDoc 표 `:504-507` 의 의도된 설계)·`:990-1012`
    (`applyConfig` 의 seed→checkpoint2 순서 — **seed 의 dispatch 가 checkpoint 2 보다 먼저 실행**).
  - 상세: `PROBE-C` 를 4개 순서로 돌리며 콘솔로 최종 `nodeId` 를 관측한 결과, `order C,A,B`(resend#3
    응답을 가장 먼저, resend#2 응답을 가장 나중에 resolve)에서 **checkpoint 2 로 pruning 될 예정인
    resend#2(boot=2, doomed) 의 응답 내용이 최종 표면(`nodeId`)으로 남았다** — `esCount` 는 여전히
    1(스트림 이중생성은 없음)이지만, 화면에 표시된 내용은 "boot 축으로는 이미 대체된" 시도의 것이었다.
    원인: `applyConfig` 는 `seedWaitingFromStatus`(내부에서 `dispatch({type:"WAITING",...})` 수행) 를
    **먼저** `await` 하고, boot 축 검사(checkpoint 2 `isAttemptStale`)는 그 **다음**에 온다. seed 내부
    게이트는 world+stream 축만 보고 boot 축을 **의도적으로** 안 본다(JSDoc 표 — "표면 갱신은
    `sessionEstablished()` 만 본다"). 그 결과 doomed 시도도 자신의 `getStatus` 가 응답하는 시점에
    아직 아무도 스트림을 안 열었다면(3-way 이상에서만 가능 — 2-way 에서는 유일한 재전송이 항상
    "최신"이라 pruning 대상 자체가 없다) 정상적으로 `WAITING` 을 dispatch 한다. **checkpoint 2 로
    보호되는 것은 "누가 스트림을 여는가" 뿐, "누구 내용이 화면에 마지막으로 남는가" 가 아니다.**
    `77805bd32` 이전 커밋(`2b4f198c1`)의 코드로 동일 PROBE 를 돌려도 **동일하게 재현**돼(esCount
    assertion 을 제외하고 content-only 로 재확인), 이 특성이 오늘 diff 가 도입한 게 아니라
    `sessionEstablished()` 기반 seed 게이트 설계(`cffee0d28`) 자체에 내재한 것임을 확인했다 —
    `77805bd32` 는 이 축을 건드리지 않았다(seed 함수 내부 무변경, 호출부의 `openStream` 이후만 추가).
    **실전 도달 가능성은 낮다**: (1) 3개 이상의 재전송이 실제로 겹쳐야 하고(관리자 라이브 미리보기의
    빠른 연타 편집 정도가 유일한 실제 경로), (2) doomed 시도와 생존 시도의 `getStatus` 응답이 **실제로
    다른 내용**이어야 한다(같은 execution 을 거의 동시에 두 번 조회하면 서버 상태가 그 사이 실제로
    전이하지 않는 한 내용은 동일 — 본 PROBE 는 이를 관측 가능하게 하려 인위적으로 다른 nodeId 를
    부여했다), (3) 설사 재현돼도 **영구 고착이 아니다** — 같은 flush 에서 스트림은 정상적으로 1개
    열리므로 그 직후 SSE 이벤트/replay 가 즉시 표면을 실제 최신 상태로 재동기화한다(단, replay 는
    네트워크 왕복이 필요해 화면이 잠깐 옛 노드로 보이는 창은 실재). 사용자가 그 짧은 창에 옛 nodeId
    로 명령을 제출하면 18_39_11 이 이미 분류한 "지나간 nodeId 명령 거부" 부류로 수렴한다(신규
    실패유형 아님).
  - 제안: 오늘 `77805bd32` 를 막을 사유는 아니다(범위 밖 — 이 커밋은 스트림 축만 다룬다). 다만
    "seed 게이트(표면)/openStream 게이트(스트림)/종료(world)" 3축이 완결됐다고 선언하기 전에, **표면
    축에 boot 축이 빠진 이 잔여 창**을 `webchat-boot-single-flight.md` plan 또는 `beginBootAttempt`
    JSDoc 에 한 줄 residual 로 남겨두길 권장한다 — 언젠가 3-way 이상 겹침이 실제 트래픽에서 흔해지면
    (예: 라이브 미리보기가 디바운스를 더 낮추는 변경 등) 재검토 대상이 된다. 즉시 코드 수정은 불필요.

- **[INFO] 데드락·리소스 풀링 — 해당 없음(단일 스레드 이벤트 루프, 락/풀 인프라 없음)**
  - 위치: 파일 전체.
  - 상세: React 훅 + 브라우저 이벤트 루프 컨텍스트라 OS 스레드/락(mutex/semaphore)·커넥션 풀이
    존재하지 않는다. "동기화" 는 전부 ref 읽기/쓰기 + 세대 토큰(world/boot) + 라이브 predicate
    (`sessionEstablished`) 조합으로 이뤄지며, 이번 diff 가 추가한 두 줄은 O(1) 동기 비교라 이벤트
    루프 블로킹·콜백 지옥과도 무관하다.
  - 제안: 없음.

## 요약

지시받은 핵심 검증 대상 `77805bd32`(seed 게이트의 짝인 openStream 직전 `sessionEstablished()` 게이트
추가)를 격리 detached worktree 에서 mutation·신규 PROBE·parent-commit 대조 세 방법으로 검증했다.
(1) 이중 EventSource 는 실제로 닫혔다 — 두 게이트를 동시에 무력화하는 mutation 이 **정확히** 신규
회귀 테스트 1건만 깨뜨리고 나머지 392건은 무영향이어서, fix 가 과소·과다 없이 필요-충분하게 좁게
겨냥됐음을 확인했다. (2) 반대 구멍(거짓 스킵으로 인한 새 고착)은 찾지 못했다 — `streamRef.current`
를 쓰는/null 하는 지점이 각각 단 하나뿐이라는 구조적 논거에 더해, 경쟁자 없는 solo `start()`/
`applyConfig` PROBE 가 게이트에 막히지 않음을 실증했다. (3) 3-way 이상 겹침·임의 resolve 순서에서도
스트림은 4개 순서 전원에서 정확히 1개로 수렴했고, 같은 시나리오를 fix 이전 커밋에 돌리면 4개 순서
전원 재현(esCount=2)돼 fix 의 일반성을 독립 확인했다 — 부가로 `applyConfig` checkpoint 2(boot 축)가
오래된 재전송을 항상 pruning 하므로 실제 openStream 경쟁자는 구조적으로 최대 2 로 상한된다는 설계적
근거도 확인했다. (4) 불변식(seed 게이트/openStream 게이트/종료-world)은 **스트림 축에서는 완결**됐다.
다만 능동 반증 과정에서 스트림 축과 독립된 **표면 축의 잔여 창**을 하나 발견했다 — 3-way 이상 겹침에서
boot 축으로 이미 pruning 대상인 재전송의 `getStatus` 내용이 순간적으로 최종 표면을 차지할 수 있다(스트림
개수엔 영향 없음, 곧바로 열리는 단일 스트림의 SSE 가 재동기화). parent-commit 대조로 이 특성이 오늘 diff
가 아니라 `cffee0d28`(seed 게이트 설계) 부터 존재하던 것임을 확인했으므로 `77805bd32` 를 막을 사유는
아니며, 도달 조건이 좁고(3개 이상 실제 겹침 + 응답 내용의 실제 divergence) 자가 치유적(단일 스트림이
곧바로 열려 재동기화)이라 WARNING 으로 분류해 plan 잔여 항목으로만 남긴다.

## 위험도

LOW — 지시받은 핵심 fix(`77805bd32`)는 mutation·3-way PROBE·parent-commit 대조 세 축 모두에서 견고함이
확인됐고 반대 구멍도 발견되지 않았다. 유일한 신규 관찰(WARNING, 3-way 표면 잔여 창)은 오늘 diff 가
도입한 것이 아니고, 스트림 이중생성·영구 고착·데이터 손상으로 이어지지 않는 좁고 자가 치유적인 표면
레벨 특성이라 이번 커밋을 차단할 사유가 아니다.

STATUS=success concurrency PATH=/Volumes/project/private/clemvion/.claude/worktrees/webchat-boot-single-flight-8c92b4/review/code/2026/07/18/02_25_54/concurrency.md risk=LOW
