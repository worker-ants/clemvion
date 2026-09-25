# 부작용(Side Effect) 리뷰

## 발견사항

- **[INFO]** Admin 거부 에러 코드가 `FORBIDDEN` → `ADMIN_REQUIRED` 로 바뀐다(공개 API 계약 변경)
  - 위치: `codebase/backend/src/modules/integrations/integration-visibility.ts` 의 `adminRequiredError()`(신규 파일 전체 컨텍스트 게이트 81~88행) — 호출부는 `codebase/backend/src/modules/integrations/integrations.service.ts` `assertCanModify`/`updateScope`
  - 상세: 기존 4자리(생성·rotate·scope 추가·범위 전환)의 거부 코드가 `FORBIDDEN` 에서 `ADMIN_REQUIRED` 로 승격되고, 신규 4자리(이름 변경·삭제·재인증·oauth/begin 재판정)도 같은 코드를 쓴다. `error.code` 로 분기하는 외부 API 클라이언트가 있다면 깨질 수 있는 응답 계약 변화다.
  - 검증: `grep -rn "'FORBIDDEN'" codebase/frontend/src --include='*.ts' --include='*.tsx'` 결과 0건 — 자사 frontend 는 이 코드로 분기하지 않는다. `CHANGELOG.md` Unreleased 최상단 항목이 이 변화와 외부 호출자 리스크를 이미 명시적으로 고지하고 있다("`error.code` 로 분기하는 외부 API 호출자가 있다면 확인할 것"). 숨은 부작용이 아니라 **공개된, 의도된** 인터페이스 변경.
  - 제안: 추가 조치 불필요 — 이미 CHANGELOG 로 고지됨. 확인 목적의 기록.

- **[INFO]** 다수 공개 메서드 시그니처에 `userId`/`userRole` 파라미터가 추가·삽입됨(시그니처 변경)
  - 위치: `codebase/backend/src/modules/integrations/integration-oauth.service.ts` `precheckCafe24Mall`/`precheckMakeshopShop`(신규 3번째 인자 `userId`), `codebase/backend/src/modules/integrations/integrations.service.ts` `findAll`/`findById`/`getUsages`/`getActivity`/`testConnection`/`update`/`remove`/`reauthorize`, `codebase/backend/src/modules/workflow-assistant/tools/candidate-lookup.service.ts` `fillCandidates`(2번째 위치에 삽입), `codebase/backend/src/modules/workflow-assistant/tools/explore-tools.service.ts` `listIntegrations`(2번째 위치에 삽입), `codebase/backend/src/modules/workspaces/workspaces.service.ts` `getMemberRole`(3번째 선택 인자 `manager?` 추가)
  - 상세: `findAll`·`fillCandidates`·`listIntegrations` 는 새 인자를 **중간 위치**에 삽입해 위치 인자 호출자가 있었다면 조용히 깨질 위험이 있는 형태다(타입이 다르므로 TS 컴파일이 잡아주긴 한다).
  - 검증: 저장소 전체(`codebase/backend/src` 전수, `.spec.ts` 제외)에서 이 메서드들의 모든 호출부를 grep 했고, diff 에 포함된 컨트롤러·서비스·spec 외의 호출부는 0건이었다 — 즉 변경된 모든 시그니처가 해당 diff 안에서 일관되게 갱신됐다. `getMemberRole` 의 신규 3번째 인자는 optional 로 끝에 붙어 있어 기존 8곳의 2-인자 호출부(`roles.guard.ts`, `auth.service.ts`, `jwt.strategy.ts`, `workspaces.service.ts` 내부 5곳)는 그대로 동작한다.
  - 제안: 없음 — 컴파일 타임에 의해 보증되는 안전한 변경으로 판단.

- **[INFO]** `IntegrationOAuthService` 생성자에 `@Optional() workspacesService?: WorkspacesService` 신규 의존성 주입
  - 위치: `codebase/backend/src/modules/integrations/integration-oauth.service.ts` 생성자(게이트 392~399행 부근)
  - 상세: `WorkspacesModule` 은 `@Global()` 모듈이고 `IntegrationsModule` 이 이미 이를 import 하고 있어(`codebase/backend/src/modules/integrations/integrations.module.ts`) DI 순환·해석 실패 위험은 없음을 확인했다. `@Optional()` 덕분에 수동 `new IntegrationOAuthService(...)` 로 생성하는 기존/신규 테스트도 인자를 생략하면 `undefined` 로 fail-closed 동작(주석·신규 테스트 `역할을 조회할 수 없으면 … fail-closed` 로 커버).
  - 제안: 없음.

- **[INFO]** `.save(entity)` → `.repository.update(criteria, partial)` 전환이 컬럼 트랜스포머·라이프사이클을 우회하지 않는지 확인
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts` `update()`/`remove()`/`updateScope()`/`reauthorize()` 의 non-OAuth 분기(judgedRow 사용 지점들)
  - 상세: `Integration` 엔티티에 `encryptedJsonTransformer` 컬럼 트랜스포머가 있으나(`credentials` 등), 이번에 `.update()` 로 바뀐 호출들은 트랜스폼 대상 컬럼(`credentials`)을 건드리지 않고 `name`/`scope`/`status`/`statusReason`/`lastError` 만 쓴다. `@EventSubscriber` 는 이 엔티티에 걸려 있지 않음을 저장소 전수 grep 으로 확인했고, `updatedAt` 은 `@UpdateDateColumn` 이라 QueryBuilder 기반 `update()` 에서도 TypeORM 이 자동 갱신한다(주석 "updated_at 은 DB 가 정한다" 와 일치). 라이프사이클 훅 우회로 인한 부작용은 없다고 판단.
  - 제안: 없음 — 확인 목적의 기록.

- **[INFO]** `IntegrationsService.findAll` 의 SQL 가시성 필터 추가가 배경 작업 경로에 새지 않음
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts` `findAll()`
  - 상세: `IntegrationExpiryScannerService`·`IntegrationActionRequiredNotifier` 등 같은 모듈의 백그라운드 서비스가 `IntegrationsService.findAll` 을 호출하는지 확인했으나 0건 — 이들은 리포지토리를 직접 쿼리해 개인(personal) 가시성 필터가 배경 작업(만료 스캔·재인증 알림)에 실수로 적용되는 일은 없다.
  - 제안: 없음.

## 요약

`codebase/**` 27개 파일(백엔드 서비스·컨트롤러·DTO·spec·e2e 신규 + 프론트 문서 4개) 전체를 검토했다. 이 PR 은 이미 3라운드 리뷰(Critical 2건·Warning 다수)를 거쳐 락 안 역할 재조회, 트랜잭션 커넥션 재사용, compare-and-set 쓰기 등 동시성·부작용 관련 결함이 선행 처리된 상태였다. 이번 4라운드 side-effect 관점 재검토에서는 새 Critical/Warning 을 발견하지 못했다 — 시그니처가 바뀐 모든 공개 메서드(`precheckCafe24Mall`/`precheckMakeshopShop`/`findAll`/`findById`/`getUsages`/`getActivity`/`testConnection`/`update`/`remove`/`reauthorize`/`fillCandidates`/`listIntegrations`/`getMemberRole`/`evaluateReviewGuard`)에 대해 저장소 전수 grep 으로 호출부 누락이 없음을 직접 확인했고, `WorkspacesModule` DI 배선·컬럼 트랜스포머·엔티티 라이프사이클·배경 작업 경로에 대한 우회/누수도 없었다. 유일하게 관측되는 외부 영향(에러 코드 `FORBIDDEN`→`ADMIN_REQUIRED` 승격)은 CHANGELOG 에 이미 명시적으로 고지되어 있고 자사 frontend 는 그 코드로 분기하지 않음을 확인했다. 저장소 파일은 읽기 전용으로만 조사했으며(`git status --short` 로 뮤테이션 없음을 확인), 뮤테이션 테스트는 수행하지 않았다.

## 위험도

LOW
