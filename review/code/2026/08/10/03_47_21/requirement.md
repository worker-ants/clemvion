# 요구사항(Requirement) 리뷰 — plan lifecycle gates (`plan-scan.ts` 등)

## 검증 방법
정적 리뷰 외에 다음을 실제로 실행해 확인했다.
- `pnpm vitest run` 으로 관련 4개 테스트 파일(980 tests) 전체 GREEN 확인.
- `plan-scan.ts` 의 핵심 판정(`if (!TERMINAL_PLAN_STATUSES.has(status))`)을 일부러 반전시키는 뮤테이션을 적용 후 재실행 → `plan-scan.test.ts`/`plan-frontmatter.test.ts` 에서 8건 즉시 RED로 실패, 원복 후 재실행해 177 tests 재-GREEN 확인. 가드가 vacuous 하지 않음을 직접 검증했다.
- `gray-matter` 캐시 우회(`matter(x, {})`) 주장을 Node REPL 로 재현 — 1차 호출(파싱 실패) → throw, 동일 content 2차 호출(옵션 없이) → `data: {}` 를 조용히 반환함을 실측 확인. 주석의 근거가 사실과 일치한다.
- `plan-frontmatter.test.ts` (실 production 가드, 이번 리뷰 대상 5개 파일에는 없지만 `plan-scan.ts`/`spec-links.ts` 의 유일한 소비처)를 직접 열어 `checkPlanFrontmatter`/`collectCompletePlanMarkdown`/`collectLivePlanMarkdown`/`findNonTerminalCompletedPlans`/`findBrokenPlanLinks` 가 실제로 배선돼 있음을 확인 — 새 모듈이 orphan 이 아니다.

## 발견사항

- **[INFO]** `findFrontmatterViolations` (파일 1, `plan-scan.ts:283`)는 export 되고 자체 유닛 테스트(`plan-scan.test.ts:302` `describe("findFrontmatterViolations")`)로만 검증되며, 실제 production 가드(`plan-frontmatter.test.ts`)는 이 편의 함수를 쓰지 않고 `checkPlanFrontmatter` 를 필드별로 직접 호출해 더 세분화된 `it` 를 만든다(그래야 실패 위치가 좁혀지므로 의도적). 결과적으로 "살아있는 top-level plan 전체의 frontmatter 위반" 을 모으는 이 함수는 실제 가드 경로에서는 소비되지 않는 API다. 기능 결함은 아니며(정확히 동작함, 테스트로 증명됨), 굳이 지적한다면 "왜 이 함수가 따로 존재하고 어디서 쓰이는지"가 코드만 봐서는 불분명하다는 정도.
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-scan.ts:283`(정의), `plan-scan.test.ts:302`(유일 소비처)
  - 제안: 조치 불요. 필요하면 JSDoc 에 "convenience wrapper, plan-frontmatter.test.ts는 이걸 안 쓰고 필드별로 인라인"이라는 한 줄만 추가하면 다음 사람의 혼동을 줄일 수 있음(선택).

- **[INFO]** `spec-plan-completion.test.ts` (파일 4)의 `hasValidSpecImpact`/`isGateCEnforced` 는 이번 diff 로 새로 추가된 것이 아니라 기존 코드(commit `2d4775e28`)이며, 이번 PR 은 `matter(...)` 호출에 캐시-우회 옵션(`{}`)만 추가했다(`git diff origin/main` 로 확인). 다만 참고로: 실제 per-plan enforcement 루프(`describe(rel, ...)` 블록, 121~149행)는 `hasValidSpecImpact`/`isGateCEnforced` 를 호출하지 않고 동등한 로직을 인라인으로 재구현한다 — 두 경로가 로직적으로는 일치하지만(단언 gate와 unit 함수가 별도로 같은 결론에 도달하도록 설계) 코드는 사실상 두 벌이다. 이번 diff 범위 밖의 pre-existing 상태이므로 이번 변경의 결함으로 분류하지 않음.
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-plan-completion.test.ts:43`(`hasValidSpecImpact` 정의), `:121`(실제 enforcement, 별도 인라인 로직)
  - 제안: 조치 불요(이번 PR 스코프 아님). 향후 정리 시 enforcement 루프가 `hasValidSpecImpact`를 직접 호출하도록 통합 고려.

## Spec 본문 일치 (`.claude/docs/plan-lifecycle.md`)

`git diff origin/main -- .claude/docs/plan-lifecycle.md` 로 신설분만 추출해 코드와 대조:

| spec 서술 | 코드 | 일치 |
|---|---|---|
| `status` 허용 종료값 = `complete`/`implemented`/`applied`/`superseded`, `in-progress` 는 명시적으로 배제 | `TERMINAL_PLAN_STATUSES` (plan-scan.ts:106-111) | 일치 |
| `status` 는 선택 필드, 선언 안 하면 정상 | `findNonTerminalCompletedPlans`: `typeof status !== "string" → continue` | 일치 |
| `worktree` sentinel `(unstarted)`, placeholder 거부 근거를 `plan-stale-audit.sh`+§3 연결판정으로 교체(`plan_coherence` 근거 폐기) | `WORKTREE_SENTINEL`/`WORKTREE_PLACEHOLDER`(plan-scan.ts:152-167) 주석이 동일한 근거 교체를 서술 | 일치 |
| 살아있는 plan 상대링크는 top-level `in-progress` 만 검사, `complete/**` 는 제외(§3 인입 참조 규정) | `findBrokenPlanLinks` → `collectLivePlanMarkdown`(recurse:false) 만 스캔 | 일치 |
| Gate C cutoff `2026-06-04` 이후 `started` 만 강제, 이전은 grandfather | `GATE_C_CUTOFF = 2026-06-04T00:00:00Z`, `>=` 비교 | 일치 |
| `spec_impact` 판정 `ok = (string && 비어있지 않음) \|\| (배열 && length>0)` (bare string/빈 배열 실패형 경고) | `it("declares spec_impact")` 의 `ok` 식이 문서 서술과 동일 | 일치 |

spec 문서 자체에 결함은 발견되지 않았고, 코드가 spec 서술을 정확히 구현한다. SPEC-DRIFT 항목 없음.

## 요약

`plan-scan.ts`/`plan-scan.test.ts`/`spec-links.ts`/`spec-plan-completion.test.ts`/`plan-lifecycle.md` 5개 파일은 "완료 plan 의 status 모순 검출 + frontmatter 3필드 검증 + plan 상대링크 검증"을 하나의 walker(`walkPlanMarkdown`)로 통합하고, 이전에 158 테스트가 GREEN인 채로 한 번도 실행되지 않았던 위반-수집 분기를 fixture 로 양성 증명하는 리팩터다. 실제 production 가드(`plan-frontmatter.test.ts`, 이번 리뷰 페이로드 밖이지만 유일 소비처)까지 열어 배선을 확인했고, 새 모듈이 실제로 호출됨을 검증했다. `TERMINAL_PLAN_STATUSES` 반전 뮤테이션으로 가드가 실제 RED 를 낼 수 있음을 직접 재현했고, gray-matter 캐시 우회 주장도 REPL 로 실측 재현해 근거가 정확함을 확인했다. spec 문서(`.claude/docs/plan-lifecycle.md`)의 신설 서술과 코드가 cutoff 날짜, 종료 status 어휘, worktree sentinel, 링크 스코프 등 모든 지점에서 line-level 로 일치한다. CRITICAL/WARNING 급 결함은 발견되지 않았고, INFO 2건(미소비 편의 함수, pre-existing 중복 로직)만 있다.

## 위험도
LOW
