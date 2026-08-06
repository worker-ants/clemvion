# 유저 가이드 동반 갱신(User Guide Sync) 리뷰 결과

## 사전 점검 절차

1. `.claude/config/doc-sync-matrix.json` (machine-readable SSOT) Read 완료 — `rows[]` 21행, `trigger.match` 는 `"glob"` 또는 `"semantic"`.
2. `PROJECT.md` §변경 유형 → 갱신 위치 매핑 (line 116~) 을 보조로 확인 — JSON 과 1:1 대응 (test_doc_sync_matrix.py 가 바인딩).
3. 변경 파일 목록을 prompt 헤더에서 추출 + `git status --short` / `git diff --name-only HEAD` 로 교차 확인.

## 변경 파일 목록 (리뷰 대상, 8개)

1. `.claude/tests/README.md`
2. `.claude/tests/test_block_integrity.py`
3. `.claude/tests/test_review_gate_ci.py`
4. `.claude/tests/test_stop_guard_failopen.py`
5. `.github/workflows/harness-checks.yml`
6. `.github/workflows/review-gate.yml`
7. `plan/in-progress/harness-review-gate-ci-backstop.md`
8. `scripts/check-review-gate.py`

## 매트릭스 trigger 매칭 결과

doc-sync-matrix.json 의 21개 행 모두 trigger 근거를 다음 경로 아래에 둔다:

- `codebase/backend/src/nodes/**` (new-node, node-schema-change)
- `codebase/frontend/src/**/*.tsx` / `codebase/frontend/src/content/docs/**` (new-ui-string, new-userguide-section-dir, userguide-gui-flow-section)
- `codebase/channel-web-chat/src/**/*.tsx` (new-widget-chrome-string)
- `codebase/backend/src/**/*.controller.ts`, `dto/**` (backend-api-change)
- `codebase/backend/src/modules/system-status/system-status.constants.ts` (new-bullmq-queue)
- `codebase/backend/src/modules/auth/**` (auth-session-flow-change)
- `codebase/packages/expression-engine/**` (expression-language-change)
- `codebase/backend/src/nodes/core/error-codes.ts` (new-error-code)
- `spec/2-*/**`, `spec/3-*/**`, `spec/4-*/**`, `spec/5-*/**`, `spec/conventions/**` (spec-major-change)
- 나머지 semantic 행 (신규 warningCode, cross-cutting enum, backend zod ui 값, handler output field, auth-config enum, run-debug flow, env-runtime) 도 전부 `codebase/backend/**` 또는 `codebase/frontend/**` 산출물을 대상으로 의미 판단하는 행이다.

이번 변경 set 의 8개 파일은 전부 `.claude/`, `.github/`, `plan/`, `scripts/` (harness/CI 인프라) 안에 있으며 **`codebase/**` 또는 `spec/**` 경로를 단 한 곳도 건드리지 않는다.** `scripts/check-review-gate.py` 는 이름이 "review-gate" 이지만 이는 harness 의 push-hook 판정(`review_guard.evaluate_review()`) 을 CI 이벤트로도 재실행하는 **backstop 스크립트**이며, 제품 코드(백엔드/프론트엔드/노드/표현식 엔진/인증 모듈)나 유저 가이드 문서·i18n dict·backend-labels 와 무관하다.

- new-node / node-schema-change: 무관 (`codebase/backend/src/nodes/**` 미변경)
- new-ui-string: 무관 (TSX 미변경)
- new-widget-chrome-string: 무관
- integration-provider-change: 무관
- new-userguide-section-dir: 무관 (`codebase/frontend/src/content/docs/*/` 신규 없음)
- backend-api-change: 무관
- new-bullmq-queue: 무관
- new-warning-code / new-error-code: 무관 (backend warningRules, error-codes.ts 미변경)
- new-cross-cutting-enum / new-backend-ui-zod-value / new-handler-output-field: 무관
- auth-session-flow-change / auth-config-type-enum-change: 무관 (`codebase/backend/src/modules/auth/**` 미변경)
- expression-language-change: 무관 (`codebase/packages/expression-engine/**` 미변경)
- run-debug-flow-change: 무관 — CI/리뷰 게이트 backstop 은 harness 자체의 파이프라인이지 제품의 "실행·디버깅"(워크플로우 실행 엔진, 디버그 로깅) 이 아님
- env-runtime-change: 무관 (README.md 미변경, 제품 런타임/환경변수 변경 없음)
- spec-major-change: 무관 (`spec/**` 미변경)
- userguide-gui-flow-section: 무관
- spec-defect-found: 무관

**결론: 21개 trigger 중 매칭 0건.** 변경 set 전체가 harness 자기-테스트/CI 인프라 영역이며, 유저 가이드 동반 갱신 매트릭스가 다루는 어떤 trigger 조건에도 해당하지 않는다. 라우터가 본 리뷰어를 활성화했더라도, 매트릭스 범위 밖이므로 "해당 없음" 판정이 정당하다.

## 참고 관찰 (본 리뷰어 영역 밖, 정보 제공 목적)

작업 지시에 따라 리뷰 시작 시 `git status --short` 를 확인한 결과 예상치 못한 변경이 있었다:

```
 M scripts/check-review-gate.py
?? review/code/2026/08/01/12_06_49/
```

`git diff scripts/check-review-gate.py` 로 확인한 uncommitted 변경 내용:

```diff
@@ -52,6 +52,10 @@ import argparse
 import os
 import sys
 
+# control case: local Name-to-Name alias of a disallowed call
+join = os.walk
+join('review')
+
```

이는 이번 프롬프트에 포함된 "파일 8: scripts/check-review-gate.py" (변경 유형: Review) 의 전체 파일 컨텍스트에는 나타나지 않는 **working tree 상의 uncommitted 로컬 수정**이다 (`os.walk` 을 `join` 이라는 이름으로 별칭한 뒤 호출 — `test_review_gate_ci.py` 의 "One judge" import+call allowlist 가드가 로컬 별칭(alias)까지 잡아내는지 검증하려는 control-case 뮤테이션으로 보인다). 작업 지시("working tree 를 수정하지 말고, 뮤테이션을 테스트하려면 복사본에서 하라. 예기치 않은 `git status` 는 고치지 말고 보고하라")에 따라 **수정하지 않고 있는 그대로 보고**한다. User Guide Sync 도메인 밖(테스트/가드 신뢰성 영역)이므로 본 리뷰어의 CRITICAL/WARNING 분류 대상은 아니며, 다른 리뷰어(가드/테스트 전문)가 판단할 사안으로 정보 전달만 한다.

## 요약

매트릭스 trigger 21개 전수 확인 결과, 이번 라운드의 변경 set(8개 파일 — `.claude/tests/*`, `.github/workflows/{harness-checks,review-gate}.yml`, `plan/in-progress/harness-review-gate-ci-backstop.md`, `scripts/check-review-gate.py`) 은 전부 harness 자기-테스트/CI 백스톱 인프라이며 `codebase/**`·`spec/**` 를 전혀 건드리지 않아 매칭 0건이다. 유저 가이드(MDX)·i18n dict·backend-labels 동반 갱신 누락 이슈는 발견되지 않았다(적용 대상 자체가 없음). 참고로 작업 지시에 따라 working tree 를 점검한 결과 `scripts/check-review-gate.py` 에 프롬프트에 포함되지 않은 uncommitted 로컬 변경(`os.walk` 별칭 control-case)이 있어 정보로만 보고한다(본 리뷰어 영역 밖, 수정하지 않음).

## 위험도

NONE
