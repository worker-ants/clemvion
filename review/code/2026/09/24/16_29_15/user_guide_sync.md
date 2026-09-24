# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 검토 방법

1. `.claude/config/doc-sync-matrix.json` (SSOT, `rows[]` 24개 trigger) 를 Read.
2. 변경 파일 목록을 `git diff --name-only origin/main...HEAD` 로 확보 (아래 8개 코드/plan 파일 + review 산출물):
   - `PROJECT.md`
   - `codebase/backend/jest.config.ts`
   - `codebase/backend/package.json`
   - `codebase/backend/src/repo-guards/__tests__/esm-native-load.spec.ts`
   - `codebase/backend/test/jest-e2e.json`
   - `plan/in-progress/jest-esm-native-load.md`
   - `plan/in-progress/nestjs-v12-coordinated-upgrade.md`
   - `plan/in-progress/spec-draft-nullable-notation-followups.md`
   - `review/code/2026/09/24/{14_24_10,15_26_17,16_02_28}/**`, `review/consistency/2026/09/24/{12_57_36,13_55_20}/**` (리뷰 산출물, 대상 외)
3. 각 파일을 매트릭스 24개 행의 `trigger.globs` / semantic 의미와 대조.

## 매칭 결과

- `codebase/backend/src/nodes/**` (new-node / node-schema-change) — 매칭 파일 없음. `esm-native-load.spec.ts` 는 `src/repo-guards/__tests__/` 이지 `src/nodes/**` 가 아님.
- `codebase/frontend/src/**/*.tsx` (new-ui-string) — frontend 변경 없음. 매칭 없음.
- `codebase/channel-web-chat/src/**/*.tsx` (new-widget-chrome-string) — 매칭 없음.
- `codebase/backend/src/modules/auth/**` (auth-session-flow-change) — 매칭 없음. 인증·세션 코드 미변경.
- `codebase/packages/expression-engine/**` (expression-language-change) — 매칭 없음.
- `codebase/backend/src/nodes/core/error-codes.ts` (new-error-code) / warningRules semantic (new-warning-code) — 매칭 없음. 신규 ErrorCode/WarningCode 발행 없음.
- `codebase/backend/src/modules/system-status/system-status.constants.ts` (new-bullmq-queue) — 매칭 없음.
- `codebase/backend/src/**/*.controller.ts`, `dto/**` (backend-api-change) — 매칭 없음.
- `codebase/frontend/src/content/docs/*/` (new-userguide-section-dir) — 매칭 없음.
- `spec/2-*/**` ~ `spec/conventions/**` (spec-major-change) — 매칭 없음. `spec/` 디렉토리 변경 자체가 없음(`spec_impact: none` 으로 plan frontmatter 에도 명시됨).
- "실행·디버깅 흐름 변경"(run-debug-flow-change, semantic) — 이 항목은 backend **실행 엔진**(워크플로 실행·노드 실행·디버그 로깅)의 사용자 가시 흐름을 가리킨다. 이번 변경은 Jest 테스트 러너의 ESM 로딩 메커니즘(`--experimental-vm-modules`, `transformIgnorePatterns`)과 `npm test` 스크립트 뿐이며, 제품 런타임의 실행·디버깅 흐름과 무관하다 — CI/개발자 도구 레이어. 매칭 안 됨.
- "환경 변수·기동 방법·런타임 변경 (제품 최종 상태)"(env-runtime-change, semantic, target: README.md) — 이 항목은 **제품**(서버 프로세스)의 기동 방법·필수 환경 변수를 가리킨다. `package.json` 의 `test`/`test:watch`/`test:cov`/`test:debug`/`test:e2e` 스크립트 변경은 개발자가 로컬/CI 에서 테스트를 돌리는 방법이지, 제품이 사용자에게 노출하는 기동 방법이 아니다(예: `npm run start:prod` 류는 미변경). README.md 갱신 대상으로 보기엔 무리 — 그레이존이지만 "제품 최종 상태" 라는 한정어에 해당하지 않는다고 판단.
- "spec 자체에 누락·오류가 있다고 판단됨"(spec-defect-found) — `plan/in-progress/jest-esm-native-load.md` §C(로컬 재검증 결과) 는 코드/도구 defect 이지 spec defect 가 아님. 미매칭.

## 발견사항

없음.

## 요약

이번 변경 set (`PROJECT.md` 버전·도구 정책 문단, `codebase/backend/jest.config.ts`, `codebase/backend/package.json` 테스트 스크립트, `codebase/backend/test/jest-e2e.json`, `codebase/backend/src/repo-guards/__tests__/esm-native-load.spec.ts`, 관련 plan 문서)는 Jest 를 `--experimental-vm-modules` 로 띄워 ESM-only 패키지(`@nestjs/typeorm@12` 등)를 네이티브로 로드하게 하는 **backend 테스트 하니스/CI 인프라 변경**이다. doc-sync-matrix.json 의 24개 trigger 행을 전수 대조한 결과 어떤 행에도 매칭되지 않는다 — 노드 코드, frontend TSX/docs, i18n dict, backend-labels, auth 모듈, expression-engine, warningRules/error-codes, BullMQ 큐 상수, controller/DTO, spec/ 문서 중 어느 것도 이 변경 set 에 포함되지 않는다. 유저 가이드 동반 갱신 관점에서는 검토 대상 자체가 아니다("해당 없음").

## 위험도

NONE
