# 아키텍처(Architecture) 리뷰

## 발견사항

- **[INFO]** 부팅 시 구조 불변식 검사 모듈이 `decorators/` 디렉터리에 위치
  - 위치: `codebase/backend/src/common/decorators/workspace-reflection-canary.ts` (파일 전체)
  - 상세: `workspace-reflection-canary.ts` 는 데코레이터가 아니라 "부팅 시 1회 실행되는 구조적 불변식 검증 + fail-closed 캐너리" 다. `common/decorators/` 는 실제 `@Decorator()` 구현(`workspace.decorator.ts`, `roles.guard.ts` 의 `@Roles`)이 모이는 자리인데, 이 파일은 그 카테고리에 속하지 않는다. `common/config/production-guards.ts`(`assertProductionConfig`) 와 개념적으로 같은 층위("부팅 시 fail-closed 검증")이면서도 물리적으로는 다른 디렉터리에 있어, 신규 합류자가 "부팅 검증은 어디 있나" 를 찾을 때 두 곳을 다 봐야 한다.
  - 제안: `handlerConsumesWorkspaceId` 를 그대로 재사용해야 하므로 `workspace.decorator.ts` 와의 인접성 자체는 합리적 근거(코드 주석에도 명시)이나, 디렉터리를 `common/config/`(production-guards 와 동거) 또는 신설 `common/bootstrap/` 으로 옮기고 `decorators/` 에는 re-export 만 남기는 방식도 고려할 만하다. blocking 은 아님.

- **[INFO]** `resolveRequestWorkspaceContext` 가 "순수 계산" 에서 "계산 + 프로토콜 검증(throw)" 으로 책임이 넓어짐
  - 위치: `codebase/backend/src/common/utils/workspace-context.util.ts:74-79`
  - 상세: 기존 JSDoc 표에서 "DB | **왕복 없음** (순수 함수)" 였던 문구가 이번 PR 에서 "DB | **왕복 없음**" 으로 수정되고(`workspace-context.util.ts:45` 인근), 실제로 `headerWorkspaceId` 형식이 깨지면 `BadRequestException` 을 던지도록 바뀌었다. `common/utils/` 아래의 헬퍼가 NestJS HTTP 예외 타입(`BadRequestException`)과 에러 코드(`VALIDATION_ERROR`)를 직접 알게 되어, "워크스페이스 컨텍스트 계산"(비즈니스 로직)과 "HTTP 응답 형태 결정"(프레젠테이션/프로토콜 관심사)이 한 함수에 섞였다.
  - 제안: 코드 주석이 이 결합을 의도적 트레이드오프로 명시하고 있다 — 소비처가 가드·데코레이터 둘이라 검증을 각자 기억하게 두면 drift 가 재발한다는 근거(이 헬퍼가 애초에 추출된 이유). `extractWorkspaceId`(`workspace.decorator.ts:37-42`)도 동일 패턴(util 성격 함수가 `BadRequestException` 을 던짐)이라 저장소 관례와 일관적이다. 현재로선 수용 가능한 설계 결정이나, 검증 규칙이 더 늘어나면(예: 워크스페이스 존재 여부, rate limit 등) 이 함수가 "컨텍스트 리졸버" 인지 "요청 검증기" 인지 경계가 계속 흐려질 수 있어 후속 확장 시 재고 대상으로 남겨 둘 만하다.

- **[INFO]** `uuid.ts` 에 목적이 다른 두 정규식이 나란히 유지됨
  - 위치: `codebase/backend/src/common/utils/uuid.ts:9-10`(`UUID_PATTERN`), `codebase/backend/src/common/utils/uuid.ts:35-36`(`UUID_SHAPE_PATTERN`)
  - 상세: `isValidUuid`(RFC v1–v5 + variant 엄격 검증)와 `isUuidShaped`(canonical 8-4-4-4-12 hex 형태만 검증, Postgres 파싱 가능 여부 기준)가 거의 동일한 정규식을 병렬 유지한다. 두 술어의 의미 차이는 JSDoc 으로 잘 문서화돼 있고 테스트(`uuid.spec.ts`)로 경계가 고정돼 있어 실질 결함은 아니다.
  - 제안: 현재는 두 패턴이라 문제 없으나, 세 번째 변형(예: 하이픈-없는 형태 허용)이 추가될 경우를 대비해 공통 8-4-4-4-12 shape 을 베이스로 하고 버전/variant 체크를 별도 단계로 분리하는 리팩터를 검토할 여지를 남겨 둔다.

- **[INFO]** `@WorkspaceId()` 전용으로 하드코딩된 캐너리 — 향후 유사 데코레이터에 재사용 불가
  - 위치: `codebase/backend/src/common/decorators/workspace-reflection-canary.ts:66-84`(`countWorkspaceIdConsumingRoutes`), `:91-116`(`assertWorkspaceIdReflectionWorks`)
  - 상세: 카운팅 로직 자체는 `handlerConsumesWorkspaceId` 를 파라미터가 아니라 import 로 고정 참조한다. 향후 다른 파라미터 데코레이터(예: 조직/프로젝트 스코프)에 동일한 "reflection 이 깨지면 fail-closed" 패턴이 필요해지면 이 파일 전체를 복제해야 한다.
  - 제안: 지금은 YAGNI 로 넘길 수준(현재 소비처가 1곳)이나, 두 번째 소비처가 생기면 `predicate: (cls, handler) => boolean` 을 주입받는 형태로 일반화하는 것을 고려.

## 잘 설계된 지점 (참고용, 감점 아님)

- `countWorkspaceIdConsumingRoutes` 가 `MetadataScanner` 에 직접 의존하지 않고 `methodNamesOf: (prototype: object) => string[]` 를 함수 인자로 주입받아, Nest DI 컨테이너 없이도(`workspace-reflection-canary.spec.ts`) 순수 로직을 단위 테스트할 수 있게 분리했다 — 프레임워크 결합을 최소화한 좋은 경계.
- 캐너리가 `handlerConsumesWorkspaceId` 를 **재구현하지 않고 그대로 재사용**한다는 점을 주석으로 명시(`workspace-reflection-canary.ts:62-64`) — "테스트가 자기 복제본을 검사해 정작 막으려던 파손을 통과시키는" 안티패턴을 의도적으로 회피했다.
- `DiscoveryModule` 을 `app.module.ts:81` 의 imports 에 추가하면서 "부팅 시에만 쓰고 런타임 요청 경로에는 관여하지 않는다" 는 스코프를 주석으로 못박아, 전역 모듈 추가가 런타임 결합도를 늘리지 않는다는 것을 명시했다.
- `WorkspaceIdReflectionBrokenError` 메시지에 원인 후보·영향 범위·다음에 볼 파일을 모두 담아, 부팅 실패 시 로그 한 줄만으로 운영자가 진입점을 찾을 수 있게 했다 — 예외 설계가 관측성(observability)까지 고려한 좋은 예.
- `handlerConsumesWorkspaceId` 를 함수 identity 비교(`ROUTE_ARGS_METADATA` + `Reflect.getMetadata`)로 구현한 것은 NestJS 비공개 API 에 의존하는 구조적 리스크이나, 이는 이번 diff 이전(선행 PR `#1103`)부터 존재하던 설계이고 이번 PR 의 역할은 그 리스크에 대한 fail-closed 안전망(캐너리)을 추가하는 것이다. 캐너리는 "전 건수가 0" 인 전면 파손만 잡고 부분 파손은 못 잡는다는 한계를 스스로 문서화(`workspace-reflection-canary.ts:29-30`)하고 있어, 보장 범위를 과장하지 않는다.
- 순환 의존 없음: `workspace-reflection-canary.ts → workspace.decorator.ts → workspace-context.util.ts → uuid.ts` 단방향. `app.module.ts`/`main.ts` 도 새 모듈을 단방향으로만 참조.

## 요약

이번 PR 은 선행 리뷰(architecture/side_effect/performance/dependency/api_contract 5명)가 지적한 사항을 정확히 그 근거대로 구현했고, 부팅 캐너리·400 검증·공용 헬퍼 추출 각각의 설계 결정(왜 `SetMetadata`+`Reflector` 를 안 썼는지, 왜 `assertProductionConfig` 와 합치지 않았는지, 왜 `isValidUuid` 대신 `isUuidShaped` 인지)을 코드 주석과 plan 문서에 대칭적으로 남겨 rationale 이 흩어지지 않는다. 순환 의존·레이어 위반·SOLID 위반에 해당하는 구조적 결함은 발견되지 않았으며, 캐너리 로직은 프레임워크 결합을 최소화한 형태로 잘 분리돼 있다. 남은 지적은 전부 INFO 수준(모듈 배치·책임 경계의 미세한 흐려짐·향후 확장 시 일반화 여지)으로, 지금 당장 재작업을 요구하지 않는다.

## 위험도

LOW
