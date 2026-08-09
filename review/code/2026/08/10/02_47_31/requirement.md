# 요구사항(Requirement) 리뷰 — plan-frontmatter.test.ts

## 대상
- `codebase/frontend/src/lib/docs/__tests__/plan-frontmatter.test.ts` (188줄, 리팩터+2종 신규 검사 추가)
- 관련 SoT: `.claude/docs/plan-lifecycle.md §3/§4`
- 협력 모듈: `plan-scan.ts`(수집·status 판정), `spec-links.ts`(링크 무결성)

## 검증 방법
- 파일 전문 + 협력 모듈(`plan-scan.ts`, `spec-links.ts`, `spec-frontmatter-parse.ts`) 직접 열람
- `.claude/docs/plan-lifecycle.md` §1~§6 전문과 line-level 대조
- `plan-scan.test.ts`, `spec-links.test.ts` 의 negative-path fixture 존재 확인 (claim 실측)
- `pnpm vitest run plan-frontmatter.test.ts plan-scan.test.ts spec-links.test.ts` 실행 → 3 files / 179 tests 전부 PASS
- 실저장소 수치 sanity: top-level in-progress plan 38개(임계값 `>5`와 충분히 이격), 링크 rough count 123(임계값 `>50`과 충분히 이격) — 임계값이 현재 fragile 하지 않음
- 참조된 후속 plan 문서(`docs-guard-legacy-fixture-coverage.md`, `docs-guard-walker-dedup.md`) 실존 확인, dangling 아님
- Gate C(`spec-plan-completion.test.ts`)에 `collectCompletePlans` 독립 구현이 실제로 남아있는지 확인 (plan-scan.ts 주석 주장 검증) → 일치

## 발견사항

- **[WARNING] [SPEC-DRIFT]** SoT 문서가 `TERMINAL_PLAN_STATUSES` 상수의 실제 위치를 가리키지 못한다 (extraction 후 미동기화)
  - 위치: `.claude/docs/plan-lifecycle.md:83` (`§4 Frontmatter 스키마`)
  - 상세: 이 PR 계열의 두 커밋이 각각 (1) `ebb6f9598`에서 `TERMINAL_PLAN_STATUSES` 판정 로직을 `plan-frontmatter.test.ts` → `plan-scan.ts` 로 추출했고, (2) 이후 `88555a52b`에서 이름을 `TERMINAL_STATUSES` → `TERMINAL_PLAN_STATUSES` 로 정정했다. 그런데 §4 본문은 여전히 "build guard `plan-frontmatter.test.ts` 가 강제하며, 새 종료 어휘가 필요하면 **그 파일**의 `TERMINAL_PLAN_STATUSES` 에 등재한다"(83행)라고 적어, "그 파일"이 여전히 `plan-frontmatter.test.ts`를 가리킨다. 실제로 그 상수는 `plan-scan.ts:100-105`에 있다. 반대로 리뷰 대상 파일 자신의 주석(`plan-frontmatter.test.ts:184-185`)은 이미 "새 종료 어휘라면 plan-scan.ts 의 TERMINAL_PLAN_STATUSES 에 등재할 것"으로 올바르게 정정돼 있다 — 즉 **코드(테스트 파일 주석)는 맞고 SoT 문서만 낡았다.**
  - 제안: 코드 변경 불필요. `.claude/docs/plan-lifecycle.md:83`의 "그 파일의 `TERMINAL_PLAN_STATUSES`"를 "`plan-scan.ts` 의 `TERMINAL_PLAN_STATUSES`"로 정정 (project-planner 소관, spec draft 경로로 반영).

- **[INFO]** 선재 3필드 검사(`worktree`/`started`/`owner`)가 positive-only이고 `ISO_DATE` 가 형식만 검증(`2026-13-32`도 통과)하는 엣지케이스 갭은 이미 인지·등재됨
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-frontmatter.test.ts:97-124` (세 `it` 블록), `:37`(`ISO_DATE`)
  - 상세: 새로 발견한 결함이 아니라 이번 PR이 만든 `plan/in-progress/docs-guard-legacy-fixture-coverage.md`(worktree/started/owner/status/spec_impact 스키마 정상)에 P3로 명시 등재돼 있고, "실동작 결함 아님 — 검사가 조용히 죽어도 아무도 모른다는 잠재 위험"이라는 근거도 타당하다. 재지적 불필요, 참고로만 남김.

- **[INFO]** spec fidelity — 신규 2종 검사(status 종료값, 살아있는 plan 링크 무결성)는 SoT `plan-lifecycle.md §4`(80-91행)의 스코프·허용값·예외 규칙과 line-level로 일치
  - 검증: `TERMINAL_PLAN_STATUSES = {complete, implemented, applied, superseded}` (plan-scan.ts:100-105) = 문서 80-81행과 동일 어휘. 링크 검사 스코프 = top-level `plan/in-progress/*.md`만(문서 87-91행) = `collectLivePlanMarkdown`(recurse:false)과 일치. `plan/complete/**` 는 링크 검사에서 제외(문서 90-91행 "인입 참조") = `findBrokenPlanLinks`가 `collectLivePlanMarkdown`만 스캔하는 것과 일치.

## 요약
이 파일은 이전 여러 라운드의 ai-review(W1/W2/W3)를 거치며 이미 상당히 정제된 상태다. 신규 2종 불변식 검사(완료 plan 의 `status` 종료값, 살아있는 plan 의 상대링크 무결성)는 SoT(`plan-lifecycle.md §4`)와 line-level로 정확히 일치하고, 판정 로직을 `plan-scan.ts`/`spec-links.ts` 순수 함수로 위임해 자매 fixture 테스트(`plan-scan.test.ts`, `spec-links.test.ts`)가 negative-path 를 실제로 검출한다는 것까지 증명한다(positive-only "0건" 캐너리의 함정을 스스로 지적하고 해소). TODO/FIXME 없음, 모든 `it` 블록이 명확한 실패 메시지와 함께 boolean 을 반환하며, 파싱 실패·비-문자열 `status`·archive 제외 등 엣지케이스가 fixture 로 각각 양성 단언돼 있다. 유일한 결함은 SoT 문서(`plan-lifecycle.md:83`)가 이 PR 계열의 리팩터(상수를 `plan-scan.ts`로 이관)를 따라가지 못해 "그 파일"이라는 대명사가 잘못된 파일을 가리키는 SPEC-DRIFT 1건이며, 코드 자체는 이미 올바르다. 선재 코드의 엣지케이스 갭(ISO 날짜 형식 검증, positive-only 3필드)은 이미 별 plan 으로 등재돼 범위 밖으로 정당하게 이관됐다.

## 위험도
LOW
