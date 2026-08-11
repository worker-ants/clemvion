# 변경 범위(Scope) Review

대상: `origin/main` 대비 워킹트리 전체(커밋 14개 + 미커밋 워킹트리 변경 2파일) —
§3.1-2·§R4 재로드 REST 오류 분기 구현 + 4라운드(`16_09_40`/`16_26_09`/`16_42_07`/이번 `16_56_39`)
자동 리뷰 반영 사이클 + 그 산출물 커밋.

## 발견사항

- **[CRITICAL]** `16_42_07` 라운드가 이미 커밋한 `RESOLUTION.md`/`SUMMARY.md` 가 "반영했다"고 주장하는
  CRITICAL 수정(non-terminal refresh 실패 시 반환값을 `"continue"` → `"stale"`)이, 그 산출물을 커밋한
  시점(`c591566e4`)까지의 실제 코드에는 반영되지 않은 채였다 — 이번 diff 를 만드는 지금 시점에서야
  **미커밋 워킹트리**에 그 수정이 나타난다. 즉 "산출물 커밋" 이 자기 자신이 속한 diff 범위보다 넓은
  완료를 주장했다(claimed scope > delivered scope).
  - 위치(주장): `review/code/2026/08/10/16_42_07/RESOLUTION.md:16-18` —
    「**조치**: `"stale"` 반환. `"ended"` 는 아니다 … 세션은 보존하고 이번 왕복만 포기한다는 뜻이
    `"stale"` 이고, 다음 복구는 주기 갱신이 맡는다. **반환값이 틀렸지 분기 조건이 틀린 게
    아니었다.**」 및 같은 파일 `:54` 「뮤테이션 누적 12종」.
    `review/code/2026/08/10/16_42_07/SUMMARY.md:18` — Critical 표 1행 「**반영** — `"stale"` 반환
    (세션 보존 + 호출부 정지). 뮤테이션 RED 2건」, 같은 파일 `:50-51` 「뮤테이션 누적 **12종** —
    이번 라운드: `"stale"`→`"continue"`(RED 2) · …」.
  - 위치(실제 코드): `codebase/channel-web-chat/src/widget/use-widget.ts` — `recoverFromExpiredToken`
    콜백의 `catch (refreshErr)` 블록 안, `terminal` 이 `false` 인 분기(프롬프트에서는 크기 제한으로
    diff 가 생략돼 게이트 번호가 없어 함수/블록명으로 기재). `git show HEAD:codebase/channel-web-chat/src/widget/use-widget.ts`
    로 직접 대조하면 이 분기는 지금도 `return "continue"; // 종료로 오판하지 않는다 — SSE 가 1차
    복구 경로다.` 그대로다.
  - 상세: `git log --oneline`(`deb9b6978` .. `c591566e4`)과 `git show <commit> -- use-widget.ts` 로
    라운드별 커밋을 실측했다. 라운드 1(`4eb1be379`)·라운드 2(`31b14aa22`)는 각 라운드 RESOLUTION 이
    주장한 코드 변경이 정확히 그 커밋 diff 안에 들어 있다(직접 대조 확인). 그러나 라운드 3의 fix
    커밋(`153791125`, `08bd668a5`)은 `use-widget.ts` 를 건드리되 **JSDoc 블록 이동만** 하고, `410`
    분기·재현 시도 주석을 추가했을 뿐, `return "continue"` → `"stale"` 치환은 **어느 커밋에도 없다**
    (`git show 153791125 08bd668a5 -- use-widget.ts | grep 'return "continue"\|return "stale"'` 로
    확인 — `-`/`+` 양쪽에 동일하게 `return "continue";` 가 남아 있어 순수 이동임을 확인). 그런데
    `RESOLUTION.md`/`SUMMARY.md` (같은 라운드 산출물, `c591566e4` 로 커밋됨)는 이 항목을 "판정: 유효.
    …반영" 그리고 "뮤테이션 RED 2건" 이라고 **완료·검증된 사실**로 기록했다. `git diff` 로 확인한
    실제 워킹트리 변경은 이번 라운드 시작(`meta.json` 타임스탬프 `16:56:39`) **불과 몇 분 전**
    (파일 mtime `16:54`–`16:55`)에야 작성됐다 — 즉 이 CRITICAL 수정은 라운드 3 안에서 한 번도
    커밋된 적이 없고, "뮤테이션 RED 2건" 검증도 그 시점엔 커밋된 코드가 아니라 임시 상태에서만
    수행됐을 가능성이 높다(가능한 원인: 뮤테이션 테스트의 "원복" 단계가 새 fix 가 아니라 옛
    `"continue"` 상태로 되돌린 채 이후 커밋을 만든 것 — 이 저장소 메모리가 이미 경고한
    "가드 mutation 원복은 cp+절대경로(git checkout 금지) — 커밋 먼저 → mutation" 사고와 같은 형태).
    결과적으로 `16_42_07` 리뷰 산출물 커밋은, 자신이 속한 diff(그 시점까지의 fix 커밋들) 범위보다
    **넓은 완료를 주장**하는 영구 기록을 남겼다 — 이 저장소가 반복 지적해 온 "review/ 는 SoT 아니다"
    ·"문서한 보장이 구현보다 넓으면 안 된다" 교훈이 review 산출물 자신에게서 재발한 사례다.
  - 제안: (1) 지금 워킹트리의 fix 자체는 정확하고 최소 범위이므로 그대로 커밋할 것 — 다만 커밋
    메시지에 "`16_42_07` RESOLUTION 이 반영됐다고 기록했지만 실제로는 코드에 누락돼 있던 CRITICAL 을
    이제야 실제로 닫는다"는 사실을 명시해, 커밋 이력 자체가 앞선 산출물의 오기재를 정정하게 할 것.
    (2) 뮤테이션 하네스의 원복(restore) 단계를 점검할 것 — fix 를 적용 → 뮤테이션 RED 확인 → 뮤턴트를
    원복할 때 **fix 이전이 아니라 fix 이후 상태로** 복원되는지 재확인 필요. (3) 이번 라운드
    (`16_56_39`)의 `requirement`/`testing` reviewer 도 같은 코드 경로를 볼 것이므로 중복 지적이
    예상되나, 이 항목은 "코드 결함" 이 아니라 "이미 커밋된 산출물의 완료 주장과 실제 diff 의 불일치"
    이므로 scope 관점에서 별도로 남긴다.

- **[INFO]** 위 CRITICAL 을 제외하면, 미커밋 워킹트리 변경 2건(`use-widget.ts`, `use-widget-eager-start.test.ts`)
  자체의 스코프는 정확히 그 항목(non-terminal refresh 실패의 반환값 수정 + 그 상태-필터 축을 겨냥한
  회귀 테스트 1건 추가)로 국한된다
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts`(`recoverFromExpiredToken` non-terminal
    분기), `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts`(기존 "네트워크 오류"
    `it` 블록의 단언 교체 + 신규 `it("§R4: refresh 가 \`500\` 으로 실패해도 종료로 확정하지 않는다 —
    상태 **필터** 축")`).
  - 상세: `git diff -- use-widget.ts use-widget-eager-start.test.ts` 로 대조한 결과, 코드 변경은
    `return "continue"` → `return "stale"`(주석 포함 11줄) 1곳뿐이고, 테스트 변경은 기존 테스트의
    `waitFor` 대기 조건을 `storage != null`(boot 전에 이미 참이라 뮤턴트를 못 가르는 vacuous 조건,
    `16_42_07` testing WARNING 이 실측으로 지적한 것과 동일 결함 형태)에서 "refresh 가 실제로 호출됐는가"
    로 바꾸고 단언에 `getEs()).toBeNull()`(스트림 미오픈 확인)을 추가했으며, `500` 상태 필터 케이스
    `it` 하나를 병렬 구조로 신설했을 뿐이다. 무관한 리팩토링·포맷팅·주석 정리·import 변경은 없다.
  - 제안: 없음 — 이 부분은 그대로 커밋해도 스코프 문제 없음.

- **[INFO]** 리뷰 산출물 33파일(`review/code/2026/08/10/{16_09_40,16_26_09,16_42_07}/**`)이 이번
  diff 에 포함된 것 자체는 세 라운드 전부(`16_09_40`, `16_26_09`, `16_42_07` 각 scope 리포트)가 이미
  검토해 "관례 부합, 스코프 이탈 아님"으로 판정한 패턴의 연장이며, 이번 실측으로도 그 결론에 이견
  없음(단, 그 33파일 중 `16_42_07/RESOLUTION.md`·`SUMMARY.md` 2개는 위 CRITICAL 이 지적하는 내용
  자체를 담고 있다는 점만 다름).
  - 위치: `review/code/2026/08/10/16_09_40/**`(11파일), `review/code/2026/08/10/16_26_09/**`(11파일),
    `review/code/2026/08/10/16_42_07/**`(11파일).
  - 상세: `CLAUDE.md` 가 지정한 `review/code/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/` 저장 위치·이 브랜치
    자체의 선례(`b8689ec41`, `de6a1b84b`, `c591566e4` 모두 `chore(review): ... 라운드 산출물` 형태)와
    일치한다. 각 라운드 파일 집합(SUMMARY/RESOLUTION/14개 forced-subset reviewer md/meta.json/
    _retry_state.json)도 구조가 동일해 그 자체로는 스코프 확장이 아니다.
  - 제안: 없음(구조적으로는 정상). 다만 위 CRITICAL 처럼 "산출물이 사실과 다른 완료를 기록"하는
    사고가 재발하지 않도록, 산출물 커밋 직전 실제 코드 diff 와 RESOLUTION 의 "반영" 표를 자동 대조하는
    가드(예: RESOLUTION 이 언급하는 파일들의 diff 가 그 커밋 범위 안에 실재하는지 확인)를 향후 검토할
    가치가 있다.

- **[INFO]** 기능/문서 7파일(`CHANGELOG.md`, `session-store.ts`, `use-token-refresh.ts`,
  `use-widget-eager-start.test.ts`, `use-widget.ts`, `spec/7-channel-web-chat/3-auth-session.md`,
  `plan/in-progress/webchat-auth-session-status-reconcile.md`)은 라운드 1~3 scope 리포트가 이미 각각
  타당성을 확인했고, 이번에 `CHANGELOG.md:171`("재차 `401`·`410` 이면 종료로 확정한다")과
  `spec/7-channel-web-chat/3-auth-session.md` §3.1-2(`401`·`410` 로 확장, frontmatter 재판정 안내
  4줄)를 직접 대조한 결과 라운드 3 이 지적한 "문서 7자리 중 `401` 만 언급" 갭도 해당 두 위치에서는
  이미 닫혀 있다(코드가 `401`/`410` 을 처리하는 것과 문서 서술이 일치). 무관한 설정 파일 변경(`package.json`
  등)은 없다.
  - 제안: 없음.

## 요약

이번 diff 는 §3.1-2·§R4 재로드 REST 오류 분기 구현 자체와, 그 위에서 4라운드(누적 CRITICAL 2 ·
WARNING 20+ 반영)에 걸쳐 진행된 자동 리뷰-수정 사이클의 정상적인 산출물이다. 기능/문서 7파일과
리뷰 산출물 33파일 구조는 이전 3라운드의 scope 판정과 일치해 새로운 스코프 이탈(무관한 리팩토링·
포맷팅·주석/임포트 정리·기능 확장·설정 변경)은 발견되지 않았다. 그러나 실측 결과 **`16_42_07`
라운드 자신의 `RESOLUTION.md`/`SUMMARY.md`(이미 이 diff 에 커밋돼 포함된 파일)가 "반영했다"고
기록한 CRITICAL 수정이 그 라운드의 실제 fix 커밋들에는 존재하지 않았고, 지금 이 리뷰가 대상으로
삼는 시점까지도 미커밋 워킹트리에만 존재**한다 — 즉 committed 산출물의 완료 주장(scope claimed)이
실제로 그 시점까지 커밋된 코드 범위(scope delivered)보다 넓었다. 코드 자체(워킹트리의 `"continue"`→
`"stale"` 수정과 신규 회귀 테스트)는 정확하고 최소 범위이므로 스코프 문제가 없지만, 그 수정이
**아직 커밋되지 않은 채** 이미 "완료됨"으로 기록된 산출물이 함께 diff 에 실려 있다는 사실 자체가
이번 라운드에서 가장 우선적으로 바로잡아야 할 스코프 무결성 문제다.

## 위험도

CRITICAL
