---
worktree: slug-routing-hardening-94580e
started: 2026-07-09
completed: 2026-07-09
owner: developer
spec_impact: none
---

# 슬러그 라우팅 하드닝 (PR #865 후속 B)

PR #865(슬러그 라우팅 phase 1) ai-review round 3/4 에서 defer 한 **구조 하드닝** 4건. 목적: slug 누락
broken-link 회귀 방지 + open-redirect 방어 대칭화 + 순환 구조 제거. 순수 FE 리팩터(spec/API/데이터모델 무변경).

> impl-prep: B 는 spec 변경 없는 순수 코드 하드닝이라(검증할 spec draft 부재) 전면 fan-out 생략,
> 마지막 `--impl-done` + `/ai-review` 를 실 게이트로 삼는다.

## 항목

- [x] **B-2** `buildExecutionHref(slug, workflowId, executionId?)` 헬퍼(`lib/workspace/`) — 실행경로
  리터럴 15곳(rerun-modal 2 포함)을 통합. (+unit) — **3곳은 slug 누락 latent broken-link** 였음
  (executions row-click·dashboard row-click·detail prev/next).
- [x] **B-1** guard 테스트(`no-raw-execution-href.test.ts`) — raw `/workflows/${...}/executions` 리터럴을
  소스에서 금지(→ `buildExecutionHref` 강제). ESLint `no-restricted-syntax` 는 템플릿 리터럴 quasi 분해로
  AST 매칭이 취약해 소스 텍스트 guard 로 대체. **실행경로 타겟**(정당 bare 예외 없음)이라 저소음.
- [x] **B-3** `lib/workspace/safe-path.ts` 공용 정규화 → `buildWorkspaceHref` + `isSafeRedirectPath`
  (error-page.tsx) 공유. isSafeRedirectPath 의 `\`·tab/CR/LF 우회 갭 강화. (+unit)
- [x] **B-4** `WorkspaceSummary`(+`WorkspaceRole`) 타입을 `lib/workspace/types.ts` 로 이동
  (store 는 re-export 로 16 importer 무변경) → `workspace-store` ↔ `resolve-fallback` 순환 구조적 제거.
- [x] TEST WORKFLOW — lint(0-err)·unit(5140 pass)·build(101/101)·e2e(backend jest + Playwright
  `slug-routing.spec.ts` `status:passed` 0-fail) 전량 통과.
- [x] REVIEW WORKFLOW — `/ai-review`(10_51_47: Critical 0/Warning 3 → 전량 조치 →
  fresh 11_28_51: Critical 0/Warning 0) + `/consistency-check --impl-done`(11_31_49: BLOCK NO;
  cross_spec WARNING=EH-DETAIL-06 pre-existing spec 드리프트는 planner 후속 분리 task_fa5d4e34).
  RESOLUTION: review/code/2026/07/09/10_51_47/RESOLUTION.md.

## 후속(별도 트랙)
- W2 잔여 비-latent 소비처(workflows executions 액션·run-results-drawer·execution-history-panel
  "전체 실행"·trigger-history-dialog)는 동일 `buildExecutionHref`(unit 검증)+guard+e2e 3중 안전망 커버 → defer.
- EH-DETAIL-06 요구사항 ID 범위 드리프트 → project-planner (task_fa5d4e34).

## 근거(출처)
- B-1/B-2: PR #865 review round-4 W1/W2. B-3: round-3 W3. B-4: round-3 W4.
