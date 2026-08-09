# Maintainability Review

대상: `plan-scan.ts`/`plan-scan.test.ts`/`spec-links.ts`/`spec-plan-completion.test.ts`/`.claude/docs/plan-lifecycle.md`

## 발견사항

- **[WARNING]** 디렉터리 트리 순회(stack 기반 DFS) 로직이 같은 파일 안에서 두 번 거의 동일하게 반복된다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-links.ts:131-152` (`collectSpecMarkdown`) 와 `codebase/frontend/src/lib/docs/__tests__/spec-links.ts:319-343` (`collectCodebaseSources`)
  - 상세: 두 함수 모두 `const stack: string[] = [...]; while (stack.length > 0) { const cur = stack.pop()!; for (const entry of fs.readdirSync(cur, { withFileTypes: true })) { ... if (entry.isDirectory()) { stack.push(full) } else if (entry.isFile() && <확장자 검사>) { out.push(...) } } } out.sort(...)` 골격이 동일하다. 차이는 디렉터리 스킵 조건(`archive`/`node_modules` 등)과 파일 확장자 필터뿐이다. `plan-scan.ts:59-86` 의 `walkPlanMarkdown`, `spec-plan-completion.test.ts:59-83` 의 `collectCompletePlans` 까지 포함하면 사실상 동형의 워커가 저장소 전역에 4벌 존재하는 셈이고(그중 plan 계열 둘은 `plan-scan.ts` 헤더 주석이 이미 인지·추적 중), `spec-links.ts` 내부의 이 둘은 아직 어떤 곳에도 추적되지 않았다.
  - 제안: `spec-links.ts` 안에서만이라도 `walkTree(root: string, { skipDir, fileFilter }): SpecMdFile[]` 같은 공유 헬퍼로 추출해 `collectSpecMarkdown`/`collectCodebaseSources` 가 그 위에서 필터만 다르게 넘기도록 하면 이후 워커 통합(`docs-guard-walker-dedup.md`) 범위에도 자연히 편입된다.

- **[INFO]** 파일 위치를 표현하는 값 타입이 두 모듈에서 구조적으로 동일하게 중복 선언됨
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-scan.ts:31-34` (`PlanMdFile`) 와 `codebase/frontend/src/lib/docs/__tests__/spec-links.ts:119-122` (`SpecMdFile`)
  - 상세: 둘 다 `{ absPath: string; relPath: string; }` 로 필드까지 완전히 동일하다. `spec-links.ts` 는 이미 `plan-scan.ts` 에서 `collectLivePlanMarkdown` 을 import 해 쓰고 있으므로(`spec-links.ts:17`) 타입도 같은 자리에서 공유하는 편이 자연스럽다.
  - 제안: 한쪽(예: `plan-scan.ts`)에서 `export interface MdFile { absPath: string; relPath: string; }` 로 이름을 일반화해 export 하고, `spec-links.ts` 는 `SpecMdFile` alias 대신 재사용. 급하지 않음 — 필드가 갈라지는 순간 갈라도 늦지 않다.

- **[INFO]** `plan/complete/**` 의 각 enforced plan 에 대해 frontmatter 를 두 번 읽고 두 번 파싱한다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-plan-completion.test.ts:90-102` (`enforced` 필터 안에서 1차 파싱) 과 `:118` (per-plan `describe` 블록 안에서 2차 파싱)
  - 상세: `enforced` 를 구하기 위해 모든 완료 plan 을 `matter()` 로 한 번 파싱하고, 그중 enforced 로 걸러진 plan 마다 `describe(rel, ...)` 블록 안에서 같은 파일을 다시 `readFileSync` + `matter()` 한다. 테스트 스위트 규모라 성능 영향은 미미하지만, 2차 호출에는 1차와 달리 `try/catch` 가 없다 — 이게 안전한 이유는 "gray-matter 캐시가 파싱 성공한 내용에 대해서는 재호출 시에도 같은 결과를 준다"는, 1차 호출 옆 주석(`:93-96`)에만 적힌 불변식에 암묵적으로 기대고 있다. 이 불변식이 코드로 보이지 않아 다음 사람이 2차 호출에 `try/catch` 를 왜 안 넣었는지 추적하려면 주석을 거슬러 올라가야 한다.
  - 제안: `readFrontmatterData(abs): Record<string, unknown> | null` 같은 작은 헬퍼로 파싱 1회를 추출해 `enforced` 필터와 per-plan `describe` 양쪽에서 재사용하면 이중 파싱도, 암묵적 불변식도 함께 없어진다.

- **[INFO]** `collectCompletePlans`(`spec-plan-completion.test.ts:59-83`)가 `plan-scan.ts` 의 `walkPlanMarkdown`/`isLifecyclePlan` 과 사실상 동일한 순회·제외 규칙(`archive/` 제외, `0-`/`_` 접두 제외)을 독립 재구현하고 있다. 다만 이는 새로 발견한 문제가 아니라 `plan-scan.ts:18-22` 헤더 주석이 이미 명시적으로 인지하고 `plan/in-progress/docs-guard-walker-dedup.md` 로 추적 중인 의도된 임시 상태다 — 재지적하지 않되, 리뷰 기록상 확인 차 남긴다.

- **[INFO]** `isLifecyclePlan`(`plan-scan.ts:36-53`)처럼 2줄짜리 함수에 14줄짜리 근거 주석이 붙는 등, 코드 대비 주석 비율이 매우 높은 자리가 여러 곳(`checkPlanFrontmatter`, `isIsoDate`, `WORKTREE_PLACEHOLDER` 등)이다. 다만 이 저장소의 확립된 컨벤션(실측·뮤테이션 결과를 근거로 남기는 문서화 스타일)과 일치하고, 각 주석이 실제로 회귀를 두 번 겪은 함정(YAML 날짜 롤링, gray-matter 캐시, 인덱스 파일 스코프)을 설명하는 하중이 있는 내용이라 문제로 보지 않는다. 함수가 더 커지면 주석과 로직을 분리(별도 rationale 섹션 링크 등)하는 것도 고려할 수 있다는 정도의 참고.

- **[INFO]** `checkPlanFrontmatter`(`plan-scan.ts:228-280`)는 파싱 1개 + 필드 검사 3개(worktree/started/owner)를 한 함수에서 순차 처리한다. 현재는 각 블록이 3~10줄로 짧고 선형이라 가독성 문제는 없지만, 향후 필드가 늘어나면(예: `spec_impact` 류) 함수가 계속 길어질 잠재적 지점이다. `checkWorktree`/`checkStarted`/`checkOwner` 같은 작은 private 헬퍼로 나눌 여지가 있다는 참고 수준.

## 요약

전반적으로 코드 품질이 높다 — 함수는 대체로 짧고 단일 책임에 가깝고, 매직 넘버·문자열은 이름 있는 상수(`TERMINAL_PLAN_STATUSES`, `WORKTREE_SENTINEL`, `GATE_C_CUTOFF`, `NONE_VALUES`)로 이미 잘 추출돼 있으며, 정규식·날짜 파싱처럼 함정이 많은 로직에는 실측 근거를 남긴 상세한 주석이 붙어 있어 향후 유지보수자가 "왜 이렇게 짰는가"를 다시 조사할 필요가 적다. 가장 실질적인 개선 여지는 디렉터리 트리 순회 로직의 중복이다 — `spec-links.ts` 내부의 `collectSpecMarkdown`/`collectCodebaseSources` 는 아직 어디에도 추적되지 않은 신규(미문서화) 중복이라 다른 세 곳(plan 계열, 이미 추적됨)과 달리 지금 정리하는 편이 싸다. 나머지는 타입 중복·이중 파싱·주석 밀도 등 낮은 우선순위의 다듬기 항목이며 기능·정합성에 영향을 주지 않는다.

## 위험도

LOW
