# 의존성(Dependency) 리뷰

## 발견사항

- **[INFO]** 새 외부 패키지 추가 없음 — `package.json`/lockfile 변경 0건
  - 위치: 전역 (변경 파일 27개 전수 확인, `git diff origin/main...HEAD -- '**/package.json' 'pnpm-lock.yaml'` 결과 공백)
  - 상세: 이번 변경(Personal/Organization 통합 가시성 판정 도입 — `integration-visibility.ts` 신설, `precheck` 응답 마스킹, workflow-assistant 후보 조회에 `userId` 스코프 추가, e2e 신설)은 순수 내부 로직·DTO 설명·테스트·문서 변경이다. diff 전체에서 관측된 외부 import(`typeorm`, `@nestjs/common`, `zod`, `@jest/globals`, `pg`, `supertest`)는 모두 `codebase/backend/package.json` 에 이미 존재하는 기존 의존성이며 버전도 그대로다(예: `zod ^4.3.6` — 신설 테스트가 쓰는 `.meta()` API 는 zod v4 기능이라 호환).
  - 제안: 없음 — 정보성 확인.

- **[INFO]** 새 내부 모듈 간 결합 — `IntegrationOAuthService` → `WorkspacesService`
  - 위치: `codebase/backend/src/modules/integrations/integration-oauth.service.ts` (생성자 `workspacesService?: WorkspacesService` 주입, `assertRequesterStillAllowed`)
  - 상세: `IntegrationsModule` 은 기존에도 `WorkspacesModule` 을 이미 import 하고 있고(`integrations.module.ts`), `WorkspacesModule` 은 `@Global()` 로 `WorkspacesService` 를 export 하므로 이번 주입은 **새 모듈 wiring 을 요구하지 않는다**. 역방향 의존(`WorkspacesModule → IntegrationsModule`)은 존재하지 않아 순환 의존 위험 없음. `@Optional()` 로 주입해 수동 인스턴스화 테스트 호환성도 유지한다.
  - 제안: 없음 — 설계상 안전. 다만 `WorkspacesService.getMemberRole` 에 새 `manager?: EntityManager` 오버로드가 추가됐으므로(`workspaces.service.ts`), 두 서비스 간 계약이 늘었다는 점만 기록.

- **[INFO]** 새 내부 모듈 간 결합 — `workflow-assistant` → `integrations/integration-visibility`
  - 위치: `codebase/backend/src/modules/workflow-assistant/tools/explore-tools.service.ts`, `candidate-lookup.service.ts` (import `INTEGRATION_USER_PARAM`, `integrationVisibilityClause`, `isIntegrationVisibleTo` from `../../integrations/integration-visibility`)
  - 상세: `integration-visibility.ts` 는 `@nestjs/common`(예외 클래스)과 로컬 `workspace-roles` 상수만 참조하는 순수 함수 리프 모듈이며, `IntegrationsModule`/`IntegrationOAuthService`/`IntegrationsService` 어느 쪽으로도 역참조가 없어 순환 의존이 발생하지 않는다. 파일 자체 주석("두 서비스는 서로를 주입하지 못한다")이 이 결합을 의도적으로 순수 함수로 분리한 설계 근거를 명시한다. NestJS DI provider 가 아니라 TS 레벨 함수/상수 import 이므로 `WorkflowAssistantModule` 쪽에 `IntegrationsModule` 을 새로 import 할 필요도 없다.
  - 제안: 없음 — 권장 패턴(공유 판정 로직의 단일 소스화, DRY). 향후 `integration-visibility.ts` 가 더 많은 항목을 참조하게 되면 별도 shared/common 위치로의 승격을 고려할 수 있으나 현재 스코프에서는 과설계.

- **[INFO]** 내부 API 시그니처 변경(브레이킹, 같은 PR 내 호출부 전수 갱신 확인)
  - 위치: `CandidateLookupService.fillCandidates`/`lookup`/`lookupIntegrations`/`lookupMcpServers` (`candidate-lookup.service.ts`), `AssistantFinishGuard.evaluateReviewGuard` (`assistant-finish-guard.service.ts`), `IntegrationsService.findAll`/`IntegrationOAuthService.precheckCafe24Mall` 등에 `userId` 파라미터 추가
  - 상세: 시그니처 변경 파일과 대응 스펙 파일(`candidate-lookup.service.spec.ts`, `assistant-finish-guard.service.spec.ts`, `assistant-tool-router.service.spec.ts`, `integration-oauth.service.cafe24.spec.ts` 등)이 diff 안에서 함께 갱신되어 있어 사내 호출부 누락은 관측되지 않았다. 외부에 노출되는 npm 패키지가 아니라 프로젝트 내부 모듈이므로 semver 관점의 하위호환 문제는 없다.
  - 제안: 없음 — 확인 목적의 기록.

## 요약
이번 변경 셋(27개 파일: backend 통합/workflow-assistant 서비스·DTO·테스트, 신규 e2e, frontend 문서)에는 `package.json`/lockfile 수정이 전혀 없어 새 외부 의존성·버전 고정·라이선스·취약점·번들 크기 이슈가 발생하지 않는다. 관측되는 유일한 "의존성" 변화는 프로젝트 내부 모듈 결합 두 건(`IntegrationOAuthService → WorkspacesService`, `workflow-assistant → integrations/integration-visibility`)이며, 둘 다 기존 모듈 wiring(이미 import 된 `WorkspacesModule`) 또는 순수 함수 리프 모듈 참조로 이뤄져 순환 의존이나 새 DI 설정이 필요 없는 안전한 형태다. 의존성 관점에서 차단 사유는 없다.

## 위험도
NONE
