# 동시성(Concurrency) 리뷰 — webchat-boot-single-flight (23_58_23, 직전 CRITICAL 후속 검증)

> 이번 라운드는 직전(`18_39_11`) concurrency CRITICAL — `seedWaitingFromStatus` 가 boot 축을 몰라 대체된
> 시도의 지연 `getStatus` 가 살아있는 화면을 옛 노드로 되감을 수 있었던 결함 — 에 대한 **fix 검증**이
> 목적이다. fix 는 `seedWaitingFromStatus` 안에 "종료 확정=world 만, 표면 갱신(WAITING)=world+boot" 두
> staleness 정책을 공존시켰다. 이 문서는 (1) 그 두 정책 자체가 정확한지, (2) 새 race 를 만드는지, 특히
> N-way 겹침·임의 resolve 순서에서 반례가 있는지를 **격리 detached worktree 에서 실측 검증**했다.
>
> **결론 먼저**: (1)의 두 정책 자체는 옳고 두 회귀 테스트가 양방향을 정확히 고정한다(mutation 확인 완료,
> 아래 INFO). 그러나 (2)에서 **반례를 찾았다** — fix 가 `seedWaitingFromStatus` 의 세 호출부 중
> **`applyConfig` 복원 분기 한 곳만** boot 토큰으로 보호했고, **`start()`(eager 부팅) 호출부는 의도적으로
> 무방비로 남겼다**(JSDoc: "world 축만 필요"). 이 호출부가 재전송 복원 분기와 같은 세션을 놓고
> 경합하면 **직전 라운드에 CRITICAL 로 고친 것과 동일한 증상(화면이 옛 노드로 되감김)이 재현된다** —
> 실제 코드(mutation 아님)로 재현·검증했다. 아래 CRITICAL 참조.

## 검증 방법

원 워크트리는 공유·읽기 전용으로 취급하고, `git worktree add --detach`(HEAD `3f55ee000` pinned)로 격리된
detached worktree 를 만들어 그 안에서만 코드를 수정·복원했다. 채택한 3가지 검증:

1. **가설 재현 테스트 신설** — 실제 `useWidget()` 훅을 그대로 쓰고(내부 로직 목킹 없음) `fetch`/`EventSource`
   만 제어해, 아래 CRITICAL 시나리오를 그대로 실행. HEAD 코드(무변경)로 실패 확인.
2. **진단 패치로 인과 이중 확증** — `start()`가 읽기전용 boot 스냅샷을 `seedWaitingFromStatus`에 넘기도록
   한 줄 패치 → 신설 테스트 통과 + 기존 56건 전원 유지(57/57, 회귀 0) 확인 후 패치 되돌림(리뷰이므로 fix
   는 적용하지 않음).
3. **RESOLUTION.md 의 mutation 매트릭스 재실행** — 이번 라운드가 추가한 회귀 테스트 2건에 대해 지정된 두
   mutation(WAITING 분기 boot 가드 제거 / 종료 확정 분기에 boot 가드 오추가)을 직접 적용해 각각 정확히
   1건만 실패하는지 확인.

검증 후 worktree 는 `git worktree remove --force` + `rm -rf` 로 제거했다(잔존 없음, 공유 워크트리 무변경 —
`git status`로 확인).

## 발견사항

- **[CRITICAL]** `seedWaitingFromStatus` 의 boot 축 보호가 **세 호출부 중 한 곳(`applyConfig` 복원 분기)에만
  배선**됐다 — `start()`(eager 부팅) 호출부는 의도적으로 무방비라 **직전 라운드(18_39_11)에 고친 것과
  동일한 클래스의 화면 되감김이 다른 경로로 재현된다.** 실제(비-mutation) 코드로 재현 확인.
  - 위치:
    - `codebase/channel-web-chat/src/widget/use-widget.ts:635` — `start()` 의 `seedWaitingFromStatus(client, session)` 호출, **`attempt` 인자 없음**.
    - 같은 파일 `:541` — `if (attempt && cannotApplyConfig(attempt)) return "stale";` — `attempt` 가 `undefined` 면 `attempt &&` 에서 단락돼 **boot 가드가 조용히 스킵**된다.
    - 같은 파일 `:504-505` (`seedWaitingFromStatus` JSDoc `@param attempt`) · `:271-272`(`beginBootAttempt` JSDoc) — "`start()`/`sendCommand`/`seedWaitingFromStatus` 는 부팅 시도가 아니라 world 축만 필요하므로 attempt 를 생략한다" 고 명시적으로 정당화한다.
    - `review/code/2026/07/17/18_39_11/concurrency.md` 의 마지막 INFO 항목 — "`start()`(eager 부팅) 진행 중과 `wc:boot` 재전송이 겹치는 경로도... 위 CRITICAL 의 수정... 이 경로도 함께 닫는다 — **별도 수정 불필요**." 이번 실측이 이 결론을 **반증**한다.
  - 상세 — 재현 시퀀스(실제 `useWidget()` 훅으로 실행, 3-way 겹침):
    1. `wc:boot` #1 도착 → config 확립. 저장 세션 없음(신규 방문) — 복원 분기 진입 안 함.
    2. 패널 open → `start()` 진입(eager 부팅, §R6). webhook POST in-flight.
    3. POST 미해결 중 `wc:boot` #2 도착 — storage 가 아직 비어(persist 전) 있어 조용히 종료(무해).
    4. POST 해결 → `start()` 가 `persist()`(세션을 storage 에 **동기** 기록) 후 자신의 `getStatus`(호출 C, **`attempt` 없음**)를 낸다.
    5. 호출 C 미해결 중 `wc:boot` #3 도착 — `sessionEstablished()` 가 아직 `false`(스트림 미확립, `start()` 가 `openStream` 에 도달하기 전)라 `applyConfig` 의 복원 분기가 진입해 **4단계가 방금 쓴 세션을 `loadSession` 으로 발견**, `RESTORED` dispatch 후 **자신의** `getStatus`(호출 D, **`attempt` 있음** — 이번 라운드 fix 로 보호됨)를 낸다.
    6. 호출 D 가 먼저 응답(`waiting_for_input(n1)`) → boot 가드 통과(현재 시도이므로) → `WAITING(n1)` dispatch → `openStream`.
    7. 대화가 SSE 로 실제 전진 → `WAITING(n2)`.
    8. 호출 C(2단계 `start()` 의 원래 seed, attempt 없음)가 **뒤늦게** 옛 스냅샷 `n1` 으로 응답 → world 축은 이 시나리오 내내 안 바뀌어(`isStale(gen)` 통과) → **`attempt` 가 `undefined` 라 이번 라운드가 추가한 boot 가드(L541)가 통째로 스킵** → `WAITING(n1)` 이 **무조건 dispatch** 되어 **화면이 n2 → n1 로 되감긴다.**
  - **실측(격리 worktree, HEAD 무변경 코드에 새 테스트만 추가)**:
    ```
    × REPRO-HYPOTHESIS: start() 의 무-attempt seed 응답이 재전송 복원이 SSE 로 전진시킨 화면을 되감기는가
    AssertionError: expected 'n1' to be 'n2'
    ```
    이어서 `start()` 에 `const bootAtStart = bootGenRef.current;`(읽기전용 스냅샷, `beginBootAttempt()` 처럼
    증가시키지 않음)를 캡처해 `seedWaitingFromStatus(client, session, { boot: bootAtStart })` 로 넘기는
    진단 패치를 적용하자 **신설 테스트 통과 + 기존 56건 전원 유지(57/57, 회귀 0)** — 인과관계와 수정
    방향 둘 다 확인했다. 패치는 리뷰 범위를 넘으므로 검증 후 되돌렸다(코드 변경 없음).
  - 왜 심각한가 — 직전 CRITICAL(18_39_11)이 정확히 지적한 것과 같은 문구가 그대로 적용된다: "단순
    flicker 가 아니라 고착이다 — 되감긴 표면에 사용자가 응답하면 이미 지나간 nodeId 로 명령이 나가
    백엔드가 거부한다." 그리고 도달 조건은 **이론적 구석이 아니다** — 이번 diff 의 CHANGELOG 자체가
    "관리자 라이브 미리보기는 외형 폼 변경마다 **디바운스 없이** 재전송" 한다고 명시하고, eager
    시작(§R6)은 패널 open 즉시 webhook POST + 자체 `getStatus` 를 발사한다. 재전송-무디바운스 +
    eager-즉시시작이라는, 이 PR 이 스스로 기술한 두 성질만으로 경합 창이 열린다.
  - 이번 라운드가 추가한 회귀 테스트 2건(`대체된 시도의 지연 getStatus...`, `대체된 시도가 발견한
    종료는...`) **둘 다 이 경로를 커버하지 않는다** — 둘 다 `applyConfig` 대 `applyConfig` 겹침만
    다루고 `start()` 는 관여하지 않는다. 따라서 mutation 매트릭스(RESOLUTION.md 표)도 이 gap 을 잡지
    못한다 — 애초에 그 축을 겨냥한 mutation 이 없었다.
  - 제안: `start()` 도 `applyConfig` 와 동일한 토큰 보호를 받되 **`beginBootAttempt()` 를 호출하지는
    않는다** — `start()` 는 "부팅 시도"(config 적용 경합자)가 아니므로 `bootGenRef` 를 증가시키면
    안 된다(증가시키면 `applyConfig` 쪽의 supersede 카운팅을 오염시킨다). 대신 `const bootAtStart =
    bootGenRef.current;` 로 **읽기전용 스냅샷**만 캡처해 `seedWaitingFromStatus(client, session, {
    boot: bootAtStart })` 로 넘긴다 — 위에서 검증한 그대로. 이러면 "이 seed 가 응답할 때쯤 더 최신
    `wc:boot` 재전송이 이미 이 세션을 넘겨받았는가" 만 판별하며 `start()` 자체의 실행/재시도 의미는
    바뀌지 않는다. 함께: `beginBootAttempt`/`seedWaitingFromStatus` JSDoc 의 "`start()` 는 world 축만
    필요" 서술과 `18_39_11/concurrency.md` 의 "별도 수정 불필요" 결론을 정정할 것 — 안 그러면 다음
    리뷰가 같은(반증된) 전제를 물려받는다.

- **[INFO]** (검증 완료, 문제 없음) `seedWaitingFromStatus` 내부의 "종료 확정=world 만 / 표면 갱신=world+boot"
  두 staleness 정책 공존 설계는 **`attempt` 토큰을 실제로 전달하는 호출부(= `applyConfig` 복원 분기)
  범위 안에서는 정확하고, 새 race 를 만들지 않는다.** mutation 으로 양방향 모두 재확인.
  - 위치: `seedWaitingFromStatus` 정의 `use-widget.ts:511-572`. world 체크(공통) `:528`·`:563`(catch 분기),
    boot 체크(WAITING 분기 전용) `:541`. JSDoc 표 `:486-496`.
  - **논리적 근거**(코드 검토로 재도출): 종료(terminal) 상태는 실행 상태기계에서 **흡수 상태**이고(한 번
    도달하면 되돌아가지 않음), REST 응답은 dispatch 시점이 아니라 **서버가 그 요청을 처리한 시점**의
    진실을 담는다. 따라서 어떤 `getStatus` 응답이 "종료됨"을 보고하면, 그 응답이 어느 시도(attempt)의
    것이든 또는 몇 번째로 도착했든 **그 시점 서버 상태에 대해 거짓일 수 없다** — 반대로
    `waiting_for_input` 스냅샷은 같은 세션에 대해 여러 번(각기 다른 논리 노드로) 정당하게 나타날 수 있어
    "먼저 발신됐지만 늦게 도착한" 스냅샷이 실제로 더 오래된 콘텐츠를 실어 나를 수 있다 — 그래서 표면
    갱신만 추가 보호가 필요하다는 설계 방향이 맞다.
  - **mutation 재확인**(RESOLUTION.md 표와 대조, 이번 라운드 실측):
    - Mutation A — `:541` 의 `if (attempt && cannotApplyConfig(attempt)) return "stale";` 제거(C2 결함
      되돌림) → 전체 스위트 중 **정확히 1건** 실패(`대체된 시도의 지연 getStatus 가 살아있는 화면을
      옛 노드로 되감지 않는다`). RESOLUTION.md 표의 "WAITING 분기 boot 가드 제거(C2 결함) | 1" 과 일치.
    - Mutation B — 종료 확정 분기(`:534-537`)에 `if (attempt && cannotApplyConfig(attempt)) return
      "stale";` 를 **잘못** 추가("대칭이 예뻐 보인다"는 오판 재현) → 전체 스위트 중 **정확히 1건**
      실패(`대체된 시도가 발견한 종료는 그대로 확정된다`). RESOLUTION.md 표의 "종료 확정에 boot 가드
      추가(반대 방향 오판) | 1" 과 일치.
    - 두 mutation 모두 **서로의 짝 테스트를 건드리지 않았다**(교차 오염 없음) — 두 정책이 실제로
      독립적으로 고정돼 있다는 뜻.
  - **N-way·임의 resolve 순서**: checkpoint 1(`cannotApplyConfig`, `:287-290`)은 `bootGenRef.current !==
    attempt.boot` 단일 부등식이고 `bootGenRef` 는 `beginBootAttempt()`(`:274-277`)에서만 단조 증가한다.
    이 구조상 **임의 시점에 이 부등식을 통과할 수 있는 `attempt` 값은 최대 1개(가장 최근에 발급된
    것)뿐**이며, 한 번 밀려난 값은 카운터가 되돌아가지 않는 한 영원히 재통과 불가능하다 — 이는 겹침
    개수·resolve 순서와 무관한 카운터 불변식이라 3-way 이상에서도 별도 실측 없이 성립이 보장된다(직전
    라운드 INFO#2 의 결론과 일치, 이번에 재확인).

## 요약

이번 diff 가 도입한 "`seedWaitingFromStatus` 안 종료 확정(world 만)·표면 갱신(world+boot) 두 정책 공존"
설계는 그 자체로는 정확하며, 신설된 회귀 테스트 2건이 mutation 으로 양방향 모두 제대로 고정하고 있다 —
직전 라운드 CRITICAL 이 지적한 "대체된 시도의 지연 응답이 살아있는 화면을 되감는다" 문제는 **`applyConfig`
복원 분기 겹침**에 대해서는 확실히 닫혔다. 그러나 이번 실측(격리 detached worktree, mutation 이 아니라
실제 코드 재현)은 그 fix 가 `seedWaitingFromStatus` 의 **세 호출부 중 한 곳만** 보호했음을 보여준다 —
`start()`(eager 부팅) 호출부는 "world 축만 필요하다"는 명시적 JSDoc 근거로 boot 토큰 없이 남겨졌고, 직전
라운드 concurrency 리뷰의 INFO 항목은 "같은 fix 가 이 경로도 닫는다"고 결론지었으나 이는 **반증됐다**.
`start()` 가 새 세션을 storage 에 쓴 직후·자신의 시드 `getStatus` 가 아직 미해결인 좁은 창에 `wc:boot`
재전송이 도착하면, 그 재전송의 복원 분기가 같은 세션을 독립적으로(그리고 boot 토큰으로 보호된 채) 다시
시드하고 스트림을 열 수 있다 — 이후 대화가 SSE 로 전진한 뒤 `start()` 의 원래 시드가 뒤늦게 옛 스냅샷으로
응답하면 boot 가드가 없어 화면이 그대로 되감긴다. 직전 CRITICAL 과 동일한 사용자 영향(고착, 단순 flicker
아님)이고, 이번 PR 이 스스로 기술한 도달 조건(무디바운스 재전송 + eager 즉시시작)만으로 실사용 경로에서
일어날 수 있다. `start()` 에 읽기전용 boot 스냅샷(`beginBootAttempt()` 호출 없이 `bootGenRef.current` 를
그대로 읽어서 전달)을 넘기는 진단 패치로 정확히 이 gap 이 닫히고 기존 56건이 전원 유지됨을 확인했으므로,
수정 자체는 국소적이다.

## 위험도

CRITICAL
