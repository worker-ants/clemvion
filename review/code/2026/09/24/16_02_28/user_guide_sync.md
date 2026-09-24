# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 매트릭스 적재

`.claude/config/doc-sync-matrix.json` (`rows[]` 21행)을 Read 하고 `PROJECT.md` §변경 유형 → 갱신 위치 매핑 본문을 보조로 확인했다.

## 변경 파일 전수 (`git diff --name-only origin/main...HEAD`)

- `PROJECT.md` (기존 정책 문단에 실측 각주 추가)
- `codebase/backend/jest.config.ts` (`transformIgnorePatterns` 를 손-유지 ESM allowlist → 기본값)
- `codebase/backend/package.json` (jest 관련 npm scripts 5개에 `--experimental-vm-modules` 플래그 추가)
- `codebase/backend/src/repo-guards/__tests__/esm-native-load.spec.ts` (신규 가드 테스트)
- `codebase/backend/test/jest-e2e.json` (`transformIgnorePatterns` 를 기본값으로)
- `plan/in-progress/jest-esm-native-load.md`, `plan/in-progress/nestjs-v12-coordinated-upgrade.md`, `plan/in-progress/spec-draft-nullable-notation-followups.md` (plan 문서)
- `review/code/2026/09/24/14_24_10/**`, `review/code/2026/09/24/15_26_17/**`, `review/consistency/2026/09/24/12_57_36/**`, `review/consistency/2026/09/24/13_55_20/**` (선행 리뷰/consistency-check 산출물)

## 매칭 검토

매트릭스 21행의 trigger 글롭·의미 조건을 각 변경 파일에 대조했다.

- **new-node** (`codebase/backend/src/nodes/**`) — 매칭 없음. 신규 테스트 파일은 `codebase/backend/src/repo-guards/__tests__/` 아래에 있으며 `src/nodes/` 트리와 무관하다.
- **node-schema-change** — 동일 이유로 매칭 없음.
- **new-ui-string** (`codebase/frontend/src/**/*.tsx`) — frontend 변경 자체가 이번 changeset 에 없음. 매칭 없음.
- **new-widget-chrome-string** (`codebase/channel-web-chat/src/**/*.tsx`) — 매칭 없음.
- **integration-provider-change** — 신규/변경 provider 코드 없음. 매칭 없음.
- **new-userguide-section-dir** (`codebase/frontend/src/content/docs/*/`) — 매칭 없음.
- **backend-api-change** (`*.controller.ts`, `dto/**`) — 매칭 없음.
- **new-bullmq-queue** (`system-status.constants.ts`) — 매칭 없음.
- **new-warning-code / new-error-code** (`error-codes.ts`) — 매칭 없음. `error-codes.ts` 자체는 이번 diff 에 없다.
- **new-cross-cutting-enum / new-backend-ui-zod-value / new-handler-output-field** — 해당 코드 패턴(신규 enum, ui.label/hint, output.result.* 키) 변경 없음.
- **auth-session-flow-change** (`codebase/backend/src/modules/auth/**`) — 매칭 없음. `src/repo-guards/` 는 `src/modules/auth/` 와 다른 트리이며, 인증·권한·세션 로직을 건드리지 않았다(순수 jest 설정 가드).
- **auth-config-type-enum-change** — 매칭 없음.
- **expression-language-change** (`codebase/packages/expression-engine/**`) — 매칭 없음.
- **run-debug-flow-change** — backend 실행 엔진·디버그 로깅 변경 없음(jest 테스트 러너 설정일 뿐, 애플리케이션 실행 엔진이 아니다). 매칭 없음.
- **env-runtime-change** ("환경 변수·기동 방법·런타임 변경 — 제품 최종 상태") — 애플리케이션 런타임(제품이 프로덕션에서 기동되는 방식)은 변경되지 않았다. `--experimental-vm-modules` 는 jest 테스트 실행 스크립트에만 추가됐고 `main.ts`/Dockerfile/기동 커맨드는 미변경. README.md 갱신 대상 아님.
- **spec-major-change** (`spec/2-*/**` 등) — `spec/` 변경 없음. 매칭 없음.
- **userguide-gui-flow-section** — `codebase/frontend/src/content/docs/{02-nodes,06-integrations-and-config}/**.mdx` 변경 없음.
- **spec-defect-found** — 해당 사항 없음.

`review/code/**`, `review/consistency/**` 산출물과 `plan/in-progress/**.md` 는 매트릭스의 target(동반 갱신 위치)에 해당하는 파일 형식이 아니며, 그 자체가 trigger 글롭에도 해당하지 않는다(리뷰/plan 산출물이지 `codebase/`·`spec/` 실체 변경이 아님).

## 발견사항

없음.

## 요약

매트릭스 21행 중 이번 변경 파일 셋(backend jest 설정 3개 + 신규 backend 테스트 1개 + PROJECT.md 정책 각주 + plan/review 문서 다수)과 glob/semantic 매칭되는 trigger 는 0건이다. 변경 전체가 backend Jest 테스트 러너의 ESM 네이티브 로딩 전환(`transformIgnorePatterns` 원복 + `--experimental-vm-modules` 플래그 도입)과 그에 대한 가드 테스트·plan·선행 리뷰 산출물에 국한되며, 노드/스키마/UI 문자열/통합·제공자/신규 섹션 디렉토리/인증·세션 흐름/표현식 언어/실행·디버깅 흐름/신규 warning·error 코드 어느 trigger 조건도 건드리지 않았다. 유저 가이드(docs MDX)·i18n dict·`backend-labels.ts` 동반 갱신 의무가 발생하지 않는다.

## 위험도

NONE
