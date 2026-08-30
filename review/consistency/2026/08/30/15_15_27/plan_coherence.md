# Plan 정합성 검토 — target: `spec/data-flow/` (--impl-done)

## 컨텍스트 재구성

`origin/main...HEAD` 의 code_areas diff 는 backend 5개 파일(`source-scan.ts`/`.spec.ts`,
`update-returning-rows.spec.ts`, `kb-stats.helper.ts`/`.spec.ts`)뿐이며 `spec/` 은 1줄도
건드리지 않는다. 이는 `plan/in-progress/update-returning-tuple-shape.md`(frontmatter
`worktree: raw-update-guard-scope-0e154c` — 이 워크트리 자신)의 체크리스트 항목
**"구조적 가드가 '이 3개 파일' 하드코딩이다"**를 "래퍼가 아니라 발견형 가드로" 완료
처리한 작업과 정확히 일치한다. `git diff --stat`으로 확인하니 그 plan 문서 자체도 이번
브랜치 범위에서 89줄 갱신되어(체크리스트 `[x]` 전환 + 완료 배너 + 6라운드 리뷰 이력) 코드
diff 와 동기 상태다. `HEAD` 는 6라운드 코드리뷰(`15_07_17`, Critical/Warning 0, reviewer
7/7 NONE)로 수렴한 뒤의 상태이며, 직전 plan_coherence 라운드(`14_43_41`, RISK=NONE)
이후 추가된 커밋은 주석 언어 정정(`e5b237377`)과 리뷰 아티팩트(`92de099ac`)뿐 — 코드
로직 변경 없음.

## 검증 절차 (직접 확인)

이전 라운드(`14_43_41`)의 결론을 그대로 인용하지 않고 핵심 주장 3가지를 재확인했다:

1. **`__test-utils__` devDependency 비의존 유예 조건 위반 여부** —
   `plan/in-progress/auth-guard-reflection-hardening.md:321-345`의 `tsconfig.build.json`
   exclude 유예는 "`__test-utils__` 가 순수 함수인 동안" 조건부다. 이번 diff 가
   `source-scan.ts`에 추가한 `countRawUpdateReturning`/`hasRawUpdateReturning`은 정규식
   기반 순수 함수로 새 import 가 없다 — 유예 조건을 깨지 않는다(직접 diff 재확인).
2. **다른 in-progress plan 이 관련 식별자를 참조하는지** — `grep -rl
   "countRawUpdateReturning\|findUnguarded\|updateReturningRows\|source-scan\.ts\|
   kb-stats.helper" plan/in-progress/` 결과는 `auth-guard-reflection-hardening.md`(위
   유예 조건 문맥)와 `update-returning-tuple-shape.md`(자기 자신) 둘뿐 — 다른 plan 의
   후속 항목을 무효화하거나 새로 요구하는 지점 없음.
3. **[planner 위임] 두 항목이 이번 diff 로 우회되지 않았는지** — plan 본문 §후속에 여전히
   미해결로 남아 있는 두 항목(① raw SQL shape 불변식의 `spec/conventions/` 규약 승격,
   ② 소급 각주 5건 — `spec/data-flow/2-auth.md` 포함 — 과 `node-cancellation.md`
   `pending_plans:` 등재)은 `developer` 권한 밖이라 이번 PR 이 시도하지 않았고, diff
   stat 상 `spec/` 변경이 0줄인 것으로 우회 여부를 재확인했다. 정직하게 미해결로 남아 있다.

## 발견사항

없음.

## 요약

이 diff 는 `update-returning-tuple-shape.md`가 이미 추적하던 단일 체크리스트 항목(가드의
손 큐레이션 한계)을 발견형 가드로 완결한 작업이며, plan 문서 자체가 동일 커밋 범위에서
동기 갱신됐다. `spec/` 비접촉이라 target(`spec/data-flow/`)과의 충돌 표면 자체가 없고,
`[planner 위임]`으로 남은 두 미해결 결정(규약 승격·소급 각주)은 이번 PR이 시도도 우회도
하지 않았다. 관련 식별자를 참조하는 유일한 타 plan(`auth-guard-reflection-hardening.md`)의
유예 조건도 직접 재확인한 결과 깨지지 않았다. Plan 정합성 관점에서 지적할 결함이 없다.

## 위험도
NONE
