# 유저 가이드 동반 갱신(User Guide Sync) 리뷰 결과

## 매트릭스 적재
`.claude/config/doc-sync-matrix.json` (`rows[]`, 21개 trigger) 을 SSOT 로 Read 했다. glob trigger:
`codebase/backend/src/nodes/**` (new-node, node-schema-change), `codebase/frontend/src/**/*.tsx` (new-ui-string, semantic),
`codebase/channel-web-chat/src/**/*.tsx`, `codebase/frontend/src/content/docs/*/ `(new-userguide-section-dir),
`codebase/backend/src/modules/system-status/system-status.constants.ts`, `codebase/backend/src/nodes/core/error-codes.ts`,
`spec/2-*/**`~`spec/5-*/**`, `spec/conventions/**`, `codebase/frontend/src/content/docs/02-nodes/**.mdx`,
`codebase/frontend/src/content/docs/06-integrations-and-config/**.mdx`. semantic trigger(무-glob):
통합/제공자 변경, 백엔드 API 변경, 신규 warningCode/errorCode, cross-cutting enum, backend zod ui.label,
handler output field, 인증·세션 흐름 변경(`codebase/backend/src/modules/auth/**`), AuthConfig enum, 표현식 언어 변경
(`codebase/packages/expression-engine/**`), 실행·디버깅 흐름 변경, env/runtime 변경, spec 결함.

## 변경 파일 식별
prompt 에 포함된 9개 파일 전부 확인(및 파일 헤더 grep 으로 대조):

1. `.claude/tests/README.md`
2. `.claude/tests/test_block_integrity.py`
3. `.claude/tests/test_review_gate_ci.py`
4. `.claude/tests/test_stop_guard_failopen.py`
5. `.claude/tests/test_workflow_yaml_structure.py`
6. `.github/workflows/harness-checks.yml`
7. `.github/workflows/review-gate.yml`
8. `plan/in-progress/harness-review-gate-ci-backstop.md`
9. `scripts/check-review-gate.py`

## 매칭 분석
9개 파일 전부 `.claude/**`(harness 테스트) · `.github/workflows/**`(CI 워크플로) · `plan/in-progress/**`(작업 추적 plan) ·
`scripts/**`(리뷰 게이트 스크립트) 아래에 있다. 매트릭스의 21개 trigger 는 전부 `codebase/**` 또는 `spec/**` 하위 경로를
대상으로 한다 (신규 노드, TSX UI 문자열, docs MDX 섹션, auth 모듈, expression-engine, backend nodes/system-status,
spec 문서 등). 이번 변경 set 은 이 중 어떤 glob 에도, 어떤 semantic 범주(신규 노드/필드/UI 문자열/통합·제공자/
warningCode·errorCode/인증·세션 흐름/표현식 언어/실행·디버깅 흐름)에도 해당하지 않는다 — 순수하게 리뷰 게이트의
CI 백스톱(로컬 훅과 동일한 `review_guard.evaluate_review()` 를 GitHub PR 이벤트로도 트리거하는 관측 모드 계층)을
다루는 harness/인프라 변경이며, 사용자에게 노출되는 노드·필드·UI 문자열·docs·인증 흐름·표현식 언어·실행 흐름
어느 것도 건드리지 않는다.

## 발견사항
없음 — 해당 없음(매칭된 trigger 없음).

## 요약
매트릭스 trigger 21개 중 매칭된 항목 0개, 동반 갱신 누락 0건. 변경 파일 9개는 전부 `.claude/tests/**`
(CI 백스톱 회귀 테스트 4종 + README), `.github/workflows/{harness-checks,review-gate}.yml`, `scripts/check-review-gate.py`,
`plan/in-progress/harness-review-gate-ci-backstop.md` 로 구성된 harness/CI 인프라 작업이며, 유저 가이드
동반 갱신 매트릭스가 다루는 `codebase/**`(노드·UI·docs) 또는 `spec/**` 표면을 전혀 건드리지 않는다.
User Guide Sync 관점에서는 리뷰할 대상이 없다.

## 위험도
NONE
