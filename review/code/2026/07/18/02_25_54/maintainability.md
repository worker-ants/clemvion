# 유지보수성(Maintainability) 리뷰 — webchat-boot-single-flight (02_25_54)

## 사전 확인 — payload 한계

`prompt_file` 의 "리뷰 대상 파일" 15건은 실제로는 **직전 라운드(`01_44_21`)의 review 산출물 8건 +
consistency 산출물 6건 + `2-sdk.md` frontmatter**뿐이며, 오케스트레이터가 지시한 이번 라운드의 실제
검증 대상(`77805bd32`+`0020f9106`)의 코드 diff 는 포함돼 있지 않다 — 직전 라운드에서 5개 리뷰어가
독립적으로 지적한 것과 동일한 payload 구성 결함이 이번 라운드에도 재발했다(스냅샷이 한 라운드
지연된 것으로 보인다). 지시대로 payload 를 신뢰하지 않고 저장소를 직접 조사했다.

## 검증 방법

- `git log --oneline -20` 으로 라운드 경계 확정: `2b4f198c1`(00_51_53 종결) → `77805bd32`(이중
  EventSource fix, "seed 게이트의 짝" 추가) → `0020f9106`(stale 주석 정리) → `262ef8e5b`(01_44_21
  종결, 현재 `HEAD`).
- `git show 77805bd32` · `git show 0020f9106` 로 두 커밋의 diff 전문 확보.
- `codebase/channel-web-chat/src/widget/use-widget.ts`(1106행) 전문 Read — `sessionEstablished`
  정의(:325), `seedWaitingFromStatus` 전문(:474-599), `start()`(:630-685), `applyConfig` 복원
  분기(:964-1022) 를 직접 대조.
- `use-widget-eager-start.test.ts`(3472행) 에서 `77805bd32` 가 신설한 테스트(:3402-3471) 를 그 직전
  두 테스트(:3223-, :3316-)와 라인 단위로 대조.
- 직전 라운드 `review/code/2026/07/18/01_44_21/maintainability.md`(내 전임자 리포트) 와
  `review/code/2026/07/18/{00_51_53,01_44_21}/RESOLUTION.md` 를 대조해 "비대칭 카운트 stale" 지적의
  해소 여부를 감사이력(audit-trail) 으로 추적.
- `plan/in-progress/webchat-usewidget-extraction.md`·`webchat-boot-single-flight.md` 전문 Read 로
  `useEiaSession` 이월 판단의 현재 유효성을 재확인.
- `git log -S` 로 신규 테스트 3건(:3223·:3316·:3402) 각각의 최초 도입 커밋을 추적해 중복 발생
  시점을 정밀 확정.

## 발견사항

- **[WARNING]** 신규 회귀 테스트가 직전 두 커밋에 걸쳐 동일한 ~43줄 mock 셋업을 세 번째로 그대로
  복제 — 이번 작업 스트림 안에서 압축적으로 누적된 중복
  - 위치: `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts:3402-3445`(`77805bd32`
    신설) vs `:3316-3359`(`cffee0d28` 신설) vs `:3223-3265`(`7cfbf2557` 신설, 그 안의 `webhook202`/
    `waitingAt` 팩토리 한정).
  - 상세: `git log -S` 로 확인한 결과 `EventSource` stub 클래스(`esCount`/`latestEs` 캡처 + `addEventListener`/
    `close` no-op) + `fetch` stub(`/embed-config`·webhook POST·`getStatus` GET 분기) + `webhook202`/
    `waitingAt` 팩토리로 구성된 이 ~43줄 블록이 `7cfbf2557`(:3223) → `cffee0d28`(:3316) →
    `77805bd32`(:3402) **세 커밋 연속으로 한 글자도 다르지 않게 복제**됐다(직접 라인 대조 완료 — 두
    최신 블록 `:3317-3359` 와 `:3403-3445` 는 byte-identical). 파일 전체로는 `waitingAt` 패턴이
    5곳(:3069·3131·3265·3355·3441), `EventSource` stub 패턴이 8곳에 흩어져 있어 이미 파일 전역의
    기존 부채이지만, 이번에 문제 삼는 지점은 그 오래된 부채가 아니라 **바로 이 작업 스트림 자신이
    최근 세 라운드 연속으로 같은 블록을 새로 찍어냈다**는 것이다 — 즉 "이번 PR 이 우연히 물려받은
    구식 패턴"이 아니라 "이번 PR 스스로 반복 중인 습관"이다. 프로덕션 코드는 아니므로 correctness
    리스크는 없지만, 3472행짜리 테스트 파일이 계속 이런 식으로 커지면 실제 셋업 로직 변경 시(예:
    `EventSource` mock 인터페이스가 바뀌면) 8곳을 수동으로 동기화해야 하는 이 파일 특유의 "동일 로직
    여러 곳에 흩어짐 → 한 곳만 고치고 나머지 잊음" 실패 유형(이 파일이 프로덕션 코드에서 이미 11차례
    겪은 바로 그 패턴)이 테스트 코드에도 옮겨붙을 위험이 있다.
  - 제안: `installControllableEventSourceAndFetch()` 류의 공유 헬퍼(EventSource stub + fetch stub +
    `webhook202`/`waitingAt` 팩토리를 한 번에 설치하고 `{ esCount, statusResolvers, webhookResolvers,
    waitingAt, webhook202 }` 를 반환)로 추출할 것을 권고한다. 급한 조치는 아니다(테스트 전용, 프로덕션
    리스크 0) — 다음에 이 파일에 손을 댈 때(예: `useEiaSession` 분리 착수 시점) 함께 처리해도 늦지
    않다.

- **[WARNING]** seed 게이트·openStream 게이트의 "짝" 불변식이 구조가 아니라 주석·복붙 규율에 의존한다
  — 함수 경계를 벗어난 재확인이 이 파일에서 11차례 실패한 바로 그 패턴과 강제 메커니즘이 같다
  - 위치: `use-widget.ts:568`(seed 게이트, `seedWaitingFromStatus` 내부) · `:669-673`(`start()` 의
    openStream 게이트) · `:1014-1018`(`applyConfig` 복원 분기의 openStream 게이트) — 두 호출부 모두
    `if (sessionEstablished()) return;` 세 줄(가드 + `openStream(...)` + `scheduleRefresh()`) 이
    거의 동일하게 반복.
  - 상세: 이번 fix 는 정확히 옳은 방향(TOCTOU 창을 "체크와 행동 사이 재확인"으로 좁힘, side_effect·
    testing·concurrency 세 리뷰어가 mutation 으로 독립 확인)이지만, 이 "짝"이 성립하려면 **seed 를
    부르고 그 직후 `openStream` 을 부르는 모든 호출부가 매번 손으로 이 세 줄을 복제**해야 한다.
    오늘은 정확히 두 호출부(`start()`·`applyConfig`)뿐이라 안전하지만, 이 파일은 스스로 "비대칭 가드
    누락"(한 호출부는 챙기고 다른 호출부는 빠뜨림)으로 이미 여러 차례 CRITICAL 을 냈고(`beginBootAttempt`
    JSDoc `:260-263` 이 나열하는 4건 + `18_39_11`/`00_51_53`/이번 `01_44_21` 이중 스트림까지 더하면
    11번째), 그 실패의 공통 원인은 항상 "구조가 아니라 사람의 기억에 의존한 재검증"이었다. 지금은 두
    호출부의 주석이 서로를 정확히 참조하며("seed 게이트와 짝을 이루는 스트림 게이트(`start()` 와
    동일)") 잘 동기화돼 있지만, 이는 **문서화 규율의 산물이지 컴파일러나 헬퍼가 강제하는 것이 아니다**
    — 향후 세 번째 호출부(예: 새 재연결 경로)가 seed→openStream 패턴을 복사하면서 이 두 번째 가드
    한 줄만 빠뜨리는 실수는 타입 시스템도 lint 도 잡지 못한다.
  - 제안: `start()`/`applyConfig` 두 곳의 `if (sessionEstablished()) return; openStream(x, "0");
    scheduleRefresh();` 3줄을 `openStreamIfUnclaimed(session)` 같은 단일 `useCallback` 으로 추출해
    "seed 뒤에 스트림을 열려면 반드시 이 함수를 거친다"를 구조로 강제하는 방안을 검토할 것. 다만 이
    프로젝트 자신의 plan(`webchat-boot-single-flight.md` §Rationale)이 "버그 수정 중 구조를 같이
    고치는 선택이 정확히 직전 회귀를 낳았다"를 명시적 교훈으로 남겨 뒀으므로, **이번 커밋에 얹지
    않고 별도의 작고 저위험한 후속 커밋**으로 분리하는 것이 이 코드베이스의 위험 문화와 정합적이다
    (긴급 아님).

- **[INFO]** `applyConfig` 복원 분기의 재검증 넘버링("checkpoint 2")이 소스 코드 자체엔 없는
  "checkpoint 1"을 전제하고, 이번에 추가된 세 번째 재검증은 그 번호 체계 밖의 다른 용어를 쓴다 —
  경미한 용어 비일관
  - 위치: `use-widget.ts:973`(`if (cannotApplyConfig(attempt)) return;` — 리뷰 산출물에서는
    "checkpoint 1"로 불리나 소스 자체엔 그 리터럴이 없음) · `:1007`("checkpoint 2 — `openStream`
    직전 boot+world 재검증") · `:1014`("**seed 게이트와 짝을 이루는 스트림 게이트**").
  - 상세: `grep "checkpoint"` 결과 소스 전체에서 `"checkpoint 2"` 만 2회 등장하고 `"checkpoint 1"`
    은 한 번도 등장하지 않는다(과거 리뷰 산출물 `scope.md` 등이 관용적으로 그렇게 불렀을 뿐, 코드
    자신은 그 번호를 붙인 적이 없다). `applyConfig` 복원 분기는 이제 순서대로 세 번 재검증한다 —
    (a) `cannotApplyConfig`(:973, 무명), (b) `isAttemptStale`("checkpoint 2", :1012), (c)
    `sessionEstablished()`("스트림 게이트", :1018). 소스만 읽는 독자 입장에서는 "checkpoint 2"가
    가리키는 "1"이 어디 있는지 찾을 수 없고, 세 번째 재검증은 아예 번호 체계를 쓰지 않아 "이게 왜
    checkpoint 3이 아니지?"라는 불필요한 의문을 유발할 수 있다. 기능적으로는 문제없다 — 각 재검증의
    목적은 인접 주석이 충분히 설명한다.
  - 제안: 급하지 않음(INFO). `:973` 옆에 "checkpoint 1"이라는 명시 라벨을 붙이거나, 반대로
    `:1007`/`:1012`의 "checkpoint 2" 표현을 번호 대신 역할 이름(예: "boot 소유권 재검증")으로
    바꿔 번호 체계 자체를 없애는 두 방향 중 하나로 정리하면 좋다.

- **[INFO] (확인 — 직전 라운드 지적 정정 여부)** "비대칭 가드 누락 카운트 stale" 지적과 그 해소를
  둘러싼 감사이력까지 이번 라운드 전에 이미 바르게 정정 완료됨을 확인
  - 위치: `use-widget.ts:260-263`(`beginBootAttempt` JSDoc) · `0020f9106` diff ·
    `review/code/2026/07/18/00_51_53/RESOLUTION.md:33-36`(`262ef8e5b` 에서의 정정).
  - 상세: 직전 라운드 내 전임자(`01_44_21/maintainability.md`)는 "`beginBootAttempt` JSDoc 의
    '비대칭 가드 누락 3번' 카운트가 `18_39_11`/`23_58_23` 재발을 반영하지 못해 stale 이고, 이를
    'JSDoc 전면 재작성으로 해소'했다는 `00_51_53/RESOLUTION.md` 의 주장도 실제 diff 와 어긋나는
    과장"이라고 지적했다. 이번에 `0020f9106`(2026-07-18 02:13) 를 diff 로 직접 대조한 결과:
    (1) 카운트 문장이 "비대칭 가드 누락으로 **3번** CRITICAL"에서 "비대칭 가드 누락으로 CRITICAL 을
    **여러 번** 냈다 — (`02_04_13` C1 · `08_29_33` W2 · `09_36_01` W5, 그리고 `23_58_23` 의
    `start()` 무방비 되감기까지)"로 정정돼 지적된 누락(`23_58_23`)이 실제로 목록에 들어갔다. (2)
    `18_39_11`(함수 경계 밖이라 checkpoint 2 가 안 닿았던 사례)은 이 목록에 여전히 없으나, 이는
    누락이 아니라 **다른 실패 클래스로의 의도적 분리**로 보인다 — 같은 커밋이 `seedWaitingFromStatus`
    JSDoc(:511-512)에 "(1) 호출부 checkpoint 2 는 함수 반환 뒤만 보는데 `WAITING` dispatch 는 함수
    안쪽이라 안 닿았고(`18_39_11`)"를 별도로 명시해, "비대칭(누락)"과 "타이밍(경계 불일치)"을 서로
    다른 절에서 각각 정확하게 서술한다(전임자가 제안한 두 대안 중 (b) "구분을 명시"에 실질적으로
    해당, 다만 카운트 문단 **한 곳**에 그 구분을 명시하진 않아 완전히 문자 그대로는 아니다 — 경미).
    (3) `01_44_21/RESOLUTION.md` 는 여기서 한 걸음 더 나아가 `00_51_53/RESOLUTION.md` 자신의 과거
    "전면 재작성으로 해소" 주장이 과장이었음을 `262ef8e5b` 커밋으로 **되돌아가 정정**했다(diff 확인:
    "**fix**" → "**부분 fix (정정)** ... 위 '전면 재작성' 서술은 과장이었다"). 이는 단순히 지적된
    결함을 고치는 것을 넘어, 과거 라운드가 남긴 **부정확한 해소 기록 자체**를 스스로 찾아 고친
    사례라 이 프로젝트의 리뷰 감사이력 신뢰도 관점에서 특히 긍정적이다. 부수적으로 같은 커밋이
    `use-widget-eager-start.test.ts:3042/3106` 두 곳의 stale "boot 축" 라벨(`01_44_21/testing.md`
    WARNING 이 지적)도 함께 정정한 것을 diff 로 직접 확인했다.
  - 제안: 없음 — 실질적으로 정정 완료. `:260-263`에 "왜 `18_39_11` 은 이 목록에 없는가"를 한 줄 더
    명시하면 완벽하겠으나(위 (2) 참조) 그 정도의 잔여 불명확성은 INFO 수준이다.

- **[INFO] (확인 — 게이트 역할 분담)** seed 게이트와 openStream 게이트는 "무엇을 보호하는가" 축으로
  명확히 분리돼 있고, 같은 predicate 재사용은 혼란이 아니라 이 파일의 기존 관용구(재검증 체크포인트)
  와 일관된 설계다
  - 위치: `use-widget.ts:502-507`(staleness 정책 표, "표면 갱신" 행) · `:518-525`("이 seed 가드는
    표면 되감기만 막는다. 이중 스트림은 호출부의 짝 가드가 막는다") · `:568`(seed 게이트) ·
    `:673`·`:1018`(openStream 게이트).
  - 상세: 두 게이트는 **같은 predicate**(`sessionEstablished()`)를 쓰지만 **보호 대상이 다르다** —
    seed 게이트는 "표면(화면에 그려질 노드)을 되감지 않는다"를, openStream 게이트는 "스트림(SSE
    연결) 소유권을 중복 생성하지 않는다"를 지킨다. 이 구분은 함수 JSDoc(:502-507 표 + :518-525 문단)
    에 명시적으로 서술돼 있고, 두 게이트의 이름("seed 게이트"/"스트림 게이트")도 정확히 그 구분을
    반영한다. 같은 predicate 를 두 다른 시점(seed 반환 직전, `openStream` 호출 직전)에 재확인하는
    구조는 이 파일이 `isStale(gen)`/`isAttemptStale(attempt)` 를 이미 여러 checkpoint 에서 반복
    호출해 온 기존 관용구(await 지점마다 재검증)와 정확히 같은 패턴이라 신규 개념이 아니다 — 코드
    스타일 일관성 관점에서 자연스럽다. `applyConfig` 의 restore 분기(:990)에 있는 **세 번째**
    `sessionEstablished()` 용법("복원 분기 진입 여부 자체를 결정")까지 포함하면 이 predicate 는
    파일 전체에서 3가지 역할(진입 여부·표면 갱신·스트림 오너십)로 쓰이는데, 이는 오케스트레이터가
    지목한 "두 게이트" 프레이밍보다 한 겹 더 있다 — 다만 이 세 번째 용법(:990)은 이번 두 커밋
    (`77805bd32`/`0020f9106`) 대상이 아니라 `cffee0d28`(전전 라운드)에서 이미 도입·검증된 것이라
    이번 라운드의 신규 위험은 아니다.
  - 제안: 없음 — 역할 분담은 혼란스럽지 않고 명확하다.

- **[INFO] (확인 — `useWidget()` 규모·`useEiaSession` 이월)** 분리 판단은 여전히 타당하며 오히려
  근거가 더 강해졌으나, 근거 문서의 스냅샷 수치는 이번 두 커밋으로 갱신되지 않아 착수 시점 refresh
  가 필요하다
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts`(전체, 현재 1106행) ·
    `plan/in-progress/webchat-usewidget-extraction.md`(분리 plan, `owner: developer`, `(unstarted)`,
    이번 두 커밋으로 **전혀 수정되지 않음** — `git diff 2b4f198c1..HEAD --stat` 에 파일명 부재로 확인).
  - 상세: 파일 크기는 merge-base 877줄 → 이 plan 문서가 마지막으로 기록한 "~1070줄" → 현재 1106줄로
    계속 증가 중이다. `webchat-boot-single-flight.md`(:129)의 Rationale 은 "`useEiaSession` 분리는
    가드 축이 `worldGenRef` 하나로 정리된 지금이 적기"라는 **전제** 위에 있었는데, 그 전제는 이미
    `bootGenRef` 신설로 한 차례 되돌려졌고(plan 자신이 그렇게 기록), 이번 두 커밋은 그 위에 세 번째
    축(`sessionEstablished`/`streamRef`)의 **적용 지점을 하나 더**(openStream 게이트) 늘렸다 — 축
    "개수"의 방향은 여전히 감소가 아니라 증가 쪽이다. 다만 `webchat-usewidget-extraction.md` 자신은
    "분리의 진짜 근거는 줄 수가 아니라 세션 라이프사이클 로직의 응집도 부족"이라고 이미 명시해 뒀으므로,
    축이 하나 늘었다고 해서 분리 결정 자체가 흔들리지는 않는다(오히려 응집도 부족 사례가 하나 더
    쌓인 셈이라 근거가 강화된다). 문제는 그 plan 문서가 인용하는 **구체 수치**(`9번(23_58_23 기준)`
    거울상 카운트, `현재 391건` 테스트 수)가 이제 최소 2라운드(`00_51_53`·`01_44_21`) 만큼 뒤처졌다는
    점이다 — 실제로는 `77805bd32` 커밋 메시지 자신이 "11번째 거울상"이라 명명했고 테스트는 393건이다.
    이 plan 은 이번 두 커밋으로 손대지 않았으므로 이번 라운드의 결함은 아니지만, "미착수" 백로그
    항목이라도 착수 판단에 쓰이는 "선행 판단" 절(축이 몇 개인가·현재 회귀 수 등)의 숫자가 여러 라운드
    뒤처진 채로 방치되면, 실제 착수 시점에 "왜 지금 하는가/안 하는가"를 그 문서만 보고 판단하는
    사람이 오래된 스냅샷으로 그릇된 결론을 낼 위험이 있다.
  - 제안: 급하지 않음(INFO, 이번 PR 을 막을 사안 아님). `useEiaSession` 분리 착수 직전에
    `webchat-usewidget-extraction.md` 의 "배경"·"선행 판단" 절 수치(파일 줄 수·거울상 횟수·테스트
    건수·축 개수)를 그 시점 최신값으로 한 번 갱신할 것을 권고한다.

- **[INFO] (긍정 관찰)** 매직 넘버를 능동적으로 제거 — 직전 라운드가 지적했던 유형의 문제를
  이번 diff 가 선제적으로 스스로 교정
  - 위치: `use-widget-eager-start.test.ts:3113` — `0020f9106` diff: `"...테스트가 없을 땐 388건
    전부 통과했다"` → `"...테스트가 없을 땐 전부 통과했다"`.
  - 상세: `mutation 시 이 테스트가 없으면 몇 건이 통과하는가"를 나타내던 하드코딩 숫자("388건")를
    이번 커밋이 스스로 제거했다. 이런 숫자는 테스트가 추가될 때마다 매번 갱신해야 하는 전형적인
    매직넘버/stale-count 패턴이고, 이 파일이 정확히 이 유형(카운트 드리프트)으로 이미 여러 차례
    지적받은 이력이 있다(위 "비대칭 카운트 stale" 항목과 같은 계열). 이번 삭제는 리뷰가 지적하기
    전에 개발자 스스로 그 교훈을 적용한 사례로 읽힌다.
  - 제안: 없음(긍정 관찰). 앞으로도 "N건 통과" 류 절대 수치보다 "정확히 이 테스트만 실패한다" 류
    상대 서술을 유지할 것을 권장.

## 요약

이번 라운드가 검증 대상으로 지목한 `77805bd32`(seed 게이트의 짝인 openStream 게이트 추가)와
`0020f9106`(그 재설계로 stale 해진 boot 축 주석 정리)를 직접 diff·전체 파일 대조로 리뷰했다.
지시받은 네 가지 질문에 대한 결론은 다음과 같다. **(1) 역할 분담**: seed 게이트(표면 되감기 방지)와
openStream 게이트(스트림 중복 생성 방지)는 같은 predicate(`sessionEstablished()`)를 재사용하지만
JSDoc 표·문단이 "무엇을 보호하는가"를 명확히 구분해 서술하고, 이는 이 파일이 이미 써 온 재검증
checkpoint 관용구와 일관돼 혼란스럽지 않다. **(2) 직전 지적 정정 여부**: "비대칭 가드 누락 카운트
stale" 지적은 `0020f9106` 에서 실질적으로 정정됐고, 특히 `01_44_21/RESOLUTION.md` 가 `00_51_53`
라운드 자신의 "전면 재작성으로 해소"라는 과거 과장까지 되짚어 스스로 고친 점은 이 프로젝트의 리뷰
감사이력이 건강하게 작동하고 있다는 신호다. **(3) `useEiaSession` 이월**: 분리 결정 자체는 여전히
타당하고 오히려 축 증가(3번째 predicate 적용 지점 추가)로 근거가 더 강해졌지만, 그 결정을 뒷받침하는
plan 문서의 스냅샷 수치(거울상 9회·테스트 391건)는 이번 두 커밋과 무관하게 방치돼 있어 착수 시점
갱신이 필요하다(비차단). **(4) 구조적 완결성**: 기능적으로는 세 명의 리뷰어(testing·side_effect·
concurrency)가 mutation 테스트로 독립 확인했으므로 현재 코드 상태는 안전하다고 볼 수 있다. 그러나
"구조적으로 완결"됐다고 부르기엔 이르다 — 이 짝 불변식은 두 호출부에 사람이 손으로 복제한 세 줄
가드에 의존하고, 향후 세 번째 seed→openStream 호출부가 생기면 이 파일이 11차례 반복해 온 바로 그
"한쪽만 챙기고 다른 쪽을 빠뜨리는" 실패를 다시 낼 수 있는 여지가 구조적으로 남아 있다(WARNING).
추가로 신규 테스트가 직전 두 커밋(`7cfbf2557`→`cffee0d28`→`77805bd32`)에 걸쳐 동일한 ~43줄 mock
셋업을 세 번째로 복제한 것도 이번 작업 스트림 자체가 만든, 낮지만 실재하는 유지보수 부담이다
(WARNING, 테스트 전용이라 correctness 리스크는 없음). 두 WARNING 모두 즉시 조치가 필요한 결함이
아니라 저위험·저비용의 후속 개선 제안이며, 이 코드베이스가 이미 "버그 수정에 구조 개선을 얹지
않는다"는 값비싼 교훈을 문서화해 뒀으므로 이번 커밋과 분리된 별도 작업으로 처리하는 것을 권한다.

## 위험도

LOW — CRITICAL 없음. 두 WARNING 은 현재 동작을 위협하지 않는 미래 유지보수 리스크(구조적 강제
부재·테스트 중복)에 대한 것이고, 나머지는 확인/긍정 관찰(INFO) 이다.

STATUS=success maintainability PATH=/Volumes/project/private/clemvion/.claude/worktrees/webchat-boot-single-flight-8c92b4/review/code/2026/07/18/02_25_54/maintainability.md risk=LOW
