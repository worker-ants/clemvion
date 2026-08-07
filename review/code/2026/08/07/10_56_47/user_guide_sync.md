# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 검토 절차 요약

`.claude/config/doc-sync-matrix.json` 의 `rows[]` (총 20개 trigger 행)을 Read 하여 SSOT 로 적재. 변경 대상 파일 4건:

- `codebase/backend/package.json` — `undici` 버전 스펙 상향 (^6.21.3 → ^6.28.0)
- `pnpm-lock.yaml` — 위 변경 + 보안 override 반영에 따른 lockfile 재생성 (undici/hono/fast-uri/js-yaml/socket.io-parser/nanoid/postcss 등)
- `pnpm-workspace.yaml` — `overrides` 보안 핀 상향 (fast-uri, hono, socket.io-parser 신규 override 추가, undici/js-yaml 범위 조정) + 주석 보강
- `scripts/check-pnpm-security-config.py` — 위 override 변경에 맞춘 `EXPECTED_OVERRIDES` baseline 동기 갱신 (2-place 가드 규약 준수)

## 매칭 판정

매트릭스 20개 행의 trigger 를 각각 대조:

- `new-node` / `node-schema-change` — glob `codebase/backend/src/nodes/**`: 변경 파일 중 `codebase/backend/src/nodes/` 하위 파일 없음. 불일치.
- `new-ui-string` / `new-widget-chrome-string` — `*.tsx` glob: 대상 없음. 불일치.
- `integration-provider-change` / `new-userguide-section-dir` / `userguide-gui-flow-section` — `codebase/frontend/src/content/docs/**`: 대상 없음. 불일치.
- `backend-api-change` — `*.controller.ts` / `dto/**`: 대상 없음. 불일치.
- `new-bullmq-queue` — `system-status.constants.ts`: 대상 없음. 불일치.
- `new-warning-code` / `new-error-code` / `new-cross-cutting-enum` / `new-backend-ui-zod-value` / `new-handler-output-field` — 모두 backend 도메인 로직(warningRules, error-codes.ts, zod ui 스키마, handler output) 변경을 대상으로 하는 semantic 행. 이번 변경은 npm 패키지 버전 스펙과 pnpm 보안 override 설정뿐이며 도메인 로직·enum·필드 변경이 전혀 없음. 불일치.
- `auth-session-flow-change` / `auth-config-type-enum-change` — `codebase/backend/src/modules/auth/**` 등: 대상 없음. 불일치.
- `expression-language-change` — `codebase/packages/expression-engine/**`: 대상 없음. 불일치.
- `run-debug-flow-change` — 실행·디버깅 흐름(backend 실행 엔진): 대상 없음. 불일치.
- `env-runtime-change` — "환경 변수·기동 방법·런타임 변경 (제품 최종 상태)": undici 는 backend 의 HTTP client 런타임 의존성이지만, 이는 patch/minor 버전 범위 내 보안 패치 상향(`^6.21.3`→`^6.28.0`, 즉 semver-compatible)이며 기동 방법·환경 변수·제품 동작을 바꾸지 않는 순수 dependency pin 갱신이다. README.md 가 다루는 "제품 최종 상태"(설치·기동 절차)에 영향 없음. 불일치.
- `spec-major-change` — `spec/2-*` 등: 대상 없음. 불일치.
- `spec-defect-found` — 해당 없음.

## 발견사항

없음. 이번 diff 는 `codebase/backend/package.json` 의 `undici` 버전 스펙 상향과, 그에 따른 `pnpm-lock.yaml` 재생성, `pnpm-workspace.yaml` 보안 override 갱신, `scripts/check-pnpm-security-config.py` baseline 동기화로 구성된 순수 의존성/보안 패치 세트다. 노드 신규 추가, 노드 schema 변경, TSX 신규 문자열, 통합 provider 변경, 신규 섹션 디렉토리, 인증·세션 흐름 변경, 표현식 언어 변경, 실행·디버깅 흐름 변경, 신규 warningCode/errorCode 발행 등 매트릭스의 어떤 trigger 에도 매칭되지 않는다. 오히려 `scripts/check-pnpm-security-config.py` ↔ `pnpm-workspace.yaml` 2-place 동기 규약(이 리포 자체의 별도 가드)은 diff 안에서 정확히 함께 갱신되어 있어 자체 정합성도 이상 없다.

## 요약

매트릭스 20개 trigger 전건을 대조했으며 매칭된 trigger 는 0건이다(변경 파일 4건 모두 backend/root 의 패키지 버전 스펙·pnpm lockfile·보안 override 설정·baseline 가드 스크립트로, 노드/docs/i18n/auth/표현식엔진/실행엔진 등 유저 가이드 동반 갱신 영역과 무관). 누락 0건.

## 위험도

NONE
