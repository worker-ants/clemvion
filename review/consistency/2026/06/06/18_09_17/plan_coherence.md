# Plan 정합성 검토 결과

검토 모드: 구현 완료 후 (--impl-done)
Target: `spec/5-system/4-execution-engine.md` (+ 연관 변경 파일)
Scope branch: `claude/exec-park-polish-080a4d`

---

## 발견사항

### [INFO] exec-park-durable-resume plan 이 아직 in-progress 로 남아 있음

- target 위치: `plan/in-progress/exec-park-polish.md` (본 plan) § 비차단 후속
- 관련 plan: `plan/in-progress/exec-park-durable-resume.md` — frontmatter `worktree: exec-park-durable-resume` (물리 worktree 없음)
- 상세: `exec-park-durable-resume.md` 의 모든 Phase(A1/A2a/A2b/A3/B1/PR-B2a/PR-B2b)가 구현 완료됐고 PR #494/#501/#502 모두 main 에 MERGED 됐다. 그러나 해당 plan 파일이 `plan/in-progress/` 에 그대로 남아 있다. `plan-lifecycle.md` 에 따라 `plan/complete/` 로 이동해야 한다. 본 target 변경 자체에는 영향 없으나 `exec-park-polish.md` 의 "비차단 후속" 메모에 `exec-park-durable-resume.md plan→complete 이동` 이 명시돼 있어 추적 필요.
- 제안: `exec-park-durable-resume.md` 를 `plan/complete/` 로 이동 (project-planner 또는 developer 위임).

### [INFO] exec-park-b2a-followup.md 후속 항목(B1/B2 하드닝) 이 target 에서 구현됨 — plan 완료 상태 정합 확인 필요

- target 위치: `codebase/backend/.env.example` (B1), `codebase/backend/src/modules/external-interaction/interaction-token.service.ts` (B2)
- 관련 plan: `plan/in-progress/exec-park-b2a-followup.md` §후속 — "비차단: `.env.example` INTERACTION_JWT_SECRET·LLM_STUB_MODE 등재(I1/I2), InteractionTokenService prod fail-closed 명시 가드(W1 hardening)"
- 상세: `exec-park-b2a-followup.md` 는 2026-06-06 완료로 기록됐지만, 해당 plan 의 "비차단 후속 I1/I2(W1 hardening)" 항목들이 **현재 target 의 plan(`exec-park-polish.md`)의 B1/B2 항목으로 재추적됐고 target 에서 구현 완료**됐다. `exec-park-b2a-followup.md` 가 `plan/complete/` 로 이동되지 않은 상태이며, 이 follow-up 항목들이 두 plan 에 동시 기록돼 있는 점이 추적상 중복이다. target plan `exec-park-polish.md` 의 진행 메모 L31-35 에 B1/B2 구현 완료가 명시됐으므로 실제 충돌은 없다.
- 제안: `exec-park-b2a-followup.md` 를 `plan/complete/` 로 이동해 중복 추적 해소 (plan-lifecycle 규약).

### [INFO] security-jwt-secret-fallback.md 의 "prod fail-closed" 미해결 결정 — target B2 가 동일 패턴을 InteractionTokenService 에 독립 적용

- target 위치: `codebase/backend/src/modules/external-interaction/interaction-token.service.ts` (B2)
- 관련 plan: `plan/in-progress/security-jwt-secret-fallback.md` — `auth.module.ts`/`jwt.config.ts` 의 JWT secret fallback 하드닝·프로덕션 부팅 실패 정책 결정(미해결 status: backlog, worktree: unstarted)
- 상세: `security-jwt-secret-fallback.md` 는 `JWT_SECRET` 글로벌 auth secret 의 프로덕션 부팅 가드 결정을 "사용자/운영 합의 필요"로 열어두고 있다. target 의 B2 는 **InteractionTokenService** (interaction 전용 `INTERACTION_JWT_SECRET`) 에 대해 동일한 `NODE_ENV=production` fail-closed 패턴을 이미 적용했다. 두 secret 은 서로 다른 도메인(interaction vs auth)이므로 논리적 충돌은 없다. 그러나 `security-jwt-secret-fallback.md` 의 "미결 결정"(글로벌 JWT_SECRET 부팅 가드)은 여전히 열려 있으며, target 이 이를 암묵적으로 결정했거나 우회한 것이 아니다. 단, security-jwt-secret-fallback.md 가 backlog/unstarted 임에도 in-progress 에 있어 관리 일관성 이슈.
- 제안: security-jwt-secret-fallback.md 는 별도 트랙(auth.module.ts / jwt.config.ts 대상)이므로 target 변경에 의해 열린 결정이 영향받지 않는다. 단, 두 plan 의 scope 가 명시적으로 구분돼 있는지 security-jwt-secret-fallback.md 에 "InteractionTokenService B2 는 exec-park-polish 에서 별도 완료" 메모 추가 권장.

---

## Stale 으로 skip 한 worktree (의무 — 0건이어도 명시)

§5 worktree 충돌 후보 검사 결과: 물리적으로 존재하는 worktree 는 3개(`exec-park-polish-080a4d`, `impl-exec-concurrency-cap`, `rag-followup-efsearch-b6c8e8`). 이 중 target 과 동일 파일(execution-engine.service.ts, interaction-token.service.ts, .env.example, spec/5-system/4-execution-engine.md 등)을 수정하는 worktree 없음.

`exec-park-durable-resume`(frontmatter `worktree: exec-park-durable-resume`) 와 `exec-park-b2a-followup-9fdefc` 는 물리 worktree 로 등록돼 있지 않음(`git worktree list` 확인). plan frontmatter 에 기록만 남아 있는 상태 — stale 판정 cascade 대상:

- `exec-park-durable-resume` (branch 검색 불요 — 물리 worktree 부재, PR #494/#501/#502 MERGED 확인) — **stale skip (PR MERGED)**
- `exec-park-b2a-followup-9fdefc` (물리 worktree 부재, PR #502 MERGED 확인) — **stale skip (PR MERGED)**

worktree 충돌 후보 2건 중 2건 모두 stale — active 0건.

---

## 요약

target 변경(`exec-park-polish-080a4d`)은 `plan/in-progress/exec-park-polish.md` 가 명시한 A1/A2/A3/B1/B2/C1/C2 항목과 완전히 정합하다. 미해결 결정과의 충돌이 없고(`driveResumeAwaited` rename·`ProcessTurnResult` alias·prod fail-closed 가드는 모두 plan 이 명시한 구현), `security-jwt-secret-fallback.md` 의 열린 결정(글로벌 JWT_SECRET 부팅 가드)을 일방적으로 해소하지 않았다. 병렬 active worktree 는 `impl-exec-concurrency-cap`(`plan/in-progress/exec-intake-queue-impl.md`, 파일 비교 결과 단일 plan 파일만 수정)과 `rag-followup-efsearch-b6c8e8`(RAG 도메인 한정) 로 target 과 교차 파일이 없다. 발견된 모든 항목은 INFO(plan lifecycle 정리 권고, 중복 추적 메모) 수준이며 구현 차단 사유 없음. worktree 충돌 후보 2건은 모두 stale(PR MERGED) 로 skip.

---

## 위험도

NONE
