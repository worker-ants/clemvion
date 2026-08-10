# 변경 범위(Scope) 리뷰 — plan-lifecycle-gates

## 검토 방법

리뷰 페이로드가 "전체 파일 컨텍스트"만 제공하고 unified diff 를 포함하지 않아, `git diff origin/main...HEAD -- codebase/frontend/src/lib/docs/__tests__/*` 로 실제 변경분을 직접 대조했다. 대상 3파일은 `9e880e908`(feat) → `f4a1723be`(fix, SUMMARY#1/#2) → `882f15d6f`(fix, 재리뷰 W1/W2) 3개 커밋에 걸친 동일 작업의 누적 diff이며, 각 커밋 메시지가 이전 ai-review 라운드의 WARNING 을 그대로 조치한 이력이 코드 내 주석(`ai-review WARNING #1`, `#2`)에 명시되어 있어 교차검증이 쉬웠다.

## 발견사항

없음. 세 파일의 변경분은 커밋 메시지가 표방하는 목표("plan 이동이 남기는 두 갭 — `status` 모순 · 살아있는 plan 의 깨진 상대링크 — 에 게이트를 건다")에서 벗어나지 않는다.

- `plan-frontmatter.test.ts`: `collectTopLevelPlans` 를 손으로 짠 순회에서 `spec-links.ts` 의 `collectLivePlanMarkdown` 위임으로 바꾼 리팩터링이 포함되어 있으나(diff 상 `-`로 삭제된 옛 `fs.readdirSync` 블록), 이는 파일 상단 주석이 직접 경고하는 "스캔 로직이 두 곳에서 복제되면 `0-`/`_` 접두 필터가 조용히 어긋난다"는 실측 결함(ai-review WARNING #1)을 해소하기 위한 필수 수반 변경이지, 무관한 정리가 아니다. 새로 추가된 `collectCompletedPlans` + `TERMINAL_STATUSES` + 2개 `describe` 블록(하단 status 모순 검사, `findBrokenPlanLinks` 위임 검사) 모두 동일 목표의 직접 구현이다.
- `spec-links.ts`: `collectLivePlanMarkdown`, `findBrokenPlanLinks` 두 함수를 순수 추가(export)했을 뿐, 기존 `findBrokenLinks`/`findBrokenSpecLinksInSources`/`findBrokenLinksInFiles` 등 기존 함수는 그대로다. `TERMINAL_STATUSES` 어휘 확장(`implemented`/`applied`/`superseded`)도 "실측으로 발견된 기존 어휘, 새 값 추가 시 재판단 지점"이라는 주석으로 근거를 명시해 임의 확장이 아니다.
- `spec-links.test.ts`: 세 번째 진입점(`findBrokenPlanLinks`)에 대한 negative-path 픽스처만 순수 추가. 기존 `findBrokenLinksInFiles core` 테스트 블록은 무변경.
- 임포트: 양쪽 테스트 파일에 추가된 `collectLivePlanMarkdown`/`findBrokenPlanLinks` 임포트는 모두 실사용됨. 불필요한 임포트 없음.
- 포맷팅: diff 에 실질 변경과 무관한 공백/줄바꿈 정리는 섞여 있지 않다.
- 주석: 신규 주석 블록이 길지만(특히 `plan-frontmatter.test.ts` 상단 "2026-08-09" 섹션), 전부 이번 게이트 도입의 배경(실측 결함 2건·뮤테이션 검증 결과)을 설명하며, 이 리포지토리의 기존 관례(파일 상단에 "왜"를 남기는 방식, `ai-review WARNING #N` 참조)와 일치한다. 무관한 주석 추가/삭제 없음.
- 설정 변경: 없음. 세 파일 모두 테스트/헬퍼 소스이며 설정 파일은 포함되지 않는다.

## 요약

리뷰 대상 3파일의 변경분은 "plan 이동이 남기는 두 갭에 게이트를 건다"는 단일 목표에 시종일관 부합하며, 포함된 리팩터링(`collectTopLevelPlans` 위임화)조차 그 목표의 정합성(중복 스캔 로직 drift 방지)을 위해 필수적인 수반 변경으로 문서화되어 있다. 커밋 이력상 이전 ai-review 라운드의 WARNING 을 조치한 흔적이 코드 주석에 그대로 남아 있어 스코프 이탈 없이 반복적으로 좁혀진 작업임을 확인했다. 요청 외 기능 확장, 무관한 파일 수정, 의미 없는 포맷팅/주석/임포트/설정 변경은 발견되지 않았다.

## 위험도

NONE
