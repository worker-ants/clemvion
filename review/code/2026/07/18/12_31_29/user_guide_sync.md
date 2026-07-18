## 유저 가이드 동반 갱신(User Guide Sync) 리뷰

### 매트릭스 적재
- SSOT: `.claude/config/doc-sync-matrix.json` (`rows[]` 20건, `id/change_type/trigger/targets/verify/guard_tests/convention_ref`) Read 완료
- 보조: `PROJECT.md` §변경 유형 → 갱신 위치 매핑 본문 (리뷰 payload 에 file 5 로 임베드된 HEAD 스냅샷) Read 완료 — JSON row 20개와 1:1 대응 확인
- 실제 변경 확인: `git log --oneline` 로 대상 커밋 `02d69e324`(mermaid-lint CVE 해소 + Dependabot 편입) · `c5fdd1bb8`(설치 마커를 lockfile 해시에 결속) 식별, `git diff 02d69e324~1 c5fdd1bb8 --stat` 로 코드 변경 파일 집합이 prompt 의 5개 파일과 정확히 일치함을 재확인 (plan/review 산출물 제외)

### 변경 파일 → 매트릭스 매칭 결과

| 변경 파일 | 매칭 시도 | 결과 |
|---|---|---|
| `.claude/tools/bootstrap-session.sh` | `codebase/backend/src/modules/auth/**`(인증·세션 흐름), `실행·디버깅 흐름`, `환경 변수·기동 방법·런타임` 등 검토 | 불일치 — Claude Code **SessionStart 하네스 훅**(git hooksPath 설정·mermaid-lint npm install 가드·state marker GC·worktree reap)이며 제품의 사용자 인증/세션·실행 엔진·기동 방법과 무관 |
| `.claude/tests/test_bootstrap_mermaid_install.py` | 위와 동일 도메인의 테스트 | 불일치 — 위 스크립트의 단위 테스트, 20개 row 어느 glob(`codebase/**`, `spec/**`)에도 속하지 않음 |
| `.github/dependabot.yml` | 없음 (CI/의존성 설정) | 불일치 — PROJECT.md 자체가 `.github/**` 를 e2e 면제 화이트리스트에도 명시("CI 정의는 검증 대상 아님")할 만큼 harness 레이어. 매트릭스 20 row 전부 product code/spec 스코프 |
| `.claude/tools/mermaid-lint/package-lock.json` | `새 노드 추가`(오탐 후보 — "node" 자구 유사) | 불일치 — 여기서 "node" 는 워크플로 실행 노드(`codebase/backend/src/nodes/<cat>/<name>/`)가 아니라 마크다운 mermaid 다이어그램 lint 용 독립 npm devtool(pnpm workspace 밖) 의 lockfile. 도메인 자체가 다름 |
| `PROJECT.md` (§버전·도구 정책 1문장 추가: "이 트리를 pnpm 워크스페이스로 흡수하기 전까지 두 경로가 병존한다" 등) | `spec 신규/대규모 변경`(glob `spec/2-*/**` 등) | 불일치 — `PROJECT.md` 는 `spec/` 트리 밖의 루트 harness 거버넌스 문서이고, 편집도 매트릭스 표 자체가 아닌 별개 섹션(의존성 audit 거버넌스)의 1문장 보강. `spec-major-change` row 의 glob 대상이 아님 |

20개 row 전부(`new-node` / `node-schema-change` / `new-ui-string` / `new-widget-chrome-string` / `integration-provider-change` / `new-userguide-section-dir` / `backend-api-change` / `new-bullmq-queue` / `new-warning-code` / `new-error-code` / `new-cross-cutting-enum` / `new-backend-ui-zod-value` / `new-handler-output-field` / `auth-session-flow-change` / `auth-config-type-enum-change` / `expression-language-change` / `run-debug-flow-change` / `env-runtime-change` / `spec-major-change` / `userguide-gui-flow-section`)를 개별 대조했으며, glob 스코프는 예외 없이 `codebase/{backend,frontend,packages/expression-engine,channel-web-chat}/**` 또는 `spec/{2,3,4,5}-*/**`·`spec/conventions/**` 이고 semantic row 도 product 도메인(신규 노드/스키마/UI 문자열/통합/인증/표현식/실행-디버깅/enum/warning·error code)에 한정된다. 이번 changeset 은 이 중 어디에도 속하지 않는다.

### 발견사항
없음.

이번 변경은 `.claude/tools/mermaid-lint`(pnpm workspace 밖 독립 npm 트리, 마크다운 mermaid 블록 lint 전용 devtool) 의 undici HIGH·dompurify moderate CVE 해소 + 향후 보안 픽스가 기존 설치에 조용히 묻히지 않도록 SessionStart 설치 가드를 lockfile 해시에 결속 + 이 트리를 Dependabot 감시 대상으로 신규 편입 + `PROJECT.md` 거버넌스 절에 그 사실 1문장 반영, 5개 파일로 구성된 harness/CI 보안 유지보수다. 노드 추가/스키마 변경, i18n 문자열, docs MDX, 통합 제공자, 인증·세션, 표현식 언어, 실행·디버깅 흐름, warning/error code 등 유저 가이드 동반 갱신 매트릭스가 다루는 어떤 product 표면도 건드리지 않는다.

### 요약
매트릭스 trigger 20개 전수 대조 / 매칭 0개 / 누락 0개 — 변경 5건(`bootstrap-session.sh`, `test_bootstrap_mermaid_install.py`, `dependabot.yml`, mermaid-lint `package-lock.json`, `PROJECT.md` 1문장)은 전부 Claude Code 하네스·devtool·CI 의존성 거버넌스 스코프이며 `codebase/backend`·`codebase/frontend`·`spec/` 의 product 표면을 전혀 건드리지 않아 유저 가이드/i18n dict/backend-labels 동반 갱신 대상이 아니다. "노드"(mermaid-lint 의 npm 패키지 트리) · "세션"(SessionStart 훅) 자구 유사로 인한 오매칭 가능성을 명시적으로 배제했다.

### 위험도
NONE
