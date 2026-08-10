# Requirement Review — plan-frontmatter.test.ts

## 발견사항

- **[INFO]** 임계값(`toBeGreaterThan(5)` / `toBeGreaterThan(50)`)이 실제 저장소 규모(top-level in-progress ≈37, complete(재귀, archive 제외) ≈375, 링크 추출 결과도 임계값을 충분히 상회)에 비해 매우 낮게 설정돼 있다.
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-frontmatter.test.ts:78`(plans.length), `:171`(links), `:186`(complete plans)
  - 상세: 파일 내 주석(예: "하한은 낮게 잡는다 — 실제 개수에 가깝게 잡으면 grooming 으로 정상적으로 줄어들 때마다 깨진다")이 의도를 명시하고 있고, 과거 `> 20` 임계값이 grooming 후 정확히 20 이 되어 발화한 전례를 근거로 든다. 의도적 설계이며 실측(vitest 3파일 175 tests 전부 GREEN)으로도 문제 없음을 확인했다. 결함 아님, 참고용 기록.
  - 제안: 없음(현행 유지 타당).

- **[INFO]** `spec-links.ts` 의 `collectCompletePlans`(`spec-plan-completion.test.ts` 소관, Gate C)와 `plan-scan.ts` 의 `collectCompletePlanMarkdown` 이 여전히 두 벌의 독립 구현으로 남아 있다.
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-scan.ts:18-22` (주석)
  - 상세: 주석이 "면제 규칙 값은 현재 일치 — 실측" 이라고 밝히고 `plan/in-progress/docs-guard-walker-dedup.md` 를 후속 통합 대상으로 명시 등재했다. 실제로 `spec-plan-completion.test.ts:75-76` 의 `0-`/`_` 접두 필터가 `plan-scan.ts` 의 `isLifecyclePlan` 과 동일함을 확인했고, 추적 plan 파일(`plan/in-progress/docs-guard-walker-dedup.md`)도 존재한다. 의도된 미완 통합이며 dangling 참조 아님.
  - 제안: 없음(이미 백로그에 등재됨).

## 점검 요약 (근거)

- **기능 완전성 / 비즈니스 로직**: `collectLivePlanMarkdown`(top-level in-progress, `0-`/`_` 제외), `collectCompletePlanMarkdown`(complete 재귀, `archive/` 제외), `findNonTerminalCompletedPlans`(선택 필드 `status` 가 선언됐을 때만 `TERMINAL_PLAN_STATUSES` 위반 검출), `findBrokenPlanLinks`(top-level in-progress 상대링크, 코드펜스 제외) 네 로직 모두 `.claude/docs/plan-lifecycle.md` §3·§4 서술과 필드·스코프·예외 규칙이 line-level 로 일치한다.
- **엣지 케이스**: `status` 부재(선택 필드, 위반 아님) / 파싱 실패(YAML 깨짐, 이 검사 관심사 아님, skip) / non-string `status`(null·number·array — throw 없이 skip) / YAML 1.1 `no`→string(js-yaml 2.x 동작) 케이스 전부 `plan-scan.test.ts` 합성 fixture 로 개별 양성 단언되고 실제로 GREEN.
- **비-vacuity**: "위반 0건" 을 기대하는 두 실저장소 단언(status·링크) 각각에 대해, 대응하는 `plan-scan.test.ts`(합성 fixture, positive 3건 정확히 검출) 와 "the plan link scanner actually sees links" (추출 링크 수 > 50) 캐너리가 검사 로직이 실제로 작동함을 증명한다 — discovery-only 캐너리의 함정(파일 수만 세면 통과)을 코멘트가 명시적으로 경계하고 실제로 피했다.
- **TODO/FIXME/HACK/XXX**: 없음.
- **의도-구현 일치**: `findNonTerminalCompletedPlans`/`collectLivePlanMarkdown` 등 함수명과 동작이 정확히 일치. 상단 주석이 과거 리뷰에서 지적된 "정본 문서 불일치"(spec-links.ts를 정본으로 잘못 기재)를 스스로 수정한 이력을 남기고 있으며, 현재 주석은 `spec-impl-evidence.md §4.2`("판정 로직은 plan-scan.ts(수집·status)와 spec-links.ts(링크) 소관")와 정확히 부합한다.
- **spec fidelity**: 관련 spec은 `.claude/docs/plan-lifecycle.md`(§3 이동 규칙, §4 frontmatter 스키마 — worktree/started/owner 필수, sentinel `(unstarted)`, status 종료 어휘 4종, 상대링크 규칙)와 `spec/conventions/spec-impl-evidence.md`(§4.2, 가드 파일 등재 표). 코드의 `TERMINAL_PLAN_STATUSES`(complete/implemented/applied/superseded), `WORKTREE_SENTINEL`, `WORKTREE_PLACEHOLDER` 정규식, 링크 스코프(top-level in-progress만, complete/**는 시점 기록이라 제외)가 두 spec 문서 서술과 완전히 일치한다. 불일치 발견 없음.
- **실측 검증**: `pnpm vitest run plan-frontmatter.test.ts plan-scan.test.ts spec-links.test.ts` → 3 files / 175 tests 전부 PASS(현재 저장소 실데이터 기준, 회귀 없음).

## 요약

`plan-frontmatter.test.ts`(및 이 PR 이 함께 건드린 `plan-scan.ts`/`spec-links.ts`)는 plan 라이프사이클 가드의 스캔 소스 단일화, non-vacuity 캐너리 강화, status/링크 두 신규 검사를 spec 문서(`plan-lifecycle.md` §3·§4, `spec-impl-evidence.md` §4.2)와 line-level 로 정확히 일치시켜 구현했다. 엣지 케이스(파싱 실패, non-string status, 선택 필드 부재, YAML 1.1 boolean coercion)를 합성 fixture 로 개별 양성 검증했고, 실저장소 대상 실행도 전부 GREEN 이다. TODO/FIXME 없음, CRITICAL/WARNING 급 결함 없음 — 발견사항은 설계 의도가 이미 주석에 명시된 INFO 2건뿐이다.

## 위험도

NONE
