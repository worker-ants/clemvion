# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 매트릭스 적재

`.claude/config/doc-sync-matrix.json` (`rows[]`, 21건) 을 Read. 이 중:
- `match: "glob"` 5건 — `new-node`/`node-schema-change` (`codebase/backend/src/nodes/**`), `new-userguide-section-dir` (`codebase/frontend/src/content/docs/*/`), `new-bullmq-queue` (`codebase/backend/src/modules/system-status/system-status.constants.ts`), `new-error-code` (`codebase/backend/src/nodes/core/error-codes.ts`), `spec-major-change` (`spec/2-*/**` 등)
- `match: "semantic"` 16건 — `new-ui-string`(`codebase/frontend/src/**/*.tsx`), `new-widget-chrome-string`(`codebase/channel-web-chat/src/**/*.tsx`), `integration-provider-change`, `backend-api-change`(`*.controller.ts`/`dto/**`), `new-warning-code`, `auth-session-flow-change`(`codebase/backend/src/modules/auth/**`), `expression-language-change`(`codebase/packages/expression-engine/**`), `run-debug-flow-change` 등

## 변경 파일 식별

`git diff --name-only HEAD~5 HEAD` 로 확인한 실제 변경 set(오케스트레이터 prompt bundle 과 일치):

```
.claude/_shared/git_probe.py
.claude/hooks/_lib/branch_guard.py
.claude/hooks/_lib/plan_guard.py
.claude/hooks/_lib/review_guard.py
.claude/tests/README.md
.claude/tests/test_block_integrity.py
.claude/tests/test_plan_guard.py
.claude/tests/test_review_gate_ci.py
.claude/tests/test_review_guard_hardening.py
.claude/tests/test_stop_guard_failopen.py
.claude/tests/test_workflow_yaml_structure.py
.github/workflows/harness-checks.yml
.github/workflows/review-gate.yml
plan/in-progress/harness-review-gate-ci-backstop.md
scripts/check-review-gate.py
```

추가로 `git diff --name-only HEAD~5 HEAD | grep -E '^codebase/|^spec/'` 실행 — 결과 0건 (빈 출력, `codebase/**` 도 `spec/**` 도 이 변경 set 에 없음).

## trigger 매칭

15개 파일 전부를 21개 매트릭스 행의 `trigger.globs` 와 대조:

- `codebase/backend/src/nodes/**` (new-node, node-schema-change) — 무매치
- `codebase/frontend/src/**/*.tsx` (new-ui-string) — 무매치
- `codebase/channel-web-chat/src/**/*.tsx` (new-widget-chrome-string) — 무매치
- `codebase/frontend/src/content/docs/*/` (new-userguide-section-dir) — 무매치
- `codebase/backend/src/modules/system-status/system-status.constants.ts` (new-bullmq-queue) — 무매치
- `codebase/backend/src/nodes/core/error-codes.ts` (new-error-code) — 무매치
- `codebase/backend/src/**/*.controller.ts`, `dto/**` (backend-api-change) — 무매치
- `codebase/backend/src/modules/auth/**` (auth-session-flow-change) — 무매치
- `codebase/packages/expression-engine/**` (expression-language-change) — 무매치
- `spec/2-*/**` ~ `spec/conventions/**` (spec-major-change) — 무매치
- semantic 행들(통합/제공자, warning/error code 매핑, run-debug, GUI 흐름 절, cross-cutting enum 등) — 변경 내용이 노드·통합·표현식·실행엔진·인증·docs 그 어느 것도 아니므로 의미상으로도 무매치

변경 파일 전부가 `.claude/` (harness push-gate 훅·공유 git probe·단위테스트), `.github/workflows/` (CI 워크플로 정의), `plan/in-progress/` (작업 계획서), `scripts/check-review-gate.py` (CI 백스톱 스크립트) 에 국한됨. 이는 프로젝트 내부 리뷰/푸시 게이트 harness 인프라이며 제품 코드(`codebase/backend`, `codebase/frontend`, `codebase/packages`)나 spec 문서를 전혀 건드리지 않는다.

## 발견사항

없음. 매칭된 trigger 가 0건이라 동반 갱신 누락을 판단할 대상 자체가 없음.

## 요약

매트릭스 trigger 21개(glob 5 + semantic 16) 중 매칭된 항목 0건 — 변경된 15개 파일이 전부 `.claude/**`(push-gate 훅·git probe 공유화·단위테스트), `.github/workflows/**`(CI 백스톱 워크플로), `plan/in-progress/**`, `scripts/check-review-gate.py` 로, 어느 것도 `codebase/**`(노드/UI/통합/표현식엔진/인증) 또는 `spec/**` 를 건드리지 않는다. 유저 가이드(docs MDX)·i18n dict·backend-labels 동반 갱신을 논할 코드 변경이 이 changeset 에 없으므로 해당 없음.

## 위험도

NONE
