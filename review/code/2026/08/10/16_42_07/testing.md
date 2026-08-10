# 테스트(Testing) Review

## 검증 방법

정적 리뷰만으로는 "vacuous 여부"·"뮤테이션 RED 주장의 진위"를 판정할 수 없어, 실제로 로컬에서
뮤테이션 테스트를 재현했다. 대상 파일은 이 워크트리가 다른 세션과 공유되므로 `git checkout`/
`stash`/`reset` 을 쓰지 않고 `cp` 로 백업 → Python 스크립트로 정확한 문자열 치환 뮤테이션 →
`pnpm vitest run` → `cp` 로 원복(→ `diff` 로 바이트 동일성 확인) 절차를 4회 반복했다. 마지막
확인 시점에 `codebase/channel-web-chat/src/widget/use-widget.ts`·`use-widget-eager-start.test.ts`·
`CHANGELOG.md`·`spec/7-channel-web-chat/3-auth-session.md` 가 **동시 진행 중인 다른 세션**에 의해
추가로 수정되고 있는 것을 발견했다(내 첫 백업 시점엔 없던 `recoverFromExpiredToken` 블록 재배치가
이후 백업엔 없다가 최종 확인에서 나타남) — 내 `cp` 복원은 매번 직전 백업과 바이트 단위로 동일함을
`diff` 로 확인했으므로 그 세션의 작업을 덮어쓰지 않았다. 이 보고서의 라인 인용은 뮤테이션 검증을
수행한 스냅숏(커밋 `31b14aa22`, 리뷰 프롬프트가 가리키는 diff) 기준이며, 그 스냅숏 이후의 재배치는
순수 위치 이동(콘텐츠 동일, `git diff HEAD` 로 확인)이라 아래 판정에 영향 없다.

## 발견사항

- **[INFO]** 세대 재검사(`isStale(gen)`) 사각지대 처분 — (a) 재현 시도 (b) 실패 (c) 가드 주석+plan
  기록 — 실측으로 정확함을 재확인했다
  - 위치: `plan/in-progress/webchat-auth-session-status-reconcile.md:118-141`(§`catch` 분기 세대
    재검사가 회귀로 안 묶여 있다), 함수 `recoverFromExpiredToken`(`codebase/channel-web-chat/src/widget/use-widget.ts`,
    catch 블록의 두 번째 `isStale(gen)` 재검사 — 이 diff 로 위치가 재배치 중이라 게이트 대신
    함수명으로 표기)
  - 상세: 직접 뮤테이션 2건으로 확인했다.
    1. 성공 분기의 `isStale(gen)`(첫 번째, `applyRefreshedToken` 직전)을 제거 → `§R4: refresh
       왕복 중 세계가 바뀌면 새 토큰을 옛 세션에 쓰지 않는다` 테스트가 **RED**(늦게 도착한
       토큰이 종료된 storage 를 되살림).
    2. catch(재차 실패) 분기의 `isStale(gen)`을 제거 → 전체 68건이 **전부 GREEN**(생존, 잡는
       테스트 없음).
    코드 주석("이쪽은 제거해도 초록이다 — 실측, ai-review `16_26_09` testing 이 반증")과 plan
    문서의 서술이 이 실측과 정확히 일치한다. "재현 실패는 부재의 증거가 아니다"라며 가드를
    남기고 미검증 사실만 정직하게 기록한 처분은 적절하다 — 통과할 때까지 테스트를 구부리거나,
    반대로 "검증됐다"고 과장하지 않았다.
  - 제안: 처분 자체는 문제없음. plan 의 후속 항목("그 분기를 실제로 갈라내는 인터리빙 탐색")이
    닫히기 전까지는 이 분기가 실서비스에서도 미검증 상태라는 점을 백로그 우선순위에 유지할 것.

- **[WARNING]** 신규 "네트워크 오류 soft-fail" 회귀는 non-vacuous 하지만, `EiaError`이면서
  `401`/`410`이 아닌 상태(예: refresh 왕복이 `500`을 반환하는 경우)를 가르는 축은 어떤 테스트도
  겨냥하지 않는다
  - 위치: 함수 `recoverFromExpiredToken`의 `terminal` 판정(`refreshErr instanceof EiaError &&
    (refreshErr.status === 401 || refreshErr.status === 410)`, `codebase/channel-web-chat/src/widget/use-widget.ts`)
    / 회귀 테스트 `it("§R4: refresh 가 **네트워크 오류**로 실패하면 종료로 확정하지 않는다", ...)`
    (`codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts` — 이번 diff 는 프롬프트
    크기 제한으로 생략돼 게이트 없음, 테스트명으로 표기)
  - 상세: 뮤테이션 2건으로 대조했다.
    1. `terminal = true`(조건 완전 제거) → 신규 회귀 **RED**. 커밋 메시지(`31b14aa22`)의 "뮤테이션
       RED" 주장과 일치 — 이 회귀는 vacuous 하지 않다.
    2. `terminal = refreshErr instanceof EiaError`(상태 필터만 제거, `instanceof` 축은 유지) →
       파일 전체 68건이 **전부 GREEN**. 신규 회귀는 `TypeError`(비-`EiaError`, `status` 없음)만
       주므로 "EiaError 인가"라는 한 축만 가른다. `EiaError` 이면서 `401`/`410` 이 아닌 상태(가장
       현실적인 예: 서버 500)로 refresh 가 실패하는 경우를 다루는 테스트가 없어, 이 조건에서
       상태 필터가 통째로 사라져도(모든 `EiaError`를 종료로 취급) 잡히지 않는다. 파일에 이미
       있는 "그 외 오류는 여전히 soft-fail — 500" 테스트는 `seedWaitingFromStatus` 자신의
       `getStatus` 실패만 500 으로 만들 뿐 `refresh-token` 엔드포인트는 아예 모킹하지 않아
       `recoverFromExpiredToken` 내부의 이 조건을 건드리지 않는다(직접 확인).
    이 갭이 실제로 위험한 이유: 이 diff 의 핵심 요구사항이 "§R4: 재차 실패가 **401/410 일 때만**
    종료"인데, 그 상태 필터 자체를 넓히는 방향의 회귀(가장 있을 법한 실수 — `EiaError`인 것만
    보고 상태를 안 가리는 것)를 지금 테스트 스위트가 검출하지 못한다.
  - 제안: `refresh-token` 왕복이 `EiaError(status: 500)` 등 401/410 이 아닌 HTTP 오류로 실패하는
    케이스를 회귀 1건 추가해 상태-필터 축을 직접 겨냥할 것(현재 네트워크-오류 테스트는 `instanceof
    EiaError` 축만 가른다).

- **[INFO]** 공유 헬퍼 `applyRefreshedToken` 추출의 "뮤테이션 RED 2건" 주장(RESOLUTION §5) 검증 —
  실측 일치, 다만 직접 단위 테스트는 없음(간접 커버리지)
  - 위치: `codebase/channel-web-chat/src/lib/session-store.ts:125-133`(함수 정의, 게이트 확인됨) /
    호출부 `codebase/channel-web-chat/src/widget/use-token-refresh.ts:93-97`(게이트 확인됨)
  - 상세: `saveSession(triggerEndpointPath, updated)` 호출을 제거하는 뮤턴트로 확인 → 정확히
    2건 RED(`use-token-refresh.test.ts` 1건, `use-widget-eager-start.test.ts` 1건) — RESOLUTION
    의 주장과 일치. 다만 `session-store.test.ts`(같은 파일의 기존 단위 테스트)에는
    `applyRefreshedToken` 자체를 직접 겨냥하는 테스트가 없다 — 두 호출부 테스트가 결과적으로
    잡고 있어 당장 회귀 위험은 낮지만, 실패 시 "공유 헬퍼 버그"와 "호출부 배선 버그"를 구분하는
    데 두 테스트 파일을 오가야 한다.
  - 제안: 우선순위 낮음. `session-store.test.ts` 에 "기존 필드(`apiBase`/`endpoints`/
    `executionId`) 보존 + `token`/`expiresAt` 교체 + `saveSession` 호출"을 직접 단언하는 테스트
    1건을 추가하면 실패 국지화 비용이 줄어든다.

- **[INFO]** 테스트 격리 — 양호
  - 위치: 전역 `beforeEach`/`afterEach` 블록(`codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts`,
    이번 diff 에 포함되지 않은 기존 코드 — 게이트 없음)
  - 상세: `beforeEach` 가 `sessionStorage.clear()` + `EventSource` stub 재설치, `afterEach` 가
    `vi.unstubAllGlobals()`/`useRealTimers()`/`restoreAllMocks()` 를 수행해 신규 5건(404/401-성공/
    세계 변경/401-재실패/네트워크-오류) 및 기존 500 테스트가 상호·전역 68건과 격리됨을 확인했다.
    `start()` 경로 401 테스트를 시도했다가 실패해 제거했다는 plan 서술대로, 코드에는 `it.skip`/
    `it.todo` 등 미완성 흔적이 전혀 남아있지 않다 — "통과할 때까지 구부리지 않는다"는 원칙이
    실제로 지켜졌다.

- **[INFO]** 전체 회귀·타입체크 확인
  - 위젯 전체 `pnpm vitest run` **415/415 통과**, `pnpm exec tsc --noEmit` **0 errors** — 커밋
    메시지(`31b14aa22`, RESOLUTION)의 검증 수치와 일치한다.

## 요약

이번 라운드가 다룬 두 축(세대 재검사 처분의 정직성, 신규 네트워크-오류 soft-fail 회귀의
non-vacuity) 은 뮤테이션 재현으로 모두 확인했다 — 처분은 실제로 (재현 시도→실패→미검증 기록)
순서를 밟았고 코드 주석·plan 서술이 실측과 정확히 일치하며, 신규 회귀는 겨냥한 뮤턴트(`terminal`
조건 완전 제거)에 대해 실제로 RED 다. 다만 이번 검증 과정에서 새로운 커버리지 갭 1건을 직접
찾았다: 신규 회귀는 "`EiaError` 인가"라는 한 축만 가르고 "`401`/`410` 인가"라는, 이 diff 의
핵심 요구사항인 상태-필터 축은 어떤 테스트도 겨냥하지 않는다(뮤테이션 실측 — 상태 필터를
통째로 제거해도 68건 전부 GREEN). `applyRefreshedToken` 공유 헬퍼도 뮤테이션 RED 2건은 실측
일치하나 직접 단위 테스트가 없어 실패 국지화 비용이 남아 있다. 두 항목 모두 CRITICAL 급은
아니며(현재 실서비스에서 refresh 왕복이 `401`/`410` 외 `EiaError`를 던지는 경로 자체가 흔치
않을 수 있음), 다음에 이 분기를 다시 손볼 때 함께 닫을 만한 WARNING/INFO 수준이다.

## 위험도

LOW
