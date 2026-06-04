---
worktree: spec-drift-gates-b26bce
started: 2026-06-03
owner: 사용자 본인 / developer
---
# spec↔구현 정합성 게이트 (spec-drift gates)

> 작성일: 2026-06-03
> 관련 commit: `a30d5d1d feat(harness): spec↔구현 정합성 게이트 A+B`
> 관련 메모(머신-로컬, 비신뢰): `memory/project_spec_drift_gate_backlog.md` — **동기화 안 되므로 본 plan 이 SSOT**

## 배경 (진단)

하네스 점검에서 도출한 두 문제:
1. **구현이 spec 을 준수하지 않음** — developer 가 구현 중 spec 본문과 어긋나게 만듦.
2. **구현 중 개선된 flow 가 spec 에 역류 안 됨** — 코딩 중 정교화된 동작이 spec 에 반영되지 않음.

근본 원인: 진입 게이트(`consistency-check --impl-prep`)·종료 게이트(`ai-review` + `review_guard`)
는 HARD 강제인데, **code-vs-spec 일치 검증**을 보는 유일한 검사 `/consistency-check --impl-done`
만 ADVISORY("권장") 라 비대칭. 역방향(구현→spec) 은 강제·탐지 메커니즘 자체가 부재.

개선안 4건 중 **A·B 적용 완료**, **C·D 보류**.

## A — SPEC-CONSISTENCY 종료 게이트 (적용 완료)

- [x] `review_guard.py` 에 게이트 2 추가: 변경된 `codebase/` 파일이 어떤 spec frontmatter
      `code:` glob 에 매칭되면, fresh 한 `--impl-done` consistency 산출물(`BLOCK: NO`)이
      push/stop 통과 조건에 추가됨. `meta.json` mode 로 impl-done 세션 식별 + mtime freshness.
      spec 무관 코드는 비대상. 전 파싱 fail-open.
- [x] 단위테스트 21건 (glob→regex, frontmatter 3형식 파서, impl-done 식별, gate2 결정표).
- [x] developer / consistency-checker SKILL: `--impl-done` 의무화 문서.

## B — SPEC-DRIFT 역류 경로 (적용 완료)

- [x] `requirement-reviewer`: 코드-spec 불일치 방향 판별. 구현이 spec 을 의도적 개선 →
      `[SPEC-DRIFT]` (WARNING) 태깅.
- [x] `resolution-applier`: SPEC-DRIFT 는 코드 revert 금지, `spec-update-<area>.md`
      draft + `ESCALATE=spec` (안전가드 #8).
- [x] `code-review-summary`: SPEC-DRIFT 카테고리 태그 보존.
- [x] code-review-agents SKILL §6: spec ESCALATE 행에 SPEC-DRIFT 명시.

## C — plan 완료 시 spec 정합 결정 강제 (적용 완료 — kb-quality #457)

- [x] 완료 plan 은 frontmatter `spec_impact` (spec path 목록 또는 `none`) 선언 필수.
- [x] 구현: `spec-plan-completion.test.ts` (SoT: `spec/conventions/spec-impl-evidence.md §4`).
- **설계 변경 기록**: 원안의 "건드린 `code:` 코드 변경 감지" 는 빌드 테스트가 git history 를
      알아야 해 fragile → **frontmatter `spec_impact` 선언 + `started ≥ 2026-06-04` date-cutoff
      grandfather** 방식으로 대체 (기존 백로그 소급 면제, lifecycle TTL 패턴 동형). 결정적·비-git.
- [ ] 근거: `memory/feedback_plan_must_include_spec_updates.md` 의 강제화 버전 —
      "구현 plan 은 spec 갱신까지 정식 phase 로 포함" 을 advisory → enforced 로.
- 목적: 문제 ② 의 누락 방지 (A·B 를 빠져나간 케이스를 plan 완료 시점에 회수).

## D — reverse-coverage 탐지 (적용 완료 — kb-quality #457, advisory)

- [x] `spec-coverage --mode reverse` 추가 — Heuristic 4(spec 미참조 controller route, high)·
      5(이벤트/큐, medium)·6(env, low). orchestrator `--mode {forward,reverse,both}` + agent §모드.
- [x] ADVISORY 유지 (NLP 휴리스틱, CI 비차단).
- [x] "spec 없는 신규 controller route" = high-confidence 강조.
- 근거: `memory/project_spec_sync_audit_2026_06.md` 의 142-파일 수작업 audit
      (severe 4건) 을 상시 탐지기로 대체. 누적 drift 회수용 안전망.

## 롤아웃 권고

A 를 먼저 한두 사이클 돌려 false-positive·마찰을 측정 → 필요하면 C → D 순으로 확장.
A·B 가 양방향 강제 게이트를 닫고, C 는 누락 방지, D 는 누적분 회수.

## 완료 조건

- [x] C 구현 + 테스트 (kb-quality #457)
- [ ] D 구현
- (A·B 만으로도 본 plan 의 핵심 목표는 달성. C·D 는 사용자 판단으로 착수 시점 결정 —
  착수 안 하기로 결정하면 본 plan 에 "C·D drop 결정" 명시 후 complete 이동 가능.)
