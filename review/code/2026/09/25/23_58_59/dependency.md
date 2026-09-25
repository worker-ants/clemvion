# 의존성(Dependency) 리뷰

## 발견사항

- **[INFO]** 외부 패키지 추가·변경 없음 — 이 diff 는 순수 내부 리팩터링/기능 확장
  - 위치: 전체 diff (26개 파일, `codebase/backend/**`, `codebase/frontend/src/content/docs/**`)
  - 상세: 26개 변경 파일 중 `package.json`/`package-lock.json`/`pnpm-lock.yaml` 은 하나도 포함되지 않았다. diff 전체에서 새로 추가된 `import ... from '<패키지명>'` 을 전수 검사했으며(`zod`, `@nestjs/common`, `@nestjs/common/constants`, `pg`, `supertest`, `@jest/globals`, `reflect-metadata`), 모두 `codebase/backend/package.json` 에 기존 등록된 의존성을 재사용한 것이다(`pg: ^8.23.0`, `zod: ^4.3.6`, `supertest: ^7.0.0`, `@jest/globals: ^30.0.0`, `reflect-metadata: ^0.2.2`, `@nestjs/common: ^11.0.1`). 그 외 새 import 는 전부 상대경로(`./`, `../`) 내부 모듈이다.
  - 제안: 없음 — 신규 의존성·버전 고정·라이선스·취약점·번들 크기 관점에서 조치할 항목이 없다.

- **[INFO]** 내부 의존성: 새 공유 모듈 `integration-visibility.ts` 가 2개 모듈·4개 소비자에 걸쳐 참조됨
  - 위치: `codebase/backend/src/modules/integrations/integration-visibility.ts` (신규 파일), 소비처 — `codebase/backend/src/modules/integrations/integrations.service.ts`, `codebase/backend/src/modules/integrations/integration-oauth.service.ts`, `codebase/backend/src/modules/integrations/integrations.controller.ts`, `codebase/backend/src/modules/workflow-assistant/tools/explore-tools.service.ts`
  - 상세: 가시성/변경-가능 판정 순수 함수(`isIntegrationVisibleTo`, `integrationVisibilityClause`, `integrationNotFoundError`, `assertOrgScopeModifiable` 등)를 별도 파일로 추출해 `IntegrationsService`(요청 경로)와 `IntegrationOAuthService`(콜백 커밋 직전 재판정)가 동일 로직·동일 응답을 공유하도록 했다 — 파일 자체 주석에 "두 서비스는 서로를 주입하지 못한다(순환 방지)" 는 근거가 명시돼 있다. `workflow-assistant` 모듈(`explore-tools.service.ts`)도 이 파일을 상대경로로 직접 import 하는데, 이는 NestJS DI 를 거치지 않는 순수 함수 import 라 모듈 간 순환 의존(circular module import) 위험은 없다. 다만 두 모듈에 걸친 4개 소비자가 파일 하나의 경로에 직접 결합돼 있어, 이 파일을 이동/이름 변경하면 4곳을 동시에 고쳐야 한다.
  - 제안: 현재로선 정당한 단일 진실 추출이라 조치 불필요. 향후 이 파일이 더 커지면 `integrations` 모듈의 공개 export(index/barrel)로 승격해 소비처가 내부 파일 경로 대신 모듈 공개 API 를 참조하게 하는 것을 고려할 수 있다.

- **[INFO]** 내부 의존성 추가: `IntegrationOAuthService` → `WorkspacesService` (신규 생성자 주입, `@Optional()`)
  - 위치: `codebase/backend/src/modules/integrations/integration-oauth.service.ts` (생성자 파라미터 `workspacesService?: WorkspacesService`, 메서드 `assertRequesterStillAllowed`)
  - 상세: 재인증/scope 추가 콜백이 커밋 직전 요청자 역할을 재조회하기 위해 `WorkspacesService.getMemberRole` 을 호출한다. `WorkspacesModule` 은 이미 `@Global()` 이고 `WorkspacesService` 를 export 하며, `IntegrationsModule` 이 이미 `WorkspacesModule` 을 import 하고 있고(`integrations.service.ts` 도 이미 `WorkspacesService` 를 주입 중) — 새 순환 의존이나 모듈 wiring 누락 없이 기존 패턴을 그대로 재사용한 것으로 확인했다. `@Optional()` 은 수동 생성 테스트 호환용이며, 값이 없을 때는 `role = null` 로 처리해 Organization 통합 재판정을 거부(fail-closed) 하도록 설계돼 있다.
  - 제안: 없음 — DI 배선·fail-closed 기본값 모두 확인됨.

## 요약

이번 변경(26개 파일, 대부분 `codebase/backend/src/modules/integrations/**` 와 `workflow-assistant/tools/**`, 일부 e2e·docs)은 개인(personal) 통합 가시성 규칙을 여러 서비스에 걸쳐 일관되게 적용하기 위한 순수 내부 리팩터링/기능 확장이며, `package.json`·lock 파일 변경이 전혀 없다. diff 에서 새로 등장한 모든 import 문을 전수 대조한 결과 신규 외부 패키지는 하나도 없고, 전부 프로젝트에 이미 고정 버전으로 등록된 기존 의존성(zod, pg, supertest, @jest/globals, reflect-metadata, @nestjs/common)을 재사용했다. 따라서 버전 고정·라이선스·취약점·번들 크기·빌드 시간 관점에서 조치할 항목이 없다. 유일하게 의존성 관점에서 볼 만한 변화는 내부 모듈 결합도 증가로, 신규 공유 파일 `integration-visibility.ts` 를 두 모듈(4개 소비자)이 공유하는 것과 `IntegrationOAuthService` 가 `WorkspacesService` 를 새로 주입받는 것인데, 둘 다 기존 모듈 wiring(전역 모듈, 순환 회피 의도)을 정확히 재사용하고 있어 위험이 낮다.

## 위험도
NONE
