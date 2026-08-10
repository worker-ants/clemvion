# 변경 범위(Scope) 리뷰 — plan-frontmatter.test.ts

## 발견사항

- **[INFO]** 파일 상단 주석 블록이 매우 길다 (약 40줄)
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-frontmatter.test.ts:13`~`50` (파일 헤더 주석)
  - 상세: `// ── 2026-08-09: ...` 절과 그 위 "이 주석은 추출 직후 ... 문서끼리 정면으로 어긋난 상태였다" 절 등, 과거 ai-review/consistency 라운드에서 발견된 실수(정본 오기재·스코프 불명확)를 소급 정정하며 남긴 이력 주석이 상당한 분량을 차지한다. 코드 diff(4개 신규 `it`/`describe` + import 4개 + 리팩터 1개)에 비해 주석 diff 비중이 크다.
  - 판단: git log(`f5f454844 fix(harness): 헤더 주석의 정본을 plan-scan.ts 로 정정 (ai-review W1)`, `e9b789a44`, `88555a52b`)를 보면 이 주석들은 실제로 이전 리뷰 라운드가 지적한 "정본 오기재"·"스코프 불명확" 결함을 정정한 것이며, 이 프로젝트가 관례적으로 `## Rationale`/이력 주석을 코드 근접부에 남기는 스타일(CLAUDE.md·기존 커밋 다수)과 일치한다. 장식적 리팩터가 아니라 **직전 리뷰 발견사항에 대한 정정**이므로 범위 위반으로 보지 않는다. 참고로만 기록.
  - 제안: 조치 불요. 향후 이 파일이 더 커지면 이력 주석 일부를 `plan/` 문서로 옮기는 것을 고려할 수 있으나 이번 변경 범위에서는 문제 없음.

## 요약

`git diff origin/main...HEAD -- .../plan-frontmatter.test.ts` 기준으로 실제 변경은 (1) `plan-scan.ts`/`spec-links.ts` 의 신규 export 4개 import(전부 사용됨), (2) 손으로 짠 `collectTopLevelPlans` walker를 `collectLivePlanMarkdown` 위임으로 대체(중복 walker 제거), (3) "완료 plan 의 status 가 디렉터리와 모순되지 않는가"·"살아있는 plan 의 상대링크 무결성" 두 신규 게이트 테스트 추가, (4) 그 배경을 설명하는 이력 주석 확장 — 네 가지뿐이다. 이 파일이 속한 브랜치명(`plan-lifecycle-gates`) 및 함께 커밋된 형제 plan 문서(`plan/in-progress/docs-guard-walker-dedup.md` — "plan-lifecycle-gates 가 plan walker 를 네 벌 → 한 벌로 줄였다"라고 명시)가 이 리팩터·신규 게이트를 해당 PR의 선언된 목표로 확인해 준다. 무관한 파일 손대기, 사용하지 않는 import, 의미 없는 포맷팅 변경, 설정 파일 변경, 요청 밖 기능 확장은 발견되지 않았다. 주석 분량이 크지만 실제로는 이전 리뷰 라운드에서 지적된 정본 불일치를 정정한 이력 기록이라 범위 이탈로 보기 어렵다.

## 위험도
NONE
