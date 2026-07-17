# 요구사항(Requirement) 리뷰 — webchat-boot-single-flight (23_58_23)

> 범위: 직전 라운드(18_39_11)가 찾은 CRITICAL 3건(A-6 되돌림·concurrency boot 축·JSDoc 재발)을 고친 diff.
> 핵심 검증 대상: (1) `sendCommand` 비-410 경로의 `teardownSession()` 제거 + 리듀서 `RESTORED`/`BOOTED`
> `ended` 가드 제거, (2) `seedWaitingFromStatus` 의 boot 토큰 optional 인자 + WAITING 분기만 게이팅.
> **격리 detached worktree 2개**(`git worktree add --detach`, `node_modules` symlink)에서 mutation
> 재현 + 신규 엣지케이스 재현을 수행하고 모두 제거했다 — 공유 worktree 는 read-only 로 유지했다
> (`git status`/`git diff --stat` 로 세션 종료 시점 무변경 확인).

## 발견사항

- **[INFO] A-6 되돌림 — spec 정합 확인 + mutation 양성 검증 완료**
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:652-697`(`sendCommand`) ·
    `codebase/channel-web-chat/src/lib/widget-state.ts:125-146`(`RESTORED`/`BOOTED`) ·
    `codebase/channel-web-chat/src/lib/eia-client.ts:72-86`(`interact()`).
  - 상세: `spec/7-channel-web-chat/3-auth-session.md` §3.1 본문을 line-level 로 대조했다 — §3.1-3(65-67,
    78-79행)은 storage 정리 조건을 "SSE terminal, 복원 시 200+terminal·404·복구불가 401, 명령 `410 Gone`"
    으로 **닫힌 열거**하며 "그 외 명령 실패"는 없다. §3.1-2(68행)는 "200 + running/waiting_for_input →
    SSE 재연결 → 복원"을 명시한다. `interact()`(`eia-client.ts:82,85`)는 410 만 특수 처리하고 나머지
    `!res.ok`(5xx·409·form 4xx)는 같은 `EiaError` 로 던지므로, 현재 `sendCommand`(else 분기,
    `use-widget.ts:672-693`)가 `teardownSession()` 없이 `ERROR` 만 dispatch 하는 것이 spec 과 정확히
    일치한다. 격리 worktree 에서 `teardownSession()` 을 non-410 분기에 재주입하는 mutation 을 적용하니
    **정확히 설계된 회귀 테스트 2건**(`일시적 명령 실패(500)는 저장 세션을 지우지 않는다`,
    `...새로고침하면 살아있는 대화가 복원된다`)만 실패했다(56개 중 2개). 리듀서의 `RESTORED`/`BOOTED`
    `ended` 가드 재주입 mutation 도 별도 격리 실행에서 **정확히 설계된 2건**만 실패시켰다
    (`widget-state.test.ts`, `RESTORED`/`BOOTED`: `ended` 여도 전이한다). 두 mutation 모두 실행 후 파일을
    원상복구해 `diff` 로 무결성 확인했다.
  - 제안: 없음 — 현재 구현·테스트·spec 삼자가 정확히 정합한다.

- **[INFO] concurrency boot 축 게이팅 — 설계 의도(JSDoc 표) 그대로 구현, 양방향 mutation 검증 완료**
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:511-572`(`seedWaitingFromStatus`) ·
    `:955-976`(`applyConfig` 복원 분기, `attempt` 전달) · `:635`(`start()`, `attempt` 생략).
  - 상세: `seedWaitingFromStatus` 의 JSDoc 표(486-491행)가 "종료 확정=world 만 / 표면 갱신=world+boot"
    두 정책이 한 함수에 공존한다고 명시하고, 코드가 그대로 구현한다 — WAITING 분기(538-541행)만
    `if (attempt && cannotApplyConfig(attempt)) return "stale";` 로 게이팅하고, 종료 확정 분기
    (534-537행)는 `isStale(gen)`(world 단독, 517-528행) 만 통과하면 게이팅 없이 `finalizeEnded` 를
    부른다. `applyConfig` 만 `attempt` 를 넘기고(`beginBootAttempt()` 반환값, 935·966행) `start()`·
    `replay_unavailable` 폴백은 생략한다(504-505행 JSDoc 과 grep 으로 호출부 전수 확인 — 1곳만 3번째
    인자 전달). 격리 worktree 에서 4가지 mutation 을 각각 적용·복원했다:
    1. WAITING 분기의 boot 게이트 제거 → **"대체된 시도의 지연 getStatus 가 살아있는 화면을 옛 노드로
       되감지 않는다"** 1건만 실패(56개 중).
    2. 종료 확정 분기에 (틀린 방향으로) boot 게이트를 **추가** → **"대체된 시도가 발견한 종료는 그대로
       확정된다"** 1건만 실패 — "대칭이 예뻐 보인다"는 유혹으로 반대쪽에 가드를 넣는 실수까지
       테스트가 잡는 것을 확인했다.
    두 mutation 모두 정확히 설계 의도대로 1건씩만 실패해, 두 축 분리 설계가 튼튼하게 고정돼 있음을
    실측으로 확인했다.
  - 제안: 없음.

- **[CRITICAL] `start()`(eager 최초 부팅) 자신의 `seedWaitingFromStatus` 호출은 boot 토큰을 받지 않아, `wc:boot` 재전송과 겹치면 C2 와 동일한 화면 되감기 결함이 그대로 재현된다 — 이 diff 의 CHANGELOG 항목3·JSDoc 주장과 배치**
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:603-650`(`start()`, 특히 `:635`
    `const outcome = await seedWaitingFromStatus(client, session);`(attempt 인자 없음) · `:639`
    `openStream(session, "0")`) · `:955`(`applyConfig` 복원 분기의 `sessionEstablished()` 판정) ·
    `:504-505`(`seedWaitingFromStatus` JSDoc — "`start()`... 는 world 축만 필요하므로 생략") ·
    `CHANGELOG.md:9`(항목3 "대체된 시도는 이제 표면을 그리지 않는다") · 비교 대상(이미 반증됨):
    `review/code/2026/07/17/18_39_11/concurrency.md` 의 `[INFO] start() 진행 중과 wc:boot 재전송이
    겹치는 경로` 항목("위 CRITICAL 의 수정이 이 경로도 함께 닫는다 — 별도 수정 불필요").
  - 상세: 격리 worktree 에서 **신규 재현 테스트**(임시, 검증 후 worktree 통째로 폐기 — 공유 코드에는
    남기지 않음)로 실측했다. 시퀀스:
    1. 첫 `wc:boot` 로 config 확립(저장 세션 없음, 신규 대화).
    2. 사용자가 런처를 클릭 → `actions.open()` → `start()` 진입. webhook POST 는 즉시 202 →
       `BOOTED` dispatch → `persist()` 가 세션을 **즉시 `sessionStorage` 에 기록**(`use-widget.ts:623`)
       → `start()` 자신의 `seedWaitingFromStatus(client, session)` 호출(getStatus **A**, attempt 없음,
       미해결 상태로 둠).
    3. **A 가 아직 안 끝난 상태에서** 두 번째 `wc:boot`(관리자 라이브 미리보기의 외형 폼 재전송,
       `codebase/frontend/src/components/web-chat/live-preview.tsx:116-119` — 디바운스 없이 매
       키입력마다 재전송) 도착. 그 `applyConfig` 는 `sessionEstablished()`(`streamRef.current !== null`)
       를 검사하는데, `start()` 가 **아직 `openStream` 을 안 불렀으므로**(639행은 seed 이후) `false` —
       그래서 재전송은 방금 `start()` 가 persist 한 세션을 "복원 대상"으로 오인해 `loadSession` 에
       성공하고 **자신의** getStatus **B**(attempt 있음)를 낸다.
    4. B 가 먼저 응답(`waiting_for_input`, node `n1`) → `WAITING(n1)` dispatch + `openStream` 성공(재전송이
       스트림 소유). 이어서 SSE 로 대화가 실제 전진(`n2`) → 화면이 올바르게 `n2`.
    5. **A 가 뒤늦게** 옛 스냅샷(`n1`)으로 응답한다. `seedWaitingFromStatus` 안의 WAITING 게이트는
       `attempt && cannotApplyConfig(attempt)` 인데 `start()` 호출은 `attempt` 를 **애초에 넘기지
       않으므로**(`undefined && ...` = falsy) 게이트가 **무조건 통과**한다. `isStale(gen)`(world 축)도
       이 시나리오 내내 world 가 안 바뀌므로(같은 세션, teardown 없음) 걸리지 않는다.
       → **`WAITING(n1)` dispatch 가 그대로 실행돼 화면이 `n2` → `n1` 로 되감긴다**(재현: 최종
       `pending.nodeId = "n1"`, 기대값 `"n2"` — assertion 실패로 확인).
    6. 더 나쁘게, `start()` 는 `outcome==="continue"`(WAITING 분기가 이렇게 반환함) + `isStale(gen)===false`
       이므로 **자신의 `openStream(session, "0")` 도 그대로 실행한다**(639행) — 이건 재전송이 이미 연
       EventSource 를 `closeStream()` 으로 닫고 `lastEventId="0"` 부터 새 연결을 여는 것과 같다.
       `EventSource` 생성 횟수를 계측하니 **1(정상) 이 아니라 2**(재전송이 연 것 + `start()` 가 뒤늦게
       또 연 것) — 단순 표시 되감기를 넘어 **살아있는 SSE 연결 자체가 예기치 않게 churn** 된다.
    - 재현은 pre-existing 테스트 56건(`use-widget-eager-start.test.ts`)이 전부 그대로 통과하는 상태에서
      신규 테스트 1건만 실패하는 형태로 확인했다 — mocking 아티팩트가 아니라 진짜 미보호 경로임을
      뜻한다.
    - `seedWaitingFromStatus` JSDoc(`:504-505`)은 "`start()`... 는 world 축만 필요하므로 생략한다"고
      단언하는데, 이 재현이 그 전제를 반증한다 — world 가 전혀 안 바뀌는 시나리오에서도 화면이
      되감긴다.
    - `review/code/2026/07/17/18_39_11/concurrency.md` 의 동일 경로 INFO 항목은 "위 CRITICAL 의 수정이
      이 경로도 함께 닫는다"고 결론지었으나(다른 CRITICAL 발견들과 달리 "재현 확인" 표시 없이),
      이번 재현으로 그 결론이 **틀렸음이 확인됐다** — WAITING 게이트가 `attempt` 유무로 조건부이기
      때문에 `attempt` 를 안 넘기는 `start()` 호출부는 전혀 보호받지 못한다.
    - `CHANGELOG.md` 항목3 "대체된 시도는 이제 표면을 그리지 않는다"는 일반 주장이지만, 이 경로에서는
      "대체된"(bootGenRef 로 supersede 된) 쪽이 아니라 **애초에 boot 시도로 등록조차 안 되는**
      `start()` 가 화면을 되감으므로, 그 일반화가 이 경로를 놓친다.
  - 제안: `seedWaitingFromStatus` 의 WAITING 분기 게이트를 `attempt` 유무에만 의존하지 말고
    `sessionEstablished()`(또는 동등한 "이 함수 호출 시작 시점 이후 다른 경로가 이미 스트림을
    확립했는가")도 함께 검사하는 방향을 검토할 것 — 예: `if ((attempt && cannotApplyConfig(attempt)) ||
    sessionEstablished()) return "stale";`. 이러면 resend-vs-resend(boot 축)·start-vs-resend(스트림
    확립 여부) 두 경로를 하나의 조건으로 통일해서 닫을 수 있다(단, `start()` 자신의 정상 경로에서는
    아직 스트림이 없으므로 오탐 없음 — 별도 검증 필요). 최소한 이번 라운드에서 처리하지 않는다면
    `plan/in-progress/webchat-boot-single-flight.md` 또는 신규 이월 항목으로 명시적으로 기록해
    "별도 수정 불필요"라는 기존(반증된) 판정이 재인용되지 않게 할 것. `review/code/.../18_39_11/
    concurrency.md` 의 해당 INFO 항목도 정정이 필요하다(과거 리뷰 아카이브라 직접 수정 대상은 아니지만,
    후속 판단 시 근거로 재인용되지 않도록 이 리뷰 결과를 참조시킬 것).

- **[INFO] `ERROR → phase: "ended"` 잔여 gap — 이번 diff 범위 밖으로 적절히 분리, spec 인용 정확**
  - 위치: `plan/in-progress/webchat-command-failure-is-not-termination.md` ·
    `spec/7-channel-web-chat/1-widget-app.md:47`(Form 행) · `use-widget.ts:689-691`(주석의 이월 명시).
  - 상세: `sendCommand` 의 비-410 실패는 여전히 `dispatch({type:"ERROR"...})` → 리듀서가
    `phase:"ended"` 로 보낸다(`widget-state.ts:190-191`). `1-widget-app.md:47` "Form ... 실패 시
    `error.details[{field,message,code}]` 표시·재제출"과 문자 그대로 어긋나는데, 이는 **이 PR 이전부터
    있던 gap**이고(A-6 가 storage 파괴까지 얹었던 걸 되돌렸을 뿐, `ERROR`→`ended` 자체는 안 건드림),
    developer 는 `spec/` write 권한이 없으므로(CLAUDE.md) `webchat-command-failure-is-not-termination.md`
    로 분리해 `project-planner` 트랙으로 넘겼다 — 절차상 올바르다. 인용된 spec 행("실패 시
    error.details 표시·재제출")도 실제 파일과 정확히 일치함을 확인했다.
  - 제안: 없음(추적 중, 이번 diff 책임 범위 아님).

- **[INFO] TODO/FIXME/HACK/XXX·반환값 전수·엣지케이스 나머지 체크리스트 — 클린**
  - 위치: 변경 파일 전체(`widget-state.ts`, `widget-state.test.ts`, `use-widget.ts`,
    `use-widget-eager-start.test.ts`, `CHANGELOG.md`, plan 2개).
  - 상세: `git diff`(merge-base 대비) 및 현재 파일 전수에 TODO/FIXME/HACK/XXX 없음(grep 확인).
    `seedWaitingFromStatus` 는 정상/종료/stale/soft-fail catch 네 경로 모두 `SeedOutcome` 세 값 중
    하나를 명시 반환(빠지는 경로 없음). `RESTORED`/`BOOTED`/`WAITING`/`ERROR` 리듀서 케이스 전부 새
    state 객체를 반환. 위에서 검증한 두 핵심 항목 외에 별도 데이터 유효성·에러 시나리오 결함은
    발견하지 못했다.
  - 제안: 없음.

## 요약

지시받은 두 핵심 항목 — `sendCommand`/리듀서의 A-6 되돌림, `seedWaitingFromStatus` 의 boot 축 개념적
분리(종료 확정=world만, 표면 갱신=world+boot) — 는 `spec/7-channel-web-chat/3-auth-session.md` §3.1-2·
§3.1-3 및 `2-sdk.md §3(재전송)` 본문과 line-level 로 정합하며, 격리 detached worktree 에서의 mutation
재현(4가지 변형, 양방향)이 각각 정확히 설계된 회귀 테스트 1~2건만으로 잡히는 것을 확인해 "새 회귀를
만들지 않는다"는 요청 사항을 만족한다고 판단한다. 다만 같은 checklist 의 "엣지 케이스" 관점에서 독립
재현한 결과, `start()`(eager 최초 부팅) 자신의 `seedWaitingFromStatus` 호출이 `attempt` 토큰을 아예
받지 않는다는 설계상 허점 때문에 **동일한 화면 되감기 결함이 재전송과 첫 open 이 겹치는 시나리오에서
여전히 재현된다**(1개 신규 CRITICAL). 이 경로는 이번 diff 가 새로 만든 것은 아니지만(이 diff 이전에도
동일하게 무방비였다), 이번 diff 의 CHANGELOG 항목3 "대체된 시도는 이제 표면을 그리지 않는다"는 일반
주장 및 직전 라운드 concurrency 리뷰의 "별도 수정 불필요" 판정과 정면으로 배치되며 재현 근거 없이
내려진 그 판정을 반증한다. 나머지(TODO 부재, 반환값 전수, `ERROR`/`ended` 잔여 gap 의 적절한 분리
절차)는 이상 없음을 확인했다.

## 위험도

CRITICAL — 지시받은 두 핵심 fix 자체는 견고하게 검증됐으나(그 부분만 보면 위험도 NONE~LOW), 인접
경로(`start()` vs 재전송 겹침)에서 동일 심각도(대화 고착)의 미보호 지점을 실측 재현했다. 이번 라운드
scope 안에서 fix 하거나, 최소한 명시적 이월 기록 + 회귀 테스트 계획을 남길 것을 권한다.

STATUS=success requirement PATH=/Volumes/project/private/clemvion/.claude/worktrees/webchat-boot-single-flight-8c92b4/review/code/2026/07/17/23_58_23/requirement.md RESET_HINT=
