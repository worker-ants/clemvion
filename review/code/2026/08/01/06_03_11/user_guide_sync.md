# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 매트릭스 적재

`.claude/config/doc-sync-matrix.json` (`rows[]`, 21개 trigger 항목) + `PROJECT.md` §변경 유형 → 갱신 위치 매핑 (116~186줄) 을 Read 해 SSOT 로 사용.

## 변경 파일 식별

이번 라운드(`06_03_11`) 리뷰 대상은 2개 파일뿐이다 (`git status --short` / `git diff --name-only HEAD` 로 보강 확인, 커밋 `e18fc7227` 로 이미 반영됨):

1. `review/code/2026/08/01/05_36_28/testing.md` — 직전(9차) 라운드의 리뷰 산출물 markdown
2. `scripts/check-override-floors.py` — `pnpm-workspace.yaml` 의 `overrides` 바닥 침식(재취약화)을 `pnpm audit` 결과와 대조해 검출하는 신규 CI/보안 도구 스크립트

## 매칭 판정

두 파일 모두 doc-sync-matrix 의 21개 trigger 어느 것에도 매칭되지 않는다.

- **파일 1 (`testing.md`)**: `review/code/**` 는 CLAUDE.md 의 "정보 저장 위치" 표에 정의된 **코드 리뷰 산출물** 저장 경로다. 애플리케이션 코드가 아니라 리뷰 도구가 생성한 리포트이므로 `codebase/**` 어떤 glob 에도, semantic trigger 어떤 change_type 에도 해당하지 않는다.
- **파일 2 (`check-override-floors.py`)**: 루트 `scripts/` 아래 신규 CI/devops 보안 스크립트로, `PROJECT.md` §보조 스크립트(검증·운영) 절에 이미 등재된 `scripts/check-doc-links.py`/`scripts/report_playwright_flaky.py`(및 스크립트 자체가 참조하는 `scripts/check-pnpm-security-config.py`)와 같은 계열이다. `pnpm-workspace.yaml` 과 `pnpm audit --json` 출력만 다루며 다음 어느 trigger 표면도 건드리지 않는다:
  - `codebase/backend/src/nodes/**` (신규 노드 / schema 변경) — 아님
  - `codebase/frontend/src/**/*.tsx` (신규 UI 문자열) — 아님
  - `codebase/channel-web-chat/src/**/*.tsx` (위젯 chrome) — 아님
  - 통합/제공자 변경 — 아님
  - `codebase/frontend/src/content/docs/*/` (신규 섹션 디렉토리) — 아님
  - `codebase/backend/src/**/*.controller.ts` / `dto/**` (백엔드 API) — 아님
  - `system-status.constants.ts` (BullMQ 큐) — 아님
  - warningRules / `error-codes.ts` (warning/error 코드) — 아님
  - cross-cutting enum / backend zod `ui.*` / handler output field — 아님
  - `codebase/backend/src/modules/auth/**` (인증·권한·세션) — 아님
  - `codebase/packages/expression-engine/**` (표현식 언어) — 아님
  - 실행·디버깅 흐름 — 아님
  - `spec/{2,3,4,5}-*/**`, `spec/conventions/**` — 아님
  - README 대상 "환경 변수·기동 방법·런타임 변경(제품 최종 상태)" — 아님(이 스크립트는 제품 런타임이 아니라 CI 파이프라인 전용 검증 도구)

  참고로 `PROJECT.md` §보조 스크립트 절 자체에 이 신규 스크립트를 문서화할지는 별개 사안일 수 있으나, 이는 doc-sync-matrix.json 의 21개 행 어디에도 SSOT 로 등재돼 있지 않은 **프로젝트 내부 도구 카탈로그** 문제이지 본 리뷰어의 헌장인 "유저 가이드(제품 사용자 대상 docs MDX·i18n dict·backend-labels)" 동반 갱신과는 무관하다. 회색 지대(INFO) 로도 분류하지 않는다 — 9개 관점 어느 것과도 유사성이 없다.

## 발견사항

없음.

## 요약

이번 라운드 리뷰 대상 2개 파일(`review/code/2026/08/01/05_36_28/testing.md`, `scripts/check-override-floors.py`) 은 doc-sync-matrix.json 의 21개 trigger 행 중 어느 것에도 매칭되지 않는다. 전자는 `codebase/**` 밖의 리뷰 산출물이고, 후자는 제품 코드(`codebase/backend|frontend|packages|channel-web-chat`)를 전혀 건드리지 않는 루트 `scripts/` CI 전용 의존성 보안 가드 스크립트(신규 노드·UI 문자열·docs·i18n·auth·표현식 엔진·warning/error 코드·BullMQ 큐·spec 어느 것도 변경하지 않음)다. 유저 가이드 동반 갱신 누락 없음.

## 위험도

NONE
