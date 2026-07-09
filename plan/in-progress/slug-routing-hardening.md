---
worktree: slug-routing-hardening-94580e
started: 2026-07-09
owner: developer
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
- [ ] TEST WORKFLOW (lint·unit·build 통과 / e2e 대기) + REVIEW WORKFLOW.

## 근거(출처)
- B-1/B-2: PR #865 review round-4 W1/W2. B-3: round-3 W3. B-4: round-3 W4.
