# 변경 범위(Scope) 코드 리뷰

## 검토 방법

`origin/main...HEAD` 누적 diff 는 정확히 **112개 파일**(`git diff origin/main...HEAD --name-only | wc -l` 로 직접 확인, 프롬프트의 "파일 1~112" 목록과 일치)이다. 실질 코드 4개(`plan_guard.py`/`test_plan_guard.py`/`spec-links.test.ts`/`stray-tool-tags.test.ts`)는 diff 를 직접 읽었고, 이번 라운드가 새로 추가한 커밋(`8218dbb29`, "리뷰 3R")의 `--stat` 을 별도로 떼어 이전 라운드(23_09_35) 이후 무엇이 늘었는지 확인했다. `plan/in-progress/spec-conventions-engine-error-code-surface.md`(파일 14, 프롬프트에서 diff 생략)는 `git show origin/main:...`/`git diff` 로 전문을 직접 대조했다.

이 changeset 은 이미 3라운드 `/ai-review`(scope 포함) + 7라운드 `--spec` consistency-check 를 거쳤다. 아래는 그 누적 처분 위에서 **이번 라운드에 새로 늘어난 것**과 **여전히 남아 있는 표준 관찰**을 구분해 적는다.

## 발견사항

- **[INFO]** 단일 브랜치/PR 이 developer 축(harness 위생)과 project-planner 축(`error-codes.md` 두 surface 병기 spec 결정)을 함께 담는다 — 3라운드 연속 재확인된 처분, 이번 라운드도 새 이탈 없음
  - 위치: 전체 구성. harness 축 = 파일 1~6(`plan-lifecycle.md`/`plan_guard.py`/`test_plan_guard.py`/`error-codes.ts` JSDoc/`spec-links.test.ts`/`stray-tool-tags.test.ts`) + 파일 7~15(`plan/**` 트래킹 문서). spec 축 = 파일 50~111(`review/consistency/2026/09/01/**` 7라운드 산출물) + 파일 112(`spec/conventions/error-codes.md` 본문). 원 결정 문서는 `plan/in-progress/spec-conventions-engine-error-code-surface.md`(파일 14, `git diff origin/main...HEAD` 로 직접 확인) — frontmatter `owner: project-planner`, `worktree: (unstarted)` → `easy-a-harness-hygiene` 로 이번 diff 가 직접 갱신했다.
  - 상세: `CLAUDE.md` 는 `spec/` 변경을 project-planner 로, harness/`codebase/` 변경을 developer 로 역할을 가른다. `plan/in-progress/spec-conventions-engine-error-code-surface.md` 자신도 "developer 가 `spec/` 을 고칠 수 있는 좁은 예외(자기-반증형 소정정)에도 해당하지 않는다"고 명시한다. 그런데도 이 spec 편집이 developer 축과 같은 브랜치/세션에서 처리됐다. 다만 이는 **역할을 건너뛴 것이 아니라 `--spec` 게이트(6라운드, `plan/complete/spec-draft-error-code-two-surfaces.md` draft 경유, 마지막 `21_56_30` BLOCK:NO·Critical 0·WARNING 0)를 통해 planner 트랙 자체를 이 세션 안에서 밟은 것**이고, 이미 `review/code/2026/09/01/22_25_37/RESOLUTION.md`(W1) → `22_44_29/RESOLUTION.md`(W1 재확인) → `23_09_35/scope.md`(동일 지적, LOW)까지 세 차례 검토·처분됐다. 처분 근거는 "사용자가 'A 를 모두 처리하고 PR' 로 묶어 지시했다"이며, 완화책은 **분리 대신 PR 본문에 harness 축/spec 축을 갈라 적는 것**이다.
  - 이번 라운드 확인: `gh pr view` 실행 결과 이 브랜치(`claude/easy-a-harness-hygiene`)에는 **아직 열린 PR 이 없다** — 세 라운드에 걸쳐 약속한 "PR 본문 axis 분리 서술"을 diff 만으로도, PR 조회로도 검증할 수 없는 상태가 그대로 유지된다. 새로운 스코프 이탈은 아니지만, PR 을 실제로 올릴 때 그 약속이 이행됐는지 최종 확인이 여전히 필요하다.
  - 제안: 새 조치 불필요(이미 3회 처분됨). PR 생성 시 본문에 "harness 축(6~15파일) / spec 축(~62파일, `--spec` 게이트 통과 산출물 포함)" 구분 서술이 실제로 들어갔는지 그 시점에 최종 확인할 것.

## 확인했으나 문제 없음 (근거 기록)

- **이번 라운드가 새로 커밋한 것(`8218dbb29`, 25개 파일)은 전부 직전 라운드(`23_09_35`) RESOLUTION 이 약속한 항목에 정확히 대응한다.** `git show --stat 8218dbb29` 로 확인: 코드 4건(`plan_guard.py` +7/-이하, `test_plan_guard.py` +14, `error-codes.ts` JSDoc, `spec-links.test.ts` fixture 보강, `stray-tool-tags.test.ts` 보강) + `spec/conventions/error-codes.md` 2줄(문구 표현 정정, W2 처분) + 그 라운드 자신의 리뷰 산출물(`review/code/.../23_09_35/**`, `review/consistency/.../23_17_23/**`). 무관한 파일 재포맷·다른 정규식 손질·새 기능 추가는 없다.
- **`test_plan_guard.py` 신규 테스트 6건은 순수 추가이고 각각 `plan_guard.py` 의 이번 정규식 변경(비대칭 카운팅)이 만드는 구체적 참/거짓 경로 하나씩에 대응한다** — 열린-인용문·중첩인용·서술대조군·인용문안닫힘단독(허위완료 방지)·자기+인용닫힘공존(참 경로)·인용문안열림거부권(원결함 캐너리). 기존 테스트 수정은 없다(전문 diff 확인).
- **`error-codes.ts` JSDoc 확장(파일 4)은 이번 라운드가 새로 쓴 spec 문구(`error-codes.md` §Overview 의 "비대칭" 프레이밍)와 소스 주석을 동기화하는 것**뿐이고, `spec/conventions/error-codes.md` §Overview 를 정본으로 참조(`See spec/conventions/error-codes.md §Overview`)해 서술을 중복하지 않는다 — 코드-문서 drift 를 만들지 않고 오히려 닫는 방향의 편집이다.
- **`plan/in-progress/spec-conventions-engine-error-code-surface.md`(파일 14) 편집은 `--spec` 6라운드 게이트를 실제로 통과시킨 절차의 기록**이지, 게이트를 우회하고 developer 가 임의로 spec 을 고친 흔적이 아니다 — `/consistency-check --spec` 6회 완료·BLOCK:NO 가 체크박스와 함께 명시돼 있고, "판단 기준을 규약에 안 쓴다"는 유보까지 기록돼 있어 오히려 스코프를 **넓히지 않은** 절제가 보인다.
- **`plan/complete/*.md` 4파일 + `plan/in-progress/webchat-usewidget-extraction.md` 의 편집은 전부 `</content>`/`</invoke>` 잔재 삭제 1줄씩**이며, 같은 changeset 의 신규 가드(`stray-tool-tags.test.ts`)가 검출한 위반을 그 가드를 도입하는 PR 안에서 바로 정리한 것이라 원인-결과가 한 PR 안에 있다.
- **설정 파일 변경 없음** — `package.json`/`tsconfig`/CI 워크플로 어디도 diff 에 없다(`git diff origin/main...HEAD --name-only` 전수 확인).
- **`review/code/**`, `review/consistency/**` 산출물(파일 16~111, 96개)은 스코프 이탈이 아니라 CLAUDE.md 가 지정한 저장 위치("코드 리뷰 산출물 → `review/code/<...>`", "일관성 검토 산출물 → `review/consistency/<...>`")에 그대로 쓰인 필수 감사 기록**이다 — 구현 완료 후 `/ai-review` + fix 는 이 저장소의 상시 승인된 강제 의무라 별도 opt-in 이 필요 없다.

## 요약

이번 4라운드(23_28_32)는 직전 라운드(23_09_35)가 남긴 유일한 스코프 관찰(developer/planner 두 축 번들)을 그대로 재확인했다 — 새로운 이탈은 발견되지 않았고, 이번에 새로 커밋된 25개 파일도 직전 RESOLUTION 이 약속한 항목에 좁게 대응한다. 두 축 번들은 우연한 스코프 크리프가 아니라 사용자가 명시적으로 지시한 범위이고, 그 spec 편집 자체도 developer 가 임의로 한 것이 아니라 `--spec` 게이트 6라운드를 실제로 통과시킨 절차의 산물이다. 유일하게 남는 것은 절차적 확인 항목(PR 본문에 axis 분리 서술이 실제로 들어갔는지)인데, 이 브랜치에는 아직 PR 이 없어 diff 만으로는 검증할 수 없다 — 차단 사유는 아니며 PR 생성 시점에 확인할 사항이다. 포맷팅·불필요 리팩토링·기능 확장·무관한 임포트/설정 변경은 발견되지 않았다.

## 위험도

LOW
