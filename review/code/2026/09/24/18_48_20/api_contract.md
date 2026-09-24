# API 계약(API Contract) 리뷰

## 발견사항

해당 없음.

이번 diff 는 `codebase/backend/package.json` 의 `@nestjs/typeorm` 버전을 `^11.0.3` →
`^12.0.1` 로 올리는 의존성 범프 한 줄, 그에 따른 `pnpm-lock.yaml` 재계산, 그리고
plan 문서(`plan/in-progress/deps-typeorm12.md`, `plan/in-progress/nestjs-v12-coordinated-upgrade.md`,
`plan/in-progress/spec-draft-nullable-notation-followups.md`)·`PROJECT.md`·이전 리뷰/consistency
라운드 산출물(`review/code/2026/09/24/18_22_23/**`, `review/consistency/2026/09/24/17_31_27/**`)로
구성된다. `git diff` 로 `codebase/backend/src` 하위를 직접 대조한 결과 실 변경 0줄 — 컨트롤러·
DTO·라우트·가드·인터셉터·exception filter 등 HTTP API 표면을 이루는 코드는 이번 변경에
전혀 포함되어 있지 않다.

- `@nestjs/typeorm@12.0.1` 의 peer 는 `@nestjs/common`/`@nestjs/core` 에 대해
  `^10.0.0 || ^11.0.0 || ^12.0.0` 을 허용하며, 이 저장소는 그 두 패키지를 11 계열
  (`11.1.27`)에 그대로 고정한다(plan `deps-typeorm12.md` §A, `nestjs-v12-coordinated-upgrade.md`
  §0 실측). 즉 Nest 애플리케이션 레이어(라우팅, 파이프, 가드, 인터셉터, exception filter)는
  변경되지 않으므로 응답 형식·에러 응답·인증/인가 경로·페이지네이션·URL 설계 어느 항목도
  영향받을 표면이 없다.
- `@nestjs/typeorm` 자체는 `TypeOrmModule.forRoot`/`forFeature`, `@InjectRepository` 등
  DI/모듈 배선 유틸리티만 제공하며 HTTP 계층 API 계약과 직접 접점이 없다. 이번 범위에
  그 배선 코드의 실제 사용처 변경(옵션 인자 등)도 포함되어 있지 않다 — 순수
  `package.json`/lockfile 갱신뿐이다.
- `@nestjs/typeorm@12` 가 ESM-only 라는 점은 `PROJECT.md`·plan 문서·이전 리뷰 라운드
  (WARNING #3)에서 이미 "Node 런타임 로드" 문제로 다뤄졌으나, 이는 API 계약이 아니라
  배포/툴체인 관점의 이슈이므로 본 관점에서는 판단 대상이 아니다.
- 이전 consistency-check(`review/consistency/2026/09/24/17_31_27/SUMMARY.md`)가 지적한
  `17-agent-memory.md` 의 `/api` prefix 표기 누락(있는 경우)은 spec 문서 표기 문제이며,
  이번 PR 의 코드 변경(`@nestjs/typeorm` 범프)과 인과관계가 없다 — 이 PR 이 새로 유발하거나
  악화시킨 API 계약 이슈가 아니므로 본 리뷰에서 별도로 지적하지 않는다.
- 리뷰/consistency 산출물 자체(`review/**/*.md`, `_retry_state.json`, `meta.json` 등)는
  워크플로 하네스 산출물로 API 계약 대상 코드가 아니다.

## 요약

이번 diff 는 `@nestjs/typeorm` 의존성 버전만 올리는 순수 인프라/빌드 변경(및 동반 plan/리뷰
문서)으로, 라우트·DTO·응답 스키마·에러 포맷·페이지네이션·인증/인가 등 API 계약을 구성하는
어떤 코드도 건드리지 않는다. `codebase/backend/src` 실 diff 0줄을 직접 확인했고, peer
dependency 실측(`^10 || ^11 || ^12`, common/core 는 11 유지)도 plan 문서에 근거와 함께
기록되어 있어 HTTP 계층에 파급될 가능성도 없다. API 계약 관점에서는 리뷰할 대상이 없다.

## 위험도

NONE
