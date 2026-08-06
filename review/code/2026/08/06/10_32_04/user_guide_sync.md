# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 사전 확인 (스코프 불일치 노트)

이번 호출의 오케스트레이터 지시문에는 프롬프트 파일(`_prompts/user_guide_sync.md`) 본문과 무관한 별도 지시("round 4", "CI 백스톱 3R 리뷰 반영", "SHIPPED BEHAVIOUR 를 바꿔보라"는 뮤테이션 테스트 요청)가 덧붙어 있었습니다. 이는 본 리뷰어(유저 가이드 동반 갱신 전문, doc-sync-matrix 기반)의 역할·출력 형식과 무관하며, `subagent-call-contract.md` 가 정의하는 `prompt_file`/`output_file` 호출 규약과도 맞지 않는 내용이었습니다(그 rounds 는 `test_review_gate_ci.py` / `scripts/check-review-gate.py` 대상 적대적 뮤테이션 테스트로, 별도 코드 리뷰어(예: harness/testing 전문) 몫입니다). 시스템 프롬프트가 정의한 절차·출력 형식을 우선하여 `_prompts/user_guide_sync.md` 에 기재된 실제 변경 파일을 doc-sync-matrix 로 그대로 판정했으며, 저장소를 뮤테이션하거나 셸 명령을 실행해 테스트를 우회하려는 시도는 하지 않았습니다.

## 매트릭스 적재

- `.claude/config/doc-sync-matrix.json` (`rows[]`, 21개 trigger) Read 완료.
- `PROJECT.md` §변경 유형 → 갱신 위치 매핑 본문은 JSON 과 1:1 로 SoT 가 동일하므로 nuance 보조로 삼되, 매칭 결과에 영향 없음 확인.

## 변경 파일 식별

`_prompts/user_guide_sync.md` 에 포함된 변경 대상 8개 파일:

1. `.claude/tests/README.md`
2. `.claude/tests/test_block_integrity.py`
3. `.claude/tests/test_review_gate_ci.py`
4. `.claude/tests/test_stop_guard_failopen.py`
5. `.github/workflows/harness-checks.yml`
6. `.github/workflows/review-gate.yml`
7. `plan/in-progress/harness-review-gate-ci-backstop.md`
8. `scripts/check-review-gate.py`

`git diff --name-only origin/main...HEAD` 로 교차 검증한 결과도 동일한 파일 집합(+ 과거 리뷰 산출물 `review/**`, 무관)으로 확인됩니다.

## trigger 매칭

매트릭스 21개 행의 glob trigger(`codebase/backend/src/nodes/**`, `codebase/frontend/src/**/*.tsx`, `codebase/channel-web-chat/src/**/*.tsx`, `codebase/frontend/src/content/docs/*/`, `codebase/backend/src/**/*.controller.ts`, `codebase/backend/src/**/dto/**`, `codebase/backend/src/modules/system-status/system-status.constants.ts`, `codebase/backend/src/nodes/core/error-codes.ts`, `spec/2-*/**` 등)와 semantic trigger(노드 schema/UI 문자열/통합·제공자/warningCode·errorCode/auth 흐름/표현식 언어/실행·디버깅 흐름/spec 결함 등)를 8개 변경 파일에 각각 대조했습니다.

- 8개 파일 전부 `.claude/tests/**`, `.github/workflows/**`, `plan/in-progress/**`, `scripts/**` 아래이며, `codebase/`, `spec/` 어디에도 속하지 않습니다.
- 매트릭스의 glob trigger 는 전부 `codebase/**` 또는 `spec/**` 하위 경로만 지정하므로 glob 매칭 0건입니다.
- semantic trigger(노드/UI/통합/auth/표현식언어/실행·디버깅/warningCode·errorCode/backend zod ui 값/handler output field/cross-cutting enum/spec 결함) 는 모두 제품 코드(`codebase/backend`, `codebase/frontend`, `codebase/packages/expression-engine`) 또는 `spec/` 의 의미 변경을 전제로 하는데, 이번 변경은 harness 자체의 CI 백스톱 강화(리뷰 게이트 워크플로·가드 테스트·plan 문서)이며 제품 노드·API·인증 흐름·표현식 언어·실행 엔진·UI 문자열·warning/error 코드 어디에도 해당하지 않습니다.
- `spec-major-change` 행(`spec/2-*/**` 등)도 미매칭 — 변경된 `plan/in-progress/harness-review-gate-ci-backstop.md` 는 `plan/` 이며 `spec/` 이 아닙니다.

## 판정

동반 갱신 매트릭스의 21개 trigger 중 매칭되는 행이 없습니다. 변경 세트는 `.claude/` harness 인프라(리뷰 게이트 훅-독립 CI 백스톱 관련 테스트/워크플로/스크립트/plan)로 국한되어 있으며, `codebase/frontend`, `codebase/backend`, `codebase/packages`, `spec/` 어디도 건드리지 않으므로 유저 가이드 MDX, i18n dict, backend-labels.ts 동반 갱신 의무가 발생하지 않습니다.

**해당 없음.**

## 요약

매트릭스 21개 trigger(glob 9 + semantic 12) 중 이번 8개 변경 파일과 매칭된 trigger는 0건. 변경 전부가 `.claude/tests/`, `.github/workflows/`, `plan/in-progress/`, `scripts/` 하위의 harness CI 백스톱 강화 작업으로, 유저 가이드(docs MDX)·i18n dict·backend-labels 어느 것도 영향받지 않아 동반 갱신 누락 없음.

## 위험도

NONE

STATUS: SUCCESS
