# 아키텍처(Architecture) 리뷰

## 발견사항

- **[INFO]** 디렉터리 워커(walker) 패턴이 이번 PR 이후에도 세 벌 남아 있다 (plan 트리 워커는 둘로 줄었지만, spec/codebase 소스 워커까지 포함하면 여전히 병렬 구현)
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-scan.ts:53` (`walkPlanMarkdown`), `codebase/frontend/src/lib/docs/__tests__/spec-links.ts:132` (`collectSpecMarkdown`), `codebase/frontend/src/lib/docs/__tests__/spec-links.ts:335` (`collectCodebaseSources`)
  - 상세: 이 PR 의 핵심 동기는 "plan/ 트리를 손으로 순회하는 walker 가 네 벌 있어 `0-`/`_` 접두 처리가 조용히 어긋난다" 는 문제였고, `plan-scan.ts` 는 그중 둘(`collectLivePlanMarkdown`/`collectCompletePlanMarkdown`)을 `walkPlanMarkdown` 하나로 합쳤다(Gate C 의 `collectCompletePlans` 는 별도 추적 문서로 명시적으로 이연). 다만 `spec-links.ts` 안에는 스택 기반 재귀 순회 로직이 목적만 다를 뿐(스킵 디렉터리 집합·확장자 필터·recurse 여부) 구조적으로 거의 동일한 형태로 두 곳 더 있다(`collectSpecMarkdown`, `collectCodebaseSources`). 이들은 plan 트리 워커가 아니므로 이번 PR 이 고치려던 버그 클래스와 직접 같지는 않지만, "같은 순회 로직의 병렬 구현" 이라는 동일한 구조적 리스크를 안고 있다.
  - 제안: 시급하지 않지만, `walkDir(root, { skipDirs?, fileFilter, recurse })` 형태의 공용 유틸로 네 벌(plan 2 + spec/codebase 소스 2)을 최종적으로 하나로 수렴시키는 편이 "네 벌이 조용히 어긋난다" 는 이 PR 의 문제의식과 일관된다. 이미 추적 중인 `plan/in-progress/docs-guard-walker-dedup.md` 범위에 이 둘도 포함할지 검토 권장.

- **[INFO]** `collectLivePlanMarkdown` 이 두 모듈에서 동시에 export 되어 정본(source of truth) import 경로가 이원화됨
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-scan.ts:83` (정의), `codebase/frontend/src/lib/docs/__tests__/spec-links.ts:17` (재-import), `codebase/frontend/src/lib/docs/__tests__/spec-links.ts:1071` (재-export)
  - 상세: `spec-links.ts` 가 자신의 `findBrokenPlanLinks`(`spec-links.ts:1106`)에서 쓰기 위해 `plan-scan.ts` 의 `collectLivePlanMarkdown` 을 import 하고, 하위호환을 위해 그대로 재-export 한다(주석에 의도 명시). 실제 이번 PR 의 주 호출부(`plan-frontmatter.test.ts:9`)는 이미 `plan-scan.ts` 에서 직접 import 해 정본 경로를 쓰고 있어 당장의 혼선은 없지만, 향후 신규 호출부가 `spec-links.ts` 경로를 골라 쓰면 "어느 모듈이 plan 트리 순회의 정본인가" 가 다시 흐려질 수 있다.
  - 제안: 재-export 지점에 `@deprecated — import from ./plan-scan instead` 같은 JSDoc 을 달아, 신규 호출부가 무심코 이 경로를 고정시키지 않도록 명시.

- **[INFO]** 같은 파일 안에서 "판정 함수" 의 I/O·순수 로직 분리 수준이 비대칭적
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-scan.ts:205` (`checkPlanFrontmatter`, 문자열 입력을 받는 순수 함수) vs `codebase/frontend/src/lib/docs/__tests__/plan-scan.ts:119` (`findNonTerminalCompletedPlans`, 파일 읽기+판정이 한 함수에 결합)
  - 상세: `checkPlanFrontmatter` 는 "문자열 입력이라 fixture 가 파일시스템 없이 각 분기를 직접 겨눌 수 있다" 는 이유로 I/O 를 분리했다(파일 docstring 에 명시). 반면 `findNonTerminalCompletedPlans` 는 파일 읽기·gray-matter 파싱·상태 판정이 한 함수에 결합돼 있어, 같은 파일 안에서 두 검증기의 추상화 수준이 다르다. 기능상 문제는 없다(`plan-scan.test.ts` 가 실제 임시 디렉터리로 검증) — 다만 이 비대칭이 앞으로 검증기를 추가하는 사람에게 "어느 패턴이 표준인가" 를 헷갈리게 할 수 있다.
  - 제안: 급하지 않음. 향후 검증기 추가 시 `checkPlanFrontmatter` 처럼 순수 판정부를 분리하는 패턴을 기본값으로 삼는 것을 고려.

## 요약

이번 변경은 `plan/` 트리를 순회·검증하던 로직을 `plan-scan.ts` 라는 단일 모듈로 추출하고, 링크 무결성 검사(`spec-links.ts`)는 `LinkScanOptions` 로 파라미터화된 공용 스캔 엔진(`findBrokenLinksInFiles`)을 spec/plan/codebase-source 세 타깃에 재사용하는 형태로 잘 정리되어 있다. 모듈 의존 방향은 `spec-links.ts → plan-scan.ts` 단방향이며 순환 참조는 없고, 테스트 파일(`plan-frontmatter.test.ts`)은 판정 로직을 갖지 않고 오직 호출부·조립부 역할만 하도록 레이어가 분리되어 있다(주석에도 "판정 로직은 전부 밖에 있다" 로 명시). `TERMINAL_PLAN_STATUSES`/`WORKTREE_PLACEHOLDER` 를 코드 수정 없이는 못 늘리게 막아 어휘 확장에 의도적 마찰을 두는 결정도 governance 관점에서 타당하다. 발견된 사항은 모두 이번 PR 이 직접 만든 새 결함이 아니라, 이 PR 이 절반만 해결한(그리고 스스로 그렇게 인정하고 추적 중인) 구조적 중복의 잔여 표면과, 향후 확장 시 참고할 만한 비대칭 패턴 정도이며 모두 INFO 수준이다.

## 위험도

LOW
