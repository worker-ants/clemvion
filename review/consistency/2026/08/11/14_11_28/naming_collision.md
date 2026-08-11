# 신규 식별자 충돌 검토

대상: `spec/conventions` (impl-done, diff-base `origin/main`) — 신규 파일 `tree-walk.ts`/`tree-walk.test.ts`,
타입 `MdFileRef`/`WalkOptions`, 함수 `walkTree`/`matterNoCache`, 개명 `danglingSpecImpact`→`findDanglingSpecImpact`,
삭제 `SpecMdFile`.

검증은 HEAD 워킹트리(`/Volumes/project/private/clemvion/.claude/worktrees/docs-guard-walker`)를 절대경로로
`git grep` 하여 실측했다(diff-base `origin/main` 이 아니라 병합 후 상태).

## 발견사항

### 1. `walkTree` — 충돌 없음

- target 신규 식별자: 함수 `walkTree` (`codebase/frontend/src/lib/docs/__tests__/tree-walk.ts:67`)
- 기존 사용처: 없음
- 상세: 저장소 전체에서 `walkTree` 는 `tree-walk.ts` 정의 + 5개 호출부(`impl-anchor-parse.ts`, `plan-scan.ts`, `spec-frontmatter-parse.ts`, `spec-links.ts` 2곳)만 존재. `codebase/frontend/src` 의 프로덕션 코드(워크플로우 에디터의 노드 트리 순회 등)에는 동명 함수가 없다(`function walk` 검색 0건). `plan/complete/docs-guard-walker-dedup.md`(이 통합 작업 자체의 완료 plan)와 `plan/in-progress/harness-env-value-subpattern-dedup.md` 의 언급은 이 신규 식별자를 가리키는 서술이라 충돌이 아니다.
- 제안: 없음(충돌 없음)

### 2. `MdFileRef` / `WalkOptions` — 충돌 없음, 단 `PlanMdFile` 별칭과 공존 (INFO)

- target 신규 식별자: `MdFileRef`, `WalkOptions` (`tree-walk.ts:36`, `:41`)
- 기존 사용처: 없음(신규). 단 `plan-scan.ts:40` 에서 `export type PlanMdFile = MdFileRef;` 로 **별칭**을 이미 두고 있다.
- 상세: `MdFileRef` 자체는 저장소 어디에도 이전에 없던 이름이라 진짜 충돌은 없다. 다만 질문 4번이 지목한 대로 `MdFileRef`(도메인 중립)와 `PlanMdFile`(plan 도메인 별칭)이 나란히 export 되어, 신규 기여자가 plan 관련 함수를 짤 때 어느 이름을 import 해야 하는지 순간적으로 헷갈릴 수 있다. 그러나 이는 (a) 구조가 100% 동일한 `type X = Y` 단순 별칭이라 컴파일러가 즉시 오류를 내는 "다른 의미의 동일 식별자" 충돌이 아니고, (b) diff 자체 주석("이름만 도메인에 붙였다")과 `spec-links.ts:149`(`SpecMdFile` 삭제 사유 설명 중 "`plan-scan.ts` 는 이미 `PlanMdFile` 을 따로 두어 이 혼동에서 빠져 있었다")이 의도를 명시하며, (c) 과거 다수 라운드(`review/code/2026/08/10/00_39_31/maintainability.md`, `review/consistency/2026/08/10/01_09_04/naming_collision.md` 등)에서 이미 이 지점을 "Plan/Spec 접두가 명확히 구분돼 있어 명명 자체는 문제없고 실제 충돌 아님"으로 검토·수렴시킨 이력이 있다.
- 제안: 현행 유지로 충분(이미 여러 차례 검토·수용된 설계). 향후 세 번째 도메인 별칭(예: `MdxFileRef`)이 필요해지면 그때 `tree-walk.ts` 헤더에 "도메인 별칭 목록" 절을 추가해 한곳에서 훑어볼 수 있게 하는 정도가 부담 없는 개선이다.

### 3. `matterNoCache` — 충돌 없음

- target 신규 식별자: 함수 `matterNoCache` (`plan-scan.ts:131`)
- 기존 사용처: 없음
- 상세: 정의 1곳 + `spec-frontmatter-parse.ts` 의 import·호출 1곳뿐. gray-matter 패키지 자체 API(`matter`)와 이름이 겹치지 않고, 프로젝트 내 다른 모듈에 동명 함수 없음.
- 제안: 없음

### 4. `findDanglingSpecImpact` (구 `danglingSpecImpact`) — 옛 이름 잔존 참조 없음

- target 신규 식별자: `findDanglingSpecImpact` (`plan-scan.ts:414`, export 이동+개명)
- 기존 사용처: 옛 이름 `danglingSpecImpact` 는 살아있는 코드(`codebase/**`)·spec(`spec/**`)·`.claude/**`·`plan/in-progress/**` 어디에도 남아있지 않음(전수 `git grep` 확인, 0건).
- 상세: 옛 이름이 등장하는 곳은 전부 예외 대상뿐이다 — `plan/complete/docs-guard-walker-dedup.md`(완료 plan, 시점 기록) 와 `review/code/**`·`review/consistency/**` 하위 다수 타임스탬프 디렉터리(2026-08-10~11, 리뷰 이력). 코드 쪽은 `spec-plan-completion.test.ts` 가 새 이름으로 import 하도록 전부 갱신돼 있고(`findDanglingSpecImpact` 5회 호출), 옛 이름을 참조하는 살아있는 import/호출부는 없다.
- 제안: 없음(개명 완료, 잔존 없음)

### 5. `SpecMdFile` 삭제 — 잔존 참조 0건 (실제 타입 참조 기준)

- target 신규 식별자: (삭제) `SpecMdFile`
- 기존 사용처: 삭제 전 `spec-links.ts` 의 `export interface SpecMdFile`
- 상세: `git grep -n "SpecMdFile" -- codebase` 결과 3건 전부 **주석 안 텍스트 언급**(삭제 사실을 설명하는 산문)이며 실제 `interface`/타입 참조는 0건:
  - `plan-scan.ts:37` — "`spec-links.ts` 가 spec 도 codebase 도 한 타입(`SpecMdFile`)으로 받아 혼동을 낳았던"
  - `spec-links.ts:144` — "종전 `SpecMdFile` 은 **지웠다**."
  - `tree-walk.ts:33` — "(종전 이름은 `SpecMdFile` 이었는데 …)"

  spec(`spec/**`) 에는 애초에 `SpecMdFile` 언급이 없다. `plan/complete/docs-guard-walker-dedup.md`(완료 plan)와 `review/**` 하위 다수 문서(2026-06-04~2026-08-11, 이 이름의 등장·삭제 논의 이력 전체)에 남은 참조는 시점 기록·리뷰 이력이라 프롬프트가 명시한 예외에 해당한다.
- 제안: 없음(삭제 완료, 코드·spec 상 잔존 참조 0건)

### 6. 파일 경로 — 컨벤션 정합

- target 신규 식별자: `codebase/frontend/src/lib/docs/__tests__/tree-walk.ts`, `tree-walk.test.ts`
- 기존 사용처: 동일 경로에 기존 파일 없음(신규 생성, 경로 충돌 없음)
- 상세: 같은 디렉터리의 자매 파일(`plan-scan.ts`+`plan-scan.test.ts`, `spec-links.ts`+`spec-links.test.ts`, `spec-frontmatter-parse.ts`+`spec-frontmatter-parse.test.ts`, `impl-anchor-parse.ts`+`impl-anchor-parse.test.ts`)과 동일하게 kebab-case 기능명 `.ts` + 짝 `.test.ts` 패턴을 따른다. 명명 컨벤션 위반 없음.
- 제안: 없음

### 7. 요구사항 ID / API endpoint / 이벤트명 / 환경변수 — 해당 없음

- 이번 diff 는 테스트 인프라 모듈(`codebase/frontend/src/lib/docs/__tests__/`) 내부 리팩터/개명이며, 새 spec `id:`, API endpoint, webhook/queue/sse 이벤트명, 환경변수·설정키를 도입하지 않는다. 이 세 관점은 target 범위 밖.

## 요약

이번 target 은 문서 가드 walker 6벌을 `tree-walk.ts` 의 `walkTree`/`MdFileRef`/`WalkOptions` 로 통합하고, gray-matter 캐시 우회를 `matterNoCache` 로 단일화하며, `danglingSpecImpact`→`findDanglingSpecImpact` 개명과 `SpecMdFile` 삭제를 수행한다. `walkTree`·`MdFileRef`·`WalkOptions`·`matterNoCache` 는 저장소 전체에서 이 신규 정의가 유일한 사용처이고, `findDanglingSpecImpact` 개명 후 옛 이름의 살아있는 참조는 코드·spec·.claude 어디에도 없으며(예외 대상인 `plan/complete/**`·`review/**` 시점 기록만 남음), `SpecMdFile` 은 삭제 후 실제 타입 참조가 0건이고 잔존하는 3건은 모두 삭제 사실을 설명하는 주석 텍스트다. 유일하게 짚을 지점은 `MdFileRef` 와 기존 `PlanMdFile`(단순 타입 별칭)의 공존인데, 이는 실질 충돌이 아니라 이미 여러 라운드 리뷰에서 의도된 설계로 수렴된 사항이라 INFO 이상으로 올릴 근거가 없다. Critical 은 없다.

## 위험도

NONE
