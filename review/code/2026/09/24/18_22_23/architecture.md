# 아키텍처(Architecture) 리뷰

## 발견사항

- **[INFO]** 이번 변경 전체가 애플리케이션 소스 코드를 포함하지 않는다 — `codebase/backend/package.json` 의 의존성 버전 한 줄, `pnpm-lock.yaml` 재계산, 두 개의 `plan/in-progress/*.md` 문서, `review/consistency/2026/09/24/17_31_27/**` 산출물뿐이다.
  - 위치: `codebase/backend/package.json:44` (`"@nestjs/typeorm": "^11.0.3"` → `"@nestjs/typeorm": "^12.0.1"`)
  - 상세: SOLID·결합도/응집도·레이어 책임·디자인 패턴·순환 의존성·모듈 경계는 모두 실행 코드(클래스·모듈·서비스)의 구조에 대한 판단 기준인데, 이 diff 는 그 대상을 갖고 있지 않다. 해당 관점들에서는 판단할 코드 표면 자체가 없다.
  - 제안: 해당 없음 (스코프 확인 목적의 기록).

- **[INFO]** `@nestjs/typeorm@12.0.1` 이 나머지 `@nestjs/*` 패키지군(11.x)과 다른 major 버전으로 공존하는 "부분 메이저 범프" 상태가 lockfile 에 고정된다.
  - 위치: `pnpm-lock.yaml:94-96` (`specifier: ^12.0.1`, `version: 12.0.1(@nestjs/common@11.1.27...)...`), 대응 근거는 `plan/in-progress/deps-typeorm12.md` §A 표 (peer `^10.0.0 || ^11.0.0 || ^12.0.0`).
  - 상세: 아키텍처 관점에서 "동일 프레임워크 계열 내 major 버전 불일치"는 통상 결합도 리스크 신호(암묵적 버전 가정에 의존하는 통합 지점이 서로 다른 세대의 API 계약을 가정할 수 있음)로 플래그할 만하다. 다만 이 저장소는 이를 추측이 아니라 **패키지별 peer range 실측**으로 검증했고(`^10||^11||^12`), `platform-express@12` 는 반대로 런타임에서 실제로 깨졌음(`ERR_MODULE_NOT_FOUND`)을 별도로 실측해 전면 범프를 보류하는 근거로 삼았다. 즉 이 특정 조합은 무근거 추정이 아니라 실측 기반의 의도된 예외이며, `@nestjs/typeorm` 모듈 자체가 `@nestjs/common`/`@nestjs/core` 의 public API(DI 데코레이터·모듈 등록 표면)만 사용하는 통합 어댑터라는 점에서 결합 표면이 좁다.
  - 제안: 조치 불요. 다만 이 조합이 "임시" 가 아니라 "상류가 나머지 세 벽을 풀 때까지 지속되는 상태"이므로, `nestjs-v12-coordinated-upgrade.md` §3 재개 조건이 실제 SoT 로 유지되는지(중복 문서로 갈라지지 않는지)는 plan lifecycle 관례가 이미 커버한다.

- **[INFO]** 부트 캐너리(`[WorkspaceIdReflection]` 소비 라우트 수)와 판별자 뮤테이션(`handlerConsumesWorkspaceId` 항상 false)이라는 이중 검증 구조는, `RolesGuard`/`@WorkspaceId()` 가 Nest 비공개 API(`ROUTE_ARGS_METADATA`)에 의존하는 기존 아키텍처적 취약점(fail-open 파손 방향)에 대한 회귀 게이트로 기능한다.
  - 위치: `plan/in-progress/nestjs-v12-coordinated-upgrade.md` §C "업그레이드 전 기준값" (`106`~`129` 행, 새 파일 기준 라인), `plan/in-progress/deps-typeorm12.md` §C (`36`~`55` 행)
  - 상세: 이 자체는 이번 PR 이 만든 결합이 아니라 기존 설계(비공개 API 의존)에 대한 "실측 기반 회귀 검증"이며, 파손 방향이 fail-open 이라 "테스트 통과 = 안전" 이 성립하지 않는다는 것을 뮤테이션으로 직접 확인한 점은 건전한 검증 설계다. `@nestjs/typeorm` 만 올리는 이번 diff 는 그 경로와 무관하지만, 전/후 비교값이 동일함을 실측해 "무관해 보인다"는 추정에 기대지 않았다.
  - 제안: 조치 불요. 향후 `@nestjs/core`/`@nestjs/common` 자체를 올리는 PR(동반 업그레이드)에서는 이 게이트가 실제로 다시 요구되므로, 그 시점에 plan 이 이 섹션을 재사용/갱신하도록 두면 된다(이미 그렇게 설계돼 있음).

## 요약

이번 변경은 아키텍처 판단 대상이 될 실행 코드를 포함하지 않는다 — `@nestjs/typeorm` 단일 패키지의 메이저 버전 범프(11→12)와 그 근거를 기록한 plan 문서 두 건, lockfile 재계산, consistency-check 산출물이 전부다. SOLID/결합도/레이어 분리/디자인 패턴/순환 의존성/모듈 경계 같은 관점은 클래스·모듈 구조에 적용되는데 이 diff 에는 그런 표면이 없으므로 해당 관점에서 지적할 결함이 없다. 유일하게 아키텍처적으로 의미 있는 지점은 "`@nestjs/typeorm@12` 가 `@nestjs/common@11.x` 위에서 도는 부분 메이저 범프" 상태인데, 이는 peer range 실측(`^10||^11||^12`)과 반대 사례(`platform-express@12` 의 런타임 실패) 실측을 근거로 의도적으로 선택된 예외이며 전면 업그레이드를 보류한 이유(mailer/throttler 타이핑, TS major)도 별도 plan 문서에 구체적으로 실측·기록돼 있다. 기존 취약점(Nest 비공개 API 의존, fail-open reflection 가드)에 대한 회귀 검증도 이번 범프와 무관함을 뮤테이션 테스트로 확인했다. 아키텍처 관점에서 우려할 사항 없음.

## 위험도

NONE
