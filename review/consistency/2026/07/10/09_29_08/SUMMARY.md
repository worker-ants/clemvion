# Consistency Check 통합 보고서 (--impl-done, spec/5-system/)

**BLOCK: NO** (본 PR 기준) — 이 PR 의 실제 diff 는 **spec/ 변경 0건**(codebase/frontend
expression-suggestions 리팩터 + plan). behavior-preserving(248 테스트 전수 통과)이라
spec 위반 유입 여지 없음.

> ⚠ Workflow 자동 summary 는 **BLOCK: YES** 를 냈으나, 그 Critical 은 **내 PR 과 무관**하다:
> orchestrator 가 impl-done target 을 `spec/5-system/`(auth/graph-rag)로 오선정해
> rationale_continuity 가 **`1-auth.md §2.3`(내가 안 건드린 spec)** 의 pre-existing
> spec-code-Rationale 불일치를 CRITICAL 로 포착한 것이다. `cross_spec`·`naming_collision`
> 두 checker 가 **독립적으로 "이 워크트리 diff 는 spec/5-system 변경 0, codebase/frontend
> 에 한정 — target scope 무관"** 이라 명시했다(`git diff origin/main..HEAD` 로 재확인 완료).

## 본 PR diff (spec 무변경 확인)
```
codebase/frontend/.../use-expression-suggestions.ts (+ 테스트)
plan/complete/{expression-enricher-dry, eia-secret-masking-residuals}.md (Gate C spec_impact 보정)
plan/in-progress/suggestions-prefix-dry.md
```
spec/ 변경 0 → SPEC-CONSISTENCY 관점에서 본 리팩터가 유발한 위반 없음.

## Critical — **out-of-scope (별도 task 분리)**
| # | Checker | 위배 | 처분 |
|---|---|---|---|
| 1 | rationale_continuity | `1-auth.md §2.3` 재인증 서술이 자기 Rationale 1.1.B-4·코드(`verifyReauth`: password OR TOTP 한정)와 모순 | **내 PR 무관 pre-existing standing 이슈**(내 diff 에 1-auth.md 없음). 별도 task 분리(`task_10ac843b` — auth §2.3 3자 불일치 정정, project-planner). orchestrator target 오선정으로 포착 |

## WARNING / INFO — 전부 out-of-scope
- naming_collision: `document:graph_error` WS 이벤트 dead-declared drift(`5-knowledge-base.md:182` vs `10-graph-rag.md`) — 내 PR 무관.
- cross_spec INFO: JWT `role` 클레임 참고용 주석 / graph-rag Rationale truncation — 무관.
- convention_compliance·plan_coherence: FS-write flakiness 로 파일 미기록. 대상이 무관 auth/graph-rag 이므로 내 change 판정에 영향 없음.

## 본 change 검증 (실제)
- ai-review(09_16_00): LOW / Critical 0 / Warning 1(fix 완료).
- impl-prep(09_11_35): rationale_continuity 가 본 리팩터를 behavior-preserving·#880 선례 정합으로 확인(NONE).
- TEST: lint/unit(48, SIGSEGV flaky 재실행 PASS)/build/e2e(249) 전부 PASS.

## 권장 (orchestrator)
- impl-done target scope 가 워크트리 실제 diff 와 무관하게 잡히는 문제(반복 재발) — code-glob/diff 기반 target 선정으로 개선.
