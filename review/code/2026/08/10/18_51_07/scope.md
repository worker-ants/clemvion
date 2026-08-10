# 변경 범위(Scope) Review

## 특별 검증 요청 1 — `18_23_54/RESOLUTION.md` 처분 주장 vs 커밋 `38b49780e`

`git show`/`git diff 38b49780e~1 38b49780e`로 파일 단위 대조하고, 추가로 현재 워킹트리(HEAD
`44f56ab3d` = `38b49780e` 바로 다음 커밋, 코드 변경 없음)에서 실제 테스트를 재실행해 교차검증했다.

### (a) "콜드 사본에서 정상 4/4 PASS, 뮤턴트 3/3 FAIL" — **커밋과 불일치 없음, 부분 재현**

- `RESOLUTION.md:20-21`("| 정상 코드, 콜드 캐시 | **4/4 PASS**... | 뮤턴트(낙관적 클리어 복원), 콜드 캐시 | **3/3 FAIL** |")가
  가리키는 근본 수정(`PHASE_SCHEDULE_MS`/`PHASE_ADVANCE_MS`를 6초·10·20초에서 90분·91분으로
  확대해 `shouldAdvanceTime: true`의 실경과시간 드리프트가 단계 경계를 못 넘게 함)이 실제로
  `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts:139-140`에 존재하고,
  이 상수를 쓰는 자리(`:591`,`:625`,`:648`,`:661`,`:681`,`:684`)도 전부 커밋에 실려 있다 —
  **claim이 가리키는 코드가 실제로 그 커밋 안에 있다** (이 브랜치에서 한 번 있었던 "커밋에
  실리지 않은 수정을 반영 완료로 적은" 사고, `16_42_07`→`18_23_54` §1과 같은 유형의 불일치는
  이번 라운드엔 없다).
- 직접 실행 재확인: `pnpm`/`npx vitest run`으로 `eia-client.test.ts` + `use-widget-eager-start.test.ts`
  단독 실행 시 **102 passed(102)**, 위젯 전체(`vitest run`) **23 files / 433 passed(433)** —
  `RESOLUTION.md:76`("위젯 vitest 433 passed (23 files, +4)")과 정확히 일치. `tsc --noEmit`
  도 0 errors로 `RESOLUTION.md:77`과 일치.
- 다만 **"4/4 PASS, 3/3 FAIL"이라는 정확한 숫자 자체(콜드 transform 캐시 조건에서의 뮤턴트
  낙관적 클리어 복원 3종 개별 결과)는 실행-시점 종속 관측이라 `git show`만으로는 재현할 수
  없다** — 이 리뷰는 코드 변경 사항이 그 결과를 산출할 수 있는 형태로 커밋에 존재함과, 지금
  시점(웜/콜드 무관하게 반복 실행 시)의 안정적 PASS를 확인했을 뿐, 리뷰어가 별도 scratch 사본에서
  본 "콜드 캐시 재현" 자체를 이 세션에서 다시 재현하지는 않았다(권한상 `codebase/**` 파일을
  일시적으로라도 뮤테이션할 수 없음 — 코드 리뷰어 쓰기 권한은 `review/**`로 한정).
  결론: **artifact-commit 불일치는 발견되지 않았다.** 숫자 자체의 신뢰는 commit
  message(`38b49780e`)와 `RESOLUTION.md`가 동일 문구로 일치하고 그 문구가 가리키는
  메커니즘·산출물이 실재한다는 정황 증거에 의존한다(이 라운드에 한해).

### (b) "`redactToken` 항등 뮤턴트 RED" — **직접 정적 검증으로 확인됨**

- `codebase/channel-web-chat/src/lib/eia-client.ts:193-195`에 `redactToken` 함수가 이
  커밋에서 신규 추가됐다(`git diff 38b49780e~1 38b49780e`로 확인 — 이전 커밋엔 없었음).
- `codebase/channel-web-chat/src/lib/eia-client.test.ts:288-299`의 회귀(신규, 이전 커밋에
  없었음 — `git show 38b49780e~1:.../eia-client.test.ts`로 확인)는
  `expect(out).not.toContain("iext_secret")`(`:292`)와 `expect(out).toContain("token=<redacted>")`(`:293`)를
  단언한다. `redactToken`을 항등(`return text`)으로 바꾸면 두 단언 모두 **정적으로** 깨진다
  (원문 `iext_secret`이 그대로 남고 `token=<redacted>`는 생기지 않음) — "RED" 주장은 실행 없이도
  코드만으로 참임을 확인할 수 있다.
  - 소스: `RESOLUTION.md:46-47`("`redactToken`을 항등으로 바꾸는 뮤턴트가 RED 임을 확인했다").
- 추가 독립 커버리지: `use-widget-eager-start.test.ts:691-692`(`expect(logged).not.toContain("iext_w")` /
  `"iext_r"`)도 같은 커밋에서 신규 추가돼 `console.warn` 스파이로 실제 로그 문자열까지 단언한다
  — 항등 뮤턴트가 이 회귀도 함께 깬다(redaction 없이 `console.warn`으로 흘러가는 원문 URL에
  `iext_w`/`iext_r...`가 그대로 남으므로). 이중으로 뒷받침됨.
- 결론: **claim과 커밋이 정확히 일치. 산출물-커버리지 갭 없음.**

## 특별 검증 요청 2 — `redactToken` 추가가 이 티켓 범위를 정당하게 확장했는가

**판정: 정당한 범위 내(proportionate) — 사용자 근거("이 PR이 추가한 catch가 만든 노출이라
이 PR이 닫아야 한다")가 `git log -S`로 사실 확인됨.**

- `git log --oneline --all -S "onRefreshedRef.current?.(updated)" -- .../use-token-refresh.ts`로
  추적한 결과, 토큰이 새는 그 `catch(notifyErr) { console.warn(...) }`(현재
  `use-token-refresh.ts:166-175`)는 커밋 `410705910`("`refresh_deferred`가 약속한 복구가
  실제로는 없었다")에서 **신규로 도입**됐다. 이 커밋은 같은 브랜치(`claude/webchat-reload-rest-branches`,
  즉 이 재로드 REST 오류 분기 티켓)의 초기 구현 이후 발견된 결함(§R4 `refresh_deferred`가
  실제로는 스트림을 재개하지 않던 문제)을 고치는 과정에서 만들어졌다 — 즉 **원 티켓 밖에서
  가져온 기존 코드가 아니라, 이 티켓 자신의 작업 결과물**이다.
- 노출 메커니즘도 이 티켓 고유다: `eia-client.ts:120-131`의 `openStream`은 `EventSource`가
  헤더를 못 실어 토큰을 쿼리 문자열에 넣는데(`EIA §8.3`), 그 `EventSource` 생성이 동기
  throw하면(`use-widget-eager-start.test.ts`의 `throwOnce` mock이 재현) 예외 메시지에 그
  URL이 그대로 담긴다. 이 throw를 처음으로 잡아 로그로 내보내는 자리가 `410705910`이
  추가한 그 `catch`이므로, "이 PR의 새 코드가 새로 만든 노출"이라는 인과 서술이 사실과
  부합한다.
- 적용 범위도 과확장 없이 좁다 — `grep -rn "redactToken"`(비-테스트) 결과 정의 1곳
  (`eia-client.ts:193`)과 사용 1곳(`use-token-refresh.ts:174`)뿐이다. 같은 파일의 다른
  `console.warn`(`:183`, refresh 실패 로그)은 `refreshToken` 호출이 `Authorization` 헤더를
  쓰지 쿼리 토큰을 안 쓰므로(`eia-client.ts:75-97`) redaction 대상이 아니다 — 대상이 아닌
  로그까지 손대는 과잉 일반화(over-engineering)도 없다.
- 이 지적 자체가 같은 PR의 `18_23_54` ai-review 라운드(security WARNING)에서 나왔고,
  `CLAUDE.md`의 "구현 완료 후 자동 review/fix는 상시 승인된 강제 의무" 조항이 같은 fix-cycle
  내 반영을 정당화한다. 앞선 라운드(`16_26_09/scope.md`)도 "이 diff 자신이 만든 리스크에
  대한 proportionate 대응"을 반복적으로 범위 내로 판정해 온 동일 논리이기도 하다.
- 처음 쓴 회귀 단언이 vacuous였다가(`mock`이 URL 없는 `TypeError`를 던져 redaction이 안
  돌았는데 통과) 실제 실패를 재현하도록 고친 경위(`RESOLUTION.md:44-45`)도
  `use-widget-eager-start.test.ts:105-107` 근처 mock 변경(`throw new TypeError(\`Failed to
  construct 'EventSource': ${latestUrl}\`)`)과 일치해 별도 과장은 없다.

## 그 외 발견사항

- **[INFO]** 전체 diff(107개 파일, `CHANGELOG.md`·코드 6파일·plan/spec 다수·`review/code/2026/08/10/{16_09_40..18_23_54}/**` 리뷰
  산출물 다수)를 훑은 결과, 이번 특별 검증 대상 2건 외에 무관한 리팩토링·포맷팅 뒤섞임·
  불필요한 주석/임포트 정리는 발견되지 않았다. `review/**` 산출물은 각 라운드가 직전 라운드
  지적에 대한 응답이라는 자기 서술과 파일 경로가 일치하고(`RESOLUTION.md` ↔ 실제 코드 변경
  대응 확인 완료), `plan/`·`spec/0-overview.md`·`spec/7-channel-web-chat/3-auth-session.md`
  갱신도 이 티켓 완료 사실(`partial`→`implemented`)을 반영하는 사실 동기화로 범위 밖 결정이
  섞여 있지 않다.
  - 제안: 없음(참고용).

## 요약

두 특별 검증 요청 모두 `RESOLUTION.md`의 처분 주장과 커밋 `38b49780e`의 실제 diff가
일치했다 — 이 브랜치에서 한 차례 있었던 "커밋에 실리지 않은 수정을 반영 완료로 적은"
유형의 산출물-커밋 불일치는 이번 라운드엔 없다. `redactToken` 항등 뮤턴트 RED 주장은
정적으로 직접 확인 가능하고 실제로 참이다. "콜드 캐시 4/4 PASS·3/3 FAIL"의 정확한
숫자는 실행-시점 종속 관측이라 `git show`만으로 그 숫자 자체를 재현하지는 못했지만,
그 결과를 만들 수 있는 코드 변경(90분/91분 마진)이 커밋에 실재하고 현재 시점 재실행도
안정적으로 통과(433/433, tsc 0 errors)해 신뢰도를 뒷받침한다. `redactToken` 추가는
`git log -S`로 추적한 결과 이 PR 자신이 새로 만든 `catch`(`410705910`)가 새로 만든
노출을 좁게, 정확히 그 지점에만 닫은 것으로, 사용자 근거("이 PR이 만든 노출이라 이 PR이
닫아야 한다")는 사실에 부합하며 scope 이탈이 아니다.

## 위험도

NONE
