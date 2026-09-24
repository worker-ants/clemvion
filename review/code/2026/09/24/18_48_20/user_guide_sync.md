# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 매트릭스 적재
`.claude/config/doc-sync-matrix.json` 의 `rows[]` (21개 trigger 행) + `PROJECT.md` §변경 유형 → 갱신 위치 매핑 본문을 보조로 확인함.

## 변경 파일 전체 목록 (32개, `git diff --name-only HEAD` 로도 무변경 확인 — 이미 커밋됨)
1. `PROJECT.md` — Node 지원 floor 문단에 `@nestjs/typeorm@12` ESM/`require(esm)` 결속 각주 추가
2. `codebase/backend/package.json` — `@nestjs/typeorm`: `^11.0.3` → `^12.0.1` (devDependency 버전 범프 1줄)
3. `plan/in-progress/deps-typeorm12.md` — 신규 plan 파일
4. `plan/in-progress/nestjs-v12-coordinated-upgrade.md` — 기존 plan 갱신 (보류 사유 기록)
5. `plan/in-progress/spec-draft-nullable-notation-followups.md` — 백로그 항목 추가 (lockfile `libc:` 진동)
6. `pnpm-lock.yaml` — typeorm 관련 lockfile 항목 갱신
7–24. `review/code/2026/09/24/18_22_23/*` — 직전 라운드 코드리뷰 산출물 (RESOLUTION/SUMMARY/각 reviewer .md/meta.json/_retry_state.json)
25–32. `review/consistency/2026/09/24/17_31_27/*` — impl-prep consistency-check 산출물

## 매칭 판정

매트릭스 21개 trigger 행을 위 파일 목록과 대조:

- `new-node` / `node-schema-change` (`codebase/backend/src/nodes/**`) — **불일치**. `codebase/backend/` 하위 변경은 `package.json` 1줄뿐이고 `src/nodes/**` 는 손대지 않음.
- `new-ui-string` / `new-widget-chrome-string` (`codebase/frontend/**/*.tsx`, `codebase/channel-web-chat/**/*.tsx`) — **불일치**. frontend·channel-web-chat 코드 변경 없음.
- `integration-provider-change`, `new-userguide-section-dir` (`codebase/frontend/src/content/docs/*/`) — **불일치**. docs 디렉토리 변경 없음.
- `backend-api-change` (`*.controller.ts`, `dto/**`) — **불일치**.
- `new-bullmq-queue` (`system-status.constants.ts`) — **불일치**.
- `new-warning-code` / `new-error-code` (`error-codes.ts`, warningRules) — **불일치**. 에러/경고 코드 관련 파일 미변경.
- `new-cross-cutting-enum`, `new-backend-ui-zod-value`, `new-handler-output-field` — **불일치**. 해당 코드 경로 미변경.
- `auth-session-flow-change` (`codebase/backend/src/modules/auth/**`) — **불일치**. auth 모듈 미변경.
- `auth-config-type-enum-change` — **불일치**.
- `expression-language-change` (`codebase/packages/expression-engine/**`) — **불일치**. `codebase/packages/**` 변경 없음.
- `run-debug-flow-change` — **불일치**. 실행 엔진·디버그 로깅 변경 없음 (변경은 의존성 버전 범프뿐).
- `env-runtime-change` (target: `README.md`) — **회색 지대이나 불일치로 판단**. `PROJECT.md` 에 추가된 문단은 "`@nestjs/typeorm@12` 가 ESM-only 라 Node floor 를 낮출 때 조용히 깨진다"는 **내부 엔지니어링 결속 각주**다. 이번 PR 은 Node 지원 floor 값 자체(`>=24`)를 바꾸지 않았고 기존 기동 방법·환경 변수·README 상 사용자 대면 런타임 설명도 바꾸지 않았다 — 기존 각주 문장에 조건부 설명을 덧붙인 것뿐이라 "런타임 변경(제품 최종 상태)" trigger 로 보기 어렵다.
- `spec-major-change` (`spec/2-*/**` ~ `spec/5-*/**`, `spec/conventions/**`) — **불일치**. `spec/` 하위 파일 변경 없음 (plan 본문에 "이 PR 은 `spec/` 을 건드리지 않는다"고 명시).
- `userguide-gui-flow-section` (`docs/02-nodes/**.mdx`, `docs/06-integrations-and-config/**.mdx`) — **불일치**.
- `spec-defect-found` — 해당 없음.

## 결론

이번 변경 set 은 `@nestjs/typeorm` devDependency 를 `^11.0.3` → `^12.0.1` 로 올리는 **순수 의존성 버전 범프**(lockfile 동반)와, 그 판단 과정·되돌린 시도·후속 사항을 기록한 `plan/**` 문서, 그리고 직전 리뷰/consistency-check 라운드의 산출물(`review/**`)로만 구성된다. `codebase/backend/src/nodes/**`, `codebase/frontend/**`, `codebase/backend/src/modules/auth/**`, `codebase/packages/expression-engine/**`, `spec/**`, node 스키마·에러코드·경고코드·API 컨트롤러/DTO 등 doc-sync-matrix 의 21개 trigger 어느 것도 이 변경 set 안에서 매칭되는 파일이 없다. 따라서 유저 가이드(docs MDX)·i18n dict·backend-labels 동반 갱신 의무가 발생하지 않으며, 누락으로 볼 항목도 없다.

## 발견사항
없음 — 매칭된 trigger 0건.

## 요약
매트릭스 trigger 21개 중 이번 변경 set(package.json 1줄 typeorm 버전 범프 + lockfile + plan 문서 + 직전 리뷰/consistency 산출물)에 매칭되는 항목은 0건이다. `codebase/backend/src/nodes/**`, frontend, auth, expression-engine, spec/** 등 매트릭스가 감시하는 모든 경로가 이번 변경에 포함되지 않아 유저 가이드 동반 갱신 관점에서 지적할 누락이 없다. "해당 없음"으로 판정한다.

## 위험도
NONE
