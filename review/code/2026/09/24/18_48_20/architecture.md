# 아키텍처(Architecture) 리뷰

## 검토 범위

이번 changeset(32개 파일)은 실제로는 세 종류로 나뉜다.

1. **실질 코드 변경** — `codebase/backend/package.json:44` 의 `"@nestjs/typeorm": "^11.0.3"` → `"^12.0.1"` **단 한 줄**, 그리고 그에 따른 `pnpm-lock.yaml` 재계산. `codebase/**` 안의 클래스·모듈·서비스·컨트롤러 등 실행 코드(`src/**`)는 **0줄** 변경됐다.
2. **plan 문서** — `PROJECT.md`(Node floor 보강 문단), `plan/in-progress/deps-typeorm12.md`(신규), `plan/in-progress/nestjs-v12-coordinated-upgrade.md`(갱신), `plan/in-progress/spec-draft-nullable-notation-followups.md`(후속 항목 추가).
3. **직전 리뷰 라운드 산출물의 커밋** — `review/code/2026/09/24/18_22_23/**`(RESOLUTION.md·SUMMARY.md·14개 reviewer.md·retry_state.json·meta.json) 및 `review/consistency/2026/09/24/17_31_27/**`(SUMMARY.md·5개 checker.md·meta.json·retry_state.json). 이들은 이 프로젝트의 `review/code/<날짜>/`, `review/consistency/<날짜>/` 보존 관례에 따라 커밋되는 read-only 문서 산출물이며, 그 자체가 아키텍처 판단 대상(설계·구조)을 담고 있지 않다.

SOLID·결합도/응집도·레이어 책임·디자인 패턴·순환 의존성·모듈 경계·확장성은 모두 클래스/모듈 **구조**에 대한 판단 기준인데, 이 changeset 에는 그 대상이 사실상 없다. 이하 발견사항은 유일하게 아키텍처적으로 언급할 가치가 있는 지점(부분 메이저 버전 범프)에 한정된다.

## 발견사항

- **[INFO]** `@nestjs/typeorm@12` 가 나머지 `@nestjs/*` 패키지군(11.x)과 다른 major 로 lockfile 에 고정되는 "부분 메이저 범프" 상태
  - 위치: `codebase/backend/package.json:44`(`"@nestjs/typeorm": "^12.0.1"`), `pnpm-lock.yaml`(`'@nestjs/typeorm@12.0.1'` 리졸루션 블록, `peerDependencies: '@nestjs/common': ^10.0.0 || ^11.0.0 || ^12.0.0`)
  - 상세: 동일 프레임워크 계열 내 major 버전 불일치는 통상 "암묵적 버전 가정에 의존하는 통합 지점이 서로 다른 세대의 API 계약을 기대할 수 있다"는 결합도 리스크 신호다. 다만 이 조합은 추정이 아니라 `plan/in-progress/deps-typeorm12.md` §A 가 패키지 단위로 실측한 peer range(`^10||^11||^12`)에 근거하며, 반대 사례(`@nestjs/platform-express@12` 는 `@nestjs/common@12` 를 강제해 실제 런타임 실패)까지 별도로 실측해 전면 범프를 보류한 근거로 삼았다. `@nestjs/typeorm` 자체는 `TypeOrmModule.forRoot/forFeature`·`@InjectRepository` 등 `@nestjs/common`/`@nestjs/core` 의 공개 DI 표면만 소비하는 얇은 통합 어댑터라, 결합 표면이 좁고 세대 차이가 실제 API 계약 불일치로 번질 가능성이 낮다는 판단도 근거가 있다.
  - 제안: 조치 불요. 다만 이 상태가 "임시"가 아니라 "상류(mailer·throttler 타이핑, `@nestjs/cli`/`schematics` 의 TS6 요구)가 풀릴 때까지 지속되는 상태"이므로, 그 세 재개 조건(`nestjs-v12-coordinated-upgrade.md` §3)이 실제 SoT 로 유지되는 한 추가 조치는 없다.

- **[INFO]** reflection 기반 인가 가드(`RolesGuard`/`@WorkspaceId()`)의 fail-open 회귀 검증이 코드화된 회귀 자산이 아니라 매 `@nestjs/*` 업그레이드 PR 마다 사람이 반복하는 수작업 절차로 plan 문서에만 남아 있다
  - 위치: `plan/in-progress/nestjs-v12-coordinated-upgrade.md`(§C "업그레이드 전 기준값" 절), `plan/in-progress/deps-typeorm12.md`(§C "검증" 절)
  - 상세: 이 자체는 이번 PR 이 만든 결합이 아니라 기존 아키텍처(Nest 비공개 API `ROUTE_ARGS_METADATA` 의존, 파손 방향이 fail-open)에 대한 회귀 게이트이며, "테스트 통과 = 안전"이 성립하지 않음을 뮤테이션으로 직접 확인한 검증 설계 자체는 건전하다. 다만 이 판별자(MB)가 `.claude/tests/` 나 backend 자체 스크립트로 영속화되지 않고 문서 서술(`cp` + 절대경로로 원복)로만 존재해, 다음 `@nestjs/*` 업그레이드 담당자가 그 절차 자체를 잊으면 재현되지 않을 여지가 있다. 이번 diff 자체를 막을 사유는 아니며, 직전 리뷰 라운드(`review/code/2026/09/24/18_22_23/RESOLUTION.md` INFO 4)에서 이미 같은 취지로 지적되고 "다음 `@nestjs/*` 업그레이드가 실제로 착수될 때 그 PR 에서 판단"으로 보류된 사안이라 재지적 수준 이상은 아니다.
  - 제안: 조치 불요(이미 추적 중). 코드화 여부는 다음 `@nestjs/*` 업그레이드 PR 의 스코프에서 판단.

## 요약

이번 changeset 은 아키텍처 판단 대상이 될 실행 코드를 사실상 포함하지 않는다 — `@nestjs/typeorm` 단일 패키지의 메이저 버전 범프(11→12) 한 줄과 그 근거·검증 절차를 기록한 plan 문서, lockfile 재계산, 그리고 직전 리뷰/consistency-check 라운드의 문서 산출물 커밋이 전부다. SOLID·결합도·레이어 분리·디자인 패턴·순환 의존성·모듈 경계 관점에서 지적할 코드 구조 변화가 없다. 유일하게 의미 있는 지점은 "`@nestjs/typeorm@12` 가 `@nestjs/common@11.x` 위에서 도는 부분 메이저 범프" 상태인데, 이는 peer range 실측과 반대 사례(`platform-express@12` 런타임 실패) 실측을 근거로 한 의도된 예외이며, 전면 업그레이드를 보류한 이유(mailer/throttler 타이핑, TS major)도 별도 plan 문서에 구체적으로 기록돼 있다. 기존 fail-open reflection 가드에 대한 회귀 검증이 수작업 절차로만 남아 있다는 점은 이미 추적 중인 INFO 수준 사안이다. 아키텍처 관점에서 이번 PR 을 막을 사유는 없다.

## 위험도

NONE
