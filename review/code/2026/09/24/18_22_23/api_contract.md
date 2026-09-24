# API 계약(API Contract) 리뷰

## 발견사항

해당 없음.

이번 변경은 `codebase/backend/package.json` 의 `@nestjs/typeorm` 버전 캐럿을 `^11.0.3` →
`^12.0.1` 로 올리는 의존성 범프 한 줄과, 그에 따른 `pnpm-lock.yaml` 재계산, 그리고
plan 문서(`plan/in-progress/deps-typeorm12.md`, `plan/in-progress/nestjs-v12-coordinated-upgrade.md`)
및 consistency-check 산출물(`review/consistency/2026/09/24/17_31_27/*`)로 구성된다. 컨트롤러·
DTO·라우트·가드·에러 필터 등 실제 HTTP API 표면을 이루는 코드는 diff 에 전혀 포함되어
있지 않다.

- `@nestjs/typeorm@12.0.1` 은 `@nestjs/common`/`@nestjs/core` 의 `^10 || ^11 || ^12` 를 peer 로
  허용하며, 이 저장소는 그 두 패키지를 11 계열(`11.1.27`)에 고정한 채로 둔다(plan 문서 §A,
  `package.json` 나머지 `@nestjs/*` 항목 확인). 즉 Nest 애플리케이션 레이어(컨트롤러 라우팅,
  파이프, 가드, 인터셉터, exception filter)는 변경되지 않으므로 응답 형식·에러 응답·인증/인가
  경로에 영향을 줄 표면이 없다.
- `@nestjs/typeorm` 패키지 자체는 `TypeOrmModule.forRoot`/`forFeature`, `@InjectRepository`
  등 DI/모듈 배선 유틸리티만 제공하며 HTTP 계층 API 계약(URL, 페이지네이션, 버전 관리)과는
  직접 접점이 없다. 이번 범위(diff)에 그런 배선 코드의 실제 변경(옵션 인자 변경 등)도
  포함되어 있지 않다 — 순수 `package.json`/lockfile 갱신뿐이다.
- consistency-check 산출물(`review/consistency/2026/09/24/17_31_27/SUMMARY.md`)이 이미
  독립적으로 짚은 `17-agent-memory.md` 의 `/api` prefix 표기 누락(WARNING #1)은 spec 문서
  표기 문제이며, 이번 PR 의 코드 변경(`@nestjs/typeorm` 범프)과 인과관계가 없다 — 이 PR 이
  새로 유발하거나 악화시킨 API 계약 이슈가 아니므로 본 리뷰에서 별도로 다시 지적하지 않는다.

## 요약

이번 diff 는 `@nestjs/typeorm` 의존성 버전만 올리는 순수 인프라/빌드 변경으로, 라우트·DTO·
응답 스키마·에러 포맷·페이지네이션·인증/인가 등 API 계약을 구성하는 어떤 코드도 건드리지
않는다. peer dependency 실측(`^10 || ^11 || ^12`, common/core 는 11 유지)도 plan 문서에
근거와 함께 기록되어 있어 HTTP 계층에 파급될 가능성도 낮다. API 계약 관점에서는 리뷰할
대상이 없다.

## 위험도

NONE
