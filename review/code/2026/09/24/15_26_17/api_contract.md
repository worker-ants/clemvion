# API 계약(API Contract) 리뷰

## 발견사항

없음.

## 요약

이번 변경 세트(총 39개 파일)는 (1) jest 를 `node --experimental-vm-modules` 로 실행하도록 바꾸고 `transformIgnorePatterns` 를 기본값(`/node_modules/`)으로 되돌려 ESM-only 의존성(`uuid`, `otplib`, 향후 `@nestjs/typeorm@12`)을 네이티브로 로드하게 하는 CI/테스트 인프라 변경(`codebase/backend/jest.config.ts`, `codebase/backend/package.json`, `codebase/backend/test/jest-e2e.json`), (2) 그 불변식을 고정하는 신규 가드 스펙(`esm-native-load.spec.ts`), (3) 관련 정책 문서(`PROJECT.md`) 갱신, (4) 후속 작업 plan 문서(`jest-esm-native-load.md`, `nestjs-v12-coordinated-upgrade.md`, `spec-draft-nullable-notation-followups.md`) 및 이전 라운드 코드 리뷰/일관성 검토 산출물(`review/code/**`, `review/consistency/**`)로 구성된다. 컨트롤러·DTO·라우트·미들웨어·API 응답 스키마·인증 가드 등 API 계약에 해당하는 코드는 이 diff 에 전혀 포함되어 있지 않다 — 순수하게 테스트 실행기(jest) 구성과 개발 프로세스 문서에 국한된 변경이다. 참고로 `nestjs-v12-coordinated-upgrade.md`(파일 7)는 향후 `@nestjs/*` v12 동반 업그레이드 시 `RolesGuard`/`@WorkspaceId()` 의 fail-open 보안 회귀를 반드시 검증하라는 선행 조건을 스텁으로 기록해 둔 것으로, 이 PR 자체가 그 업그레이드를 수행하는 것은 아니므로 현재 diff 의 API 계약 평가에는 영향이 없다(단, 해당 업그레이드가 실제 착수되는 시점에는 인증/인가 관점 재검토가 필요함을 인지해 둘 필요는 있다).

## 위험도

NONE
