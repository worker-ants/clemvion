# 의존성(Dependency) 리뷰

## 발견사항

- **[INFO]** 새 외부 의존성 없음 — 순수 내부 리팩터
  - 위치: `codebase/frontend/package.json` (변경 없음, `git diff origin/main` 로 확인)
  - 상세: 이번 변경셋은 `package.json`/lockfile 을 전혀 건드리지 않는다. `plan-scan.ts`/`spec-links.ts` 가 쓰는 `gray-matter`(`^4.0.3`)·`mdast-util-from-markdown`(`^2.0.3`)·`mdast-util-to-string`(`^4.0.0`)·`github-slugger`(`^2.0.0`) 는 모두 기존에 이미 선언돼 있던 caret-range 고정 의존성이고, 이번 diff 는 그 import 를 새 대상 파일(`plan-scan.ts`)로 옮기거나 재사용(`spec-links.ts` 가 `collectLivePlanMarkdown` 을 `plan-scan.ts` 에서 import)한 것뿐이다. 새 패키지 추가·버전 변경·라이선스 변경은 없다.
  - 제안: 조치 불필요.

- **[INFO]** 내부 의존 관계 변경 — `spec-links.ts` → `plan-scan.ts` 신규 단방향 의존
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-links.ts:17` (`import { collectLivePlanMarkdown } from "./plan-scan";`)
  - 상세: plan 트리를 손으로 순회하던 walker 를 `plan-scan.ts` 한 곳(`walkPlanMarkdown`)으로 파생시키고, `spec-links.ts` 는 그 결과를 재-export(`spec-links.ts:271`, `export { collectLivePlanMarkdown };`)해 하위 호환을 유지한다. 순환 의존은 없고(단방향: `spec-links.ts` → `plan-scan.ts`), 두 모듈이 각자 파일 목록을 순회하던 것을 하나의 정본(SoT)으로 좁혀 "네 벌의 walker" 문제를 둘로 줄였다는 점에서 내부 의존 구조는 개선 방향이다.
  - 제안: 조치 불필요 — 현재 형태 유지.

- **[INFO]** 남은 중복 내부 구현 — `spec-plan-completion.test.ts` 의 `collectCompletePlans` 는 아직 `plan-scan.ts` 의 `collectCompletePlanMarkdown` 과 독립
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-plan-completion.test.ts` 의 `collectCompletePlans` 함수(59번째 줄 부근, `function collectCompletePlans(root: string): string[] {`)
  - 상세: 이 함수는 `plan-scan.ts:94` 의 `collectCompletePlanMarkdown`(같은 `plan/complete/**` 재귀 수집, 같은 `archive/`·`0-`/`_` 접두 제외 규칙)과 로직이 사실상 동일한 독립 구현이다. 두 구현이 같은 규칙을 각자 유지하므로 한쪽만 바뀌면 조용히 갈릴 위험(drift)이 있다. 다만 이는 이미 `plan-scan.ts` 헤더 주석(1~26줄)과 `plan/in-progress/docs-guard-walker-dedup.md` 에 명시적으로 등재·추적되고 있는 기지(既知) 기술부채이며, 이번 PR 범위 밖으로 의도적으로 분리한 결정이다 — 새로 발견된 문제가 아니다.
  - 제안: 별도 조치 불요. `docs-guard-walker-dedup.md` 진행 시 함께 통합.

- **[INFO]** 번들/빌드 영향 없음
  - 위치: `codebase/frontend/tsconfig.json:40` (`"src/**/__tests__/**"` exclude)
  - 상세: 변경된 4개 TS 파일 모두 `__tests__/` 하위이며 production TS build(및 Next.js 번들)에서 제외된다. vitest 실행 시간에 약간의 fixture I/O(임시 디렉터리 mkdtemp/rm) 가 추가되지만 외부 패키지 추가가 없으므로 devDependencies 설치·CI 빌드 시간에 미치는 영향은 없다.
  - 제안: 조치 불필요.

## 요약

이번 변경셋은 `plan/` 트리 라이프사이클 검사 로직을 `plan-scan.ts` 로 추출하고 negative-path fixture 테스트를 추가한 순수 내부 리팩터로, 신규 외부 패키지·버전 변경·lockfile 변경이 전혀 없다(`git diff origin/main` 로 확인, `package.json` 미포함). 사용된 파서 라이브러리(`gray-matter`, `mdast-util-from-markdown/to-string`, `github-slugger`)는 모두 기존에 pinned 되어 있던 것을 재사용/재배치한 것뿐이라 라이선스·취약점·호환성 리스크의 표면 변화가 없다. 내부 의존 관계는 `spec-links.ts → plan-scan.ts` 단방향 참조가 신설되어 walker 중복을 4벌→2벌로 줄이는 개선 방향이며, 남은 한 벌의 중복(`spec-plan-completion.test.ts` 의 `collectCompletePlans`)은 이미 별도 plan(`docs-guard-walker-dedup.md`)으로 추적 중이라 이번 PR 의 결함으로 볼 수 없다. 모든 변경 파일이 `__tests__/` exclude 범위라 production 번들·빌드 시간에도 영향이 없다.

## 위험도
NONE
