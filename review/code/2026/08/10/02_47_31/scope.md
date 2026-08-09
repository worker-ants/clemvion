# 변경 범위(Scope) 리뷰 — plan-frontmatter.test.ts

## 발견사항

- **[INFO]** 이 파일의 책임이 "frontmatter 3필드 검증" 단일 가드에서 "frontmatter + 완료 plan status 정합 + 살아있는 plan 링크 무결성" 3종 가드로 확장됨
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-frontmatter.test.ts:13-35` (헤더 주석), `:117-198`, `:200-228` (신규 `describe` 블록 2개)
  - 상세: `git diff origin/main..HEAD` 기준으로 이 파일은 `extractLinks`/`findBrokenPlanLinks`(`spec-links.ts`)와 `collectCompletePlanMarkdown`/`collectLivePlanMarkdown`/`findNonTerminalCompletedPlans`(`plan-scan.ts`) import 를 새로 추가하고, `collectTopLevelPlans` 를 손으로 짠 `fs.readdirSync` 순회에서 `collectLivePlanMarkdown` 위임으로 바꿨으며, 신규 `it` 2개(top-level 링크 무결성 · non-vacuity 캐너리)와 신규 최상위 `describe`("completed plans declare a terminal status") 전체를 추가했다. 단독으로 보면 "요청 이상의 확장"처럼 보일 수 있으나, 커밋 이력(`9e880e908 feat(harness): plan 이동이 남기던 두 갭에 게이트 — status 모순 · 살아있는 plan 의 깨진 링크`, worktree 이름 `plan-lifecycle-gates`)과 파일 내부 주석(`:13-18` "Guard: plan 라이프사이클 불변식 3종")이 이 3종 가드가 애초 이 작업의 설계 목표였음을 명시한다. 이후 커밋들(`f5f454844`, `e9b789a44`, `88555a52b`, `6101a04b2`, `f09b21893` 등)은 모두 동일 작업 내 ai-review/consistency 피드백에 대한 조치이지 별개 작업의 혼입이 아니다.
  - 제안: 조치 불필요. 다만 이 파일이 원래 "frontmatter guard" 단일 책임에서 3종 불변식 허브로 커진 만큼, 향후 4번째 불변식이 추가될 경우 별도 파일 분리를 고려할 것.

- **[INFO]** `collectTopLevelPlans` 리팩터링은 범위를 벗어난 코드 정리가 아니라 실측된 버그 수정
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-frontmatter.test.ts:42-48`
  - 상세: 종전 구현이 `0-`/`_` 접두 필터를 손으로 재구현하며 `plan-scan.ts` 의 정본 필터와 조용히 어긋나 있었다고 주석(`:42-45`)이 명시한다. 단일 스캔 소스로 통합한 것은 "무관한 리팩토링"이 아니라 이 파일 자신의 헤더 주석(`:16-19`)이 경고하는 "두 곳이 조용히 틀어지는" 결함을 이 파일 자체가 재현한 것을 고친 것 — 작업 목적(불변식 가드 신뢰성)에 직결된다.
  - 제안: 조치 불필요.

- **[INFO]** 헤더 주석이 영문 장문 서술에서 한글 축약형으로 전면 교체됨
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-frontmatter.test.ts:13-35`
  - 상세: `git diff` 상 주석 블록 전체가 재작성됐다. `:34-35` 자체가 "코드 주석은 현재 규칙만 담는다(ai-review 가 회고 서사 누적을 지적)"라고 명시하여, 이 재작성이 동일 작업 내 이전 라운드의 ai-review 피드백(`f09b21893 fix(harness): 헤더 주석 축약 + describe 스코프 정정`)에 대한 대응임을 자기-문서화하고 있다. 무관한 주석 손질이 아니다.
  - 제안: 조치 불필요.

- import·포맷팅·설정 관점에서 이슈 없음: 신규 import 6개(`extractLinks`, `findBrokenPlanLinks`, `collectCompletePlanMarkdown`, `collectLivePlanMarkdown`, `findNonTerminalCompletedPlans` — `collectLivePlanMarkdown` 은 top-level·describe 내부 양쪽에서 사용) 모두 실사용되며 미사용 import 없음. 기존 `it` 3개(worktree/started/owner 검증, `:97-124`)는 diff 상 본문 변경 없이 그대로 유지되어 불필요한 리포맷팅과 실질 변경이 섞인 흔적이 없다. 설정 파일 변경 없음.

## 요약
이 파일은 `plan-lifecycle-gates` 작업(worktree 이름 자체가 이를 명시)의 직접 대상이며, 신규 import·`describe`/`it` 추가·`collectTopLevelPlans` 위임 리팩터링·헤더 주석 재작성 모두 커밋 이력과 파일 내부 자기-문서화 주석으로 동일 작업 범위 내 반복 ai-review 피드백에 대한 조치임이 확인된다. 요청 밖 기능 확장, 무관한 파일 수정, 의미 없는 포맷팅 변경, 미사용 임포트, 의도치 않은 설정 변경은 발견되지 않았다.

## 위험도
NONE
