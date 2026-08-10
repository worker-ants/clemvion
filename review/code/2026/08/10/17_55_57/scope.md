# 변경 범위(Scope) Review

대상: `claude/webchat-reload-rest-branches` (`origin/main...HEAD`, HEAD `a601cecce`). 오케스트레이터가
지정한 두 항목 — (1) `use-token-refresh.ts` 실패 재시도 추가, (2) `origin/main` 머지 + frontmatter
`partial`→`implemented` 승격 + plan `complete/` 이동 + 링크 4곳·`spec/0-overview.md` 동반 갱신 — 의
정당성을 판정하고, `review/**` 산출물의 처분 주장을 `git show`/`grep` 으로 재검증했다.

핵심 코드/문서 diff(리뷰 산출물 제외)는 `git diff --stat origin/main...HEAD -- codebase/ spec/ plan/
CHANGELOG.md` 로 확인한 14파일·1150(+)/61(-)이며, 이 프롬프트가 보여준 diff·plan·CHANGELOG 서술과
line-level 로 일치한다.

## 판정 1 — `use-token-refresh.ts` 실패 재시도 추가: **범위 내**

- 위치: `codebase/channel-web-chat/src/widget/use-token-refresh.ts`(커밋 `410705910`,
  `.catch()` 블록 — `isTerminalAuthError` 분기 + `retryDelayMs` 지수 백오프 재예약), 동반
  `onRefreshed` 콜백 추가·`codebase/channel-web-chat/src/lib/eia-client.ts` 신설
  `isTerminalAuthError`(재로드 복구 `recoverFromExpiredToken` 과 주기 갱신이 공유).
- **원 티켓 자신이 그 사이클에 복구를 위임했다.** `git show 410705910` 의 커밋 메시지와 diff 를
  직접 대조한 결과, 세 번째 REST 분기(`refresh_deferred`)의 계약은 "세션은 유지하고 스트림만
  미뤄 둔 뒤, **주기 토큰 갱신이 성공하면 그때 연다**"(§R4)다. 즉 이 PR 이 만든 `refresh_deferred`
  갈래 자체가 `useTokenRefresh` 를 복구 수단으로 지목했다 — 그 수단이 (a) 성공해도 스트림을 열지
  않고 (b) 한 번 더 실패하면 재시도 없이 죽는 상태였다면, 이 PR 이 고치려던 "streaming 무기한
  고착"을 성공/실패 양쪽 경로에서 그대로 재현한다. `git log` 상 이 CRITICAL 은 `17_15_33_2`
  라운드(side_effect·뒤늦게 착지한 requirement)가 실측(`openStream` 호출부 grep, `use-token-refresh.ts`
  가 `openStream` 을 0회 호출함을 확인)으로 낸 것이고, 오케스트레이터의 "내 근거"(refresh_deferred
  가 그 사이클에 복구를 위임하므로 그것이 죽어 있으면 이 PR 이 만든 고착이다)와 정확히 일치한다.
  `plan/in-progress/webchat-auth-session-status-reconcile.md` §미해결 절도 같은 실측을 담고 있다.
- **원인이 이 diff 자신에 있다.** 좁히기 전(`origin/main` 기준) 코드는 `refreshToken` 실패를
  구분 없이 종료로 확정했으므로 애초에 이 사이클에 의존하는 갈래가 없었다. `refresh_deferred`
  라는 신규 상태를 도입한 것이 이 PR 이고, 그 상태의 유일한 탈출구를 `useTokenRefresh` 로 지정한
  것도 이 PR 이다 — 다른 PR/티켓의 결함을 끌어들인 것이 아니라, 자기 설계가 만든 전제(주기 갱신이
  복구 수단)를 자기 구현이 충족하지 못했던 것을 닫았다.
- **변경 규모가 결함과 비례한다.** `isTerminalAuthError` 를 `eia-client.ts` 로 옮겨 재로드 복구와
  주기 갱신이 공유하게 한 것도 "한쪽만 고치는 것이 이 브랜치의 반복 결함이었다"(커밋 메시지,
  `16_09_40`·`16_56_39` CRITICAL 둘 다 호출부 비대칭이 원인)는 이 브랜치 자신의 이력에 대한 직접
  대응이다. `git show 410705910` 로 diff 전문을 확인한 결과 `use-widget.ts` 쪽 변경도
  `deferredStreamRef`/`resumeDeferredStreamRef`/`onRefreshed` 배선에 한정되고, 무관한 리팩토링·
  포맷팅은 없다.
- 이 delta 는 이번 리뷰 프롬프트에 diff 가 생략(크기 제한)돼 있었으나, `git show 410705910`
  로 직접 열어 전문을 대조했다 — 프롬프트가 서술한 내용과 실제 커밋이 일치한다.

## 판정 2 — `origin/main` 머지 + frontmatter 승격 + plan 이동 + 링크 갱신: **범위 내, 실행도 정확**

- 위치: 병합 커밋 `51e8c72e8`(`origin/main` #1130 머지), `092d784a3`(문서 3건 명문화),
  `plan/complete/webchat-reload-rest-error-branches.md`(이동+체크), `spec/7-channel-web-chat/3-auth-session.md`
  frontmatter·§3.1 배너·§R4, `spec/0-overview.md`, `plan/complete/web-chat-quality-backlog.md`,
  `plan/in-progress/webchat-usewidget-extraction.md`, `plan/in-progress/webchat-command-failure-is-not-termination.md`.
- **의무의 근거가 사전에 명문화돼 있었다.** `plan/in-progress/webchat-auth-session-status-reconcile.md`
  는 이 PR 이전 라운드(`16_09_40` scope WARNING → `17_15_33_2` scope 가 `git hash-object` 로 교차-PR
  경합을 실증)에서 이미 "두 PR 중 나중에 머지되는 쪽이 처리해야 한다"고 못박아 둔 문서다.
  `origin/main`(#1130, 커밋 `cbc0d3376`)이 먼저 머지돼 `partial` + `pending_plans:` 를 심었고, 이
  브랜치가 나중이므로 병합 시점에 재판정 의무가 실제로 발동했다 — 자발적 범위 확장이 아니라
  선행 라운드가 예고한 조건이 충족된 것이다.
- **실행을 `git`/`grep` 으로 재검증** — 전부 일치:
  - `git merge-base --is-ancestor cbc0d3376 HEAD` → true (origin/main 의 partial 커밋이 실제로 이
    브랜치에 병합돼 있음).
  - `spec/7-channel-web-chat/3-auth-session.md` frontmatter: `status: implemented`, `pending_plans:`
    없음 — 승격 완료.
  - §3.1 배너 제목: `v1 구현 현황(부분)` → `v1 구현 현황`(`부분` 제거) — 확인.
  - §R4 상단 "결정은 내려졌으나 구현은 없다(Planned)" 고지: `grep -n "Planned"` 0건 — 제거 확인.
  - `spec/0-overview.md`: "영역 spec 6문서 중 5문서가 `implemented`, 3-auth-session 은 `partial`"
    → "영역 spec 6문서가 모두 `implemented`" 로 갱신 확인.
  - 이동한 plan(`plan/in-progress/` → `plan/complete/`)을 가리키던 링크: `web-chat-quality-backlog.md`·
    `webchat-usewidget-extraction.md`·`webchat-command-failure-is-not-termination.md` 세 파일 모두
    `../complete/webchat-reload-rest-error-branches.md` 로 갱신됐고, `grep -rln
    "in-progress/webchat-reload-rest-error-branches"` 로 저장소 전체를 검색한 결과 남은 참조는 전부
    `review/code/**`·`review/consistency/**` 안의 **과거 라운드 스냅샷**(그 시점엔 참이었던 기록)
    뿐 — 살아있는 spec/plan 문서에 깨진 링크 없음.
  - `plan/in-progress/webchat-auth-session-status-reconcile.md` §처리 체크리스트 7항목이 전부
    `[x]`로 실제 상태와 일치(직접 대조).
- **정직한 자기수정도 함께 확인했다.** RESOLUTION(`17_25_34_2` W4)이 "체크리스트가 원래 2줄(frontmatter)만
  적어 뒀는데 실제 이행 항목은 7개였다"고 자백한 부분도 plan 문서 자체에 그대로 남아 있어(교훈 문단),
  산출물의 자기서술과 실제 파일 상태가 어긋나지 않는다.
- **머지 충돌 해소 중 추가로 걷어낸 `resumeDeferredStream` 의 `sessionEstablished()` 중복 검사**
  (`51e8c72e8` 커밋 메시지)도 범위 밖 리팩토링이 아니라, `origin/main` 쪽이 `openStream` 을
  `StreamClaim` 반환으로 바꾸며 게이트를 함수 내부로 옮긴 것과 이 브랜치의 `resumeDeferredStream`
  게이트가 중복되는 실제 병합 충돌의 해소다 — 방치하면 "판정 1"에서 막 고친 CRITICAL(캡처해 둔
  옛 토큰으로 SSE 재오픈)이 부활한다고 커밋 메시지가 명시한다. 병합 해소의 정상 범위.

## `review/**` 산출물 처분 주장 재검증

이 브랜치 자체가 한 번(`16_56_39`→`17_15_33_2`) "커밋된 리뷰 산출물이 실제 커밋보다 넓은 완료를
주장"하는 CRITICAL 을 냈던 이력이 있어, 이번 라운드(`17_25_34_2`)의 처분 주장 3건(C1 코드 fix·C2
CHANGELOG·W4 frontmatter 재판정)을 그 선례와 같은 방법으로 재검증했다.

- **C1(코드)**: RESOLUTION 이 "`onRefreshed` 통지 + `deferredStreamRef`", "지수 백오프 재예약(catch)"
  을 주장 — `git show 410705910` 로 직접 대조한 결과 두 항목 모두 실제 diff 에 존재(위 판정 1).
  일치.
- **C2(CHANGELOG)**: RESOLUTION 이 "Unreleased 항목에 3번째 갈래 신설"을 주장 — `git show
  092d784a3 -- CHANGELOG.md` 및 현재 `CHANGELOG.md:172`(§재로드 복원 절 3번 항목, "세션은
  유지하고 스트림만 미뤄 둔 뒤…")로 확인, 일치.
- **W4(frontmatter 재판정)**: "노트 자체를 제거"(RESOLUTION) — 위 판정 2 에서 `grep -n "Planned"`
  0건으로 직접 확인, 일치. 이 문서가 인용한 "실제 이행 항목 7개" 서술도 plan 파일과 대조해
  일치.
- 이번 라운드가 스스로 지적한 "직전 라운드(`17_15_33_2`)가 documentation WARNING 2건을 유실했다"는
  주장(C3)도, `17_15_33_2/documentation.md`(프롬프트 파일 63)의 W1(CHANGELOG 3-state 잔존)·W2(자기제거
  체크리스트 부재)와 `17_25_34_2/SUMMARY.md` 의 서술을 대조한 결과 실제로 그 두 WARNING 이 `17_15_33_2`
  RESOLUTION/SUMMARY 의 반영·보류 목록 어디에도 없었음을 프롬프트 텍스트 자체로 재확인했다 — 이번
  라운드가 정확하게 그 유실을 스스로 잡아 W3·W4 로 다시 처리했다.
- 앞선 라운드(`16_56_39`)의 CRITICAL 자체("`16_42_07` 산출물이 `"stale"` 반영을 거짓 주장")도
  `092d784a3` 이전 이력에서 이미 정정 완료로 표시돼 있고, 이번 재검증에서 그 정정이 뒤집히거나
  재발한 흔적은 발견되지 않았다.

**불일치 발견 없음** — 이번 라운드의 산출물 처분 주장은 모두 실제 커밋·파일 상태와 일치한다.

## 발견사항

- **[INFO]** `review/code/2026/08/10/{16_09_40,16_26_09,16_42_07,16_56_39,17_15_33,17_15_33_2,17_25_34,17_25_34_2}/**`
  (7라운드+1개 빈 라운드분) 리뷰 산출물이 이번 diff 에도 대량 포함됨
  - 위치: `review/code/2026/08/10/**`
  - 상세: `CLAUDE.md` 가 지정한 저장 위치 관례와 이 브랜치 자신의 선례(`b8689ec41`·`de6a1b84b`·
    `c591566e4`·`840c5857a`·`319b1e8b5`·`a601cecce` 등 `chore(review):` 커밋)에 부합하는 정상
    부산물이며, 이전 라운드(`16_42_07`·`17_15_33_2`)의 scope 리뷰가 이미 같은 판단을 내렸다.
    라운드가 7개로 늘어난 것 자체는 스코프 이탈이 아니라 CRITICAL 이 연쇄(원 구현 2건 + 수정
    과정에서 4건)한 결과이고, 각 CRITICAL 은 위에서 확인했듯 그 직전 수정이 만든 것을 그 다음
    라운드가 잡는 정상적인 fix-cycle이다.
  - 제안: 없음(관례 준수, 조치 불요).
- **[INFO]** 작업트리에 커밋되지 않은 삭제 1건(`review/code/2026/08/10/17_25_34/_retry_state.json`)이
  있으나 이는 `git status` 상 워킹트리 변경(uncommitted)일 뿐 이번 리뷰 대상 diff(`origin/main...HEAD`)
  에 포함되지 않는다 — 참고로만 기록.
  - 제안: 없음(이번 diff 범위 밖).

## 요약

두 확장 모두 **이 PR 자신이 만든 문제에 대한 비례적 응답**이라는 동일한 성격을 갖는다. (1)
`use-token-refresh.ts` 재시도 추가는 원 티켓이 도입한 `refresh_deferred` 갈래가 스스로 지목한
유일한 복구 수단(주기 갱신)이 실제로는 복구를 완수하지 못했던 CRITICAL 을 닫은 것이며, 다른
PR/기능의 결함을 끌어들인 것이 아니다 — `git show` 로 diff 전문을 대조해 무관한 변경이 없음을
확인했다. (2) `origin/main` 머지·frontmatter 승격·plan 이동·링크 4곳 갱신은 이 브랜치 이전
라운드가 이미 실증해 둔 교차-PR 경합의 예고된 이행 의무이며, 승격·배너 제목·§R4 고지 제거·
`spec/0-overview.md` 미러·역링크 3개 파일까지 실제 상태를 `git`/`grep` 으로 전수 재검증한 결과
모두 일치한다(살아있는 문서에 깨진 링크 없음, `Planned` 잔존 없음). `review/**` 산출물의 처분
주장(C1·C2·W4)도 `git show` 재검증 결과 실제 커밋과 정확히 일치해, 이 브랜치가 한 번 냈던
"산출물-커밋 불일치" 결함의 재발은 없다. 무관한 리팩토링·포맷팅 뒤섞임·기능 확장(over-engineering)·
불필요한 주석/임포트 정리·의도치 않은 설정 변경은 발견되지 않았다.

## 위험도

NONE
