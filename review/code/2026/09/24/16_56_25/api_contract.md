# API 계약(API Contract) 리뷰

## 검토 대상 요약

이번 diff 의 실제 코드 변경은 다음 3개 파일뿐이다.

- `codebase/backend/jest.config.ts` — `transformIgnorePatterns` 를 수작업 ESM 패키지
  허용목록에서 Jest 기본값(`['/node_modules/']`)으로 되돌림
- `codebase/backend/package.json` — `test`/`test:watch`/`test:cov`/`test:debug`/`test:e2e`
  npm script 에 `node --experimental-vm-modules` 플래그 추가
- `codebase/backend/test/jest-e2e.json` — 동일하게 `transformIgnorePatterns` 를 기본값으로 되돌림

추가로 `codebase/backend/src/repo-guards/__tests__/esm-native-load.spec.ts` (신규 테스트
스펙), `PROJECT.md`(정책 문서 각주 보강), `plan/in-progress/*.md`(계획 문서),
`review/code/**`·`review/consistency/**`(이전 라운드 리뷰 산출물)가 포함되어 있으나 전부
문서·plan·리뷰 아티팩트이거나 테스트 러너 자체의 단위 테스트다.

컨트롤러, DTO, 라우트 핸들러, 미들웨어, 가드, 인터셉터, OpenAPI/Swagger 스키마 등 HTTP API
표면을 구성하는 코드는 이번 diff 에 전혀 포함되어 있지 않다. 변경 범위는 Jest 테스트
러너가 ESM 의존성을 로드하는 방식(CJS 트랜스파일 vs Node 네이티브 ESM)에 한정된다.

## 발견사항

없음. 하위 호환성·버전 관리·응답 형식·에러 응답·요청 검증·URL/경로 설계·페이지네이션·
인증/인가 등 API 계약 관점의 8개 점검 항목 모두 해당 코드가 diff 에 존재하지 않아 평가
대상이 없다.

참고로 `plan/in-progress/nestjs-v12-coordinated-upgrade.md` 는 이 PR 이 아니라 **후속
작업**으로 `@nestjs/typeorm@12`·`@nestjs/platform-express@12` 등 NestJS 12 동반
업그레이드를 계획하고 있음을 명시하며, §C 에서 `RolesGuard`/`@WorkspaceId()` 의
fail-open 인가 회귀 위험을 착수 시 반드시 검증하도록 체크리스트를 이미 걸어 두었다. 이는
향후 인가(authorization) 계약에 영향을 줄 수 있는 잠재 지점이지만, 이번 PR 자체는 계획
문서만 추가했을 뿐 해당 업그레이드를 수행하지 않았으므로 현재 diff 범위에서는 조치할
API 계약 이슈가 없다.

## 뮤테이션 검증

저장소 파일을 고쳐서 재현해야 할 가설이 없어 뮤테이션을 수행하지 않았다. `git status
--short` 로 저장소 트리에 부수 효과가 없음을 확인했다(있는 그대로: 세션 시작 시점의
`review/code/2026/09/24/16_56_25/` untracked 항목만 존재, 본 리뷰의 산출물 작성 제외 그
외 변경 없음).

## 요약

이번 변경은 백엔드 Jest 테스트 러너가 ESM 전용 패키지(`uuid`, `otplib` 등, 향후
`@nestjs/typeorm@12` 의 `import.meta.url`)를 네이티브로 로드하도록 `--experimental-vm-modules`
플래그와 `transformIgnorePatterns` 기본값 복귀를 도입한 CI/테스트 인프라 변경이며, 동반된
`PROJECT.md` 정책 각주 보강·plan 문서·이전 리뷰 라운드 산출물 포함도 모두 비-런타임
문서/테스트 자산이다. HTTP 엔드포인트, 요청/응답 스키마, 라우팅, 페이지네이션, 인증/인가
로직 등 API 계약을 구성하는 어떤 코드도 수정되지 않았으므로 API 계약 관점에서 검토할
대상이 없다.

## 위험도

NONE
