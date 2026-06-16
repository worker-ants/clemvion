# 유저 가이드 동반 갱신(User Guide Sync) 리뷰 결과

## 발견사항

변경 파일을 매트릭스 rows[] 전체에 매칭한 결과, 실질적 동반 갱신 누락은 없음.

### 매칭된 트리거 분석

**auth-session-flow-change** (trigger glob: `codebase/backend/src/modules/auth/**`)

- 매칭 파일: `codebase/backend/src/modules/auth/totp.service.ts`, `codebase/backend/src/modules/auth/totp.service.spec.ts`, `codebase/backend/src/modules/auth/auth.service.spec.ts`
- 타겟: `codebase/frontend/src/content/docs/07-workspace-and-team/` 관련 페이지 + e2e
- 판정: **동반 갱신 불필요** — 이번 변경은 otplib v12 → v13 라이브러리 마이그레이션으로 내부 API 교체(`authenticator` 객체 → `generateSecret / generateURI / verifySync` 함수 API)에 해당. 사용자 가시 동작(6자리 TOTP 코드 등록·검증 흐름, 복구 코드 10개 발급·소비, QR 코드 URI 형식)은 변경 없음. `/Volumes/project/private/clemvion/codebase/frontend/src/content/docs/07-workspace-and-team/security-2fa.mdx` 및 `.en.mdx` 는 사용자 흐름 기준으로 이미 정확하게 문서화되어 있고, 이번 PR 로 stale 해진 내용이 없음.

**env-runtime-change** (semantic trigger: 런타임·버전 변경)

- 매칭 파일: `README.md`, `codebase/backend/package.json`, `codebase/backend/package-lock.json`, `codebase/channel-web-chat/package-lock.json`
- 타겟: `README.md`
- 판정: **동반 갱신 완료** — `README.md` 가 동일 변경 set 에 포함됨. Node.js 요구사항 "20+" → "24+ (내부 개발·빌드 기준 — 운영 node:24·CI 와 정렬. 외부 배포 SDK 소비는 Node 20+ 호환)" 으로 갱신됨.

### 비매칭 확인

- `codebase/backend/jest.config.ts`: 테스트 빌드 설정(ESM transformIgnorePatterns)만 변경 — 노드 스키마·i18n·docs 연관 없음. `new-node`, `node-schema-change` 트리거 미해당.
- `codebase/backend/src/common/config/production-guards.ts` / `.spec.ts`: 서명 포맷팅만 변경 — 동반 갱신 트리거 없음.
- `PROJECT.md` 에 추가된 "버전·도구 정책" 섹션: 내부 개발 정책 문서 — 유저 가이드 docs MDX 트리거 없음.
- `codebase/channel-web-chat/package-lock.json`: `@vitejs/plugin-react` v4→v6, `jsdom` v25→v29 등 devDep 업그레이드 — 사용자 가이드 연관 없음.

### 신규 errorCode / warningCode 검토

`totp.service.ts` 변경에서 `TOTP_INVALID` 에러 코드는 기존 코드이며 신규 추가가 아님. `backend-labels.ts` 추가 등록 대상 없음.

### i18n parity 검토

이번 변경에 신규 TSX 한국어 리터럴 추가 없음. i18n parity 문제 없음.

## 요약

매트릭스 rows 19개 전체 검토. 변경 파일이 매칭되는 트리거는 `auth-session-flow-change`(내부 라이브러리 마이그레이션, 사용자 동작 불변) 와 `env-runtime-change`(README 동반 갱신 완료) 2개이며, 동반 갱신 누락은 0건. 유저 가이드 동반 갱신 관점에서 이슈 없음.

## 위험도

NONE
