# 의존성(Dependency) 리뷰

## 발견사항

- **[INFO]** 새 외부 의존성 없음 — 기존 패키지 재사용
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-scan.ts:27-29` (import `node:fs`, `node:path`, `gray-matter`), `codebase/frontend/src/lib/docs/__tests__/spec-links.ts:14-21` (import `fs`, `path`, `./plan-scan`, `mdast-util-from-markdown`, `mdast-util-to-string`, `github-slugger`, `mdast` 타입)
  - 상세: `git diff origin/main...HEAD -- '**/package.json' '**/pnpm-lock.yaml'` 결과 이 브랜치에서 매니페스트/락파일 변경이 전혀 없음(diff 0). 이 PR 이 쓰는 `gray-matter`, `mdast-util-from-markdown`, `mdast-util-to-string`, `github-slugger`, `@types/mdast` 는 전부 `codebase/frontend/package.json` 에 이미 등재돼 있던 기존 의존성이며(`gray-matter@^4.0.3`, `github-slugger@^2.0.0`, `mdast-util-from-markdown@^2.0.3`, `mdast-util-to-string@^4.0.0`, `@types/mdast@^4.0.4`), 이번 diff 는 그것을 새 파일(`plan-scan.ts`)과 기존 파일(`spec-links.ts`)에서 재사용·재배치했을 뿐이다. 버전 고정·라이선스·취약점·번들 크기 항목은 이 diff 로 인한 새 표면이 없다.
  - 제안: 없음(정상).

- **[INFO]** 내부 모듈 의존 방향 재편 — 단방향, 순환 없음
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-links.ts:17` (`import { collectLivePlanMarkdown } from "./plan-scan";`), 재-export 지점: `codebase/frontend/src/lib/docs/__tests__/spec-links.ts:271` (`export { collectLivePlanMarkdown };`)
  - 상세: `spec-links.ts` 가 신설 `plan-scan.ts` 의 `collectLivePlanMarkdown` 을 가져와 쓰고 하위호환을 위해 재-export 한다. `plan-scan.ts` 쪽은 `fs`/`path`/`gray-matter` 외에 `spec-links.ts` 를 import 하지 않으므로 순환 의존은 없다(단방향: `spec-links.ts` → `plan-scan.ts`). `plan-frontmatter.test.ts` 는 두 모듈 모두에서 직접 import 하며(`plan-scan.ts` 의 `checkPlanFrontmatter`/`collectCompletePlanMarkdown`/`collectLivePlanMarkdown`/`findNonTerminalCompletedPlans`, `spec-links.ts` 의 `extractLinks`/`findBrokenPlanLinks`), 이는 이전에 각 파일이 손으로 재구현하던 plan 트리 순회 로직(파일 주석이 스스로 지적한 "네 벌의 walker 불일치" 문제)을 `plan-scan.ts` 단일 구현으로 합친 정당한 리팩터다. 의존성 관점에서는 개선(중복 내부 구현 제거)이지 위험 요소가 아니다.
  - 제안: 없음. 다만 파일 상단 주석이 스스로 명시하듯 `spec-plan-completion.test.ts` 의 `collectCompletePlans` 는 아직 별도 구현으로 남아 있다 — 후속 통합(`plan/in-progress/docs-guard-walker-dedup.md`)이 이 리뷰의 범위 밖임을 확인.

- **[INFO]** 프로덕션 번들 영향 없음
  - 위치: `codebase/frontend/tsconfig.json:40` (`"exclude": [..., "src/**/__tests__/**"]`)
  - 상세: 리뷰 대상 4개 파일 전부 `src/lib/docs/__tests__/` 아래에 있고, `tsconfig.json` 의 exclude 패턴이 이 디렉터리를 프로덕션 컴파일 대상에서 제외한다. 따라서 이번 diff 가 재배치·재사용하는 `gray-matter`/`mdast-util-*`/`github-slugger` 호출은 클라이언트 번들 크기·빌드 산출물에 영향을 주지 않는다(빌드 시간에는 미미하게 영향 있을 수 있으나 vitest 실행 범위일 뿐).
  - 제안: 없음(정상).

## 요약

이번 diff(`plan-scan.ts` 신설, `plan-scan.test.ts` 신설, `plan-frontmatter.test.ts`/`spec-links.ts` 리팩터)는 순수하게 `codebase/frontend/src/lib/docs/__tests__/` 내부의 plan 라이프사이클 가드 로직을 재조직한 것으로, `package.json`/lockfile diff 가 0줄임을 직접 확인했다 — 새 외부 의존성 추가·버전 변경이 전혀 없다. 사용된 패키지(`gray-matter`, `mdast-util-from-markdown`, `mdast-util-to-string`, `github-slugger`, `@types/mdast`)는 모두 기존 등재 의존성을 재사용한 것이고, 신설 `plan-scan.ts` → 기존 `spec-links.ts` 방향의 새 내부 모듈 의존이 생겼지만 단방향이며 순환·중복 초래가 아니라 오히려 기존에 흩어져 있던 plan-tree walker 구현을 하나로 합치는 개선이다. 해당 파일들은 tsconfig exclude 대상(`__tests__/**`)이라 프로덕션 번들에도 영향이 없다. 의존성 관점에서 문제 될 항목이 없다.

## 위험도

NONE
