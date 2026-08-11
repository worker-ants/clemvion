# 문서화(Documentation) Review

대상: 프롬프트가 지시한 40파일(웹채팅 재로드 REST 오류 분기 3~4라운드 누적 diff + 3라운드 리뷰
산출물). 지시받은 핵심 확인 축 — **`SeedOutcome` 반환값이 `"continue"` → `"stale"` 로 바뀐 지점을
서술하는 모든 자리(JSDoc·CHANGELOG·spec·타입 독스트링)가 stale 하지 않은가** — 를 저장소 전체에서
확인했다. `use-widget.ts`/`use-widget-eager-start.test.ts` 는 diff 가 프롬프트 크기 제한으로 생략돼
있어 `Read`/`Grep` 으로 소스를 직접 열어 대조했다.

**중요 — 이 리뷰는 살아있는 워크트리를 대상으로 했다.** 대상 파일(`use-widget.ts`)이 다른 세션에
의해 조사 도중에도 계속 편집되고 있음을 직접 확인했다(`git diff HEAD` 로 확인한 커밋되지 않은
변경). 아래 발견사항의 줄 번호는 확인 시각(2026-08-10 17:06 KST, `git status --short` 로 동일 2파일
수정 상태 재확인) 기준이며, 이후 다시 바뀌었을 수 있다.

## 발견사항

- **[WARNING]** 지시받은 핵심 확인 대상 그 자체 — `seedWaitingFromStatus` JSDoc 의 "REST 오류 분기"
  목록이 `"continue"` → `"stale"` 전환을 반영하지 못해 코드와 반대로 서술한다
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:495-496`(REST 오류 분기 불릿) — 실제
    코드는 `:434-448`(`recoverFromExpiredToken` 의 non-terminal catch, `return "stale";` at `:448`).
  - 상세: `:495-496` 은 "재차 `401`·`410` → `"ended"`(복구 불가 확정, §R4). 그 **외** 실패(네트워크
    등)는 `"continue"` — 일시적 장애가 대화를 끝내지 않게 하는 경계다." 라고 적는다. 그러나 그 분기의
    실제 구현(`:434-448`)은 `"continue"` 를 반환하지 않는다 — 진행 중인 인라인 주석(`:439-447`)이
    직접 설명하듯 "**`"continue"` 를 돌려주면 안 된다** ... 진행하면 거부된 토큰으로 새 SSE 를 열어
    이 변경이 고치려던 'streaming 고착' 을 그대로 재현한다(ai-review `16_42_07` side_effect
    CRITICAL)" 는 이유로 `"stale"` 을 반환한다. 즉 이 JSDoc 불릿은 **바로 몇 줄 아래 자기 자신의
    인라인 주석과 정면으로 모순**되는 상태로 남아 있다. `08bd668a5`("종료 조건 서술 5+2 자리")
    커밋이 이 줄을 `401`→`401`/`410` 축으로만 갱신하고 `"continue"`→`"stale"` 축은 놓쳤다 — 코드가
    먼저(`31b14aa22`~) 이 값을 바꿨는데, 그 이후 이 줄을 만진 유일한 커밋(`08bd668a5`)도 반환값
    리터럴은 손대지 않았다.
  - 제안: `:495-496` 을 "그 외 실패(네트워크 등)는 `"stale"`(세션 보존, 이번 왕복만 포기 — 다음
    주기 갱신에 위임)" 로 정정. (아래 두 번째 발견사항 — 타입에 `"refresh_deferred"` 가 이미
    추가돼 있음 — 이 먼저 코드에 배선되면 그 값으로 갱신.)

- **[WARNING]** (관찰, 시점 의존적) `SeedOutcome` 타입에 새 리터럴 `"refresh_deferred"` 가 이미
  선언됐지만, 그 리터럴을 실제로 반환하는 코드·이를 구분해 처리하는 호출부·`@returns` 문서 어디에도
  아직 배선되지 않았다 — 문서(타입 독스트링)가 아직 존재하지 않는 동작을 확정 서술한다
  - 위치: 타입 선언 `codebase/channel-web-chat/src/widget/use-widget.ts:94-106`(신규 `"refresh_deferred"`
    유니언 멤버, 독스트링이 `16_56_39` 라는 **이 라운드 자신**을 인용해 "내가 `"stale"` 로 고치며
    만든 결함" 이라 적는다) vs 실제 반환 지점 `:448`(여전히 `return "stale";`, `"refresh_deferred"`
    아님) vs 호출부 `:698-699`(`start()`, `if (outcome !== "continue") return;`)·`:1050-1051`
    (`applyConfig()`, 동일 패턴) — 둘 다 `"stale"`/`"refresh_deferred"`/`"ended"` 를 구분하지 않고
    전부 `openStream`+`scheduleRefresh` 를 건너뛴다.
  - 상세: `:97-102` 의 독스트링은 "호출부는 **스트림만 건너뛰고 `scheduleRefresh` 는 건다**"·
    "`"stale"` 로 두면 호출부가 `scheduleRefresh` 까지 건너뛰는데, 그건 이 세션의 **유일한** 주기
    갱신 예약 지점이라 복구 사이클이 아예 없어져 스피너에 영구 고착된다" 고 **확정적으로** 서술한다.
    그런데 지금 이 순간의 코드는: (1) 그 분기가 여전히 `"stale"` 을 반환하고(`:448`), (2) 두
    호출부 모두 `outcome !== "continue"` 한 줄로만 게이팅해 `"stale"`·`"refresh_deferred"`·`"ended"`
    를 구분하지 않으므로, 독스트링이 "고쳤다"고 서술하는 그 사이클 유실 문제가 **아직 코드 어디에도
    고쳐져 있지 않다**. `@returns` 블록(`:503-512`)도 `"refresh_deferred"` 를 전혀 언급하지 않고,
    `CHANGELOG.md`·`spec/7-channel-web-chat/3-auth-session.md`·테스트 파일
    (`use-widget-eager-start.test.ts`, `scheduleRefresh`/`refresh_deferred` grep 결과 미발견)
    어디에도 이 새 값은 등장하지 않는다. 이 발견사항은 **작성 시점 스냅샷**이다 — 이 워크트리가
    다른 세션과 공유되고 있음을 직접 확인했으므로(같은 2파일이 지속적으로 미커밋 상태로 바뀜),
    보고서를 읽는 시점엔 이미 배선이 끝나 있을 수 있다. 다만 그 경우에도 아래가 함께 갱신됐는지는
    별도로 확인이 필요하다 — 타입 독스트링만 먼저 쓰이고 구현·호출부·`@returns`·CHANGELOG·spec·
    테스트가 뒤따르지 않는 이 패턴 자체가, 이 세션이 이미 여러 차례 반복해 겪은 "한 곳만 고치고
    인접 서술을 안 맞춘다" 클래스(예: `16_26_09` documentation WARNING #2, `08bd668a5` 커밋 메시지
    자신의 "전수가 여섯 번 틀렸다" 회고)의 재현이다.
  - 제안: 머지 전 최종 상태에서 다음을 함께 확인할 것 — (a) `:448` 이 `"refresh_deferred"` 로
    바뀌었는지, (b) `start()`/`applyConfig()` 두 호출부가 `"refresh_deferred"` 를 별도 분기로 받아
    `openStream` 은 건너뛰고 `scheduleRefresh` 는 호출하는지, (c) `@returns`·`SeedOutcome` 각
    유니언 멤버 독스트링·CHANGELOG·spec 이 네 번째 값을 반영하는지.

- **[WARNING]** `SeedOutcome` 타입의 `"stale"` 유니언 멤버 독스트링과 함수 `@returns` 의 `"stale"`
  설명이 여전히 "await 사이 세션 교체" 의미만 서술 — 위 첫 항목의 재사용(refresh 비-terminal
  실패)까지 커버하지 못한다
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:90`(`| "stale"` 독스트링: "await 사이
    세션이 교체·초기화됨 → 응답을 폐기함(아무 상태도 안 건드림)."), `:506-507`(`@returns` 안의
    `"stale"` 설명: "`"stale"`(await 사이 세션 교체)은 지연 응답이 새 대화의 스트림을 옛 토큰으로
    탈취하는 것을 막는다.")
  - 상세: 이 두 서술은 `"stale"` 의 **원래** 의미(세대 재검사 실패 — 다른 시도가 세계를 이미
    바꿨음)만 정의한다. 그러나 `:448`(위 첫 항목)은 **완전히 다른 트리거**로 같은 리터럴을
    반환한다 — "await 사이 세션이 교체됨" 이 아니라 "refresh POST 자체가 네트워크/5xx 로 실패해
    세션은 그대로인데 이번 갱신 시도만 포기함". 코드 안 인라인 주석(`:446`, "포기한다:
    `"stale"` 이 정확히 그 뜻이다(아무 상태도 안 건드리고 호출부는 멈춘다)")이 이미 그 재사용을
    설명하지만, 타입 독스트링과 `@returns` 는 여전히 원래 뜻 하나만 적어 이 함수의 반환 계약을
    타입 정의만 보고 파악하려는 독자를 오도한다. (위 두 번째 발견사항의 `"refresh_deferred"` 배선이
    완료되면 이 불일치는 자연히 해소되지만, **그 배선이 끝나기 전까지는** 이 서술이 stale 하다.)
  - 제안: `"refresh_deferred"` 배선이 끝날 때까지는 최소한 `:90`·`:506-507` 에 "refresh 자체가
    비-terminal 사유로 실패한 경우도 이 값을 재사용한다(세션 보존, 이번 왕복만 포기)" 한 구절을
    추가.

- **[INFO]** `recoverFromExpiredToken` 자신의 JSDoc 에는 `@returns` 태그가 없다 — 형제 함수
  `seedWaitingFromStatus` 의 방대한 반환 계약 문서와 비대칭이고, 하필 이 함수의 반환값 선택이
  이번 라운드 CRITICAL 의 근원이다
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:384-402`(`recoverFromExpiredToken`
    JSDoc 전체 — `@param gen` 만 있고 `@returns` 없음) vs `:464-548`(`seedWaitingFromStatus` 의
    `@returns` 포함 81줄 JSDoc).
  - 상세: 이 함수는 `"continue"`(성공)·`"stale"`(세대 충돌 2곳, 그리고 위 첫 항목의 재사용)·
    `"ended"`(재차 401/410) 세 갈래를 반환하는데, 그 계약이 함수 선언부 어디에도 명시돼 있지
    않다 — 오직 각 분기의 인라인 주석을 하나씩 읽어야만 전체 그림이 잡힌다. 이 파일 자신이
    "staleness 정책이 두 개 공존한다 — 합치지 말 것" 같은 표까지 만들어 반환값 계약을 상세히
    문서화하는 관례를 갖고 있는데, 정작 이번 라운드의 버그 근원이 된 함수에는 그 관례가 적용되지
    않았다.
  - 제안: `recoverFromExpiredToken` 에도 `@returns` 를 추가해 세 갈래(또는 배선 완료 시 네 갈래)를
    명시하면, `"refresh_deferred"` 배선 시 놓치기 쉬운 지점(위 두 번째 발견사항)을 줄이는 효과도
    있다.

- **[WARNING]** 커밋된 감사 문서(`review/code/2026/08/10/16_42_07/RESOLUTION.md`)가 "전부 반영"이라
  주장하는 CRITICAL 수정이, 그 문서와 같은 커밋 트리(HEAD)에서는 실제로 소스에 반영돼 있지 않다
  — 코드 수정은 미커밋 워킹트리에만 존재한다
  - 위치: `review/code/2026/08/10/16_42_07/RESOLUTION.md:5-18`("## 1. INFO 로 받은 것이 CRITICAL
    이었다" — "**조치**: `"stale"` 반환.") 및 `SUMMARY.md:18`("**반영** — `"stale"` 반환(세션 보존
    + 호출부 정지). 뮤테이션 RED 2건") — 이 두 문서는 커밋 `c591566e4`("chore(review): 16_42_07
    라운드 산출물")로 커밋됐다.
  - 상세: `git show c591566e4:codebase/channel-web-chat/src/widget/use-widget.ts` (=현재 `HEAD`)
    로 직접 확인하면 non-terminal refresh 실패 분기는 여전히 `return "continue";` 이다 —
    RESOLUTION 이 "반영했다"고 주장하는 `"stale"` 반환은 이 커밋에 없다. 이 회귀 라운드(`16_42_07`)
    의 실제 소스 수정 커밋은 `86258c5c2`·`153791125`·`08bd668a5` 세 개뿐이고, 그중 어느 것도 이
    반환값을 바꾸지 않았다(`153791125` 는 같은 블록을 위치만 옮겼을 뿐 `"continue"` 를 그대로
    옮겼다 — `git show 153791125 -- use-widget.ts` 로 직접 확인). 실제 `"stale"` 반환 코드는
    지금 이 워크트리의 **미커밋 변경**(`git diff HEAD` 로 확인)으로만 존재한다. 즉 `HEAD` 커밋
    시점을 기준으로 감사하면(예: 다른 세션이 `git show HEAD:...` 로 "이 CRITICAL 이 고쳐졌는가"를
    확인) RESOLUTION.md 는 고쳐졌다고 말하지만 실제 그 커밋의 소스는 고쳐지지 않은 상태다 — 이
    저장소가 과거에 반복 지적한 "리포트가 파일보다 나중"·"RESOLUTION 후 fresh review 없이 push"
    류 함정과 같은 형태다.
  - 제안: `"stale"`(또는 배선이 끝났다면 `"refresh_deferred"`) 반환 코드 변경을 RESOLUTION.md/
    SUMMARY.md 와 **같은 커밋 또는 그 이전 커밋**으로 커밋할 것. 리뷰 산출물(`review/**`)이 먼저
    커밋되고 그것이 주장하는 코드 변경이 나중에(또는 아예 별도 미커밋 상태로) 오는 순서는, 그
    사이 시점에 저장소를 열어보는 어떤 세션·가드에도 "이미 고쳐졌다"는 잘못된 신호를 준다.

- **[INFO]** `CHANGELOG.md` 항목 3("그 외 오류는 여전히 soft-fail")이 `"continue"`/`"stale"` 두
  갈래를 구분하지 않아, refresh 왕복 자체의 비-terminal 실패가 "SSE 로 진행한다"는 뜻으로 오독될
  여지가 있다 — 상위 주장(대화가 끝나지 않는다)은 여전히 참이라 CRITICAL 은 아님
  - 위치: `CHANGELOG.md:172`("3. **그 외 오류는 여전히 soft-fail**: 일시적 장애가 대화를 끝내지
    않게 하는 경계다. ..."), 참고로 `CHANGELOG.md:171`(항목 2, 401 서술)은 이미 `401`·`410` 둘 다
    반영해 정확하다.
  - 상세: 이 항목은 두 서로 다른 "그 외" 를 구분 없이 하나의 문장으로 뭉갠다 — (a)
    `seedWaitingFromStatus` 자신의 바깥 `catch`(404/401 이 아닌 `getStatus` 실패, `use-widget.ts:624`)
    는 실제로 `"continue"` 를 반환해 기존 토큰으로 SSE 를 그대로 연다. (b) `recoverFromExpiredToken`
    안, refresh POST 자체가 401/410 이 아닌 사유로 실패하는 경우(`:448`)는 이제 `"stale"` 을
    반환해 **이번 왕복은 SSE 를 열지 않고** 세션만 보존한다. CHANGELOG 는 "일시적 장애가 대화를
    끝내지 않는다"는 결과(참)만 말하고 (a)/(b) 의 메커니즘 차이(SSE 를 여는가 안 여는가)는 말하지
    않는다 — 이 CHANGELOG 항목만 읽고 "재로드 401 처리"를 감사하려는 사람은 (b) 도 SSE 를 여는
    줄 오해할 수 있다.
  - 제안: 필수는 아니나, 항목 2 뒤에 "refresh 자체가 비-401/410 사유로 실패하면 세션은 보존한 채
    이번 SSE 재오픈은 건너뛰고 다음 주기 갱신에 맡긴다" 한 구절 추가 권장(강제 아님, INFO).

- **[INFO]** spec `3-auth-session.md` §R4 는 401 낙관적 refresh 의 성공/재차-실패(401·410) 두
  결과만 서술하고, refresh 시도 자체가 (네트워크·5xx 등으로) 실패하는 세 번째 경우는 여전히
  언급하지 않는다 — 이번 라운드가 새로 만든 결함은 아니고, 이번 반환값 변경으로 코드 쪽에 그
  분기의 전용 처리(현재 `"stale"`, 배선되면 `"refresh_deferred"`)가 명확히 생긴 지금 시점에는
  spec 이 상대적으로 더 눈에 띄게 비어 보인다
  - 위치: `spec/7-channel-web-chat/3-auth-session.md:104-108`(`### R4. 재로드 401 — 낙관적
    refresh 1회 후 종료`), `:86-89`(§3.1-2 REST 분기 목록, "성공 시 SSE 재연결로 복원, 재차
    `401`·`410` 이면 종료로 간주"까지만 서술).
  - 상세: spec 은 구현 리터럴(`"continue"`/`"stale"`/`"refresh_deferred"`)을 그대로 옮길 필요는
    없지만, 정상적으로 발생 가능한 세 번째 결과("refresh 왕복 자체가 실패하면 세션은 유지한 채
    이번 SSE 재연결은 건너뛰고 주기 갱신에 위임한다")를 규범적으로 언급하지 않는다. §3.1 상단
    배너(`:66`)의 "그 외 status·오류는 여전히 `catch` soft-fail 후 SSE 로 진행한다" 라는 문구도
    (위 CHANGELOG 항목과 동일한 이유로) refresh 왕복 실패 서브케이스를 포함하는 것으로 오독될 수
    있다.
  - 제안: 조치 불요(정보 제공용) — `webchat-auth-session-status-reconcile.md` 후속 정리 시 §R4 에
    "refresh 시도 자체가 실패하면(네트워크 등) 세션은 유지하고 이번 왕복만 포기, 주기 갱신에
    위임한다" 한 문장 추가를 고려할 만하다.

## 양호한 부분

- 지시받은 "저장소 전체 × 용어 축" 확인 결과, `404`/`401`/`410` 종료-조건 서술 자체(직전 라운드의
  documentation WARNING 대상)는 이번 스냅샷에서 `use-widget.ts`(`:467`, `:478`, `:489`, `:495`,
  `:505`) · `CHANGELOG.md:171` · `spec/7-channel-web-chat/3-auth-session.md:66,89` 전부 `401`·`410`
  을 함께 언급해 일관됐다 — `08bd668a5`("5+2 자리" 정정)의 효과가 실제로 유지되고 있다. 이번에
  새로 발견한 stale 은 `401`/`410` 축이 아니라 **반환 리터럴**(`continue`/`stale`/`refresh_deferred`)
  축에서 발생했다.
- `recoverFromExpiredToken`(`:434-448`)의 인라인 주석은 "왜 `"continue"` 도 `"ended"` 도 아닌
  `"stale"` 인가"를 근거(사고 이력 `webchat-boot-single-flight`, 재현 시나리오)와 함께 정확히
  설명한다 — 함수 JSDoc 에 `@returns` 가 없다는 점(위 INFO)만 제외하면 그 자리 문서 품질은 높다.
- `SUMMARY.md`/`RESOLUTION.md` 세 라운드 모두 "몇 명이 수렴했는가"·"뮤테이션 몇 건"·"남긴 갭"을
  정직하게 기록하는 관례를 유지한다 — 다만 위 WARNING(감사 문서-소스 불일치)이 그 신뢰를 깎는다.

## 요약

지시받은 핵심 축("continue"→"stale" 반환값 변경을 서술하는 자리들이 stale 한가)을 확인한 결과,
**실제로 stale 했다** — `seedWaitingFromStatus` JSDoc 의 REST 오류 분기 목록(`:495-496`)이 여전히
"그 외 실패는 `"continue"`" 라고 적어 코드(`"stale"`)·같은 파일 바로 아래 인라인 주석과 모순되고,
`SeedOutcome` 타입의 `"stale"` 독스트링·`@returns` 설명도 이 재사용된 의미를 담지 못한다. 조사
과정에서 이 파일이 다른 세션에 의해 실시간으로 편집되고 있음을 확인했고, 그 결과 `"stale"` 자체가
곧 `"refresh_deferred"` 라는 **네 번째** 값으로 대체될 예정임을 타입 선언과 그 독스트링(이번
라운드를 직접 인용)에서 발견했다 — 그러나 그 배선(구현·호출부·`@returns`·CHANGELOG·spec·테스트)은
아직 어디에도 완료되지 않아, 타입 독스트링이 존재하지 않는 동작을 확정 서술하는 새로운 stale 이
생겨나는 중이다. 더 무겁게는, 커밋된 `review/code/2026/08/10/16_42_07/RESOLUTION.md`/`SUMMARY.md`
가 이 `"stale"` 반환 수정을 "전부 반영"했다고 주장하지만, 그 문서가 커밋된 것과 같은 `HEAD` 트리의
실제 소스에는 그 수정이 없다 — 감사 문서가 소스보다 앞서 "고쳤다"고 선언한 상태다. CHANGELOG·spec
은 이 세부 분기를 구분하지 않아 오독 여지가 남지만 상위 주장(대화가 끝나지 않는다)은 여전히 참이라
낮은 우선순위다.

## 위험도

MEDIUM
