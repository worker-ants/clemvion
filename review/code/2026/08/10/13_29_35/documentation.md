# 문서화(Documentation) Review

## 검증 방법

이번 라운드의 핵심 질문(오케스트레이터 지시)은 "직전 라운드(`13_21_24`)가 `use-widget.ts:457`·`:463`
의 옛 아키텍처 서술을 정정했는데, **같은 클래스의 잔재가 이 파일·형제 문서에 더 없는가**" 였다.
`Read`/`Grep` 으로 다음을 전수 대조했다.

- `codebase/channel-web-chat/src/widget/use-widget.ts` 전체(1061줄) — `openStream` JSDoc(344-385),
  `seedWaitingFromStatus` JSDoc(413-478), `start()`(585-634), `applyConfig` 복원 분기(925-976) 직접 열람.
- `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts` — 이번 diff 대상 주석(3398-3411)
  및 `sessionEstablished`/`호출부`/`양쪽` 키워드로 grep, `use-widget.test.ts`·`use-widget-commands.test.ts`
  도 동일 키워드로 grep.
- `spec/7-channel-web-chat/3-auth-session.md` 전체(§R7 부근 155-183) 직접 열람.
- `plan/in-progress/webchat-usewidget-extraction.md`·`plan/in-progress/webchat-reload-rest-error-branches.md`
  전체 열람.
- `review/code/2026/08/10/{12_39_25,13_21_24}/*.md`(RESOLUTION/SUMMARY/testing 등)를 대조해, 과거
  라운드가 이미 지목했으나 "급하지 않음" 으로 미조치된 항목이 이번 라운드까지 남아 있는지 확인.
- `git show --stat bf8d71802`·`git log --oneline -1 <hash>` 로 인용된 커밋들의 실존·변경 파일 범위를
  실측(허구 커밋 인용 방지).

## 발견사항

- **[WARNING]** `plan/in-progress/webchat-usewidget-extraction.md:69` 의 예시 코드가 실제 구현과
  다르다 — **이 티켓이 반복해서 낸 "주석/문서가 구조 변경을 한 박자 늦게 따라간다" 결함 클래스의
  미해결 잔재**(추가 인스턴스)
  - 위치: `plan/in-progress/webchat-usewidget-extraction.md:69`
    (`      호출부는 `if (openStream(...) === "already_owned") return;` 한 줄이 된다.`)
  - 상세: 이 문장은 `openStream()` 호출부의 게이팅 형태를 **긍정 비교**(`=== "already_owned"`)로
    서술한다. 그런데 실제 코드(`codebase/channel-web-chat/src/widget/use-widget.ts:622-623`,
    `:973-974`)는 `const claim = openStream(...); if (claim !== "opened" && claim !== "no_client")
    return;` 로 **부정 비교(fail-closed)**를 쓴다. 두 형태는 `StreamClaim` 이 현재 3-variant 뿐이라
    관측 동등이지만, 서로 다른 코드다.
    - 이 차이가 생긴 경위를 커밋으로 추적했다: 이 plan 체크리스트 항목은 `2d9da4f26`(라운드
      `12_39_25`) 시점에 작성됐고, 그때는 실제로 코드가 긍정 비교였다(당시엔 정확한 서술). 이후
      `bf8d71802`(라운드 `12_48_08` 반영, "fail-closed 관용구로 통일 + JSDoc·spec 의 옛 아키텍처
      서술 정정")가 `use-widget.ts` 두 호출부와 `spec/7-channel-web-chat/3-auth-session.md` 를
      부정 비교로 갱신했지만(`git show --stat bf8d71802` 로 변경 파일이 이 두 개뿐임을 확인),
      **plan 문서는 그 커밋의 변경 대상에 포함되지 않아 남았다.**
    - 더 나쁜 것은, **바로 옆 소스 코드가 이 정확한 패턴을 명시적으로 경계하고 있다는 점**이다.
      `use-widget.ts:620` 주석: `` `=== "already_owned"` 로 쓰면 향후 "중단이어야 하는" variant 가
      늘 때 그 값이 자동으로 "진행" 으로 취급된다(fail-open, ai-review 12_48_08 maintainability). ``
      즉 plan 문서가 "완료" 로 표시한 체크리스트 항목이, 그 항목이 구현했다고 주장하는 코드 자신이
      명시적으로 "쓰지 말라" 고 경고하는 형태를 예시로 들고 있다.
    - 이미 한 차례 지적된 적이 있다: `review/code/2026/08/10/13_21_24/testing.md`("plan 체크리스트
      자체 서술이 실제 코드와 미묘하게 다르다")가 INFO 로 정확히 이 줄·이 불일치를 지목했다.
      그런데 그 라운드의 `SUMMARY.md`("0/0 을 낸 reviewer" 표, testing INFO 5건)·`RESOLUTION.md`
      모두 이 INFO 를 채택하지 않았다(testing 리뷰어 자신도 "제안: 급하지 않음" 으로 적었다).
      결과적으로 지금까지 미조치 상태로 남아 있음을 `git log`(최신 커밋 `feb37927f`까지 이 파일에
      대한 후속 수정 없음) 로 재확인했다.
    - `bf8d71802` 커밋 메시지는 "이 티켓에서 주석 drift 가 **네** 번 나왔다"(테스트 주석→의존성
      배열→JSDoc 요약문→spec 본문), 이후 `edebb1cc1`(라운드 `13_21_24`)은 "**다섯** 번째"(같은
      JSDoc 블록 내부 모순)라 셌다. 이번에 찾은 plan 체크리스트 잔재는 그 계열의 **여섯 번째
      인스턴스**이며, 지금까지는 한 번도 "정정" 대상으로 채택되지 않았다는 점에서 앞의 다섯과
      다르다.
    - 기능적 영향은 없다(체크리스트는 이미 `[x]` 완료 표기, 실제 코드는 정확하다). 위험은 순수하게
      문서적이다: 다음에 세 번째 `seed→openStream` 호출부를 추가하는 사람이 이 plan 문서를 예시로
      복사하면, 옆 소스 코드가 경고하는 바로 그 fail-open 패턴을 재도입할 수 있다.
  - 제안: `webchat-usewidget-extraction.md:69` 를 실제 형태로 정정한다 — 예:
    `호출부는 \`const claim = openStream(...); if (claim !== "opened" && claim !== "no_client")
    return;\`(부정 비교/fail-closed)가 된다.` 급하지 않은 것은 맞으나(코드는 정확), 이 plan 이
    아직 `in-progress`(미완료 이동)이므로 다음에 이 항목을 다시 여는 사람이 있다면 그 전에
    정정하는 것을 권한다.

- **[INFO]** 같은 plan 체크리스트의 "뮤테이션" 단락(gate `81`-`86`)이 이 티켓에서 실제로 발견된
  세 번째 동등 뮤턴트를 누락한다
  - 위치: `plan/in-progress/webchat-usewidget-extraction.md:81-86`
  - 상세: 이 단락은 "생존하나 동등 뮤턴트" 로 두 종(`"no_client"`→`"already_owned"` 반환값 교체,
    호출부가 결과를 무시)만 나열한다. 그런데 `review/code/2026/08/10/13_21_24/testing.md` 가
    이후에 발견한 **세 번째 동등 뮤턴트**(현재 3-variant 범위에서는 `claim !== "opened" && claim
    !== "no_client"` 를 `claim === "already_owned"` 로 뒤집어도 관측 결과가 같다 — 위 WARNING 항목과
    정확히 같은 지점)는 반영되지 않았다. 위 WARNING 과 같은 원인(그 라운드 INFO 가 채택되지 않음)
    이라 별도 항목으로 조치할 필요는 없지만, 위 항목을 정정할 때 함께 보완하면 plan 문서가 실제
    실측 이력과 완전히 정합해진다.
  - 제안: 위 WARNING 정정 시 이 단락에 세 번째 동등 뮤턴트를 한 줄 추가.

## 이번 delta 의 검증 결과 — 지시된 대상은 정확히 정정됨

- `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts:3401-3409` 의 새 주석은
  현재 소스 구조와 정확히 일치한다. `use-widget.ts:457`("이 seed 가드는 '표면 되감기' 만 막는다.
  '이중 스트림' 은 `openStream` 진입 가드가 막는다.")·`:463`("그 진입 가드로")와 대조해 문구까지
  일치를 확인했다. 옛 구조 서술은 "종전엔 ~였다" 로 명시적 과거형 프레이밍이라, 역사적 서술과
  현재 서술이 혼동되지 않는다 — 이 파일이 스스로 지적해 온 "혼동 유발형 drift" 를 피하는 좋은
  패턴이다.
- `spec/7-channel-web-chat/3-auth-session.md:166-175` 도 같은 정정이 반영돼 있다(`bf8d71802` 에서
  이미 완료, 이번 diff 는 `status: implemented`→`partial`·`pending_plans:` 추가만이라 이 절 자체를
  다시 건드리지 않음 — 대조 결과 일치 확인).
- `use-widget.ts` 내 `sessionEstablished` 관련 `useCallback` 의존성 배열(`start()`, gate `634`)은
  더 이상 `sessionEstablished` 를 포함하지 않는다 — 라운드 `12_39_25` WARNING(#2)이 정확히 반영된
  상태를 재확인했다(별도 조치 불요).
- `openStream` JSDoc(gate `364`-`385`)은 `@param session`·`@param lastEventId`·`@returns` 태그를
  갖췄다 — 라운드 `12_39_25` documentation INFO("`@param`/`@returns` 없이 산문뿐")가 반영된 상태를
  재확인했다(별도 조치 불요).
- `use-widget.test.ts`·`use-widget-commands.test.ts` 는 `sessionEstablished`/`호출부 게이트`/`양쪽`
  키워드 grep 결과 0건 — 옛 아키텍처를 서술하는 주석 없음.
- `plan/in-progress/webchat-reload-rest-error-branches.md`(신설 파일)의 "코드로 확인" 절이 주장하는
  `seedWaitingFromStatus` catch 블록의 동작("상태코드 구분 없이 전부 soft-fail")을 소스(gate
  `526`-`539`)와 대조해 정확함을 확인했다. 이 문서는 자신의 최초 작성 프레임을 스스로 정정한
  이력(§왜 그 PR 안에서 고쳤나·§미구현 항목)을 투명하게 남기고 있어, "고쳤다" 주장과 실제 상태가
  갈리는 이 티켓의 반복 패턴을 이번엔 문서 스스로 경계하는 모습을 보인다.
- 인용된 커밋 해시(`43423f830`·`6b25ccc3e`·`8f6d783f1`·`bf8d71802`·`edebb1cc1`·`2d9da4f26`) 전부
  `git log` 로 실존·주장된 파일 변경 범위와 일치함을 확인했다(허구 인용 없음).

## 요약

이번 라운드가 지시한 핵심 검증 — `use-widget.ts:457`·`:463` 정정이 충분한지, 같은 클래스의 잔재가
더 없는지 — 을 코드·테스트·spec 전수 대조로 수행한 결과, **지시된 두 자리와 그 형제 표면(테스트
주석·spec 본문·`useCallback` 의존성 배열·JSDoc 태그)은 모두 정확히 정정돼 있다.** 다만 전수 확인
과정에서 이 티켓의 같은 결함 클래스(구조 변경 후 그것을 설명하는 텍스트가 한 박자 늦음)의 **아직
채택되지 않은 잔재**를 하나 더 찾았다 — `plan/in-progress/webchat-usewidget-extraction.md:69` 의
예시 코드가 `bf8d71802` 에서 코드·spec 양쪽에 적용된 fail-closed 부정 비교 관용구로 갱신되지 않고
그 이전(라운드 `12_39_25`)의 fail-open 긍정 비교 형태를 그대로 남기고 있다. 이 항목은 직전 라운드
(`13_21_24`) testing 리뷰어가 이미 INFO 로 지목했으나 "급하지 않음" 판정으로 미채택된 채 남아 있던
것이다. 기능 영향은 없으나(코드 자체는 정확, 체크리스트는 이미 완료 표기), 옆 소스 주석이 명시적으로
경계하는 안티패턴을 plan 문서가 "정답" 처럼 예시하고 있어 향후 세 번째 호출부 작성자를 오도할 수
있다는 점에서 WARNING 으로 보고한다.

## 위험도

LOW
