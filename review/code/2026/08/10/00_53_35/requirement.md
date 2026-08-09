# Requirement Review — plan-scan.ts / plan-scan.test.ts

## 검증 방법
- 두 파일 전체 Read, 관련 spec(`.claude/docs/plan-lifecycle.md §4`, 이 harness-내부 라이프사이클
  규칙의 SoT — `spec/` 폴더는 제품 스펙이라 대상 아님) 대조.
- `pnpm --dir codebase/frontend exec vitest run src/lib/docs/__tests__/plan-scan.test.ts` → **13/13 PASS**.
- `plan-frontmatter.test.ts`(실제 guard, `plan-scan.ts` 를 소비) → **149/149 PASS** (real repo 데이터, vacuous 아님 — `plans.length > 5` 하한 확인).
- 독자 뮤테이션: `findNonTerminalCompletedPlans` 의 `if (typeof status !== "string") continue;` 줄을
  제거 → `plan-scan.test.ts` 4개 테스트 즉시 RED(`status-empty.md`/`status-num.md`/`status-list.md`/
  `no-status.md`/`broken.md` 가 오검출로 새로 잡힘). 직전 라운드(WARNING W1: 이 분기가 어떤
  fixture 로도 실행되지 않음)가 이번 커밋(`d1b622084`)에서 **실제로 해소**됐음을 독립 재검증.
  검증 후 파일 복원, `git diff` clean 확인.
- `status: no`/`status: true`/`status: yes`/`status: off` 를 gray-matter(js-yaml)로 직접 파싱해
  주석의 "YAML 1.1 불리언 제거로 `no` 는 문자열" 주장을 실측 확인(`no`→`"no"` 문자열,
  `true`→boolean 유지).
- `#1108`/`#1117` PR 참조(주석)를 `git log`로 대조 — `#1117`(`docs(plan): 완료 plan 의 stale
  필드 2건 정정 — status 미갱신`)이 실제로 이 서사와 일치함을 확인.

## 발견사항

- **[INFO]** 빈 문자열 `status: ""` 케이스가 fixture 로 커버되지 않음 (직전 라운드 INFO#2 와 동일,
  이번 diff 에서도 그대로).
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-scan.ts:122`(`if (!TERMINAL_STATUSES.has(status))`),
    대응 테스트 부재는 `codebase/frontend/src/lib/docs/__tests__/plan-scan.test.ts`.
  - 상세: `status: ""` 는 `typeof === "string"` 을 통과하므로 `TERMINAL_STATUSES.has("")` 가
    `false` → 위반으로 정확히 잡힌다(안전한 방향 = 과대검출이지 과소검출이 아님). 로직 자체는
    맞으나, 이 경로를 직접 exercise 하는 fixture 가 없어 회귀 시 무관측일 수 있다.
  - 제안: 급하지 않음. 여유가 있으면 `plan/complete/status-blank.md` (`status: ""`) fixture 를
    추가해 `found`에 포함됨을 단언.
- **[INFO]** `"returns nothing on a tree with no plan/ directory"` 테스트가 `findNonTerminalCompletedPlans`/
  `collectLivePlanMarkdown` 만 단언하고 `collectCompletePlanMarkdown` 은 직접 단언하지 않음.
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-scan.test.ts:173-181`.
  - 상세: `collectCompletePlanMarkdown` 은 같은 `walkPlanMarkdown` 을 `bucket: "complete"` 로만
    다르게 부르므로 위험은 사실상 0 이지만, "빈 트리 → `[]`" 계약이 세 진입점 모두에 대해
    명시적으로 고정돼 있진 않다.
  - 제안: 급하지 않음. `expect(collectCompletePlanMarkdown(empty)).toEqual([])` 한 줄 추가로 완결.
- **[INFO]** 관련 spec 문서(`.claude/docs/plan-lifecycle.md §4`)와 line-level 일치 확인됨 —
  `TERMINAL_STATUSES = {complete, implemented, applied, superseded}` 이 spec 본문(줄 80-83:
  "종료 상태뿐이다 — `complete` · `implemented` · `applied` · `superseded`")과 정확히 일치,
  `status` 가 "선택 필드"라는 서술(spec 줄 106-107)과 `findNonTerminalCompletedPlans` 의 doc
  comment·구현(줄 108-110, 122)이 일치, top-level(`in-progress`) vs 재귀(`complete/**`) 스코프
  분리(spec 줄 33-34)도 `collectLivePlanMarkdown`(recurse:false) / `collectCompletePlanMarkdown`
  (recurse:true) 로 정확히 반영됨. SPEC-DRIFT 없음, 코드가 spec 을 위반하는 지점 없음.

## 요약
`plan-scan.ts`/`plan-scan.test.ts` 는 4벌로 흩어져 있던 plan-tree walker 를 단일 구현으로
수렴시키고, 직전 라운드가 실측으로 지적한 "위반 검사가 158 테스트 내내 한 번도 실행되지
않았다"는 vacuous-pass 결함과 그 후속 라운드가 지적한 마지막 무관측 분기(non-string
`status` skip)를 모두 fixture + 뮤테이션으로 실제 관측 가능하게 만들었다. 직접 재실행한
테스트(13/13, 149/149)와 독립 뮤테이션(비교 분기 제거 시 4개 테스트 RED)으로 재검증했고,
`.claude/docs/plan-lifecycle.md §4`(이 harness 코드의 SoT)와 종료 어휘·선택 필드·스코프
분리 세 축 모두 line-level 로 일치한다. 남은 것은 실질 위험이 없는 테스트 커버리지 갭
2건(빈 문자열 status, `collectCompletePlanMarkdown` 의 빈 트리 케이스 직접 단언 부재)뿐이며
둘 다 급하지 않다. TODO/FIXME/HACK/XXX 없음, 모든 함수가 모든 경로에서 타입에 맞는 값을
반환한다.

## 위험도
LOW
