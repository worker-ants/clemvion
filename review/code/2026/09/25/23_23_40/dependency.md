# 의존성(Dependency) 리뷰 — integration-personal-owner

## 발견사항

- **[INFO]** 새 외부 패키지 추가 없음
  - 위치: 변경 파일 전체 (`codebase/backend/**`, `codebase/frontend/**`) — `package.json` 미변경
  - 상세: `git diff` 에 `package.json`/`pnpm-lock.yaml` 변경이 없음을 확인했다. 이번 변경은 전부 내부 모듈(personal/organization 통합 가시성 판정, precheck `userId` 스레딩)이며, 사용된 외부 패키지(`p-limit`, `pg`, `supertest`, `@jest/globals`, `zod`)는 모두 `codebase/backend/package.json` 에 기존 고정 버전(`p-limit@^7.3.2`, `pg@^8.23.0`, `supertest@^7.0.0`, `@jest/globals@^30.0.0`, `zod@^4.3.6`)으로 이미 선언되어 있던 의존성이다. 새 버전 고정·라이선스·취약점 검토 대상이 없다.
  - 제안: 해당 없음 (참고용 INFO)

- **[INFO]** `assistant-finish-guard.service.spec.ts` 의 `zod` import 는 기존 의존성의 새 API 표면 사용
  - 위치: `codebase/backend/src/modules/workflow-assistant/tools/assistant-finish-guard.service.spec.ts` (게이트 1행 `+import { z } from 'zod';`)
  - 상세: 테스트 전용 신규 import 로, `z.object(...).meta({...})` 를 사용한다. `zod` 는 이미 `^4.3.6` 로 고정되어 있고 `.meta()` 는 zod v4 API 이므로 버전 호환 문제는 없다. 프로덕션 코드가 아니라 번들 크기 영향도 없다.
  - 제안: 해당 없음

- **[INFO]** `IntegrationOAuthService` → `WorkspacesService` 내부 의존성 추가는 기존 모듈 배선으로 이미 해소됨
  - 위치: `codebase/backend/src/modules/integrations/integration-oauth.service.ts` (게이트 25행 `+import { WorkspacesService } from '../workspaces/workspaces.service';`, 생성자의 `@Optional() private readonly workspacesService?: WorkspacesService`)
  - 상세: `integrations.module.ts` 는 이미 `WorkspacesModule` 을 `imports` 에 포함하고 있고(`WorkspacesModule` 은 `@Global()` + `exports: [WorkspacesService, ...]`), `WorkspacesModule` 은 `IntegrationsModule` 을 참조하지 않아 순환 의존성 위험이 없다. 즉 이 추가는 새 모듈 간 엣지가 아니라 이미 연결된 모듈 경계 안에서 클래스 수준 의존이 하나 늘어난 것뿐이다(같은 패턴이 `IntegrationsService.resolveRole` 에 이미 존재). 다만 `@Optional()` 로 표시돼 있어, DI 배선이 깨져도 부팅 실패 대신 조용히 fail-closed(403) 로 동작한다 — 주석에 "manual construction 호환" 목적이라고 명시돼 있고 `integrations.module.ts` 프로덕션 배선 자체는 정상이므로 이번 변경 자체의 결함은 아니다. 참고로만 기재한다(설계/보안 관점 리뷰어의 영역과 겹칠 수 있음).
  - 제안: 해당 없음 — 내부 의존성 그래프상 문제 없음을 확인차 기록

- **[INFO]** 새 공유 모듈 `integration-visibility.ts` — 내부 의존성 집중화(양호)
  - 위치: `codebase/backend/src/modules/integrations/integration-visibility.ts` (신규 파일, 전체)
  - 상세: `isIntegrationVisibleTo` / `integrationVisibilityClause` 두 함수를 한 파일에 두어 `integrations.service.ts`, `integration-oauth.service.ts`, `integrations.controller.owner.spec.ts`, `integrations.service.spec.ts` 가 이를 import 한다. TS/SQL 두 표현이 한 곳에서 파생되므로 판정 로직이 여러 파일에 중복되어 drift 하는 것을 막는 구조다 — 내부 의존성 관점에서 바람직한 방향(단일 진실 지점).
  - 제안: 해당 없음 (긍정적 관찰)

- **[INFO]** `workflow-assistant` → `integrations` 모듈 간 직접 참조는 기존 패턴 확장일 뿐, 새 결합이 아님
  - 위치: `codebase/backend/src/modules/workflow-assistant/tools/candidate-lookup.service.ts` (게이트 2행 `import { IntegrationsService } from '../../integrations/integrations.service';` — 변경 전부터 존재, diff 의 `+` 대상 아님)
  - 상세: `CandidateLookupService` 는 이전부터 `IntegrationsService`, `ListIntegrationsQueryDto`, `MCP_CAPABLE_SERVICE_TYPES` 를 상대 경로로 직접 import 해 왔다. 이번 변경은 `findAll(workspaceId, userId, query)` 시그니처에 `userId` 매개변수를 스레딩하는 것뿐이라 모듈 간 결합도가 늘지 않았다.
  - 제안: 해당 없음

## 요약
이번 변경 세트(개인/조직 통합 가시성 판정 + precheck 요청자 인가 재검증)는 외부 패키지를 전혀 추가하지 않았고 `package.json`/lockfile 도 건드리지 않아, 새 의존성·버전 고정·라이선스·취약점·번들 크기 항목에서는 검토할 대상이 없다. 유일하게 의존성 그래프가 변하는 지점은 `IntegrationOAuthService` 가 `WorkspacesService` 를 새로 주입받는 부분인데, 두 모듈은 이미 `IntegrationsModule` → `WorkspacesModule`(전역) 관계로 연결되어 있어 순환 의존성이나 배선 누락 위험이 없음을 확인했다. 신설된 `integration-visibility.ts` 는 오히려 여러 파일에 흩어질 수 있었던 판정 로직을 한 곳으로 모아 내부 의존성을 정리하는 방향으로, 부정적 소견이 없다.

## 위험도
NONE
