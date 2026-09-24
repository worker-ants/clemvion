# API 계약(API Contract) 리뷰

## 발견사항

없음.

## 요약

이번 변경 세트(PROJECT.md, `codebase/backend/jest.config.ts`, `codebase/backend/package.json`
scripts, `codebase/backend/src/repo-guards/__tests__/esm-native-load.spec.ts`,
`codebase/backend/test/jest-e2e.json`, `plan/in-progress/jest-esm-native-load.md`,
`plan/in-progress/nestjs-v12-coordinated-upgrade.md`,
`plan/in-progress/spec-draft-nullable-notation-followups.md`, 그리고 이전 라운드
`review/code/**`·`review/consistency/**` 산출물)을 전수 대조한 결과, 컨트롤러·DTO·라우트·미들웨어·
인증/인가 가드·응답 스키마 등 API 엔드포인트를 구성하는 코드는 전혀 포함되어 있지 않다. 실질 코드
변경은 backend Jest 테스트 러너의 모듈 로딩 방식을 손으로 유지하던 `transformIgnorePatterns`
ESM 허용목록에서 `node --experimental-vm-modules` 기반 네이티브 ESM 로드로 전환하는 순수
테스트/CI 인프라 설정뿐이고, 나머지는 plan 문서와 이전 리뷰 라운드 산출물이다.

`plan/in-progress/nestjs-v12-coordinated-upgrade.md` 는 후속 NestJS 12 동반 업그레이드 착수 시
`RolesGuard`/`@WorkspaceId()` reflection 기반 인가 가드의 fail-open 보안 회귀를 반드시 검증하라는
선행 조건(§C)을 스텁으로 기록해 둔 것으로, 인증/인가라는 API 계약 관점과 맞닿아 있긴 하지만 **이번
diff 범위 밖의 후속 작업 계획**이다 — 이번 PR 자체가 그 업그레이드를 수행하지 않으므로 현재 diff 의
API 계약 평가에는 영향이 없다. 이 점은 동일 changeset 을 검토한 앞선 두 라운드
(`review/code/2026/09/24/15_26_17/api_contract.md`, `review/code/2026/09/24/16_02_28/api_contract.md`)
의 결론과도 일치한다.

따라서 하위 호환성·버전 관리·응답 형식·에러 응답·요청 검증·URL/경로 설계·페이지네이션·인증/인가
어느 관점으로도 검토할 API 계약 코드가 이번 diff 에 존재하지 않는다.

## 위험도

NONE
