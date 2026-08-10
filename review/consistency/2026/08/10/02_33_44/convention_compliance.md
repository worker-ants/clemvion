# 정식 규약 준수 검토 — convention_compliance (5차 라운드, 종결)

## 전제 확인 (요청받은 것)

1. **`spec/conventions/**` 가 직전 라운드(`02_18_34`, 결과 NONE) 이후 변하지 않았는가**
   - `git log --oneline` 으로 확인: `02_18_34` 이후 반영된 커밋은 `6101a04b2`(`plan-frontmatter.test.ts` 캐너리 강화 — non-vacuity 보강, `review/code/2026/08/10/02_18_34/*` 산출물) 와 `c703039ba`(그 RESOLUTION 문서 e2e 줄 확정) 뿐이다.
   - `git show --stat 6101a04b2` / `git show --stat c703039ba` 모두 `spec/conventions/`, `PROJECT.md`, `.claude/docs/plan-lifecycle.md` 를 건드리지 않는다 — 변경 파일은 `plan-frontmatter.test.ts`(테스트 코드) + `review/code/**`(산출물) 뿐.
   - **확인됨: `spec/conventions/**` 는 직전 라운드 이후 무변경.**

2. **세 미러(`PROJECT.md:277` · `spec-impl-evidence.md §4.2` · `plan-lifecycle.md §4/§5`)가 여전히 정합한가**

   `plan-frontmatter.test.ts` 가드 서술(3종 검사) 대조:
   - **PROJECT.md:277**: "(1) top-level `plan/in-progress/*.md` 의 `worktree`(sentinel `(unstarted)` 허용)/`started`/`owner` frontmatter 강제, (2) `plan/complete/**` 가 `status` 를 선언했다면 종료 상태여야 함(`complete`/`implemented`/`applied`/`superseded`; 선언 자체가 없으면 위반 아님 — 선택 필드), (3) top-level 살아있는 plan 의 상대링크 무결성(`plan/complete/**` 는 시점 기록이라 제외). 판정 로직은 `plan-scan.ts`(수집·status)와 `spec-links.ts`(링크). SoT: `.claude/docs/plan-lifecycle.md §4`"
   - **spec-impl-evidence.md §4.2** (해당 행): "셋을 본다 — (1)/(2)/(3) 동일 서술. 판정 로직은 `plan-scan.ts`(수집·status)와 `spec-links.ts`(링크) 소관이고 이 파일은 호출부다 | ... `status` 는 선택 필드라 부재는 위반 아님. 링크 검사는 `plan/complete/**` 를 보지 않는다 ... **가드 규약 SoT = plan-lifecycle §4**; 본 절은 가드 파일 등재 위치만 선언"
   - **plan-lifecycle.md §4**: `worktree`/`started`/`owner` 필수 서술 + `status` 종료값 4개(`complete`/`implemented`/`applied`/`superseded`) + "선언 자체가 없는 것은 정상(선택 필드)" + 살아있는 plan 상대링크 무결성(§3 "인입 참조" 와 정합, `plan/complete/**` 는 대상 아님) — 전부 동일 서술.
   - **세 문서 모두 동일 4개 종료 상태(`complete`/`implemented`/`applied`/`superseded`), 동일 3종 검사 범위, 동일 SoT 위임(`.claude/docs/plan-lifecycle.md §4`) 을 일관되게 서술** — drift 없음.
   - 코드 대조(2차 확인): `codebase/frontend/src/lib/docs/__tests__/plan-scan.ts` 의 `TERMINAL_PLAN_STATUSES = new Set(["complete","implemented","applied","superseded"])` — 세 문서가 서술한 4개 값과 정확히 일치. `plan-frontmatter.test.ts` 가 실제로 `./plan-scan`(`findNonTerminalCompletedPlans` 등)과 `./spec-links`(`extractLinks`, `findBrokenPlanLinks`) 양쪽에서 import — "판정 로직은 plan-scan.ts/spec-links.ts 소관, 이 파일은 호출부" 서술과 일치.

   Gate C(`spec_impact`, cutoff `2026-06-04`) 대조:
   - **plan-lifecycle.md §5**: "`started` 가 2026-06-04 이후인 plan 만 대상(그 전 시작 plan 은 grandfather)"
   - **spec-impl-evidence.md §4.2 표 행 + R-8**: "`started ≥ 2026-06-04`" / "grandfather cutoff `2026-06-04`" / "cutoff 값은 spec-impl-evidence·plan-lifecycle·test 3곳에 동기 유지"
   - **코드**: `spec-plan-completion.test.ts:24` `const GATE_C_CUTOFF = new Date("2026-06-04T00:00:00Z")` — 세 곳 모두 동일 날짜.
   - **PROJECT.md:278** (`spec-plan-completion.test.ts` 행): "`started ≥ 2026-06-04` 완료 plan 의 `spec_impact` 선언 강제 (Gate C, date-cutoff grandfather). SoT: `spec/conventions/spec-impl-evidence.md §4.2`" — 동일 cutoff, 동일 SoT 위임.

   **결론: 세 미러 + 실제 코드(4곳) 전부 정합. drift 없음.**

## 발견사항

없음 (CRITICAL/WARNING/INFO 전무).

## 요약

본 라운드는 신규 spec 변경이 없는 확인 라운드다. `spec/conventions/**` 는 직전 라운드(`02_18_34`, 결과 NONE) 이후 커밋 이력상 무변경임을 `git log`/`git show --stat` 으로 실측 확인했다 — 그 사이 반영된 유일한 커밋(`6101a04b2`)은 `plan-frontmatter.test.ts` 의 non-vacuity 캐너리 강화(테스트 코드)일 뿐 규약 문서를 건드리지 않는다. 요청받은 세 미러(`PROJECT.md:277` · `spec-impl-evidence.md §4.2` · `.claude/docs/plan-lifecycle.md §4/§5`)는 (a) `plan-frontmatter.test.ts` 3종 검사 서술(대상 필드·종료 status 4값·링크 검사 범위·판정 로직 소재), (b) Gate C `spec_impact` grandfather cutoff(`2026-06-04`) 두 축 모두에서 문장·값이 일치하며, 실제 구현 코드(`plan-scan.ts` `TERMINAL_PLAN_STATUSES`, `spec-plan-completion.test.ts` `GATE_C_CUTOFF`, `plan-frontmatter.test.ts` 의 import 구조)와도 대조해 정합함을 확인했다. 정식 규약 준수 관점에서 위반·드리프트가 없으므로 본 라운드는 게이트를 여는 종결 라운드로 판정한다.

## 위험도
NONE

STATUS=success
