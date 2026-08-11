# 요구사항(Requirement) Review — `18_23_54`

## 범위 확정

orchestrator 지시대로, 이번 delta 는 직전 라운드(`17_55_57`, Critical 1 · Warning 5)의 처분
커밋 `36bc55fa5` 다. `git show 36bc55fa5 --stat` 로 실측하면 동작을 바꾸는 파일은 둘뿐이다:

- `codebase/channel-web-chat/src/widget/use-widget.ts` — `resumeDeferredStreamRef.current`
  안에서 `deferredStreamRef.current = false` 를 `openStream(session, "0")` **호출 앞**에서
  **뒤**로 이동(플래그 클리어 위치 이동).
- `codebase/channel-web-chat/src/widget/use-token-refresh.ts` — `onRefreshedRef.current?.(updated)`
  호출을 `try/catch` 로 격리(`onRefreshed` 예외 격리) + `scheduleRefresh(retryDelay?)` 를
  내부 전용 `scheduleWithDelay` + 무인자 공개 래퍼로 분리(비동작 리팩터).

나머지(`use-token-refresh.test.ts`/`use-widget-eager-start.test.ts` 신규 테스트,
`webchat-auth-session-status-reconcile.md` 문서 정정)는 테스트/문서 추가일 뿐 런타임 동작을
바꾸지 않는다. 아래는 두 동작 변경을 spec 본문(`3-auth-session.md` §3.1-2·§R4)과 line-level
로 대조한 결과다. 코드는 `Read`/`git show` 로 직접 확인했다(prompt 는 파일 4/5/7 의 diff 를
크기 제한으로 생략했다).

## 발견사항

- **[INFO]** (a) 플래그 클리어 위치 이동 — §R4 "그 시점에 SSE 를 연다" 와 일치, 재시도는
  §R4 문언 밖의 방어적 세부라 spec 갱신 불요로 판정
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:742-760`
    (`resumeDeferredStreamRef.current = (session) => { ... }`)
  - 상세: 종전엔 `deferredStreamRef.current = false` 가 `openStream(...)` **호출 전**에 실행돼,
    `openStream` 내부의 `new URL(joinUrl(apiBase, endpoints.stream))`(`eia-client.ts:130`)이
    손상된 저장 세션 조합에 동기 throw 하면 "미뤄 뒀다" 는 의사가 영구 소실됐다 — 이후 갱신이
    계속 성공해도 스트림이 다시 열리지 않는 조용한 고착이었다. 지금은 `openStream(session, "0")`
    호출 뒤에 플래그를 지운다(`use-widget.ts:758-759`). `openStream` 이 throw 하면 그 지점에서
    함수가 즉시 중단되므로 `deferredStreamRef.current = false` 줄에 도달하지 못하고, 플래그는
    `true` 로 남아 **다음 성공한 갱신 주기가 다시 시도**한다 — `use-widget-eager-start.test.ts`
    의 신규 케이스("§R4: 미뤄 둔 스트림 오픈이 던져도 다음 갱신이 다시 시도한다")가 이 경로를
    실측한다(첫 `EventSource` 생성만 던지게 만들고, 2단계에서 `getEs()).not.toBeNull()` 확인).
    §R4 본문은 "**갱신이 성공하면** 그 시점에 SSE 를 연다. 갱신 실패는 지수 백오프로 재시도한다"
    라고만 적었다 — "SSE 를 여는 시도 자체가 (malformed URL 등으로) 실패했을 때" 의 재시도는
    R4 가 정의하는 상태공간(갱신 성공/실패) 밖의 **세 번째 실패 모드**다. 그래도 spec 반영이
    필요하다고 보지 않는다: (1) 이 조건은 저장된 `endpoints`/`apiBase` 가 손상된 비정상
    상태에서만 발생하는 방어 코드이지 정상 업무 규칙이 아니다. (2) 이 코드베이스는 이미 같은
    성격의 근-등가 방어 분기(`teardownSession` 의 `deferredStreamRef.current = false`
    — `use-widget.ts:341-349`, `resumeDeferredStream` 의 no-op 가드 — 같은 파일:743-748)를
    spec 이 아니라 **코드 주석**으로만 근거를 남기는 관례를 이미 확립했다(둘 다 이번 라운드
    직전인 `17_55_57` testing WARNING 의 직접 처분). 이번 재시도 방어도 그 관례와 같은 층위다.
  - 제안: 조치 불요. spec 을 더 정밀하게 하고 싶다면 §R4 말미에 "SSE 오픈 시도 자체가 실패하면
    다음 갱신 성공 시 재시도한다(방어적 재시도, 정상 흐름 아님)" 한 문장을 추가할 수 있으나
    필수 아님 — `project-planner` 판단 사항으로 남긴다.

- **[INFO]** (b) `onRefreshed` 예외 격리 — §R4 "갱신 성공/실패" 이분법을 코드가 이제
  정확히 지킨다(종전엔 소비자 예외가 성공을 실패로 오분류시켰다)
  - 위치: `codebase/channel-web-chat/src/widget/use-token-refresh.ts:157-174`
    (`.then(({ token, expiresAt }) => { ... try { onRefreshedRef.current?.(updated); }
    catch (notifyErr) { console.warn(...); } scheduleWithDelay(); })`)
  - 상세: `try`/`catch` 는 `onRefreshedRef.current?.(updated)` 호출만 감싸고, 뒤이은
    `scheduleWithDelay()`(무인자 — 공개 진입과 동일 의미, `failuresRef` 리셋 + 다음 만료 기준
    재예약)는 **catch 절 밖**에서 무조건 실행된다. 즉 `resumeDeferredStreamRef.current` 가
    (a)의 malformed URL 경로로 동기 throw 해도 그 예외는 `.then()` 체인의 `.catch((err) =>
    { failuresRef.current += 1; scheduleWithDelay(retryDelayMs(...)); })` 로 떨어지지
    않는다 — `refreshToken()` 자체는 성공했으므로 실패 카운터·백오프에 반영되지 않고, 정상
    재예약(§R4 "갱신이 성공하면...")이 그대로 이어진다. `use-token-refresh.test.ts` 의
    "onRefreshed 가 throw 해도 갱신은 성공으로 취급된다 — 백오프로 떨어지지 않는다" 케이스가
    이를 직접 관측 축(다음 발화 시점 — 정상 60분 vs 백오프 5초)으로 검증한다. 이는 §R4 를
    깨는 변경이 아니라 **§R4 를 어기고 있던 기존 버그를 고친 것**이다 — 종전엔 소비자
    (`resumeDeferredStream`)의 우발적 예외가 있으면 "갱신 성공"이 "갱신 실패"로 재분류돼
    §R4 가 규정하지 않은 세 번째 갈래(성공했는데 실패로 처리)가 발생했다.
  - 제안: 조치 불요.
  - 참고(비동작): 같은 diff 의 `scheduleRefresh(retryDelay?)` → `scheduleWithDelay`+무인자
    공개 래퍼 분리는 순수 시그니처 정리이고, `use-widget.ts` 의 두 호출부
    (`use-widget.ts:850`, `:1213`)는 이미 인자 없이 `scheduleRefresh()` 만 호출하므로 호출부
    변경이 불필요했다 — 뮤테이션 회귀 없이도 안전.

- **[INFO(확인)]** `status: implemented` 판정은 이번 delta 로 흔들리지 않는다
  - 위치: `spec/7-channel-web-chat/3-auth-session.md:1-13`(frontmatter),
    `plan/in-progress/webchat-auth-session-status-reconcile.md:1-257`
  - 상세: frontmatter 는 `status: implemented` 이고 `pending_plans` 필드가 없다(§3 가드 기준
    정당 — 승격을 만든 plan `webchat-reload-rest-error-branches.md` 는 이미 `plan/complete/`
    로 이동돼 있다). 이번 delta(`36bc55fa5`)가 손대는 두 동작은 §3.1-2·§R4 가 **이미 확정
    서술한** 재로드 `401` 낙관적 refresh 시퀀스의 **버그 수정**(플래그 순서·예외 격리)일 뿐,
    spec 이 아직 약속하지 않은 새 기능을 추가하지 않는다 — `spec-impl-evidence.md §3` 의
    "**모든** 약속 구현 완료" 기준에서 "약속" 집합 자체가 늘지 않았으므로 `implemented` 유지가
    맞다. `webchat-auth-session-status-reconcile.md` 에 남은 미체크 항목들(`start()` 경로 401
    갭·refresh 동시 발화 경합·`catch` 분기 세대 재검사 미검증·주기 갱신 terminal 시 storage
    미정리)은 전부 (i) §3.1-3 이 열거하는 정리 트리거(종료 이벤트·복원 200+terminal/404/
    401·410·명령 410 Gone) 밖에 있는 별도 축이거나, (ii) 이미 구현된 분기의 테스트 커버리지/
    동시성 하드닝 갭이지 "spec 이 약속했는데 코드에 없는 것"이 아니다 — 문서 자신도
    "실측 필요"/"범위 밖"으로 명시 처분해 뒀다(§주기 갱신이 terminal 을 만나도 세션을 정리하지
    않는다: "이 PR 에서 안 고치는 이유"). 따라서 `implemented` 판정에 영향을 주는 새로운
    미구현 약속은 없다.
  - 제안: 조치 불요. `start()` 경로 401 도달 가능성 실측 등 plan 의 잔여 체크박스는 별도
    후속 세션의 몫으로 이미 위임돼 있다.

- **[INFO(확인)]** 두 동작 변경이 만드는 상호작용에서 데이터 정합성 훼손 없음
  - 위치: `use-widget.ts:452-477`(`openStream`, `streamRef.current !== null` 게이트),
    `use-widget.ts:276`(`onRefreshed: (session) => resumeDeferredStreamRef.current?.(session)`)
  - 상세: `closeStream()` 뒤 `streamRef.current = client.openStream(...)` 대입이므로,
    `client.openStream` 이 동기 throw 해도 `streamRef.current` 는 `null` 로 남는다(부분 상태
    오염 없음) — 재시도가 안전하게 같은 자리에서 다시 시작할 수 있다. `onRefreshed` 로 전달되는
    `session` 파라미터는 `applyRefreshedToken` 이 방금 만든 `updated` 그 자체(같은 tick, 같은
    객체 참조)이므로 이전 라운드(`16_09_40`)에서 CRITICAL 이었던 "stale 캡처 변수로 SSE 오픈"
    형태가 이 경로엔 재발하지 않는다.
  - 제안: 조치 불요.

## 검증 (직접 실행)

- `cd codebase/channel-web-chat && npx vitest run src/widget/use-token-refresh.test.ts
  src/widget/use-widget-eager-start.test.ts` → **93 passed**.
- `cd codebase/channel-web-chat && npx tsc --noEmit -p .` → 에러 0.
- 뮤테이션은 재실행하지 않았다(워킹트리 비파괴 원칙) — RESOLUTION 이 주장하는 "낙관적 클리어
  복원 RED / 예외 격리 제거 RED" 는 위에서 추적한 호출 경로(동기 throw 전파 지점, catch 범위)
  로 논리 검증했고, 신규 테스트 2건(`use-token-refresh.test.ts` 의 "onRefreshed 가 throw",
  `use-widget-eager-start.test.ts` 의 "§R4: 미뤄 둔 스트림 오픈이 던져도...") 이 각 변경을
  정확히 겨냥하는 관측 축(다음 발화 시점 / `getEs()` null→not-null 전이)을 갖고 있음을
  코드로 확인했다.

## 요약

이번 delta 의 두 동작 변경 — (a) `resumeDeferredStream` 의 플래그 클리어를 `openStream` 호출
뒤로 이동, (b) `useTokenRefresh` 의 `onRefreshed` 호출을 `try/catch` 로 격리 — 는 모두
§3.1-2·§R4 서술과 일치한다. (b)는 오히려 종전에 §R4 의 "갱신 성공/실패" 이분법을 어기고 있던
버그(소비자 예외가 성공한 갱신을 실패로 오분류)를 바로잡는 방향이다. (a)가 만드는 "SSE 오픈
시도 자체가 실패하면 다음 갱신 성공 때 재시도한다"는 §R4 문언이 명시하지 않는 세 번째 갈래이지만,
저장 세션이 손상된 비정상 상태에서만 발동하는 방어 코드이고 이 코드베이스가 이미 같은 성격의
근-등가 방어 분기를 spec 이 아니라 코드 주석으로 근거를 남겨 온 관례와 정합적이라 — spec 반영이
필수는 아닌 구현 세부로 판정한다(SPEC-DRIFT 아님, 굳이 반영한다면 project-planner 판단의
선택 사항). `status: implemented` 는 이번 delta 가 spec 이 약속한 상태공간을 넓히지 않으므로
그대로 유지되는 것이 맞다. 두 변경 모두 실제 vitest(93 passed)·tsc(0 errors)로 확인했고, 첫
호출 지점에서의 동기 throw 전파 경로(`streamRef.current` 부분오염 없음, `session` 파라미터
staleness 없음)도 코드 추적으로 검증했다. CRITICAL/WARNING 급 이탈은 발견되지 않았다.

## 위험도

NONE
