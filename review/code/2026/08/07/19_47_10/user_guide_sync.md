STATUS=success ISSUES=0

# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 매트릭스 적재

`.claude/config/doc-sync-matrix.json` 의 `rows[]` 22건을 Read. 모든 trigger 는 다음 중 하나로 스코프가 좁혀져 있다:

- glob 매치: `codebase/backend/src/nodes/**`, `codebase/frontend/src/**/*.tsx`, `codebase/channel-web-chat/src/**/*.tsx`, `codebase/frontend/src/content/docs/*/`, `codebase/backend/src/**/*.controller.ts`, `codebase/backend/src/**/dto/**`, `codebase/backend/src/modules/system-status/system-status.constants.ts`, `codebase/backend/src/nodes/core/error-codes.ts`, `spec/2-*/**` ~ `spec/5-*/**`, `spec/conventions/**`, `codebase/frontend/src/content/docs/02-nodes/**.mdx`, `codebase/frontend/src/content/docs/06-integrations-and-config/**.mdx`
- semantic 매치(glob 없음): `codebase/backend/src/modules/auth/**`(인증·세션), `codebase/packages/expression-engine/**`(표현식 언어), backend warningRules/AuthConfig enum/handler output field/cross-cutting enum 등 — 전부 backend/frontend/spec 코드 의미 기반

PROJECT.md 본문도 같은 표를 미러링하며 nuance 만 보강할 뿐 스코프를 벗어나지 않는다.

## 변경 파일 컨텍스트

prompt 에 포함된 12개 변경 파일 전부가 다음 두 디렉토리 하위다:

- `.claude/_shared/git_probe.py`
- `.claude/_shared/retry_state.py`
- `.claude/skills/code-review-agents/README.md`
- `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py`
- `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py`
- `.claude/skills/merge-coordinator/scripts/merge_coordinator_orchestrator.py`
- `.claude/tests/README.md`
- `.claude/tests/test_branch_diff_shared.py` (신규)
- `.claude/tests/test_retry_state_shared.py`
- `plan/complete/harness-review-gate-followups-handoff.md`
- `plan/in-progress/harness-review-gate-followups-handoff.md`
- `plan/in-progress/harness-review-gate-followups.md`

이 변경은 harness 내부(git diff 프로브 공유화 `_run_git_raw`/`branch_diff_files`, `_retry_state.json` 의 `agents_fatal` sentinel 화, 3개 skill orchestrator 의 중복 제거 리팩터)와 그 작업 추적 plan 문서다. `codebase/backend`, `codebase/frontend`, `codebase/channel-web-chat`, `codebase/packages/expression-engine`, `spec/` 그 어디에도 파일이 없다.

## 매칭 검토

22개 trigger 행을 각각 대조했다:

- glob 행 전부 — 위 경로 리스트(`codebase/**`, `spec/2~5-*/**`, `spec/conventions/**`) 와 12개 변경 파일 사이에 접두사 일치가 하나도 없다.
- semantic 행 전부 — "노드 schema 변경", "인증·권한·세션 흐름 변경"(`codebase/backend/src/modules/auth/**` 대상), "표현식 언어 변경"(`codebase/packages/expression-engine/**` 대상), "실행·디버깅 흐름 변경", "AuthConfig enum 변경", "handler output field 신규", "cross-cutting enum 신규" 등은 모두 제품 코드(백엔드 노드/인증 모듈/표현식 엔진/스펙)를 대상으로 하는데, 이번 변경은 `.claude/` CI/리뷰 harness 인프라 코드이며 제품의 인증·세션·실행·표현식 흐름과 무관하다.

12개 파일 중 유일하게 "인증"이라는 단어가 나올 법한 지점도 없고(`git_probe.py`/`retry_state.py`는 git 프로브·재시도 상태 JSON 유틸), "실행·디버깅"도 code-review orchestrator 의 재시도/reconcile 로직이지 제품의 워크플로 실행 엔진이 아니다. 매트릭스의 대상 디렉토리(`codebase/frontend/src/content/docs/**`, `dict/{ko,en}/**`, `backend-labels.ts`)에 대응할 변경도 전혀 없다.

## 발견사항

없음. 매칭된 trigger가 0건이므로 동반 갱신 누락 검출 대상 자체가 없다.

## 요약

매트릭스 22개 trigger 행 중 이번 변경(harness `.claude/` 스크립트·테스트·README + `plan/` 추적 문서 12개 파일) 과 매칭되는 행은 0건이다. 변경은 code-review/consistency/merge-coordinator 세 orchestrator 간 중복이던 git diff 프로브를 `_shared/git_probe.py` 로, `_retry_state.json` 의 fatal 버킷을 `_fatal/<name>` sentinel 로 통합하는 harness 내부 리팩터이며, `codebase/backend`, `codebase/frontend`, `codebase/channel-web-chat`, `codebase/packages/expression-engine`, `spec/` 어디에도 손대지 않았다. 유저 가이드(docs MDX)·i18n dict·backend-labels 동반 갱신 관점에서는 해당 없음.

## 위험도

NONE
