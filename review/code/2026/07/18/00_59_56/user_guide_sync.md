# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 매트릭스 적재
- SSOT: `.claude/config/doc-sync-matrix.json` (rows: 21건) Read 완료
- 보조: `PROJECT.md` §변경 유형 → 갱신 위치 매핑 (L116–187) Read 완료 — JSON 21행과 표 21행 매핑 일치 확인

## 변경 파일 컨텍스트
1. `.claude/hooks/_lib/mermaid_lint_ready.py` (신규) — mermaid-lint 설치 완료 여부 판정 SoT 모듈
2. `.claude/hooks/lint_mermaid_posttooluse.py` — PostToolUse mermaid lint 훅, readiness 판정을 SoT 모듈로 위임하도록 수정
3. `.claude/tools/bootstrap-session.sh` — SessionStart 부트스트랩: mermaid-lint 설치 락(mkdir lock)·liveness 기반 steal·실패 throttle 로직 강화
4. `.githooks/pre-commit` — pre-commit 훅의 mermaid readiness 판정을 SoT 모듈 경유로 변경
5. `.claude/tests/test_bootstrap_mermaid_install.py` (신규) — bootstrap 설치 가드 테스트
6. `.claude/tests/test_mermaid_lint_ready.py` (신규) — readiness SoT 모듈 + cross-consumer 바인딩 테스트

## 매칭 분석

매트릭스 21개 trigger(row) 전체를 순회하며 위 6개 변경 파일에 대해 glob/semantic 매칭을 시도했다.

- **new-node / node-schema-change** (`codebase/backend/src/nodes/**`) — 매칭 없음. 변경 파일은 전부 `.claude/` 또는 `.githooks/` 하위이며 `codebase/backend/src/nodes/` 와 무관.
- **new-ui-string / new-widget-chrome-string** (`codebase/frontend/src/**/*.tsx`, `codebase/channel-web-chat/src/**/*.tsx`) — 매칭 없음. TSX 파일 변경 없음(전부 `.py`/`.sh`/무확장자 훅 스크립트).
- **integration-provider-change** (semantic) — 매칭 없음. 백엔드 provider 관련 변경 아님.
- **new-userguide-section-dir** (`codebase/frontend/src/content/docs/*/`) — 매칭 없음. docs 디렉토리 변경 없음.
- **backend-api-change** (`*.controller.ts`, `dto/**`) — 매칭 없음.
- **new-bullmq-queue** (`system-status.constants.ts`) — 매칭 없음.
- **new-warning-code / new-error-code** (backend warningRules, `error-codes.ts`) — 매칭 없음. 변경된 `.py`/`.sh` 파일 중 backend warning/error 코드 발행 로직은 전무.
- **new-cross-cutting-enum / new-backend-ui-zod-value / new-handler-output-field** (semantic, backend 도메인 로직) — 매칭 없음.
- **auth-session-flow-change** (`codebase/backend/src/modules/auth/**`) — 매칭 없음.
- **auth-config-type-enum-change** — 매칭 없음.
- **expression-language-change** (`codebase/packages/expression-engine/**`) — 매칭 없음.
- **run-debug-flow-change** (semantic, backend 실행 엔진) — 매칭 없음. 이 변경은 워크플로우 "실행"이 아니라 Claude Code 세션의 git 커밋 훅/부트스트랩 스크립트에 대한 것으로, 매트릭스가 의도하는 "실행·디버깅 흐름"(제품의 워크플로우 실행 엔진)과 무관.
- **env-runtime-change** (semantic, targets `README.md`) — 매칭 검토했으나 기각. README.md §환경 변수는 제품(`codebase/backend`)의 Database/Redis/JWT/S3/Email/Security/Execution Engine 등 **제품 런타임 설정**을 문서화하며, `mermaid`·`bootstrap-session`·`githooks`·`pre-commit`·`hooksPath` 관련 언급이 전혀 없음(grep 0건, 확인 완료). 본 변경은 Claude Code 개발 하네스(git hook 설치·mermaid lint 세션 부트스트랩)에 대한 것으로 제품의 "환경 변수·기동 방법·런타임" 범주 밖.
- **spec-major-change** (`spec/{2,3,4,5}-*/**`, `spec/conventions/**`) — 매칭 없음. `spec/` 하위 파일 변경 없음.
- **userguide-gui-flow-section** (`02-nodes/**.mdx`, `06-integrations-and-config/**.mdx`) — 매칭 없음.
- **spec-defect-found** — 매칭 없음.

모든 trigger 를 대조한 결과 6개 변경 파일 중 어느 것도 매트릭스의 21개 row 어느 것에도 매칭되지 않는다. 변경 범위는 전적으로 `.claude/hooks/`, `.claude/tools/`, `.githooks/`, `.claude/tests/` — Claude Code 에이전트 하네스의 내부 tooling(세션 부트스트랩·git pre-commit 훅·mermaid 다이어그램 정적 문법 검사·그 테스트)이며, `codebase/`(제품 코드) 또는 `spec/`(제품 명세) 어느 쪽도 건드리지 않는다. 매트릭스가 다루는 노드·UI 문자열·i18n dict·docs MDX·auth 흐름·표현식 언어·실행 엔진·warning/error 코드·BullMQ 큐 등은 모두 제품(`codebase/backend`, `codebase/frontend`, `codebase/channel-web-chat`) 표면에 대한 것이며, 본 리뷰 대상은 그 표면에 속하지 않는 개발 인프라 변경이다.

## 발견사항

(해당 없음 — 위 분석 결과 매칭된 trigger 없음)

## 요약

매트릭스 21개 trigger 전체를 6개 변경 파일(`.claude/hooks/_lib/mermaid_lint_ready.py`, `.claude/hooks/lint_mermaid_posttooluse.py`, `.claude/tools/bootstrap-session.sh`, `.githooks/pre-commit`, `.claude/tests/test_bootstrap_mermaid_install.py`, `.claude/tests/test_mermaid_lint_ready.py`)에 대조했으나 매칭된 trigger 는 0건이다. 본 변경은 Claude Code 개발 하네스(mermaid lint 설치 가드의 readiness SoT·부트스트랩 락/throttle 강화·git 훅)에 국한되며 `codebase/`·`spec/` 어느 것도 수정하지 않아 유저 가이드(docs MDX)·i18n dict·backend-labels·locale.ts 동반 갱신 의무가 발생하지 않는다. "해당 없음"으로 판정한다.

## 위험도

NONE
