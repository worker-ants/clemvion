# 요구사항(Requirement) 리뷰

## 검토 방법
- 3개 대상 파일(`spec-plan-completion.test.ts`, `plan-scan.ts`, `plan-scan.test.ts`) 전문을 읽고
  spec SoT 두 문서(`spec/conventions/spec-impl-evidence.md`, `.claude/docs/plan-lifecycle.md`)와
  line-level 대조.
- `pnpm vitest run` 으로 대상 3파일 + 호출부(`plan-frontmatter.test.ts`) 실제 실행 — **989/989 통과**.
- `isIsoDate`/`hasMalformedStarted` 가 근거로 삼는 JS `Date` 롤오버 동작(`2026-13-32`→NaN,
  `2026-02-30`→3/2 등)을 node 로 직접 재현해 주석의 "실측" 주장 검증 — 일치.
- `git diff origin/main` 으로 실제 변경분(3파일 모두 origin/main 대비 재작성/신규)과 `PROJECT.md`·
  `spec/conventions/spec-impl-evidence.md` 동반 갱신 여부 확인.

## 발견사항

- **[INFO]** `spec-plan-completion.test.ts` 의 "every completed plan has parseable frontmatter"
  검사(cutoff 이전 grandfathered plan 포함, **전체** `plan/complete/**` 대상)는
  `spec/conventions/spec-impl-evidence.md §4.2` 의 Gate C 행에 별도로 명시돼 있지 않다(그 행은
  `spec_impact` 선언 의무만 서술). 다만 이 동작은 코드 자체 JSDoc(`plan-scan.ts:155-158`,
  `spec-plan-completion.test.ts:175-183`)이 "Gate C 뿐 아니라 `findNonTerminalCompletedPlans`
  status 검사도 파싱 실패를 조용히 건너뛰므로 이 캐너리가 그 공백을 메운다"고 명확히 교차
  근거를 밝히고 있고, `status` 종료값 검사 자체가 cutoff 로 게이트되지 않는 별도 불변식이라
  파싱 가능성 요구를 전체 완료 plan 으로 넓히는 것이 합리적이다. 코드 결함이 아니라 spec
  §4.2 표에 한 줄 각주를 더하면 더 명확해지는 수준.
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-plan-completion.test.ts:175`
    (`it("every completed plan has parseable frontmatter", ...)`)
  - 상세: 위 설명.
  - 제안: (선택) `spec/conventions/spec-impl-evidence.md §4.2` Gate C 행 비고에 "파싱 실패
    완료 plan은 (grandfather 여부와 무관하게) 별도로 캐너리된다" 한 줄 추가. 코드 변경 불필요.

## 상세 검증 내역 (문제 없음 확인)

- **Gate C cutoff**: `GATE_C_CUTOFF = new Date("2026-06-04T00:00:00Z")` — spec `spec-impl-evidence.md`
  R-8 ("grandfather cutoff `2026-06-04`") 및 `plan-lifecycle.md:137` ("`started` 가 2026-06-04
  이후인 plan 만") 과 정확히 일치.
- **`NONE_VALUES`**: `["none", "없음", "n/a", "na"]` — R-8 ("no-op sentinel(`none`/`없음`/`n/a`/`na`)")
  과 정확히 일치.
- **`hasValidSpecImpact` 계약**: 문자열이면 `NONE_VALUES` 어휘만, 배열이면 비어있지 않고 모든
  원소가 문자열+`specExists` 통과 — `plan-lifecycle.md:131-132` 의 "2026-08-10" 자로 갱신된 서술과
  정확히 일치(이 서술 자체가 이번 diff 로 spec 문서에 함께 반영돼 있음 — spec-drift 아님, 동일
  체인지셋 안에서 코드·spec 이 함께 조여짐).
  - 실제 diff(`git diff origin/main -- spec/conventions/spec-impl-evidence.md`)로 spec 쪽도 같은
    PR 라인에서 조여진 것을 확인함(4줄 변경) — spec 과 구현이 이미 동기화 상태.
- **`makeSpecExists`**: `spec/` 하위 실재 **파일**만 인정 + `path.resolve` 정규화로 `..` 우회 차단.
  `spec_impact: ["CLAUDE.md"]`, `["spec"]`(디렉터리), `[""]`, `["spec/../CLAUDE.md"]` 전부 거부하는
  테스트(`spec-plan-completion.test.ts:352-373`)가 실제로 GREEN. 헤더 주석("실재하는 spec **파일**")과
  구현이 line-level 로 일치.
- **`isIsoDate`/`hasMalformedStarted`**: node 로 직접 `new Date("YYYY-MM-DDT00:00:00Z")` 롤오버를
  재현해 주석의 표(2026-13-32→NaN, 2026-02-30→3/2, 2026-06-31→7/1)와 일치 확인. 라운드트립 비교를
  "일(day)" 하나로 충분하다는 주석 근거도 검산 결과와 부합(월이 벗어나면 NaN, 일이 넘치면
  월·일이 함께 밀림).
- **`TERMINAL_PLAN_STATUSES`**: `{complete, implemented, applied, superseded}` — `plan-lifecycle.md:84`
  와 정확히 일치. `in-progress` 미포함(디렉터리와 모순 방지) 근거도 `#1108`/`#1117` 재발 방지
  서술과 부합.
- **`isLifecyclePlan`/`walkPlanMarkdown`**: `0-`/`_` 접두는 **파일명 단위**로만 면제(디렉터리명은
  면제 안 함) — `plan-lifecycle.md` 의 암묵 전제 및 `plan-scan.test.ts` 의
  `"applies the index exemption to file names only, not directory names"` fixture 로 고정, 실행
  결과 GREEN.
- **`collectLivePlanMarkdown`(recurse:false) vs `collectCompletePlanMarkdown`(recurse:true)**:
  `plan-lifecycle.md §4` ("top-level `plan/in-progress/*.md` 에서 필수") 와 일치. 하위 클러스터
  폴더 면제 근거도 일치.
- **`checkPlanFrontmatter`**: `worktree`/`started`/`owner` 3필드 필수 + `WORKTREE_SENTINEL
  = "(unstarted)"` + 레거시 placeholder 거부 — `plan-lifecycle.md:75-78` 과 필드·sentinel 명 모두
  일치. 공백만 있는 값 거부(`wt.trim().length === 0`)까지 문서화된 의도("살아있어 보이지만 죽은
  값")와 부합.
- **PROJECT.md 동반 갱신**: `git diff origin/main -- PROJECT.md` 확인 결과 `plan-frontmatter.test.ts`
  가드 서술이 "3종(worktree/started/owner, status 종료값, 상대링크)" 로 이미 갱신돼 구현과
  동기화됨 — 문서 drift 없음.
- **TODO/FIXME/HACK/XXX**: 3파일 grep 결과 0건.
- **엣지 케이스**: 빈 `plan/` 트리, `archive/` 재귀 제외, non-string `status`(null/number/array),
  깨진 YAML(파싱 실패), `..` 경로 탈출, 대소문자, 앞뒤 공백, leap year(`2028-02-29` 유효,
  `2027-02-29` 무효) 등 — 전부 합성 fixture 로 positive 검증되어 있고 실행 결과 GREEN. 뮤테이션
  테스트로 무관측 분기(dead branch)까지 걸러낸 이력이 주석에 남아 있음(자체 언급).

## 요약

세 파일은 Gate C(`spec_impact` 완료 시점 선언 강제) 및 plan lifecycle 3종 가드(worktree/started/owner,
완료 plan 종료 status, 살아있는 plan 상대링크)의 판정 로직을 `plan-scan.ts` 단일 진입점으로 통합하고
과거 fail-open 버그들(무효 `started` 조용한 면제, 비-문자열 `spec_impact` 원소 통과, `spec/` 밖 경로
통과, 파싱 실패 완료 plan 의 게이트 우회)을 닫는 리팩터다. 관련 SoT 두 문서
(`spec/conventions/spec-impl-evidence.md`, `.claude/docs/plan-lifecycle.md`)와 line-level 대조한 결과
컷오프 날짜·no-op sentinel 어휘·`hasValidSpecImpact` 계약·`TERMINAL_PLAN_STATUSES`·필수 3필드·sentinel
명 등 핵심 규칙이 전부 spec 본문과 정확히 일치했고, spec 문서 자체도 이번 diff 안에서 함께 갱신돼
동기 상태였다(SPEC-DRIFT 없음). 실제 `pnpm vitest run` 실행으로 989/989 테스트 통과를 확인했고,
`isIsoDate` 근거인 JS `Date` 롤오버 동작을 node 로 직접 재현해 주석의 실측 주장을 검증했다. CRITICAL/
WARNING 급 결함은 발견되지 않았고, spec §4.2 표에 파싱-실패 캐너리 각주를 추가하면 좋겠다는 INFO 1건만
남는다.

## 위험도

NONE
