# 변경 범위(Scope) 리뷰 — scope.md (`21_51_20`)

## 리뷰 대상

`origin/main...HEAD` 전체 누적 diff — 5개 커밋(`7d6854cb9` → `5a33656f9` → `ca260d87e` →
`2ca5244ae` → `8602c93e5` → `babc28bc6`), 54개 파일, +3782/-40. 그중 실질 코드·문서 변경은
10개 파일(약 246줄)이고, 나머지 44개 파일(약 3536줄)은 이 세션 자체가 만든 4개 리뷰 라운드
(`review/code/2026/08/30/{20_21_06,20_46_48,21_12_21,21_34_15}/**`)의 committed 산출물이다.

## 발견사항

- **[INFO]** 서로 무관한 두 결함 수정이 최초 커밋(`7d6854cb9`)에 여전히 함께 묶여 있다 —
  이미 이전 라운드에서 WARNING 으로 지적되고 발생원이 기록된 상태로 disposed 됐다
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`
    (`updateExecutionStatus` 위 JSDoc, 현재 8553~8584행) vs
    `.claude/workflows/_lib/agent-return.mjs`(`REPORT_RETURN_CONTRACT`) 및 3개 워크플로 미러 —
    판단 기록: `plan/in-progress/backend-lint-gate-broken-on-main.md` 의
    "**커밋 분리에 대한 판단 기록 (`20_21_06` scope W4)**" 블록
  - 상세: (1) `REPORT_RETURN_CONTRACT` 의 파일/반환 메시지 sink 분리 계약 fix 와 (2)
    `updateExecutionStatus` self-deadlock 확인의 호출 스택 축 audit 은 여전히 별개 주제인데
    같은 커밋에 있다. 이 판단은 이미 `20_21_06` 라운드의 scope 리뷰어가 WARNING 으로 지적했고,
    developer 가 "사용자가 두 건을 함께 요청했고, 두 번째는 순수 주석이라 기능 위험이 없다 —
    되돌리지 않되 판단을 기록한다" 는 사유로 명시적으로 disposition 을 남겼다(plan 파일에
    등재, 커밋 로그로도 추적 가능). 이후 3라운드 동안 이 판단은 재론되지 않았고, 실제로
    (2)는 순수 JSDoc 주석이라 런타임 위험이 없다는 판단도 재검증(코드 diff 확인)됐다.
    새로 지적할 사실은 없고, **기존 disposition 이 여전히 유효함**을 재확인한 것뿐이다.
  - 제안: 조치 불요 — 이미 근거를 남기고 disposed 됨. 향후 유사 상황에서 커밋을 주제별로
    나누라는 교훈은 plan 에 이미 기록돼 있다.

- **[INFO]** 이번 PR 의 날짜-오타 스윕(`ca260d87e`, "오지 않은 날짜 11곳")이 이 PR 자신이
  만든 오타 범위를 넘어, PR 이전부터 존재하던 동일 오타 2곳까지 함께 고쳤다
  - 위치: `plan/complete/spec-draft-raw-query-results.md` (복원 배너 줄),
    `plan/in-progress/backend-lint-gate-broken-on-main.md:282` 부근 (`#1242` draft 복원 항목)
  - 상세: 두 줄의 `2026-08-31` → `2026-08-30` 오타는 이 PR 이전 커밋(`5edf68888`, `#1244`,
    이미 `origin/main` 에 병합됨, `git merge-base --is-ancestor` 로 확인)에서 생긴 것이다.
    직전 라운드(`20_46_48` documentation.md)는 그중 `backend-lint-gate-broken-on-main.md:282`
    쪽을 명시적으로 "이번 PR 의 diff 범위 밖" 이라 판단하며 손대지 말라고 적었는데, 바로 다음
    fix 커밋(`ca260d87e`)이 이 파일과 `spec-draft-raw-query-results.md` 를 모두 정정해 그
    범위를 넘었다. 위험은 매우 낮다(문서 내 날짜 문자열 1글자 수정, 실행 경로 없음) 이고
    커밋 메시지에 "11곳" 이라 스스로 수치를 밝혀 투명하게 공개했다 — 은폐된 drive-by 는 아니다.
  - 제안: 조치 불요 — 저위험·공개된 수정. 다만 향후 "diff 범위 밖" 이라고 명시적으로 기록한
    리뷰 판단을 다음 라운드가 뒤집을 때는 그 사실 자체를 plan/커밋 메시지에 한 줄 밝히면
    다음 사람이 "번복됐다" 는 걸 더 빨리 알 수 있다(현재는 커밋 메시지의 "11곳" 이라는 수치
    변화만으로 유추 가능한 상태).

- **[INFO]** 이번 diff 의 대부분(44/54 파일, 약 3536/3782줄)이 이 세션 자체가 생성한 4개
  리뷰 라운드의 committed 산출물이다 — 관례에 부합하며 scope 위반은 아니다
  - 위치: `review/code/2026/08/30/20_21_06/**`, `20_46_48/**`, `21_12_21/**`, `21_34_15/**`
  - 상세: `CLAUDE.md` 는 코드 리뷰 산출물의 저장 위치를
    `review/code/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/` 로 명시하고, "구현 완료 후 자동 review/fix
    는 상시 승인된 강제 의무" 라고 규정한다 — 매 라운드 산출물을 커밋하는 것은 이 저장소의
    확립된 관례다. 실질 코드·문서 변경(핵심 7개 코드/테스트 파일 + plan 3개 파일, 약 246줄)에
    비해 diff 총량이 15배 이상 커 보이지만, 이는 scope 이탈이 아니라 리뷰 파이프라인 자체의
    산출물 축적이다.
  - 제안: 조치 불요. 참고 기록.

## 요약

이 changeset 은 report-return 계약(파일 vs 반환 메시지 sink 분리) fix 와
`updateExecutionStatus` self-deadlock 호출 스택 축 audit 이라는 두 주제를 여전히 한 커밋에
담고 있지만, 이는 이미 이전 라운드(`20_21_06`)에서 WARNING 으로 지적되고 근거와 함께
disposed 된 사안이라 이번 라운드에서 새로 문제 삼을 근거는 없다. 이후 라운드들이 추가한
변경(날짜 오타 정정, JSDoc 압축·plan 이관, 세는 방법 비대칭 해소)은 모두 직전 라운드가 낸
지적에 대한 좁은 대응이며, 의도하지 않은 리팩토링·기능 확장·무관한 코드 영역 수정은
관찰되지 않았다. 유일한 경계선 사례는 날짜-오타 스윕이 이 PR 자신이 만들지 않은 두 개의
선행 오타(다른 병합된 PR 기원)까지 정정한 것인데, 저위험·공개적으로 수치화된 drive-by 라
INFO 로만 남긴다. diff 총량의 대부분(44/54 파일)은 이 저장소의 committed 리뷰 산출물
관례에 따른 것으로 scope 문제가 아니다.

## 위험도

LOW
