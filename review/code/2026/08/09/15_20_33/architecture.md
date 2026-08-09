# 아키텍처(Architecture) 리뷰

## 검토 범위

`auth-guard-reflection-hardening` PR 최종 상태(origin/main 대비 누적 diff)를 대상으로 했다.
핵심 프로덕션 코드(`app.module.ts`, `main.ts`, `workspace-reflection-canary.ts`(신설),
`common/utils/uuid.ts`, `common/utils/workspace-context.util.ts`)와 이를 소비하는
`common/guards/roles.guard.ts`·`common/decorators/workspace.decorator.ts`(diff 밖이지만
설계 판단을 위해 직접 열람)를 전문 대조했다. 동봉된 이전 라운드(`review/code/.../14_36_39/**`,
`review/consistency/.../14_01_15,15_09_04/**`) 산출물은 자동 생성 리포트/plan 문서이며
실행 코드가 아니므로 구조 평가 대상에서 제외했다(내용은 참고했음).

이전 라운드(`14_36_39`) 아키텍처 리뷰가 이미 이 코드베이스를 LOW 로 판정했고, 이번 라운드에서
프로덕션 로직(`workspace-context.util.ts`, `workspace-reflection-canary.ts`, `uuid.ts`,
`app.module.ts`, `main.ts`)은 그 사이 변경되지 않았다(RESOLUTION.md 기준 수정은 전부
테스트/문서). 아래는 독립적으로 재검증한 결과이며, 이전 라운드와 결론이 대체로 수렴한다.

## 발견사항

- **[INFO]** `resolveRequestWorkspaceContext` 가 순수 계산 함수에서 "계산 + HTTP 프로토콜 검증(throw)" 로 책임이 확장됨
  - 위치: `codebase/backend/src/common/utils/workspace-context.util.ts:74-79` (신설 `if (headerWorkspaceId && !isUuidShaped(...))` 블록)
  - 상세: `common/utils/` 계층의 헬퍼가 NestJS `BadRequestException` 타입과 `VALIDATION_ERROR` 에러 코드를 직접 안다. "워크스페이스 컨텍스트 계산"(비즈니스 로직)과 "HTTP 응답 형태 결정"(프레젠테이션/프로토콜 관심사)이 한 함수에 섞였다. 같은 파일 JSDoc(gate 58-60)이 "소비처가 둘(가드·데코레이터)인데 반환 플래그로 두면 drift 가 재발한다"는 근거를 명시적으로 남기고 있어 의도된 트레이드오프이며, `extractWorkspaceId`(`workspace.decorator.ts`)도 동일 패턴(util 성격 함수가 `BadRequestException` 을 던짐)이라 저장소 관례와 일관적이다.
  - 제안: 현재 규모(검증 규칙 1개)에서는 수용 가능. 향후 검증 규칙이 늘어나면(예: 워크스페이스 존재 여부, 포맷 외 추가 제약) "컨텍스트 리졸버"와 "요청 검증기" 책임을 분리하는 리팩터를 재고할 것 — 지금 결합을 정당화하는 근거(drift 방지)가 그때도 여전히 성립하는지 재확인.

- **[INFO]** 부팅 시 구조 불변식 검사 모듈이 `common/decorators/` 아래 위치 — 카테고리 불일치
  - 위치: `codebase/backend/src/common/decorators/workspace-reflection-canary.ts` (파일 전체, 신설)
  - 상세: 이 파일은 `@Decorator()` 구현이 아니라 "부팅 시 1회 실행되는 fail-closed 캐너리"다. `common/config/production-guards.ts`(`assertProductionConfig`)와 개념적으로 같은 층위("부팅 시 구조/설정 불변식 검증")이면서 물리적으로 다른 디렉터리에 있다. `handlerConsumesWorkspaceId`(`workspace.decorator.ts`)를 그대로 재사용해야 하므로 인접 배치 자체는 근거가 있고(코드 주석에도 명시, gate 32-38), blocking 은 아니다.
  - 제안: `common/config/`(production-guards 와 동거) 또는 신설 `common/bootstrap/` 으로 이동 후 `decorators/` 에는 필요시 re-export 만 남기는 방식도 고려할 만함.

- **[INFO]** `countWorkspaceIdConsumingRoutes` 가 `handlerConsumesWorkspaceId` 를 직접 import 로 고정 — OCP 관점에서 확장 시 전체 파일 복제 필요
  - 위치: `codebase/backend/src/common/decorators/workspace-reflection-canary.ts:66-84` (`countWorkspaceIdConsumingRoutes`)
  - 상세: `MetadataScanner` 접근(`methodNamesOf`)은 함수 인자로 주입받아 프레임워크 결합을 잘 끊었지만(좋은 설계, 아래 참고), 판별 술어(`handlerConsumesWorkspaceId`)는 여전히 하드 import 다. 향후 다른 파라미터 데코레이터(조직/프로젝트 스코프 등)에 동일한 "reflection 깨지면 fail-closed" 패턴이 필요해지면 이 파일 전체를 복제해야 한다.
  - 제안: 지금은 소비처가 1곳뿐이라 YAGNI 로 넘길 수준. 두 번째 소비처가 생기면 `predicate: (cls, handler) => boolean` 을 주입받는 형태로 일반화 검토.

- **[INFO]** 캐너리는 reflection 메커니즘의 구조적 취약성(비공개 `ROUTE_ARGS_METADATA` + 함수-identity 비교)을 제거하지 않고 감시(circuit-breaker)만 추가
  - 위치: `codebase/backend/src/common/decorators/workspace-reflection-canary.ts:8-42` (모듈 상단 JSDoc, "왜 필요한가"/"`SetMetadata`+`Reflector` 로 옮기지 않은 이유" 섹션)
  - 상세: `handlerConsumesWorkspaceId`(diff 밖, `workspace.decorator.ts`)가 여전히 `@nestjs/common` 비공개 export 에 의존한다는 근본 결합은 이번 PR 로 바뀌지 않는다. 이번 PR 은 그 결합이 깨졌을 때 "조용히 새는 것"을 "배포 중단"으로 바꾸는 보정 통제(compensating control)를 추가한 것이며, 근본 원인(비공개 API 의존)을 공식 확장점(`SetMetadata`+`Reflector`)으로 대체하는 대안은 저장소가 이미 2회 실패한 "라우트별 opt-in 마커" 패턴으로 이어진다는 근거로 명시적으로 기각했다(`spec/data-flow/12-workspace.md` §Rationale 인용). 판단 자체는 근거가 충분하고 합리적이나, "이 PR 이 reflection 파손을 막는다"가 아니라 "reflection 파손의 폭발 반경을 fail-open→fail-closed 로 바꾼다"는 것이 정확한 서술이라는 점을 남겨 둔다.
  - 제안: 조치 불요 — 이미 문서화된 의도적 트레이드오프. `@nestjs/*` 업그레이드 시 이 경로가 최우선 조사 대상이라는 CHANGELOG 의 운영 지침이 이 잔여 리스크에 대한 실질적 완화책이다.

## 확인한 정합성 (문제 없음)

- 순환 의존 없음: `workspace-reflection-canary.ts → workspace.decorator.ts → workspace-context.util.ts → uuid.ts` 단방향. `app.module.ts`/`main.ts` 도 신규 모듈을 단방향으로만 참조.
- `countWorkspaceIdConsumingRoutes` 가 `MetadataScanner` 에 직접 의존하지 않고 `methodNamesOf: (prototype: object) => string[]` 를 인자로 주입받아, Nest DI 컨테이너 없이 순수 로직만 단위 테스트할 수 있게 분리(`workspace-reflection-canary.spec.ts`) — 프레임워크 결합 최소화.
- `DiscoveryModule` 추가(`app.module.ts:4-10`, `:79-82`)는 부팅 시 1회 소비 용도로 스코프가 명확히 문서화돼 있고, `APP_GUARD`/`APP_INTERCEPTOR` 등 런타임 요청 경로에는 등록되지 않아 런타임 결합도를 늘리지 않는다.
- 캐너리가 `handlerConsumesWorkspaceId` 를 재구현하지 않고 그대로 재사용(`workspace-reflection-canary.ts:62-64` 주석) — "테스트/검증 로직이 자기 복제본을 검사해 정작 막으려던 파손을 통과시키는" 안티패턴을 의도적으로 회피.
- `RolesGuard`/`WorkspaceId` 데코레이터가 `resolveRequestWorkspaceContext` 공용 헬퍼를 통해 동일 경로로 워크스페이스 컨텍스트를 계산 — 두 소비처가 각자 검증을 구현했다면 재발했을 drift 위험을 구조적으로 차단.
- 신규 400 throw 가 프로덕션에서 가장 먼저 통과하는 지점(전역 `APP_GUARD`, `roles.guard.ts`)까지 통합 테스트로 커버됨(`roles.guard.spec.ts` "형식이 깨진 X-Workspace-Id 는 가드에서 400 으로 전파된다" describe 블록) — util 단위 테스트만으로는 가드가 예외를 삼키거나 403 으로 뒤바꿀 가능성을 못 잡는다는 것을 실제로 인지하고 보강한 흔적.

## 요약

이번 PR 의 프로덕션 코드(부팅 캐너리, `isUuidShaped`, `resolveRequestWorkspaceContext` 검증 추가, `DiscoveryModule` 배선)는 이전 리뷰 라운드에서 검토된 상태 그대로이며 순환 의존·레이어 위반·SOLID 위반에 해당하는 구조적 결함은 없다. 캐너리는 프레임워크 결합을 최소화한 형태(주입 가능한 `methodNamesOf`)로 잘 분리돼 있고, 재사용(재구현 금지) 원칙도 지켜졌다. 남은 지적은 전부 INFO 수준으로 — util 레이어가 HTTP 예외를 직접 던지는 책임 확장(의도적·근거 있음), 모듈 배치 카테고리 불일치, 향후 확장 시 하드코딩된 판별 술어의 일반화 필요성, 그리고 캐너리 자체가 근본 취약성을 제거하기보다 감시망으로 보정한다는 정확한 성격 규정 — 이며 어느 것도 착수·머지를 막을 수준이 아니다.

## 위험도

LOW
